"use client";

import Image from "next/image";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type PesquisaEmpresaModalProps = {
  empresaNome: string;
  usuarioNome: string;
  loading: boolean;
  concluida: boolean;
  jaSolicitada: boolean;
  erro: string | null;
  onClose: () => void;
  onStart: () => void;
};

export function PesquisaEmpresaModal({
  empresaNome,
  usuarioNome,
  loading,
  concluida,
  jaSolicitada,
  erro,
  onClose,
  onStart,
}: PesquisaEmpresaModalProps) {
  useModalDismiss(() => { if (!loading) onClose(); });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pesquisa-empresa-title"
        className="relative w-full max-w-[32.5rem] overflow-hidden rounded border border-black/10 bg-white shadow-[0_28px_80px_rgba(13,13,13,.18)]"
      >
        <button
          type="button"
          aria-label="Fechar"
          disabled={loading}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded border border-black/10 bg-white/90 text-black/35 backdrop-blur transition hover:bg-black/[.04] hover:text-black/60 disabled:opacity-40"
        >
          <X size={14} weight="bold" />
        </button>

        <div className="relative h-[15.625rem] border-b border-black/[.06] bg-white sm:h-[17.5rem]">
          <Image
            src="/tamandua-busca.png"
            alt="Tamanduá dirigindo uma scooter enquanto leva uma árvore adormecida"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 520px"
            className="object-contain"
          />
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-7 sm:pb-7">
          {concluida ? (
            <>
              <p className="text-[0.625rem] font-semibold uppercase tracking-[.12em] text-[#2E8932]">Busca priorizada</p>
              <h2 id="pesquisa-empresa-title" className="mt-2 text-[1.3125rem] font-semibold tracking-[-.025em] text-[#0D0D0D]">
                Pedido recebido.
              </h2>
              <p className="mt-3 text-[0.875rem] leading-6 text-black/50">
                {jaSolicitada
                  ? `A pesquisa de ${empresaNome} já está na nossa fila. Vamos te avisar quando os dados estiverem disponíveis.`
                  : `A pesquisa de ${empresaNome} entrou na nossa fila. Vamos identificar os contatos-chave e te avisar em breve.`}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 inline-flex min-h-10 items-center justify-center rounded border border-[#7259B5]/30 bg-white px-5 text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98]"
              >
                Fechar
              </button>
            </>
          ) : (
            <>
              <h2 id="pesquisa-empresa-title" className="text-[1.0625rem] font-medium leading-7 tracking-[-.015em] text-black/70">
                <strong className="font-semibold text-[#0D0D0D]">{usuarioNome}</strong>, precisamos confirmar algumas informações da empresa <strong className="font-semibold text-[#0D0D0D]">{empresaNome}</strong>. Clique em “começar busca” para priorizar este pedido. Vamos identificar os contatos-chave e te avisar em breve.
              </h2>

              {erro && (
                <p role="alert" className="mt-4 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.6875rem] leading-5 text-[#D94E4E]">
                  {erro}
                </p>
              )}

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={onStart}
                  className="inline-flex min-h-11 items-center rounded border border-[#7259B5]/30 bg-white text-[0.75rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-45"
                >
                  <span className="flex items-center gap-2 px-4">
                    <MagnifyingGlass size={14} weight="bold" />
                    {loading ? "Priorizando…" : "Começar busca"}
                  </span>
                  <span className="flex min-h-11 items-center border-l border-[#7259B5]/20 px-3 tabular-nums">(-1)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
