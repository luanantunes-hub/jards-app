// A acessibilidade por sessão (plano do módulo, PD7.6, primeiro corte): os recursos que a casa oferece (Libras, audiodescrição, legendagem,
// lugares reservados), a conferência do que a produção digita e o resumo da cobertura da sessão. Sem tela e sem banco.

import type { SituacaoDaAcessibilidade, TipoDeAcessibilidade } from "@/lib/producao/estados";

export const ROTULO_DO_TIPO_DE_ACESSIBILIDADE: Record<TipoDeAcessibilidade, string> = {
  libras: "Interpretação em Libras", audiodescricao: "Audiodescrição", legendagem: "Legendagem", lugares_reservados: "Lugares reservados", outro: "Outro recurso",
};
export const ROTULO_DA_SITUACAO_DA_ACESSIBILIDADE: Record<SituacaoDaAcessibilidade, string> = { planejado: "Planejado", confirmado: "Confirmado", cancelado: "Cancelado" };

/** Os recursos que a produção costuma querer ver cobertos em toda sessão. "Outro" fica de fora da cobertura. */
export const TIPOS_DA_COBERTURA: readonly TipoDeAcessibilidade[] = ["libras", "audiodescricao", "legendagem", "lugares_reservados"];

export type RecursoDeAcessibilidade = {
  id: string; tipo: TipoDeAcessibilidade; situacao: SituacaoDaAcessibilidade; pessoa_id: string | null; lugares: number | null; notas: string | null;
};

export type CoberturaDaSessao = {
  confirmados: TipoDeAcessibilidade[]; planejados: TipoDeAcessibilidade[]; semRecurso: TipoDeAcessibilidade[]; lugaresReservados: number;
};

/**
 * O que a sessão já tem de acessibilidade: o que está confirmado, o que só está planejado (nenhum confirmado ainda) e o que não tem
 * recurso nenhum (cancelado não conta). Os lugares reservados somam os que não foram cancelados.
 */
export function coberturaDaSessao(recursos: readonly RecursoDeAcessibilidade[]): CoberturaDaSessao {
  const vivos = recursos.filter(recurso => recurso.situacao !== "cancelado");
  const confirmados = TIPOS_DA_COBERTURA.filter(tipo => vivos.some(recurso => recurso.tipo === tipo && recurso.situacao === "confirmado"));
  const planejados = TIPOS_DA_COBERTURA.filter(tipo => !confirmados.includes(tipo) && vivos.some(recurso => recurso.tipo === tipo));
  const semRecurso = TIPOS_DA_COBERTURA.filter(tipo => !vivos.some(recurso => recurso.tipo === tipo));
  const lugaresReservados = vivos.filter(recurso => recurso.tipo === "lugares_reservados").reduce((soma, recurso) => soma + (recurso.lugares ?? 0), 0);
  return { confirmados, planejados, semRecurso, lugaresReservados };
}

export type LeituraDoRecurso =
  | { ok: true; valor: { tipo: TipoDeAcessibilidade; situacao: SituacaoDaAcessibilidade; pessoa_id: string | null; lugares: number | null; notas: string | null } }
  | { ok: false; erro: string; campo: string };

/** O recurso como o banco confere: lugares só para "lugares reservados" (de 1 a 500, obrigatórios nesse tipo); nota até 500 letras. */
export function lerRecurso(campos: { tipo: TipoDeAcessibilidade | ""; situacao: SituacaoDaAcessibilidade; pessoaId: string; lugares: string; notas: string }): LeituraDoRecurso {
  if (campos.tipo === "") return { ok: false, erro: "Escolha o recurso.", campo: "tipo" };
  const notas = campos.notas.trim();
  if (notas.length > 500) return { ok: false, erro: "A nota pode ter até 500 letras.", campo: "notas" };
  let lugares: number | null = null;
  if (campos.tipo === "lugares_reservados") {
    const numero = Number(campos.lugares.trim());
    if (campos.lugares.trim() === "" || !Number.isInteger(numero) || numero < 1 || numero > 500) return { ok: false, erro: "Informe quantos lugares ficam reservados (de 1 a 500).", campo: "lugares" };
    lugares = numero;
  }
  return { ok: true, valor: { tipo: campos.tipo, situacao: campos.situacao, pessoa_id: campos.pessoaId === "" ? null : campos.pessoaId, lugares, notas: notas === "" ? null : notas } };
}

/** O texto para o erro que o banco devolve ao gravar. */
export function mensagemDoErroDeAcessibilidade(erro: { code?: string; message?: string }): string {
  if (erro.code === "42501") return "Você não pode alterar a acessibilidade desta sessão.";
  if ((erro.message ?? "").includes("pessoa_de_outra_organizacao")) return "Essa pessoa não é da equipe desta organização.";
  return "Não foi possível salvar. Tente de novo.";
}
