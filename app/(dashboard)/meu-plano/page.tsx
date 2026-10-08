"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Check, Zap, Telescope, Building2, Lock, ExternalLink,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { Profile, PlanTipo } from "@/lib/supabase/types";
import { AssinaturaDoModulo } from "@/components/prestacao/AssinaturaDoModulo";

// ─── Plan definitions ─────────────────────────────────────────────────────────

type UsageKey = "projetos" | "atividades" | "inscricoes" | "captadores" | "proponentes" | "clientes" | "desbloqueios";

const USAGE_LABEL: Record<UsageKey, string> = {
  projetos: "Projetos ativos",
  atividades: "Atividades em aberto",
  inscricoes: "Inscrições em andamento",
  captadores: "Captadores ativos",
  proponentes: "Proponentes",
  clientes: "Clientes ativos",
  desbloqueios: "Desbloqueios",
};

type PlanDef = {
  key: PlanTipo;
  label: string;
  preco: string | null;
  precoLegenda: string;
  precoMensal: number | null;
  icon: React.ElementType;
  cor: string;
  destaque?: boolean;
  features: string[];
  limites: Partial<Record<UsageKey, number | null>>;
};

const PLANS: PlanDef[] = [
  {
    key: "gratuito",
    label: "Gratuito",
    preco: "R$ 0",
    precoLegenda: "para sempre",
    precoMensal: 0,
    icon: Building2,
    cor: "rgba(13,13,13,.40)",
    features: [
      "Oportunidades ilimitadas",
      "Patrocinadores para explorar",
      "CRM essencial com uso limitado",
      "Projetos e inscrições em um só lugar",
    ],
    limites: { projetos: 1, atividades: 5, inscricoes: 5, captadores: 1, proponentes: 1, clientes: 5 },
  },
  {
    key: "basico",
    label: "Starter",
    preco: "R$ 62,90",
    precoLegenda: "por mês",
    precoMensal: 62.9,
    icon: Zap,
    cor: "#7259B5",
    features: [
      "Negociações ilimitadas",
      "100 créditos mensais",
      "Operação comercial e atividades",
      "Dashboard com KPIs e alertas",
    ],
    limites: { desbloqueios: 100 },
  },
  {
    key: "profissional",
    label: "Pro",
    preco: "R$ 92,80",
    precoLegenda: "por mês",
    precoMensal: 92.8,
    icon: Telescope,
    cor: "#7259B5",
    destaque: true,
    features: [
      "Tudo do Starter",
      "200 créditos mensais",
      "Inteligência e histórico completos",
      "Clientes, entregas e renovação",
    ],
    limites: { desbloqueios: 200 },
  },
];

// Status em que a assinatura ainda existe no Stripe: trocar de plano é pelo
// portal, nunca por um checkout novo (geraria uma segunda assinatura).
const ASSINATURA_VIGENTE = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(used: number, limit: number | null): number {
  if (limit === null) return 0;
  return Math.min((used / limit) * 100, 100);
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const p = pct(used, limit);
  const over = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-semibold text-black/60">{label}</span>
        <span className={`flex items-center gap-1 font-semibold tabular-nums ${used ? "text-[#0D0D0D]" : "text-black/30"}`}>
          {over && <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]" />}
          {used} / {limit === null ? "∞" : limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/6 overflow-hidden">
        {limit !== null && (
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${p}%`, background: over ? "#D94A4A" : "rgba(13,13,13,.75)" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Inner page (uses useSearchParams) ───────────────────────────────────────

function MeuPlanoInner() {
  const supabase    = createClient();
  const organizationId = useOrganizationId();
  const params      = useSearchParams();
  // A volta do checkout da prestação de contas (P5.6) é tratada no cartão do módulo.
  const doModulo    = params.get("modulo") === "prestacao";
  const success     = !doModulo && params.get("success") === "1";
  const canceled    = !doModulo && params.get("canceled") === "1";
  const destacarModulo = doModulo || params.get("assinar") === "prestacao";
  const retornoModulo = !doModulo ? null : params.get("success") === "1" ? "pago" : params.get("canceled") === "1" ? "cancelado" : null;

  const [profile, setProfile]             = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Record<UsageKey, number>>({
    projetos: 0,
    atividades: 0,
    inscricoes: 0,
    captadores: 0,
    proponentes: 0,
    clientes: 0,
    desbloqueios: 0,
  });
  const [loading, setLoading]             = useState(true);
  const [upgrading, setUpgrading]         = useState<PlanTipo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [stripeAtivo, setStripeAtivo]     = useState(true);
  const [erro, setErro]                   = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!organizationId) return;
      setLoading(true);
      const hoje = new Date();
      const mesIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
      // Só o próprio perfil: a policy de equipe (e a de super admin) libera
      // outros perfis, e sem o filtro o .single() falhava e a tela caía em "Gratuito".
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, projetosRes, atividadesRes, inscricoesRes, captadoresRes, proponentesRes, clientesRes, desbRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("profiles").select("*").eq("id", user.id).maybeSingle() as Promise<{ data: Profile | null; error: unknown }>,
        supabase.from("projetos_crm").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status_operacional", "arquivado"),
        supabase.from("atividades").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("feita", false),
        supabase.from("editais_user").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["interesse", "inscrito", "em_analise"]),
        supabase.from("captadores").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("ativo", true),
        supabase.from("proponentes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("contas_patrocinio").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "encerrada"),
        supabase.from("desbloqueios").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", mesIni),
      ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile);
      setUsage({
        projetos: projetosRes.count ?? 0,
        atividades: atividadesRes.count ?? 0,
        inscricoes: inscricoesRes.count ?? 0,
        captadores: captadoresRes.count ?? 0,
        proponentes: proponentesRes.count ?? 0,
        clientes: clientesRes.count ?? 0,
        desbloqueios: desbRes.count ?? 0,
      });

      // Check if Stripe is configured
      const stripeCheck = await fetch("/api/stripe/checkout", { method: "HEAD" }).catch(() => null);
      if (stripeCheck?.status === 503) setStripeAtivo(false);

      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function handleUpgrade(plano: PlanTipo) {
    if (!stripeAtivo) return;
    setErro(null);
    setUpgrading(plano);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plano }),
      });
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setErro(res.status === 409 && json.error ? json.error : res.status === 401 ? "Sua sessão expirou. Entre de novo para assinar." : "Não foi possível abrir o pagamento. Tente de novo.");
        setUpgrading(null);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setErro("Não foi possível abrir o pagamento. Tente de novo.");
      setUpgrading(null);
    }
  }

  async function handlePortal() {
    setErro(null);
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json().catch(() => ({})) as { url?: string };
      if (!res.ok || !json.url) {
        setErro(res.status === 401 ? "Sua sessão expirou. Entre de novo para gerenciar a assinatura." : "Não foi possível abrir o gerenciamento da assinatura. Tente de novo.");
        setPortalLoading(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setErro("Não foi possível abrir o gerenciamento da assinatura. Tente de novo.");
      setPortalLoading(false);
    }
  }

  const planoAtual = profile?.plano ?? "gratuito";
  const planDef    = PLANS.find((p) => p.key === planoAtual)!;
  const usageEntries = (Object.entries(planDef.limites) as Array<[UsageKey, number | null]>);
  const temAssinatura = !!profile?.stripe_subscription_id && ASSINATURA_VIGENTE.includes(profile.stripe_subscription_status);

  return (
    <div className="px-8 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bold text-[#0D0D0D] text-[1.75rem]">Meu plano</h1>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 bg-white border border-green-200 rounded px-5 py-4 mb-6">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-900">Pagamento recebido pelo Stripe</p>
            <p className="text-xs text-green-700 mt-0.5">A ativação e os créditos aparecem assim que o webhook confirmar o pagamento.</p>
          </div>
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-gray-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">Checkout cancelado. Você pode tentar novamente quando quiser.</p>
        </div>
      )}
      {!stripeAtivo && (
        <div className="flex items-center gap-3 bg-white border border-amber-200 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">Pagamentos não configurados</p>
            <p className="text-xs text-amber-700 mt-0.5">Adicione as chaves Stripe ao <code className="rounded bg-black/[.05] px-1">.env.local</code> para ativar upgrades.</p>
          </div>
        </div>
      )}
      {profile && ["past_due", "unpaid", "paused", "incomplete", "incomplete_expired"].includes(profile.stripe_subscription_status) && (
        <div className="flex items-center gap-3 bg-white border border-[#D94E4E]/25 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-[#B23A3A] flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#7A2626]">Assinatura temporariamente suspensa</p>
            <p className="text-xs text-[#B23A3A] mt-0.5">Regularize o pagamento no portal para restaurar o plano e renovar os créditos automaticamente.</p>
          </div>
        </div>
      )}

      {erro && (
        <div role="alert" className="flex items-center gap-3 bg-white border border-[#D94E4E]/25 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-[#B23A3A] flex-shrink-0" />
          <p className="text-sm text-[#B23A3A]">{erro}</p>
        </div>
      )}

      {destacarModulo && (
        <div className="mb-8">
          <AssinaturaDoModulo destacar retorno={retornoModulo} />
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_18.75rem] gap-6">
        {/* Planos */}
        <div className="space-y-4">
          <p className="text-xs font-bold text-black/35 uppercase tracking-wider">Planos disponíveis</p>
          <div className="grid md:grid-cols-3 gap-4 items-start">
            {PLANS.map((plan) => {
              const isAtual   = plan.key === planoAtual;
              const isUpgrade = PLANS.findIndex((p) => p.key === plan.key) > PLANS.findIndex((p) => p.key === planoAtual);
              const isLoading = upgrading === plan.key;
              const dark      = !!plan.destaque;

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded border p-6 ${isAtual && !dark ? "ring-2" : ""}`}
                  style={{
                    background: dark ? "#0D0D0D" : "#fff",
                    borderColor: dark ? "#0D0D0D" : "rgba(13,13,13,.08)",
                    boxShadow: isAtual && !dark ? `0 0 0 2px ${plan.cor}` : undefined,
                  }}
                >
                  {(isAtual || plan.destaque) && (
                    <span
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold"
                      style={isAtual
                        ? { background: plan.cor, color: "#fff" }
                        : { background: "#fff", color: "#0D0D0D", boxShadow: "0 1px 4px rgba(13,13,13,.18)" }}
                    >
                      {isAtual ? "Plano atual" : "Mais popular"}
                    </span>
                  )}

                  {/* Eyebrow + preço */}
                  <p
                    className="mb-4 text-[0.6875rem] font-bold uppercase tracking-widest"
                    style={{ color: dark ? "rgba(255,255,255,.45)" : "rgba(13,13,13,.40)" }}
                  >
                    {plan.label}
                  </p>
                  <p className="text-[2rem] font-bold leading-none tracking-tight" style={{ color: dark ? "#fff" : "#0D0D0D" }}>
                    {plan.preco}
                  </p>
                  <p className="mb-5 mt-1.5 text-[0.75rem]" style={{ color: dark ? "rgba(255,255,255,.40)" : "rgba(13,13,13,.35)" }}>
                    {plan.precoLegenda}
                  </p>

                  {dark && <div className="mb-5 h-px w-full" style={{ background: "rgba(255,255,255,.14)" }} />}

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[0.8125rem]" style={{ color: dark ? "rgba(255,255,255,.85)" : "rgba(13,13,13,.65)" }}>
                        <Check size={13} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" style={{ color: dark ? "#B9A6E8" : plan.cor }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isAtual ? (
                    <div
                      className="w-full rounded py-2.5 text-center text-xs font-bold"
                      style={dark ? { background: "rgba(255,255,255,.12)", color: "#fff" } : { background: "#fff", border: `1px solid ${plan.cor}47`, color: plan.cor }}
                    >
                      Ativo
                    </div>
                  ) : isUpgrade ? (
                    <button
                      type="button"
                      onClick={() => temAssinatura ? handlePortal() : handleUpgrade(plan.key)}
                      disabled={!!upgrading || portalLoading || !stripeAtivo}
                      className="w-full rounded py-2.5 text-xs font-bold transition disabled:opacity-50"
                      style={dark
                        ? { background: stripeAtivo ? "#fff" : "rgba(255,255,255,.25)", color: "#0D0D0D" }
                        : { background: stripeAtivo ? plan.cor : "rgba(13,13,13,.35)", color: "#fff" }}
                    >
                      {isLoading || (temAssinatura && portalLoading) ? "Redirecionando…" : stripeAtivo ? `${temAssinatura ? "Mudar para" : "Assinar"} ${plan.label}` : <span className="flex items-center justify-center gap-1"><Lock size={11} /> Stripe pendente</span>}
                    </button>
                  ) : (
                    <div
                      className="w-full rounded py-2.5 text-center text-xs font-semibold"
                      style={dark ? { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.35)" } : { background: "rgba(13,13,13,.04)", color: "rgba(13,13,13,.25)" }}
                    >
                      Downgrade
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: uso atual + gerenciar */}
        <div className="space-y-4">
          {/* Plano atual */}
          <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-bold text-black/35 uppercase tracking-wide mb-3">Plano atual</p>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-5 w-24 bg-black/8 rounded" />
                <div className="h-3 w-32 bg-black/8 rounded" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <planDef.icon size={16} style={{ color: planDef.cor }} />
                  <span className="text-base font-bold" style={{ color: planDef.cor }}>{planDef.label}</span>
                </div>
                {profile?.stripe_subscription_status && profile.stripe_subscription_status !== "inactive" && (
                  <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35">
                    {profile.stripe_subscription_status === "active" ? "Ativa" : profile.stripe_subscription_status === "trialing" ? "Período de teste" : profile.stripe_subscription_status === "canceled" ? "Cancelada" : "Pagamento pendente"}
                  </p>
                )}
                {profile?.periodo_fim && (
                  <p className="text-xs text-black/40">
                    Renova em {new Date(profile.periodo_fim).toLocaleDateString("pt-BR")}
                  </p>
                )}
                {(planoAtual !== "gratuito" || temAssinatura) && profile?.stripe_subscription_id && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading || !stripeAtivo}
                    className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-black/40 hover:text-black transition disabled:opacity-40"
                  >
                    <ExternalLink size={11} />
                    {portalLoading ? "Abrindo…" : "Gerenciar assinatura"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Uso do mês */}
          <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-bold text-black/35 uppercase tracking-wide mb-4">Uso este mês</p>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[0, 1].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-24 bg-black/8 rounded" />
                      <div className="h-3 w-10 bg-black/8 rounded" />
                    </div>
                    <div className="h-2 w-full bg-black/8 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              usageEntries.length > 0 ? (
                <div className="space-y-4">
                  {usageEntries.map(([key, limit]) => (
                    <UsageBar key={key} label={USAGE_LABEL[key]} used={usage[key]} limit={limit} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-black/45">Seu plano não possui limites operacionais.</p>
              )
            )}
          </div>

          {/* FAQ rápido */}
          <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-bold text-black/35 uppercase tracking-wide mb-3">Dúvidas</p>
            <div className="space-y-3 text-xs text-black/50">
              <p><span className="font-semibold text-black/70">Posso cancelar a qualquer momento?</span><br />Sim. O acesso fica ativo até o fim do período pago.</p>
              <p><span className="font-semibold text-black/70">O que são desbloqueios?</span><br />Cada empresa com dados detalhados (contatos, histórico) consome 1 crédito por mês.</p>
              <p><span className="font-semibold text-black/70">Como os créditos são renovados?</span><br />No início de cada mês o contador volta a zero.</p>
            </div>
          </div>
        </div>
      </div>

      {!destacarModulo && (
        <div className="mt-8">
          <AssinaturaDoModulo destacar={false} retorno={null} />
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ──────────────────────────────

export default function MeuPlanoPage() {
  return (
    <Suspense fallback={
      <div className="px-8 py-8">
        <div className="h-8 w-32 bg-black/8 rounded animate-pulse mb-6" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-64 rounded bg-black/8 animate-pulse" />)}
        </div>
      </div>
    }>
      <MeuPlanoInner />
    </Suspense>
  );
}
