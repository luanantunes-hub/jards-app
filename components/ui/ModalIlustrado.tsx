"use client";

// Modal de marca com o tamanduá: convites e avisos de produto contados em
// passos curtos, com "Avançar" e "Voltar" (as setas do teclado também
// passam). Cada passo tem a sua ilustração, um rótulo, um título e o texto;
// o último passo leva as ações finais. Com um passo só, vira um aviso
// ilustrado, sem os pontos.

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export type PassoIlustrado = {
  imagem: { src: string; largura: number; altura: number; alt: string };
  /** Linha curta acima do título. */
  rotulo: string;
  titulo: string;
  conteudo: React.ReactNode;
};

/** Marque com `data-principal` a ação que recebe o foco no último passo. */
export function ModalIlustrado({ passos, acoesFinais, onClose }: {
  passos: readonly PassoIlustrado[];
  acoesFinais: React.ReactNode;
  onClose: () => void;
}) {
  const tituloId = useId();
  const rodape = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  const ultimo = indice === passos.length - 1;
  useModalDismiss(onClose);

  // A cada passo o foco vai para a ação principal: Enter avança.
  useEffect(() => {
    rodape.current?.querySelector<HTMLElement>("[data-principal]")?.focus();
  }, [indice]);

  function irPara(alvo: number) {
    setIndice(Math.max(0, Math.min(passos.length - 1, alvo)));
  }

  if (!passo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="relative flex max-h-[96dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-t bg-white sm:rounded border elevacao-3"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "ArrowRight") irPara(indice + 1);
          if (e.key === "ArrowLeft") irPara(indice - 1);
        }}
      >
        <button type="button" onClick={onClose} aria-label="Fechar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          <X size={16} aria-hidden />
        </button>

        <div key={indice} className="passo-ilustrado flex-1 overflow-y-auto">
          <div className="flex h-[11rem] items-end justify-center bg-[#FAFAF9] px-6 pt-6 sm:h-[12.5rem]">
            <Image
              src={passo.imagem.src}
              width={passo.imagem.largura}
              height={passo.imagem.altura}
              alt={passo.imagem.alt}
              priority
              className="h-auto max-h-full w-auto max-w-full object-contain"
            />
          </div>
          <div className="px-6 pb-2 pt-5 sm:min-h-[15rem]">
            <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{passo.rotulo}</p>
            <h2 id={tituloId} className="mt-1.5 text-balance text-[1.375rem] font-bold leading-tight tracking-[-.02em] text-[#282525]">
              {passo.titulo}
            </h2>
            <div className="mt-3 space-y-3 text-[0.8125rem] leading-relaxed text-black/65">{passo.conteudo}</div>
          </div>
        </div>

        <div ref={rodape} className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pb-5 pt-4">
          {passos.length > 1 ? (
            <div className="flex items-center gap-1" role="group" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
              {passos.map((p, i) => (
                <button key={p.titulo} type="button" onClick={() => irPara(i)}
                  aria-label={`Passo ${i + 1}: ${p.titulo}`} aria-current={i === indice ? "step" : undefined}
                  className="flex h-6 items-center rounded px-0.5 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <span className={`block h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${i === indice ? "w-5 bg-[#282525]" : "w-1.5 bg-black/15"}`} />
                </button>
              ))}
            </div>
          ) : <span />}
          <div className="ml-auto flex items-center gap-3">
            {indice > 0 && (
              <button type="button" onClick={() => irPara(indice - 1)}
                className="flex items-center gap-1 rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                <ArrowLeft size={13} aria-hidden />
                Voltar
              </button>
            )}
            {ultimo ? acoesFinais : (
              <button type="button" data-principal onClick={() => irPara(indice + 1)}
                className="flex items-center gap-1.5 rounded bg-[#282525] px-5 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98]">
                Avançar
                <ArrowRight size={14} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
