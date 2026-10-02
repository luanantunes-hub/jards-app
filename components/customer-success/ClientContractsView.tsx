"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, FileCheck2, FileText, Handshake, Paperclip, Plus, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CustomDropdown } from "@/components/ui/CustomDropdown";

export type ClientContract = { id: string; numero: string | null; titulo: string | null; valor: number; status: string; data_inicio: string | null; data_fim: string | null; proxima_renovacao: string | null };
export type ClientAgencyParticipation = {
  id: string;
  contrato_id: string;
  captador_id: string;
  papel: string;
  status: string;
  captador: { id: string; nome: string; logo_url?: string | null } | null;
};
type ContractDocument = { id: string; contrato_id: string; arquivo_nome: string | null; tipo: string | null };
type AgencyOption = { id: string; nome: string };
type Props = { contaId: string; organizationId: string; accountId: string; contracts: ClientContract[]; participations: ClientAgencyParticipation[]; actionRequestNonce?: number; onSaved: () => void };

const MAX_BYTES = 50 * 1024 * 1024;
const STATUS_META: Record<string, { label: string; color: string }> = {
  proposta: { label: "Minuta", color: "#B07A14" }, assinado: { label: "Assinado", color: "#2D72B0" },
  vigente: { label: "Vigente", color: "#2E8932" }, encerrado: { label: "Encerrado", color: "#777777" }, renovado: { label: "Renovado", color: "#1A8B7A" },
};

function money(value: number) { return value ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value) : "Não informado"; }
function date(value: string | null) { return value ? new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

export function ClientContractsView({ contaId, organizationId, accountId, contracts, participations, actionRequestNonce = 0, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("assinado");
  const [automaticRenewal, setAutomaticRenewal] = useState("false");
  const [agencyId, setAgencyId] = useState("");
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (actionRequestNonce > 0) setShowForm(true); }, [actionRequestNonce]);
  useEffect(() => {
    void (supabase as any).from("captadores").select("id,nome").eq("organization_id", organizationId).or("ativo.eq.true,ativo.is.null").order("nome").then(({ data }: any) => setAgencies((data ?? []) as AgencyOption[]));
  }, [organizationId, supabase]);
  useEffect(() => {
    const ids = contracts.map(item => item.id);
    if (!ids.length) { setDocuments([]); return; }
    void (supabase as any).from("documentos").select("id,contrato_id,arquivo_nome,tipo").in("contrato_id", ids).then(({ data }: any) => setDocuments((data ?? []) as ContractDocument[]));
  }, [contracts, supabase]);

  function closeForm() { setShowForm(false); setShowDetails(false); setFile(null); setTitle(""); setStatus("assinado"); setAutomaticRenewal("false"); setAgencyId(""); setError(null); }
  function chooseFile(selected: File) {
    if (selected.size > MAX_BYTES) { setError("O arquivo deve ter até 50 MB."); return; }
    setFile(selected); setTitle(current => current || selected.name.replace(/\.[^.]+$/, "")); setError(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !title.trim()) { setError("Adicione o arquivo e informe o título."); return; }
    setSaving(true); setError(null);
    const data = new FormData(event.currentTarget);
    const rawValue = String(data.get("valor") ?? "").replace(/\./g, "").replace(",", ".");
    const contractResult = await (supabase as any).from("contratos").insert({
      account_id: accountId, organization_id: organizationId, conta_patrocinio_id: contaId,
      titulo: title.trim(), numero: String(data.get("numero") ?? "").trim() || null,
      valor: Number(rawValue || 0), status: String(data.get("status") || "assinado"),
      data_assinatura: data.get("data_assinatura") || null, data_inicio: data.get("data_inicio") || null,
      data_fim: data.get("data_fim") || null, proxima_renovacao: data.get("proxima_renovacao") || null,
      renovacao_automatica: data.get("renovacao_automatica") === "true", notas: String(data.get("notas") ?? "").trim() || null,
    }).select("id").single();
    if (contractResult.error || !contractResult.data?.id) { setError(contractResult.error?.message ?? "Não foi possível criar o contrato."); setSaving(false); return; }
    const contractId = contractResult.data.id as string;
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const path = `${organizationId}/contratos/${contractId}/${crypto.randomUUID()}${extension}`;
    const upload = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (upload.error) { await (supabase as any).from("contratos").delete().eq("id", contractId); setError(upload.error.message); setSaving(false); return; }
    const documentResult = await (supabase as any).from("documentos").insert({
      account_id: accountId, organization_id: organizationId, conta_patrocinio_id: contaId, contrato_id: contractId,
      nome: title.trim(), arquivo_nome: file.name, categoria: "contrato", tipo: file.type || null, tamanho: file.size, url: path,
    });
    if (documentResult.error) {
      await supabase.storage.from("documentos").remove([path]); await (supabase as any).from("contratos").delete().eq("id", contractId);
      setError(documentResult.error.message); setSaving(false); return;
    }
    if (agencyId) {
      const participationResult = await (supabase as any).from("participacoes_agencia_cliente").insert({
        account_id: accountId, organization_id: organizationId, conta_patrocinio_id: contaId,
        contrato_id: contractId, captador_id: agencyId, papel: "principal", status: "ativa",
      });
      if (participationResult.error) {
        setError(`Contrato salvo, mas não foi possível vincular a agência: ${participationResult.error.message}`);
        setSaving(false); onSaved(); return;
      }
    }
    setSaving(false); closeForm(); onSaved();
  }

  return <section className="overflow-hidden rounded border border-black/[.08] bg-white">
    <header className="flex flex-col gap-4 border-b border-black/[.07] px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-6">
      <div><p className="text-[0.6875rem] font-medium text-black/35">Documentos e vigências</p><h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">Contratos</h2></div>
      <button onClick={() => setShowForm(true)} className="inline-flex h-10 items-center gap-2 self-start rounded border border-[#7259B5]/30 bg-white px-4 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] sm:self-auto"><Plus size={13}/>Adicionar contrato</button>
    </header>

    {!contracts.length ? <div className="px-5 py-16 text-center"><FileText size={24} className="mx-auto text-black/15"/><p className="mt-4 text-[0.875rem] font-semibold text-black/45">Nenhum contrato anexado</p><button onClick={() => setShowForm(true)} className="mt-4 text-[0.75rem] font-medium text-[#7259B5]">Adicionar primeiro contrato</button></div> :
      <div className="divide-y divide-black/[.06] px-5 py-2 md:px-6">{contracts.map(contract => {
        const meta = STATUS_META[contract.status] ?? { label: contract.status, color: "rgba(13,13,13,.45)" };
        const attached = documents.filter(item => item.contrato_id === contract.id);
        const agency = participations.find(item => item.contrato_id === contract.id && item.status === "ativa");
        return <Link key={contract.id} href={`/contratos/${contract.id}`} className="group grid gap-3 py-4 transition hover:bg-black/[.018] sm:grid-cols-[minmax(0,1.5fr)_6.875rem_7.5rem_8.75rem_8.75rem_1.125rem] sm:items-center sm:px-2">
          <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-black/[.045] text-black/35">{attached.length ? <FileCheck2 size={17}/> : <FileText size={17}/>}</span><div className="min-w-0"><p className="truncate text-[0.8125rem] font-semibold text-black/75">{contract.titulo || "Contrato"}</p><p className="mt-1 flex items-center gap-1 text-[0.625rem] text-black/30"><Paperclip size={10}/>{attached.length ? `${attached.length} arquivo${attached.length === 1 ? "" : "s"}` : "Sem arquivo"}{contract.numero ? ` · ${contract.numero}` : ""}</p></div></div>
          <div><p className="text-[0.625rem] text-black/25">Situação</p><p className="mt-1 text-[0.6875rem] font-medium" style={{ color: meta.color }}>{meta.label}</p></div>
          <div><p className="text-[0.625rem] text-black/25">Valor</p><p className="mt-1 text-[0.6875rem] font-semibold tabular-nums text-black/60">{money(contract.valor)}</p></div>
          <div><p className="text-[0.625rem] text-black/25">Vigência</p><p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-black/45"><CalendarDays size={11}/>{contract.data_inicio || contract.data_fim ? `${date(contract.data_inicio)} — ${date(contract.data_fim)}` : "Não informada"}</p></div>
          <div><p className="text-[0.625rem] text-black/25">Agência</p><p className="mt-1 flex items-center gap-1 truncate text-[0.6875rem] font-medium text-black/50"><Handshake size={11}/>{agency?.captador?.nome ?? "Sem agência"}</p></div>
          <ArrowUpRight size={14} className="text-black/20 transition group-hover:text-[#7259B5]"/>
        </Link>;
      })}</div>}

    {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}><form onSubmit={save} onClick={event => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded border border-black/[.09] bg-white shadow-[0_24px_70px_rgba(13,13,13,.16)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.07] bg-white px-5 py-4"><div><p className="text-[0.625rem] text-black/30">Novo contrato</p><h3 className="mt-0.5 text-[0.9375rem] font-semibold text-black/80">Anexar contrato</h3></div><button type="button" onClick={closeForm} className="rounded p-1.5 text-black/30 hover:bg-black/[.04]"><X size={15}/></button></header>
      <div className="space-y-4 p-5">
        <label><Label>Arquivo</Label><button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-24 w-full items-center justify-center gap-2 rounded border border-dashed border-black/[.14] bg-black/[.012] px-5 text-[0.75rem] font-medium text-black/40 transition hover:bg-black/[.03]"><Upload size={16}/>{file ? file.name : "Selecionar contrato"}</button><input ref={fileRef} type="file" className="hidden" onChange={event => { const selected = event.target.files?.[0]; if (selected) chooseFile(selected); }}/><p className="mt-1.5 text-[0.625rem] text-black/25">PDF, DOCX ou outro formato, até 50 MB</p></label>
        <label><Label>Título</Label><input value={title} onChange={event => setTitle(event.target.value)} required placeholder="Ex.: Contrato de patrocínio 2026" className={fieldClass}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label>Situação</Label><input type="hidden" name="status" value={status}/><CustomDropdown value={status} onChange={setStatus} options={[{value:"proposta",label:"Minuta"},{value:"assinado",label:"Assinado"},{value:"vigente",label:"Vigente"},{value:"renovado",label:"Renovado"},{value:"encerrado",label:"Encerrado"}]} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div><label><Label>Valor</Label><input name="valor" inputMode="decimal" placeholder="R$" className={fieldClass}/></label></div>
        <div><Label>Agência de captação</Label><CustomDropdown value={agencyId} onChange={setAgencyId} options={[{value:"",label:"Sem agência vinculada"},...agencies.map(agency => ({value:agency.id,label:agency.nome}))]} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div>
        <button type="button" onClick={() => setShowDetails(value => !value)} className="text-[0.6875rem] font-medium text-[#7259B5]">{showDetails ? "Ocultar detalhes" : "Adicionar número, datas e observações"}</button>
        {showDetails && <div className="grid gap-4 border-t border-black/[.06] pt-4 sm:grid-cols-2"><label><Label>Número ou referência</Label><input name="numero" className={fieldClass}/></label><label><Label>Data de assinatura</Label><input name="data_assinatura" type="date" className={fieldClass}/></label><label><Label>Início da vigência</Label><input name="data_inicio" type="date" className={fieldClass}/></label><label><Label>Fim da vigência</Label><input name="data_fim" type="date" className={fieldClass}/></label><label><Label>Próxima renovação</Label><input name="proxima_renovacao" type="date" className={fieldClass}/></label><div><Label>Renovação automática</Label><input type="hidden" name="renovacao_automatica" value={automaticRenewal}/><CustomDropdown value={automaticRenewal} onChange={setAutomaticRenewal} options={[{value:"false",label:"Não"},{value:"true",label:"Sim"}]} compact portalZIndex={100} className="w-full [&>button]:h-10 [&>button]:w-full"/></div><label className="sm:col-span-2"><Label>Observações</Label><textarea name="notas" rows={3} className={`${fieldClass} h-auto resize-none py-2.5`}/></label></div>}
        {error && <p className="rounded border border-[#D94E4E]/20 bg-[#D94E4E]/[.03] px-3 py-2 text-[0.6875rem] text-[#D94E4E]">{error}</p>}
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-black/[.07] bg-white px-5 py-4"><button type="button" onClick={closeForm} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button disabled={saving || !file || !title.trim()} className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40">{saving ? "Salvando…" : "Salvar"}</button></footer>
    </form></div>}
  </section>;
}

const fieldClass = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 outline-none transition focus:border-[#7259B5]/50";
function Label({ children }: { children: React.ReactNode }) { return <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">{children}</span>; }
