"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

const DURACAO_MS = 260;

/**
 * Painel que sobe da base da tela: largura total no celular, centralizado no
 * desktop. Cabeçalho e rodapé ficam fixos; só o conteúdo rola.
 * `footer` recebe `close`, que anima a saída antes de chamar `onClose`.
 */
export function BottomSheet({ titulo, etiqueta, subtitulo, onClose, children, footer }: {
  titulo: string;
  /** Opcional: a área ou o assunto, em letras pequenas acima do título. */
  etiqueta?: string;
  subtitulo?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: (close: () => void) => React.ReactNode;
}) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);
  // O painel só monta no navegador, depois de um clique: o foco atual é quem o abriu.
  const [focoAnterior] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const painelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisivel(true)));
    // Sem autoFocus no conteúdo, o foco entra no painel para o teclado e o leitor de tela.
    if (!painelRef.current?.contains(document.activeElement)) painelRef.current?.focus();
    return () => cancelAnimationFrame(frame);
  }, []);

  function close() {
    if (saindo) return;
    setSaindo(true);
    setVisivel(false);
    window.setTimeout(() => {
      onClose();
      focoAnterior?.focus?.();
    }, DURACAO_MS);
  }

  useModalDismiss(close);

  function prenderFoco(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !painelRef.current) return;
    const focaveis = Array.from(painelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (focaveis.length === 0) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (event.shiftKey && document.activeElement === primeiro) { event.preventDefault(); ultimo.focus(); }
    else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus(); }
  }

  return (
    <div
      className={`fixed inset-0 z-50 transition-colors duration-[260ms] motion-reduce:transition-none veu ${visivel ? "" : "veu-oculto"}`}
      onClick={close}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onKeyDown={prenderFoco}
        onClick={event => event.stopPropagation()}
        className={`absolute inset-x-0 bottom-0 mx-auto w-full outline-none transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none md:max-w-[35rem] ${visivel ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex max-h-[92dvh] flex-col overflow-hidden folha-vidro-cima">
          <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-5 pt-6 md:px-8 md:pt-7">
            <div className="min-w-0">
              {etiqueta && <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/35">{etiqueta}</p>}
              <h3 id={tituloId} className={`font-display text-[1.375rem] font-extrabold leading-[1.08] tracking-[-.045em] text-[#282525] [text-wrap:balance] md:text-[1.75rem] ${etiqueta ? "mt-1.5" : ""}`}>{titulo}</h3>
              {subtitulo && <p className="mt-1 truncate text-[0.8125rem] text-black/45">{subtitulo}</p>}
            </div>
            <button type="button" onClick={close} aria-label="Fechar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white bg-white/70 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(13,13,13,.07),0_1px_2px_rgba(13,13,13,.08)] backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <X size={15} className="text-black/50" aria-hidden="true" />
            </button>
          </div>
          <div className="mx-5 shrink-0 border-t border-black/[.08] shadow-[0_1px_0_rgba(255,255,255,.95)] md:mx-8" aria-hidden="true" />
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-7">{children}</div>
          <div className="folha-rodape flex shrink-0 items-center justify-end gap-3 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8 md:py-5">
            {footer(close)}
          </div>
        </div>
        {/* alça: avisa que a folha recolhe; fica sobre o véu, na borda de cima */}
        <span aria-hidden="true" className="pointer-events-none absolute -top-3 left-1/2 h-1.5 w-12 -translate-x-1/2 rounded-full bg-white/70" />
      </div>
    </div>
  );
}
