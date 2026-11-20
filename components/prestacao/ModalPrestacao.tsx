"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/**
 * Modal das telas da prestação: cabeçalho fixo com título e fechar, conteúdo
 * que rola e rodapé de ações sempre visível. Escape e clique fora fecham.
 */
export function ModalPrestacao({ titulo, subtitulo, onClose, children, rodape, largura = "max-w-[40rem]" }: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: React.ReactNode;
  rodape: React.ReactNode;
  largura?: string;
}) {
  const titleId = useId();
  useModalDismiss(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center veu p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[92dvh] w-full ${largura} flex-col overflow-hidden rounded bg-white border elevacao-3`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div>
            <h2 id={titleId} className="text-[0.875rem] font-semibold text-[#282525]">{titulo}</h2>
            {subtitulo && <p className="text-[0.6875rem] text-black/40">{subtitulo}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1.5 text-black/35 transition hover:bg-black/5 hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {rodape}
        </div>
      </div>
    </div>
  );
}
