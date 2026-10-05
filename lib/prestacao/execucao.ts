// Execução financeira provisória: soma dos comprovantes aceitos.
//
// O comprovante aponta para o item do orçamento por `no_id` (P1.6). O banco
// mantém `prestacoes_contas.valor_realizado` com a mesma soma de
// totalExecutado (fn_prestacao_recalcular_realizado, em
// 20261005180000_prestacao_orcamento_arvore). Na fase 2 o executado passa a
// vir dos pagamentos conciliados com o extrato.

export type ComprovanteParaExecucao = {
  no_id: string | null;
  status: string;
  valor_extraido: number | null;
};

function aceitos<T extends ComprovanteParaExecucao>(comprovantes: readonly T[]): T[] {
  return comprovantes.filter(c => c.status === "aceito");
}

function valor(c: ComprovanteParaExecucao): number {
  return typeof c.valor_extraido === "number" && Number.isFinite(c.valor_extraido) ? c.valor_extraido : 0;
}

/** Executado por item do orçamento. Comprovantes sem rubrica não entram. */
export function executadoPorItem(comprovantes: readonly ComprovanteParaExecucao[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const c of aceitos(comprovantes)) {
    if (!c.no_id) continue;
    mapa.set(c.no_id, (mapa.get(c.no_id) ?? 0) + valor(c));
  }
  return mapa;
}

/** Executado total da prestação, incluindo comprovantes aceitos ainda sem rubrica. */
export function totalExecutado(comprovantes: readonly ComprovanteParaExecucao[]): number {
  return aceitos(comprovantes).reduce((soma, c) => soma + valor(c), 0);
}

/** Total aceito sem rubrica: aparece à parte para não sumir das telas por item. */
export function executadoSemRubrica(comprovantes: readonly ComprovanteParaExecucao[]): number {
  return aceitos(comprovantes).filter(c => !c.no_id).reduce((soma, c) => soma + valor(c), 0);
}

/** Percentual inteiro; null quando não há valor aprovado para comparar. */
export function percentualExecutado(executado: number, aprovado: number): number | null {
  if (!aprovado || aprovado <= 0) return null;
  return Math.round((executado / aprovado) * 100);
}
