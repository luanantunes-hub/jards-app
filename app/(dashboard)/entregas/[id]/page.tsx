"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, Check, Circle, CircleCheck, CircleDot, Clock, Clock3, Download,
  FileCheck2, FileText, FolderKanban, History, Link2, Paperclip, Pencil,
  Play, Plus, ShieldCheck, Trash2, TriangleAlert, Upload, UserRound, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound } from "@/components/ui/DetailPagePrimitives";
import { excluirDocumento } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { Select } from "@/components/ui/Select";
import StatusBadge from "@/components/ui/StatusBadge";
import type { CompromissoCliente } from "@/lib/supabase/types";

type Account = { id: string; nome: string | null; empresa_crm_id: string; empresa_crm: { nome: string; domain_key: string | null; site: string | null } | null };
type Project = { id: string; nome: string };
type Contract = { id: string; titulo: string | null; numero: string | null };
type Member = { user_id: string; full_name: string | null; email: string | null; papel: string };
type DocumentRow = { id: string; nome: string; arquivo_nome: string | null; tipo: string | null; tamanho: number | null; url: string; created_at: string };
type ActivityRow = { id: string; nome: string; feita: boolean; data_prevista: string | null; data_realizada: string | null; responsavel: { full_name: string | null } | null };
type DeliveryStatus = CompromissoCliente["status"];

const STATUS_OPTIONS = [["pendente","Pendente"],["em_andamento","Em andamento"],["entregue","Entregue"],["aprovado","Aprovada"],["atrasado","Atrasada"],["cancelado","Cancelada"]] as const;
const STATUS_META: Record<DeliveryStatus, { label: string; color: string; icon: string }> = {
  pendente: { label: "Pendente", color: "#777777", icon: "Clock3" },
  em_andamento: { label: "Em andamento", color: "#2D72B0", icon: "Play" },
  entregue: { label: "Entregue", color: "#B07A14", icon: "PackageCheck" },
  aprovado: { label: "Aprovada", color: "#2E8932", icon: "BadgeCheck" },
  atrasado: { label: "Atrasada", color: "#D94E4E", icon: "AlertTriangle" },
  cancelado: { label: "Cancelada", color: "#777777", icon: "X" },
};
const CATEGORY_OPTIONS = [["marca_comunicacao","Marca e comunicação"],["hospitalidade","Hospitalidade"],["relatorio","Relatório"],["ativacao","Evento ou ação"],["conteudo","Conteúdo"],["colaboradores","Colaboradores"],["impacto","Impacto"],["compliance","Compliance"],["financeiro","Financeiro"],["outro","Outro"]] as const;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export default function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [delivery, setDelivery] = useState<CompromissoCliente | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [actorId, setActorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (supabase as any).from("compromissos_cliente").select("*").eq("id", id).single();
      if (result.error || !result.data) throw result.error ?? new Error("Entrega não encontrada.");
      const row = result.data as CompromissoCliente;
      setDelivery(row);
      const [accountResult, projectResult, contractResult, documentResult, activityResult, memberRows, userResult] = await Promise.all([
        (supabase as any).from("contas_patrocinio").select("id,nome,empresa_crm_id,empresa_crm:empresas_crm!empresa_crm_id(nome,domain_key,site)").eq("id", row.conta_patrocinio_id).single(),
        row.projeto_id ? (supabase as any).from("projetos_crm").select("id,nome").eq("id", row.projeto_id).maybeSingle() : Promise.resolve({ data: null }),
        row.contrato_id ? (supabase as any).from("contratos").select("id,titulo,numero").eq("id", row.contrato_id).maybeSingle() : Promise.resolve({ data: null }),
        (supabase as any).from("documentos").select("id,nome,arquivo_nome,tipo,tamanho,url,created_at").eq("compromisso_id", id).order("created_at", { ascending: false }),
        (supabase as any).from("atividades").select("id,nome,feita,data_prevista,data_realizada,responsavel:profiles!responsavel_id(full_name)").eq("compromisso_id", id).order("data_prevista", { ascending: true, nullsFirst: false }),
        fetchOrganizationMembers(row.organization_id),
        supabase.auth.getUser(),
      ]);
      setAccount(accountResult.data as Account | null);
      setProject(projectResult.data as Project | null);
      setContract(contractResult.data as Contract | null);
      setDocuments((documentResult.data ?? []) as DocumentRow[]);
      setActivities((activityResult.data ?? []) as ActivityRow[]);
      setMembers(memberRows as Member[]);
      const userId = userResult.data.user?.id ?? null;
      setActorId(userId);
      setCanWrite(Boolean(userId && memberRows.some(member => member.user_id === userId && ["admin", "colaborador"].includes(member.papel))));
      if (documentResult.error && documentResult.error.message.includes("compromisso_id")) setError("Execute a migration de entregas para habilitar evidências.");
    } catch (cause: any) {
      setDelivery(null);
      setError(cause?.message ?? "Não foi possível carregar a entrega.");
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function updateWithCompatibility(enhanced: Record<string, unknown>, fallback: Record<string, unknown>) {
    let result = await (supabase as any).from("compromissos_cliente").update(enhanced).eq("id", id);
    if (result.error && /(criterios_aceite|entregue_em|entregue_por|aprovado_por|schema cache|does not exist)/i.test(result.error.message)) {
      result = await (supabase as any).from("compromissos_cliente").update(fallback).eq("id", id);
    }
    return result.error as { message: string } | null;
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!delivery) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const nextStatus = data.status as DeliveryStatus;
    if (nextStatus === "aprovado" && delivery.evidencia_obrigatoria && documents.length === 0) {
      setError("Adicione uma evidência antes de aprovar esta entrega.");
      setEditing(false);
      document.getElementById("evidencias")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const fallback = {
      titulo: String(data.titulo || "").trim(), categoria: data.categoria, status: nextStatus,
      responsavel_id: data.responsavel_id || null, prazo: data.prazo || null,
      evidencia_obrigatoria: data.evidencia_obrigatoria === "true", observacoes: data.observacoes || null,
      aprovado_em: nextStatus === "aprovado" ? delivery.aprovado_em || new Date().toISOString() : null,
    };
    const enhanced = {
      ...fallback,
      criterios_aceite: data.criterios_aceite || null,
      entregue_em: ["entregue", "aprovado"].includes(nextStatus) ? delivery.entregue_em || new Date().toISOString() : null,
      entregue_por: ["entregue", "aprovado"].includes(nextStatus) ? delivery.entregue_por || actorId : null,
      aprovado_por: nextStatus === "aprovado" ? delivery.aprovado_por || actorId : null,
    };
    const updateError = await updateWithCompatibility(enhanced, fallback);
    if (updateError) { setError(updateError.message); return; }
    setEditing(false);
    await load();
  }

  async function advanceStatus() {
    if (!delivery || !canWrite || statusSaving) return;
    const nextStatus: DeliveryStatus | null = delivery.status === "pendente"
      ? "em_andamento"
      : ["em_andamento", "atrasado"].includes(delivery.status)
        ? "entregue"
        : delivery.status === "entregue" ? "aprovado" : null;
    if (!nextStatus) return;
    if (nextStatus === "aprovado" && delivery.evidencia_obrigatoria && documents.length === 0) {
      setError("Adicione uma evidência antes de aprovar esta entrega.");
      document.getElementById("evidencias")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStatusSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const fallback = { status: nextStatus, aprovado_em: nextStatus === "aprovado" ? now : delivery.aprovado_em };
    const enhanced = {
      ...fallback,
      entregue_em: nextStatus === "entregue" ? now : delivery.entregue_em ?? null,
      entregue_por: nextStatus === "entregue" ? actorId : delivery.entregue_por ?? null,
      aprovado_por: nextStatus === "aprovado" ? actorId : delivery.aprovado_por ?? null,
    };
    const previous = delivery;
    setDelivery({ ...delivery, ...enhanced } as CompromissoCliente);
    const updateError = await updateWithCompatibility(enhanced, fallback);
    if (updateError) { setDelivery(previous); setError(updateError.message); }
    setStatusSaving(false);
  }

  async function toggleActivity(activity: ActivityRow) {
    if (!canWrite) return;
    const next = !activity.feita;
    setActivities(current => current.map(item => item.id === activity.id ? { ...item, feita: next, data_realizada: next ? new Date().toISOString().slice(0, 10) : null } : item));
    const { error: activityError } = await (supabase as any).from("atividades").update({ feita: next, data_realizada: next ? new Date().toISOString().slice(0, 10) : null }).eq("id", activity.id);
    if (activityError) {
      setActivities(current => current.map(item => item.id === activity.id ? activity : item));
      setError("Não foi possível atualizar a atividade.");
    }
  }

  async function uploadEvidence(file: File) {
    if (!delivery || !canWrite) return;
    if (file.size > MAX_FILE_BYTES) { setError("O arquivo deve ter até 50 MB."); return; }
    setUploading(true);
    setError(null);
    const user = await supabase.auth.getUser();
    const uploaderId = user.data.user?.id;
    if (!uploaderId) { setError("Sessão não encontrada."); setUploading(false); return; }
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const path = `${delivery.organization_id}/entregas/${delivery.id}/${crypto.randomUUID()}${extension}`;
    const upload = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upload.error) { setError(upload.error.message); setUploading(false); return; }
    const insert = await (supabase as any).from("documentos").insert({
      account_id: uploaderId, organization_id: delivery.organization_id, conta_patrocinio_id: delivery.conta_patrocinio_id,
      contrato_id: delivery.contrato_id, projeto_id: delivery.projeto_id, compromisso_id: delivery.id,
      nome: file.name.replace(/\.[^.]+$/, ""), arquivo_nome: file.name, categoria: "comprovante",
      tipo: file.type || null, tamanho: file.size, url: path,
    });
    if (insert.error) { await supabase.storage.from("documentos").remove([path]); setError(insert.error.message); }
    else await load();
    setUploading(false);
  }

  async function openDocument(document: DocumentRow) {
    const result = await supabase.storage.from("documentos").createSignedUrl(document.url, 3600);
    if (result.error) setError(result.error.message); else if (result.data?.signedUrl) window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function removeDocument(document: DocumentRow) {
    if (!canWrite) return;
    confirmDelete({
      title: `Excluir o documento “${document.nome}”?`,
      description: "O arquivo deixa de estar disponível para toda a equipe.",
      onConfirm: async () => {
        await excluirDocumento(supabase, document);
        await load();
      },
    });
  }

  if (loading) return <div className="mx-auto max-w-pagina animate-pulse px-4 py-8 sm:px-6 lg:px-10"><div className="h-5 w-28 rounded bg-black/[.06]"/><div className="mt-8 h-28 rounded bg-black/[.04]"/><div className="mt-6 h-80 rounded bg-black/[.04]"/></div>;
  if (!delivery || !account) return <DetailNotFound title="Entrega não encontrada" description={error && error !== "Entrega não encontrada." ? error : "Ela pode ter sido removida ou você não tem acesso a ela."} backHref="/contas-patrocinio" backLabel="Clientes" />;

  const responsible = members.find(item => item.user_id === delivery.responsavel_id);
  const companyName = account.empresa_crm?.nome || account.nome || "Cliente";
  const statusMeta = STATUS_META[delivery.status];
  const nextAction = delivery.status === "pendente"
    ? { label: "Iniciar entrega", icon: Play }
    : ["em_andamento", "atrasado"].includes(delivery.status)
      ? { label: "Marcar como entregue", icon: Check }
      : delivery.status === "entregue" ? { label: "Aprovar entrega", icon: ShieldCheck } : null;
  const late = Boolean(delivery.prazo && new Date(`${delivery.prazo}T23:59:59`) < new Date() && !["entregue", "aprovado", "cancelado"].includes(delivery.status));
  const activityDone = activities.filter(item => item.feita).length;
  const historyEvents = [
    { id: "created", date: delivery.created_at, title: "Entrega criada", detail: originLabel(delivery.origem) },
    ...(delivery.entregue_em ? [{ id: "delivered", date: delivery.entregue_em, title: "Marcada como entregue", detail: companyName }] : []),
    ...(delivery.aprovado_em ? [{ id: "approved", date: delivery.aprovado_em, title: "Entrega aprovada", detail: companyName }] : []),
    ...documents.map(document => ({ id: document.id, date: document.created_at, title: "Evidência adicionada", detail: document.nome })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return <div className="min-h-full">
    <header className="border-b border-black/[.07]">
      <div className="mx-auto max-w-pagina px-4 pb-7 pt-6 sm:px-6 lg:px-10 lg:pb-9 lg:pt-9">
        <div className="flex items-center gap-2 text-[0.75rem] font-medium text-black/40">
          <Link href={`/contas-patrocinio/${delivery.conta_patrocinio_id}`} className="inline-flex items-center gap-2 transition hover:text-black/65"><ArrowLeft size={14}/>{companyName}</Link>
          <span className="text-black/20">/</span><span>Entregas</span>
        </div>
        <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo nome={companyName} domain={account.empresa_crm?.domain_key} site={account.empresa_crm?.site} size={48}/>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={delivery.status} label={statusMeta.label} bg={statusMeta.color} iconName={statusMeta.icon} size="sm"/><span className="text-[0.6875rem] text-black/30">{categoryLabel(delivery.categoria)}</span></div>
              <h1 className="mt-2 max-w-3xl text-[1.875rem] font-semibold leading-tight tracking-[-.04em] text-[#282525]">{delivery.titulo}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.75rem] text-black/35">
                <span>{companyName}</span>{project && <><span>·</span><Link href={`/projetos/${project.id}`} className="hover:text-[#7259B5]">{project.nome}</Link></>}{contract && <><span>·</span><Link href={`/contratos/${contract.id}`} className="hover:text-[#7259B5]">{contract.titulo || contract.numero || "Contrato"}</Link></>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canWrite && <button onClick={() => setEditing(true)} className="inline-flex h-10 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] active:translate-y-px"><Pencil size={13}/>Editar</button>}
            {canWrite && nextAction && <button onClick={() => void advanceStatus()} disabled={statusSaving} className="inline-flex h-10 items-center gap-2 rounded acao-salvar px-4 text-[0.75rem] font-semibold text-white transition active:translate-y-px disabled:opacity-45"><nextAction.icon size={14}/>{statusSaving ? "Atualizando…" : nextAction.label}</button>}
          </div>
        </div>
        <div className="mt-7 rounded border border-black/[.08] bg-white px-4 py-4 sm:px-5"><StatusProgress status={delivery.status}/></div>
      </div>
    </header>

    <main className="mx-auto grid max-w-pagina gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:px-10 lg:py-9">
      {error && <p className="rounded border border-[#D94E4E]/20 bg-white px-3 py-2.5 text-[0.6875rem] text-[#D94E4E] lg:col-span-2">{error}</p>}
      <div className="min-w-0 space-y-6">
        <section className="overflow-hidden rounded border border-black/[.08] bg-white">
          <SectionHeader icon={FileCheck2} eyebrow="Definição" title="Escopo e aceite" action={canWrite ? <button onClick={() => setEditing(true)} className="text-[0.6875rem] font-medium text-[#7259B5] hover:text-[#6049A0]">Editar</button> : undefined}/>
          <div className="grid gap-px bg-black/[.06] sm:grid-cols-2">
            <div className="min-h-40 bg-white p-5"><p className="text-[0.625rem] font-semibold text-black/30">Orientações</p><p className="mt-3 whitespace-pre-line text-[0.8125rem] leading-6 text-black/55">{delivery.observacoes || <span className="text-black/25">Nenhuma orientação registrada.</span>}</p></div>
            <div className="min-h-40 bg-white p-5"><p className="text-[0.625rem] font-semibold text-black/30">Critérios de aceite</p><p className="mt-3 whitespace-pre-line text-[0.8125rem] leading-6 text-black/55">{delivery.criterios_aceite || <span className="text-black/25">Nenhum critério definido.</span>}</p></div>
          </div>
        </section>

        <section id="evidencias" className="scroll-mt-6 overflow-hidden rounded border border-black/[.08] bg-white">
          <SectionHeader icon={Paperclip} eyebrow={delivery.evidencia_obrigatoria ? "Comprovação obrigatória" : "Comprovação"} title={`Evidências · ${documents.length}`} action={canWrite ? <><input ref={fileRef} type="file" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadEvidence(file); event.target.value = ""; }}/><button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40"><Upload size={12}/>{uploading ? "Enviando…" : "Adicionar"}</button></> : undefined}/>
          {documents.length ? <div className="divide-y divide-black/[.06]">{documents.map(document => <div key={document.id} className="group flex items-center gap-3 px-5 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded bg-black/[.035] text-black/35"><FileText size={15}/></span><div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/65">{document.nome}</p><p className="mt-0.5 text-[0.625rem] text-black/25">{formatSize(document.tamanho)} · {formatDate(document.created_at)}</p></div><button onClick={() => void openDocument(document)} title="Abrir evidência" className="rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#7259B5]"><Download size={13}/></button>{canWrite && <button onClick={() => void removeDocument(document)} title="Excluir evidência" className="rounded p-2 text-black/20 opacity-0 transition hover:bg-black/[.04] hover:text-[#D94E4E] group-hover:opacity-100 focus:opacity-100"><Trash2 size={13}/></button>}</div>)}</div> : canWrite ? <button type="button" onClick={() => fileRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadEvidence(file); }} className="m-5 flex min-h-36 w-[calc(100%-2.5rem)] flex-col items-center justify-center rounded border border-dashed border-black/[.12] bg-black/[.012] text-center transition hover:border-[#7259B5]/35 hover:bg-black/[.04]"><Upload size={20} className="text-black/20"/><p className="mt-3 text-[0.75rem] font-semibold text-black/45">Adicionar evidência</p><p className="mt-1 text-[0.625rem] text-black/25">Arquivo de até 50 MB</p></button> : <EmptyLine text="Nenhuma evidência anexada."/>}
        </section>

        <section className="overflow-hidden rounded border border-black/[.08] bg-white">
          <SectionHeader icon={Check} eyebrow={`${activityDone} de ${activities.length} concluídas`} title="Atividades relacionadas" action={canWrite ? <button onClick={() => setShowActivity(true)} className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#7259B5] transition hover:bg-black/[.04]"><Plus size={12}/>Nova atividade</button> : undefined}/>
          {activities.length ? <div className="divide-y divide-black/[.06]">{activities.map(activity => <div key={activity.id} className="flex items-center gap-3 px-5 py-3.5"><button type="button" disabled={!canWrite} onClick={() => void toggleActivity(activity)} aria-label={activity.feita ? `Reabrir ${activity.nome}` : `Concluir ${activity.nome}`} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border transition ${activity.feita ? "border-[#2E8932] bg-[#2E8932] text-white" : "border-black/[.14] text-transparent hover:border-[#2E8932] hover:bg-black/[.04] hover:text-[#2E8932]"}`}><Check size={12}/></button><div className="min-w-0 flex-1"><p className={`break-words text-[0.75rem] font-medium ${activity.feita ? "text-black/35 line-through" : "text-black/65"}`}>{activity.nome}</p>{activity.responsavel?.full_name && <p className="mt-0.5 text-[0.625rem] text-black/25">{activity.responsavel.full_name}</p>}</div><span className="text-[0.625rem] text-black/30">{activity.data_prevista ? formatDate(activity.data_prevista) : "Sem prazo"}</span><Link href="/atividades" title="Abrir atividades" className="rounded p-1.5 text-black/20 hover:bg-black/[.04] hover:text-[#7259B5]"><ArrowUpRight size={13}/></Link></div>)}</div> : <EmptyLine text="Nenhuma atividade vinculada."/>}
        </section>

        <section className="overflow-hidden rounded border border-black/[.08] bg-white">
          <SectionHeader icon={History} eyebrow="Registro operacional" title="Histórico"/>
          <div className="divide-y divide-black/[.06]">{historyEvents.slice(0, 8).map(event => <div key={event.id} className="flex items-start gap-3 px-5 py-3.5"><span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded bg-black/[.035] text-black/30"><Clock3 size={12}/></span><div className="min-w-0 flex-1"><p className="text-[0.75rem] font-medium text-black/60">{event.title}</p><p className="mt-0.5 truncate text-[0.625rem] text-black/25">{event.detail}</p></div><time className="shrink-0 text-[0.625rem] text-black/25">{formatDateTime(event.date)}</time></div>)}</div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <section className="overflow-hidden rounded border border-black/[.08] bg-white">
          <header className="border-b border-black/[.06] px-4 py-4"><p className="text-[0.625rem] font-semibold text-black/30">Controle</p><h2 className="mt-1 text-[0.9375rem] font-semibold text-black/70">Dados da entrega</h2></header>
          <div className="divide-y divide-black/[.06]">
            <ControlRow icon={Check} label="Status"><StatusBadge status={delivery.status} label={statusMeta.label} bg={statusMeta.color} iconName={statusMeta.icon} size="sm"/></ControlRow>
            <ControlRow icon={CalendarDays} label="Prazo"><p className="mt-1 flex items-center gap-1 text-[0.75rem] font-semibold text-black/60">{late && <Clock size={12} strokeWidth={1.75} role="img" aria-label="Atrasada" className="shrink-0 text-[#D94A4A]"/>}{delivery.prazo ? formatDate(delivery.prazo) : "Sem prazo"}</p></ControlRow>
            <ControlRow icon={UserRound} label="Responsável" value={responsible?.full_name || responsible?.email || "Não atribuído"}/>
            <ControlRow icon={FolderKanban} label="Categoria" value={categoryLabel(delivery.categoria)}/>
            <ControlRow icon={Link2} label="Origem" value={originLabel(delivery.origem)}/>
            {project && <ControlRow icon={FolderKanban} label="Projeto" value={project.nome} href={`/projetos/${project.id}`}/>} 
            {contract && <ControlRow icon={FileText} label="Contrato" value={contract.titulo || contract.numero || "Contrato"} href={`/contratos/${contract.id}`}/>} 
            <ControlRow icon={ShieldCheck} label="Evidência"><p className="mt-1 flex items-center gap-1 text-[0.75rem] font-semibold text-black/60">{delivery.evidencia_obrigatoria && documents.length === 0 && <TriangleAlert size={12} strokeWidth={1.75} role="img" aria-label="Evidência pendente" className="shrink-0 text-[#B07A14]"/>}{delivery.evidencia_obrigatoria ? documents.length ? `${documents.length} anexada${documents.length === 1 ? "" : "s"}` : "Obrigatória" : "Opcional"}</p></ControlRow>
          </div>
        </section>
      </aside>
    </main>

    {editing && <EditDelivery delivery={delivery} members={members} error={error} onClose={() => { setEditing(false); setError(null); }} onSubmit={save}/>} 
    {showActivity && <NovaAtividadeModal prefill={{ compromisso_id: delivery.id, empresa_crm_id: account.empresa_crm_id, projeto_id: delivery.projeto_id ?? undefined, responsavel_id: delivery.responsavel_id ?? undefined, conta_patrocinio_id: delivery.conta_patrocinio_id ?? undefined, date: delivery.prazo ?? undefined }} onClose={() => setShowActivity(false)} onSaved={() => { setShowActivity(false); void load(); }}/>}
  </div>;
}

function StatusProgress({ status }: { status: DeliveryStatus }) {
  if (status === "cancelado") return <div className="flex items-center gap-2 text-[0.75rem] font-medium text-black/45"><X size={14}/>Entrega cancelada</div>;
  const stages = [["pendente", "Pendente"], ["em_andamento", "Em andamento"], ["entregue", "Entregue"], ["aprovado", "Aprovada"]] as const;
  const current = status === "atrasado" ? 1 : Math.max(0, stages.findIndex(([value]) => value === status));
  return <div className="grid grid-cols-4" aria-label="Andamento da entrega">{stages.map(([value, label], index) => {
    const reached = index <= current;
    const active = index === current;
    return <div key={value} className="relative flex min-w-0 flex-col items-center text-center">{index > 0 && <span className={`absolute right-1/2 top-[0.375rem] h-px w-full ${index <= current ? "bg-[#2E8932]" : "bg-black/[.09]"}`}/>}<span className="relative z-[1] flex bg-white px-0.5">{index < current ? <CircleCheck size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40"/> : active ? <CircleDot size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/65"/> : <Circle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/25"/>}</span><span className={`mt-2 truncate text-[0.625rem] font-medium ${active ? "text-black/65" : reached ? "text-black/40" : "text-black/25"}`}>{label}</span></div>;
  })}</div>;
}

function SectionHeader({ icon: Icon, eyebrow, title, action }: { icon: React.ElementType; eyebrow: string; title: string; action?: React.ReactNode }) {
  return <header className="flex min-h-[4.25rem] items-center justify-between gap-4 border-b border-black/[.06] px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black/[.035] text-black/35"><Icon size={14}/></span><div className="min-w-0"><p className="truncate text-[0.625rem] font-medium text-black/30">{eyebrow}</p><h2 className="mt-0.5 truncate text-[0.875rem] font-semibold text-black/70">{title}</h2></div></div>{action}</header>;
}

function ControlRow({ icon: Icon, label, value, href, children }: { icon: React.ElementType; label: string; value?: string; href?: string; children?: React.ReactNode }) {
  const content = children ?? <p className="mt-1 text-[0.75rem] font-semibold text-black/60">{value}</p>;
  return <div className="flex gap-3 px-4 py-3.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-black/25"><Icon size={13}/></span><div className="min-w-0 flex-1"><p className="text-[0.5625rem] font-medium text-black/25">{label}</p>{href ? <Link href={href} className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-[0.75rem] font-semibold text-[#7259B5] hover:underline">{value}<ArrowUpRight size={10}/></Link> : content}</div></div>;
}

function EmptyLine({ text }: { text: string }) { return <p className="px-5 py-10 text-center text-[0.75rem] text-black/25">{text}</p>; }
function categoryLabel(value: string) { return CATEGORY_OPTIONS.find(item => item[0] === value)?.[1] ?? value.replaceAll("_", " "); }
function originLabel(value: CompromissoCliente["origem"]) { return value === "cota" ? "Cota" : value === "contrato" ? "Contrato" : value === "importacao" ? "Importação" : value === "proposta" ? "Proposta" : "Manual"; }
function formatDate(value: string) { return new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR"); }
function formatDateTime(value: string) { return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
function formatSize(bytes: number | null) { if (!bytes) return "—"; return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`; }

function EditDelivery({ delivery, members, error, onClose, onSubmit }: { delivery: CompromissoCliente; members: Member[]; error: string | null; onClose: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const field = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] outline-none transition focus:border-[#7259B5]/50";
  return <div className="fixed inset-0 z-50 flex items-center justify-center veu p-4" onClick={onClose}><form onSubmit={onSubmit} onClick={event => event.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded bg-white border elevacao-3"><header className="flex items-center justify-between border-b border-black/[.07] px-5 py-4"><div><p className="text-[0.625rem] text-black/30">Execução</p><h2 className="mt-0.5 text-[0.9375rem] font-semibold text-black/80">Editar entrega</h2></div><button type="button" onClick={onClose} className="rounded p-1.5 text-black/30 hover:bg-black/[.04]"><X size={15}/></button></header><div className="grid max-h-[70vh] gap-4 overflow-y-auto p-5 sm:grid-cols-2"><label className="sm:col-span-2"><SmallLabel>Título</SmallLabel><input name="titulo" required defaultValue={delivery.titulo} className={field}/></label><label><SmallLabel>Categoria</SmallLabel><Select name="categoria" defaultValue={delivery.categoria} className={field}>{CATEGORY_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></label><label><SmallLabel>Status</SmallLabel><Select name="status" defaultValue={delivery.status} className={field}>{STATUS_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></label><label><SmallLabel>Responsável</SmallLabel><Select name="responsavel_id" defaultValue={delivery.responsavel_id || ""} className={field}><option value="">Não atribuído</option>{members.filter(item => ["admin", "colaborador"].includes(item.papel)).map(item => <option key={item.user_id} value={item.user_id}>{item.full_name || item.email || "Membro"}</option>)}</Select></label><label><SmallLabel>Prazo</SmallLabel><input name="prazo" type="date" defaultValue={delivery.prazo || ""} className={field}/></label><label><SmallLabel>Evidência obrigatória</SmallLabel><Select name="evidencia_obrigatoria" defaultValue={String(delivery.evidencia_obrigatoria)} className={field}><option value="true">Sim</option><option value="false">Não</option></Select></label><label className="sm:col-span-2"><SmallLabel>Orientações</SmallLabel><textarea name="observacoes" rows={4} defaultValue={delivery.observacoes || ""} className={`${field} h-auto resize-none py-2.5`}/></label><label className="sm:col-span-2"><SmallLabel>Critérios de aceite</SmallLabel><textarea name="criterios_aceite" rows={4} defaultValue={delivery.criterios_aceite || ""} placeholder="Condições objetivas para considerar a entrega aprovada" className={`${field} h-auto resize-none py-2.5`}/></label>{error && <p className="sm:col-span-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}</div><footer className="flex justify-end gap-3 border-t border-black/[.07] px-5 py-4"><button type="button" onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button className="rounded acao-salvar px-4 py-2 text-[0.75rem] font-semibold text-white transition ">Salvar</button></footer></form></div>;
}

function SmallLabel({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">{children}</span>; }
