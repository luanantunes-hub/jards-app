"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { Dropdown } from "@/components/ui/Dropdown";

type NovaReuniaoModalProps = {
  onClose: () => void;
  onCreated: (id: string) => void;
  organizationId: string;
};

const PLATAFORMAS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Microsoft Teams" },
];

export function NovaReuniaoModal({ onClose, onCreated, organizationId }: NovaReuniaoModalProps) {
  const [titulo, setTitulo] = useState("");
  const [plataforma, setPlataforma] = useState("google_meet");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose]);

  async function enviar() {
    if (!titulo.trim() || !url.trim()) {
      setErro("Preencha o título e o link da reunião");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch("/api/reunioes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          titulo: titulo.trim(),
          plataforma,
          url_reuniao: url.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o assistente");
      onCreated(data.id);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o assistente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center veu px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-reuniao-title"
        className="relative w-full max-w-[480px] overflow-hidden rounded bg-white border elevacao-3"
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h2 id="nova-reuniao-title" className="text-[15px] font-bold text-[#0D0D0D]">Enviar assistente pra reunião</h2>
          <button type="button" onClick={onClose} disabled={loading} className="text-black/30 hover:text-black/60 transition disabled:opacity-30">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-black/50">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Reunião com Patrocinador X"
              className="w-full rounded border px-3.5 py-2.5 text-sm text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-black/50">Plataforma</label>
            <Dropdown value={plataforma} onChange={setPlataforma} options={PLATAFORMAS} />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold text-black/50">Link da reunião</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meet.google.com/... ou https://teams.microsoft.com/..."
              className="w-full rounded border px-3.5 py-2.5 text-sm text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>

          {erro && <p className="text-[12.5px] text-[#D94A4A]">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={onClose} disabled={loading} className="px-3 py-2 text-sm text-black/50 hover:text-black/70 transition disabled:opacity-30">
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={loading}
            className="rounded bg-[#2E8932] px-4 py-2.5 text-sm text-white transition hover:bg-[#26752A] disabled:opacity-50"
          >
            {loading ? "Enviando…" : "Enviar assistente"}
          </button>
        </div>
      </section>
    </div>
  );
}
