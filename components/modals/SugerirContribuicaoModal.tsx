"use client";
import { useId, useState } from "react";
import { X, Users, AlertTriangle, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { Select } from "@/components/ui/Select";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type TabelaAlvo = "empresas" | "editais" | "responsaveis";
type TipoContribuicao = "adicao" | "correcao" | "sinalizacao";

type Props = {
  tabelaAlvo: TabelaAlvo;
  registroAlvoId: string;
  empresaCrmId?: string;
  registroNome?: string;
  onClose: () => void;
  onSaved?: () => void;
};

const TIPO_OPTIONS: Record<TipoContribuicao, { label: string; icon: typeof Plus; desc: string }> = {
  adicao:      { label: "Adicionar dado",     icon: Plus,          desc: "Contribuir com uma informação nova" },
  correcao:    { label: "Corrigir dado",       icon: Pencil,        desc: "Corrigir um dado incorreto" },
  sinalizacao: { label: "Sinalizar erro",      icon: AlertTriangle, desc: "Apontar informação desatualizada ou incorreta" },
};

const CAMPOS_POR_TABELA: Record<TabelaAlvo, string[]> = {
  responsaveis: ["nome", "cargo", "email", "linkedin_url"],
  editais:      ["titulo", "data_abertura", "data_fechamento", "url_acesso"],
  empresas:     ["nome", "setor", "site", "email_geral", "telefone"],
};

const CAMPO_LABELS: Record<string, string> = {
  nome: "Nome",
  cargo: "Cargo",
  email: "E-mail",
  linkedin_url: "LinkedIn",
  titulo: "Título",
  data_abertura: "Data de abertura",
  data_fechamento: "Data de fechamento",
  url_acesso: "URL de acesso",
  setor: "Setor",
  site: "Site",
  email_geral: "E-mail geral",
  telefone: "Telefone",
};

export function SugerirContribuicaoModal({
  tabelaAlvo,
  registroAlvoId,
  empresaCrmId,
  registroNome,
  onClose,
  onSaved,
}: Props) {
  const supabase = createClient();
  const organizationId = useOrganizationId();

  const [tipo, setTipo] = useState<TipoContribuicao>("sinalizacao");
  const [campo, setCampo] = useState(CAMPOS_POR_TABELA[tabelaAlvo][0] ?? "");
  const [valorProposto, setValorProposto] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const campos = CAMPOS_POR_TABELA[tabelaAlvo] ?? [];

  async function handleSubmit() {
    setSaving(true);
    setErro(null);

    const payload: Record<string, unknown> = {
      autor_id: (await supabase.auth.getUser()).data.user?.id,
      tabela_alvo: tabelaAlvo,
      registro_alvo_id: registroAlvoId,
      tipo,
      campo: tipo === "sinalizacao" ? null : campo || null,
      valor_proposto: tipo === "sinalizacao" ? null : valorProposto.trim() || null,
      justificativa: justificativa.trim() || null,
      status: "pendente",
      organization_id: organizationId,
    };

    if (empresaCrmId) payload.empresa_crm_id = empresaCrmId;

    const { error } = await (supabase as any)
      .from("contribuicoes")
      .insert(payload);

    setSaving(false);
    if (error) {
      setErro("Não foi possível enviar a contribuição. Tente novamente.");
      return;
    }
    setSaved(true);
    setTimeout(() => {
      onSaved?.();
      onClose();
    }, 1200);
  }

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center veu" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-white rounded w-full max-w-md p-8 text-center border elevacao-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-full bg-black/[.04] flex items-center justify-center mx-auto mb-4">
            <Plus size={20} className="text-[#1A8B7A]" />
          </div>
          <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525] mb-1">Contribuição enviada</h2>
          <p className="text-[0.8125rem] text-black/45">
            Sua contribuição será analisada pela equipe. Obrigado por ajudar a melhorar os dados!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center veu" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded w-full max-w-lg p-6 border elevacao-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-black/[.04] flex items-center justify-center">
              <Users size={16} className="text-[#7259B5]" />
            </div>
            <div>
              <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Sugerir contribuição</h2>
              {registroNome && (
                <p className="text-[0.6875rem] text-black/40">{registroNome}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded hover:bg-black/5 transition">
            <X size={16} className="text-black/40" />
          </button>
        </div>

        {/* Tipo selector */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {(Object.entries(TIPO_OPTIONS) as [TipoContribuicao, typeof TIPO_OPTIONS[TipoContribuicao]][]).map(([key, opt]) => {
            const Icon = opt.icon;
            const active = tipo === key;
            return (
              <button
                key={key}
                onClick={() => setTipo(key)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded border text-center transition ${
                  active
                    ? "border-[#7259B5] bg-white"
                    : "border-black/8 bg-white hover:border-black/15"
                }`}
              >
                <Icon size={14} className={active ? "text-[#7259B5]" : "text-black/35"} />
                <span className={`text-[0.6875rem] font-semibold ${active ? "text-[#7259B5]" : "text-black/50"}`}>
                  {opt.label}
                </span>
                <span className="text-[0.5625rem] text-black/30 leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Campos (apenas para adição/correção) */}
        {tipo !== "sinalizacao" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="text-[0.6875rem] font-bold text-black/40 uppercase tracking-wide block mb-1.5">Campo</label>
              <Select
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                className="w-full px-3 py-2.5 text-[0.8125rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition bg-white"
                style={{ borderColor: "rgba(13,13,13,.12)" }}
              >
                {campos.map((c) => (
                  <option key={c} value={c}>{CAMPO_LABELS[c] ?? c}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[0.6875rem] font-bold text-black/40 uppercase tracking-wide block mb-1.5">
                {tipo === "adicao" ? "Valor" : "Valor correto"}
              </label>
              <input
                value={valorProposto}
                onChange={(e) => setValorProposto(e.target.value)}
                placeholder={tipo === "adicao" ? "Ex: João Silva" : "Valor correto do campo"}
                className="w-full px-3 py-2.5 text-[0.8125rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
                style={{ borderColor: "rgba(13,13,13,.12)" }}
              />
            </div>
          </div>
        )}

        {/* Justificativa */}
        <div className="mb-5">
          <label className="text-[0.6875rem] font-bold text-black/40 uppercase tracking-wide block mb-1.5">
            Justificativa {tipo === "sinalizacao" ? "(obrigatória)" : ""}
          </label>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            placeholder={
              tipo === "sinalizacao"
                ? "Descreva o problema encontrado..."
                : "Explique de onde veio essa informação..."
            }
            className="w-full px-3 py-2.5 text-[0.8125rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition resize-none"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
        </div>

        {erro && <p role="alert" className="mb-4 text-[0.75rem] text-[#B23A3A]">{erro}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[0.8125rem] font-medium text-black/40 hover:text-black/60 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (tipo === "sinalizacao" && !justificativa.trim())}
            className="flex items-center gap-1.5 px-5 py-2 text-[0.8125rem] font-medium acao-salvar text-white rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Enviar contribuição
          </button>
        </div>
      </div>
    </div>
  );
}
