"use client";
import { useId, useState } from "react";
import { X, Link2, Copy, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validarUrlSite } from "@/lib/sites-bloqueados";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function AdicionarSiteProjetoModal({ projetoId, projetoNome, organizationId, siteAtual, onClose, onSaved }: {
  projetoId: string;
  projetoNome: string;
  organizationId: string;
  siteAtual: string | null;
  onClose: () => void;
  onSaved: (url: string | null) => void;
}) {
  const [url, setUrl] = useState(siteAtual ?? "");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const titleId = useId();
  useModalDismiss(onClose);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(projetoNome);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {}
  }

  async function handleSalvar() {
    const resultado = validarUrlSite(url);
    if (!resultado.ok) { setErro(resultado.erro); return; }
    setSaving(true); setErro(null);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("projeto_incentivo_sites_usuario")
      .upsert(
        { organization_id: organizationId, projeto_id: projetoId, url: resultado.url, updated_at: new Date().toISOString() },
        { onConflict: "organization_id,projeto_id" },
      );
    setSaving(false);
    if (error) {
      setErro(/check|violates/i.test(error.message) ? "Este tipo de site não é permitido." : error.message);
      return;
    }
    onSaved(resultado.url);
    onClose();
  }

  async function handleRemover() {
    setSaving(true); setErro(null);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("projeto_incentivo_sites_usuario")
      .delete()
      .eq("organization_id", organizationId)
      .eq("projeto_id", projetoId);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSaved(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 veu" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full overflow-hidden rounded bg-white border elevacao-3" style={{ maxWidth: "27.5rem" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black/[.05] text-[#282525]">
              <Link2 size={15} />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Site do projeto</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          {erro && (
            <div className="rounded px-3 py-2 text-[0.75rem] font-medium" style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
              {erro}
            </div>
          )}
          <div className="flex items-start gap-2 rounded bg-black/[.04] px-3 py-2.5">
            <p className="min-w-0 flex-1 text-[0.8125rem] font-medium leading-snug text-[#282525]">{projetoNome}</p>
            <button
              type="button"
              onClick={handleCopiar}
              title="Copiar nome do projeto"
              aria-label="Copiar nome do projeto"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.06] hover:text-black/60"
            >
              {copiado ? <Check size={13} className="text-[#2E8932]" /> : <Copy size={13} />}
            </button>
          </div>
          <label>
            <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">Endereço do site</span>
            <div className="rounded border bg-white px-3" style={{ borderColor: "rgba(13,13,13,.15)" }}>
              <input
                autoFocus
                type="text"
                inputMode="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setErro(null); }}
                onKeyDown={e => { if (e.key === "Enter") handleSalvar(); }}
                placeholder="https://www.exemplo.com.br"
                className="h-11 w-full bg-transparent text-[0.875rem] text-[#282525] outline-none"
              />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {siteAtual ? (
            <button onClick={handleRemover} disabled={saving} className="px-3 py-2 text-[0.75rem] font-medium text-[#D94E4E]/70 transition hover:text-[#D94E4E] disabled:opacity-40">Remover</button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-3 py-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="rounded acao-salvar px-5 py-2 text-[0.75rem] font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
