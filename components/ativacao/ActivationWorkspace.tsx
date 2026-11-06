"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, CalendarDays, Check, CheckCircle2, Circle, FileCheck2, FileText,
  Goal, Link2, Megaphone, Plus, Target, Users, WalletCards, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  AtivacaoAcao, AtivacaoEvidencia, AtivacaoObjetivo, AtivacaoOrcamentoItem,
  AtivacaoPublico, CompromissoCliente, PlanoAtivacaoResumo, StatusPlanoAtivacao,
} from "@/lib/supabase/types";
import { ACTIVATION_BUDGET_CATEGORIES, ACTIVATION_CHANNELS, ACTIVATION_STATUS } from "@/lib/ativacao/constants";
import { activationBudgetRatio, activationProgress, money, shortDate } from "@/lib/ativacao/metrics";
import { CompanyLogo } from "@/components/CompanyLogo";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { Select } from "@/components/ui/Select";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type Tab = "resumo" | "estrategia" | "acoes" | "orcamento" | "entregaveis" | "evidencias";
type Member = { user_id: string; full_name: string | null; email: string | null };
type TaskLink = { acao_id: string; atividade_id: string; atividade: { id: string; nome: string; feita: boolean; data_prevista: string | null; responsavel_id: string | null } | null };
type EvidenceRow = AtivacaoEvidencia & { documento: { nome: string; url: string; tipo: string | null } | null };

export function ActivationWorkspace({ planId }: { planId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [plan, setPlan] = useState<PlanoAtivacaoResumo | null>(null);
  const [publics, setPublics] = useState<AtivacaoPublico[]>([]);
  const [objectives, setObjectives] = useState<AtivacaoObjetivo[]>([]);
  const [actions, setActions] = useState<AtivacaoAcao[]>([]);
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [budget, setBudget] = useState<AtivacaoOrcamentoItem[]>([]);
  const [commitments, setCommitments] = useState<CompromissoCliente[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tab, setTab] = useState<Tab>("resumo");
  const [form, setForm] = useState<"publico" | "objetivo" | "acao" | "orcamento" | "entregavel" | "evidencia" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [actorId, setActorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const [p, pu, ob, ac, bu, co, ev, user] = await Promise.all([
      (supabase as any).from("vw_planos_ativacao_resumo").select("*").eq("id", planId).single(),
      (supabase as any).from("ativacao_publicos").select("*").eq("plano_id", planId).order("ordem"),
      (supabase as any).from("ativacao_objetivos").select("*").eq("plano_id", planId).order("created_at"),
      (supabase as any).from("ativacao_acoes").select("*").eq("plano_id", planId).order("ordem"),
      (supabase as any).from("ativacao_orcamento_itens").select("*").eq("plano_id", planId).order("ordem"),
      (supabase as any).from("compromissos_cliente").select("*").eq("plano_ativacao_id", planId).order("prazo", { ascending: true, nullsFirst: false }),
      (supabase as any).from("ativacao_evidencias").select("*,documento:documentos!documento_id(nome,url,tipo)").eq("plano_id", planId).order("created_at", { ascending: false }),
      supabase.auth.getUser(),
    ]);
    if (p.error || !p.data) { setError(p.error?.message ?? "Plano não encontrado."); setPlan(null); setLoading(false); return; }
    const planRow = p.data as PlanoAtivacaoResumo;
    setPlan(planRow); setPublics(pu.data ?? []); setObjectives(ob.data ?? []); setActions(ac.data ?? []);
    setBudget(bu.data ?? []); setCommitments(co.data ?? []); setEvidence(ev.data ?? []);
    const actionIds = (ac.data ?? []).map((item: AtivacaoAcao) => item.id);
    if (actionIds.length) {
      const links = await (supabase as any).from("ativacao_acao_atividades").select("acao_id,atividade_id,atividade:atividades!atividade_id(id,nome,feita,data_prevista,responsavel_id)").in("acao_id", actionIds);
      setTaskLinks(links.data ?? []);
    } else setTaskLinks([]);
    const userId = user.data.user?.id;
    setActorId(userId ?? null);
    if (userId) {
      const [role, memberRows] = await Promise.all([
        (supabase as any).from("organization_members").select("papel").eq("organization_id", planRow.organization_id).eq("user_id", userId).maybeSingle(),
        fetchOrganizationMembers(planRow.organization_id),
      ]);
      setCanWrite(["admin", "colaborador"].includes(role.data?.papel));
      setMembers(memberRows.filter(item => ["admin", "colaborador"].includes(item.papel)));
    }
    setError(pu.error?.message ?? ob.error?.message ?? ac.error?.message ?? bu.error?.message ?? co.error?.message ?? ev.error?.message ?? null);
    setLoading(false);
  }, [planId, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function updatePlanStatus(status: StatusPlanoAtivacao) {
    if (!plan) return;
    const previous = plan.status;
    setPlan({ ...plan, status });
    const { error: updateError } = await (supabase as any).from("planos_ativacao").update({ status }).eq("id", plan.id);
    if (updateError) { setPlan({ ...plan, status: previous }); setError(updateError.message); }
  }

  async function addSimple(kind: "publico" | "objetivo", values: Record<string, string>) {
    if (!plan || !actorId) return;
    setSaving(true); setError(null);
    const table = kind === "publico" ? "ativacao_publicos" : "ativacao_objetivos";
    const payload = kind === "publico"
      ? { organization_id: plan.organization_id, account_id: actorId, plano_id: plan.id, nome: values.nome, descricao: values.descricao || null, necessidade: values.necessidade || null, prioridade: values.prioridade || "primario" }
      : { organization_id: plan.organization_id, account_id: actorId, plano_id: plan.id, titulo: values.titulo, indicador: values.indicador || null, unidade: values.unidade || null, meta: values.meta ? Number(values.meta) : null, prazo: values.prazo || null };
    const { error: insertError } = await (supabase as any).from(table).insert(payload);
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm(null); await load();
  }

  async function addAction(values: Record<string, string>) {
    if (!plan || !actorId) return;
    setSaving(true); setError(null);
    const accountId = actorId;
    const { data: action, error: actionError } = await (supabase as any).from("ativacao_acoes").insert({
      organization_id: plan.organization_id, account_id: accountId, plano_id: plan.id,
      objetivo_id: values.objetivo_id || null, titulo: values.titulo, descricao: values.descricao || null,
      canal: values.canal || null, responsavel_id: values.responsavel_id || null,
      data_inicio: values.data_inicio || null, data_fim: values.data_fim || null,
      status: "nao_iniciada", valor_planejado: values.valor_planejado ? Number(values.valor_planejado) : 0,
    }).select("id").single();
    if (actionError) { setSaving(false); setError(actionError.message); return; }
    const { data: activity, error: activityError } = await (supabase as any).from("atividades").insert({
      account_id: accountId, organization_id: plan.organization_id, empresa_crm_id: plan.empresa_crm_id,
      projeto_id: plan.projeto_id, captacao_id: plan.captacao_id, conta_patrocinio_id: plan.conta_patrocinio_id,
      contrato_id: plan.contrato_id, responsavel_id: values.responsavel_id || null, nome: values.titulo,
      tipo: values.canal === "evento" ? "evento" : "outro", prioridade: "media", data_inicio: values.data_inicio || null,
      data_prevista: values.data_fim || values.data_inicio || null, feita: false, nota: values.descricao || null,
      calendar_sync_requested: false,
    }).select("id").single();
    if (activityError) {
      await (supabase as any).from("ativacao_acoes").delete().eq("id", action.id);
      setSaving(false); setError(activityError.message); return;
    }
    const { error: linkError } = await (supabase as any).from("ativacao_acao_atividades").insert({ organization_id: plan.organization_id, account_id: accountId, acao_id: action.id, atividade_id: activity.id });
    if (linkError) {
      await (supabase as any).from("atividades").delete().eq("id", activity.id);
      await (supabase as any).from("ativacao_acoes").delete().eq("id", action.id);
      setSaving(false); setError(linkError.message); return;
    }
    if (values.valor_planejado && Number(values.valor_planejado) > 0) {
      await (supabase as any).from("ativacao_orcamento_itens").insert({ organization_id: plan.organization_id, account_id: accountId, plano_id: plan.id, acao_id: action.id, categoria: "Outro", descricao: values.titulo, valor_planejado: Number(values.valor_planejado), valor_realizado: 0, pagador: "patrocinador", status: "previsto" });
    }
    setSaving(false); setForm(null); await load();
  }

  async function toggleAction(action: AtivacaoAcao) {
    const complete = action.status !== "concluida";
    setActions(rows => rows.map(item => item.id === action.id ? { ...item, status: complete ? "concluida" : "em_andamento" } : item));
    const { error: updateError } = await (supabase as any).from("ativacao_acoes").update({ status: complete ? "concluida" : "em_andamento" }).eq("id", action.id);
    if (updateError) { setError(updateError.message); await load(); return; }
    for (const link of taskLinks.filter(item => item.acao_id === action.id)) {
      await (supabase as any).rpc("fn_set_atividade_concluida", { p_atividade_id: link.atividade_id, p_feita: complete, p_data_realizada: complete ? new Date().toISOString() : null });
    }
    await load();
  }

  async function addBudget(values: Record<string, string>) {
    if (!plan || !actorId) return;
    setSaving(true); setError(null);
    const { error: insertError } = await (supabase as any).from("ativacao_orcamento_itens").insert({
      organization_id: plan.organization_id, account_id: actorId, plano_id: plan.id,
      acao_id: values.acao_id || null, categoria: values.categoria || "Outro", descricao: values.descricao,
      pagador: values.pagador || "patrocinador", valor_planejado: Number(values.valor_planejado || 0),
      valor_realizado: Number(values.valor_realizado || 0), status: values.status || "previsto",
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm(null); await load();
  }

  async function addCommitment(values: Record<string, string>) {
    if (!plan || !actorId) return;
    setSaving(true); setError(null);
    const { error: insertError } = await (supabase as any).from("compromissos_cliente").insert({
      organization_id: plan.organization_id,
      account_id: actorId,
      conta_patrocinio_id: plan.conta_patrocinio_id,
      contrato_id: plan.contrato_id,
      projeto_id: plan.projeto_id,
      plano_ativacao_id: plan.id,
      acao_ativacao_id: values.acao_ativacao_id || null,
      cota_id: plan.cota_id,
      titulo: values.titulo,
      categoria: values.categoria || "ativacao",
      prazo: values.prazo || null,
      responsavel_id: values.responsavel_id || null,
      status: "pendente",
      evidencia_obrigatoria: values.evidencia_obrigatoria === "true",
      origem: "manual",
      observacoes: values.observacoes || null,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setForm(null); await load();
  }

  async function updateCommitment(item: CompromissoCliente) {
    const next = item.status === "pendente" ? "em_andamento" : item.status === "em_andamento" ? "entregue" : item.status === "entregue" ? "aprovado" : "pendente";
    if (next === "aprovado" && item.evidencia_obrigatoria && !evidence.some(row => row.compromisso_id === item.id)) {
      setError("Adicione uma evidência antes de aprovar este entregável."); setTab("evidencias"); setForm("evidencia"); return;
    }
    const { error: updateError } = await (supabase as any).from("compromissos_cliente").update({ status: next, aprovado_em: next === "aprovado" ? new Date().toISOString() : null }).eq("id", item.id);
    if (updateError) setError(updateError.message); else await load();
  }

  async function addEvidence(values: Record<string, string>, file: File | null) {
    if (!plan || !actorId || (!file && !values.url_externa)) return;
    setSaving(true); setError(null);
    const accountId = actorId;
    let documentId: string | null = null;
    let storagePath: string | null = null;
    if (file) {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
      storagePath = `${plan.organization_id}/ativacoes/${plan.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await supabase.storage.from("documentos").upload(storagePath, file, { upsert: false });
      if (upload.error) { setSaving(false); setError(upload.error.message); return; }
      const doc = await (supabase as any).from("documentos").insert({
        account_id: accountId, organization_id: plan.organization_id, captacao_id: plan.captacao_id,
        projeto_id: plan.projeto_id, conta_patrocinio_id: plan.conta_patrocinio_id, contrato_id: plan.contrato_id,
        plano_ativacao_id: plan.id, nome: values.titulo || file.name, tipo: file.type, tamanho: file.size, url: storagePath,
      }).select("id").single();
      if (doc.error) { await supabase.storage.from("documentos").remove([storagePath]); setSaving(false); setError(doc.error.message); return; }
      documentId = doc.data.id;
    }
    const { error: insertError } = await (supabase as any).from("ativacao_evidencias").insert({
      organization_id: plan.organization_id, account_id: accountId, plano_id: plan.id,
      acao_id: values.acao_id || null, compromisso_id: values.compromisso_id || null, documento_id: documentId,
      tipo: file ? (file.type.startsWith("image/") ? "imagem" : "arquivo") : "link",
      url_externa: values.url_externa || null, titulo: values.titulo || file?.name || "Evidência",
      descricao: values.descricao || null, status: "enviada",
    });
    if (insertError) {
      if (documentId) await (supabase as any).from("documentos").delete().eq("id", documentId);
      if (storagePath) await supabase.storage.from("documentos").remove([storagePath]);
      setSaving(false); setError(insertError.message); return;
    }
    setSaving(false); setForm(null); await load();
  }

  async function approveEvidence(item: EvidenceRow) {
    const user = await supabase.auth.getUser();
    const { error: updateError } = await (supabase as any).from("ativacao_evidencias").update({ status: item.status === "aprovada" ? "enviada" : "aprovada", aprovada_por: item.status === "aprovada" ? null : user.data.user?.id, aprovada_em: item.status === "aprovada" ? null : new Date().toISOString() }).eq("id", item.id);
    if (updateError) setError(updateError.message); else await load();
  }

  async function openEvidence(item: EvidenceRow) {
    if (item.documento?.url) {
      const { data } = await supabase.storage.from("documentos").createSignedUrl(item.documento.url, 300);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } else if (item.url_externa) window.open(item.url_externa, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div className="p-8"><div className="h-8 w-72 animate-pulse rounded bg-black/[.06]"/><div className="mt-8 h-96 animate-pulse rounded bg-black/[.04]"/></div>;
  if (!plan) return <div className="p-8 text-center"><p className="text-sm text-black/40">{error || "Plano não encontrado."}</p><Link href="/contas-patrocinio" className="mt-4 inline-flex text-xs font-medium text-[#7259B5]">Voltar</Link></div>;

  const progress = activationProgress(plan);
  const ratio = activationBudgetRatio(plan);
  const statusMeta = ACTIVATION_STATUS[plan.status];
  const overdue = commitments.filter(item => item.prazo && item.prazo < new Date().toISOString().slice(0, 10) && !["entregue","aprovado","cancelado"].includes(item.status));

  return <div className="min-h-full">
    <header className="border-b px-4 pb-6 pt-6 md:px-8 md:pt-8" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <Link href={`/contas-patrocinio/${plan.conta_patrocinio_id}`} className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-black/35 hover:text-black/60"><ArrowLeft size={12}/>Voltar para a parceria</Link>
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 items-center gap-4"><CompanyLogo nome={plan.empresa_nome} domain={plan.empresa_domain_key} site={plan.empresa_site} size={48} className="rounded"/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-[1.5625rem] font-semibold tracking-[-.03em] text-[#282525]">{plan.nome}</h1><span className="rounded px-2 py-1 text-[0.5625rem] font-semibold text-white" style={{ background: statusMeta.color }}>{statusMeta.label}</span></div><p className="mt-1 text-[0.75rem] text-black/40">{plan.empresa_nome} · <Link href={`/projetos/${plan.projeto_id}`} className="text-[#7259B5] hover:underline">{plan.projeto_nome}</Link>{plan.cota_nome ? ` · ${plan.cota_nome}` : ""}</p></div></div>
        <div className="flex flex-wrap items-center gap-3"><div><p className="text-[0.625rem] text-black/30">Progresso</p><p className="mt-1 text-[1.25rem] font-semibold text-black/70">{progress}%</p></div>{canWrite && <Select value={plan.status} onChange={event => void updatePlanStatus(event.target.value as StatusPlanoAtivacao)} className="h-10 rounded border bg-white px-3 text-[0.6875rem] font-medium outline-none" style={{ borderColor: "rgba(13,13,13,.12)", color: statusMeta.color }}>{Object.entries(ACTIVATION_STATUS).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</Select>}</div>
      </div>
    </header>

    <nav className="overflow-x-auto border-b px-4 md:px-8" style={{ borderColor: "rgba(13,13,13,.06)" }}><div className="flex min-w-max gap-6">{([['resumo','Resumo',Megaphone],['estrategia','Estratégia',Target],['acoes','Ações',CalendarDays],['orcamento','Orçamento',WalletCards],['entregaveis','Entregáveis',FileCheck2],['evidencias','Evidências',FileText]] as const).map(([value,label,Icon]) => <button key={value} onClick={() => setTab(value)} className="relative flex h-12 items-center gap-1.5 text-[0.75rem] font-medium" style={{ color: tab === value ? "#7259B5" : "rgba(13,13,13,.4)" }}><Icon size={12}/>{label}{tab === value && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#7259B5]"/>}</button>)}</div></nav>

    <main className="mx-auto w-full max-w-pagina px-4 py-6 md:px-8 md:py-8">
      {error && <div className="mb-4 flex items-start justify-between gap-3 rounded border border-[#D94E4E]/25 px-3 py-2 text-[0.6875rem] text-[#D94E4E]" role="alert"><span>{error}</span><button onClick={() => setError(null)}><X size={12}/></button></div>}
      {tab === "resumo" && <Overview plan={plan} progress={progress} ratio={ratio} overdue={overdue.length} actions={actions} commitments={commitments}/>} 
      {tab === "estrategia" && <Strategy publics={publics} objectives={objectives} canWrite={canWrite} onAdd={setForm}/>} 
      {tab === "acoes" && <Actions actions={actions} taskLinks={taskLinks} canWrite={canWrite} onAdd={() => setForm("acao")} onToggle={toggleAction}/>} 
      {tab === "orcamento" && <Budget items={budget} canWrite={canWrite} onAdd={() => setForm("orcamento")} plan={plan}/>} 
      {tab === "entregaveis" && <Commitments items={commitments} canWrite={canWrite} evidence={evidence} onAdd={() => setForm("entregavel")} onAdvance={updateCommitment}/>} 
      {tab === "evidencias" && <Evidence items={evidence} canWrite={canWrite} onAdd={() => setForm("evidencia")} onOpen={openEvidence} onApprove={approveEvidence}/>} 
    </main>

    {form === "publico" && <SimpleForm title="Novo público" saving={saving} fields={[{name:"nome",label:"Público",required:true},{name:"descricao",label:"Descrição"},{name:"necessidade",label:"Necessidade"},{name:"prioridade",label:"Prioridade",type:"select",options:[["primario","Primário"],["secundario","Secundário"]]}]} onClose={() => setForm(null)} onSubmit={values => void addSimple("publico", values)}/>} 
    {form === "objetivo" && <SimpleForm title="Novo objetivo" saving={saving} fields={[{name:"titulo",label:"Objetivo",required:true},{name:"indicador",label:"Indicador"},{name:"unidade",label:"Unidade"},{name:"meta",label:"Meta",type:"number"},{name:"prazo",label:"Prazo",type:"date"}]} onClose={() => setForm(null)} onSubmit={values => void addSimple("objetivo", values)}/>} 
    {form === "acao" && <SimpleForm title="Nova ação" saving={saving} fields={[{name:"titulo",label:"Ação",required:true},{name:"descricao",label:"Descrição"},{name:"objetivo_id",label:"Objetivo",type:"select",options:objectives.map(item=>[item.id,item.titulo])},{name:"canal",label:"Canal",type:"select",options:[...ACTIVATION_CHANNELS]},{name:"responsavel_id",label:"Responsável",type:"select",options:members.map(item=>[item.user_id,item.full_name||item.email||"Membro"])},{name:"data_inicio",label:"Início",type:"date"},{name:"data_fim",label:"Término",type:"date"},{name:"valor_planejado",label:"Verba planejada",type:"number"}]} onClose={() => setForm(null)} onSubmit={values => void addAction(values)}/>} 
    {form === "orcamento" && <SimpleForm title="Novo item de orçamento" saving={saving} fields={[{name:"descricao",label:"Descrição",required:true},{name:"categoria",label:"Categoria",type:"select",options:ACTIVATION_BUDGET_CATEGORIES.map(item=>[item,item])},{name:"acao_id",label:"Ação",type:"select",options:actions.map(item=>[item.id,item.titulo])},{name:"pagador",label:"Pagador",type:"select",options:[["patrocinador","Patrocinador"],["proponente","Proponente"],["compartilhado","Compartilhado"],["terceiro","Terceiro"]]},{name:"valor_planejado",label:"Planejado",type:"number",required:true},{name:"valor_realizado",label:"Realizado",type:"number"},{name:"status",label:"Status",type:"select",options:[["previsto","Previsto"],["aprovado","Aprovado"],["comprometido","Comprometido"],["pago","Pago"]]}]} onClose={() => setForm(null)} onSubmit={values => void addBudget(values)}/>} 
    {form === "entregavel" && <SimpleForm title="Novo entregável" saving={saving} fields={[{name:"titulo",label:"Entregável",required:true},{name:"categoria",label:"Categoria",type:"select",options:[["marca_comunicacao","Marca e comunicação"],["hospitalidade","Hospitalidade"],["relatorio","Relatório"],["ativacao","Ativação"],["conteudo","Conteúdo"],["colaboradores","Colaboradores"],["impacto","Impacto"],["compliance","Compliance"],["financeiro","Financeiro"],["outro","Outro"]]},{name:"acao_ativacao_id",label:"Ação vinculada",type:"select",options:actions.map(item=>[item.id,item.titulo])},{name:"responsavel_id",label:"Responsável",type:"select",options:members.map(item=>[item.user_id,item.full_name||item.email||"Membro"])},{name:"prazo",label:"Prazo",type:"date"},{name:"evidencia_obrigatoria",label:"Exigir evidência",type:"select",options:[["true","Sim"],["false","Não"]]},{name:"observacoes",label:"Observações"}]} onClose={() => setForm(null)} onSubmit={values => void addCommitment(values)}/>} 
    {form === "evidencia" && <EvidenceForm saving={saving} actions={actions} commitments={commitments} onClose={() => setForm(null)} onSubmit={(values,file) => void addEvidence(values,file)}/>} 
  </div>;
}

function Overview({ plan, progress, ratio, overdue, actions, commitments }: { plan: PlanoAtivacaoResumo; progress: number; ratio: number | null; overdue: number; actions: AtivacaoAcao[]; commitments: CompromissoCliente[] }) {
  const next = [...actions].filter(item => item.data_fim && !["concluida","cancelada"].includes(item.status)).sort((a,b) => String(a.data_fim).localeCompare(String(b.data_fim)))[0];
  return <div className="space-y-6"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Progresso" value={`${progress}%`} vazio={!progress}/><MoneyMetric label="Verba planejada" value={plan.orcamento_planejado}/><MoneyMetric label="Verba realizada" value={plan.orcamento_realizado}/><Metric label="Entregas vencidas" value={String(overdue)} vazio={!overdue} alerta={overdue > 0}/></div><div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><section className="rounded border bg-white p-5" style={{borderColor:"rgba(13,13,13,.08)"}}><div className="flex items-center justify-between"><div><p className="text-[0.6875rem] text-black/35">Execução consolidada</p><h2 className="mt-1 text-[1.125rem] font-semibold text-black/75">Plano em números</h2></div><span className="text-[1.5rem] font-semibold tabular-nums text-[#282525]">{progress}%</span></div><div className="mt-4 h-2 overflow-hidden rounded bg-black/[.06]"><div className="h-full rounded bg-[#282525]/70" style={{width:`${progress}%`}}/></div><div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4" style={{borderColor:"rgba(13,13,13,.06)"}}><Mini label="Ações" value={`${plan.acoes_concluidas}/${plan.acoes_total}`}/><Mini label="Tarefas" value={`${plan.tarefas_concluidas}/${plan.tarefas_total}`}/><Mini label="Evidências" value={`${plan.evidencias_aprovadas}/${plan.evidencias_total}`}/></div>{ratio != null && <p className="mt-4 text-[0.6875rem] text-black/35">Verba de ativação planejada equivale a {(ratio*100).toFixed(0)}% do valor do direito. Indicador informativo, sem meta universal.</p>}</section><section className="rounded bg-black/[.025] p-5"><p className="text-[0.6875rem] text-black/35">Próximo marco</p>{next ? <><p className="mt-4 text-[1rem] font-semibold text-black/70">{next.titulo}</p><p className="mt-2 text-[0.75rem] text-black/40">{shortDate(next.data_fim)}</p></> : <p className="mt-4 text-[0.8125rem] text-black/35">Nenhuma ação futura programada.</p>}<div className="mt-6 border-t pt-4" style={{borderColor:"rgba(13,13,13,.06)"}}><Mini label="Direito contratado" value={formatarValorCurto(plan.valor_direito_snapshot)} title={formatarValorCompleto(plan.valor_direito_snapshot)}/><Mini label="Período" value={`${shortDate(plan.data_inicio)} — ${shortDate(plan.data_fim)}`}/><Mini label="Entregáveis" value={`${commitments.filter(i=>i.status==='aprovado').length}/${commitments.length}`}/></div></section></div></div>;
}

function Strategy({ publics, objectives, canWrite, onAdd }: { publics: AtivacaoPublico[]; objectives: AtivacaoObjetivo[]; canWrite: boolean; onAdd: (value: "publico" | "objetivo") => void }) { return <div className="grid gap-5 xl:grid-cols-2"><ListSection icon={Users} title="Públicos" action={canWrite ? () => onAdd("publico") : undefined}>{publics.length ? publics.map(item => <article key={item.id} className="border-b py-4 last:border-0" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex items-center justify-between gap-3"><p className="text-[0.8125rem] font-semibold text-black/70">{item.nome}</p><span className="text-[0.625rem] font-medium text-black/45">{item.prioridade === "primario" ? "Primário" : "Secundário"}</span></div>{item.descricao && <p className="mt-2 text-[0.75rem] leading-5 text-black/40">{item.descricao}</p>}{item.necessidade && <p className="mt-2 text-[0.6875rem] text-black/30">Necessidade: {item.necessidade}</p>}</article>) : <Empty text="Nenhum público definido."/>}</ListSection><ListSection icon={Goal} title="Objetivos" action={canWrite ? () => onAdd("objetivo") : undefined}>{objectives.length ? objectives.map(item => <article key={item.id} className="border-b py-4 last:border-0" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex items-center justify-between gap-3"><p className="text-[0.8125rem] font-semibold text-black/70">{item.titulo}</p><span className="text-[0.625rem] text-black/35">{item.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-[0.6875rem] text-black/35">{item.indicador || "Indicador a definir"}{item.meta != null ? ` · meta ${item.meta}${item.unidade ? ` ${item.unidade}` : ""}` : ""}</p></article>) : <Empty text="Nenhum objetivo definido."/>}</ListSection></div>; }

function Actions({ actions, taskLinks, canWrite, onAdd, onToggle }: { actions: AtivacaoAcao[]; taskLinks: TaskLink[]; canWrite: boolean; onAdd: () => void; onToggle: (item: AtivacaoAcao) => void }) { return <ListSection icon={CalendarDays} title="Ações de ativação" action={canWrite ? onAdd : undefined}>{actions.length ? <div className="divide-y divide-black/[.06]">{actions.map(item => { const tasks=taskLinks.filter(link=>link.acao_id===item.id); const done=item.status==='concluida'; return <article key={item.id} className="flex items-start gap-3 py-4"><button disabled={!canWrite} onClick={()=>onToggle(item)} className="mt-0.5 text-black/20 hover:text-black/55 disabled:cursor-default">{done?<CheckCircle2 size={19} className="text-black/55"/>:<Circle size={19}/>}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className={`text-[0.8125rem] font-semibold ${done?'text-black/30 line-through':'text-black/70'}`}>{item.titulo}</p>{item.canal&&<span className="rounded bg-black/[.04] px-2 py-0.5 text-[0.5625rem] text-black/35">{item.canal.replaceAll('_',' ')}</span>}</div>{item.descricao&&<p className="mt-1 text-[0.6875rem] text-black/35">{item.descricao}</p>}<p className="mt-2 text-[0.625rem] text-black/25">{tasks.length} tarefa{tasks.length===1?'':'s'} · {shortDate(item.data_inicio)} — {shortDate(item.data_fim)}</p></div><span className="text-[0.6875rem] font-medium text-black/45">{money(item.valor_planejado)}</span></article>})}</div> : <Empty text="Nenhuma ação criada."/>}</ListSection>; }

function Budget({ items, canWrite, onAdd, plan }: { items: AtivacaoOrcamentoItem[]; canWrite: boolean; onAdd: () => void; plan: PlanoAtivacaoResumo }) { return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MoneyMetric label="Direito adquirido" value={plan.valor_direito_snapshot}/><MoneyMetric label="Ativação planejada" value={items.filter(i=>i.status!=='cancelado').reduce((s,i)=>s+i.valor_planejado,0)}/><MoneyMetric label="Ativação realizada" value={items.filter(i=>i.status!=='cancelado').reduce((s,i)=>s+i.valor_realizado,0)}/></div><ListSection icon={WalletCards} title="Itens de ativação" action={canWrite ? onAdd : undefined}>{items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[47.5rem] text-left"><thead><tr className="border-b" style={{borderColor:"rgba(13,13,13,.07)"}}>{["Item","Categoria","Pagador","Planejado","Realizado","Status"].map(label=><th key={label} className="px-3 py-3 text-[0.625rem] font-medium text-black/30">{label}</th>)}</tr></thead><tbody>{items.map(item=><tr key={item.id} className="border-b last:border-0" style={{borderColor:"rgba(13,13,13,.05)"}}><td className="px-3 py-3 text-[0.75rem] font-medium text-black/65">{item.descricao}</td><td className="px-3 py-3 text-[0.6875rem] text-black/40">{item.categoria}</td><td className="px-3 py-3 text-[0.6875rem] text-black/40">{item.pagador}</td><td className="px-3 py-3 text-[0.6875rem] font-medium text-black/55">{money(item.valor_planejado)}</td><td className="px-3 py-3 text-[0.6875rem] font-medium text-black/55">{money(item.valor_realizado)}</td><td className="px-3 py-3 text-[0.625rem] text-black/45">{item.status}</td></tr>)}</tbody></table></div> : <Empty text="Nenhum item de ativação."/>}</ListSection></div>; }

function Commitments({ items, canWrite, evidence, onAdd, onAdvance }: { items: CompromissoCliente[]; canWrite: boolean; evidence: EvidenceRow[]; onAdd: () => void; onAdvance: (item: CompromissoCliente) => void }) { return <ListSection icon={FileCheck2} title="Direitos e entregáveis" action={canWrite ? onAdd : undefined}>{items.length ? <div className="divide-y divide-black/[.06]">{items.map(item => { const proofs=evidence.filter(row=>row.compromisso_id===item.id).length; return <article key={item.id} className="flex items-start gap-3 py-4"><button disabled={!canWrite} onClick={()=>onAdvance(item)} className="mt-0.5 text-black/20 hover:text-black/55 disabled:cursor-default">{item.status==='aprovado'?<CheckCircle2 size={19} className="text-black/55"/>:<Circle size={19}/>}</button><div className="min-w-0 flex-1"><p className="text-[0.8125rem] font-semibold text-black/70">{item.titulo}</p><p className="mt-1 text-[0.625rem] text-black/30">{item.origem} · {item.categoria.replaceAll('_',' ')} · {proofs} evidência{proofs===1?'':'s'}</p></div><div className="text-right"><p className="text-[0.625rem] font-medium text-black/45">{item.status.replaceAll('_',' ')}</p><p className="mt-1 text-[0.625rem] text-black/30">{shortDate(item.prazo)}</p></div></article>})}</div> : <Empty text="Nenhum entregável importado ou registrado."/>}</ListSection>; }

function Evidence({ items, canWrite, onAdd, onOpen, onApprove }: { items: EvidenceRow[]; canWrite: boolean; onAdd: () => void; onOpen: (item: EvidenceRow) => void; onApprove: (item: EvidenceRow) => void }) { return <ListSection icon={FileText} title="Evidências" action={canWrite ? onAdd : undefined}>{items.length ? <div className="grid gap-3 md:grid-cols-2">{items.map(item=><article key={item.id} className="rounded border p-4" style={{borderColor:"rgba(13,13,13,.08)"}}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[0.8125rem] font-semibold text-black/70">{item.titulo}</p><p className="mt-1 text-[0.625rem] text-black/30">{item.tipo} · {new Date(item.capturada_em).toLocaleDateString('pt-BR')}</p></div><span className="text-[0.625rem] font-medium text-black/45">{item.status}</span></div>{item.descricao&&<p className="mt-3 text-[0.6875rem] leading-5 text-black/40">{item.descricao}</p>}<div className="mt-4 flex items-center gap-3"><button onClick={()=>onOpen(item)} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-[#7259B5]"><Link2 size={10}/>Visualizar</button>{canWrite&&<button onClick={()=>onApprove(item)} className="inline-flex items-center gap-1 text-[0.625rem] font-medium text-black/40"><Check size={10}/>{item.status==='aprovada'?'Reabrir':'Aprovar'}</button>}</div></article>)}</div> : <Empty text="Nenhuma evidência adicionada."/>}</ListSection>; }

function ListSection({ icon: Icon, title, action, children }: { icon: typeof Users; title: string; action?: () => void; children: React.ReactNode }) { return <section className="overflow-hidden rounded border bg-white" style={{borderColor:"rgba(13,13,13,.08)"}}><header className="flex items-center justify-between border-b px-5 py-4" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex items-center gap-2"><Icon size={14} className="text-[#7259B5]"/><h2 className="text-[0.875rem] font-semibold text-black/70">{title}</h2></div>{action&&<button onClick={action} className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[#7259B5]"><Plus size={11}/>Adicionar</button>}</header><div className="px-5">{children}</div></section>; }
function Metric({label,value,title,vazio=false,alerta=false}:{label:string;value:string;title?:string;vazio?:boolean;alerta?:boolean}){return <div className="rounded bg-black/[.025] px-4 py-4"><p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{alerta&&<AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]"/>}{label}</p><p title={title} className={`mt-2 truncate text-[1.25rem] font-semibold tracking-[-.02em] tabular-nums ${vazio?'text-black/30':'text-[#282525]'}`}>{value}</p></div>}
function MoneyMetric({label,value}:{label:string;value:number|null|undefined}){return <Metric label={label} value={formatarValorCurto(value)} title={formatarValorCompleto(value)} vazio={!value}/>}
function Mini({label,value,title}:{label:string;value:string;title?:string}){return <div><p className="text-[0.5625rem] text-black/25">{label}</p><p title={title} className="mt-1 text-[0.6875rem] font-medium text-black/55">{value}</p></div>}
function Empty({text}:{text:string}){return <div className="py-14 text-center"><p className="text-[0.75rem] text-black/30">{text}</p></div>}

type FieldDef = { name: string; label: string; required?: boolean; type?: string; options?: ReadonlyArray<readonly [string,string]> };
function SimpleForm({ title, fields, saving, onClose, onSubmit }: { title: string; fields: FieldDef[]; saving: boolean; onClose: () => void; onSubmit: (values: Record<string,string>) => void }) { return <Modal title={title} onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSubmit(Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>)}}><div className="grid gap-4 sm:grid-cols-2">{fields.map(field=><FormField key={field.name} field={field}/>)}</div><ModalFooter saving={saving} onClose={onClose}/></form></Modal>; }
function FormField({field}:{field:FieldDef}){return <label><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">{field.label}{field.required&&<span className="text-[#D94E4E]"> *</span>}</span>{field.type==='select'?<Select name={field.name} required={field.required} className="h-10 w-full rounded border bg-white px-3 text-[0.75rem] outline-none" style={{borderColor:'rgba(13,13,13,.13)'}}><option value="">Selecionar</option>{field.options?.map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select>:<input name={field.name} type={field.type||'text'} required={field.required} min={field.type==='number'?'0':undefined} step={field.type==='number'?'0.01':undefined} className="h-10 w-full rounded border bg-white px-3 text-[0.75rem] outline-none" style={{borderColor:'rgba(13,13,13,.13)'}}/>}</label>}
function EvidenceForm({saving,actions,commitments,onClose,onSubmit}:{saving:boolean;actions:AtivacaoAcao[];commitments:CompromissoCliente[];onClose:()=>void;onSubmit:(values:Record<string,string>,file:File|null)=>void}){const fileRef=useRef<HTMLInputElement>(null);return <Modal title="Nova evidência" onClose={onClose}><form onSubmit={event=>{event.preventDefault();onSubmit(Object.fromEntries(new FormData(event.currentTarget)) as Record<string,string>,fileRef.current?.files?.[0]??null)}}><div className="grid gap-4 sm:grid-cols-2"><FormField field={{name:'titulo',label:'Título',required:true}}/><FormField field={{name:'acao_id',label:'Ação',type:'select',options:actions.map(i=>[i.id,i.titulo])}}/><FormField field={{name:'compromisso_id',label:'Entregável',type:'select',options:commitments.map(i=>[i.id,i.titulo])}}/><FormField field={{name:'url_externa',label:'Link externo'}}/><label className="sm:col-span-2"><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Arquivo</span><input ref={fileRef} type="file" className="w-full rounded border p-3 text-[0.6875rem] text-black/50" style={{borderColor:'rgba(13,13,13,.13)'}}/></label><label className="sm:col-span-2"><span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Descrição</span><textarea name="descricao" rows={3} className="w-full resize-none rounded border p-3 text-[0.75rem] outline-none" style={{borderColor:'rgba(13,13,13,.13)'}}/></label></div><ModalFooter saving={saving} onClose={onClose}/></form></Modal>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full overflow-y-auto rounded-t bg-white sm:max-w-[41.25rem] sm:rounded border elevacao-3"><header className="flex items-center justify-between border-b px-5 py-4" style={{borderColor:'rgba(13,13,13,.07)'}}><h2 className="text-[1.0625rem] font-semibold text-black/75">{title}</h2><button onClick={onClose} className="text-black/30 hover:text-black/55"><X size={15}/></button></header><div className="p-5">{children}</div></div></div>}
function ModalFooter({saving,onClose}:{saving:boolean;onClose:()=>void}){return <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button disabled={saving} className="h-10 rounded-xl bg-[#2E8932] px-4 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40">{saving?'Salvando…':'Salvar'}</button></div>}
