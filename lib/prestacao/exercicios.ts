// Prestação anual por exercício (P9.2).
//
// Na saúde (Anexo LXXXVI-A da PRC GM/MS 5/2017, art. 81), cada exercício com
// execução tem a sua prestação anual, até 30/04 do ano seguinte, e a final vem
// no ano seguinte ao último exercício, no mesmo prazo: o último exercício vai
// na final, sem anual própria. A de 2025 foi prorrogada para 31/05/2026
// (Portaria SE/MS 928/2026, art. 4º; regra excecao_2025 do regime). O regime
// diz que a parcial é periódica (prestacaoParcial.modalidades) e o prazo dela
// (prazos.prestacaoAnual). Sem React e sem Supabase.

import { calcularVencimento } from "./prazos";
import { definida, prazoDoRegime, regraDoRegime, type RegimeNormativo } from "./regimes";

/** O exercício dos envios, marcações e arquivos sem prestação anual. */
export const SEM_EXERCICIO = 0;

/** O regime tem prestação anual: parcial periódica com o prazo do exercício. */
export function regimeTemPrestacaoAnual(regime: RegimeNormativo | null | undefined): boolean {
  const parcial = regime ? definida(regime.prestacaoParcial) : null;
  return Boolean(parcial?.modalidades.includes("periodica") && prazoDoRegime(regime, "prestacaoAnual"));
}

export type ExercicioDaPrestacao = {
  ano: number;
  /** Até quando enviar a prestação do exercício (a anual; no último, a final). */
  prazo: string;
  /** O último exercício com execução vai na prestação final. */
  naFinal: boolean;
};

type Datas = { data_inicio_execucao?: string | null; data_termo?: string | null; data_fim_execucao?: string | null };

const anoDe = (iso: string | null | undefined) => (iso && /^\d{4}-/.test(iso) ? Number(iso.slice(0, 4)) : null);

/** O prazo da prestação anual de um exercício, com a prorrogação de 2025 quando o regime traz a regra. */
export function prazoDaAnual(regime: RegimeNormativo | null | undefined, ano: number): string | null {
  const prazo = prazoDoRegime(regime, "prestacaoAnual");
  if (!prazo) return null;
  if (ano === 2025 && regraDoRegime(regime, "excecao_2025")) return "2026-05-31";
  return calcularVencimento(`${ano}-12-31`, prazo).data;
}

/**
 * Os exercícios com execução, do início (ou do Termo) ao fim da execução. Sem
 * o fim, vão até o ano corrente, e nenhum é marcado como o da final.
 */
export function exerciciosDaPrestacao(regime: RegimeNormativo | null | undefined, datas: Datas, hoje: string = new Date().toISOString().slice(0, 10)): ExercicioDaPrestacao[] {
  if (!regimeTemPrestacaoAnual(regime)) return [];
  const inicio = anoDe(datas.data_inicio_execucao) ?? anoDe(datas.data_termo);
  const fim = anoDe(datas.data_fim_execucao);
  if (!inicio) return [];
  const ultimo = fim ?? Math.max(inicio, anoDe(hoje) ?? inicio);
  const anos: ExercicioDaPrestacao[] = [];
  for (let ano = inicio; ano <= ultimo && anos.length < 20; ano++) {
    const prazo = prazoDaAnual(regime, ano);
    if (prazo) anos.push({ ano, prazo, naFinal: fim !== null && ano === fim });
  }
  return anos;
}

/** Só os exercícios que têm prestação anual própria (o último vai na final). */
export const exerciciosDaAnual = (regime: RegimeNormativo | null | undefined, datas: Datas, hoje?: string) =>
  exerciciosDaPrestacao(regime, datas, hoje).filter(e => !e.naFinal);

/**
 * O exercício para abrir na tela: o primeiro sem prestação anual valendo;
 * com todas enviadas, o último. SEM_EXERCICIO quando não há prestação anual.
 */
export function exercicioInicial(exercicios: readonly ExercicioDaPrestacao[], enviados: readonly number[]): number {
  const anuais = exercicios.filter(e => !e.naFinal);
  return (anuais.find(e => !enviados.includes(e.ano)) ?? anuais.at(-1))?.ano ?? SEM_EXERCICIO;
}

/** As prestações anuais ainda sem envio valendo, com o prazo, para "Próximos prazos". */
export function anuaisPendentes(exercicios: readonly ExercicioDaPrestacao[], enviados: readonly number[]): { ano: number; data: string }[] {
  return exercicios.filter(e => !e.naFinal && !enviados.includes(e.ano)).map(e => ({ ano: e.ano, data: e.prazo }));
}

/** "Prestação anual de 2026", "Prestação final" ou "Prestação parcial". */
export function rotuloDaEtapa(etapa: "final" | "parcial", regime?: RegimeNormativo | null, exercicio?: number | null): string {
  if (etapa === "final") return "Prestação final";
  if (exercicio) return `Prestação anual de ${exercicio}`;
  return regimeTemPrestacaoAnual(regime) ? "Prestação anual" : "Prestação parcial";
}
