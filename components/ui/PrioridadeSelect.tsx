"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, ArrowUp, Minus, ArrowDown } from "lucide-react";
import type { Prioridade } from "@/lib/supabase/types";

const PRIO: Record<Prioridade, { label: string; color: string; Icon: React.ElementType }> = {
  alta:  { label: "Alta",  color: "#D94E4E", Icon: ArrowUp },
  media: { label: "Média", color: "#B07A14", Icon: Minus },
  baixa: { label: "Baixa", color: "#888888", Icon: ArrowDown },
};

export function PrioridadeSelect({ value, onChange }: {
  value: Prioridade | null;
  onChange: (p: Prioridade | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = 146;
      const hasRoomBelow = window.innerHeight - rect.bottom >= menuHeight + 8;
      const top = hasRoomBelow
        ? rect.bottom + 4
        : Math.max(8, rect.top - menuHeight - 4);
      setPosition({
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - rect.width - 8)),
        top,
        width: rect.width,
      });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const selected = value ? PRIO[value] : null;
  const SelectedIcon = selected?.Icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 border rounded px-3 py-2.5 text-[13px] text-left transition hover:border-[#7259B5]/40"
        style={{ borderColor: open ? "#7259B5" : "rgba(13,13,13,.15)" }}
      >
        {selected ? (
          <span className="inline-flex items-center gap-1.5">
            {SelectedIcon && <SelectedIcon size={15} strokeWidth={2.5} className="flex-shrink-0" style={{ color: selected.color }} />}
            <span className="text-black/80 truncate">{selected.label}</span>
          </span>
        ) : (
          <span className="text-black/35">Sem prioridade</span>
        )}
        <ChevronDown size={14} className={`text-black/30 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && position && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 99 }} onMouseDown={() => setOpen(false)} />
          <div className="fixed overflow-hidden rounded border bg-white shadow-lg" style={{ ...position, zIndex: 100, borderColor: "rgba(13,13,13,.1)" }}>
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-black/60 hover:bg-black/[0.03] transition"
          >
            <span className="inline-flex items-center gap-1.5">
              <Minus size={14} strokeWidth={2} className="flex-shrink-0 text-black/25" />
              Sem prioridade
            </span>
            {!value && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
          </button>
          {(Object.keys(PRIO) as Prioridade[]).map(p => {
            const it = PRIO[p];
            const Icon = it.Icon;
            return (
              <button
                key={p}
                type="button"
                onClick={() => { onChange(p); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-black/[0.03] transition"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: it.color }}>
                    <Icon size={8} strokeWidth={2.5} />
                  </span>
                  <span className="text-[12px] text-black">{it.label}</span>
                </span>
                {value === p && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
              </button>
            );
          })}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
