import type { PlanoAtivacaoResumo } from "@/lib/supabase/types";

export function activationProgress(plan: Pick<PlanoAtivacaoResumo,
  "tarefas_total" | "tarefas_concluidas" | "entregaveis_total" | "entregaveis_aprovados" | "acoes_total" | "acoes_concluidas"
>) {
  const groups = [
    [plan.tarefas_concluidas, plan.tarefas_total],
    [plan.entregaveis_aprovados, plan.entregaveis_total],
    [plan.acoes_concluidas, plan.acoes_total],
  ].filter(([, total]) => total > 0);
  if (!groups.length) return 0;
  return Math.round(groups.reduce((sum, [done, total]) => sum + done / total, 0) / groups.length * 100);
}

export function activationBudgetRatio(plan: Pick<PlanoAtivacaoResumo, "valor_direito_snapshot" | "orcamento_planejado">) {
  if (!plan.valor_direito_snapshot || plan.valor_direito_snapshot <= 0) return null;
  return plan.orcamento_planejado / plan.valor_direito_snapshot;
}

export function money(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}
