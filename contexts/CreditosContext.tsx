"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "./OrganizationContext";
import type { PlanTipo } from "@/lib/supabase/types";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

interface CreditosInfo {
  plano: string;
  creditos_totais: number;
  creditos_usados: number;
  creditos_disponiveis: number;
  usuarios_extras: number;
}

interface ConfigOrg {
  visibilidade_captacoes: "admin_only" | "team_shared";
  acesso_contatos: "admin_only" | "team_with_credits";
}

export interface AssinaturaInfo {
  plano: PlanTipo;
  ativa: boolean;
  status: "inactive" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled" | "incomplete" | "incomplete_expired";
  periodoFim: string | null;
}

export interface ResultadoPesquisaEmpresa {
  sucesso: boolean;
  consumiuCredito: boolean;
  jaSolicitada: boolean;
  status?: string;
  erro?: string;
}

interface CreditosContextValue {
  creditos: CreditosInfo | null;
  config: ConfigOrg | null;
  assinatura: AssinaturaInfo | null;
  loading: boolean;
  desbloquearEmpresa: (empresaId: string) => Promise<boolean>;
  consumirCredito: (empresaId: string) => Promise<boolean>;
  solicitarPesquisaEmpresa: (empresaId: string) => Promise<ResultadoPesquisaEmpresa>;
  podeVerContatos: () => boolean;
  recarregar: () => Promise<void>;
}

/* -------------------------------------------------------------------------- */
/*                                CONTEXT                                     */
/* -------------------------------------------------------------------------- */

const CreditosContext = createContext<CreditosContextValue>({
  creditos: null,
  config: null,
  assinatura: null,
  loading: true,
  desbloquearEmpresa: async () => false,
  consumirCredito: async () => false,
  solicitarPesquisaEmpresa: async () => ({ sucesso: false, consumiuCredito: false, jaSolicitada: false }),
  podeVerContatos: () => false,
  recarregar: async () => {},
});

export function useCreditos() {
  return useContext(CreditosContext);
}

/* -------------------------------------------------------------------------- */
/*                                PROVIDER                                    */
/* -------------------------------------------------------------------------- */

export function CreditosProvider({ children }: { children: ReactNode }) {
  const organizationId = useOrganizationId();
  const [creditos, setCreditos] = useState<CreditosInfo | null>(null);
  const [config, setConfig] = useState<ConfigOrg | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarDados = useCallback(async () => {
    if (!organizationId) {
      setCreditos(null);
      setConfig(null);
      setAssinatura(null);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profileData } = await (supabase as any)
        .from("profiles")
        .select("plano, periodo_fim, stripe_subscription_status")
        .eq("id", user.id)
        .maybeSingle();

      const plano = (profileData?.plano ?? "gratuito") as PlanTipo;
      const periodoFim = (profileData?.periodo_fim as string | null | undefined) ?? null;
      const status = (profileData?.stripe_subscription_status ?? "inactive") as AssinaturaInfo["status"];
      const periodoValido = !periodoFim || new Date(periodoFim).getTime() > Date.now();
      setAssinatura({
        plano,
        ativa: plano !== "gratuito" && periodoValido && (status === "active" || status === "trialing"),
        status,
        periodoFim,
      });
    } else {
      setAssinatura(null);
    }

    // Carregar créditos
    const { data: creditosData } = await (supabase as any)
      .from("creditos")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (creditosData) {
      setCreditos({
        plano: creditosData.plano,
        creditos_totais: creditosData.creditos_totais,
        creditos_usados: creditosData.creditos_usados,
        creditos_disponiveis: creditosData.creditos_totais - creditosData.creditos_usados,
        usuarios_extras: creditosData.usuarios_extras,
      });
    } else {
      // O saldo nasce no primeiro pagamento confirmado pelo webhook.
      setCreditos({
        plano: "gratuito",
        creditos_totais: 0,
        creditos_usados: 0,
        creditos_disponiveis: 0,
        usuarios_extras: 0,
      });
    }

    // Carregar config
    const { data: configData } = await (supabase as any)
      .from("config_org")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (configData) {
      setConfig({
        visibilidade_captacoes: configData.visibilidade_captacoes,
        acesso_contatos: configData.acesso_contatos,
      });
    } else {
      // Criar config padrão
      await (supabase as any).from("config_org").insert({
        organization_id: organizationId,
          visibilidade_captacoes: "admin_only",
        acesso_contatos: "team_with_credits",
      });
      setConfig({
        visibilidade_captacoes: "admin_only",
        acesso_contatos: "team_with_credits",
      });
    }

    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function desbloquearEmpresa(empresaId: string): Promise<boolean> {
    if (!organizationId || !assinatura?.ativa) return false;

    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc("fn_desbloquear_empresa", {
      p_organization_id: organizationId,
      p_empresa_id: empresaId,
    });

    if (error) {
      console.error("Erro ao desbloquear empresa:", error.code, error.message, error.details);
      return false;
    }

    if (data?.sucesso && data?.consumiu_credito) {
      // Atualizar estado local
      setCreditos(prev => prev ? {
        ...prev,
        creditos_usados: prev.creditos_usados + 1,
        creditos_disponiveis: Math.max(prev.creditos_disponiveis - 1, 0),
      } : null);
    }

    return data?.sucesso === true;
  }

  async function consumirCredito(empresaId: string): Promise<boolean> {
    if (!organizationId || !assinatura?.ativa) return false;

    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc("fn_consumir_credito", {
      p_organization_id: organizationId,
      p_empresa_id: empresaId,
    });

    if (error || data !== true) {
      console.error("Erro ao consumir crédito:", error?.code, error?.message, error?.details);
      return false;
    }

    await carregarDados();

    return true;
  }

  async function solicitarPesquisaEmpresa(empresaId: string): Promise<ResultadoPesquisaEmpresa> {
    if (!organizationId) {
      return { sucesso: false, consumiuCredito: false, jaSolicitada: false, erro: "Organização não identificada." };
    }
    if (!assinatura?.ativa) {
      return { sucesso: false, consumiuCredito: false, jaSolicitada: false, erro: "Assinatura inativa. Regularize o pagamento para continuar." };
    }

    const supabase = createClient();
    const { data, error } = await (supabase as any).rpc("fn_solicitar_pesquisa_empresa", {
      p_organization_id: organizationId,
      p_empresa_id: empresaId,
    });

    if (error) {
      console.error("Erro ao solicitar pesquisa de empresa:", error.code, error.message, error.details);
      return {
        sucesso: false,
        consumiuCredito: false,
        jaSolicitada: false,
        erro: error.message || "Não foi possível priorizar esta busca.",
      };
    }

    const consumiuCredito = data?.consumiu_credito === true;
    if (consumiuCredito) {
      setCreditos(prev => prev ? {
        ...prev,
        creditos_usados: prev.creditos_usados + 1,
        creditos_disponiveis: Math.max(prev.creditos_disponiveis - 1, 0),
      } : null);
    }

    return {
      sucesso: data?.sucesso === true,
      consumiuCredito,
      jaSolicitada: data?.ja_solicitada === true,
      status: data?.status,
    };
  }

  function podeVerContatos(): boolean {
    if (!config || !assinatura?.ativa) return false;
    // Se acesso é admin_only, só admin pode ver
    if (config.acesso_contatos === "admin_only") {
      // TODO: verificar se é admin
      return true; // Simplificação - verificar no componente
    }
    // Se tem créditos disponíveis
    return (creditos?.creditos_disponiveis ?? 0) > 0;
  }

  return (
    <CreditosContext.Provider value={{
      creditos,
      config,
      assinatura,
      loading,
      desbloquearEmpresa,
      consumirCredito,
      solicitarPesquisaEmpresa,
      podeVerContatos,
      recarregar: carregarDados,
    }}>
      {children}
    </CreditosContext.Provider>
  );
}
