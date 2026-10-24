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

const CARENCIA_PAST_DUE_DIAS = 15;

/**
 * A assinatura da ORGANIZAÇÃO aberta, a mesma que o banco usa (fn_org_assinatura_ativa):
 * plano, status e datas são os do perfil de quem paga (creditos.account_id), nunca os de
 * quem está vendo. Um usuário extra (perfil "gratuito") numa organização paga vê a
 * organização como paga.
 */
export interface AssinaturaInfo {
  plano: PlanTipo;
  ativa: boolean;
  status: "inactive" | "trialing" | "active" | "past_due" | "unpaid" | "paused" | "canceled" | "incomplete" | "incomplete_expired";
  periodoFim: string | null;
  pastDueSince: string | null;
  diasRestantesCarencia: number | null;
  /** Quem está vendo é quem paga: só essa pessoa gerencia a cobrança no Stripe. */
  ehPagador: boolean;
  /** A organização tem (ou já teve) quem pague: a linha de créditos existe. */
  temPagador: boolean;
  pagadorNome: string | null;
}

interface CreditosContextValue {
  creditos: CreditosInfo | null;
  config: ConfigOrg | null;
  assinatura: AssinaturaInfo | null;
  loading: boolean;
  desbloquearEmpresa: (empresaId: string) => Promise<boolean>;
  consumirCredito: (empresaId: string) => Promise<boolean>;
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

    // Carregar créditos: a linha é da organização e diz quem paga (account_id).
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

    if (user) {
      // A assinatura é da organização: quem decide é fn_org_assinatura_ativa, a mesma
      // checagem de fn_desbloquear_empresa e do conector. O perfil de quem paga (colega
      // de equipe, legível pela policy "profiles: select team members") só dá o plano,
      // o status e as datas para mostrar.
      const pagadorId = (creditosData?.account_id as string | null | undefined) ?? null;
      const [ativaRes, pagadorRes] = await Promise.all([
        (supabase as any).rpc("fn_org_assinatura_ativa", { p_organization_id: organizationId }),
        pagadorId
          ? (supabase as any)
              .from("profiles")
              .select("plano, periodo_fim, stripe_subscription_status, past_due_since, full_name")
              .eq("id", pagadorId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const pagador = pagadorRes.data;

      const plano = (pagador?.plano ?? "gratuito") as PlanTipo;
      const periodoFim = (pagador?.periodo_fim as string | null | undefined) ?? null;
      const pastDueSince = (pagador?.past_due_since as string | null | undefined) ?? null;
      const status = (pagador?.stripe_subscription_status ?? "inactive") as AssinaturaInfo["status"];
      const periodoValido = !periodoFim || new Date(periodoFim).getTime() > Date.now();

      // past_due tem 15 dias de carência contados de past_due_since, como no banco
      // (sem depender de periodo_fim, que já pode ter rolado para o período novo).
      const diasEmAtraso = pastDueSince ? (Date.now() - new Date(pastDueSince).getTime()) / 86_400_000 : null;
      const dentroDaCarencia = status === "past_due" && diasEmAtraso !== null && diasEmAtraso <= CARENCIA_PAST_DUE_DIAS;
      const diasRestantesCarencia = dentroDaCarencia ? Math.max(0, Math.ceil(CARENCIA_PAST_DUE_DIAS - diasEmAtraso!)) : null;

      // Se a RPC falhar, espelha a regra do banco para não trancar quem paga por um erro de rede.
      const espelhoDoBanco = plano !== "gratuito"
        && (creditosData?.creditos_totais ?? 0) > 0
        && ((periodoValido && (status === "active" || status === "trialing")) || dentroDaCarencia);

      setAssinatura({
        plano,
        ativa: ativaRes.error ? espelhoDoBanco : ativaRes.data === true,
        status,
        periodoFim,
        pastDueSince,
        diasRestantesCarencia,
        ehPagador: pagadorId !== null && pagadorId === user.id,
        temPagador: pagadorId !== null,
        pagadorNome: (pagador?.full_name as string | null | undefined) ?? null,
      });
    } else {
      setAssinatura(null);
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
      podeVerContatos,
      recarregar: carregarDados,
    }}>
      {children}
    </CreditosContext.Provider>
  );
}
