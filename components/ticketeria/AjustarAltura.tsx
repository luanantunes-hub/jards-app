"use client";

import { useEffect } from "react";

/** Avisa a página que embute (o script do widget) a altura do conteúdo, para o iframe não ter barra de rolagem. Só manda a altura, nada mais. */
export function AjustarAltura() {
  useEffect(() => {
    if (window.parent === window) return;
    const avisar = () => window.parent.postMessage({ tipo: "jards-ticketeria-altura", altura: Math.ceil(document.documentElement.scrollHeight) }, "*");
    avisar();
    const observador = new ResizeObserver(avisar);
    observador.observe(document.body);
    return () => observador.disconnect();
  }, []);
  return null;
}
