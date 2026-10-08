// Leitura dos documentos pela IA (P6.2), o modo "ler" da função.
//
// O super admin marca um ato ou uma mudança de página como "afeta um regime"
// e a tela pede a leitura. Para cada regime do documento, a IA recebe o texto
// (e, na página, os trechos que mudaram) e o regime publicado em linhas
// "caminho = valor"; a resposta é conferida em _shared/proposta-regime.ts e
// vira uma proposta em prestacao_regime_propostas. Os regimes são lidos ao
// mesmo tempo, para caber no tempo da função.

import { registrarChamadaIa } from "../_shared/chamadas-ia.ts";
import { modeloDaIa } from "../_shared/modelo-ia.ts";
import {
  conferirLeitura,
  ESQUEMA_DA_PROPOSTA,
  lerLeituraDaIa,
  promptDaLeituraNormativa,
  regimeAchatado,
  type LeituraDaIa,
} from "../_shared/proposta-regime.ts";
import { usoDaResposta, custoDaChamada } from "../_shared/leitura-documento.ts";
import { diferencaDeLinhas } from "../_shared/vigia-paginas.ts";
import type { Cliente } from "./paginas.ts";

type Documento = {
  id: string;
  fonte_id: string | null;
  titulo: string | null;
  tipo_ato: string | null;
  orgao: string;
  publicado_em: string;
  url: string | null;
  texto: string;
  anterior_id: string | null;
  situacao: string;
  regimes: string[];
};

type Regime = { id: string; codigo: string; nome: string; versao: number; norma_referencia: string; parametros: Record<string, unknown> };

export type ResultadoDaLeitura = {
  regime: string;
  classificacao?: string;
  mudancas?: number;
  descartadas?: number;
  erro?: string;
};

const CONTEXTO = 2;
const TRECHOS_MAXIMOS = 40_000;

/** Os trechos que mudaram, com duas linhas de contexto, como a IA lê. */
export function trechosParaLeitura(antes: string, agora: string): string {
  const trechos = diferencaDeLinhas(antes ? antes.split("\n") : [], agora ? agora.split("\n") : []);
  const partes: string[] = [];
  trechos.forEach((t, i) => {
    if (t.tipo === "igual") {
      const depois = i > 0 ? t.linhas.slice(0, CONTEXTO) : [];
      const antesDoProximo = i < trechos.length - 1 ? t.linhas.slice(-CONTEXTO) : [];
      if (t.linhas.length > CONTEXTO * 2 + 1) {
        partes.push(...depois.map(l => `  ${l}`), "  [...]", ...antesDoProximo.map(l => `  ${l}`));
      } else if (i > 0 && i < trechos.length - 1) {
        partes.push(...t.linhas.map(l => `  ${l}`));
      }
    } else {
      partes.push(...t.linhas.map(l => `${t.tipo === "retirado" ? "ANTES" : "AGORA"}: ${l}`));
    }
  });
  const texto = partes.join("\n");
  return texto.length > TRECHOS_MAXIMOS ? `${texto.slice(0, TRECHOS_MAXIMOS)}\n[trechos cortados]` : texto;
}

export async function chamarIa(prompt: string): Promise<{ bruta: unknown; corpo: unknown; erro: string | null }> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) return { bruta: null, corpo: null, erro: "GOOGLE_AI_API_KEY não configurada" };
  const modelo = modeloDaIa();
  for (let tentativa = 0; ; tentativa++) {
    const resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json", response_schema: ESQUEMA_DA_PROPOSTA },
      }),
      signal: AbortSignal.timeout(170_000),
    });
    if (!resposta.ok) {
      const textoErro = await resposta.text();
      // Excesso de pedidos ou erro do lado do Google: uma nova tentativa.
      if ((resposta.status === 429 || resposta.status >= 500) && tentativa === 0) {
        await new Promise(resolve => setTimeout(resolve, 5_000));
        continue;
      }
      let mensagem = "";
      try {
        mensagem = JSON.parse(textoErro)?.error?.message ?? "";
      } catch {
        mensagem = textoErro.slice(0, 300);
      }
      return { bruta: null, corpo: null, erro: `HTTP ${resposta.status}: ${mensagem}`.slice(0, 500) };
    }
    const corpo = await resposta.json();
    const candidato = corpo?.candidates?.[0];
    try {
      return { bruta: JSON.parse(candidato?.content?.parts?.[0]?.text ?? "null"), corpo, erro: null };
    } catch {
      return { bruta: null, corpo, erro: `resposta sem JSON (${candidato?.finishReason ?? "sem candidato"})` };
    }
  }
}

async function lerUmRegime(admin: Cliente, doc: Documento, regime: Regime, trechos: string | null, execucaoId: string, userId: string | null): Promise<ResultadoDaLeitura & { custo: number; altera: boolean }> {
  const inicio = Date.now();
  const modelo = modeloDaIa();
  const prompt = promptDaLeituraNormativa({
    documento: { titulo: doc.titulo ?? "Documento sem título", tipo: doc.tipo_ato, orgao: doc.orgao, publicadoEm: doc.publicado_em, url: doc.url },
    texto: doc.texto,
    trechosQueMudaram: trechos,
    regime: { codigo: regime.codigo, nome: regime.nome, versao: regime.versao, normaReferencia: regime.norma_referencia, achatado: regimeAchatado(regime.parametros) },
  });
  const { bruta, corpo, erro } = await chamarIa(prompt);
  const leitura: LeituraDaIa | null = erro ? null : lerLeituraDaIa(bruta);
  await registrarChamadaIa(admin, {
    funcao: "agente-normativo",
    organizationId: null,
    prestacaoId: null,
    userId,
    modelo,
    arquivo: `normas_documentos/${doc.id}`,
    tamanhoBytes: prompt.length,
    corpo,
    inicio,
    sucesso: !!leitura,
    erro: erro ?? (leitura ? null : "a resposta não trouxe uma classificação"),
  });
  const custo = custoDaChamada(Deno.env.get("GOOGLE_AI_PRECOS"), modelo, usoDaResposta(corpo)) ?? 0;
  if (!leitura) return { regime: regime.codigo, erro: erro ?? "a IA não devolveu uma leitura", custo, altera: false };

  const conferida = conferirLeitura(regime.parametros, leitura, { documento: doc.titulo ?? "Documento sem título", url: doc.url, texto: doc.texto });
  const { data: afetadas } = await admin.rpc("fn_regime_prestacoes_afetadas", { p_codigo: regime.codigo });
  const contagem = (Array.isArray(afetadas) ? afetadas[0] : afetadas) as { prestacoes?: number; organizacoes?: number } | null;

  // Ler de novo substitui a proposta ainda não revisada.
  await admin.from("prestacao_regime_propostas").update({ status: "substituida" })
    .eq("documento_id", doc.id).eq("regime_codigo", regime.codigo).eq("status", "nova");
  const { error } = await admin.from("prestacao_regime_propostas").insert({
    documento_id: doc.id,
    regime_id: regime.id,
    regime_codigo: regime.codigo,
    classificacao: leitura.classificacao,
    resumo: leitura.resumo || null,
    mudancas: conferida.mudancas,
    descartadas: conferida.descartadas,
    checagens_novas: conferida.checagensNovas,
    regime_proposto: conferida.regimeProposto,
    vigencia_proposta: leitura.vigencia,
    transicao: leitura.transicao,
    prestacoes_afetadas: contagem?.prestacoes ?? 0,
    organizacoes_afetadas: contagem?.organizacoes ?? 0,
    modelo,
    custo_usd: custo || null,
    execucao_id: execucaoId,
  });
  if (error) return { regime: regime.codigo, erro: `não foi possível guardar a proposta (${error.message})`, custo, altera: false };
  return {
    regime: regime.codigo,
    classificacao: leitura.classificacao,
    mudancas: conferida.mudancas.length,
    descartadas: conferida.descartadas.length,
    custo,
    altera: conferida.mudancas.length > 0,
  };
}

/** Lê o documento para cada regime que ele afeta e grava as propostas. */
export async function lerDocumento(admin: Cliente, documentoId: string, userId: string | null, hoje: string): Promise<{ status: number; corpo: unknown }> {
  const { data: doc } = await admin.from("normas_documentos")
    .select("id, fonte_id, titulo, tipo_ato, orgao, publicado_em, url, texto, anterior_id, situacao, regimes")
    .eq("id", documentoId).maybeSingle();
  if (!doc) return { status: 404, corpo: { error: "documento_inexistente" } };
  const documento = doc as Documento;
  if (documento.situacao !== "conferido") return { status: 409, corpo: { error: "documento_nao_conferido" } };
  if (!documento.regimes?.length) return { status: 409, corpo: { error: "documento_sem_regime" } };

  let trechos: string | null = null;
  if (documento.anterior_id) {
    const { data: anterior } = await admin.from("normas_documentos").select("texto").eq("id", documento.anterior_id).maybeSingle();
    if (anterior) trechos = trechosParaLeitura(anterior.texto as string, documento.texto);
  }

  const { data: regimes } = await admin.from("prestacao_regimes")
    .select("id, codigo, nome, versao, norma_referencia, parametros")
    .in("codigo", documento.regimes).eq("status", "publicado");

  const { data: execucao, error: erroExecucao } = await admin.from("agente_execucoes")
    .insert({ agente: "leitor_normas", fonte_id: documento.fonte_id, referencia: hoje, situacao: "rodando" })
    .select("id").single();
  if (erroExecucao || !execucao) return { status: 500, corpo: { error: "execucao_nao_registrada" } };

  type Lido = ResultadoDaLeitura & { custo: number; altera: boolean };
  const resultados: Lido[] = await Promise.all(((regimes ?? []) as Regime[]).map(regime =>
    lerUmRegime(admin, documento, regime, trechos, execucao.id, userId).catch((falha): Lido => ({
      regime: regime.codigo, erro: falha instanceof Error ? falha.message : String(falha), custo: 0, altera: false,
    }))));
  const semVersao = documento.regimes.filter(codigo => !(regimes ?? []).some((r: Regime) => r.codigo === codigo));
  for (const codigo of semVersao) resultados.push({ regime: codigo, erro: "sem versão publicada", custo: 0, altera: false });

  const falharam = resultados.filter(r => r.erro);
  const situacao = falharam.length === resultados.length ? "falhou" : "ok";
  const detalhe = falharam.length ? falharam.map(r => `${r.regime}: ${r.erro}`).join("; ").slice(0, 2000) : null;
  await admin.from("agente_execucoes").update({
    situacao,
    lidos: resultados.length,
    relevantes: resultados.filter(r => r.classificacao && r.classificacao !== "irrelevante").length,
    novos: resultados.filter(r => r.altera).length,
    custo: Math.round(resultados.reduce((soma, r) => soma + r.custo, 0) * 1_000_000) / 1_000_000,
    detalhe,
    terminada_em: new Date().toISOString(),
  }).eq("id", execucao.id);

  return {
    status: situacao === "falhou" ? 502 : 200,
    corpo: {
      execucao: execucao.id,
      situacao,
      detalhe,
      resultados: resultados.map(r => ({ regime: r.regime, classificacao: r.classificacao, mudancas: r.mudancas, descartadas: r.descartadas, erro: r.erro })),
    },
  };
}
