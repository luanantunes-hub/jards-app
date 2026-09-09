"use client";

import type { ElementType, ReactNode } from "react";

// Botões de controle da aplicação (filtros, seletores segmentados e alternadores de visualização).
// Manter altura, bordas e estados ativos centralizados neste arquivo para preservar a consistência global.
export type SegmentOption<T extends string> = {
  value: T;
  label?: string;
  icon?: ElementType;
  ariaLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T | null;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  iconOnly?: boolean;
  className?: string;
};

// Botões de controle conectados: somente uma opção pode permanecer selecionada.
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  iconOnly = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex max-w-full overflow-x-auto rounded bg-white p-px ${className}`}
    >
      {options.map(({ value: optionValue, label, icon: Icon, ariaLabel: optionAriaLabel }, index) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={selected}
            aria-label={optionAriaLabel ?? label}
            title={iconOnly ? optionAriaLabel ?? label : undefined}
            onClick={() => onChange(optionValue)}
            className={`relative flex shrink-0 items-center justify-center gap-1.5 rounded-none border bg-white text-xs font-medium transition-colors first:ml-0 first:rounded-l last:rounded-r ${
              index > 0 ? "-ml-px" : ""
            } ${
              iconOnly ? "h-8 w-8 px-0" : "h-10 px-3 sm:h-9"
            } ${
              selected
                ? "z-10 border-[#7259B5] text-[#7259B5]"
                : "border-black/10 text-black/40 hover:bg-black/[.04] hover:text-black/65"
            } focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 focus-visible:ring-offset-1`}
          >
            {Icon && <Icon size={iconOnly ? 16 : 14} aria-hidden="true" />}
            {!iconOnly && label}
          </button>
        );
      })}
    </div>
  );
}

type FilterButtonProps = {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
};

// Botão de controle independente: filtros combináveis e ações auxiliares como "Limpar".
export function FilterButton({ active = false, onClick, children, ariaLabel, className = "" }: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded border bg-white px-3 text-xs font-medium transition-colors sm:h-9 ${
        active
          ? "border-[#7259B5] text-[#7259B5]"
          : "border-black/10 text-black/45 hover:bg-black/[.04] hover:text-black/65"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 focus-visible:ring-offset-1 ${className}`}
    >
      {children}
    </button>
  );
}
