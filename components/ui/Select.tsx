"use client";
import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** false = inline-block (toolbar/filtro), true = w-full (padrão, formulários) */
  block?: boolean;
}

/**
 * Dropdown interno do Jards. Substitui <select> nativo em todos os formulários e modais.
 * Para filtros de toolbar com largura automática, use block={false}.
 * Para dropdowns com ícone/busca, use CustomDropdown.
 */
export function Select({ className = "", children, block = true, ...props }: SelectProps) {
  return (
    <div className={`relative ${block ? "w-full" : "inline-block"}`}>
      <select
        className={`appearance-none rounded border border-black/[.12] bg-white text-[12px] text-black outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:cursor-not-allowed disabled:opacity-50 ${block ? "w-full" : ""} ${className}`}
        style={{ paddingRight: "2rem" }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/35"
      />
    </div>
  );
}
