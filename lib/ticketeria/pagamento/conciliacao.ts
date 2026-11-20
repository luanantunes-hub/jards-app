// A conciliação (T4): confere o extrato do provedor contra os pedidos pagos do Jards. Cada linha do extrato é uma cobrança paga
// (referência e valor); cada pedido pago tem a referência do provedor e o total. A conferência diária automática e o repasse são da T7.

export type PedidoPago = { id: string; codigo: string; provedor_ref: string | null; total_centavos: number };
export type LinhaDoExtrato = { ref: string; valor_centavos: number };

export type Conciliacao = {
  conferidos: { pedido: PedidoPago; linha: LinhaDoExtrato }[];
  /** Pago no Jards, ausente do extrato do provedor. */
  semExtrato: PedidoPago[];
  /** No extrato do provedor, sem pedido pago no Jards. */
  semPedido: LinhaDoExtrato[];
  /** Os dois existem, com valores diferentes. */
  valorDivergente: { pedido: PedidoPago; linha: LinhaDoExtrato }[];
  /** A diferença total (extrato menos Jards), em centavos. */
  diferenca_centavos: number;
};

export function conciliar(pedidos: readonly PedidoPago[], extrato: readonly LinhaDoExtrato[]): Conciliacao {
  const linhas = new Map<string, LinhaDoExtrato[]>();
  for (const linha of extrato) linhas.set(linha.ref, [...(linhas.get(linha.ref) ?? []), linha]);
  const resultado: Conciliacao = { conferidos: [], semExtrato: [], semPedido: [], valorDivergente: [], diferenca_centavos: 0 };
  const usadas = new Set<LinhaDoExtrato>();
  for (const pedido of pedidos) {
    const linha = pedido.provedor_ref ? linhas.get(pedido.provedor_ref)?.find(item => !usadas.has(item)) : undefined;
    if (!linha) { resultado.semExtrato.push(pedido); continue; }
    usadas.add(linha);
    (linha.valor_centavos === pedido.total_centavos ? resultado.conferidos : resultado.valorDivergente).push({ pedido, linha });
  }
  resultado.semPedido = extrato.filter(linha => !usadas.has(linha));
  const totalExtrato = extrato.reduce((soma, linha) => soma + linha.valor_centavos, 0);
  const totalJards = pedidos.reduce((soma, pedido) => soma + pedido.total_centavos, 0);
  resultado.diferenca_centavos = totalExtrato - totalJards;
  return resultado;
}
