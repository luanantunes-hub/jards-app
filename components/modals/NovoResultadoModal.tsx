"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useId, useState } from "react";
import { X, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { Dropdown } from "@/components/ui/Dropdown";
import type { CotaPatrocinio, Proposta } from "@/lib/supabase/types";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export type EditDataResultado = {
  id: string;
  valor_captado: number | null;
  valor_executado: number | null;
  publico_alcancado: number | null;
  eventos_realizados: number | null;
  retorno_midia_est: number | null;
  observacoes: string | null;
  data_resultado: string | null;
};

function atm(cents: string) {
  return cents ? (parseInt(cents, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}
function initCents(v: number | null) {
  return v != null ? Math.round(v * 100).toString() : "";
}
function atmKey(setCents: (fn: (p: string) => string) => void) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") { e.preventDefault(); setCents(p => p.slice(0, -1)); }
    else if (/^\d$/.test(e.key)) { e.preventDefault(); setCents(p => p.length < 13 ? p + e.key : p); }
    else if (!["Tab","Escape","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) e.preventDefault();
  };
}
function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NovoResultadoModal({
  projetoId,
  cotas,
  propostas,
  onClose,
  onSaved,
  editData,
}: {
  projetoId: string;
  cotas: CotaPatrocinio[];
  propostas: Proposta[];
  onClose: () => void;
  onSaved: () => void;
  editData?: EditDataResultado;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const [cotaId, setCotaId] = useState("");
  const [propostaId, setPropostaId] = useState("");
  const [captadoCents, setCaptadoCents] = useState(initCents(editData?.valor_captado ?? null));

  const selectedCota = cotas.find(c => c.id === cotaId) ?? null;
  const captadoValue = captadoCents ? parseInt(captadoCents, 10) / 100 : null;
  const valueDelta = selectedCota && captadoValue != null ? captadoValue - selectedCota.valor : null;

  // Propostas filtradas pela cota selecionada (se houver)
  const propostasVisiveis = cotaId
    ? propostas.filter(p => (p as any).cota_id === cotaId)
    : propostas;

  function handleCotaChange(id: string) {
    setCotaId(id);
    setPropostaId("");
    const cota = cotas.find(c => c.id === id);
    setCaptadoCents(cota ? initCents(cota.valor) : "");
  }

  function handlePropostaChange(id: string) {
    setPropostaId(id);
    const proposta = propostas.find(p => p.id === id);
    if (proposta && (proposta as any).valor_proposto != null) {
      setCaptadoCents(initCents((proposta as any).valor_proposto));
    }
  }

  async function handleSalvar() {
    setSaving(true);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Não autenticado"); setSaving(false); return; }

    const payload = {
      projeto_id: projetoId,
      valor_captado: captadoValue,
      valor_executado: editData?.valor_executado ?? null,
      publico_alcancado: editData?.publico_alcancado ?? null,
      eventos_realizados: editData?.eventos_realizados ?? null,
      retorno_midia_est: editData?.retorno_midia_est ?? null,
      observacoes: editData?.observacoes ?? null,
      data_resultado: editData?.data_resultado ?? new Date().toISOString().slice(0, 10),
    };

    const sb = supabase as any;
    const { error } = editData?.id
      ? await sb.from("resultados_projeto").update(payload).eq("id", editData.id)
      : await sb.from("resultados_projeto").insert({ account_id: user.id, organization_id: organizationId, ...payload });

    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved();
    onClose();
  }

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
        className="bg-white rounded w-full flex flex-col border border-black/[.09] shadow-xl overflow-hidden"
        style={{ maxWidth: 420, maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id={titleId} className="text-[14px] font-semibold text-black/80">
            {editData ? "Editar captação" : "Registrar captação"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/[.05] transition">
            <X size={14} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {/* Cota */}
          {!editData && (
            <div>
              <label className="text-[11px] font-semibold text-black/55 block mb-1.5">Cota vendida</label>
              <Dropdown
                value={cotaId}
                onChange={handleCotaChange}
                placeholder="Selecione a cota…"
                options={[
                  { value: "", label: "Sem cota específica" },
                  ...cotas.map(c => ({ value: c.id, label: `${c.nome} · ${money(c.valor)}` })),
                ]}
              />
            </div>
          )}

          {/* Proposta (opcional) */}
          {!editData && (
            <div>
              <label className="text-[11px] font-semibold text-black/55 block mb-1.5">
                Proposta <span className="font-normal text-black/25">(opcional)</span>
              </label>
              <Dropdown
                value={propostaId}
                onChange={handlePropostaChange}
                placeholder={propostasVisiveis.length === 0 ? "Nenhuma proposta vinculada" : "Sem proposta específica"}
                options={propostasVisiveis.map(p => ({ value: p.id, label: p.titulo }))}
              />
              {propostaId && (
                <p className="mt-1 text-[10px] text-black/35">Valor pré-preenchido pela proposta selecionada.</p>
              )}
            </div>
          )}

          {/* Valor captado */}
          <div>
            <label className="text-[11px] font-semibold text-black/55 block mb-1.5">Valor captado</label>
            <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
              <span className="text-[12px] text-black/35 flex-shrink-0">R$</span>
              <input
                type="text" inputMode="numeric" placeholder="0,00"
                value={atm(captadoCents)}
                onKeyDown={atmKey(setCaptadoCents)}
                onChange={() => {}}
                className="flex-1 text-[14px] font-semibold outline-none bg-transparent text-black min-w-0"
              />
            </div>
            {valueDelta !== null && valueDelta !== 0 && (
              <p className="mt-1.5 text-[10px] font-medium" style={{ color: valueDelta > 0 ? "#2E8932" : "#D94E4E" }}>
                {valueDelta > 0 ? "+" : ""}{money(valueDelta)} em relação ao valor padrão da cota
              </p>
            )}
          </div>

          {erro && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{erro}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <button onClick={onClose} className="text-[12px] font-medium text-black/35 hover:text-black/55 transition">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#26752A] active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={12} /> {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
