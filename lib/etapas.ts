/**
 * Etapas de desfecho encerram o caso e têm fluxo próprio: a negociação só é
 * aprovada por "Fechar negócio" (valor fechado, venda e cliente) e recusada
 * com confirmação. O cadastro nunca oferece desfecho; ao editar um caso já
 * encerrado, o desfecho atual continua visível para poder reabrir.
 */
export const DESFECHOS_NEGOCIACAO: readonly string[] = ["aprovado", "recusado"];
export const DESFECHOS_INSCRICAO: readonly string[] = ["aprovado", "reprovado", "cancelado"];

export function ehDesfecho(status: string | null | undefined, desfechos: readonly string[]): boolean {
  return Boolean(status) && desfechos.includes(status as string);
}

/** Etapas do formulário: as em aberto e, ao editar, a atual. */
export function etapasDoFormulario<T extends { status: string }>(
  etapas: T[],
  desfechos: readonly string[],
  atual?: string | null,
): T[] {
  return etapas.filter(etapa => !desfechos.includes(etapa.status) || etapa.status === atual);
}

/** Etapa inicial do cadastro: a pedida (coluna do kanban), se estiver em aberto; senão a primeira em aberto. */
export function etapaInicial<T extends { status: string }>(
  etapas: T[],
  desfechos: readonly string[],
  pedida?: string | null,
): string {
  const abertas = etapas.filter(etapa => !desfechos.includes(etapa.status));
  if (pedida && abertas.some(etapa => etapa.status === pedida)) return pedida;
  return abertas[0]?.status ?? pedida ?? "";
}
