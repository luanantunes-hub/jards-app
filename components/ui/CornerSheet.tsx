"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const DURACAO_MS = 220;

/**
 * Painel flutuante no canto inferior direito, sem véu por trás: a pessoa continua vendo e usando o resto da tela,
 * como o escrever e-mail das caixas de entrada tradicionais. No celular, sem canto pra flutuar, ocupa a largura
 * toda e sobe da base, como o BottomSheet.
 */
export function CornerSheet({ titulo, onClose, children, footer }: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: (close: () => void) => React.ReactNode;
}) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisivel(true)));
    if (!painelRef.current?.contains(document.activeElement)) painelRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, []);

  function close() {
    if (saindo) return;
    setSaindo(true);
    setVisivel(false);
    window.setTimeout(onClose, DURACAO_MS);
  }

  useModalDismiss(close);

  return (
    <div
      ref={painelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      tabIndex={-1}
      className={`fixed inset-x-0 bottom-0 z-50 mx-auto w-full outline-none transition-all duration-[220ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:mx-0 sm:w-[25rem] ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 sm:translate-y-6"
      }`}
    >
      <div className="flex max-h-[85dvh] flex-col overflow-hidden folha-vidro-cima sm:max-h-[33rem] sm:rounded-b-[1.25rem]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h3 id={tituloId} className="truncate text-[0.8125rem] font-semibold text-[#282525]">{titulo}</h3>
          <button type="button" onClick={close} aria-label="Fechar" className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-black/40 transition hover:bg-black/[.06] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <div className="folha-rodape flex shrink-0 items-center justify-end gap-3 border-t px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          {footer(close)}
        </div>
      </div>
    </div>
  );
}
