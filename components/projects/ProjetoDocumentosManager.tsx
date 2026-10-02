"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirDocumento } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { Select } from "@/components/ui/Select";

const MAX_BYTES = 50 * 1024 * 1024;

type CaptacaoOption = { id: string; titulo: string; empresaNome?: string | null };
type InscricaoOption = { id: string; titulo: string; complemento?: string | null };
type ProjetoDocumento = {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  descricao: string | null;
  categoria: string | null;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  captacao_id: string | null;
  edital_user_id: string | null;
  created_at: string;
};

const CATEGORIAS = [
  ["apresentacao", "Apresentação"],
  ["orcamento", "Orçamento"],
  ["contrato", "Contrato"],
  ["certidao", "Certidão"],
  ["relatorio", "Relatório"],
  ["comprovante", "Comprovante"],
  ["outro", "Outro"],
] as const;

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function DocumentIcon({ type, name }: { type: string | null; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (type?.startsWith("image/")) return <FileImage size={16} />;
  if (type?.includes("spreadsheet") || type?.includes("excel") || ["csv", "xls", "xlsx"].includes(ext ?? "")) return <FileSpreadsheet size={16} />;
  if (["zip", "rar", "7z"].includes(ext ?? "")) return <FileArchive size={16} />;
  if (type?.includes("pdf") || type?.includes("word") || ["pdf", "doc", "docx", "txt", "rtf"].includes(ext ?? "")) return <FileText size={16} />;
  return <File size={16} />;
}

export function ProjetoDocumentosManager({ projetoId, captacoes, inscricoes }: { projetoId: string; captacoes: CaptacaoOption[]; inscricoes: InscricaoOption[] }) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const organizationId = useOrganizationId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [documentos, setDocumentos] = useState<ProjetoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("outro");
  const [captacaoId, setCaptacaoId] = useState("");
  const [inscricaoId, setInscricaoId] = useState("");
  const [contextKind, setContextKind] = useState<"projeto" | "negociacao" | "inscricao">("projeto");
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("documentos")
      .select("id,nome,arquivo_nome,descricao,categoria,tipo,tamanho,url,captacao_id,edital_user_id,created_at")
      .eq("projeto_id", projetoId)
      .order("created_at", { ascending: false });
    if (error) setErro(error.message);
    setDocumentos((data as ProjetoDocumento[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projetoId]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeModal() {
    setShowModal(false);
    setFile(null);
    setTitulo("");
    setDescricao("");
    setCategoria("outro");
    setCaptacaoId("");
    setInscricaoId("");
    setContextKind("projeto");
    setErro(null);
  }

  function chooseFile(selected: File) {
    if (selected.size > MAX_BYTES) { setErro("O arquivo deve ter até 50 MB."); return; }
    setFile(selected);
    if (!titulo) setTitulo(selected.name.replace(/\.[^.]+$/, ""));
    setErro(null);
  }

  async function save() {
    if (!file || !titulo.trim()) { setErro("Informe o título e selecione um arquivo."); return; }
    if (contextKind === "negociacao" && !captacaoId) { setErro("Selecione a negociação."); return; }
    if (contextKind === "inscricao" && !inscricaoId) { setErro("Selecione a inscrição."); return; }
    setSaving(true);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    let orgId = organizationId;
    if (!orgId) {
      const { data } = await supabase.rpc("auth_org_ids");
      orgId = (data as unknown as string[] | null)?.[0] ?? null;
    }
    if (!user || !orgId) { setErro("Não foi possível identificar sua organização."); setSaving(false); return; }

    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const path = `${orgId}/projetos/${projetoId}/${crypto.randomUUID()}${ext}`;
    const { error: uploadError } = await supabase.storage.from("documentos").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) { setErro(uploadError.message); setSaving(false); return; }

    const { error: insertError } = await (supabase as any).from("documentos").insert({
      account_id: user.id,
      organization_id: orgId,
      projeto_id: projetoId,
      captacao_id: contextKind === "negociacao" ? captacaoId || null : null,
      edital_user_id: contextKind === "inscricao" ? inscricaoId || null : null,
      nome: titulo.trim(),
      arquivo_nome: file.name,
      descricao: descricao.trim() || null,
      categoria,
      tipo: file.type || null,
      tamanho: file.size,
      url: path,
    });
    if (insertError) {
      await supabase.storage.from("documentos").remove([path]);
      setErro(insertError.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    closeModal();
    await load();
  }

  async function openDocument(documento: ProjetoDocumento) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(documento.url, 3600);
    if (error) { setErro(error.message); return; }
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function removeDocument(documento: ProjetoDocumento) {
    confirmDelete({
      title: `Excluir o documento “${documento.nome}”?`,
      description: "O arquivo deixa de estar disponível para toda a equipe.",
      onConfirm: async () => {
        await excluirDocumento(supabase, documento);
        await load();
      },
    });
  }

  const filtered = documentos.filter(item => `${item.nome} ${item.arquivo_nome ?? ""} ${item.categoria ?? ""}`.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.6875rem] text-black/35">{documentos.length} arquivo{documentos.length === 1 ? "" : "s"}</p>
        <button onClick={() => setShowModal(true)} className="inline-flex items-center justify-center gap-1.5 rounded border border-black/20 bg-white px-4 py-2 text-[0.75rem] font-semibold text-black/80 transition hover:bg-black/[.04] active:scale-[.98]">
          <Plus size={13} /> Adicionar documento
        </button>
      </div>

      {documentos.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
          <input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar documentos" className="h-9 w-full rounded border border-black/[.1] bg-white pl-9 pr-3 text-[0.75rem] outline-none focus:border-[#7259B5]/50" />
        </div>
      )}

      {erro && !showModal && <p className="rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.06] px-3 py-2 text-[0.6875rem] text-[#B23A3A]">{erro}</p>}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded bg-black/[.035]" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded border border-dashed border-black/[.12] px-6 py-12 text-center">
          <FileText size={22} className="mx-auto text-black/15" />
          <p className="mt-3 text-[0.75rem] font-medium text-black/40">{busca ? "Nenhum documento encontrado" : "Nenhum documento armazenado"}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-black/[.08] bg-white">
          {filtered.map(documento => {
            const captacao = captacoes.find(item => item.id === documento.captacao_id);
            const inscricao = inscricoes.find(item => item.id === documento.edital_user_id);
            const category = CATEGORIAS.find(item => item[0] === documento.categoria)?.[1] ?? "Outro";
            return (
              <div key={documento.id} className="group flex items-center gap-3 border-b border-black/[.06] px-4 py-3 last:border-b-0 hover:bg-black/[.018]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black/[.045] text-black/40"><DocumentIcon type={documento.tipo} name={documento.arquivo_nome ?? documento.nome} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-semibold text-black/75">{documento.nome}</p>
                  <p className="mt-0.5 truncate text-[0.625rem] text-black/30">{category} · {formatSize(documento.tamanho)} · {formatDate(documento.created_at)}{captacao ? ` · ${captacao.empresaNome || captacao.titulo}` : inscricao ? ` · ${inscricao.titulo}` : " · Projeto"}</p>
                </div>
                <button onClick={() => void openDocument(documento)} title="Abrir" className="rounded p-2 text-black/25 transition hover:bg-[#7259B5]/10 hover:text-[#7259B5]"><Download size={13} /></button>
                <button onClick={() => void removeDocument(documento)} title="Excluir" className="rounded p-2 text-black/20 opacity-0 transition hover:bg-[#D94E4E]/[.06] hover:text-[#D94E4E] group-hover:opacity-100"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onClick={closeModal}>
          <div className="w-full max-w-lg overflow-hidden rounded border border-black/[.09] bg-white shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-black/[.07] px-5 py-4"><h3 className="text-[0.875rem] font-semibold text-black/80">Adicionar documento</h3><button onClick={closeModal} className="rounded p-1.5 text-black/30 hover:bg-black/[.05]"><X size={14} /></button></div>
            <div className="space-y-4 p-5">
              <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Título</label><input value={titulo} onChange={event => setTitulo(event.target.value)} className="h-10 w-full rounded border border-black/[.12] px-3 text-[0.8125rem] outline-none focus:border-[#7259B5]/50" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Categoria</label><Select value={categoria} onChange={event => setCategoria(event.target.value)} className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] outline-none">{CATEGORIAS.map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</Select></div>
                <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Contexto</label><Select value={contextKind} onChange={event => { setContextKind(event.target.value as "projeto" | "negociacao" | "inscricao"); setCaptacaoId(""); setInscricaoId(""); }} className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] outline-none"><option value="projeto">Projeto inteiro</option><option value="negociacao">Negociação específica</option><option value="inscricao">Inscrição específica</option></Select></div>
              </div>
              {contextKind === "negociacao" && <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Negociação</label><Select value={captacaoId} onChange={event => setCaptacaoId(event.target.value)} className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] outline-none"><option value="">Selecione</option>{captacoes.map(item => <option key={item.id} value={item.id}>{item.titulo}{item.empresaNome ? ` · ${item.empresaNome}` : ""}</option>)}</Select></div>}
              {contextKind === "inscricao" && <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Inscrição</label><Select value={inscricaoId} onChange={event => setInscricaoId(event.target.value)} className="h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] outline-none"><option value="">Selecione</option>{inscricoes.map(item => <option key={item.id} value={item.id}>{item.titulo}{item.complemento ? ` · ${item.complemento}` : ""}</option>)}</Select></div>}
              <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Descrição</label><textarea value={descricao} onChange={event => setDescricao(event.target.value)} rows={3} className="w-full resize-none rounded border border-black/[.12] px-3 py-2.5 text-[0.8125rem] outline-none focus:border-[#7259B5]/50" /></div>
              <div><label className="mb-1.5 block text-[0.6875rem] font-semibold text-black/55">Arquivo</label><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-20 w-full items-center justify-center gap-2 rounded border border-dashed border-black/[.14] px-4 text-[0.75rem] text-black/40 transition hover:bg-black/[.02]"><Upload size={15} /> {file ? file.name : "Selecionar arquivo"}</button><input ref={inputRef} type="file" className="hidden" onChange={event => { const selected = event.target.files?.[0]; if (selected) chooseFile(selected); }} /><p className="mt-1.5 text-[0.625rem] text-black/25">Qualquer formato, até 50 MB.</p></div>
              {erro && <p className="rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.06] px-3 py-2 text-[0.6875rem] text-[#B23A3A]">{erro}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-black/[.07] px-5 py-4"><button onClick={closeModal} className="text-[0.75rem] font-semibold text-black/35 hover:text-black/55">Cancelar</button><button onClick={() => void save()} disabled={saving || !file || !titulo.trim()} className="rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40">{saving ? "Salvando…" : "Salvar"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
