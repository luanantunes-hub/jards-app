"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { regimeSchema } from "@/lib/prestacao/regimes/schema";

export type RegimePublicado = { id: string; regime: RegimeNormativo };

/**
 * Regimes publicados em prestacao_regimes (P1.1), validados pelo schema.
 * Linha que não passa no schema fica de fora em vez de quebrar a tela.
 */
export function useRegimesPublicados(): RegimePublicado[] {
  const supabase = useMemo(() => createClient(), []);
  const [regimes, setRegimes] = useState<RegimePublicado[]>([]);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
    (supabase as any)
      .from("prestacao_regimes")
      .select("id, parametros")
      .eq("status", "publicado")
      .order("nome")
      .then(({ data }: { data: { id: string; parametros: unknown }[] | null }) => {
        if (!ativo) return;
        setRegimes((data ?? []).flatMap(linha => {
          const lido = regimeSchema.safeParse(linha.parametros);
          return lido.success ? [{ id: linha.id, regime: lido.data }] : [];
        }));
      });
    return () => { ativo = false; };
  }, [supabase]);

  return regimes;
}
