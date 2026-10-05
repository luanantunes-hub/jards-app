"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { regimeSchema } from "@/lib/prestacao/regimes/schema";

export type RegimePublicado = {
  id: string;
  regime: RegimeNormativo;
  /** false: versão obsoleta, ainda usada por alguma prestação de quem está logado. */
  publicado: boolean;
};

/**
 * Regimes de prestacao_regimes (P1.1): os publicados e, desde a P1.11, as
 * versões obsoletas que as prestações de quem está logado ainda usam (a RLS
 * só mostra essas). Escolher regime novo usa só os publicados. Linha que não
 * passa no schema fica de fora em vez de quebrar a tela.
 */
export function useRegimesPublicados(): RegimePublicado[] {
  const supabase = useMemo(() => createClient(), []);
  const [regimes, setRegimes] = useState<RegimePublicado[]>([]);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
    (supabase as any)
      .from("prestacao_regimes")
      .select("id, status, parametros")
      .in("status", ["publicado", "obsoleto"])
      .order("nome")
      .then(({ data }: { data: { id: string; status: string; parametros: unknown }[] | null }) => {
        if (!ativo) return;
        setRegimes((data ?? []).flatMap(linha => {
          const lido = regimeSchema.safeParse(linha.parametros);
          return lido.success ? [{ id: linha.id, regime: lido.data, publicado: linha.status === "publicado" }] : [];
        }));
      });
    return () => { ativo = false; };
  }, [supabase]);

  return regimes;
}
