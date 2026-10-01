"use client";
import { useState, useEffect, useId } from "react";
import { X, ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type CaptacaoOption = { id: string; titulo: string | null; lei: string | null; valor_solicitado: number | null };
type ProjetoOption  = { id: string; nome: string };

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

const inputCls = "w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20 bg-white";
const inputStyle = { borderColor: "rgba(13,13,13,.12)" };

export function NovaPrestacaoModal({ onClose, onSaved }: Props) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [titulo, setTitulo] = useState("");
  const [captacaoId, setCaptacaoId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [valorAprovado, setValorAprovado] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const [captacoes, setCaptacoes] = useState<CaptacaoOption[]>([]);
  const [projetos, setProjetos] = useState<ProjetoOption[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    // Restrito à organização atual — captações e projetos são visíveis em
    // todas as organizações de que o usuário participa (RLS por membership,
    // não pela organização ativa na tela), então sem esse filtro dava pra
    // vincular a prestação a um projeto/captação de outra organização.
    supabase
      .from("captacoes")
      .select("id, titulo, lei, valor_solicitado")
      .eq("organization_id", organizationId)
      .eq("status", "aprovado")
      .order("titulo")
      .then(({ data }) => setCaptacoes((data as CaptacaoOption[]) ?? []));

    (supabase as any)
      .from("projetos_crm")
      .select("id, nome")
      .eq("organization_id", organizationId)
      .order("nome")
      .then(({ data }: any) => setProjetos((data as ProjetoOption[]) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Ao selecionar captação, pré-preenche valor — inclusive limpando quando a
  // captação é desmarcada ou não tem valor_solicitado, pra não deixar o valor
  // de uma captação anterior "grudado" sem relação com a seleção atual.
  function handleCaptacaoChange(id: string) {
    setCaptacaoId(id);
    const cap = captacoes.find(c => c.id === id);
    setValorAprovado(cap?.valor_solicitado ? String(cap.valor_solicitado) : "");
  }

  async function handleSubmit() {
    if (!titulo.trim()) return;
    setSaving(true);
    setErro(null);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await (supabase as any).from("prestacoes_contas").insert({
      titulo: titulo.trim(),
      captacao_id: captacaoId || null,
      projeto_id: projetoId || null,
      prazo: prazo || null,
      valor_aprovado: valorAprovado ? Number(valorAprovado) : null,
      observacoes: observacoes.trim() || null,
      criado_por: user?.id ?? null,
    });

    setSaving(false);
    if (error) { setErro("Não foi possível criar a prestação de contas. Tente novamente."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "#7259B514" }}>
              <ClipboardCheck size={14} className="text-[#7259B5]" />
            </div>
            <h2 id={titleId} className="text-[14px] font-semibold text-[#0D0D0D]">Nova prestação de contas</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded hover:bg-black/5 transition text-black/35 hover:text-black/55">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">
              Título <span className="text-[#D94E4E]">*</span>
            </label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Prestação Rouanet 2024 — Festival Cultural"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Captação */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">
              Negociação aprovada
            </label>
            <Select
              value={captacaoId}
              onChange={e => handleCaptacaoChange(e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, color: captacaoId ? "#0D0D0D" : "rgba(13,13,13,.35)" }}
            >
              <option value="">Selecionar negociação</option>
              {captacoes.map(c => (
                <option key={c.id} value={c.id}>{c.titulo ?? "Sem título"} {c.lei ? `(${c.lei})` : ""}</option>
              ))}
            </Select>
            {captacoes.length === 0 && (
              <p className="text-[10px] text-black/30 mt-1">Nenhuma negociação com status “aprovado” encontrada.</p>
            )}
          </div>

          {/* Projeto */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">
              Projeto
            </label>
            <Select
              value={projetoId}
              onChange={e => setProjetoId(e.target.value)}
              className={inputCls}
              style={{ ...inputStyle, color: projetoId ? "#0D0D0D" : "rgba(13,13,13,.35)" }}
            >
              <option value="">Selecionar projeto</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Prazo */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">Prazo</label>
              <input
                type="date"
                value={prazo}
                onChange={e => setPrazo(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            {/* Valor aprovado */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">Valor aprovado (R$)</label>
              <input
                type="number"
                value={valorAprovado}
                onChange={e => setValorAprovado(e.target.value)}
                placeholder="0,00"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1.5">Observações</label>
            <textarea
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Contexto, requisitos específicos do patrocinador..."
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>

          {erro && <p role="alert" className="text-[12px] text-[#B23A3A]">{erro}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {erro ? <p className="min-w-0 text-[12px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex shrink-0 items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-black/35 hover:text-black/55 transition">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !titulo.trim()}
            className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-semibold text-white rounded bg-[#2E8932] transition hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            Criar prestação
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
