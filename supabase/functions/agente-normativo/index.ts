// Vigia normativo mínimo (P1.10).
//
// Todo dia a rotina jards-agente-normativo (pg_cron + pg_net, com o segredo do
// cofre no cabeçalho x-agente-segredo) chama esta função, que:
// 1. lê a Base de Dados de Publicações do DOU, os dados abertos da Imprensa
//    Nacional (sem login, _shared/vigia-base-dados.ts): um .zip da seção 1 por
//    mês, regravado uma vez por dia perto do meio-dia. O INLABS, que era a
//    fonte até 21/10/2026, exige conta e passa semanas em manutenção;
// 2. lê, do mais antigo ao mais novo, os dias que ainda faltam depois da marca
//    "lido até" (normas_fontes.configuracao.lido_ate; até hoje, e o dia que a
//    base ainda não publicou espera a próxima rotina). Baixa o
//    arquivo do mês só quando ele mudou desde a última leitura (a versão e os
//    dias do arquivo ficam em normas_fontes.configuracao.base_dados) e
//    descompacta só os XMLs do dia lido, para caber no tempo e na memória da
//    função: no máximo alguns dias por chamada, o resto fica para a seguinte;
// 3. faz a triagem sem IA (_shared/vigia-dou.ts) e guarda em
//    normas_documentos os atos que podem mudar uma regra dos regimes;
// 4. registra cada dia em agente_execucoes e avisa o super admin dos atos
//    novos (fn_normas_avisar). A falha avisa uma vez e fica quieta por seis
//    dias, para uma pane longa da fonte não virar aviso todo dia; a rotina
//    também avisa se a base ficar mais de cinco dias parada.
// A rotina roda às 8h07 e às 11h07; a falha só vira aviso na última tentativa
// do dia ({"ultima": true}). O super admin também roda a coleta pela tela
// /admin/normas, para um dia escolhido; aí a função confere o token dele, lê
// só aquele dia e avisa da falha na hora.
//
// No modo "paginas" (P6.1, rotina jards-agente-paginas), coleta as páginas e
// os arquivos dos órgãos vencidos pela frequência de cada fonte (paginas.ts);
// pela tela, uma fonte escolhida, na hora. No modo "ler" (P6.2), a IA lê um
// documento conferido e propõe a nova versão de cada regime que ele afeta
// (leitura.ts). No modo "avaliar" (P6.5), roda o conjunto de teste do agente
// e guarda a nota de cada caso, sem gerar proposta (avaliacao.ts); responde
// logo com o id da rodada e lê em segundo plano.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";
import {
  arquivoDaSecao1,
  diasDoZip,
  diasEntre,
  diasPendentes,
  ehFimDeSemana,
  enderecoDaPaginaDoMes,
  somarDias,
  vereditoDoDia,
  xmlsDoDia,
  type ArquivoDoMes,
} from "../_shared/vigia-base-dados.ts";
import { chaveDoArtigo, lerArtigoDou, triarArtigo, type ArtigoDou } from "../_shared/vigia-dou.ts";
import { iniciarAvaliacao } from "./avaliacao.ts";
import { lerDocumento } from "./leitura.ts";
import { CAMPOS_DA_FONTE, coletarFontes, fonteVencida, type Cliente, type FonteVigiada } from "./paginas.ts";

// Tarefas em segundo plano das funções do Supabase.
declare const EdgeRuntime: { waitUntil(promessa: Promise<unknown>): void } | undefined;

const TEXTO_MAXIMO = 200_000;

// Identificação do leitor nas requisições à base aberta (nome genérico, sem dados de quem usa).
const IDENTIFICACAO = "VigiaDOU/1.0 (leitura dos dados abertos do Diário Oficial da União)";
// Os arquivos mensais da seção 1 têm 35 a 100 MB; acima disso a função não tem memória para ler.
const TAMANHO_MAXIMO_DO_ARQUIVO = 200 * 1024 * 1024;
const PRAZO_DO_DOWNLOAD_MS = 100_000;
// Depois de uma pane muito longa, a rotina volta no máximo tantos dias.
const JANELA_DE_DIAS = 45;
// Por chamada: no máximo 6 dias lidos, e nenhum novo depois de 800 ms de descompactação e triagem
// (a função tem cerca de 2 s de CPU; um dia custa de 0,1 a 0,2 s). O resto fica para a rotina seguinte.
// Dia sem Diário (fim de semana, feriado) não gasta CPU e não entra na conta.
const DIAS_POR_CHAMADA = 6;
const ORCAMENTO_DE_CPU_MS = 800;
// Base parada: dia útil sem publicação há tantos dias vira falha. E uma falha só avisa de novo depois de seis dias.
const ATRASO_DA_BASE_PARA_FALHAR_DIAS = 5;
const SILENCIO_APOS_AVISO_DE_FALHA_MS = 6 * 86_400_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diferenca = 0;
  for (let i = 0; i < x.length; i++) diferenca |= x[i] ^ y[i];
  return diferenca === 0;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  return Array.from(resumo, b => b.toString(16).padStart(2, "0")).join("");
}

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Repete o passo quando a base aberta falha (conexão encerrada, 5xx), com espera de 3 e 8 segundos. */
async function comTentativas<T>(passo: () => Promise<T>): Promise<T> {
  const esperas = [3_000, 8_000];
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await passo();
    } catch (falha) {
      if (tentativa >= esperas.length) throw falha;
      await esperar(esperas[tentativa]);
    }
  }
}

async function paginaDoMes(dia: string): Promise<string> {
  const resposta = await fetch(enderecoDaPaginaDoMes(dia), {
    headers: { "User-Agent": IDENTIFICACAO, Accept: "text/html" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!resposta.ok) {
    await resposta.body?.cancel();
    throw new Error(`a página da base aberta respondeu ${resposta.status}`);
  }
  return await resposta.text();
}

/** Baixa o .zip direto para um buffer do tamanho anunciado, sem a cópia extra do arrayBuffer(). */
async function baixarArquivo(url: string): Promise<Uint8Array> {
  const resposta = await fetch(url, {
    headers: { "User-Agent": IDENTIFICACAO, Accept: "application/zip" },
    signal: AbortSignal.timeout(PRAZO_DO_DOWNLOAD_MS),
  });
  if (!resposta.ok || !resposta.body) {
    await resposta.body?.cancel();
    throw new Error(`o download do arquivo da base aberta respondeu ${resposta.status}`);
  }
  const tamanho = Number(resposta.headers.get("content-length"));
  if (!Number.isFinite(tamanho) || tamanho <= 0) {
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    if (bytes.length > TAMANHO_MAXIMO_DO_ARQUIVO) throw new Error("o arquivo da base aberta passou do tamanho que a função consegue ler");
    return bytes;
  }
  if (tamanho > TAMANHO_MAXIMO_DO_ARQUIVO) {
    await resposta.body.cancel();
    throw new Error(`o arquivo da base aberta tem ${Math.round(tamanho / 1048576)} MB, mais do que a função consegue ler`);
  }
  const arquivo = new Uint8Array(tamanho);
  let gravados = 0;
  const leitor = resposta.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    if (gravados + value.length > tamanho) throw new Error("o arquivo da base aberta veio maior do que o anunciado");
    arquivo.set(value, gravados);
    gravados += value.length;
  }
  if (gravados !== tamanho) throw new Error("o download do arquivo da base aberta terminou antes do fim");
  return arquivo;
}

type Relevante = { artigo: ArtigoDou; motivos: string[]; xml: Uint8Array };

type ResultadoDoDia = {
  execucao: string;
  referencia: string;
  situacao: "ok" | "sem_edicao" | "falhou";
  detalhe: string | null;
  lidos: number;
  rotina: number;
  relevantes: number;
  novos: number;
};

const dataBr = (dia: string) => dia.split("-").reverse().join("/");
const mensagemDaFalha = (falha: unknown) => (falha instanceof Error ? falha.message : String(falha)).slice(0, 2000);
const semContagem = { lidos: 0, rotina: 0, relevantes: 0, novos: 0 };

/** Abre a linha do dia em agente_execucoes; "rodando" fica aberta até o fim da leitura. */
async function abrirExecucao(admin: Cliente, fonteId: string, dia: string, situacao: "rodando" | ResultadoDoDia["situacao"], detalhe: string | null = null): Promise<string> {
  const { data, error } = await admin.from("agente_execucoes")
    .insert({ agente: "vigia_dou", fonte_id: fonteId, referencia: dia, situacao, detalhe, terminada_em: situacao === "rodando" ? null : new Date().toISOString() })
    .select("id").single();
  if (error || !data) throw new Error("não foi possível registrar a coleta");
  return data.id as string;
}

/** Lê os XMLs de um dia do .zip do mês, faz a triagem e guarda os atos que podem mudar uma regra. */
async function lerDia(admin: Cliente, fonteId: string, dia: string, zip: Uint8Array, edicoes: string[]): Promise<{ resultado: ResultadoDoDia; cpuMs: number }> {
  const execucao = await abrirExecucao(admin, fonteId, dia, "rodando");
  const contagem = { ...semContagem };
  let situacao: ResultadoDoDia["situacao"] = "ok";
  let detalhe: string | null = null;
  let cpuMs = 0;
  try {
    const inicio = performance.now();
    const xmls = xmlsDoDia(zip, dia, edicoes, unzipSync);
    const decodificador = new TextDecoder("utf-8");
    const relevantes = new Map<string, Relevante>();
    for (const xml of xmls) {
      const artigo = lerArtigoDou(decodificador.decode(xml));
      if (!artigo) continue;
      contagem.lidos += 1;
      const triagem = triarArtigo(artigo);
      if (triagem.categoria === "rotina") contagem.rotina += 1;
      if (triagem.categoria === "norma") relevantes.set(chaveDoArtigo(artigo), { artigo, motivos: triagem.motivos, xml });
    }
    cpuMs = performance.now() - inicio;
    if (xmls.length === 0) {
      situacao = "sem_edicao";
      detalhe = "Sem Diário Oficial da seção 1 neste dia nas edições vigiadas.";
    }
    contagem.relevantes = relevantes.size;
    if (relevantes.size > 0) {
      const linhas = await Promise.all([...relevantes.entries()].map(async ([chave, { artigo, motivos, xml }]) => ({
        fonte_id: fonteId,
        chave,
        publicado_em: artigo.publicadoEm || dia,
        edicao: artigo.edicao || null,
        orgao: artigo.orgao || "Sem órgão",
        tipo_ato: artigo.tipo || null,
        titulo: artigo.titulo.slice(0, 500) || null,
        ementa: artigo.ementa.slice(0, 2000) || null,
        texto: artigo.texto.slice(0, TEXTO_MAXIMO),
        url: artigo.pdf || null,
        motivos,
        hash: await sha256(xml),
        execucao_id: execucao,
      })));
      const { data: novos, error } = await admin.from("normas_documentos")
        .upsert(linhas, { onConflict: "chave", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`não foi possível guardar os atos (${error.message})`);
      contagem.novos = novos?.length ?? 0;
    }
  } catch (falha) {
    situacao = "falhou";
    detalhe = mensagemDaFalha(falha);
    console.error("agente-normativo", dia, detalhe);
  }
  await admin.from("agente_execucoes")
    .update({ situacao, detalhe, ...contagem, terminada_em: new Date().toISOString() })
    .eq("id", execucao);
  return { resultado: { execucao, referencia: dia, situacao, detalhe, ...contagem }, cpuMs };
}

// O que já se sabe de cada arquivo mensal da base (normas_fontes.configuracao.base_dados): a versão
// do arquivo e os dias que ele tem. Com a mesma versão não é preciso baixar de novo para saber
// que o dia ainda não chegou.
type CacheDaBase = Record<string, { versao: string; dias: string[] }>;

function lerCacheDaBase(configuracao: unknown): CacheDaBase {
  const bruto = (configuracao as { base_dados?: unknown } | null)?.base_dados;
  const cache: CacheDaBase = {};
  if (!bruto || typeof bruto !== "object") return cache;
  for (const [mes, valor] of Object.entries(bruto as Record<string, { versao?: unknown; dias?: unknown }>)) {
    if (/^\d{4}-\d{2}$/.test(mes) && typeof valor?.versao === "string" && Array.isArray(valor.dias) && valor.dias.every(d => typeof d === "string")) {
      cache[mes] = { versao: valor.versao, dias: valor.dias as string[] };
    }
  }
  return cache;
}

type MesNaBase = { mes: string; arquivo: ArquivoDoMes | null; dias: string[] | null; zip: Uint8Array | null };
type FonteDoDiario = { id: string; configuracao: unknown };

/**
 * Lê os dias pedidos (do mais antigo ao mais novo) e registra cada um. Para no primeiro dia que a
 * base ainda não publicou, na primeira falha e quando o orçamento de CPU da chamada acaba.
 */
async function coletarDiario(
  admin: Cliente,
  fonte: FonteDoDiario,
  edicoes: string[],
  dias: string[],
  hoje: string,
  rotina: boolean,
): Promise<{ resultados: ResultadoDoDia[]; aguardando: string | null; falha: ResultadoDoDia | null; cache: CacheDaBase | null }> {
  const cache = lerCacheDaBase(fonte.configuracao);
  let cacheMudou = false;
  const resultados: ResultadoDoDia[] = [];
  let aguardando: string | null = null;
  let falha: ResultadoDoDia | null = null;
  let cpuMs = 0;
  let diasLidos = 0;
  let mes: MesNaBase | null = null;

  const registrarFalha = async (dia: string, detalhe: string): Promise<ResultadoDoDia> => {
    console.error("agente-normativo", dia, detalhe);
    let execucao = "";
    try {
      execucao = await abrirExecucao(admin, fonte.id, dia, "falhou", detalhe);
    } catch { /* sem registro não há aviso, mas a resposta da função conta a falha */ }
    const registro: ResultadoDoDia = { execucao, referencia: dia, situacao: "falhou", detalhe, ...semContagem };
    resultados.push(registro);
    return registro;
  };

  for (const dia of dias) {
    if (diasLidos >= DIAS_POR_CHAMADA || (diasLidos > 0 && cpuMs > ORCAMENTO_DE_CPU_MS)) break;
    try {
      if (mes?.mes !== dia.slice(0, 7)) {
        mes = { mes: dia.slice(0, 7), arquivo: null, dias: null, zip: null }; // solta o .zip do mês anterior
        const pagina = await comTentativas(() => paginaDoMes(dia));
        mes.arquivo = arquivoDaSecao1(pagina, dia);
        if (mes.arquivo) {
          const guardado = cache[mes.mes];
          if (guardado && mes.arquivo.versao !== null && guardado.versao === mes.arquivo.versao) {
            mes.dias = guardado.dias;
          } else {
            mes.zip = await baixarArquivo(mes.arquivo.url);
            const inicio = performance.now();
            mes.dias = diasDoZip(mes.zip, unzipSync);
            cpuMs += performance.now() - inicio;
            if (mes.dias.length === 0) throw new Error("o arquivo da base aberta não tem nenhum ato que eu reconheça (o formato dele mudou?)");
            if (mes.arquivo.versao !== null) {
              cache[mes.mes] = { versao: mes.arquivo.versao, dias: mes.dias };
              cacheMudou = true;
            }
          }
        }
      }
      const veredito = vereditoDoDia(dia, hoje, mes.dias);
      if (veredito.acao === "aguardar") {
        aguardando = dia;
        break;
      }
      if (veredito.acao === "arquivo_ausente") {
        throw new Error(`a página da base aberta não lista o arquivo de ${dataBr(dia).slice(3)} da seção 1`);
      }
      if (veredito.acao === "sem_edicao") {
        const detalhe = veredito.fimDeSemana
          ? "Sem Diário Oficial da seção 1 neste dia (fim de semana)."
          : "Sem arquivos deste dia na base aberta (feriado ou lacuna da fonte).";
        const execucao = await abrirExecucao(admin, fonte.id, dia, "sem_edicao", detalhe);
        resultados.push({ execucao, referencia: dia, situacao: "sem_edicao", detalhe, ...semContagem });
        continue;
      }
      mes.zip ??= await baixarArquivo(mes.arquivo!.url);
      const { resultado, cpuMs: gasto } = await lerDia(admin, fonte.id, dia, mes.zip, edicoes);
      cpuMs += gasto;
      diasLidos += 1;
      resultados.push(resultado);
      if (resultado.novos > 0) await admin.rpc("fn_normas_avisar", { p_execucao_id: resultado.execucao });
      if (resultado.situacao === "falhou") {
        falha = resultado;
        break;
      }
    } catch (erro) {
      falha = await registrarFalha(dia, mensagemDaFalha(erro));
      break;
    }
  }

  // Base parada: o dia útil do mês corrente que ela não publica há dias é falha, não espera.
  const espera = aguardando;
  const parado = rotina && !falha && espera
    ? dias.find(d => d >= espera && d.slice(0, 7) === hoje.slice(0, 7) && !ehFimDeSemana(d) && diasEntre(d, hoje) >= ATRASO_DA_BASE_PARA_FALHAR_DIAS)
    : undefined;
  if (parado) {
    const ultimo = mes?.dias?.at(-1);
    falha = await registrarFalha(parado, `a base aberta da Imprensa Nacional não publicou o Diário de ${dataBr(parado)}${ultimo ? ` (o último dia no arquivo é ${dataBr(ultimo)})` : ""}`);
  }
  return { resultados, aguardando, falha, cache: cacheMudou ? cache : null };
}

const ehDia = (valor: unknown): valor is string => typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor);

/**
 * Dias que a rotina ainda precisa ler: os depois da marca "lido até" (o último dia lido, ok ou sem
 * edição, sem buraco antes dele) até hoje. Sem a marca (primeira rotina desta versão), parte do último
 * dia lido com sucesso; sem nenhum, só de hoje. Depois de uma pane muito longa volta no máximo JANELA_DE_DIAS.
 */
async function diasParaLerNaRotina(admin: Cliente, configuracao: unknown, hoje: string): Promise<{ dias: string[]; marca: string; lidas: Set<string> }> {
  const guardada = (configuracao as { lido_ate?: unknown } | null)?.lido_ate;
  let marca: string;
  if (ehDia(guardada)) {
    marca = guardada;
  } else {
    const { data: ultima } = await admin.from("agente_execucoes").select("referencia")
      .eq("agente", "vigia_dou").in("situacao", ["ok", "sem_edicao"]).lte("referencia", hoje)
      .order("referencia", { ascending: false }).limit(1).maybeSingle();
    marca = ehDia(ultima?.referencia) ? ultima.referencia : somarDias(hoje, -1);
  }
  const maisAntiga = somarDias(hoje, -JANELA_DE_DIAS - 1);
  if (marca < maisAntiga) marca = maisAntiga;
  const { data: feitas } = await admin.from("agente_execucoes").select("referencia")
    .eq("agente", "vigia_dou").in("situacao", ["ok", "sem_edicao"]).gt("referencia", marca);
  const lidas = new Set<string>((feitas ?? []).map((linha: { referencia: string }) => linha.referencia));
  return { dias: diasPendentes(somarDias(marca, 1), hoje, lidas), marca, lidas };
}

/** Já saiu aviso de falha do Vigia do Diário nos últimos seis dias? Então uma pane longa não avisa todo dia. */
async function jaAvisouDaFalha(admin: Cliente): Promise<boolean> {
  const desde = new Date(Date.now() - SILENCIO_APOS_AVISO_DE_FALHA_MS).toISOString();
  const { data } = await admin.from("notification_events").select("id")
    .eq("event_key", "normas_vigia").eq("payload->>agente", "vigia_dou").eq("payload->>situacao", "falhou")
    .gte("occurred_at", desde).limit(1);
  return (data?.length ?? 0) > 0;
}

// Para as páginas: no máximo 8 fontes por coleta (as outras ficam vencidas para
// o dia seguinte) e nenhuma começa depois de 100 segundos, abaixo do limite da função.
const FONTES_POR_COLETA = 8;
const PRAZO_DAS_PAGINAS_MS = 100_000;

async function coletarPaginas(admin: Cliente, fonteId: string | undefined) {
  const hoje = hojeEmBrasilia();
  let consulta = admin.from("normas_fontes").select(CAMPOS_DA_FONTE).in("tipo", ["pagina", "arquivo"]);
  consulta = fonteId ? consulta.eq("id", fonteId) : consulta.eq("ativa", true);
  const { data, error } = await consulta.order("ultima_coleta_em", { ascending: true, nullsFirst: true });
  if (error) return responder({ error: "fontes_nao_lidas" }, 500);
  const fontes = ((data ?? []) as FonteVigiada[]).filter(fonte => fonteId || fonteVencida(fonte)).slice(0, FONTES_POR_COLETA);
  if (fonteId && fontes.length === 0) return responder({ error: "fonte_inexistente" }, 404);
  if (fontes.length === 0) return responder({ referencia: hoje, situacao: "nada_vencido" });

  const { data: execucao, error: erroExecucao } = await admin.from("agente_execucoes")
    .insert({ agente: "vigia_paginas", fonte_id: fonteId ?? null, referencia: hoje, situacao: "rodando" })
    .select("id").single();
  if (erroExecucao || !execucao) return responder({ error: "execucao_nao_registrada" }, 500);

  let resumo;
  try {
    resumo = await coletarFontes(admin, fontes, execucao.id, hoje, PRAZO_DAS_PAGINAS_MS);
  } catch (falha) {
    const detalhe = (falha instanceof Error ? falha.message : String(falha)).slice(0, 2000);
    await admin.from("agente_execucoes")
      .update({ situacao: "falhou", detalhe, terminada_em: new Date().toISOString() }).eq("id", execucao.id);
    await admin.rpc("fn_normas_avisar", { p_execucao_id: execucao.id });
    return responder({ execucao: execucao.id, situacao: "falhou", detalhe }, 502);
  }
  // Uma fonte que falha sozinha espera a terceira falha para avisar; todas
  // falharem (a rede da função, não o órgão) é falha da coleta.
  const situacao = resumo.todasFalharam && fontes.length > 1 ? "falhou" : "ok";
  await admin.from("agente_execucoes").update({
    situacao,
    lidos: resumo.lidos,
    rotina: resumo.rotina,
    relevantes: resumo.relevantes,
    novos: resumo.novos,
    fontes_sem_resposta: resumo.semResposta,
    detalhe: resumo.detalhe,
    terminada_em: new Date().toISOString(),
  }).eq("id", execucao.id);
  if (situacao === "falhou" || resumo.novos > 0 || resumo.semResposta.length > 0) {
    await admin.rpc("fn_normas_avisar", { p_execucao_id: execucao.id });
  }
  return responder({ execucao: execucao.id, referencia: hoje, situacao, ...resumo });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return responder({ error: "metodo" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // A rotina diária manda o segredo do cofre; o super admin, o próprio token.
  const segredo = Deno.env.get("AGENTE_NORMATIVO_SEGREDO") ?? "";
  let autorizado = !!segredo && iguais(req.headers.get("x-agente-segredo") ?? "", segredo);
  let userId: string | null = null;
  if (!autorizado) {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (user) {
      const { data: perfil } = await admin.from("profiles").select("jards_super_admin").eq("id", user.id).maybeSingle();
      autorizado = perfil?.jards_super_admin === true;
      userId = user.id;
    }
  }
  if (!autorizado) return responder({ error: "sem_permissao" }, 401);

  const corpo = await req.json().catch(() => ({})) as {
    data?: string; ultima?: boolean; modo?: string; fonte_id?: string; documento_id?: string; casos?: unknown;
  };
  if (corpo.modo === "avaliar") {
    const casos = Array.isArray(corpo.casos) ? corpo.casos.filter((c): c is string => typeof c === "string").slice(0, 20) : undefined;
    const avaliacao = await iniciarAvaliacao(admin, userId, hojeEmBrasilia(), casos);
    // A leitura segue depois da resposta (tarefa em segundo plano do Supabase).
    if (avaliacao.trabalho) {
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(avaliacao.trabalho);
      else await avaliacao.trabalho;
    }
    return responder(avaliacao.corpo, avaliacao.status);
  }
  if (corpo.modo === "ler") {
    if (!/^[0-9a-f-]{36}$/i.test(corpo.documento_id ?? "")) return responder({ error: "documento_invalido" }, 400);
    const leitura = await lerDocumento(admin, corpo.documento_id!, userId, hojeEmBrasilia());
    return responder(leitura.corpo, leitura.status);
  }
  if (corpo.modo === "paginas") {
    if (corpo.fonte_id !== undefined && !/^[0-9a-f-]{36}$/i.test(corpo.fonte_id)) return responder({ error: "fonte_invalida" }, 400);
    return await coletarPaginas(admin, corpo.fonte_id);
  }
  const hoje = hojeEmBrasilia();
  const data = corpo.data ?? hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hoje) return responder({ error: "data_invalida" }, 400);
  // A rotina do dia não pede data; a coleta pela tela, sim.
  const rotina = corpo.data === undefined;
  const avisarFalha = !rotina || corpo.ultima === true;

  const { data: fonte } = await admin.from("normas_fontes").select("id, ativa, configuracao").eq("codigo", "dou_secao1").maybeSingle();
  if (!fonte?.ativa) return responder({ error: "fonte_inativa" }, 409);
  const edicoesVigiadas: string[] = Array.isArray(fonte.configuracao?.edicoes) ? fonte.configuracao.edicoes : ["DO1", "DO1E"];

  // A rotina lê todos os dias que faltam até hoje; a coleta pela tela, só o dia escolhido.
  const pauta = rotina ? await diasParaLerNaRotina(admin, fonte.configuracao, hoje) : null;
  const dias = pauta ? pauta.dias : [data];
  if (dias.length === 0) {
    if (pauta && pauta.marca !== fonte.configuracao?.lido_ate) {
      await admin.from("normas_fontes").update({ configuracao: { ...(fonte.configuracao ?? {}), lido_ate: pauta.marca } }).eq("id", fonte.id);
    }
    return responder({ referencia: hoje, situacao: "ja_coletada" });
  }

  const coleta = await coletarDiario(admin, fonte, edicoesVigiadas, dias, hoje, rotina);
  const { resultados, aguardando, falha } = coleta;

  // Ficam guardados, na configuração da fonte, o que se aprendeu dos arquivos mensais (só os três
  // meses mais novos) e até que dia a rotina leu sem buraco; a coleta sem falha marca a fonte como coletada.
  const atualizacao: Record<string, unknown> = {};
  const configuracao: Record<string, unknown> = { ...(fonte.configuracao ?? {}) };
  let configuracaoMudou = false;
  const cache = coleta.cache;
  if (cache) {
    const meses = Object.keys(cache).sort().slice(-3);
    configuracao.base_dados = Object.fromEntries(meses.map(mes => [mes, cache[mes]]));
    configuracaoMudou = true;
  }
  if (pauta) {
    const lidas = new Set(pauta.lidas);
    for (const r of resultados) if (r.situacao !== "falhou") lidas.add(r.referencia);
    let marca = pauta.marca;
    while (lidas.has(somarDias(marca, 1))) marca = somarDias(marca, 1);
    if (marca !== fonte.configuracao?.lido_ate) {
      configuracao.lido_ate = marca;
      configuracaoMudou = true;
    }
  }
  if (configuracaoMudou) atualizacao.configuracao = configuracao;
  if (!falha) atualizacao.ultima_coleta_em = new Date().toISOString();
  if (Object.keys(atualizacao).length > 0) await admin.from("normas_fontes").update(atualizacao).eq("id", fonte.id);

  // Falha: a coleta pela tela avisa na hora; a rotina, só na última tentativa do dia e, numa pane
  // longa, uma vez a cada seis dias.
  if (falha?.execucao && avisarFalha && (!rotina || !(await jaAvisouDaFalha(admin)))) {
    await admin.rpc("fn_normas_avisar", { p_execucao_id: falha.execucao });
  }

  const soma = (campo: "lidos" | "rotina" | "relevantes" | "novos") => resultados.reduce((total, r) => total + r[campo], 0);
  const resumo = { lidos: soma("lidos"), rotina: soma("rotina"), relevantes: soma("relevantes"), novos: soma("novos") };
  const detalheDaEspera = "A base aberta ainda não publicou este dia (ela atualiza uma vez por dia, perto do meio-dia).";

  if (!rotina) {
    if (aguardando) return responder({ referencia: data, situacao: "aguardando", detalhe: detalheDaEspera, ...semContagem });
    const dia = resultados[0];
    return responder(
      { execucao: dia.execucao, referencia: data, situacao: dia.situacao, detalhe: dia.detalhe, ...resumo },
      dia.situacao === "falhou" ? 502 : 200,
    );
  }
  const situacao = falha ? "falhou" : resultados.length > 0 ? "ok" : "aguardando";
  return responder({
    referencia: hoje,
    situacao,
    detalhe: falha?.detalhe ?? (resultados.length === 0 && aguardando ? detalheDaEspera : null),
    ...resumo,
    dias: resultados.map(({ referencia, situacao, lidos, relevantes, novos }) => ({ referencia, situacao, lidos, relevantes, novos })),
    pendentes: dias.length - resultados.filter(r => r.situacao !== "falhou").length,
  }, falha ? 502 : 200);
});
