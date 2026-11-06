"use client";
import { useId, useRef, useState } from "react";
import { X, Upload, FileText, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { Select } from "@/components/ui/Select";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const MAX_MB = 50;

export function PropostaUploadModal({
  projetoId,
  captacoes = [],
  captacaoId,
  onClose,
  onSaved,
}: {
  projetoId: string;
  captacoes?: { id: string; titulo: string; empresaNome?: string | null }[];
  captacaoId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase      = createClient();
  const orgId         = useOrganizationId();
  const inputRef      = useRef<HTMLInputElement>(null);

  const [titulo,    setTitulo]    = useState("");
  const [captacaoSelecionada, setCaptacaoSelecionada] = useState(captacaoId ?? "");
  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [erro,      setErro]      = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  function pickFile(f: File) {
    if (f.type !== "application/pdf") { setErro("Somente arquivos PDF são aceitos."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setErro(`O arquivo deve ter até ${MAX_MB} MB.`); return; }
    setErro(null);
    setFile(f);
    if (!titulo) setTitulo(f.name.replace(/\.pdf$/i, ""));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleSalvar() {
    if (!file)   { setErro("Selecione um arquivo PDF."); return; }
    if (!titulo.trim()) { setErro("Informe um título para a proposta."); return; }

    setSaving(true);
    setErro(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado."); setSaving(false); return; }

    const ext  = "pdf";
    const path = `${user.id}/${projetoId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("propostas")
      .upload(path, file, { contentType: "application/pdf", upsert: false });

    if (upErr) { setErro(upErr.message); setSaving(false); return; }

    const { data: urlData } = supabase.storage.from("propostas").getPublicUrl(path);

    const payload = {
      projeto_id:      projetoId,
      captacao_id:     captacaoSelecionada || null,
      organization_id: orgId,
      titulo:          titulo.trim(),
      pdf_url:         urlData.publicUrl,
      pdf_nome:        file.name,
      slide_capa:      {},
      slide_historia:  {},
      slide_numeros:   {},
      slide_contato:   {},
    };

    const { error: dbErr } = await (supabase as any).from("propostas").insert(payload);
    if (dbErr) {
      await supabase.storage.from("propostas").remove([path]);
      setErro(dbErr.message);
      setSaving(false);
      return;
    }

    onSaved();
    onClose();
  }

  const fmtSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-white rounded border elevacao-3"
        style={{ borderColor: "rgba(13,13,13,.10)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p id={titleId} className="text-[0.8125rem] font-bold text-black/80">Enviar proposta</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/6 transition text-black/35 hover:text-black/60">
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-[0.6875rem] font-medium text-black/45 mb-1.5">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex.: Proposta Rouanet 2025"
              className="w-full rounded border border-black/12 bg-white px-3 py-2.5 text-sm text-[#282525] placeholder-black/25 focus:outline-none focus:ring-2 focus:ring-[#7259B5]/15 focus:border-[#7259B5]/40 transition"
            />
          </div>

          {captacoes.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">Vincular à negociação</label>
              <Select
                value={captacaoSelecionada}
                onChange={event => setCaptacaoSelecionada(event.target.value)}
                className="h-10 w-full rounded border border-black/12 bg-white px-3 text-[0.75rem] text-black/70 outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/15"
              >
                <option value="">Documento geral do projeto</option>
                {captacoes.map(captacao => (
                  <option key={captacao.id} value={captacao.id}>
                    {captacao.titulo}{captacao.empresaNome ? ` · ${captacao.empresaNome}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Drop zone */}
          <div>
            <label className="block text-[0.6875rem] font-medium text-black/45 mb-1.5">Arquivo PDF</label>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                <FileText size={18} className="text-[#7259B5] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[0.75rem] font-medium text-black/80 truncate">{file.name}</p>
                  <p className="text-[0.625rem] text-black/35">{fmtSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Remover arquivo"
                  onClick={() => { setFile(null); setErro(null); }}
                  className="text-black/30 hover:text-black/60 transition"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded border cursor-pointer transition"
                style={{
                  borderColor: dragging ? "#7259B5" : "rgba(13,13,13,.12)",
                  borderStyle: "dashed",
                  background: dragging ? "rgba(13,13,13,.03)" : "transparent",
                }}
              >
                <Upload size={18} className="text-black/25" />
                <p className="text-[0.75rem] text-black/40 text-center">
                  Arraste o PDF aqui ou <span className="text-[#7259B5] font-semibold">clique para selecionar</span>
                </p>
                <p className="text-[0.625rem] text-black/25">Máximo {MAX_MB} MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />
          </div>

          {erro && (
            <p role="alert" className="rounded border border-[#D94E4E]/20 bg-white px-3 py-2 text-[0.6875rem] text-[#D94E4E]">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button onClick={onClose} className="text-[0.75rem] font-semibold text-black/35 hover:text-black/55 transition">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving || !file}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {saving ? "Enviando…" : "Salvar proposta"}
          </button>
        </div>
      </div>
    </div>
  );
}
