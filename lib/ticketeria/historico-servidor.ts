import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { semanasDeHistorico, type ImportacaoDaLista, type TipoDeHistorico } from "@/lib/ticketeria/historico";

type Admin = SupabaseClient<Database>;

export type HistoricoDaLoja = { importacoes: ImportacaoDaLista[]; semanas: Record<TipoDeHistorico, number> };

/** As importações da loja (a mais recente primeiro) e quantas semanas de história o conjunto de cada tipo cobre (do primeiro ao último dia). */
export async function historicoDaLoja(admin: Admin, lojaId: string): Promise<HistoricoDaLoja> {
  const { data, error } = await clienteDaTicketeria(admin).from("ticketeria_importacoes")
    .select("id, tipo, arquivo, periodo_inicio, periodo_fim, linhas, total_ingressos, total_valor_centavos, created_at").eq("loja_id", lojaId).order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const importacoes: ImportacaoDaLista[] = (data ?? []).map(i => ({ ...i, tipo: i.tipo as TipoDeHistorico, total_ingressos: Number(i.total_ingressos), total_valor_centavos: Number(i.total_valor_centavos) }));
  const semanas = { vendas: 0, gasto: 0 };
  for (const tipo of ["vendas", "gasto"] as const) {
    const deste = importacoes.filter(i => i.tipo === tipo);
    semanas[tipo] = semanasDeHistorico(deste.map(i => i.periodo_inicio).sort()[0] ?? null, deste.map(i => i.periodo_fim).sort().at(-1) ?? null);
  }
  return { importacoes, semanas };
}
