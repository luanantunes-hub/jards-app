"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronDown, Download, FileText, Handshake, Paperclip, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound } from "@/components/ui/DetailPagePrimitives";
import { excluirDocumento } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { CompanyLogo } from "@/components/CompanyLogo";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type Contract = {
  id: string; account_id: string; organization_id: string; conta_patrocinio_id: string; titulo: string | null; numero: string | null;
  valor: number; status: string; data_assinatura: string | null; data_inicio: string | null; data_fim: string | null;
  proxima_renovacao: string | null; renovacao_automatica: boolean; notas: string | null;
  rascunho_automatico: boolean; origem_tipo: string | null; captacao_id: string | null; edital_user_id: string | null;
};
type Account = { id: string; nome: string | null; empresa_crm: { nome: string; domain_key: string | null; site: string | null } | null };
type DocumentRow = { id: string; nome: string; arquivo_nome: string | null; tipo: string | null; tamanho: number | null; url: string; created_at: string };
type DeliveryRow = { id: string; titulo: string; status: string; prazo: string | null };
type Renewal = { cenario: string; valor_esperado: number | null; probabilidade: number | null; data_esperada: string | null };
type Agency = { id: string; nome: string };
type AgencyParticipation = { id: string; captador_id: string; captador: Agency | null };

const MAX_BYTES = 50 * 1024 * 1024;
const STATUS = [["proposta","Minuta"],["assinado","Assinado"],["vigente","Vigente"],["renovado","Renovado"],["encerrado","Encerrado"]] as const;
const STATUS_COLOR: Record<string,string> = { proposta:"#B07A14", assinado:"#2D72B0", vigente:"#2E8932", renovado:"#1A8B7A", encerrado:"#777777" };
function date(value: string | null) { return value ? new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

export default function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [renewal, setRenewal] = useState<Renewal | null>(null);
  const [agencyParticipation, setAgencyParticipation] = useState<AgencyParticipation | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const contractResult = await (supabase as any).from("contratos").select("*").eq("id", id).single();
    if (contractResult.error || !contractResult.data) { setContract(null); setError(contractResult.error?.message ?? "Contrato não encontrado."); setLoading(false); return; }
    const row = contractResult.data as Contract; setContract(row);
    const [accountResult, documentResult, deliveryResult, renewalResult, agencyResult, agenciesResult] = await Promise.all([
      (supabase as any).from("contas_patrocinio").select("id,nome,empresa_crm:empresas_crm!empresa_crm_id(nome,domain_key,site)").eq("id", row.conta_patrocinio_id).single(),
      (supabase as any).from("documentos").select("id,nome,arquivo_nome,tipo,tamanho,url,created_at").eq("contrato_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("compromissos_cliente").select("id,titulo,status,prazo").eq("contrato_id", id).order("prazo", { ascending: true, nullsFirst: false }),
      (supabase as any).from("previsoes_renovacao").select("cenario,valor_esperado,probabilidade,data_esperada").eq("contrato_id", id).maybeSingle(),
      (supabase as any).from("participacoes_agencia_cliente").select("id,captador_id,captador:captadores!captador_id(id,nome)").eq("contrato_id", id).eq("status", "ativa").order("papel").limit(1).maybeSingle(),
      (supabase as any).from("captadores").select("id,nome").eq("organization_id", row.organization_id).or("ativo.eq.true,ativo.is.null").order("nome"),
    ]);
    setAccount(accountResult.data as Account | null); setDocuments((documentResult.data ?? []) as DocumentRow[]);
    setDeliveries((deliveryResult.data ?? []) as DeliveryRow[]); setRenewal(renewalResult.data as Renewal | null);
    setAgencyParticipation(agencyResult.data as AgencyParticipation | null); setAgencies((agenciesResult.data ?? []) as Agency[]);
    setError(documentResult.error?.message ?? deliveryResult.error?.message ?? null); setLoading(false);
  }, [id, supabase]);
  useEffect(() => { void load(); }, [load]);

  async function upload(file: File) {
    if (!contract) return;
    if (file.size > MAX_BYTES) { setError("O arquivo deve ter até 50 MB."); return; }
    setUploading(true); setError(null);
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const path = `${contract.organization_id}/contratos/${contract.id}/${crypto.randomUUID()}${ext}`;
    const storage = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (storage.error) { setError(storage.error.message); setUploading(false); return; }
    const insert = await (supabase as any).from("documentos").insert({ account_id: contract.account_id, organization_id: contract.organization_id, conta_patrocinio_id: contract.conta_patrocinio_id, contrato_id: contract.id, nome: file.name.replace(/\.[^.]+$/, ""), arquivo_nome: file.name, categoria: "contrato", tipo: file.type || null, tamanho: file.size, url: path });
    if (insert.error) {
      await supabase.storage.from("documentos").remove([path]);
      setError(insert.error.message);
    } else {
      await (supabase as any).from("contratos").update({ rascunho_automatico: false }).eq("id", contract.id);
      await load();
    }
    setUploading(false);
  }
  async function open(document: DocumentRow) { const result = await supabase.storage.from("documentos").createSignedUrl(document.url, 3600); if (result.error) setError(result.error.message); else if (result.data?.signedUrl) window.open(result.data.signedUrl, "_blank", "noopener,noreferrer"); }
  function remove(document: DocumentRow) { confirmDelete({ title: `Excluir o documento “${document.nome}”?`, description: "O arquivo deixa de estar disponível para toda a equipe.", onConfirm: async () => { await excluirDocumento(supabase, document); await load(); } }); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const raw = String(data.get("valor") ?? "").replace(/\./g, "").replace(",", ".");
    const result = await (supabase as any).from("contratos").update({ titulo:String(data.get("titulo")||"").trim()||null, numero:String(data.get("numero")||"").trim()||null, valor:Number(raw||0), status:data.get("status"), data_assinatura:data.get("data_assinatura")||null, data_inicio:data.get("data_inicio")||null, data_fim:data.get("data_fim")||null, proxima_renovacao:data.get("proxima_renovacao")||null, renovacao_automatica:data.get("renovacao_automatica")==="true", notas:String(data.get("notas")||"").trim()||null, rascunho_automatico:false }).eq("id", id);
    if (result.error) { setError(result.error.message); return; }
    const nextAgencyId = String(data.get("agency_id") ?? "");
    if (agencyParticipation && agencyParticipation.captador_id !== nextAgencyId) {
      const ended = await (supabase as any).from("participacoes_agencia_cliente").update({ status: "encerrada", data_fim: new Date().toISOString().slice(0, 10) }).eq("id", agencyParticipation.id);
      if (ended.error) { setError(ended.error.message); return; }
    }
    if (nextAgencyId && agencyParticipation?.captador_id !== nextAgencyId) {
      const linked = await (supabase as any).from("participacoes_agencia_cliente").upsert({
        account_id: contract?.account_id, organization_id: contract?.organization_id,
        conta_patrocinio_id: contract?.conta_patrocinio_id, contrato_id: id,
        captador_id: nextAgencyId, papel: "principal", status: "ativa", data_fim: null,
      }, { onConflict: "contrato_id,captador_id,papel" });
      if (linked.error) { setError(linked.error.message); return; }
    }
    setEditing(false); await load();
  }

  if (loading) return <div className="mx-auto max-w-pagina animate-pulse px-4 py-10 sm:px-6 lg:px-10"><div className="h-5 w-28 rounded bg-black/[.06]"/><div className="mt-8 h-28 rounded bg-black/[.04]"/><div className="mt-6 h-80 rounded bg-black/[.04]"/></div>;
  if (!contract || !account) return <DetailNotFound title="Contrato não encontrado" description={error && error !== "Contrato não encontrado." ? error : undefined} backHref="/contas-patrocinio" backLabel="Clientes" />;
  const companyName = account.empresa_crm?.nome || account.nome || "Cliente";
  const statusColor = STATUS_COLOR[contract.status] ?? "rgba(13,13,13,.45)";
  const statusLabel = STATUS.find(item=>item[0]===contract.status)?.[1]||contract.status;

  return <div className="min-h-full">
    <header className="border-b border-black/[.07]"><div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
      <Link href={`/contas-patrocinio/${contract.conta_patrocinio_id}`} className="inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 hover:text-black/65"><ArrowLeft size={14}/>Cliente</Link>
      <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 items-start gap-4"><CompanyLogo nome={companyName} domain={account.empresa_crm?.domain_key} site={account.empresa_crm?.site} size={48}/><div className="min-w-0"><p className="text-[0.6875rem] font-medium text-black/35">Contrato · {companyName}</p><h1 className="mt-1.5 max-w-3xl text-[1.875rem] font-semibold leading-tight tracking-[-.04em] text-black">{contract.titulo || "Contrato"}</h1><div className="mt-2 flex items-center gap-2 text-[0.6875rem]"><span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: statusColor.startsWith("#") ? `${statusColor}47` : "rgba(13,13,13,.12)", color: statusColor }}>{statusLabel}</span>{contract.numero && <><span className="text-black/15">·</span><span className="text-black/35">{contract.numero}</span></>}</div></div></div><button onClick={()=>setEditing(true)} className="inline-flex h-10 items-center gap-2 self-start rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 hover:bg-black/[.04]"><Pencil size={13}/>Editar</button></div>
    </div></header>
    <main className="mx-auto grid max-w-pagina gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-10 lg:py-10">
      {error && <p className="rounded border border-[#D94E4E]/20 px-3 py-2 text-[0.6875rem] text-[#D94E4E] lg:col-span-2">{error}</p>}
      <div className="space-y-6">
        <section className="overflow-hidden rounded border border-black/[.08] bg-white"><SectionHeader icon={Paperclip} title="Documento do contrato" action={<><input ref={fileRef} type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value="";}}/><button onClick={()=>fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/25 bg-white px-3 py-2 text-[0.6875rem] font-medium text-[#7259B5] hover:bg-black/[.04] disabled:opacity-40"><Upload size={12}/>{uploading?"Enviando…":"Adicionar arquivo"}</button></>}/>{documents.length?<div className="divide-y divide-black/[.06]">{documents.map(document=><div key={document.id} className="group flex items-center gap-3 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded bg-black/[.045] text-black/35"><FileText size={15}/></span><div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/70">{document.nome}</p><p className="mt-1 text-[0.625rem] text-black/25">{document.arquivo_nome||"Arquivo"} · {formatSize(document.tamanho)} · {new Date(document.created_at).toLocaleDateString("pt-BR")}</p></div><button onClick={()=>void open(document)} className="rounded p-2 text-black/25 hover:bg-black/[.04] hover:text-[#7259B5]" title="Abrir"><Download size={13}/></button><button onClick={()=>void remove(document)} className="rounded p-2 text-black/20 opacity-0 hover:bg-black/[.04] hover:text-[#D94E4E] group-hover:opacity-100" title="Excluir"><Trash2 size={13}/></button></div>)}</div>:<Empty text="Este registro ainda não possui arquivo."/>}</section>
        <section className="overflow-hidden rounded border border-black/[.08] bg-white"><SectionHeader icon={FileText} title="Observações"/><div className="min-h-28 p-5 text-[0.8125rem] leading-6 text-black/55">{contract.notas||<span className="text-black/25">Nenhuma observação registrada.</span>}</div></section>
        <section className="overflow-hidden rounded border border-black/[.08] bg-white"><SectionHeader icon={FileText} title="Entregas deste contrato"/>{deliveries.length?<div className="divide-y divide-black/[.06]">{deliveries.map(item=><Link key={item.id} href={`/entregas/${item.id}`} className="group flex items-center gap-3 px-5 py-4 hover:bg-black/[.018]"><div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/65">{item.titulo}</p><p className="mt-1 text-[0.625rem] text-black/30">{item.status.replaceAll("_"," ")} · {item.prazo?date(item.prazo):"Sem prazo"}</p></div><ArrowUpRight size={13} className="text-black/20 group-hover:text-[#7259B5]"/></Link>)}</div>:<Empty text="Nenhuma entrega vinculada."/>}</section>
      </div>
      <aside className="space-y-4"><Info icon={FileText} label="Valor contratado" value={contract.valor?formatarValorCurto(contract.valor):"Não informado"} title={contract.valor?formatarValorCompleto(contract.valor):undefined} vazio={!contract.valor}/><Info icon={Handshake} label="Agência de captação" value={agencyParticipation?.captador?.nome ?? "Sem agência"} vazio={!agencyParticipation?.captador?.nome}/><Info icon={CalendarDays} label="Vigência" value={contract.data_inicio||contract.data_fim?`${date(contract.data_inicio)} — ${date(contract.data_fim)}`:"Não informada"} vazio={!contract.data_inicio&&!contract.data_fim}/><Info icon={RefreshCw} label="Renovação" value={contract.proxima_renovacao?date(contract.proxima_renovacao):renewal?.data_esperada?date(renewal.data_esperada):"Sem previsão"} vazio={!contract.proxima_renovacao&&!renewal?.data_esperada}/>{renewal&&<Info icon={RefreshCw} label="Cenário" value={`${renewal.cenario}${renewal.probabilidade!=null?` · ${renewal.probabilidade}%`:""}`} leitura/>}</aside>
    </main>
    {editing&&<EditContract contract={contract} agencies={agencies} agencyId={agencyParticipation?.captador_id ?? ""} onClose={()=>setEditing(false)} onSubmit={save}/>} 
  </div>;
}

function SectionHeader({icon:Icon,title,action}:{icon:typeof FileText;title:string;action?:React.ReactNode}){return <header className="flex items-center justify-between border-b border-black/[.06] px-5 py-4"><div className="flex items-center gap-2"><Icon size={14} className="text-black/35"/><h2 className="text-[0.8125rem] font-semibold text-black/65">{title}</h2></div>{action}</header>}
function Empty({text}:{text:string}){return <p className="px-5 py-10 text-center text-[0.75rem] text-black/25">{text}</p>}
function Info({icon:Icon,label,value,title,vazio=false,leitura=false}:{icon:typeof FileText;label:string;value:string;title?:string;vazio?:boolean;leitura?:boolean}){return <div className="rounded border border-black/[.08] bg-white p-4"><div className="flex items-center gap-1.5"><Icon size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40"/><p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{label}</p></div><p title={title} className={`mt-2 text-[0.8125rem] font-semibold ${leitura?"":"tabular-nums "}${vazio?"text-black/30":leitura?"text-black/65":"text-[#0D0D0D]"}`}>{value}</p></div>}
function formatSize(bytes:number|null){if(!bytes)return "—";return bytes<1024*1024?`${Math.ceil(bytes/1024)} KB`:`${(bytes/1024/1024).toFixed(1).replace(".",",")} MB`}
const field="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black/70 outline-none focus:border-[#7259B5]/50";
function Label({children}:{children:React.ReactNode}){return <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">{children}</span>}
function EditContract({contract,agencies,agencyId,onClose,onSubmit}:{contract:Contract;agencies:Agency[];agencyId:string;onClose:()=>void;onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void}) {
  const [status, setStatus] = useState(contract.status);
  const [automaticRenewal, setAutomaticRenewal] = useState(String(contract.renovacao_automatica));
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><form onSubmit={onSubmit} onClick={event=>event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded border border-black/[.09] bg-white shadow-[0_24px_70px_rgba(13,13,13,.16)]">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[.07] bg-white px-5 py-4"><h2 className="text-[0.9375rem] font-semibold text-black/80">Editar contrato</h2><button type="button" onClick={onClose} className="rounded p-1.5 text-black/30 hover:bg-black/[.04]"><X size={15}/></button></header>
    <div className="grid gap-4 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><Label>Título</Label><input name="titulo" required defaultValue={contract.titulo||""} className={field}/></label><label><Label>Número ou referência</Label><input name="numero" defaultValue={contract.numero||""} className={field}/></label><label><Label>Situação</Label><InternalDropdown name="status" value={status} onChange={setStatus} options={STATUS.map(([value,label])=>({value,label}))}/></label><label className="sm:col-span-2"><Label>Valor</Label><input name="valor" inputMode="decimal" defaultValue={contract.valor||""} className={field}/></label><label className="sm:col-span-2"><Label>Agência de captação</Label><InternalDropdown name="agency_id" initialValue={agencyId} options={[{value:"",label:"Sem agência vinculada"},...agencies.map(agency=>({value:agency.id,label:agency.nome}))]}/></label><label><Label>Data de assinatura</Label><input name="data_assinatura" type="date" defaultValue={contract.data_assinatura?.split("T")[0]||""} className={field}/></label><label><Label>Início</Label><input name="data_inicio" type="date" defaultValue={contract.data_inicio?.split("T")[0]||""} className={field}/></label><label><Label>Fim</Label><input name="data_fim" type="date" defaultValue={contract.data_fim?.split("T")[0]||""} className={field}/></label><label><Label>Próxima renovação</Label><input name="proxima_renovacao" type="date" defaultValue={contract.proxima_renovacao?.split("T")[0]||""} className={field}/></label><label><Label>Renovação automática</Label><InternalDropdown name="renovacao_automatica" value={automaticRenewal} onChange={setAutomaticRenewal} options={[{value:"false",label:"Não"},{value:"true",label:"Sim"}]}/></label><label className="sm:col-span-2"><Label>Observações</Label><textarea name="notas" rows={4} defaultValue={contract.notas||""} className={`${field} h-auto resize-none py-2.5`}/></label></div>
    <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-black/[.07] bg-white px-5 py-4"><button type="button" onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white hover:bg-[#26752A]">Salvar</button></footer>
  </form></div>;
}
function InternalDropdown({name,value:controlledValue,initialValue="",onChange,options}:{name:string;value?:string;initialValue?:string;onChange?:(value:string)=>void;options:Array<{value:string;label:string}>}){const [internalValue,setInternalValue]=useState(initialValue);const [open,setOpen]=useState(false);const value=controlledValue??internalValue;const change=(next:string)=>{setInternalValue(next);onChange?.(next)};const selected=options.find(option=>option.value===value);return <div className="relative"><input type="hidden" name={name} value={value}/><button type="button" onClick={()=>setOpen(current=>!current)} className={`${field} flex items-center justify-between text-left`} aria-expanded={open}><span>{selected?.label}</span><ChevronDown size={13} className={`text-black/30 transition-transform ${open?"rotate-180":""}`}/></button>{open&&<><button type="button" aria-label="Fechar opções" onClick={()=>setOpen(false)} className="fixed inset-0 z-10 cursor-default"/><div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded border border-black/[.1] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,.12)]">{options.map(option=><button key={option.value} type="button" onClick={()=>{change(option.value);setOpen(false)}} className={`flex w-full items-center px-3 py-2 text-left text-[0.75rem] transition hover:bg-black/[.04] ${option.value===value?"font-semibold text-black/75":"text-black/50"}`}>{option.label}{option.value===value&&<span className="ml-auto text-[0.625rem] text-black/30">✓</span>}</button>)}</div></>}</div>}
