"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { organizacaoDaPrestacao, SELECT_ORGANIZACAO_DA_PRESTACAO } from "@/lib/prestacao/armazenamento";

/**
 * Organização dona da prestação, usada como primeira pasta dos arquivos.
 * Fica `null` enquanto carrega, para nenhum upload sair com a pasta errada.
 * Prestação sem organização, projeto e captação cai na organização atual,
 * que é onde ela foi criada.
 */
export function usePrestacaoOrganizacao(prestacaoId: string): string | null {
  const supabase = useMemo(() => createClient(), []);
  const organizacaoAtual = useOrganizationId();
  const [carregada, setCarregada] = useState<{ prestacaoId: string; organizationId: string | null } | null>(null);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacoes_contas entra no tipo Database na P0.1
    (supabase as any)
      .from("prestacoes_contas")
      .select(SELECT_ORGANIZACAO_DA_PRESTACAO)
      .eq("id", prestacaoId)
      .maybeSingle()
      .then(({ data }: { data: Parameters<typeof organizacaoDaPrestacao>[0] }) => {
        if (ativo) setCarregada({ prestacaoId, organizationId: organizacaoDaPrestacao(data) });
      });
    return () => { ativo = false; };
  }, [prestacaoId, supabase]);

  if (!carregada || carregada.prestacaoId !== prestacaoId) return null;
  return carregada.organizationId ?? organizacaoAtual;
}
