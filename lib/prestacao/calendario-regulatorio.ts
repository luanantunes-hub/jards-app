// Linhas de calendario_regulatorio geradas no seed (P1.1).
//
// Os feriados nacionais vêm do mesmo cálculo da contagem de prazos
// (calendario.ts), com a fonte de cada um. O defeso eleitoral não muda prazo:
// muda o que a divulgação pode mostrar (manuais de marca), e as checagens de
// divulgação vão ler este período. Feriados estaduais e municipais entram
// depois, por regime ou pelo super admin.

import { feriadosNacionais } from "./calendario";

export type EntradaCalendario = {
  tipo: "feriado" | "ponto_facultativo" | "defeso_eleitoral";
  esfera: "federal" | "estadual" | "municipal";
  uf: string | null;
  municipio: string | null;
  inicio: string;
  fim: string;
  descricao: string;
  fonte: string;
};

/** Anos de feriados no seed; o seguinte entra com o próximo seed. */
export const ANOS_DO_CALENDARIO = [2026, 2027] as const;

const LEI_662 = "Lei 662/1949, com a redação da Lei 10.607/2002";

const FONTE_DO_FERIADO: Record<string, string> = {
  "Confraternização Universal": LEI_662,
  "Tiradentes": LEI_662,
  "Dia do Trabalho": LEI_662,
  "Independência do Brasil": LEI_662,
  "Finados": LEI_662,
  "Proclamação da República": LEI_662,
  "Natal": LEI_662,
  "Nossa Senhora Aparecida": "Lei 6.802/1980",
  "Dia Nacional de Zumbi e da Consciência Negra": "Lei 14.759/2023",
  "Sexta-feira da Paixão": "Calendário federal (portaria anual do MGI); Lei 9.093/1995, art. 2º",
};

const FONTE_PONTO_FACULTATIVO = "Ponto facultativo federal (portaria anual do MGI)";

export const DEFESO_ELEITORAL_2026: EntradaCalendario = {
  tipo: "defeso_eleitoral",
  esfera: "federal",
  uf: null,
  municipio: null,
  inicio: "2026-07-04",
  fim: "2026-10-04",
  descricao: "Defeso eleitoral das eleições gerais de 2026 (primeiro turno em 04/10/2026)",
  fonte: "Lei 9.504/1997, art. 73, VI, b: três meses antes do pleito. Onde houver segundo turno (25/10/2026), estender até ele",
};

export function entradasDoCalendario(): EntradaCalendario[] {
  const feriados = ANOS_DO_CALENDARIO.flatMap(ano => feriadosNacionais(ano)).map((dia): EntradaCalendario => ({
    tipo: dia.tipo,
    esfera: "federal",
    uf: null,
    municipio: null,
    inicio: dia.data,
    fim: dia.data,
    descricao: dia.nome,
    fonte: dia.tipo === "ponto_facultativo" ? FONTE_PONTO_FACULTATIVO : FONTE_DO_FERIADO[dia.nome] ?? "",
  }));
  return [...feriados, DEFESO_ELEITORAL_2026];
}
