// O livro-razão de partidas dobradas da Ticketeria (T4; o desenho do pgledger): cada transação tem duas ou mais partidas com sinal
// que somam zero. O banco grava e confere (fn_ticketeria_confirmar_pagamento e o gatilho ticketeria_partidas_equilibrio); esta cópia
// diz, na tela e nos testes, o que cada operação deve gravar.
//
// Contas: psp_a_receber (o que o provedor recebeu do comprador: positivo), produtor (o que é do produtor e o split repassa:
// negativo) e plataforma (a taxa do Jards: negativo). O Jards não guarda saldo de terceiros (D3): o razão registra de quem é cada
// centavo que passou pelo provedor.

import type { ContaDoRazao } from "@/lib/ticketeria/estados";

export type Partida = { conta: ContaDoRazao; valor_centavos: number };

/**
 * As partidas do pagamento de um pedido (as de valor zero ficam de fora). O provedor guarda o custo do meio dele: chega líquido
 * `total − custo`, e o custo sai da parte do produtor.
 */
export function partidasDoPagamento(pedido: { total_centavos: number; produtor_centavos: number; taxa_centavos: number; custo_meio_centavos?: number }): Partida[] {
  const custo = pedido.custo_meio_centavos ?? 0;
  const partidas: Partida[] = [
    { conta: "psp_a_receber", valor_centavos: pedido.total_centavos - custo },
    { conta: "produtor", valor_centavos: -(pedido.produtor_centavos - custo) },
    { conta: "plataforma", valor_centavos: -pedido.taxa_centavos },
  ];
  return partidas.filter(partida => partida.valor_centavos !== 0);
}

/**
 * As partidas da devolução TOTAL de um pedido pago (D5; T7), o inverso do pagamento: o comprador recebe o preço inteiro e a parte do
 * produtor volta. Em arrependimento (até 7 dias) o Jards devolve a comissão dele (a taxa). O que o Asaas **não devolve** do custo do
 * meio (a "taxa residual": no Pix, sempre; no cartão com estorno total, o Asaas devolve a taxa de transação) **fica com o produtor, em
 * qualquer caso**, saindo do saldo dele: o Jards não cobre nada disso (decisão do dono, 19/11/2026, após ler a documentação do Asaas,
 * ainda a confirmar no sandbox e com o comercial). Por isso a conta depende de um dado por meio de pagamento: "o Asaas devolveu o
 * custo? sim/não". Estorno parcial e taxa de antecipação do cartão não passam por aqui: quem arca com eles é pergunta aberta no plano.
 *
 * Fecha em zero: psp = −(total − custo + custo não devolvido); produtor = +(parte do produtor − custo + custo não devolvido);
 * plataforma = +taxa. Depois do pagamento e da devolução, o produtor deve exatamente o custo não devolvido; o Jards fica em zero.
 */
export function partidasDaDevolucao(
  pedido: { total_centavos: number; produtor_centavos: number; taxa_centavos: number; custo_meio_centavos?: number },
  asaasDevolveuOCusto: boolean,
): Partida[] {
  const custo = pedido.custo_meio_centavos ?? 0;
  const naoDevolvido = asaasDevolveuOCusto ? 0 : custo;
  const partidas: Partida[] = [
    { conta: "psp_a_receber", valor_centavos: -(pedido.total_centavos - custo + naoDevolvido) },
    { conta: "produtor", valor_centavos: pedido.produtor_centavos - custo + naoDevolvido },
    { conta: "plataforma", valor_centavos: pedido.taxa_centavos },
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
