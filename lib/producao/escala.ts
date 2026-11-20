// A escala da data (plano do módulo, PD1.10): a resposta da pessoa e a hora da chamada e da
// saída. Sem tela e sem banco.
//
// Como no dia em blocos, o banco guarda instantes (timestamptz) e a pessoa digita a hora do lugar
// da data (o fuso da data). A saída antes da chamada passa da meia-noite: cai no dia seguinte.

import { horaLocalParaInstante, instanteParaHoraLocal } from "@/lib/producao/dia";
import type { ConfirmacaoDaEscala } from "@/lib/producao/estados";

export const ROTULO_DA_CONFIRMACAO: Record<ConfirmacaoDaEscala, string> = {
  pendente: "Sem resposta",
  confirmada: "Confirmou",
  recusada: "Recusou",
};

/** "2026-12-31" → "2027-01-01". */
function diaSeguinte(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * A chamada e a saída digitadas ("14:00", "02:30") → os instantes que o banco guarda. Sem chamada
 * não há horário; a saída sozinha não vale (o banco a recusa sem chamada). A saída igual ou antes
 * da chamada é do dia seguinte.
 */
export function horarioDaEscala(dia: string, chamada: string, saida: string, fuso: string): { chamada: string | null; saida: string | null } {
  if (!chamada) return { chamada: null, saida: null };
  const inicio = horaLocalParaInstante(dia, chamada, fuso);
  if (!saida) return { chamada: inicio, saida: null };
  const noMesmoDia = horaLocalParaInstante(dia, saida, fuso);
  return { chamada: inicio, saida: Date.parse(noMesmoDia) > Date.parse(inicio) ? noMesmoDia : horaLocalParaInstante(diaSeguinte(dia), saida, fuso) };
}

/** "chamada 14:00 · saída 23:30", "chamada 22:00 · saída 02:00 (+1)", "chamada 14:00", ou "" sem horário. */
export function rotuloDoHorario(escala: { chamada: string | null; saida: string | null }, fuso: string): string {
  if (!escala.chamada) return "";
  const chamada = instanteParaHoraLocal(escala.chamada, fuso);
  if (!escala.saida) return `chamada ${chamada.hora}`;
  const saida = instanteParaHoraLocal(escala.saida, fuso);
  return `chamada ${chamada.hora} · saída ${saida.hora}${saida.dia > chamada.dia ? " (+1)" : ""}`;
}
