// Prestações da mesma obra (P7.4).
//
// Na ANCINE, os processos da mesma obra e do mesmo objeto seguem o prazo que
// vencer por último (Manual de Prestação de Contas v2.11, p. 9–10), e a
// concentração por fornecedor soma as despesas de todos (IN 159, art. 28, VI;
// a soma fica em checagens/checar-financeiro.ts). Sem React e sem Supabase.

/** prazo é o vigente (o informado à mão, senão o calculado pelo regime); prazo_final, só o calculado. */
export type PrestacaoDaObra = { id: string; titulo: string; prazo?: string | null; prazo_final?: string | null };

/** O prazo que vence por último entre as prestações da obra, e de qual delas. */
export function prazoDaObra<T extends PrestacaoDaObra>(prestacoes: readonly T[]): { prazo: string; prestacao: T } | null {
  let ultimo: { prazo: string; prestacao: T } | null = null;
  for (const p of prestacoes) {
    const prazo = (p.prazo ?? p.prazo_final)?.slice(0, 10);
    if (prazo && (!ultimo || prazo > ultimo.prazo)) ultimo = { prazo, prestacao: p };
  }
  return ultimo;
}
