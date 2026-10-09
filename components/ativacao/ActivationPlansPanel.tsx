"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, Megaphone, Plus, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PlanoAtivacaoResumo } from "@/lib/supabase/types";
import { ACTIVATION_STATUS } from "@/lib/ativacao/constants";
import { activationProgress, shortDate } from "@/lib/ativacao/metrics";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { NovoPlanoAtivacaoModal } from "@/components/modals/NovoPlanoAtivacaoModal";

type Props = {
  organizationId: string;
  contaId?: string;
  projetoId?: string;
  title?: string;
};

export function ActivationPlansPanel({ organizationId, contaId, projetoId, title = "Ativações" }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [plans, setPlans] = useState<PlanoAtivacaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let query = (supabase as any).from("vw_planos_ativacao_resumo").select("*").neq("status", "arquivado").order("updated_at", { ascending: false });
    if (contaId) query = query.eq("conta_patrocinio_id", contaId);
    if (projetoId) query = query.eq("projeto_id", projetoId);
    const [planResult, userResult] = await Promise.all([
      query,
      supabase.auth.getUser(),
    ]);
    setPlans(planResult.data ?? []);
    setError(planResult.error?.message ?? null);
    const userId = userResult.data.user?.id;
    if (userId) {
      const { data } = await (supabase as any).from("organization_members").select("papel").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
      setCanWrite(["admin", "colaborador"].includes(data?.papel));
    }
    setLoading(false);
  }, [contaId, organizationId, projetoId, supabase]);

  useEffect(() => { void load(); }, [load]);

  return <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
    <header className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <div><p className="text-[0.6875rem] font-medium text-black/35">Contrapartidas</p><h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-[#282525]">{title}</h2></div>
      {canWrite && <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-10 items-center gap-2 self-start rounded border border-black/[.15] bg-white px-4 text-[0.75rem] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98] sm:self-auto"><Plus size={13}/>Novo plano</button>}
    </header>
    {error && <p className="mx-5 mt-4 rounded border border-[#D94E4E]/25 px-3 py-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}
    <div className="p-5 md:p-6">
      {loading ? <div className="grid gap-3 md:grid-cols-2">{[0,1].map(item => <div key={item} className="h-44 animate-pulse rounded bg-black/[.05]"/>)}</div> : plans.length === 0 ? <div className="py-16 text-center"><Megaphone size={24} className="mx-auto text-black/15"/><p className="mt-4 text-[0.875rem] font-semibold text-black/45">Nenhum plano de ativação</p><p className="mx-auto mt-2 max-w-md text-[0.75rem] leading-5 text-black/30">Planos de ativação organizam as contrapartidas entregues ao patrocinador — ações, evidências e verba em um único fluxo.</p>{canWrite && <button type="button" onClick={() => setShowCreate(true)} className="mt-5 inline-flex h-9 items-center gap-1.5 rounded border border-[#7259B5]/25 bg-white px-3.5 text-[0.6875rem] font-medium text-[#7259B5] hover:bg-black/[.04]"><Plus size={12}/>Criar primeiro plano</button>}</div> : <div className="grid gap-3 lg:grid-cols-2">{plans.map(plan => <PlanCard key={plan.id} plan={plan} hideProject={!!projetoId}/>)}</div>}
    </div>
    {showCreate && <NovoPlanoAtivacaoModal organizationId={organizationId} initialContaId={contaId} initialProjetoId={projetoId} onClose={() => setShowCreate(false)} onSaved={planId => { setShowCreate(false); void load(); router.push(`/ativacoes/${planId}`); }}/>}
  </section>;
}

function PlanCard({ plan, hideProject }: { plan: PlanoAtivacaoResumo; hideProject?: boolean }) {
  const progress = activationProgress(plan);
  const status = ACTIVATION_STATUS[plan.status];
  const subtitle = hideProject ? plan.empresa_nome : `${plan.empresa_nome} · ${plan.projeto_nome}`;
  return <Link href={`/ativacoes/${plan.id}`} className="group rounded border p-4 transition hover:bg-black/[.018]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[0.875rem] font-semibold text-black/75">{plan.nome}</p><p className="mt-1 truncate text-[0.6875rem] text-black/35">{subtitle}</p></div><ArrowUpRight size={14} className="shrink-0 text-black/20 transition group-hover:text-[#7259B5]"/></div>
    <div className="mt-4 flex items-center justify-between"><span className="text-[0.625rem] font-medium text-black/55">{status.label}</span><span className={`text-[0.6875rem] font-semibold tabular-nums ${progress ? "text-[#282525]" : "text-black/30"}`}>{progress}%</span></div>
    <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/[.06]"><div className="h-full rounded bg-[#282525]/70" style={{ width: `${progress}%` }}/></div>
    <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <Mini icon={CalendarDays} label="Próximo prazo" value={shortDate(plan.proxima_data)} />
      <Mini icon={WalletCards} label="Orçamento" value={formatarValorCurto(plan.orcamento_planejado)} title={formatarValorCompleto(plan.orcamento_planejado)} />
      <Mini icon={Megaphone} label="Contrapartidas" value={`${plan.entregaveis_aprovados}/${plan.entregaveis_total}`} />
    </div>
  </Link>;
}

function Mini({ icon: Icon, label, value, title }: { icon: typeof CalendarDays; label: string; value: string; title?: string }) {
  return <div className="min-w-0"><p className="flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45"><Icon size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40"/>{label}</p><p title={title} className="mt-1 truncate text-[0.625rem] font-semibold tabular-nums text-[#282525]">{value}</p></div>;
}
