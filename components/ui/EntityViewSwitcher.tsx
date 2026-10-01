"use client";

import { useEffect, useState, type ElementType } from "react";
import { SegmentedControl } from "@/components/ui/FilterControls";

export type EntityViewOption<T extends string> = {
  value: T;
  label: string;
  icon: ElementType;
};

export function usePersistedViewMode<T extends string>(
  storageKey: string,
  allowed: readonly T[],
  fallback: T,
) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as T | null;
    // The stored preference is an external browser value loaded after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && allowed.includes(stored)) setValue(stored);
  }, [allowed, storageKey]);

  function update(next: T) {
    setValue(next);
    window.localStorage.setItem(storageKey, next);
  }

  return [value, update] as const;
}

/**
 * Alternador Lista/Kanban/Mapa… das páginas de entidade. Usa o mesmo controle
 * segmentado dos filtros, para que "selecionado" tenha uma única aparência
 * (contorno roxo, como pede o DESIGN.md) em todo o produto.
 */
export function EntityViewSwitcher<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Modo de visualização",
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly EntityViewOption<T>[];
  ariaLabel?: string;
}) {
  return <SegmentedControl value={value} onChange={onChange} options={options} ariaLabel={ariaLabel} />;
}
