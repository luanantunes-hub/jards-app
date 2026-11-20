// Resumo do trabalho de uma pessoa da equipe (página /equipe/[userId]).

export const PERIODOS = [7, 30, 90] as const;
export type Periodo = (typeof PERIODOS)[number];

/** Início do período, em ISO, contado a partir de `agora`. */
export function inicioDoPeriodo(dias: Periodo, agora: Date): string {
  return new Date(agora.getTime() - dias * 86_400_000).toISOString();
}

/** Negociações que ainda correm: não aprovadas nem recusadas. */
export const STATUS_ENCERRADOS = new Set(["aprovado", "recusado"]);

export type NegociacaoDaPessoa = { status: string; valor_solicitado: number | null };

export function resumoDasNegociacoes(lista: readonly NegociacaoDaPessoa[]) {
  const abertas = lista.filter(item => !STATUS_ENCERRADOS.has(item.status));
  const ganhas = lista.filter(item => item.status === "aprovado");
  const soma = (itens: readonly NegociacaoDaPessoa[]) => itens.reduce((total, item) => total + Number(item.valor_solicitado ?? 0), 0);
  return { abertas: abertas.length, valorAberto: soma(abertas), ganhas: ganhas.length, valorGanho: soma(ganhas) };
}

/** Atividade pendente com a data já passada. */
export function estaAtrasada(atividade: { feita: boolean; data_prevista: string | null }, hoje: string): boolean {
  return !atividade.feita && Boolean(atividade.data_prevista) && (atividade.data_prevista as string).slice(0, 10) < hoje;
}
