"use client";
import { useState } from "react";
import { X, FileText, Eye, Copy, ExternalLink, Archive, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { Proposta, SlideCapa, SlideHistoria, SlideNumeros, SlideContato, CotaPatrocinio } from "@/lib/supabase/types";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho:     { label: "Rascunho",   color: "rgba(13,13,13,.40)" },
  enviada:      { label: "Enviada",    color: "#2D72B0" },
  visualizada:  { label: "Visualizada", color: "#2D72B0" },
  aceita:       { label: "Aceita",     color: "#2E8932" },
  recusada:     { label: "Recusada",   color: "#D94E4E" },
  expirada:     { label: "Expirada",   color: "rgba(13,13,13,.40)" },
  arquivada:    { label: "Arquivada",  color: "rgba(13,13,13,.40)" },
};

type StepKey = "capa" | "historia" | "numeros" | "contato";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "capa",     label: "Capa" },
  { key: "historia", label: "História" },
  { key: "numeros",  label: "Números" },
  { key: "contato",  label: "Contato" },
];

export function PropostaWizard({
  projetoId,
  projetoNome,
  proposta,
  cotas,
  onClose,
  onSaved,
}: {
  projetoId: string;
  projetoNome: string;
  proposta: Proposta | null;
  cotas: CotaPatrocinio[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>("capa");
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState(proposta?.titulo ?? `${projetoNome} — Proposta de Patrocínio`);
  const [status, setStatus] = useState<string>(proposta?.status ?? "rascunho");
  const [expiraEm, setExpiraEm] = useState(proposta?.expira_em?.split("T")[0] ?? "");
  const [corPrimaria, setCorPrimaria] = useState(proposta?.slide_capa?.imagem_url ? "#7259B5" : "#7259B5");

  // Slide: Capa
  const [capa, setCapa] = useState<SlideCapa>(proposta?.slide_capa ?? { titulo: projetoNome, subtitulo: "Proposta de Patrocínio" });

  // Slide: História
  const [historia, setHistoria] = useState<SlideHistoria>(proposta?.slide_historia ?? { texto: "", imagens: [] });

  // Slide: Números
  const [numeros, setNumeros] = useState<SlideNumeros>(proposta?.slide_numeros ?? { alcance: "", publico: undefined, edicoes_anteriores: "", roi_medio: "" });

  // Slide: Contato
  const [contato, setContato] = useState<SlideContato>(proposta?.slide_contato ?? { nome: "", email: "", telefone: "", whatsapp: "" });

  async function handleSave(newStatus?: string) {
    setSaving(true);
    setErro(null);

    let orgId = organizationId;
    if (!orgId) {
      const { data: ids } = await supabase.rpc("auth_org_ids");
      orgId = (ids as unknown as string[] | null)?.[0] ?? null;
    }
    if (!orgId) {
      setErro("Organização não encontrada");
      setSaving(false);
      return;
    }

    const payload = {
      projeto_id: projetoId,
      organization_id: orgId,
      titulo: titulo.trim() || `${projetoNome} — Proposta`,
      slide_capa: capa,
      slide_historia: historia,
      slide_numeros: numeros,
      slide_contato: contato,
      status: newStatus ?? status,
      expira_em: expiraEm || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    let result;
    if (proposta) {
      result = await sb.from("propostas").update(payload).eq("id", proposta.id);
    } else {
      result = await sb.from("propostas").insert(payload);
    }

    setSaving(false);
    if (result.error) { setErro((result.error as Error).message); return; }
    onSaved();
    onClose();
  }

  async function handleGerarLink() {
    if (!proposta) {
      // Salvar primeiro
      await handleSave("enviada");
      return;
    }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.rpc("fn_gerar_slug_proposta", { p_proposta_id: proposta.id });
    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    onSaved();
  }

  async function handleArquivar() {
    if (!proposta) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("propostas").update({ status: "arquivada" }).eq("id", proposta.id);
    if (!error) { onSaved(); onClose(); }
  }

  async function handleExcluir() {
    if (!proposta) return;
    if (!confirm("Excluir esta proposta?")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = await sb.from("propostas").delete().eq("id", proposta.id);
    if (!error) { onSaved(); onClose(); }
  }

  function copyLink() {
    if (!proposta?.slug) return;
    navigator.clipboard.writeText(`${window.location.origin}/p/${proposta.slug}`);
  }

  const publicUrl = proposta?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${proposta.slug}` : null;


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded shadow-2xl w-full overflow-hidden flex flex-col"
        style={{ maxWidth: 680, maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-black/5 flex items-center justify-center">
              <FileText size={16} className="text-black/50" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-black">{proposta ? "Editar proposta" : "Nova proposta"}</h2>
              {proposta && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${STATUS_LABELS[status]?.color}14`, color: STATUS_LABELS[status]?.color }}
                  >
                    {STATUS_LABELS[status]?.label}
                  </span>
                  {proposta.total_visualizacoes > 0 && (
                    <span className="text-[10px] text-black/30">
                      {proposta.total_visualizacoes} visualização{proposta.total_visualizacoes !== 1 ? "ões" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {proposta?.slug && (
              <>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-black/40 border rounded hover:bg-black/5 transition"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                >
                  <Copy size={11} /> Copiar link
                </button>
                <a
                  href={`/p/${proposta.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#7259B5] border rounded hover:bg-[#7259B5]/5 transition"
                  style={{ borderColor: "rgba(114,89,181,.3)" }}
                >
                  <ExternalLink size={11} /> Abrir
                </a>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
              <X size={15} className="text-black/40" />
            </button>
          </div>
        </div>

        {/* Steps nav */}
        <div className="flex items-center gap-1 px-7 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded transition ${
                step === s.key ? "bg-[#7259B5]/10 text-[#7259B5]" : "text-black/40 hover:bg-black/5"
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: step === s.key ? "#7259B5" : "rgba(13,13,13,.08)",
                  color: step === s.key ? "#fff" : "rgba(13,13,13,.35)",
                }}
              >
                {i + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-7">
          {erro && (
            <div className="text-[12px] font-semibold text-[#D94E4E] bg-[#D94E4E]/8 rounded px-3 py-2 mb-4">
              {erro}
            </div>
          )}

          {/* Título geral */}
          <div className="mb-6">
            <label className="text-[12px] font-semibold text-black mb-1.5 block">Título da proposta</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Proposta de patrocínio..."
              className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>


          {/* Step: Capa */}
          {step === "capa" && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30">Slide 1 — Capa</p>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Título</label>
                <input
                  value={capa.titulo ?? ""}
                  onChange={e => setCapa(c => ({ ...c, titulo: e.target.value }))}
                  placeholder={projetoNome}
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Subtítulo</label>
                <input
                  value={capa.subtitulo ?? ""}
                  onChange={e => setCapa(c => ({ ...c, subtitulo: e.target.value }))}
                  placeholder="Proposta de Patrocínio"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">URL da imagem</label>
                <input
                  value={capa.imagem_url ?? ""}
                  onChange={e => setCapa(c => ({ ...c, imagem_url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
            </div>
          )}

          {/* Step: História */}
          {step === "historia" && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30">Slide 2 — História</p>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Texto principal</label>
                <textarea
                  value={historia.texto ?? ""}
                  onChange={e => setHistoria(h => ({ ...h, texto: e.target.value }))}
                  placeholder="Conte a história do projeto, sua missão, por que existe..."
                  rows={6}
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition resize-none"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">
                  Imagens <span className="text-black/30 font-normal">(URLs, uma por linha)</span>
                </label>
                <textarea
                  value={(historia.imagens ?? []).join("\n")}
                  onChange={e => setHistoria(h => ({ ...h, imagens: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) }))}
                  placeholder={"https://exemplo.com/foto1.jpg\nhttps://exemplo.com/foto2.jpg"}
                  rows={3}
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition resize-none"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
            </div>
          )}

          {/* Step: Números */}
          {step === "numeros" && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30">Slide 3 — Números</p>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Alcance</label>
                <input
                  value={numeros.alcance ?? ""}
                  onChange={e => setNumeros(n => ({ ...n, alcance: e.target.value }))}
                  placeholder="Ex: Presença em 3 estados, 12 eventos..."
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Público alcançado</label>
                <input
                  type="number"
                  value={numeros.publico ?? ""}
                  onChange={e => setNumeros(n => ({ ...n, publico: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="Ex: 5000"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Edições anteriores</label>
                <input
                  value={numeros.edicoes_anteriores ?? ""}
                  onChange={e => setNumeros(n => ({ ...n, edicoes_anteriores: e.target.value }))}
                  placeholder="Ex: 3 edições anteriores com 100% de captação"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">ROI médio</label>
                <input
                  value={numeros.roi_medio ?? ""}
                  onChange={e => setNumeros(n => ({ ...n, roi_medio: e.target.value }))}
                  placeholder="Ex: 3:1 (R$3 retornado para cada R$1 investido)"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              {/* Cotas preview */}
              {cotas.length > 0 && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30 mb-3">Cotas disponíveis</p>
                  <div className="space-y-2">
                    {cotas.filter(c => c.status === "disponivel").map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded bg-black/[0.02]">
                        <span className="text-[12px] font-semibold text-black">{c.nome}</span>
                        <span className="text-[12px] font-bold text-[#7259B5]">
                          R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Contato */}
          {step === "contato" && (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30">Slide 4 — Contato</p>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Nome</label>
                <input
                  value={contato.nome ?? ""}
                  onChange={e => setContato(c => ({ ...c, nome: e.target.value }))}
                  placeholder="Nome do responsável"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-black mb-1.5 block">E-mail</label>
                  <input
                    value={contato.email ?? ""}
                    onChange={e => setContato(c => ({ ...c, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-black mb-1.5 block">Telefone</label>
                  <input
                    value={contato.telefone ?? ""}
                    onChange={e => setContato(c => ({ ...c, telefone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                    className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">WhatsApp</label>
                <input
                  value={contato.whatsapp ?? ""}
                  onChange={e => setContato(c => ({ ...c, whatsapp: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>

              {/* Expiração */}
              <div className="mt-6 border-t pt-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30 mb-3">Configurações do link</p>
                <div>
                  <label className="text-[12px] font-semibold text-black mb-1.5 block">
                    Expira em
                  </label>
                  <input
                    type="date"
                    value={expiraEm}
                    onChange={e => setExpiraEm(e.target.value)}
                    className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-7 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2">
            {proposta && (
              <>
                <button
                  onClick={handleArquivar}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-black/40 rounded hover:bg-black/5 transition"
                >
                  <Archive size={11} /> Arquivar
                </button>
                <button
                  onClick={handleExcluir}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#D94E4E]/60 rounded hover:bg-[#D94E4E]/5 transition"
                >
                  <Trash2 size={11} /> Excluir
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-black/40 border rounded hover:bg-black/5 transition disabled:opacity-50"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              {saving ? "Salvando..." : "Salvar rascunho"}
            </button>
            {status === "rascunho" && (
              <button
                onClick={() => handleSave("enviada")}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#2D72B0] rounded hover:bg-[#1a45c4] transition disabled:opacity-50"
              >
                Enviar proposta
              </button>
            )}
            {status === "enviada" && proposta?.slug && (
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition"
              >
                <Copy size={11} /> Copiar link
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
