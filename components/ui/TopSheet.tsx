"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/**
 * Folha que desce do topo. Três partes com peso: cabeçalho (etiqueta pequena + título grande + fechar),
 * conteúdo e uma base em papel com as ações. Sombra funda (`elevacao-folha`) e uma alça na borda de baixo.
 * `etiqueta` é opcional: a área ou o assunto, em letras pequenas acima do título.
 */
export function TopSheet({ titulo, etiqueta, onClose, children, footer }: {
  titulo: string;
  etiqueta?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: (close: () => void) => React.ReactNode;
}) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const titleId = useId();

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)));
  }, []);

  function close() {
    setSheetVisible(false);
    setTimeout(onClose, 260);
  }

  useModalDismiss(close);

  return (
    <div
      className={`fixed inset-0 z-50 transition-colors duration-[260ms] motion-reduce:transition-none veu ${sheetVisible ? "" : "veu-oculto"}`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute left-1/2 top-0 transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
        style={{
          width: "27.5rem",
          maxWidth: "92vw",
          transform: sheetVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100%)",
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex max-h-[96dvh] flex-col overflow-hidden rounded-b bg-white elevacao-folha">
          <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
            <div className="min-w-0">
              {etiqueta && <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/35">{etiqueta}</p>}
              <h3 id={titleId} className={`font-display text-[1.5rem] font-extrabold leading-[1.06] tracking-[-.045em] text-[#282525] [text-wrap:balance] sm:text-[1.875rem] ${etiqueta ? "mt-1.5" : ""}`}>{titulo}</h3>
            </div>
            <button type="button" onClick={close} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-black/[.09] bg-white shadow-[0_1px_2px_rgba(13,13,13,.05)] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <X size={14} className="text-black/50" aria-hidden="true" />
            </button>
          </div>
          <div className="mx-6 h-px shrink-0 bg-black/[.09] sm:mx-8" aria-hidden="true" />
          <div className="min-h-0 overflow-y-auto px-6 py-5 sm:px-8 sm:py-7">{children}</div>
          <div className="flex shrink-0 items-center justify-end gap-3 border-t bg-[#F7F7F5] px-6 py-4 sm:px-8 sm:py-5" style={{ borderColor: "rgba(40,37,37,.08)" }}>
            {footer(close)}
          </div>
          {/* borda de peso: a ponta da folha tem a espessura de uma lâmina, em roxo noite */}
          <div aria-hidden="true" className="h-1.5 shrink-0 bg-[#1C0E33] shadow-[inset_0_1px_0_rgba(255,255,255,.22)]" />
        </div>
        {/* alça: avisa que a folha recolhe; fica sobre o véu, na borda de baixo */}
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/70" />
      </div>
    </div>
  );
}
