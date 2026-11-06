"use client";
import { useId, useState } from "react";
import { X, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";

function formatDecimalBR(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  const sanitized = value.replace(/[^\d,]/g, "");
  const hasComma = sanitized.includes(",");
  const [integerPart = "", ...decimalParts] = sanitized.split(",");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "");
  const formattedInteger = normalizedInteger
    ? Number(normalizedInteger).toLocaleString("pt-BR")
    : hasComma ? "0" : "";
  const decimalPart = decimalParts.join("").slice(0, 2);

  return hasComma ? `${formattedInteger},${decimalPart}` : formattedInteger;
}

function parseDecimalBR(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function EditarObjetivoModal({ projetoId, valorAtual, onClose, onSaved }: {
  projetoId: string;
  valorAtual: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valor, setValor] = useState(formatDecimalBR(valorAtual));
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  async function handleSalvar() {
    setSaving(true); setErro(null);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("projetos_crm")
      .update({ valor_alvo: valor ? parseDecimalBR(valor) : null })
      .eq("id", projetoId);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full overflow-hidden rounded bg-white border elevacao-3" style={{ maxWidth: "26.25rem" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05] text-[#282525]">
              <Target size={15} />
            </div>
            <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Editar objetivo</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          {erro && (
            <div role="alert" className="rounded px-3 py-2 text-[0.75rem] font-medium" style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
              {erro}
            </div>
          )}
          <label>
            <span className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">Meta de captação</span>
            <div className="flex items-center gap-2 rounded border bg-white px-3" style={{ borderColor: "rgba(13,13,13,.15)" }}>
              <span className="text-[0.8125rem] text-black/35">R$</span>
              <input
                autoFocus
                type="text"
                inputMode="decimal"
                value={valor}
                onChange={e => setValor(formatDecimalBR(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter") handleSalvar(); }}
                placeholder="Ex.: 1.250.000,00"
                className="h-11 w-full bg-transparent text-[0.875rem] text-[#282525] outline-none"
              />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button onClick={onClose} className="px-3 py-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="rounded bg-[#2E8932] px-5 py-2 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
