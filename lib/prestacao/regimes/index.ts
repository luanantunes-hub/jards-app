// Catálogo de regimes disponível no código. Na P1.1 completa, vira a fonte
// do seed de prestacao_regimes.

import { ROUANET_IN29_2026 } from "./rouanet-in29-2026";
import type { RegimeNormativo } from "./tipos";

export type { Fonte, LimitePercentual, PrazoRegime, RegimeNormativo } from "./tipos";

/** Patrocínio direto e leis ainda não modeladas: sem checagens normativas. */
export const GENERICO = {
  codigo: "generico",
  nome: "Genérico (sem regras de lei)",
  area: "outro",
  mecanismo: "outros",
  esfera: "federal",
  orgao: "—",
  sistemaOficial: null,
  normaReferencia: "Sem norma específica; vale o contrato de patrocínio",
  vigenteDesde: null,
  identificadorOficial: null,
  prazos: {},
  limites: {},
  pagamentos: { meiosPermitidos: null, fonte: null },
  contas: null,
  guarda: null,
  porte: null,
  fontes: [],
} satisfies RegimeNormativo;

export const REGIMES: readonly RegimeNormativo[] = [ROUANET_IN29_2026, GENERICO];

export function regimePorCodigo(codigo: string): RegimeNormativo | null {
  return REGIMES.find(regime => regime.codigo === codigo) ?? null;
}

/**
 * Regime sugerido na criação a partir da lei da captação (captacoes.lei).
 * Leis sem regime modelado caem no genérico.
 */
export function regimeSugeridoParaLei(lei: string | null | undefined): RegimeNormativo {
  return REGIMES.find(regime => regime.codigo !== "generico" && regime.mecanismo === lei) ?? GENERICO;
}

/** Porte pela base do regime (ex.: Rouanet mede pelo captado). */
export function porteDoProjeto(regime: RegimeNormativo, valorBase: number): string | null {
  if (!regime.porte) return null;
  return regime.porte.faixas.find(faixa => faixa.ate === null || valorBase <= faixa.ate)?.nome ?? null;
}
