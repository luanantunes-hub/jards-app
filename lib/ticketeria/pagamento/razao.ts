// O livro-razão de partidas dobradas da Ticketeria (T4; o desenho do pgledger): cada transação tem duas ou mais partidas com sinal
// que somam zero. O banco grava e confere (fn_ticketeria_confirmar_pagamento e o gatilho ticketeria_partidas_equilibrio); esta cópia
// diz, na tela e nos testes, o que cada operação deve gravar.
//
// Contas: psp_a_receber (o que o provedor recebeu do comprador: positivo), produtor (o que é do produtor e o split repassa:
// negativo) e plataforma (a taxa do Jards: negativo). O Jards não guarda saldo de terceiros (D3): o razão registra de quem é cada
// centavo que passou pelo provedor.

import type { ContaDoRazao } from "@/lib/ticketeria/estados";

export type Partida = { conta: ContaDoRazao; valor_centavos: number };

/** As partidas do pagamento de um pedido (as de valor zero ficam de fora). */
export function partidasDoPagamento(pedido: { total_centavos: number; produtor_centavos: number; taxa_centavos: number }): Partida[] {
  const partidas: Partida[] = [
    { conta: "psp_a_receber", valor_centavos: pedido.total_centavos },
    { conta: "produtor", valor_centavos: -pedido.produtor_centavos },
    { conta: "plataforma", valor_centavos: -pedido.taxa_centavos },
  ];
  return partidas.filter(partida => partida.valor_centavos !== 0);
}

/** A transação fecha: duas ou mais partidas, nenhuma zerada, somando zero. */
export function equilibrada(partidas: readonly Partida[]): boolean {
  return partidas.length >= 2 && partidas.every(partida => partida.valor_centavos !== 0) && partidas.reduce((soma, partida) => soma + partida.valor_centavos, 0) === 0;
}

/** O saldo de cada conta, somando as partidas. */
export function saldos(partidas: readonly Partida[]): Record<ContaDoRazao, number> {
  const saldo: Record<ContaDoRazao, number> = { psp_a_receber: 0, produtor: 0, plataforma: 0 };
  for (const partida of partidas) saldo[partida.conta] += partida.valor_centavos;
  return saldo;
}
