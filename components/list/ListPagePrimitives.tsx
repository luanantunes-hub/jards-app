"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

export function ListPageHeader({ eyebrow, title, summary, actions }: { eyebrow: string; title: string; summary?: ReactNode; actions?: ReactNode }) {
  return <header className="shrink-0 border-b px-4 pb-5 pt-6 md:px-8 md:pt-8" style={{borderColor:"rgba(13,13,13,.08)"}}><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/30">{eyebrow}</p><h1 className="mt-1 text-[28px] font-bold tracking-[-.025em] text-[#0D0D0D]">{title}</h1></div><div className="flex flex-wrap items-center gap-3 lg:justify-end">{summary}{actions}</div></div></header>;
}

export function ListSummary({ strong, children, tone = "#0D0D0D" }: { strong: ReactNode; children: ReactNode; tone?: string }) {
  return <span className="text-[12px] text-black/40"><span className="font-bold tabular-nums" style={{color:tone}}>{strong}</span> {children}</span>;
}

export function ListToolbar({ children, search }: { children?: ReactNode; search?: ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-3 border-b bg-white px-4 py-3 md:px-8 lg:flex-row lg:items-center lg:justify-between" style={{borderColor:"rgba(13,13,13,.06)"}}><div className="flex max-w-full items-center gap-2 overflow-x-auto">{children}</div>{search}</div>;
}

export function ListSearch({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="relative block w-full shrink-0 lg:w-[300px]"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25"/><input value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} className="h-9 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-[12px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10"/></label>;
}

export function ListContent({ children, className }: { children: ReactNode; className?: string }) { return <main className={`flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 ${className ?? ""}`}>{children}</main>; }
export function ListTableSurface({ children, className }: { children: ReactNode; className?: string }) { return <div className={`overflow-x-auto rounded border bg-white ${className ?? ""}`} style={{borderColor:"rgba(13,13,13,.08)"}}>{children}</div>; }

export function PrimaryListAction({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button onClick={onClick} className="flex h-9 items-center gap-1.5 rounded border border-black/12 bg-white px-3.5 text-[12px] font-medium text-black transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{children}</button>; }
