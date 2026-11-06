"use client";

import { useEffect, useState } from "react";
import { escalaUi } from "@/lib/escala-ui";

type PopoverPos = { top: number; left: number; width: number };

export function useAnchoredPopover() {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  // width em px na base de 16px; acompanha a fonte base em telas grandes.
  function abrir(event: React.MouseEvent<HTMLElement>, larguraBase = 340) {
    const r = event.currentTarget.getBoundingClientRect();
    const width = larguraBase * escalaUi();
    setPos({
      top: r.bottom + 6,
      left: Math.min(r.right - width, window.innerWidth - width - 8),
      width,
    });
  }
  function fechar() {
    setPos(null);
  }

  return { pos, abrir, fechar };
}

export function AnchoredPopover({ pos, onClose, children }: {
  pos: PopoverPos | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!pos) return;
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); onClose(); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos, onClose]);

  if (!pos) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded bg-white p-4 border elevacao-1"
        style={{ top: pos.top, left: pos.left, width: pos.width, borderColor: "rgba(13,13,13,.1)" }}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
