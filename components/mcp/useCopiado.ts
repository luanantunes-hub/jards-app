"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Copia um texto e guarda por 2 segundos qual item foi copiado, para trocar o ícone por um "Copiado". */
export function useCopiado() {
  const [copiado, setCopiado] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copiar = useCallback(async (id: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return false;
    }
    setCopiado(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 2000);
    return true;
  }, []);

  return { copiado, copiar };
}
