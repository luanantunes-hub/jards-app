// Depois do envio (P4.7): diligências, decisões, glosas e recursos.
//
// O banco calcula os prazos pelo regime e cria as atividades; aqui ficam os
// rótulos, a situação de cada registro, a previsão da análise preditiva (na
// Rouanet, diligência de 20 dias no dia seguinte ao envio), o prazo de
// análise do órgão, a conferência dos formulários e os campos da devolução
// que nasce de uma glosa. Sem React e sem Supabase.

import { competenciaDe, guiasDoRegime, indiceDoMotivo, referenciaDaGuia } from "./devolucoes";
import { calcularVencimento } from "./prazos";
import { somarDias } from "./calendario";
import { definida, type RegimeNormativo } from "./regimes";
import type { PrestacaoDecisao, PrestacaoDevolucao, PrestacaoDiligencia, PrestacaoGlosa, PrestacaoRecurso, ResultadoDaDecisao } from "@/lib/supabase/types";

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const ROTULO_DO_RESULTADO: Record<ResultadoDaDecisao, string> = {
  aprovada: "Aprovada",
  aprovada_ressalvas: "Aprovada com ressalvas",
  aprovada_parcialmente: "Aprovada parcialmente",
  reprovada: "Reprovada",
};

export const ROTULO_DO_RECURSO: Record<PrestacaoRecurso["situacao"], string> = {
  em_analise: "Em análise",
  deferido: "Deferido",
  parcialmente_deferido: "Deferido em parte",
  indeferido: "Indeferido",
};

/** Os resultados que o regime prevê, com a descrição; sem regime, os quatro. */
export function resultadosDoRegime(regime: RegimeNormativo | null | undefined): { id: ResultadoDaDecisao; rotulo: string; descricao: string | null }[] {
  const pos = regime ? definida(regime.posEnvio) : null;
  if (pos?.resultados.length) return pos.resultados.map(r => ({ id: r.resultado, rotulo: ROTULO_DO_RESULTADO[r.resultado], descricao: r.descricao }));
  return (Object.keys(ROTULO_DO_RESULTADO) as ResultadoDaDecisao[]).map(id => ({ id, rotulo: ROTULO_DO_RESULTADO[id], descricao: null }));
}

/** Texto do prazo, contado de hoje. */
export function textoDoPrazo(prazo: string | null | undefined, hoje: string): string {
  if (!prazo) return "Sem prazo";
  const dias = diasEntre(hoje, prazo);
  if (dias < 0) return `Venceu em ${dataBr(prazo)}, há ${plural(-dias, "dia", "dias")}`;
  if (dias === 0) return `Vence hoje, ${dataBr(prazo)}`;
  return `Até ${dataBr(prazo)}, ${dias === 1 ? "falta 1 dia" : `faltam ${dias} dias`}`;
}

export type EstadoDoRegistro = "aberta" | "vencida" | "respondida" | "encerrada";

export function situacaoDaDiligencia(d: Pick<PrestacaoDiligencia, "situacao" | "prazo" | "respondida_em">, hoje: string): { estado: EstadoDoRegistro; texto: string } {
  if (d.situacao === "respondida") return { estado: "respondida", texto: `Respondida em ${dataBr(d.respondida_em)}` };
  if (d.situacao === "encerrada") return { estado: "encerrada", texto: "Encerrada" };
  if (d.prazo && d.prazo < hoje) return { estado: "vencida", texto: textoDoPrazo(d.prazo, hoje) };
  return { estado: "aberta", texto: d.prazo ? `Responder ${textoDoPrazo(d.prazo, hoje).replace(/^Até/, "até")}` : "Responder" };
}

/** O recurso foi protocolado no prazo da decisão? null quando a decisão não tem prazo. */
export function recursoNoPrazo(r: Pick<PrestacaoRecurso, "protocolado_em">, d: Pick<PrestacaoDecisao, "prazo_recurso"> | null | undefined): boolean | null {
  if (!d?.prazo_recurso) return null;
  return r.protocolado_em <= d.prazo_recurso;
}

/** Até quando o órgão analisa, pelo prazo do regime contado do envio. */
export function prazoDeAnalise(regime: RegimeNormativo | null | undefined, enviadoEm: string | null | undefined): { data: string; descricao: string } | null {
  if (!regime || !enviadoEm) return null;
  const prazos = definida(regime.prazos) as Record<string, unknown> | null;
  const regra = prazos?.analisePrestacao as { marco?: string; quantidade?: number; unidade?: string; descricao?: string; prorrogaParaDiaUtil?: boolean } | undefined;
  if (!regra || regra.marco !== "envio_prestacao" || typeof regra.quantidade !== "number") return null;
  try {
    const v = calcularVencimento(enviadoEm.slice(0, 10), regra as Parameters<typeof calcularVencimento>[1]);
    return { data: v.data, descricao: regra.descricao ?? "Análise da prestação" };
  } catch {
    return null;
  }
}

/** A guarda do que foi enviado conta da decisão sobre as contas (e não do fim da vigência ou do exercício)? */
export function guardaContaDaDecisao(regime: RegimeNormativo | null | undefined): boolean {
  const marco = regime ? definida(regime.guarda)?.marco : null;
  return marco === "registro_decisao" || marco === "ciencia_decisao";
}

/** Na Rouanet, a análise preditiva abre diligência no dia seguinte ao envio; sem diligência registrada desde então, a sugestão. */
export function sugestaoDaAnalisePreditiva(
  regime: RegimeNormativo | null | undefined,
  enviadoEm: string | null | undefined,
  diligencias: readonly Pick<PrestacaoDiligencia, "recebida_em">[],
): { recebidaEm: string; descricao: string; dias: number | null } | null {
  if (!regime || !enviadoEm) return null;
  const regra = definida(regime.posEnvio)?.regras.find(r => r.codigo === "analise_preditiva");
  if (!regra) return null;
  const recebidaEm = somarDias(enviadoEm.slice(0, 10), 1);
  if (diligencias.some(d => d.recebida_em >= enviadoEm.slice(0, 10))) return null;
  const dias = Number(regra.parametros?.dias);
  return { recebidaEm, descricao: regra.descricao, dias: Number.isFinite(dias) ? dias : null };
}

// ─── Formulários ────────────────────────────────────────────────────────────

export function erroDaDiligencia(c: { recebidaEm: string; descricao: string; prazo: string; situacao: PrestacaoDiligencia["situacao"]; respondidaEm: string; resposta: string }): string | null {
  if (!c.recebidaEm) return "Informe quando a diligência chegou.";
  if (c.descricao.trim().length < 3) return "Descreva o que o órgão pede.";
  if (c.descricao.length > 4000) return "A descrição tem até 4.000 caracteres.";
  if (c.prazo && c.prazo < c.recebidaEm) return "O prazo não vem antes do recebimento.";
  if (c.situacao === "respondida" && !c.respondidaEm) return "Informe quando a resposta foi enviada.";
  if (c.respondidaEm && c.respondidaEm < c.recebidaEm) return "A resposta não vem antes do recebimento.";
  if (c.resposta.length > 4000) return "A resposta tem até 4.000 caracteres.";
  return null;
}

export function erroDaDecisao(c: { registradaEm: string; cienciaEm: string; valorGlosado: number | null; temDocumento: boolean }): string | null {
  if (!c.registradaEm) return "Informe a data da decisão.";
  if (c.cienciaEm && c.cienciaEm < c.registradaEm) return "A ciência não vem antes da decisão.";
  if (c.valorGlosado !== null && (!Number.isFinite(c.valorGlosado) || c.valorGlosado < 0)) return "Confira o valor glosado.";
  if (!c.temDocumento) return "Anexe o documento da decisão.";
  return null;
}

export function erroDaGlosa(c: { descricao: string; valor: number | null }): string | null {
  if (c.descricao.trim().length < 3) return "Descreva o que foi glosado.";
  if (c.valor === null || !Number.isFinite(c.valor) || c.valor <= 0) return "Informe o valor glosado.";
  return null;
}

export function erroDoRecurso(c: { decisaoId: string; protocoladoEm: string; situacao: PrestacaoRecurso["situacao"]; decididoEm: string }): string | null {
  if (!c.decisaoId) return "Escolha a decisão recorrida.";
  if (!c.protocoladoEm) return "Informe quando o recurso foi protocolado.";
  if (c.situacao !== "em_analise" && !c.decididoEm) return "Informe a data da decisão do recurso.";
  if (c.decididoEm && c.decididoEm < c.protocoladoEm) return "A decisão do recurso não vem antes do protocolo.";
  return null;
}

// ─── Glosa → devolução ──────────────────────────────────────────────────────

export type DevolucaoDaGlosa = Pick<PrestacaoDevolucao,
  "motivo" | "descricao" | "valor_principal" | "indice" | "data_base" | "vencimento" | "competencia"
  | "gru_unidade_gestora" | "gru_gestao" | "gru_codigo" | "gru_referencia">;

/** Os campos da devolução que recolhe a glosa: índice e guia do regime, vencimento da decisão. */
export function devolucaoDaGlosa(
  glosa: Pick<PrestacaoGlosa, "descricao" | "valor" | "data_base">,
  regime: RegimeNormativo | null | undefined,
  decisao: Pick<PrestacaoDecisao, "prazo_devolucao"> | null | undefined,
  identificador: string | null | undefined,
  hoje: string,
): { campos: DevolucaoDaGlosa; erro: string | null } {
  const indice = indiceDoMotivo(regime, "glosa");
  const guia = guiasDoRegime(regime)[0] ?? null;
  const campos: DevolucaoDaGlosa = {
    motivo: "glosa",
    descricao: `Glosa: ${glosa.descricao}`.slice(0, 500),
    valor_principal: Number(glosa.valor),
    indice,
    data_base: indice === "nenhum" ? null : glosa.data_base,
    vencimento: decisao?.prazo_devolucao ?? null,
    competencia: competenciaDe(hoje),
    gru_unidade_gestora: guia?.unidadeGestora ?? null,
    gru_gestao: guia?.gestao ?? null,
    gru_codigo: guia?.codigo ?? null,
    gru_referencia: referenciaDaGuia(identificador),
  };
  const erro = indice !== "nenhum" && !glosa.data_base ? "Informe a data-base da glosa: o regime atualiza o valor devolvido a partir dela." : null;
  return { campos, erro };
}

/** Quanto está glosado, revertido e já recolhido. */
export function resumoDasGlosas(
  glosas: readonly Pick<PrestacaoGlosa, "valor" | "situacao" | "devolucao_id">[],
  devolucoes: readonly Pick<PrestacaoDevolucao, "id" | "situacao">[],
) {
  const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
  const pagas = new Set(devolucoes.filter(d => d.situacao === "paga").map(d => d.id));
  const mantidas = glosas.filter(g => g.situacao === "mantida");
  return {
    mantido: mantidas.reduce((s, g) => s + centavos(g.valor), 0),
    revertido: glosas.filter(g => g.situacao === "revertida").reduce((s, g) => s + centavos(g.valor), 0),
    recolhido: mantidas.filter(g => g.devolucao_id && pagas.has(g.devolucao_id)).reduce((s, g) => s + centavos(g.valor), 0),
    semDevolucao: mantidas.filter(g => !g.devolucao_id).length,
  };
}
