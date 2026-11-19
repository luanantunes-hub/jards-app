// O custo do meio de pagamento, pago pelo PRODUTOR (decisão do dono, 19/11/2026): o comprador paga exatamente o preço do ingresso, e do
// preço saem a taxa do Jards (2,5%) e o custo do meio; o produtor recebe o que sobra. A MESMA conta de fn_ticketeria_custo_do_meio
// (supabase/migrations/*_ticketeria_produtor_paga_as_taxas.sql): o banco é quem grava o pedido; esta cópia serve às telas (a do
// produtor mostra quanto ele recebe líquido, por ingresso e por meio de pagamento, para ele decidir o preço) e os testes conferem os
// mesmos casos nos dois.
//
// Os custos (do contrato com o provedor) moram na tabela `ticketeria_custos_meio`, não no código: mudam com contrato e promoção. No
// cartão o custo é percentual SOBRE O TOTAL PAGO (que agora é o preço), arredondado para cima, mais o fixo.

import type { MeioDePagamento } from "@/lib/ticketeria/estados";
import { taxaDoIngresso, totaisDoPedido, type RegraDaTaxa } from "@/lib/ticketeria/pagamento/taxa";

/** Uma faixa de custo: o meio, de quantas a quantas parcelas, a porcentagem em pontos-base (299 = 2,99%) e o fixo em centavos. */
export type RegraDeCusto = { meio: MeioDePagamento; parcelas_de: number; parcelas_ate: number; percentual_bps: number; fixo_centavos: number };

/** As regras que o dono passou em 19/11/2026 (Asaas), só para a tela mostrar um exemplo antes de ler a tabela de verdade. */
export const CUSTOS_PROVISORIOS_DO_ASAAS: readonly RegraDeCusto[] = [
  { meio: "pix", parcelas_de: 1, parcelas_ate: 1, percentual_bps: 0, fixo_centavos: 199 },
  { meio: "cartao", parcelas_de: 1, parcelas_ate: 1, percentual_bps: 299, fixo_centavos: 49 },
  { meio: "cartao", parcelas_de: 2, parcelas_ate: 6, percentual_bps: 349, fixo_centavos: 49 },
];

/** A regra do meio e das parcelas; null se não há custo cadastrado (o meio ou a parcela está indisponível). */
export function regraDoMeio(regras: readonly RegraDeCusto[], meio: MeioDePagamento, parcelas: number | null): RegraDeCusto | null {
  const n = parcelas ?? 1;
  return regras.find(regra => regra.meio === meio && n >= regra.parcelas_de && n <= regra.parcelas_ate) ?? null;
}

/** O custo, em centavos, de cobrar `totalPagoCentavos` pelo meio escolhido: o percentual sobre o total (para cima) mais o fixo. */
export function custoDoMeio(totalPagoCentavos: number, regra: RegraDeCusto): number {
  return Math.floor((totalPagoCentavos * regra.percentual_bps + 9999) / 10000) + regra.fixo_centavos;
}

export type ValoresDoPedido = { a_pagar_centavos: number; taxa_jards_centavos: number; custo_meio_centavos: number; produtor_recebe_centavos: number };

/**
 * Os valores de um pedido no meio escolhido: o comprador paga o total do pedido (o preço, nada somado); do preço saem a taxa do Jards
 * e o custo do meio, e o produtor recebe o resto. `null` quando o custo come toda a parte do produtor (ingresso baratíssimo): o meio
 * não serve para este pedido (o banco recusa do mesmo jeito: `meio_indisponivel`).
 */
export function valoresDoPedido(pedido: { total_centavos: number; produtor_centavos: number; taxa_centavos: number }, regra: RegraDeCusto): ValoresDoPedido | null {
  const custo = custoDoMeio(pedido.total_centavos, regra);
  if (custo > pedido.produtor_centavos) return null;
  return { a_pagar_centavos: pedido.total_centavos, taxa_jards_centavos: pedido.taxa_centavos, custo_meio_centavos: custo, produtor_recebe_centavos: pedido.produtor_centavos - custo };
}

export type LiquidoPorMeio = { meio: MeioDePagamento; parcelas: number | null; custo_meio_centavos: number; produtor_recebe_centavos: number };

/**
 * A tela do produtor: quanto ele recebe líquido por UM ingresso de `precoCentavos`, no Pix e no cartão (à vista e em cada parcelamento
 * que a loja oferece), para ele saber o preço que quer cobrar. Ingresso de preço zero (cortesia, gratuito) não cobra nada.
 */
export function liquidoDoProdutorPorMeio(precoCentavos: number, regraDaTaxa: RegraDaTaxa, regrasDeCusto: readonly RegraDeCusto[], parcelasMaxDaLoja: number): { taxa_jards_centavos: number; meios: LiquidoPorMeio[] } {
  const taxa = taxaDoIngresso(precoCentavos, regraDaTaxa);
  if (precoCentavos <= 0) return { taxa_jards_centavos: 0, meios: [] };
  const totais = totaisDoPedido([{ preco_centavos: precoCentavos, quantidade: 1 }], regraDaTaxa);
  const meios: LiquidoPorMeio[] = [];
  const candidatos: { meio: MeioDePagamento; parcelas: number | null }[] = [
    { meio: "pix", parcelas: null },
    ...parcelasOferecidas(regrasDeCusto, parcelasMaxDaLoja).map(n => ({ meio: "cartao" as const, parcelas: n })),
  ];
  for (const { meio, parcelas } of candidatos) {
    const regra = regraDoMeio(regrasDeCusto, meio, parcelas);
    const valores = regra ? valoresDoPedido(totais, regra) : null;
    if (valores) meios.push({ meio, parcelas, custo_meio_centavos: valores.custo_meio_centavos, produtor_recebe_centavos: valores.produtor_recebe_centavos });
  }
  return { taxa_jards_centavos: taxa, meios };
}

/** As parcelas que o comprador pode escolher no cartão: de 1 até o máximo da loja (o produtor escolhe), só as que têm custo cadastrado. */
export function parcelasOferecidas(regras: readonly RegraDeCusto[], parcelasMaxDaLoja: number): number[] {
  const oferecidas: number[] = [];
  for (let n = 1; n <= Math.max(1, parcelasMaxDaLoja); n++) if (regraDoMeio(regras, "cartao", n)) oferecidas.push(n);
  return oferecidas;
}

/** O valor de cada parcela do que o comprador paga (a última leva o resto dos centavos). */
export function valorDasParcelas(aPagarCentavos: number, parcelas: number): { valor_centavos: number; ultima_centavos: number } {
  const valor = Math.floor(aPagarCentavos / parcelas);
  return { valor_centavos: valor, ultima_centavos: aPagarCentavos - valor * (parcelas - 1) };
}

/** O erro do banco ao escolher o meio, numa frase para o comprador. */
export function mensagemDoErroDoMeio(erro: { message?: string }): string {
  const m = erro.message ?? "";
  if (m.includes("parcelas_indisponiveis")) return "Essa quantidade de parcelas não está disponível neste evento.";
  if (m.includes("meio_indisponivel")) return "Essa forma de pagamento não está disponível.";
  if (m.includes("reserva_expirada")) return "O tempo da sua reserva acabou. Escolha os ingressos de novo.";
  if (m.includes("pedido_nao_aguarda")) return "Este pedido já foi pago ou cancelado.";
  return "Não foi possível escolher a forma de pagamento. Tente de novo.";
}
