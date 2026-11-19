// O custo do meio de pagamento, pago pelo COMPRADOR (decisão do dono, 19/11/2026), e a escolha de como pagar. A MESMA conta de
// fn_ticketeria_custo_do_meio (supabase/migrations/*_ticketeria_custo_do_meio.sql): o banco é quem grava o pedido; esta cópia serve à
// tela (mostrar o preço, a taxa do Jards e o custo SEPARADOS antes de pagar) e os testes conferem os mesmos casos nos dois.
//
// Os custos (do contrato com o provedor) moram na tabela `ticketeria_custos_meio`, não no código: mudam com contrato e promoção.
// No cartão o custo é percentual SOBRE O TOTAL PAGO, então o total sai "por dentro": total pago = (líquido + fixo) / (1 - percentual),
// arredondado para cima, para o líquido (o preço do produtor mais a taxa do Jards) nunca ficar abaixo do devido.

import type { MeioDePagamento } from "@/lib/ticketeria/estados";

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

/** O custo, em centavos, de cobrar `liquidoCentavos` pelo meio escolhido. */
export function custoDoMeio(liquidoCentavos: number, regra: RegraDeCusto): number {
  const totalPago = Math.ceil(((liquidoCentavos + regra.fixo_centavos) * 10000) / (10000 - regra.percentual_bps));
  return totalPago - liquidoCentavos;
}

export type ValoresParaPagar = { preco_centavos: number; taxa_jards_centavos: number; custo_meio_centavos: number; a_pagar_centavos: number };

/** O que a tela mostra antes de pagar: o que é do produtor, a taxa do Jards e o custo do meio, separados, e o total. */
export function valoresParaPagar(pedido: { produtor_centavos: number; taxa_centavos: number }, regra: RegraDeCusto): ValoresParaPagar {
  const liquido = pedido.produtor_centavos + pedido.taxa_centavos;
  const custo = custoDoMeio(liquido, regra);
  return { preco_centavos: pedido.produtor_centavos, taxa_jards_centavos: pedido.taxa_centavos, custo_meio_centavos: custo, a_pagar_centavos: liquido + custo };
}

/** As parcelas que o comprador pode escolher no cartão: de 1 até o máximo da loja (o produtor escolhe), só as que têm custo cadastrado. */
export function parcelasOferecidas(regras: readonly RegraDeCusto[], parcelasMaxDaLoja: number): number[] {
  const oferecidas: number[] = [];
  for (let n = 1; n <= Math.max(1, parcelasMaxDaLoja); n++) if (regraDoMeio(regras, "cartao", n)) oferecidas.push(n);
  return oferecidas;
}

/** O valor de cada parcela (a última leva o resto dos centavos). */
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
