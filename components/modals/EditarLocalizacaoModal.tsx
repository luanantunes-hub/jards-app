"use client";
import { useId, useState } from "react";
import { X, MapPin, Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { EmpresaCrm } from "@/lib/supabase/types";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type Props = {
  empresa: EmpresaCrm;
  onClose: () => void;
  onSaved: () => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.5625rem] font-bold uppercase tracking-widest text-black/30 mb-1.5">{children}</p>;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 flex items-center text-[0.75rem] font-semibold text-[#282525]">{children}</label>;
}

const fieldClass = "rounded border bg-white px-3 py-2.5 text-[0.8125rem] text-[#282525] outline-none transition focus:border-black/30";
const fieldStyle = { borderColor: "rgba(13,13,13,.15)" } as const;

export function EditarLocalizacaoModal({ empresa, onClose, onSaved }: Props) {
  const supabase = createClient();

  const parsedLoc = (() => {
    const loc = empresa.localizacao ?? "";
    const idx = loc.lastIndexOf("-");
    return idx > 0 ? { cidade: loc.slice(0, idx), uf: loc.slice(idx + 1) } : { cidade: loc, uf: "" };
  })();
  const [locCidade, setLocCidade] = useState(parsedLoc.cidade);
  const [locUF, setLocUF] = useState(parsedLoc.uf);

  const [cidades, setCidades] = useState<string[]>(empresa.cidades_interesse ?? []);
  const [cidadeNome, setCidadeNome] = useState("");
  const [cidadeUF, setCidadeUF] = useState("");

  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const cidadePreview = cidadeNome.trim() && cidadeUF.trim()
    ? `${cidadeNome.trim()}-${cidadeUF.trim().toUpperCase()}`
    : "";

  function addCidade() {
    if (!cidadePreview || cidades.includes(cidadePreview)) { setCidadeNome(""); setCidadeUF(""); return; }
    setCidades(prev => [...prev, cidadePreview]);
    setCidadeNome("");
    setCidadeUF("");
  }

  function removeCidade(cidade: string) {
    setCidades(prev => prev.filter(c => c !== cidade));
  }

  async function handleSalvar() {
    setSaving(true); setErro(null);
    const localizacao = locCidade.trim() && locUF.trim()
      ? `${locCidade.trim()}-${locUF.trim().toUpperCase()}`
      : locCidade.trim() || null;
    const { error } = await (supabase as any)
      .from("empresas_crm")
      .update({ localizacao, cidades_interesse: cidades })
      .eq("id", empresa.id);
    if (error) { setErro(error.message); setSaving(false); return; }
    onSaved();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center veu" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[96dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-b bg-white border-x border-b elevacao-2"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <MapPin size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Localização e cidades</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5">
            <FieldLabel>Sede</FieldLabel>
            <div className="flex gap-1.5">
              <input
                value={locCidade}
                onChange={e => setLocCidade(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("uf-edit-loc-sheet")?.focus(); } }}
                placeholder="Cidade"
                className={`flex-1 ${fieldClass}`}
                style={fieldStyle}
              />
              <input
                id="uf-edit-loc-sheet"
                value={locUF}
                onChange={e => setLocUF(e.target.value.slice(0, 2))}
                placeholder="UF"
                maxLength={2}
                className={`w-16 text-center uppercase ${fieldClass}`}
                style={fieldStyle}
              />
            </div>
          </div>

          <section className="border-t pt-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <SectionLabel>Cidades de interesse para patrocínio</SectionLabel>
            {cidades.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {cidades.map(c => (
                  <span key={c} className="flex items-center gap-1 rounded border border-black/10 bg-black/[.04] pl-2 pr-1.5 py-1 text-[0.6875rem] text-black/60">
                    {c}
                    <button type="button" onClick={() => removeCidade(c)}
                      className="text-black/30 hover:text-black/60 transition" aria-label={`Remover ${c}`}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={cidadeNome}
                  onChange={e => setCidadeNome(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("uf-edit-cidade-sheet")?.focus(); } }}
                  placeholder="Cidade"
                  className={`flex-1 ${fieldClass}`}
                  style={fieldStyle}
                />
                <input
                  id="uf-edit-cidade-sheet"
                  value={cidadeUF}
                  onChange={e => setCidadeUF(e.target.value.slice(0, 2))}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCidade(); } }}
                  placeholder="UF"
                  maxLength={2}
                  className={`w-16 text-center uppercase ${fieldClass}`}
                  style={fieldStyle}
                />
                <button type="button" onClick={addCidade} disabled={!cidadePreview} aria-label="Adicionar cidade"
                  className="flex w-10 items-center justify-center rounded border border-black/10 text-black/40 transition hover:bg-black/[.04] disabled:opacity-30">
                  <Plus size={14} />
                </button>
              </div>
              {cidadePreview && (
                <p className="text-[0.6875rem] text-black/35">Vai adicionar: <span className="font-medium text-black/55">{cidadePreview}</span></p>
              )}
            </div>
          </section>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[0.6875rem] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose}
              className="px-3 py-2 text-[0.75rem] font-semibold text-black/35 transition hover:text-black/55">
              Cancelar
            </button>
            <button type="button" onClick={handleSalvar} disabled={saving}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[0.75rem] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed">
              <Save size={12} /> {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
