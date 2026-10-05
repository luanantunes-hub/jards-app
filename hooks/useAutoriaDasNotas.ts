"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Quem está logado e o nome de quem escreveu as notas da equipe. Os perfis de
 * quem é da mesma organização são legíveis pelo RLS de profiles.
 */
export function useAutoriaDasNotas(notas: { account_id?: string | null }[]) {
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const chave = [...new Set(notas.map(nota => nota.account_id).filter(Boolean))].sort().join(",");

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const outros = chave ? chave.split(",").filter(id => id !== user?.id) : [];
      let mapa: Record<string, string> = {};
      if (outros.length > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name").in("id", outros);
        mapa = Object.fromEntries(
          ((data ?? []) as { id: string; full_name: string | null }[])
            .filter(perfil => perfil.full_name?.trim())
            .map(perfil => [perfil.id, (perfil.full_name as string).trim()]),
        );
      }
      if (!ativo) return;
      setUsuarioId(user?.id ?? null);
      setNomes(mapa);
    })();
    return () => { ativo = false; };
  }, [chave]);

  return { usuarioId, nomes };
}
