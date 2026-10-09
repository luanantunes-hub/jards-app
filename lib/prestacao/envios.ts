// Envios registrados (P4.6): o que a tela mostra de cada envio e do retrato.
//
// O banco grava o envio e o retrato (fn_prestacao_registrar_envio) e trava o
// que foi enviado; aqui fica o texto da situação, da guarda e o resumo do
// retrato, e a conferência do formulário antes de chamar a função. Sem React
// e sem Supabase.

import { ROTULO_DA_ETAPA } from "./envio";
import type { PrestacaoEnvio } from "@/lib/supabase/types";

export type EnvioDaLista = Pick<PrestacaoEnvio,
  "id" | "etapa" | "exercicio" | "versao" | "enviado_em" | "protocolo" | "sistema" | "comentario" | "situacao" | "registrado_em"
  | "reaberto_em" | "motivo_reabertura" | "guarda_ate" | "guarda_marco" | "retrato_sha256">;

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const MARCO: Record<string, string> = {
  registro_decisao: "a decisão final sobre as contas",
  fim_vigencia: "o fim da vigência",
  fim_exercicio: "o fim do exercício",
  envio_prestacao: "o envio",
};

/**
 * O envio que vale na etapa (no máximo um por etapa e exercício, pelo banco).
 * Sem o exercício, o mais recente da etapa (na saúde, a última prestação anual).
 */
export function envioVigente(envios: readonly EnvioDaLista[], etapa: EnvioDaLista["etapa"], exercicio?: number): EnvioDaLista | null {
  return envios
    .filter(e => e.etapa === etapa && e.situacao === "vigente" && (exercicio === undefined || (e.exercicio ?? 0) === exercicio))
    .sort((a, b) => b.enviado_em.localeCompare(a.enviado_em) || (b.exercicio ?? 0) - (a.exercicio ?? 0))[0] ?? null;
}

/** Os exercícios com prestação anual valendo (P9.2). */
export const exerciciosEnviados = (envios: readonly EnvioDaLista[]) =>
  envios.filter(e => e.etapa === "parcial" && e.situacao === "vigente" && (e.exercicio ?? 0) > 0).map(e => e.exercicio as number);

export function tituloDoEnvio(e: Pick<EnvioDaLista, "etapa" | "versao"> & { exercicio?: number | null }): string {
  const etapa = e.etapa === "parcial" && e.exercicio ? `Prestação anual de ${e.exercicio}` : ROTULO_DA_ETAPA[e.etapa];
  return `${etapa}${e.versao > 1 ? `, versão ${e.versao}` : ""}`;
}

/** Até quando o que foi enviado fica guardado. */
export function textoDaGuarda(e: Pick<EnvioDaLista, "guarda_ate" | "guarda_marco">, hoje: string): string {
  if (e.guarda_ate) {
    return e.guarda_ate < hoje ? `Guarda terminou em ${dataBr(e.guarda_ate)}` : `Guardado até ${dataBr(e.guarda_ate)}`;
  }
  const marco = e.guarda_marco ? MARCO[e.guarda_marco] : null;
  return marco ? `Guardado até ${marco} e o prazo de guarda do regime` : "Guardado até o marco de guarda do regime";
}

export function textoDaSituacao(e: Pick<EnvioDaLista, "situacao" | "reaberto_em" | "motivo_reabertura">): string {
  if (e.situacao === "vigente") return "Vale: o que foi enviado não muda nem sai";
  return `Reaberto em ${dataBr(e.reaberto_em)}${e.motivo_reabertura ? `: ${e.motivo_reabertura}` : ""}`;
}

/** Quanto o retrato guardou de cada parte. */
export function resumoDoRetrato(retrato: Record<string, unknown> | null | undefined): string[] {
  if (!retrato) return [];
  const n = (chave: string) => (Array.isArray(retrato[chave]) ? (retrato[chave] as unknown[]).length : 0);
  const checklist = (retrato.checklist ?? {}) as { arquivos?: unknown[] };
  return [
    n("despesas") ? plural(n("despesas"), "despesa", "despesas") : null,
    n("pagamentos") ? plural(n("pagamentos"), "pagamento", "pagamentos") : null,
    n("lancamentos") ? plural(n("lancamentos"), "lançamento do extrato", "lançamentos do extrato") : null,
    n("metas") ? plural(n("metas"), "meta", "metas") : null,
    n("evidencias") ? plural(n("evidencias"), "evidência", "evidências") : null,
    n("bens") ? plural(n("bens"), "bem", "bens") : null,
    n("pecas") ? plural(n("pecas"), "peça", "peças") : null,
    n("devolucoes") ? plural(n("devolucoes"), "devolução", "devoluções") : null,
    Array.isArray(checklist.arquivos) && checklist.arquivos.length ? plural(checklist.arquivos.length, "documento do checklist", "documentos do checklist") : null,
  ].filter((x): x is string => Boolean(x));
}

/** O mesmo que o banco confere, para a tela avisar antes de registrar. */
export function erroDoRegistro(campos: { enviadoEm: string; protocolo: string; comentario?: string }, hoje: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.enviadoEm)) return "Informe a data do envio.";
  if (campos.enviadoEm > hoje) return "A data do envio não pode ser futura.";
  if (campos.protocolo.trim().length > 120) return "O protocolo tem até 120 caracteres.";
  if ((campos.comentario ?? "").trim().length > 2000) return "O comentário tem até 2.000 caracteres.";
  return null;
}

export function erroDaReabertura(motivo: string): string | null {
  const t = motivo.trim();
  if (t.length < 10) return "Explique por que o envio está sendo reaberto (pelo menos 10 letras).";
  if (t.length > 2000) return "O motivo tem até 2.000 caracteres.";
  return null;
}
