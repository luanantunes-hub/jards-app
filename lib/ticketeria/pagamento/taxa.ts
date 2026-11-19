// A taxa do Jards por ingresso (T4; D2 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md) e os totais do pedido.
// A MESMA conta de fn_ticketeria_taxa_do_ingresso e fn_ticketeria_reservar (supabase/migrations/*_ticketeria_pagamentos.sql): o banco
// é quem grava o pedido; esta cópia serve à tela (mostrar o total antes de reservar) e os testes conferem os mesmos casos nos dois.
// O VALOR da taxa é decisão do dono (seção 7 do plano): sem regra gravada, é zero.

import type { QuemPagaATaxa } from "@/lib/ticketeria/estados";

/** A regra em vigor: porcentagem em pontos-base (1000 = 10%), valor fixo em centavos e quem paga. */
export type RegraDaTaxa = { percentual_bps: number; fixo_centavos: number; quem_paga: QuemPagaATaxa };

export const TAXA_ZERO: RegraDaTaxa = { percentual_bps: 0, fixo_centavos: 0, quem_paga: "comprador" };

/**
 * A taxa de UM ingresso: a porcentagem do preço, arredondada ao centavo (meio centavo sobe), mais o fixo. Ingresso de preço zero não
 * paga taxa. Quando o produtor paga, a taxa nunca passa do preço.
 */
export function taxaDoIngresso(precoCentavos: number, regra: RegraDaTaxa): number {
  if (precoCentavos <= 0) return 0;
  const taxa = Math.round((precoCentavos * regra.percentual_bps) / 10000) + regra.fixo_centavos;
  return regra.quem_paga === "produtor" ? Math.min(precoCentavos, taxa) : taxa;
}

export type ItemParaTotal = { preco_centavos: number; quantidade: number };
export type TotaisDoPedido = { total_centavos: number; taxa_centavos: number; produtor_centavos: number };

/** Os totais do pedido: o que o comprador paga = o que é do produtor + a taxa do Jards. */
export function totaisDoPedido(itens: readonly ItemParaTotal[], regra: RegraDaTaxa): TotaisDoPedido {
  let total = 0, taxa = 0, produtor = 0;
  for (const item of itens) {
    const unit = taxaDoIngresso(item.preco_centavos, regra);
    taxa += unit * item.quantidade;
    if (regra.quem_paga === "comprador") {
      total += (item.preco_centavos + unit) * item.quantidade;
      produtor += item.preco_centavos * item.quantidade;
    } else {
      total += item.preco_centavos * item.quantidade;
      produtor += (item.preco_centavos - unit) * item.quantidade;
    }
  }
  return { total_centavos: total, taxa_centavos: taxa, produtor_centavos: produtor };
}
