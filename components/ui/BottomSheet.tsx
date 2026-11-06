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
export function BottomSheet({ titulo, subtitulo, onClose, children, footer }: {
  titulo: string;
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
      className="fixed inset-0 z-50 transition-colors duration-[260ms] motion-reduce:transition-none"
      style={{ background: visivel ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)" }}
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
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t bg-white outline-none transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none md:max-w-[35rem] ${visivel ? "translate-y-0" : "translate-y-full"} border-t elevacao-2-cima`}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4 md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <div className="min-w-0">
            <h3 id={tituloId} className="text-[0.9375rem] font-semibold text-[#282525]">{titulo}</h3>
            {subtitulo && <p className="mt-0.5 truncate text-[0.75rem] text-black/40">{subtitulo}</p>}
          </div>
          <button type="button" onClick={close} aria-label="Fechar" className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={15} className="text-black/40" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {footer(close)}
        </div>
      </div>
    </div>
  );
}
