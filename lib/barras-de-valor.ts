/**
 * Quantas barras acendem numa fileira de `total` barras para mostrar `valor` frente ao maior valor
 * (`max`) da comparação. Qualquer valor acima de zero acende pelo menos uma, para não parecer vazio.
 */
export function barrasAcesas(valor: number, max: number, total: number): number {
  if (!(valor > 0) || !(max > 0) || total <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round((valor / max) * total)));
}

/**
 * Quantos blocos cada segmento de uma barra em blocos ocupa, de uma fileira de `total` blocos. Os
 * segmentos vêm em ordem (por exemplo, confirmado e depois em negociação) e a conta é feita sobre o
 * acumulado, então a soma nunca passa do total nem perde bloco por arredondamento. Qualquer segmento
 * acima de zero ocupa pelo menos um bloco, se ainda houver lugar.
 */
export function blocosPorSegmento(percentuais: number[], total: number): number[] {
  let acumuladoPercentual = 0;
  let acumuladoBlocos = 0;
  return percentuais.map((valor) => {
    const percentual = Number.isFinite(valor) && valor > 0 ? valor : 0;
    acumuladoPercentual = Math.min(100, acumuladoPercentual + percentual);
    let alvo = Math.round((acumuladoPercentual / 100) * total);
    if (percentual > 0 && alvo <= acumuladoBlocos) alvo = acumuladoBlocos + 1;
    alvo = Math.min(total, Math.max(acumuladoBlocos, alvo));
    const blocos = alvo - acumuladoBlocos;
    acumuladoBlocos = alvo;
    return blocos;
  });
}
