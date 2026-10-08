// Vigia normativo mínimo (P1.10).
//
// Todo dia a rotina jards-agente-normativo (pg_cron + pg_net, com o segredo do
// cofre no cabeçalho x-agente-segredo) chama esta função, que:
// 1. entra no INLABS da Imprensa Nacional com a conta da equipe
//    (INLABS_EMAIL e INLABS_SENHA);
// 2. baixa o .zip da seção 1 do Diário Oficial do dia (e a edição extra, se
//    houver) e lê um XML por vez, sem abrir o arquivo inteiro na memória;
// 3. faz a triagem sem IA (_shared/vigia-dou.ts) e guarda em
//    normas_documentos os atos que podem mudar uma regra dos regimes;
// 4. registra a coleta em agente_execucoes e avisa o super admin dos atos
//    novos ou da falha (fn_normas_avisar).
// O INLABS às vezes recusa conexões (502, conexão encerrada): cada passo é
// tentado de novo, e a rotina roda outra vez às 11h07, sem refazer o dia já
// lido. A falha só vira aviso na última tentativa do dia ({"ultima": true}).
// O super admin também roda a coleta pela tela /admin/normas, para um dia
// escolhido; aí a função confere o token dele e avisa da falha na hora.
//
// No modo "paginas" (P6.1, rotina jards-agente-paginas), coleta as páginas e
// os arquivos dos órgãos vencidos pela frequência de cada fonte (paginas.ts);
// pela tela, uma fonte escolhida, na hora. No modo "ler" (P6.2), a IA lê um
// documento conferido e propõe a nova versão de cada regime que ele afeta
// (leitura.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Unzip, UnzipInflate } from "https://esm.sh/fflate@0.8.2";
import { chaveDoArtigo, lerArtigoDou, triarArtigo, type ArtigoDou } from "../_shared/vigia-dou.ts";
import { lerDocumento } from "./leitura.ts";
import { CAMPOS_DA_FONTE, coletarFontes, fonteVencida, type Cliente, type FonteVigiada } from "./paginas.ts";

const INLABS = "https://inlabs.in.gov.br";
const TEXTO_MAXIMO = 200_000;

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

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const resumo = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(resumo, b => b.toString(16).padStart(2, "0")).join("");
}

const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Repete o passo quando o INLABS falha, com espera de 3 e 8 segundos. */
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

/** Entra no INLABS e devolve os cookies da sessão. */
async function entrarNoInlabs(email: string, senha: string): Promise<string> {
  const resposta = await fetch(`${INLABS}/logar.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    body: new URLSearchParams({ email, password: senha }),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const cookies = resposta.headers.getSetCookie().map(cookie => cookie.split(";")[0]);
  await resposta.body?.cancel();
  if (!cookies.some(cookie => cookie.startsWith("inlabs_session_cookie="))) {
    throw new Error(`o INLABS recusou o login (resposta ${resposta.status})`);
  }
  return cookies.join("; ");
}

async function paginaDoInlabs(cookies: string, dia: string): Promise<string> {
  const resposta = await fetch(`${INLABS}/index.php?p=${dia}`, {
    headers: { Cookie: cookies },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  if (resposta.status !== 200) {
    await resposta.body?.cancel();
    throw new Error(`a página ${dia || "inicial"} do INLABS respondeu ${resposta.status}`);
  }
  return await resposta.text();
}

/**
 * Arquivos .zip publicados no dia (DO1, DO1E…). A página inicial lista os dias
 * com Diário; dia fora da lista (fim de semana, feriado, antes dos últimos
 * meses guardados) não tem edição.
 */
async function edicoesDoDia(cookies: string, data: string): Promise<string[]> {
  const dias = await paginaDoInlabs(cookies, "");
  if (!dias.includes(`?p=${data}"`)) return [];
  const html = await paginaDoInlabs(cookies, data);
  const edicoes = new Set<string>();
  for (const m of html.matchAll(new RegExp(`dl=${data}-([A-Z0-9]+)\\.zip`, "g"))) edicoes.add(m[1]);
  return [...edicoes];
}

async function baixarEdicao(cookies: string, data: string, edicao: string): Promise<Uint8Array> {
  const resposta = await fetch(`${INLABS}/index.php?p=${data}&dl=${data}-${edicao}.zip`, {
    headers: { Cookie: cookies, origem: "736372697074" },
    redirect: "manual",
    signal: AbortSignal.timeout(90_000),
  });
  if (resposta.status !== 200) {
    await resposta.body?.cancel();
    throw new Error(`o download de ${edicao} respondeu ${resposta.status}`);
  }
  return new Uint8Array(await resposta.arrayBuffer());
}

/** Chama aoLer para cada XML do .zip, descompactando um arquivo por vez. */
function lerXmlsDoZip(zip: Uint8Array, aoLer: (conteudo: Uint8Array<ArrayBuffer>) => void) {
  let erro: unknown = null;
  const leitor = new Unzip(arquivo => {
    if (!arquivo.name.toLowerCase().endsWith(".xml")) return;
    const partes: Uint8Array[] = [];
    arquivo.ondata = (falha, pedaco, fim) => {
      if (falha) { erro = falha; return; }
      partes.push(pedaco);
      if (!fim) return;
      const tamanho = partes.reduce((soma, parte) => soma + parte.length, 0);
      const conteudo = new Uint8Array(tamanho);
      let posicao = 0;
      for (const parte of partes) { conteudo.set(parte, posicao); posicao += parte.length; }
      aoLer(conteudo);
    };
    arquivo.start();
  });
  leitor.register(UnzipInflate);
  leitor.push(zip, true);
  if (erro) throw erro;
}

type Relevante = { artigo: ArtigoDou; motivos: string[]; xml: Uint8Array<ArrayBuffer> };

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

  const corpo = await req.json().catch(() => ({})) as { data?: string; ultima?: boolean; modo?: string; fonte_id?: string; documento_id?: string };
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

  if (rotina) {
    const { data: feita } = await admin.from("agente_execucoes").select("id")
      .eq("agente", "vigia_dou").eq("referencia", data).in("situacao", ["ok", "sem_edicao"]).limit(1).maybeSingle();
    if (feita) return responder({ execucao: feita.id, referencia: data, situacao: "ja_coletada" });
  }

  const { data: execucao, error: erroExecucao } = await admin.from("agente_execucoes")
    .insert({ agente: "vigia_dou", fonte_id: fonte.id, referencia: data, situacao: "rodando" })
    .select("id").single();
  if (erroExecucao || !execucao) return responder({ error: "execucao_nao_registrada" }, 500);

  const contagem = { lidos: 0, rotina: 0, relevantes: 0, novos: 0 };
  let situacao = "ok";
  let detalhe: string | null = null;
  try {
    const email = Deno.env.get("INLABS_EMAIL");
    const senha = Deno.env.get("INLABS_SENHA");
    if (!email || !senha) throw new Error("conta do INLABS não configurada");
    const cookies = await comTentativas(() => entrarNoInlabs(email, senha));
    const publicadas = await comTentativas(() => edicoesDoDia(cookies, data));
    const edicoes = edicoesVigiadas.filter(edicao => publicadas.includes(edicao));

    if (edicoes.length === 0) {
      situacao = "sem_edicao";
      detalhe = "Sem Diário Oficial da seção 1 neste dia no INLABS.";
    } else {
      const relevantes = new Map<string, Relevante>();
      for (const edicao of edicoes) {
        const zip = await comTentativas(() => baixarEdicao(cookies, data, edicao));
        const decodificador = new TextDecoder("utf-8");
        lerXmlsDoZip(zip, conteudo => {
          const artigo = lerArtigoDou(decodificador.decode(conteudo));
          if (!artigo) return;
          contagem.lidos += 1;
          const triagem = triarArtigo(artigo);
          if (triagem.categoria === "rotina") contagem.rotina += 1;
          if (triagem.categoria === "norma") relevantes.set(chaveDoArtigo(artigo), { artigo, motivos: triagem.motivos, xml: conteudo });
        });
      }
      contagem.relevantes = relevantes.size;
      if (relevantes.size > 0) {
        const linhas = await Promise.all([...relevantes.entries()].map(async ([chave, { artigo, motivos, xml }]) => ({
          fonte_id: fonte.id,
          chave,
          publicado_em: artigo.publicadoEm || data,
          edicao: artigo.edicao || null,
          orgao: artigo.orgao || "Sem órgão",
          tipo_ato: artigo.tipo || null,
          titulo: artigo.titulo.slice(0, 500) || null,
          ementa: artigo.ementa.slice(0, 2000) || null,
          texto: artigo.texto.slice(0, TEXTO_MAXIMO),
          url: artigo.pdf || null,
          motivos,
          hash: await sha256(xml),
          execucao_id: execucao.id,
        })));
        const { data: novos, error } = await admin.from("normas_documentos")
          .upsert(linhas, { onConflict: "chave", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error(`não foi possível guardar os atos (${error.message})`);
        contagem.novos = novos?.length ?? 0;
      }
    }
  } catch (falha) {
    situacao = "falhou";
    detalhe = (falha instanceof Error ? falha.message : String(falha)).slice(0, 2000);
    console.error("agente-normativo", data, detalhe);
  }

  await admin.from("agente_execucoes")
    .update({ situacao, detalhe, ...contagem, terminada_em: new Date().toISOString() })
    .eq("id", execucao.id);
  if (situacao !== "falhou") {
    await admin.from("normas_fontes").update({ ultima_coleta_em: new Date().toISOString() }).eq("id", fonte.id);
  }
  if ((situacao === "falhou" && avisarFalha) || contagem.novos > 0) {
    await admin.rpc("fn_normas_avisar", { p_execucao_id: execucao.id });
  }

  return responder({ execucao: execucao.id, referencia: data, situacao, detalhe, ...contagem }, situacao === "falhou" ? 502 : 200);
});
