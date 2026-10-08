"use client";

import { useCallback, useEffect, useState } from "react";
import type { DescricaoDaAssinatura } from "@/lib/modulos-contrato";

export type AssinaturaPrestacao = {
  descricao: DescricaoDaAssinatura;
  status: string | null;
  admin: boolean;
  responsavelCobranca: boolean;
  vagas: { total: number; emUso: number; compradas: number };
  precos: { modulo: number; vaga: number };
  cobrancaConfigurada: boolean;
};

/**
 * Situação da assinatura do módulo de prestação de contas da organização
 * (GET /api/prestacao/assinatura). Null enquanto carrega ou quando a pessoa
 * não é da organização.
 */
export function useAssinaturaPrestacao(organizationId: string | null) {
  const [carregada, setCarregada] = useState<{ organizationId: string; assinatura: AssinaturaPrestacao | null } | null>(null);

  const consultar = useCallback(async (org: string): Promise<AssinaturaPrestacao | null> => {
    const resposta = await fetch(`/api/prestacao/assinatura?organization_id=${encodeURIComponent(org)}`, { cache: "no-store" }).catch(() => null);
    if (!resposta?.ok) return null;
    return await resposta.json().catch(() => null) as AssinaturaPrestacao | null;
  }, []);

  const recarregar = useCallback(async () => {
    if (!organizationId) return null;
    const assinatura = await consultar(organizationId);
    setCarregada({ organizationId, assinatura });
    return assinatura;
  }, [consultar, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    consultar(organizationId).then(assinatura => { if (ativo) setCarregada({ organizationId, assinatura }); });
    return () => { ativo = false; };
  }, [consultar, organizationId]);

  const valida = carregada && carregada.organizationId === organizationId ? carregada : null;
  return { assinatura: valida?.assinatura ?? null, carregando: !valida, recarregar };
}
