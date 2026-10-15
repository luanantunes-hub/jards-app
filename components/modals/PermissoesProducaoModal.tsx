"use client";

import { useId, useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { CampoValor } from "@/components/ui/CampoValor";
import { definirFuncao, type ClienteDasPermissoes } from "@/lib/producao/permissoes-banco";
import {
  montarPedido,
  semMudancas,
  textoDaAlcada,
  type FuncaoNaProducao,
  type MembroParaPermissoes,
} from "@/lib/producao/permissoes";

interface PermissoesProducaoModalProps {
  organizationId: string;
  membro: Pick<MembroParaPermissoes, "user_id" | "full_name" | "email">;
  /** O que a pessoa tem hoje em `producao_funcoes`; null = sem registro (sem dinheiro e sem alçada). */
  atual: FuncaoNaProducao | null;
  /** O colaborador também aprova pedidos até um valor; o leitor nunca aprova, então não vê o campo. */
  comAlcada: boolean;
  onClose: () => void;
  /** Depois de gravar: a tela atualiza o que mostra e dá o aviso. O modal fecha em seguida. */
  onSaved: (funcao: FuncaoNaProducao) => void;
}

/**
 * Edição das permissões de um membro na produção (PD0.7b): ver o dinheiro e, para
 * o colaborador, aprovar pedidos até um valor. O recorte "só as temporadas e os
 * espaços em que está" fica fora até a PD1.9 (ver montarPedido). Quem decide é
 * fn_producao_definir_funcao, que só o administrador da organização executa.
 */
export default function PermissoesProducaoModal({ organizationId, membro, atual, comAlcada, onClose, onSaved }: PermissoesProducaoModalProps) {
  const [dinheiro, setDinheiro] = useState(atual?.dinheiro ?? false);
  const [textoAlcada, setTextoAlcada] = useState(textoDaAlcada(atual?.alcada ?? null));
  const [campoInvalido, setCampoInvalido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  const campoId = useId();

  function fechar() {
    if (!salvando) onClose();
  }
  useModalDismiss(fechar);

  // Mexer em qualquer item tira o aviso da tentativa anterior.
  function editou() {
    setErro(null);
    setCampoInvalido(false);
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (salvando) return;
    const montado = montarPedido({ comAlcada, dinheiro, textoAlcada, atual });
    if (!montado.ok) {
      setErro(montado.erro);
      setCampoInvalido(true);
      return;
    }
    // Nada mudou: não há o que gravar, e gravar trocaria "quem definiu" à toa.
    if (semMudancas(atual, montado.pedido)) {
      onClose();
      return;
    }
    setSalvando(true);
    setErro(null);
    const resultado = await definirFuncao(createClient() as unknown as ClienteDasPermissoes, organizationId, membro.user_id, montado.pedido);
    setSalvando(false);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    onSaved(montado.pedido);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[90vh] w-full max-w-[26.25rem] flex-col overflow-hidden rounded bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded bg-black/[.05] text-[#282525]">
              <SlidersHorizontal size={15} />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-[0.9375rem] font-bold text-[#282525]">Permissões da produção</h2>
              <p className="truncate text-[0.6875rem] text-black/40">{membro.full_name || membro.email}</p>
            </div>
          </div>
          <button type="button" onClick={fechar} aria-label="Fechar" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </div>

        <form onSubmit={salvar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {erro && (
              <div role="alert" className="rounded px-3 py-2 text-[0.75rem] font-medium" style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
                {erro}
              </div>
            )}

            <button
              type="button"
              role="checkbox"
              aria-checked={dinheiro}
              autoFocus
              disabled={salvando}
              onClick={() => { setDinheiro(marcado => !marcado); editou(); }}
              className={`flex w-full items-center gap-2.5 rounded border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-60 ${dinheiro ? "border-[#7259B5] bg-white" : "border-black/10 bg-white hover:bg-black/[.025]"}`}
            >
              <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border ${dinheiro ? "border-[#7259B5] bg-[#7259B5] text-white" : "border-black/25 bg-white"}`}>
                {dinheiro && <Check size={11} />}
              </span>
              <span className={`text-[0.75rem] ${dinheiro ? "text-[#684DB0]" : "text-black/70"}`}>Vê o dinheiro da produção</span>
            </button>

            {comAlcada && (
              <div>
                <label htmlFor={campoId} className="mb-1.5 block text-[0.6875rem] font-semibold text-black/50">Aprova pedidos até</label>
                <CampoValor
                  id={campoId}
                  value={dinheiro ? textoAlcada : ""}
                  onChange={texto => { setTextoAlcada(texto); editou(); }}
                  placeholder="Não aprova"
                  disabled={!dinheiro || salvando}
                  invalido={campoInvalido}
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <button type="button" onClick={fechar} className="px-3 py-2 text-[0.75rem] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded bg-[#2E8932] px-5 py-2 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
