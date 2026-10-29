"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { casaResponsavel, membrosDaEquipe, type FiltroResponsavel, type MembroDaEquipe } from "@/lib/equipe/responsavel";

/**
 * A equipe da organização, quem está logado e o filtro por responsável de uma
 * lista. O filtro começa pelo ?responsavel= do endereço (o link "ver as
 * negociações" da página da pessoa) e volta para "todos" ao trocar de organização.
 */
export function useFiltroResponsavel(organizationId: string | null) {
  const [membros, setMembros] = useState<MembroDaEquipe[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  // Os dados e o seletor só aparecem depois de carregar no navegador, então ler o endereço aqui não descasa a hidratação.
  const [filtro, setFiltro] = useState<FiltroResponsavel>(
    () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("responsavel")) ?? "todos",
  );

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const [{ data: { user } }, lista] = await Promise.all([
        createClient().auth.getUser(),
        fetchOrganizationMembers(organizationId).catch(() => []),
      ]);
      if (!ativo) return;
      setMeuId(user?.id ?? null);
      setMembros(membrosDaEquipe(lista));
    })();
    return () => { ativo = false; };
  }, [organizationId]);

  const [orgAnterior, setOrgAnterior] = useState(organizationId);
  if (orgAnterior !== organizationId) {
    setOrgAnterior(organizationId);
    if (orgAnterior !== null) setFiltro("todos");
  }

  const casa = useCallback(
    (donos: readonly (string | null | undefined)[]) => casaResponsavel(donos, filtro, meuId),
    [filtro, meuId],
  );

  return { membros, meuId, filtro, setFiltro, casa, ativo: filtro !== "todos" };
}
