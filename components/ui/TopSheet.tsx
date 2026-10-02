"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";

export function TopSheet({ titulo, onClose, children, footer }: {
  titulo: string;
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
      className="fixed inset-0 z-50 transition-colors duration-[260ms] motion-reduce:transition-none"
      style={{ background: sheetVisible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)" }}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute left-1/2 top-0 flex max-h-[96dvh] flex-col overflow-hidden rounded-b bg-white transition-transform duration-[260ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none"
        style={{
          width: "27.5rem",
          maxWidth: "92vw",
          transform: sheetVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100%)",
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 id={titleId} className="text-[0.875rem] font-semibold text-black/80">{titulo}</h3>
          <button type="button" onClick={close} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            <X size={14} className="text-black/40" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {footer(close)}
        </div>
      </div>
    </div>
  );
}
