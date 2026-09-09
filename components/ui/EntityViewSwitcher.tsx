"use client";

import { useEffect, useState, type ElementType } from "react";

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
  return (
    <div
      className="inline-flex h-9 items-center rounded border border-black/10 bg-white p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-[11px] font-semibold transition active:scale-[.98] ${
              active ? "bg-[#0D0D0D] text-white" : "text-black/45 hover:bg-black/[.04] hover:text-black/70"
            }`}
          >
            <Icon size={12} strokeWidth={1.8} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
