"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, ClipboardCheck, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import type { CompromissoCliente } from "@/lib/supabase/types";

type ContractOption = { id: string; titulo: string | null; numero: string | null };
type ProjectOption = { id: string; nome: string };
type AccountOption = { id: string; nome: string | null; empresa_crm?: { nome: string } | null };
type MemberOption = { user_id: string; full_name: string | null; email: string | null; papel: string };
type DeliveryRow = CompromissoCliente & {
  conta?: { nome: string | null; empresa_crm?: { nome: string } | null } | null;
  projeto?: { nome: string } | null;
  contrato?: { titulo: string | null; numero: string | null } | null;
};

const STATUS = {
  pendente: { label: "Pendente", color: "#7259B5" },
  em_andamento: { label: "Em andamento", color: "#2D72B0" },
  entregue: { label: "Entregue", color: "#B07A14" },
  aprovado: { label: "Aprovada", color: "#2E8932" },
  atrasado: { label: "Atrasada", color: "#D94E4E" },
  cancelado: { label: "Cancelada", color: "#777777" },
} as const;

const CATEGORIES = [
  ["marca_comunicacao", "Marca e comunicação"], ["hospitalidade", "Hospitalidade"],
  ["relatorio", "Relatório"], ["ativacao", "Evento ou ação"], ["conteudo", "Conteúdo"],
  ["colaboradores", "Colaboradores"], ["impacto", "Impacto"], ["compliance", "Compliance"],
  ["financeiro", "Financeiro"], ["outro", "Outro"],
] as const;

type Props = {
  organizationId: string;
  accountId: string;
  contaId?: string;
  projetoId?: string;
  contracts?: ContractOption[];
  projects?: ProjectOption[];
  createRequestNonce?: number;
};

export function DeliveriesPanel({ organizationId, accountId, contaId, projetoId, contracts = [], projects = [], createRequestNonce = 0 }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<DeliveryRow[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("abertas");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    let query = (supabase as any).from("compromissos_cliente").select("*,conta:contas_patrocinio!conta_patrocinio_id(nome,empresa_crm:empresas_crm!empresa_crm_id(nome)),projeto:projetos_crm!projeto_id(nome),contrato:contratos!contrato_id(titulo,numero)").order("prazo", { ascending: true, nullsFirst: false });
    if (contaId) query = query.eq("conta_patrocinio_id", contaId);
    if (projetoId) query = query.eq("projeto_id", projetoId);
    const [deliveries, user, memberRows, accountRows] = await Promise.all([
      query,
      supabase.auth.getUser(),
      fetchOrganizationMembers(organizationId),
      contaId ? Promise.resolve({ data: [] }) : (supabase as any).from("contas_patrocinio").select("id,nome,empresa_crm:empresas_crm!empresa_crm_id(nome)").eq("organization_id", organizationId).neq("status", "encerrada").order("nome"),
    ]);
    setItems((deliveries.data ?? []) as DeliveryRow[]);
    setMembers(memberRows.filter(item => ["admin", "colaborador"].includes(item.papel)) as MemberOption[]);
    setAccounts((accountRows.data ?? []) as AccountOption[]);
    const userId = user.data.user?.id;
    if (userId) {
      const role = await (supabase as any).from("organization_members").select("papel").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
      setCanWrite(["admin", "colaborador"].includes(role.data?.papel));
    }
    setError(deliveries.error?.message ?? null);
    setLoading(false);
  }, [contaId, organizationId, projetoId, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (createRequestNonce > 0) setShowCreate(true); }, [createRequestNonce]);

  async function createDelivery(data: Record<string, FormDataEntryValue>) {
    const selectedContaId = contaId || String(data.conta_patrocinio_id || "");
    if (!selectedContaId || !String(data.titulo || "").trim()) { setError("Informe o cliente e o título da entrega."); return; }
    setSaving(true); setError(null);
    const { error: insertError } = await (supabase as any).from("compromissos_cliente").insert({
      organization_id: organizationId,
      account_id: accountId,
      conta_patrocinio_id: selectedContaId,
      contrato_id: data.contrato_id || null,
      projeto_id: projetoId || data.projeto_id || null,
      titulo: String(data.titulo).trim(),
      categoria: data.categoria || "outro",
      prazo: data.prazo || null,
      responsavel_id: data.responsavel_id || null,
      evidencia_obrigatoria: data.evidencia_obrigatoria === "true",
      observacoes: data.observacoes || null,
      origem: data.contrato_id ? "contrato" : "manual",
    });
    if (insertError) setError(insertError.message);
    else { setShowCreate(false); await load(); }
    setSaving(false);
  }

  async function completeDelivery(item: DeliveryRow) {
    if (!canWrite || ["entregue", "aprovado", "cancelado"].includes(item.status)) return;
    const previousStatus = item.status;
    setUpdatingId(item.id);
    setError(null);
    setItems(current => current.map(row => row.id === item.id ? { ...row, status: "entregue" } : row));

    const { error: updateError } = await (supabase as any)
      .from("compromissos_cliente")
      .update({ status: "entregue" })
      .eq("id", item.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      setItems(current => current.map(row => row.id === item.id ? { ...row, status: previousStatus } : row));
      setError("Não foi possível concluir a entrega.");
    }
    setUpdatingId(null);
  }

  const filtered = items.filter(item => {
    const isClosed = ["entregue", "aprovado", "cancelado"].includes(item.status);
    if (statusFilter === "abertas" && isClosed) return false;
    if (statusFilter === "concluidas" && !isClosed) return false;
    const haystack = `${item.titulo} ${item.projeto?.nome ?? ""} ${item.conta?.nome ?? ""} ${item.conta?.empresa_crm?.nome ?? ""}`.toLocaleLowerCase("pt-BR");
    return haystack.includes(search.toLocaleLowerCase("pt-BR"));
  });

  return <section className="overflow-hidden rounded border border-black/[.08] bg-white">
    <header className="flex flex-col gap-4 border-b border-black/[.07] px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-6">
      <div><p className="text-[0.6875rem] font-medium text-black/35">Execução da parceria</p><h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">Entregas</h2></div>
      {canWrite && <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-10 items-center gap-2 self-start rounded border border-[#7259B5]/30 bg-white px-4 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] sm:self-auto"><Plus size={13}/>Nova entrega</button>}
    </header>
    <div className="flex flex-col gap-3 border-b border-black/[.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
      <div className="relative w-full max-w-xs"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar entregas" className="h-9 w-full rounded border border-black/[.10] bg-white pl-9 pr-3 text-[0.75rem] outline-none focus:border-[#7259B5]/45"/></div>
      <div className="flex gap-1">{[["abertas","Abertas"],["concluidas","Concluídas"],["todas","Todas"]].map(([value,label]) => <button key={value} onClick={() => setStatusFilter(value)} className={`rounded px-3 py-2 text-[0.6875rem] font-medium transition ${statusFilter===value?"bg-black/[.055] text-black/70":"text-black/35 hover:bg-black/[.03] hover:text-black/55"}`}>{label}</button>)}</div>
    </div>
    {error && <p className="mx-5 mt-4 rounded border border-[#D94E4E]/20 px-3 py-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}
    <div className="px-5 py-2 md:px-6">{loading ? <div className="space-y-2 py-3">{[1,2,3].map(item => <div key={item} className="h-16 animate-pulse rounded bg-black/[.035]"/>)}</div> : filtered.length === 0 ? <div className="py-16 text-center"><ClipboardCheck size={24} className="mx-auto text-black/15"/><p className="mt-4 text-[0.875rem] font-semibold text-black/45">Nenhuma entrega encontrada</p>{canWrite && <button onClick={() => setShowCreate(true)} className="mt-4 text-[0.75rem] font-medium text-[#7259B5]">Registrar primeira entrega</button>}</div> : <div className="divide-y divide-black/[.06]">{filtered.map(item => <DeliveryListItem key={item.id} item={item} canWrite={canWrite} updating={updatingId === item.id} onComplete={() => void completeDelivery(item)}/>)}</div>}</div>
    {showCreate && <DeliveryForm accounts={accounts} contaId={contaId} contracts={contracts} projects={projects} projetoId={projetoId} members={members} saving={saving} error={error} onClose={() => { setShowCreate(false); setError(null); }} onSubmit={createDelivery}/>} 
  </section>;
}

function DeliveryListItem({ item, canWrite, updating, onComplete }: { item: DeliveryRow; canWrite: boolean; updating: boolean; onComplete: () => void }) {
  const meta = STATUS[item.status] ?? STATUS.pendente;
  const late = item.prazo && new Date(`${item.prazo}T23:59:59`) < new Date() && !["entregue","aprovado","cancelado"].includes(item.status);
  const accountName = item.conta?.nome || item.conta?.empresa_crm?.nome;
  const completed = ["entregue", "aprovado"].includes(item.status);
  const cancelled = item.status === "cancelado";
  return <article className="group flex items-center gap-3 py-4 transition hover:bg-black/[.018] sm:px-2">
    <button
      type="button"
      disabled={!canWrite || completed || cancelled || updating}
      onClick={onComplete}
      aria-label={completed ? "Entrega concluída" : `Concluir ${item.titulo}`}
      title={completed ? "Entrega concluída" : canWrite ? "Marcar como entregue" : "Sem permissão para concluir"}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] ${completed ? "border-[#2E8932] bg-[#2E8932] text-white" : cancelled ? "cursor-default border-black/[.08] bg-black/[.035] text-black/20" : "border-black/[.16] bg-white text-transparent hover:border-[#2E8932] hover:bg-[#2E8932]/[.06] hover:text-[#2E8932] active:scale-95 disabled:cursor-default disabled:hover:border-black/[.16] disabled:hover:bg-white disabled:hover:text-transparent"} ${updating ? "opacity-45" : ""}`}
    >
      {cancelled ? <X size={12} /> : <Check size={13} strokeWidth={2.5} />}
    </button>
    <Link href={`/entregas/${item.id}`} className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9.375rem_7.5rem_1.125rem] sm:items-center">
      <div className="min-w-0"><p className={`truncate text-[0.8125rem] font-semibold ${completed ? "text-black/45" : "text-black/75"}`}>{item.titulo}</p><p className="mt-1 truncate text-[0.625rem] text-black/30">{accountName || "Cliente"}{item.projeto?.nome ? ` · ${item.projeto.nome}` : ""}{item.contrato ? ` · ${item.contrato.titulo || item.contrato.numero || "Contrato"}` : ""}</p></div>
      <div><p className="text-[0.625rem] text-black/25">Status</p><p className="mt-1 text-[0.6875rem] font-medium" style={{color:meta.color}}>{meta.label}</p></div>
      <div><p className="text-[0.625rem] text-black/25">Prazo</p><p className="mt-1 flex items-center gap-1 text-[0.6875rem] font-medium" style={{color:late?"#D94E4E":"rgba(13,13,13,.52)"}}><CalendarDays size={11}/>{item.prazo ? new Date(`${item.prazo}T12:00:00`).toLocaleDateString("pt-BR") : "Sem prazo"}</p></div>
      <ArrowUpRight size={14} className="text-black/20 transition group-hover:text-[#7259B5]"/>
    </Link>
  </article>;
}

function DeliveryForm({ accounts, contaId, contracts, projects, projetoId, members, saving, error, onClose, onSubmit }: { accounts: AccountOption[]; contaId?: string; contracts: ContractOption[]; projects: ProjectOption[]; projetoId?: string; members: MemberOption[]; saving: boolean; error: string | null; onClose: () => void; onSubmit: (data: Record<string, FormDataEntryValue>) => void }) {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [category, setCategory] = useState("marca_comunicacao");
  const [responsible, setResponsible] = useState("");
  const [project, setProject] = useState("");
  const [contract, setContract] = useState("");
  const [evidenceRequired, setEvidenceRequired] = useState("true");
  const dropdownClass = "w-full [&>button]:h-10 [&>button]:w-full";

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><form className="w-full max-w-xl overflow-hidden rounded border border-black/[.09] bg-white shadow-[0_24px_70px_rgba(13,13,13,.16)]" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); onSubmit(Object.fromEntries(new FormData(event.currentTarget))); }}>
    <header className="flex items-center justify-between border-b border-black/[.07] px-5 py-4"><div><p className="text-[0.625rem] text-black/30">Execução</p><h3 className="mt-0.5 text-[0.9375rem] font-semibold text-black/80">Nova entrega</h3></div><button type="button" onClick={onClose} className="rounded p-1.5 text-black/30 hover:bg-black/[.04] hover:text-black/55"><X size={15}/></button></header>
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      <label className="sm:col-span-2"><Label>Título</Label><input name="titulo" required autoFocus placeholder="O que precisa ser entregue?" className={fieldClass}/></label>
      {!contaId && <DropdownField label="Cliente" name="conta_patrocinio_id" value={selectedAccount} onChange={setSelectedAccount} placeholder="Selecione" options={accounts.map(item => ({ value: item.id, label: item.nome || item.empresa_crm?.nome || "Cliente" }))} className={dropdownClass}/>} 
      <DropdownField label="Categoria" name="categoria" value={category} onChange={setCategory} options={CATEGORIES.map(([value,label]) => ({ value, label }))} className={dropdownClass}/>
      <DropdownField label="Responsável" name="responsavel_id" value={responsible} onChange={setResponsible} options={[{ value: "", label: "Sem responsável" }, ...members.map(item => ({ value: item.user_id, label: item.full_name || item.email || "Membro" }))]} className={dropdownClass}/>
      <label><Label>Prazo</Label><input name="prazo" type="date" className={fieldClass}/></label>
      {!projetoId && <DropdownField label="Projeto" name="projeto_id" value={project} onChange={setProject} options={[{ value: "", label: "Sem projeto" }, ...projects.map(item => ({ value: item.id, label: item.nome }))]} className={dropdownClass}/>} 
      {contracts.length > 0 && <DropdownField label="Contrato" name="contrato_id" value={contract} onChange={setContract} options={[{ value: "", label: "Sem contrato" }, ...contracts.map(item => ({ value: item.id, label: item.titulo || item.numero || "Contrato" }))]} className={dropdownClass}/>} 
      <DropdownField label="Evidência obrigatória" name="evidencia_obrigatoria" value={evidenceRequired} onChange={setEvidenceRequired} options={[{ value: "true", label: "Sim" }, { value: "false", label: "Não" }]} className={dropdownClass}/>
      <label className="sm:col-span-2"><Label>Orientações</Label><textarea name="observacoes" rows={3} placeholder="Critério de aceite, formato ou contexto" className={`${fieldClass} h-auto resize-none py-2.5`}/></label>
      {error && <p className="sm:col-span-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}
    </div>
    <footer className="flex justify-end gap-3 border-t border-black/[.07] px-5 py-4"><button type="button" onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button disabled={saving} className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40">{saving ? "Salvando…" : "Salvar"}</button></footer>
  </form></div>;
}

const fieldClass = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 outline-none transition focus:border-[#7259B5]/50";
function Label({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">{children}</span>; }
function DropdownField({ label, name, value, onChange, options, placeholder, className }: { label: string; name: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder?: string; className?: string }) {
  return <div><Label>{label}</Label><input type="hidden" name={name} value={value}/><CustomDropdown value={value} onChange={onChange} options={options} placeholder={placeholder} compact portalZIndex={100} className={className}/></div>;
}
