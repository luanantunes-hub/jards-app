/**
 * Quantas barras acendem numa fileira de `total` barras para mostrar `valor` frente ao maior valor
 * (`max`) da comparação. Qualquer valor acima de zero acende pelo menos uma, para não parecer vazio.
 */
export function barrasAcesas(valor: number, max: number, total: number): number {
  if (!(valor > 0) || !(max > 0) || total <= 0) return 0;
  return Math.min(total, Math.max(1, Math.round((valor / max) * total)));
}
