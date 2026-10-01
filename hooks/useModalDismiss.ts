"use client";

import { useEffect, useRef } from "react";

const openModals: symbol[] = [];

/**
 * Fecha o modal/sheet com Escape.
 *
 * Só o modal aberto mais recentemente reage. Menus internos (Dropdown,
 * CustomDropdown, popovers) que consomem o Escape chamam
 * `event.preventDefault()`; como eles registram o listener depois do modal,
 * a decisão espera o fim do despacho do evento para respeitar essa marca.
 */
export function useModalDismiss(onClose: () => void, { enabled = true }: { enabled?: boolean } = {}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const id = Symbol("modal");
    openModals.push(id);
    const isTop = () => openModals[openModals.length - 1] === id;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || !isTop()) return;
      window.setTimeout(() => {
        if (!event.defaultPrevented && isTop()) onCloseRef.current();
      }, 0);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.indexOf(id);
      if (index >= 0) openModals.splice(index, 1);
    };
  }, [enabled]);
}
