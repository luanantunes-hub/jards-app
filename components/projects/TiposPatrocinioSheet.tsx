"use client";

import { useEffect, useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { SPONSORSHIP_TYPE_OPTIONS, BRAZIL_STATES } from "@/lib/projects/sponsorship";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const FEDERAL_TYPES = SPONSORSHIP_TYPE_OPTIONS as unknown as { value: string; label: string }[];

export function TiposPatrocinioSheet({
  projetoId,
  initialTypes,
  onClose,
  onSaved,
}: {
  projetoId: string;
  initialTypes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialTypes);
  const [saving, setSaving] = useState(false);
  const [addingEstadual, setAddingEstadual] = useState(false);
  const [estadualState, setEstadualState] = useState("");
  const [addingMunicipal, setAddingMunicipal] = useState(false);
  const [municipalName, setMunicipalName] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)));
  }, []);

  function close() {
    setSheetVisible(false);
    setTimeout(onClose, 260);
  }

  useModalDismiss(close);

  function toggleFederal(value: string) {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  const localTypes = selected.filter(t => t.startsWith("estadual:") || t.startsWith("municipal:"));

  function addEstadual() {
    if (!estadualState) return;
    const key = `estadual:${estadualState}`;
    if (!selected.includes(key)) setSelected(prev => [...prev, key]);
    setEstadualState("");
    setAddingEstadual(false);
  }

  function addMunicipal() {
    const trimmed = municipalName.trim();
    if (!trimmed) return;
    const key = `municipal:${trimmed}`;
    if (!selected.includes(key)) setSelected(prev => [...prev, key]);
    setMunicipalName("");
    setAddingMunicipal(false);
  }

  function removeLocal(key: string) {
    setSelected(prev => prev.filter(v => v !== key));
  }

  async function save() {
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).from("projetos_crm").update({ tipos_patrocinio: selected }).eq("id", projetoId);
    setSaving(false);
    if (error) { setErro("Não foi possível salvar os tipos de patrocínio. Tente novamente."); return; }
    onSaved();
    close();
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: sheetVisible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)",
        transition: "background 260ms ease",
      }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-0 top-0 mx-auto flex max-h-[96dvh] flex-col overflow-hidden rounded-b bg-white"
        style={{
          width: 520,
          maxWidth: "92vw",
          transform: sheetVisible ? "none" : "translateY(-100%)",
          transition: "transform 260ms cubic-bezier(.32,.72,0,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id={titleId} className="text-[14px] font-semibold text-black/80">Patrocínio</h3>
          <button type="button" onClick={close} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded hover:bg-black/[.05] transition">
            <X size={14} className="text-black/40" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Federal */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.1em] text-black/35">Federais e direto</p>
            <div className="space-y-0.5">
              {FEDERAL_TYPES.map(type => {
                const active = selected.includes(type.value);
                return (
                  <label key={type.value} className="flex cursor-pointer items-center gap-3 rounded px-1 py-2 hover:bg-black/[.02] transition">
                    <div
                      onClick={() => toggleFederal(type.value)}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition ${
                        active ? "bg-[#0D0D0D]" : "border border-black/[.2] bg-white"
                      }`}
                    >
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-[13px] text-black/70">{type.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Local incentives */}
          <div>
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.1em] text-black/35">Incentivos locais</p>

            {localTypes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {localTypes.map(key => {
                  const colonIdx = key.indexOf(":");
                  const kind = key.slice(0, colonIdx);
                  const val = key.slice(colonIdx + 1);
                  return (
                    <span key={key} className="flex items-center gap-1.5 rounded border border-black/[.12] bg-black/[.025] px-2.5 py-1 text-[11px] text-black/60">
                      {kind === "estadual" ? `Estadual · ${val}` : `Municipal · ${val}`}
                      <button type="button" onClick={() => removeLocal(key)} aria-label={`Remover ${kind === "estadual" ? "estadual" : "municipal"} ${val}`} className="text-black/30 transition hover:text-black/60">
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {/* Estadual */}
              {!addingEstadual ? (
                <button
                  onClick={() => { setAddingEstadual(true); setAddingMunicipal(false); }}
                  className="flex items-center gap-1 rounded border border-dashed border-black/[.15] px-3 py-1.5 text-[11px] text-black/45 transition hover:border-black/30 hover:text-black/60"
                >
                  <Plus size={11} /> Estadual
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div style={{ width: 180 }}>
                    <Dropdown
                      value={estadualState}
                      onChange={setEstadualState}
                      placeholder="Selecionar estado…"
                      options={BRAZIL_STATES.map(([code, name]) => ({ value: code, label: `${code} — ${name}` }))}
                    />
                  </div>
                  <button onClick={addEstadual} disabled={!estadualState} className="h-10 rounded bg-[#0D0D0D] px-3 text-[11px] font-medium text-white transition hover:bg-black/80 disabled:opacity-40">
                    Adicionar
                  </button>
                  <button onClick={() => { setAddingEstadual(false); setEstadualState(""); }} className="text-[11px] text-black/35 transition hover:text-black/55">
                    Cancelar
                  </button>
                </div>
              )}

              {/* Municipal */}
              {!addingMunicipal && (
                <button
                  onClick={() => { setAddingMunicipal(true); setAddingEstadual(false); }}
                  className="flex items-center gap-1 rounded border border-dashed border-black/[.15] px-3 py-1.5 text-[11px] text-black/45 transition hover:border-black/30 hover:text-black/60"
                >
                  <Plus size={11} /> Municipal
                </button>
              )}
              {addingMunicipal && (
                <div className="flex items-center gap-2">
                  <input
                    value={municipalName}
                    onChange={e => setMunicipalName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addMunicipal()}
                    placeholder="Nome da cidade…"
                    autoFocus
                    className="h-10 w-40 rounded border border-black/[.15] px-3 text-[12px] outline-none focus:border-black/30 transition"
                  />
                  <button onClick={addMunicipal} disabled={!municipalName.trim()} className="h-10 rounded bg-[#0D0D0D] px-3 text-[11px] font-medium text-white transition hover:bg-black/80 disabled:opacity-40">
                    Adicionar
                  </button>
                  <button onClick={() => { setAddingMunicipal(false); setMunicipalName(""); }} className="text-[11px] text-black/35 transition hover:text-black/55">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {erro && <p role="alert" className="shrink-0 px-6 pb-3 text-[12px] text-[#B23A3A]">{erro}</p>}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button onClick={close} className="text-[12px] font-medium text-black/35 transition hover:text-black/55">
            Cancelar
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#26752A] active:scale-[.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={12} /> {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
