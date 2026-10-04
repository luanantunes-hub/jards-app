// Execução financeira provisória: soma dos comprovantes aceitos.
//
// O banco mantém `valor_realizado` por gatilho (recalcular_valor_realizado e
// sync_prestacao_valor_realizado, versionados em 20260827074320): por item, a
// mesma soma daqui; na prestação, a soma dos itens, sem os comprovantes
// aceitos que ainda não têm rubrica. As telas somam direto dos comprovantes
// para mostrar esses também. Na fase 2 o executado passa a vir dos
// pagamentos conciliados com o extrato.

export type ComprovanteParaExecucao = {
  item_id: string | null;
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
    if (!c.item_id) continue;
    mapa.set(c.item_id, (mapa.get(c.item_id) ?? 0) + valor(c));
  }
  return mapa;
}

/** Executado total da prestação, incluindo comprovantes aceitos ainda sem rubrica. */
export function totalExecutado(comprovantes: readonly ComprovanteParaExecucao[]): number {
  return aceitos(comprovantes).reduce((soma, c) => soma + valor(c), 0);
}

/** Total aceito sem rubrica: aparece à parte para não sumir das telas por item. */
export function executadoSemRubrica(comprovantes: readonly ComprovanteParaExecucao[]): number {
  return aceitos(comprovantes).filter(c => !c.item_id).reduce((soma, c) => soma + valor(c), 0);
}

/** Percentual inteiro; null quando não há valor aprovado para comparar. */
export function percentualExecutado(executado: number, aprovado: number): number | null {
  if (!aprovado || aprovado <= 0) return null;
  return Math.round((executado / aprovado) * 100);
}
