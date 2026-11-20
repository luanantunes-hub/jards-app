// O roteiro ao vivo (plano do módulo, PD7.1, primeiro corte): o estado de cada bloco do dia (pendente, em andamento, concluído), o
// atraso em relação à hora marcada e a hora prevista dos blocos que ainda não começaram, com o atraso propagado. Sem tela e sem banco.

import { ordenarBlocos } from "@/lib/producao/dia";
import type { ExibicaoDoBloco } from "@/lib/producao/estados";

export type BlocoAoVivo = {
  id: string; inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; ordem: number; iniciado_em: string | null; terminado_em: string | null;
};
export type EstadoDoBloco = "pendente" | "em_andamento" | "concluido";
export type SituacaoAoVivo = {
  estado: EstadoDoBloco;
  /** Minutos de atraso do começo (positivo) ou de adiantamento (negativo) de quem já começou; nulo se não dá para comparar. */
  atrasoDoComecoMin: number | null;
  /** O atraso que este bloco ainda não começado herda dos anteriores, em minutos (só positivo). */
  atrasoPropagadoMin: number;
  /** A hora prevista de começo (ISO) do bloco ainda não começado, já com o atraso; nulo se não há atraso ou o bloco não tem hora. */
  previstoPara: string | null;
};

const MINUTO = 60_000;
const minutosEntre = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / MINUTO);
const comHoraMarcada = (bloco: BlocoAoVivo) => Boolean(bloco.inicio) && bloco.exibicao !== "a_definir" && bloco.exibicao !== "oculta";

/**
 * Para cada bloco: o estado, o atraso do começo (de quem já começou) e, para quem ainda não começou, o atraso propagado e a hora
 * prevista. O atraso corrente vem do último acontecimento marcado (um começo ou um fim) comparado com a hora marcada daquele bloco;
 * só atraso propaga (adiantar não puxa os blocos seguintes). Bloco sem hora marcada, "a definir" ou oculto não recebe previsão.
 */
export function situacaoDoRoteiro(blocos: readonly BlocoAoVivo[]): Map<string, SituacaoAoVivo> {
  const resultado = new Map<string, SituacaoAoVivo>();
  const ordenados = ordenarBlocos(blocos);
  // O último acontecimento: o instante mais recente entre todos os começos e fins marcados.
  let ultimo: { instante: string; atrasoMin: number | null } | null = null;
  for (const bloco of ordenados) {
    if (bloco.iniciado_em && bloco.inicio && comHoraMarcada(bloco)) {
      const atraso = minutosEntre(bloco.iniciado_em, bloco.inicio);
      if (!ultimo || Date.parse(bloco.iniciado_em) >= Date.parse(ultimo.instante)) ultimo = { instante: bloco.iniciado_em, atrasoMin: atraso };
    }
    if (bloco.terminado_em && bloco.fim && comHoraMarcada(bloco)) {
      const atraso = minutosEntre(bloco.terminado_em, bloco.fim);
      if (!ultimo || Date.parse(bloco.terminado_em) >= Date.parse(ultimo.instante)) ultimo = { instante: bloco.terminado_em, atrasoMin: atraso };
    }
  }
  const atrasoCorrente = Math.max(0, ultimo?.atrasoMin ?? 0);
  for (const bloco of ordenados) {
    const estado: EstadoDoBloco = bloco.terminado_em ? "concluido" : bloco.iniciado_em ? "em_andamento" : "pendente";
    const atrasoDoComecoMin = bloco.iniciado_em && bloco.inicio && comHoraMarcada(bloco) ? minutosEntre(bloco.iniciado_em, bloco.inicio) : null;
    const propaga = estado === "pendente" && comHoraMarcada(bloco) && atrasoCorrente > 0;
    resultado.set(bloco.id, {
      estado, atrasoDoComecoMin,
      atrasoPropagadoMin: propaga ? atrasoCorrente : 0,
      previstoPara: propaga && bloco.inicio ? new Date(Date.parse(bloco.inicio) + atrasoCorrente * MINUTO).toISOString() : null,
    });
  }
  return resultado;
}

/** "no horário", "+5 min" (atrasado) ou "3 min adiantado". */
export function textoDoAtraso(minutos: number): string {
  if (minutos === 0) return "no horário";
  return minutos > 0 ? `+${minutos} min` : `${Math.abs(minutos)} min adiantado`;
}
