"use client";
import { useState, useEffect, useId, useRef } from "react";
import {
  X, Plus, FileText, FilePen, FileCheck, FileSearch, FileImage, Archive,
  Trash2, Eye, Upload, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Escopo = "edital" | "projeto";

type Doc = {
  id: string;
  titulo: string;
  icone: string;
  cor: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  inscricao_id: string | null;
  projeto_id: string | null;
};

type Props = {
  inscricaoId: string;
  projetoId: string | null;
  onClose: () => void;
};

/* ─── Constants ─────────────────────────────────────────────────────────── */

const ICONE_MAP: Record<string, React.ElementType> = {
  "file-text":   FileText,
  "file-pen":    FilePen,
  "file-check":  FileCheck,
  "file-search": FileSearch,
  "file-image":  FileImage,
  "archive":     Archive,
};
const ICONES = Object.keys(ICONE_MAP);

const COR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  azul:    { bg: "#DBEAFE", text: "#2D72B0", border: "#93C5FD" },
  pessego: { bg: "#D94E4E14", text: "#D94E4E", border: "#D94E4E80" },
  verde:   { bg: "#2E893214", text: "#2E8932", border: "#2E893280" },
  roxo:    { bg: "#7259B514", text: "#7259B5", border: "#7259B580" },
};
const CORES = Object.keys(COR_MAP);

/* ─── Form modal (inner) ─────────────────────────────────────────────────── */

function DocForm({
  inscricaoId, projetoId, escopo, doc, onClose, onSaved,
}: {
  inscricaoId: string;
  projetoId: string | null;
  escopo: Escopo;
  doc: Doc | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase   = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [titulo,   setTitulo]   = useState(doc?.titulo ?? "");
  const [icone,    setIcone]    = useState(doc?.icone  ?? "file-text");
  const [cor,      setCor]      = useState(doc?.cor    ?? "azul");
  const [file,     setFile]     = useState<File | null>(null);
  const [fileName, setFileName] = useState(doc?.arquivo_nome ?? "");
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewing,  setViewing]  = useState(false);
  const [erro,     setErro]     = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  async function handleSave() {
    if (!titulo.trim()) return;
    setSaving(true);
    setErro(null);
    try {
      let arquivo_url  = doc?.arquivo_url  ?? null;
      let arquivo_nome = doc?.arquivo_nome ?? null;

      if (file) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setErro("Sessão expirada. Entre novamente para enviar o arquivo."); return; }
        const ext  = file.name.split(".").pop();
        const path = `${user.id}/${escopo === "edital" ? inscricaoId : projetoId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("documentos-inscricao")
          .upload(path, file, { upsert: true });
        if (upErr) { setErro(`Não foi possível enviar o arquivo: ${upErr.message}`); return; }
        const { data: urlData } = supabase.storage.from("documentos-inscricao").getPublicUrl(path);
        arquivo_url  = urlData.publicUrl;
        arquivo_nome = file.name;
      }

      const payload = {
        titulo:         titulo.trim(),
        icone,
        cor,
        arquivo_url,
        arquivo_nome,
        arquivo_tamanho: file?.size ?? null,
        inscricao_id:    escopo === "edital" ? inscricaoId : null,
        projeto_id:      escopo === "projeto" ? projetoId  : null,
      };

      const { error: dbErr } = doc
        ? await (supabase as any).from("documentos_inscricao").update(payload).eq("id", doc.id)
        : await (supabase as any).from("documentos_inscricao").insert(payload);
      if (dbErr) { setErro(`Não foi possível salvar o documento: ${dbErr.message}`); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!doc) return;
    confirmDelete({
      title: `Excluir o documento “${doc.titulo}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setDeleting(true);
        try {
          await excluirPorId(supabase, "documentos_inscricao", doc.id);
        } finally {
          setDeleting(false);
        }
        onSaved();
      },
    });
  }

  async function handleView() {
    if (!doc?.arquivo_url) return;
    setViewing(true);
    window.open(doc.arquivo_url, "_blank");
    setViewing(false);
  }

  const SelectedIcon = ICONE_MAP[icone] ?? FileText;
  const corStyle = COR_MAP[cor] ?? COR_MAP.azul;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,.5)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-white rounded border w-[480px] max-w-[92vw] max-h-[90vh] flex flex-col shadow-2xl"
        style={{ borderColor: "rgba(13,13,13,.12)" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2.5">
            <SelectedIcon size={16} className="text-black/40" />
            <span id={titleId} className="text-[13px] font-bold text-black">
              {doc ? "Editar documento" : "Novo documento"}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded hover:bg-black/6 text-black/30 hover:text-black/60 transition">
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Título */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-black/35 block mb-1.5">
              Título do documento
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Plano de trabalho"
              className="w-full px-3 py-2.5 text-sm border rounded bg-transparent text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>

          {/* Ícone */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-black/35 block mb-2">
              Ícone
            </label>
            <div className="flex gap-2 flex-wrap">
              {ICONES.map(key => {
                const Icon = ICONE_MAP[key];
                return (
                  <button
                    key={key}
                    onClick={() => setIcone(key)}
                    className={`w-10 h-10 rounded flex items-center justify-center transition border ${
                      icone === key
                        ? "bg-white text-[#7259B5] border-[#7259B5]/25"
                        : "text-black/40 hover:bg-black/[.04] border-transparent"
                    }`}
                  >
                    <Icon size={17} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-black/35 block mb-2">
              Cor
            </label>
            <div className="flex gap-2.5">
              {CORES.map(c => {
                const { bg, border } = COR_MAP[c];
                return (
                  <button
                    key={c}
                    onClick={() => setCor(c)}
                    className="w-10 h-10 rounded transition"
                    style={{
                      background: bg,
                      border: `2px solid ${cor === c ? border.replace("FD", "80").replace("AC", "80") : "transparent"}`,
                      outline: cor === c ? `2px solid ${border}` : "none",
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Upload */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-black/35 block mb-1.5">
              Upload do documento <span className="font-normal normal-case text-black/25">(máx. 25 MB)</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border rounded p-4 text-center cursor-pointer hover:bg-black/[.02] transition"
              style={{ borderColor: "rgba(13,13,13,.12)", borderStyle: "dashed" }}
            >
              <Upload size={16} className="mx-auto mb-1.5 text-black/25" />
              <p className="text-xs text-black/40 font-medium">
                {fileName || "Clique para subir documento"}
              </p>
              {file && (
                <p className="text-[10px] text-black/25 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f && f.size <= 25 * 1024 * 1024) { setFile(f); setFileName(f.name); }
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pb-5 space-y-2">
          {erro && <p role="alert" className="text-[12px] text-[#B23A3A]">{erro}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !titulo.trim()}
            className="w-full py-2.5 rounded text-sm font-medium text-white bg-[#2E8932] hover:bg-[#26752A] transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Salvar
          </button>

          {doc && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleView}
                disabled={!doc.arquivo_url || viewing}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#7259B5] hover:opacity-70 transition disabled:opacity-30"
              >
                <Eye size={12} /> Visualizar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs font-semibold text-black/35 hover:text-[#D94E4E] transition"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Docs modal (outer) ─────────────────────────────────────────────────── */

export function DocumentosModal({ inscricaoId, projetoId, onClose }: Props) {
  const supabase = createClient();
  const [tab,        setTab]        = useState<Escopo>("projeto");
  const [docs,       setDocs]       = useState<Doc[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  useModalDismiss(onClose);

  async function fetchDocs() {
    setLoading(true);
    const q = (supabase as any).from("documentos_inscricao").select("*");
    const { data } = tab === "edital"
      ? await q.eq("inscricao_id", inscricaoId)
      : projetoId
      ? await q.eq("projeto_id", projetoId)
      : { data: [] };
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  }

  useEffect(() => { fetchDocs(); }, [tab]);

  function openForm(doc?: Doc) {
    setEditingDoc(doc ?? null);
    setShowForm(true);
  }

  const corStyle = (cor: string) => COR_MAP[cor] ?? COR_MAP.azul;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }}>
        <div role="dialog" aria-modal="true" aria-label="Documentos"
          className="bg-white rounded border shadow-2xl w-[540px] max-w-[92vw] max-h-[85vh] flex flex-col"
          style={{ borderColor: "rgba(13,13,13,.10)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
            style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="flex gap-1 rounded overflow-hidden border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
              {(["projeto","edital"] as Escopo[]).map((t, i) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-xs font-bold transition capitalize ${i > 0 ? "border-l" : ""} ${
                    tab === t ? "bg-white text-[#7259B5]" : "text-black/40 hover:bg-black/[.04]"
                  }`}
                  style={{ borderColor: "rgba(13,13,13,.12)" }}>
                  {t === "projeto" ? "Projeto" : "Edital"}
                </button>
              ))}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded hover:bg-black/6 text-black/30 hover:text-black/60 transition">
              <X size={14} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="py-10 text-center text-xs text-black/30">Carregando…</div>
            ) : docs.length === 0 ? (
              <div className="py-14 text-center">
                <FileText size={24} className="text-black/15 mx-auto mb-2" />
                <p className="text-xs text-black/30 font-semibold">
                  Nenhum documento {tab === "edital" ? "neste edital" : "neste projeto"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {docs.map(doc => {
                  const cs   = corStyle(doc.cor);
                  const Icon = ICONE_MAP[doc.icone] ?? FileText;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => openForm(doc)}
                      className="rounded border p-4 text-left hover:shadow-sm transition relative group"
                      style={{ background: cs.bg, borderColor: cs.border + "80" }}
                    >
                      <Icon size={22} className="mb-2" style={{ color: cs.text }} />
                      <p className="text-[12px] font-bold" style={{ color: cs.text }}>{doc.titulo}</p>
                      {doc.arquivo_nome && (
                        <p className="text-[10px] mt-1 truncate" style={{ color: cs.text, opacity: .6 }}>
                          {doc.arquivo_nome}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add button */}
          <div className="px-5 pb-4 pt-2 flex-shrink-0 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button
              onClick={() => openForm()}
              disabled={tab === "projeto" && !projetoId}
              className="w-full py-2.5 rounded border border-dashed text-xs font-bold text-black/35 hover:text-[#7259B5] hover:border-[#7259B5]/40 transition flex items-center justify-center gap-1.5 disabled:opacity-30"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            >
              <Plus size={12} />
              Adicionar documento {tab === "edital" ? "do edital" : "do projeto"}
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <DocForm
          inscricaoId={inscricaoId}
          projetoId={projetoId}
          escopo={tab}
          doc={editingDoc}
          onClose={() => { setShowForm(false); setEditingDoc(null); }}
          onSaved={() => { setShowForm(false); setEditingDoc(null); fetchDocs(); }}
        />
      )}
    </>
  );
}
