"use client";

import type { ReactNode } from "react";
import { Search, type LucideIcon } from "lucide-react";

/** Cabeçalho de coluna de tabela conforme DESIGN.md: 10px, peso 500, caixa alta, tracking .08em. */
export const LIST_HEADER_CELL = "text-[10px] font-medium uppercase tracking-[.08em] text-black/35";

export function ListPageHeader({ eyebrow, title, description, summary, actions }: { eyebrow: string; title: string; description?: ReactNode; summary?: ReactNode; actions?: ReactNode }) {
  return <header className="shrink-0 border-b px-4 pb-5 pt-6 md:px-8 md:pt-8" style={{borderColor:"rgba(13,13,13,.08)"}}><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/30">{eyebrow}</p><h1 className="mt-1 text-[28px] font-bold tracking-[-.025em] text-[#0D0D0D] [text-wrap:balance]">{title}</h1>{description && <p className="mt-1.5 max-w-xl text-[13px] text-black/45">{description}</p>}</div><div className="flex flex-wrap items-center gap-3 lg:justify-end">{summary}{actions}</div></div></header>;
}

export function ListSummary({ strong, children, tone = "#0D0D0D" }: { strong: ReactNode; children: ReactNode; tone?: string }) {
  return <span className="text-[12px] text-black/40"><span className="font-bold tabular-nums" style={{color:tone}}>{strong}</span> {children}</span>;
}

export function ListToolbar({ children, search }: { children?: ReactNode; search?: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-3 border-b bg-white px-4 py-3 md:px-8 lg:flex-row lg:items-center lg:justify-between" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex max-w-full items-center gap-2 overflow-x-auto">{children}</div>{search}</div>;
}

export function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block w-full shrink-0 lg:w-[300px]"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25"/><input type="search" aria-label={placeholder} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-[12px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10"/></label>;
}

export function ListContent({ children, className }: { children: ReactNode; className?: string }) { return <main className={`flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 ${className ?? ""}`}>{children}</main>; }
export function ListTableSurface({ children, className }: { children: ReactNode; className?: string }) { return <div className={`overflow-x-auto rounded border bg-white ${className ?? ""}`} style={{borderColor:"rgba(13,13,13,.08)"}}>{children}</div>; }

export function PrimaryListAction({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[12px] font-medium text-black transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100">{children}</button>; }

/**
 * Estado vazio padrão: explica o que falta e oferece a próxima ação.
 * Use `filtered` quando há dados, mas os filtros não encontraram nada.
 */
export function ListEmptyState({ icon: Icon, title, description, action, filtered = false, onClearFilters }: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  filtered?: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-20 text-center">
      {Icon && <Icon size={28} className="mb-3 text-black/15" aria-hidden="true" />}
      <p className="text-[14px] font-semibold text-black/55">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-black/35">{description}</p>}
      {(action || (filtered && onClearFilters)) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {filtered && onClearFilters && (
            <button type="button" onClick={onClearFilters} className="h-9 rounded px-3 text-[12px] font-medium text-[#7259B5] transition hover:bg-[#7259B5]/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              Limpar filtros
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
