// Prazo da prestação final a partir do regime e dos marcos (P1.2).
//
// O banco calcula o mesmo prazo em prestacao_prazo_final
// (supabase/migrations/20261005160000_prestacao_regime.sql) e grava em
// prazo_final; aqui ele é refeito para a tela explicar de onde veio (regra,
// marco, dia em que caiu e por que foi prorrogado).

import { calcularVencimento, type Vencimento } from "./prazos";
import { definida, prazoDoRegime, type PrazoRegime, type RegimeNormativo } from "./regimes";

export type MarcosPrestacao = {
  data_fim_execucao?: string | null;
  data_conclusao_objeto?: string | null;
  data_envio?: string | null;
};

/** Marcos do regime que a prestação guarda, e em qual coluna. */
export const COLUNA_DO_MARCO: Partial<Record<PrazoRegime["marco"], keyof MarcosPrestacao>> = {
  fim_vigencia: "data_fim_execucao",
  // O exercício é o ano em que a execução terminou; o marco é 31/12 dele.
  fim_exercicio: "data_fim_execucao",
  conclusao_objeto: "data_conclusao_objeto",
  envio_prestacao: "data_envio",
};

export const ROTULO_DO_MARCO: Partial<Record<PrazoRegime["marco"], string>> = {
  fim_vigencia: "fim da execução",
  fim_exercicio: "fim do exercício em que a execução terminou",
  conclusao_objeto: "conclusão do objeto",
  envio_prestacao: "envio da prestação",
  assinatura_termo: "assinatura do termo",
  liberacao_recursos: "liberação dos recursos",
  fim_captacao: "fim da captação",
};

/** Data em que o prazo começa a correr, a partir da coluna do marco. */
function dataDoMarco(marco: PrazoRegime["marco"], valor: string): string {
  return marco === "fim_exercicio" ? `${valor.slice(0, 4)}-12-31` : valor;
}

export type PrazoFinal = Vencimento & { regra: PrazoRegime; marco: string };

/** null quando o regime não tem prazo final ou o marco ainda não foi informado. */
export function prazoFinalCalculado(regime: RegimeNormativo | null, marcos: MarcosPrestacao): PrazoFinal | null {
  const regra = prazoDoRegime(regime, "prestacaoFinal");
  if (!regra) return null;
  const coluna = COLUNA_DO_MARCO[regra.marco];
  const valor = coluna ? marcos[coluna] ?? null : null;
  if (!valor) return null;
  const marco = dataDoMarco(regra.marco, valor);
  return { ...calcularVencimento(marco, regra), regra, marco };
}

/** Prazo que vale: o informado à mão, senão o calculado (a coluna "prazo" no banco). */
export function prazoVigente(prestacao: { prazo_final_override?: string | null; prazo_final?: string | null; prazo: string | null }): string | null {
  return prestacao.prazo_final_override ?? prestacao.prazo_final ?? prestacao.prazo;
}

/** Texto curto da regra: "60 dias corridos após o fim da execução". */
export function descreverRegra(regra: PrazoRegime): string {
  const unidade = {
    dias_corridos: regra.quantidade === 1 ? "dia corrido" : "dias corridos",
    dias_uteis: regra.quantidade === 1 ? "dia útil" : "dias úteis",
    meses: regra.quantidade === 1 ? "mês" : "meses",
    anos: regra.quantidade === 1 ? "ano" : "anos",
  }[regra.unidade];
  return `${regra.quantidade} ${unidade} após o ${ROTULO_DO_MARCO[regra.marco] ?? regra.marco}`;
}

// ─── Saldo no encerramento (P9.4) ───────────────────────────────────────────

/** Nome curto do prazo do saldo, pela chave do regime. */
const ROTULO_DO_PRAZO_DO_SALDO: Record<string, string> = {
  devolucaoSaldo: "Devolução do saldo (GRU)",
  transferenciaSaldo: "Transferência do saldo",
};

export type PrazoDoSaldo = PrazoFinal & { chave: string; rotulo: string };

/**
 * O prazo do saldo no encerramento (contas.saldo.prazo do regime), contado do
 * marco: na saúde, saldo e rendimentos da Conta Movimento por GRU em 30 dias
 * do término (Anexo LXXXVI-A, art. 71); na LIE, o pedido de transferência
 * para outro projeto. null quando o regime não tem esse prazo ou falta o marco.
 */
export function prazoDoSaldo(regime: RegimeNormativo | null, marcos: MarcosPrestacao): PrazoDoSaldo | null {
  const chave = regime ? definida(regime.contas)?.saldo?.prazo ?? null : null;
  const regra = chave ? prazoDoRegime(regime, chave) : null;
  if (!chave || !regra) return null;
  const coluna = COLUNA_DO_MARCO[regra.marco];
  const valor = coluna ? marcos[coluna] ?? null : null;
  if (!valor) return null;
  const marco = dataDoMarco(regra.marco, valor);
  return { ...calcularVencimento(marco, regra), regra, marco, chave, rotulo: ROTULO_DO_PRAZO_DO_SALDO[chave] ?? "Destino do saldo" };
}
