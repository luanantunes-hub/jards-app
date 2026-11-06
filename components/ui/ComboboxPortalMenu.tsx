"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { escalaUi } from "@/lib/escala-ui";

const MENU_MAX_HEIGHT = 320;

export type PortalPosition =
  | { placement: "below"; left: number; width: number; top: number }
  | { placement: "above"; left: number; width: number; bottom: number };

export function usePortalPosition(anchorRef: React.RefObject<HTMLElement | null>, isOpen: boolean) {
  const [position, setPosition] = useState<PortalPosition | null>(null);
  const update = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < MENU_MAX_HEIGHT * escalaUi() && spaceAbove > spaceBelow;
    setPosition(openAbove
      ? { placement: "above", left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4 }
      : { placement: "below", left: rect.left, width: rect.width, top: rect.bottom + 4 });
  }, [anchorRef]);
  useEffect(() => {
    if (!isOpen) { setPosition(null); return; }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, update]);
  return position;
}

export function PortalMenu({ position, width, children }: { position: PortalPosition | null; width?: number; children: React.ReactNode }) {
  if (!position) return null;
  return createPortal(
    <div
      className="fixed z-50 bg-white rounded overflow-hidden border elevacao-1"
      style={{
        left: position.left,
        width: width ?? position.width,
        borderColor: "rgba(13,13,13,.12)",
        ...(position.placement === "above" ? { bottom: position.bottom } : { top: position.top }),
      }}
    >
      <div className="max-h-[min(70vh,320px)] overflow-y-auto">{children}</div>
    </div>,
    document.body,
  );
}
