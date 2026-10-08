"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck, HeartPulse, Plus, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CompromissoCliente, PrevisaoRenovacao } from "@/lib/supabase/types";
import { Select } from "@/components/ui/Select";
import { PartnershipHealthScorecards } from "@/components/customer-success/PartnershipHealthScorecards";
import { RenewalPlanningSheet, type RenewalPlan } from "@/components/customer-success/RenewalPlanningSheet";
import { OUTCOME_LABELS } from "@/lib/customer-success/renewalDecisionTree";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type Contract = { id: string; titulo: string | null; numero: string | null; valor: number; proxima_renovacao: string | null; status: string };
type Project = { id: string; nome: string };
export type PartnershipSection = "overview" | "deliveries" | "renewal";
export type PartnershipAction = "commitment" | "renewal";
type Props = {
  contaId: string;
  organizationId: string;
  accountId: string;
  contracts: Contract[];
  projects: Project[];
  section?: PartnershipSection;
  actionRequest?: { kind: PartnershipAction; nonce: number } | null;
  onActionRequestHandled?: () => void;
  onDataChanged?: () => void;
  onHealthScoreChange?: (score: number | null, evaluated: number, total: number) => void;
};

export function PartnershipWorkspace({ contaId, organizationId, accountId, contracts, projects, section = "overview", actionRequest = null, onActionRequestHandled, onDataChanged, onHealthScoreChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [commitments, setCommitments] = useState<CompromissoCliente[]>([]);
  const [renewals, setRenewals] = useState<PrevisaoRenovacao[]>([]);
  const [renewalPlans, setRenewalPlans] = useState<RenewalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<"commitment" | null>(null);
  const [renewalSheetOpen, setRenewalSheetOpen] = useState(false);
  const [renewalContractId, setRenewalContractId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r, plans] = await Promise.all([
      (supabase as any).from("compromissos_cliente").select("*").eq("conta_patrocinio_id", contaId).order("prazo", { ascending: true, nullsFirst: false }),
      (supabase as any).from("previsoes_renovacao").select("*").in("contrato_id", contracts.map(item => item.id).length ? contracts.map(item => item.id) : ["00000000-0000-0000-0000-000000000000"]),
      (supabase as any).from("renovacoes_cliente").select("*").eq("conta_patrocinio_id", contaId).order("created_at", { ascending: false }),
    ]);
    setCommitments(c.data ?? []); setRenewals(r.data ?? []); setRenewalPlans(plans.data ?? []);
    setError(c.error?.message ?? r.error?.message ?? plans.error?.message ?? null);
    setLoading(false);
  }, [contaId, contracts, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (actionRequest) {
      if (actionRequest.kind === "renewal") setRenewalSheetOpen(true);
      else setForm("commitment");
      onActionRequestHandled?.();
    }
  }, [actionRequest, onActionRequestHandled]);

  async function submit(_kind: "commitment", data: Record<string, FormDataEntryValue>) {
    setSaving(true); setError(null);
    try {
      const result: any = await (supabase as any).from("compromissos_cliente").insert({ organization_id: organizationId, account_id: accountId, conta_patrocinio_id: contaId, titulo: data.titulo, categoria: data.categoria, prazo: data.prazo || null, contrato_id: data.contrato_id || null, projeto_id: data.projeto_id || null, observacoes: data.observacoes || null });
      if (result.error) throw result.error;
      setForm(null); await load(); onDataChanged?.();
    } catch (cause: any) { setError(cause?.message ?? "Não foi possível salvar."); }
    setSaving(false);
  }

  async function finishCommitment(item: CompromissoCliente) {
    await (supabase as any).from("compromissos_cliente").update({ status: item.status === "entregue" ? "aprovado" : "entregue", aprovado_em: item.status === "entregue" ? new Date().toISOString() : null }).eq("id", item.id);
    await load(); onDataChanged?.();
  }

  const sectionMeta = section === "deliveries"
    ? { eyebrow: "Execução da parceria", title: "Entregas" }
    : section === "renewal"
      ? { eyebrow: "Continuidade", title: "Renovação" }
      : { eyebrow: "Gestão da parceria", title: "Visão da parceria" };

  return <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
    <header className="border-b px-5 py-5 md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><p className="text-[0.6875rem] font-medium text-black/35">{sectionMeta.eyebrow}</p><h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">{sectionMeta.title}</h2></div>
        <div className="flex flex-wrap gap-2">
          {section === "deliveries" ? <WorkspaceAction label="Registrar entrega" onClick={() => setForm("commitment")} accent /> : section === "renewal" ? <WorkspaceAction label="Planejar renovação" onClick={() => { setRenewalContractId(null); setRenewalSheetOpen(true); }} accent /> : null}
        </div>
      </div>
    </header>
    {form && <QuickForm contracts={contracts} projects={projects} saving={saving} onClose={() => setForm(null)} onSubmit={submit}/>} 
    {error && <p className="mx-5 mt-4 rounded border border-[#D94E4E]/20 px-3 py-2 text-xs text-[#D94E4E]">{error}</p>}
    <div className="p-5 md:p-6">{loading ? <p className="py-16 text-center text-xs text-black/30">Carregando a parceria…</p> : section === "deliveries" ? <CommitmentsView items={commitments} onFinish={finishCommitment}/> : section === "renewal" ? <RenewalView contracts={contracts} renewals={renewals} plans={renewalPlans} onPlan={contractId => { setRenewalContractId(contractId); setRenewalSheetOpen(true); }}/> : <div className="space-y-6">
      <section><div className="mb-3 flex items-center gap-2"><HeartPulse size={14} className="text-[#7259B5]"/><h3 className="text-[0.875rem] font-semibold text-black/70">Saúde por scorecards</h3></div><PartnershipHealthScorecards contaId={contaId} organizationId={organizationId} onScoreChange={onHealthScoreChange}/></section>
    </div>}</div>
    <RenewalPlanningSheet open={renewalSheetOpen} contaId={contaId} organizationId={organizationId} contracts={contracts} projects={projects} plans={renewalPlans} initialContractId={renewalContractId} onClose={() => setRenewalSheetOpen(false)} onSaved={async () => { setRenewalSheetOpen(false); await load(); onDataChanged?.(); }}/>
  </section>;
}

function WorkspaceAction({label,onClick,accent=false}:{label:string;onClick:()=>void;accent?:boolean}) { return <button onClick={onClick} className="rounded border bg-white px-3.5 py-2 text-[0.75rem] font-medium transition hover:bg-black/[.04] active:translate-y-px" style={{color:accent?'#7259B5':'rgba(13,13,13,.58)',borderColor:accent?'#7259B540':'rgba(13,13,13,.11)'}}><Plus size={12} className="mr-1.5 inline"/>{label}</button>; }

function CommitmentsView({items,onFinish}:{items:CompromissoCliente[];onFinish:(i:CompromissoCliente)=>void}) { if(!items.length)return <Empty icon={ClipboardCheck} title="Nenhum compromisso registrado" copy="Conecte contrato, projeto, prazo e evidência para que promessas não se percam."/>;return <div className="divide-y divide-black/[.06]">{items.map(item=>{const late=item.prazo&&new Date(item.prazo)<new Date()&&!['entregue','aprovado','cancelado'].includes(item.status);return <div key={item.id} className="flex items-center gap-3 py-4"><button onClick={()=>onFinish(item)} className="flex h-7 w-7 items-center justify-center rounded border text-black/20 hover:border-[#2E8932] hover:text-[#2E8932]" style={{borderColor:'rgba(13,13,13,.12)'}}><Check size={13}/></button><div className="min-w-0 flex-1"><p className="text-[0.8125rem] font-semibold text-black/75">{item.titulo}</p><p className="mt-1 text-[0.6875rem] text-black/35">{item.categoria.replaceAll('_',' ')} · {item.status.replaceAll('_',' ')}</p></div><span className="text-[0.6875rem] font-medium" style={{color:late?'#D94E4E':'rgba(13,13,13,.4)'}}>{item.prazo?new Date(item.prazo+'T12:00').toLocaleDateString('pt-BR'):'Sem prazo'}</span></div>})}</div>; }
const RENEWAL_STATUS: Record<RenewalPlan["status"], { label: string; color: string }> = {
  programada: { label: "Programada", color: "#7259B5" },
  em_negociacao: { label: "Em negociação", color: "#2563A8" },
  aprovada: { label: "Aprovada", color: "#2E8932" },
  recusada: { label: "Recusada", color: "#B54444" },
  encerrada: { label: "Encerrada", color: "rgba(13,13,13,.5)" },
  cancelada: { label: "Cancelada", color: "rgba(13,13,13,.4)" },
};

const RENEWAL_SCENARIO: Record<RenewalPlan["cenario"], string> = {
  renovar: "Renovar", expandir: "Expandir", reduzir: "Reduzir", encerrar: "Encerrar",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "Não informado";
  return formatarValorCurto(value);
}

function RenewalView({ contracts, renewals, plans, onPlan }: { contracts: Contract[]; renewals: PrevisaoRenovacao[]; plans: RenewalPlan[]; onPlan: (contractId: string) => void }) {
  if (!contracts.length) return <Empty icon={RefreshCw} title="Nenhum contrato para renovar" copy="Adicione um contrato para planejar a continuidade da parceria." />;
  return <div className="divide-y divide-black/[.06] border-y border-black/[.06]">{contracts.map(contract => {
    const plan = plans.find(item => item.contrato_origem_id === contract.id);
    const legacy = renewals.find(item => item.contrato_id === contract.id);
    const status = plan ? RENEWAL_STATUS[plan.status] : null;
    const expectedValue = plan?.valor_esperado ?? legacy?.valor_esperado ?? contract.valor;
    const startDate = plan?.iniciar_negociacao_em ?? legacy?.data_esperada ?? contract.proxima_renovacao;
    return <article key={contract.id} className="grid items-center gap-4 py-4 md:grid-cols-[minmax(0,1fr)_6.875rem_8.125rem_6.875rem_auto]">
      <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-[0.8125rem] font-semibold text-black/75">{contract.titulo || contract.numero || "Contrato"}</p>{status && <span className="shrink-0 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ color: status.color, borderColor: `${status.color}47` }}>{status.label}</span>}</div><p className="mt-1 text-[0.6875rem] text-black/35">{plan ? `${RENEWAL_SCENARIO[plan.cenario]} · iniciar em ${formatDate(startDate)}` : "Renovação ainda não planejada"}</p></div>
      <Metric label="Valor esperado" value={formatCurrency(expectedValue)} title={expectedValue == null ? undefined : formatarValorCompleto(expectedValue)} /><Metric label="Início" value={formatDate(startDate)} /><Metric label="Decisão" value={plan?.diagnostico ? OUTCOME_LABELS[plan.diagnostico] : "Não avaliada"} />
      <div className="flex justify-end">{plan?.captacao_id ? <Link href={`/captacoes/${plan.captacao_id}`} className="rounded border border-black/[.12] bg-white px-3 py-2 text-[0.6875rem] font-semibold text-black/60 transition hover:bg-black/[.04]">Abrir negociação</Link> : <button type="button" onClick={() => onPlan(contract.id)} className="rounded border border-black/[.12] bg-white px-3 py-2 text-[0.6875rem] font-semibold text-black/60 transition hover:bg-black/[.04]">{plan ? "Editar plano" : "Planejar"}</button>}</div>
    </article>;
  })}</div>;
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) { return <div><p className="text-[0.625rem] font-medium text-black/30">{label}</p><p title={title} className="mt-1 truncate text-[0.75rem] font-semibold tabular-nums text-black/60">{value}</p></div>; }
function Empty({icon:Icon,title,copy}:{icon:any;title:string;copy:string}) { return <div className="py-16 text-center"><Icon size={22} className="mx-auto text-black/15"/><p className="mt-4 text-[0.875rem] font-semibold text-black/45">{title}</p><p className="mx-auto mt-2 max-w-md text-[0.75rem] leading-relaxed text-black/30">{copy}</p></div>; }

function QuickForm({contracts,projects,saving,onClose,onSubmit}:{contracts:Contract[];projects:Project[];saving:boolean;onClose:()=>void;onSubmit:(k:'commitment',d:Record<string,FormDataEntryValue>)=>void}) { return <form onSubmit={e=>{e.preventDefault();onSubmit('commitment',Object.fromEntries(new FormData(e.currentTarget)) as any)}} className="border-b bg-black/[.015] px-5 py-5 md:px-6" style={{borderColor:'rgba(13,13,13,.07)'}}><div className="mb-4 flex items-center justify-between"><p className="text-[0.8125rem] font-semibold text-black/65">Novo compromisso</p><button type="button" onClick={onClose} className="text-black/30 hover:text-black/55"><X size={14}/></button></div><div className="grid gap-3 md:grid-cols-2">
    <><Field name="titulo" placeholder="O que foi prometido?" required/><FieldSelect name="categoria" options={['marca_comunicacao','hospitalidade','relatorio','ativacao','conteudo','colaboradores','impacto','compliance','financeiro','outro']}/><Field name="prazo" type="date"/><FieldSelect name="contrato_id" options={contracts.map(c=>[c.id,c.titulo||c.numero||'Contrato'])}/><FieldSelect name="projeto_id" options={projects.map(p=>[p.id,p.nome])}/><Field name="observacoes" placeholder="Contexto ou evidência esperada"/></>
  </div><div className="mt-4 flex justify-end gap-3"><button type="button" onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button disabled={saving} className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40">{saving?'Salvando…':'Salvar'}</button></div></form>; }
function Field(props:any){return <input {...props} className="rounded border bg-white px-3 py-2.5 text-[0.75rem] outline-none focus:border-[#7259B5]" style={{borderColor:'rgba(13,13,13,.12)'}}/>} 
function FieldSelect({name,options}:{name:string;options:any[]}){return <Select name={name} className="rounded border bg-white px-3 py-2.5 text-[0.75rem] outline-none" style={{borderColor:'rgba(13,13,13,.12)'}}>{options.map((o:any)=>{const [v,l]=Array.isArray(o)?o:[o,o.replaceAll('_',' ')];return <option key={v} value={v}>{l}</option>})}</Select>}
