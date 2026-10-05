"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * O valor da negociação/inscrição está vindo da proposta ativa? Nesse caso o
 * banco ignora escritas diretas no campo (migration valor_pela_proposta), e a
 * interface mostra o valor como "vem da proposta".
 */
export function useValorDefinidoPorProposta(tabela: "captacoes" | "editais_user", id: string | null | undefined): boolean {
  const [definido, setDefinido] = useState(false);
  useEffect(() => {
    if (!id) return;
    let ativo = true;
    // A tipagem manual do Supabase ainda não tem a coluna nova.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient() as any).from(tabela).select("valor_definido_por_proposta").eq("id", id).maybeSingle()
      .then(({ data }: { data: { valor_definido_por_proposta?: boolean } | null }) => {
        if (ativo) setDefinido(Boolean(data?.valor_definido_por_proposta));
      });
    return () => { ativo = false; };
  }, [tabela, id]);
  return definido;
}
