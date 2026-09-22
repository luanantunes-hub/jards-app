"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function TopSheet({ titulo, onClose, children, footer }: {
  titulo: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: (close: () => void) => React.ReactNode;
}) {
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetVisible(true)));
  }, []);

  function close() {
    setSheetVisible(false);
    setTimeout(onClose, 260);
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: sheetVisible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)", transition: "background 260ms ease" }}
      onClick={close}
    >
      <div
        className="absolute left-1/2 top-0 flex max-h-[96dvh] flex-col overflow-hidden rounded-b bg-white"
        style={{
          width: 440,
          maxWidth: "92vw",
          transform: sheetVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100%)",
          transition: "transform 260ms cubic-bezier(.32,.72,0,1)",
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <h3 className="text-[14px] font-semibold text-black/80">{titulo}</h3>
          <button onClick={close} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.05]">
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
