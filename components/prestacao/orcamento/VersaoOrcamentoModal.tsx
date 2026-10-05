"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { rotuloTipoVersao, TIPOS_VERSAO, type TipoVersao, type VersaoOrcamento } from "@/lib/prestacao/orcamento";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "w-full rounded border border-black/[.12] px-3 py-2 text-[0.8125rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20";

export function nomeDaVersao(versao: Pick<VersaoOrcamento, "tipo" | "nome">): string {
  return `${rotuloTipoVersao(versao.tipo)}${versao.nome ? ` · ${versao.nome}` : ""}`;
}

/**
 * Nova versão (cópia de outra ou vazia) ou edição dos dados de uma versão:
 * tipo, nome e o ato que a aprovou. Tornar ativa é uma ação à parte.
 */
export function VersaoOrcamentoModal({ prestacaoId, editando, base, onClose, onSaved }: {
  prestacaoId: string;
  editando: VersaoOrcamento | null;
  base: VersaoOrcamento | null;
  onClose: () => void;
  onSaved: (versaoId: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const titleId = useId();
  useModalDismiss(onClose);

  const [tipo, setTipo] = useState<TipoVersao>(editando?.tipo ?? "readequada");
  const [nome, setNome] = useState(editando?.nome ?? "");
  const [ato, setAto] = useState(editando?.ato ?? "");
  const [dataAto, setDataAto] = useState(editando?.data_ato ?? "");
  const [copiar, setCopiar] = useState(Boolean(base));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    const dados = { tipo, nome: nome.trim() || null, ato: ato.trim() || null, data_ato: dataAto || null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do orçamento ainda não estão no tipo Database
    const versoes = (supabase as any).from("prestacao_orcamento_versoes");
    let id = editando?.id ?? null;
    let error: { message?: string } | null = null;

    if (editando) {
      ({ error } = await versoes.update(dados).eq("id", editando.id));
    } else if (copiar && base) {
      const copia = await supabase.rpc("fn_prestacao_orcamento_copiar_versao" as never, { p_versao_id: base.id, p_tipo: tipo, p_nome: dados.nome } as never);
      error = copia.error;
      id = (copia.data as string | null) ?? null;
      if (!error && id && (dados.ato || dados.data_ato)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- idem
        ({ error } = await (supabase as any).from("prestacao_orcamento_versoes").update({ ato: dados.ato, data_ato: dados.data_ato }).eq("id", id));
      }
    } else {
      const nova = await versoes.insert({ ...dados, prestacao_id: prestacaoId }).select("id").single();
      error = nova.error;
      id = nova.data?.id ?? null;
    }

    setSalvando(false);
    if (error || !id) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a versão")); return; }
    onSaved(id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#0D0D0D]">{editando ? "Dados da versão" : "Nova versão do orçamento"}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {!editando && (
            <fieldset>
              <legend className={ROTULO}>Começar com</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {[
                  { valor: true, rotulo: base ? `Cópia de ${nomeDaVersao(base)}` : "Cópia (sem versão para copiar)", ajuda: "O vigente de cada item vira o valor da cópia." },
                  { valor: false, rotulo: "Versão vazia", ajuda: "Para importar outro orçamento." },
                ].map(opcao => {
                  const ativo = copiar === opcao.valor;
                  return (
                    <button
                      key={String(opcao.valor)}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      disabled={opcao.valor && !base}
                      onClick={() => setCopiar(opcao.valor)}
                      className={`rounded border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40 ${ativo ? "border-[#7259B5] bg-white" : "border-black/[.12] hover:border-black/25"}`}
                    >
                      <span className={`block text-[0.75rem] ${ativo ? "text-[#684DB0]" : "text-black/70"}`}>{opcao.rotulo}</span>
                      <span className="block text-[0.625rem] leading-4 text-black/40">{opcao.ajuda}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className={ROTULO}>Tipo</span>
              <Dropdown value={tipo} onChange={valor => setTipo(valor as TipoVersao)} ariaLabel="Tipo da versão" options={TIPOS_VERSAO.map(t => ({ value: t.id, label: t.rotulo }))} />
            </div>
            <label className="block">
              <span className={ROTULO}>Nome</span>
              <input value={nome} onChange={e => setNome(e.target.value)} className={CAMPO} placeholder="Opcional, ex.: março" />
            </label>
            <label className="block">
              <span className={ROTULO}>Ato que aprovou</span>
              <input value={ato} onChange={e => setAto(e.target.value)} className={CAMPO} placeholder="Ex.: Portaria nº 123" />
            </label>
            <label className="block">
              <span className={ROTULO}>Data do ato</span>
              <input type="date" value={dataAto} onChange={e => setDataAto(e.target.value)} className={CAMPO} />
            </label>
          </div>

          {!editando && (
            <p className="text-[0.6875rem] leading-4 text-black/45">
              A versão nova não muda o orçamento em uso. Quando o órgão aprovar, use “Tornar ativa”: os comprovantes passam para os itens correspondentes.
            </p>
          )}
          {erro && (
            <p role="alert" className="rounded border px-3 py-2 text-[0.75rem]" style={{ background: "#fff", borderColor: "#D94A4A30", color: "#B23B3B" }}>{erro}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-4 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {editando ? "Salvar" : "Criar versão"}
          </button>
        </div>
      </div>
    </div>
  );
}
