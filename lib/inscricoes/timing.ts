import type { StatusEdital } from "@/lib/supabase/types";

export type InscricaoTiming = {
  label: string;
  color: string;
  detail: string;
};

type TimingInput = {
  status: StatusEdital;
  dataFechamento: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

const DAY_MS = 86_400_000;
const OUTCOME_STATUSES = new Set<StatusEdital>(["aprovado", "reprovado", "cancelado"]);

function dateKey(value: string | Date): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function dayNumber(value: string | Date): number | null {
  const key = dateKey(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function formatDate(value: string | null): string | null {
  const key = value ? dateKey(value) : null;
  if (!key) return null;
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

export function getInscricaoTiming(input: TimingInput, today = new Date()): InscricaoTiming {
  const todayDay = dayNumber(today);

  if (OUTCOME_STATUSES.has(input.status)) {
    const concludedAt = formatDate(input.updatedAt ?? input.createdAt);
    return {
      label: concludedAt ? `Concluído em ${concludedAt}` : "Concluído",
      color: "#6B7280",
      detail: "Esta inscrição já possui um desfecho.",
    };
  }

  const closingDay = input.dataFechamento ? dayNumber(input.dataFechamento) : null;
  if (closingDay !== null && todayDay !== null) {
    const daysAfterClosing = todayDay - closingDay;

    if (input.status === "em_analise") {
      if (daysAfterClosing < 0) return { label: "Aguardando fechamento", color: "#2D72B0", detail: "O prazo ainda não encerrou." };
      if (daysAfterClosing <= 15) return { label: "Aguardando resultado", color: "#B07A14", detail: `${daysAfterClosing} ${daysAfterClosing === 1 ? "dia" : "dias"} após o fechamento.` };
      return { label: "Resultado atrasado", color: "#D94E4E", detail: `${daysAfterClosing} dias após o fechamento.` };
    }

    if (daysAfterClosing < 0) return { label: "No prazo", color: "#2E8932", detail: `${Math.abs(daysAfterClosing)} ${Math.abs(daysAfterClosing) === 1 ? "dia restante" : "dias restantes"}.` };
    if (daysAfterClosing <= 15) return { label: "Prazo perdido", color: "#D94E4E", detail: `${daysAfterClosing} ${daysAfterClosing === 1 ? "dia" : "dias"} após o fechamento.` };
    return { label: "Prazo perdido há muito tempo", color: "#991B1B", detail: `${daysAfterClosing} dias após o fechamento.` };
  }

  const fallbackDate = input.updatedAt ?? input.createdAt;
  const fallbackDay = fallbackDate ? dayNumber(fallbackDate) : null;
  if (fallbackDay === null || todayDay === null) {
    return { label: "Sem dados", color: "#6B7280", detail: "Não há data suficiente para calcular o acompanhamento." };
  }

  const idleDays = Math.max(0, todayDay - fallbackDay);
  if (idleDays <= 7) return { label: "Recente", color: "#2E8932", detail: `${idleDays} ${idleDays === 1 ? "dia" : "dias"} desde a última atualização.` };
  if (idleDays <= 20) return { label: "Esfriando", color: "#B07A14", detail: `${idleDays} dias desde a última atualização.` };
  return { label: "Sem retorno", color: "#6B7280", detail: `${idleDays} dias desde a última atualização. Fechamento não informado.` };
}
