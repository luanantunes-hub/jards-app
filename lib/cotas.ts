import type { CotaPatrocinio } from "@/lib/supabase/types";

type CotaPreco = Pick<CotaPatrocinio, "valor" | "valor_maximo">;

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatCotaValor(cota: CotaPreco): string {
  return cota.valor_maximo == null
    ? formatMoney(cota.valor)
    : `${formatMoney(cota.valor)} a ${formatMoney(cota.valor_maximo)}`;
}

export function cotaTemDisponibilidade(cota: Pick<CotaPatrocinio, "unidades" | "unidades_vendidas" | "unidades_ilimitadas">): boolean {
  return cota.unidades_ilimitadas || (cota.unidades_vendidas ?? 0) < (cota.unidades ?? 1);
}

export function valorForaDaFaixa(cota: CotaPreco, valor: number | null): boolean {
  return valor != null && cota.valor_maximo != null && (valor < cota.valor || valor > cota.valor_maximo);
}
