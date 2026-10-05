// Prazo da prestação final a partir do regime e dos marcos (P1.2).
//
// O banco calcula o mesmo prazo em prestacao_prazo_final
// (supabase/migrations/20261005160000_prestacao_regime.sql) e grava em
// prazo_final; aqui ele é refeito para a tela explicar de onde veio (regra,
// marco, dia em que caiu e por que foi prorrogado).

import { calcularVencimento, type Vencimento } from "./prazos";
import type { PrazoRegime, RegimeNormativo } from "./regimes";

export type MarcosPrestacao = {
  data_fim_execucao?: string | null;
  data_envio?: string | null;
};

/** Marcos do regime que a prestação guarda, e em qual coluna. */
export const COLUNA_DO_MARCO: Partial<Record<PrazoRegime["marco"], keyof MarcosPrestacao>> = {
  fim_vigencia: "data_fim_execucao",
  envio_prestacao: "data_envio",
};

export const ROTULO_DO_MARCO: Partial<Record<PrazoRegime["marco"], string>> = {
  fim_vigencia: "fim da execução",
  envio_prestacao: "envio da prestação",
};

export type PrazoFinal = Vencimento & { regra: PrazoRegime; marco: string };

/** null quando o regime não tem prazo final ou o marco ainda não foi informado. */
export function prazoFinalCalculado(regime: RegimeNormativo | null, marcos: MarcosPrestacao): PrazoFinal | null {
  const regra = regime?.prazos.prestacaoFinal;
  if (!regra) return null;
  const coluna = COLUNA_DO_MARCO[regra.marco];
  const marco = coluna ? marcos[coluna] ?? null : null;
  if (!marco) return null;
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
