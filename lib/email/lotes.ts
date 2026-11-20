/** Parte a lista em pedaços de até `tamanho` itens: listas longas não cabem de uma vez no endereço de uma consulta. */
export function emPartes<T>(itens: readonly T[], tamanho: number): T[][] {
  const partes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) partes.push(itens.slice(i, i + tamanho));
  return partes;
}

/** Roda a tarefa em lotes pequenos: Gmail e Microsoft recusam muitas leituras ao mesmo tempo para a mesma pessoa. */
export async function emLotes<T, R>(itens: readonly T[], tamanho: number, tarefa: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    resultados.push(...(await Promise.all(itens.slice(i, i + tamanho).map(tarefa))));
  }
  return resultados;
}
