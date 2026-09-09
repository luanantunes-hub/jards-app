"use client";

import type { DragEvent, ReactNode } from "react";
import { Plus } from "lucide-react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function KanbanBoard({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  return <div className="overflow-x-auto bg-black/[.012] px-4 py-5 md:px-6 md:py-6"><div className={`flex min-w-fit items-stretch gap-3 ${centered ? "justify-center" : ""}`}>{children}</div></div>;
}

export function KanbanColumn({ label, count, total, forecast, accent, iconName, active = false, compact = false, addLabel, onAdd, onDragOver, onDragLeave, onDrop, children }: {
  label: string; count: number | null; total?: string | null; forecast?: string | null; accent: string; active?: boolean; compact?: boolean;
  iconName?: string;
  addLabel?: string; onAdd?: () => void; onDragOver?: (event: DragEvent<HTMLDivElement>) => void; onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void; children: ReactNode;
}) {
  const HeaderIcon = iconName ? (Icons as any)[iconName] as LucideIcon | undefined : undefined;
  return <section className={`flex shrink-0 snap-start flex-col overflow-hidden rounded border transition-colors ${compact ? "min-h-[300px] w-[82vw] max-w-[304px] md:w-[300px]" : "min-h-[400px] w-[84vw] max-w-[304px] md:w-72"}`} style={{ borderColor: active ? "#7259B570" : "rgba(13,13,13,.07)", background: active ? "#7259B508" : "rgba(13,13,13,.018)" }} aria-label={`${label}: ${count ?? 0} itens`}>
    <header className={`flex items-center justify-between gap-3 border-b bg-white/80 ${compact ? "min-h-[54px] px-3.5 py-2.5" : "min-h-[62px] items-start px-4 py-3"}`} style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">{HeaderIcon ? <HeaderIcon size={14} strokeWidth={2.2} className="shrink-0" style={{ color: accent }}/> : <span className="h-[7px] w-[7px] shrink-0 rounded" style={{ background: accent }}/>}<h2 className="truncate text-[12px] font-semibold text-black/75">{label}</h2></div>
        {compact ? (
          <p className="mt-0.5 truncate text-[10px] font-medium tabular-nums text-black/35">{count === null ? "Carregando" : `${count} ${count === 1 ? "item" : "itens"}`}{total ? ` · ${total}` : ""}{forecast ? ` · ${forecast}` : ""}</p>
        ) : (
          <>
            <p className="mt-1 text-[10.5px] font-medium tabular-nums text-black/35">{count === null ? "Carregando" : `${count} ${count === 1 ? "item" : "itens"}`}{total ? ` · ${total}` : ""}</p>
            {forecast && <p className="mt-0.5 text-[10px] font-medium tabular-nums" style={{color:accent}}>Previsão {forecast}</p>}
          </>
        )}
      </div>
      {onAdd&&<button onClick={onAdd} className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-black/10 bg-white text-black/30 transition hover:bg-black/[.04] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" title={addLabel} aria-label={addLabel}><Plus size={12}/></button>}
    </header>
    <div className="flex-1 space-y-2.5 p-2.5 transition-colors" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>{children}</div>
  </section>;
}

export function KanbanCard({ children, onClick, dragging = false, draggable = false, onDragStart, onDragEnd }: {
  children: ReactNode; onClick?: () => void; dragging?: boolean;
  draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void;
}) {
  return (
    <article
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? (event) => { event.dataTransfer.effectAllowed = "move"; onDragStart?.(); } : undefined}
      onDragEnd={draggable ? () => onDragEnd?.() : undefined}
      className={`group relative rounded border bg-white p-3.5 transition-[transform,border-color,box-shadow,opacity] duration-200 hover:-translate-y-px hover:border-black/15 hover:shadow-[0_8px_24px_rgba(13,13,13,.055)] active:translate-y-0 ${onClick ? "cursor-pointer" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ borderColor: "rgba(13,13,13,.08)", opacity: dragging ? .28 : 1 }}
    >
      {children}
    </article>
  );
}

export function KanbanEmpty({ label, actionLabel, onAction }: { label: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center"><p className="text-[11px] font-medium text-black/28">{label}</p>{onAction&&<button onClick={onAction} className="mt-2 text-[11px] font-medium text-[#7259B5] hover:text-[#7259B5]/70">{actionLabel ?? "Adicionar primeiro"}</button>}</div>;
}

export function KanbanSkeleton() {
  return <div className="animate-pulse rounded border bg-white p-3.5" style={{borderColor:"rgba(13,13,13,.07)"}}><div className="mb-3 flex items-center gap-2"><div className="h-5 w-5 rounded bg-black/7"/><div className="h-2.5 w-24 rounded bg-black/7"/></div><div className="mb-2 h-3.5 w-full rounded bg-black/7"/><div className="h-3.5 w-3/5 rounded bg-black/7"/><div className="mt-4 h-2.5 w-2/5 rounded bg-black/7"/></div>;
}
