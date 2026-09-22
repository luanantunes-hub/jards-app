"use client";

import { useEffect, useState } from "react";

type PopoverPos = { top: number; left: number; width: number };

export function useAnchoredPopover() {
  const [pos, setPos] = useState<PopoverPos | null>(null);

  function abrir(event: React.MouseEvent<HTMLElement>, width = 340) {
    const r = event.currentTarget.getBoundingClientRect();
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
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos, onClose]);

  if (!pos) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 rounded border bg-white p-4 shadow-xl"
        style={{ top: pos.top, left: pos.left, width: pos.width, borderColor: "rgba(13,13,13,.1)" }}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
