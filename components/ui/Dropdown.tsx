"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownItem {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownItem[];
  placeholder?: string;
  className?: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    function onMousedown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onScroll(e: Event) {
      if (listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onMousedown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMousedown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  function handleToggle() {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom - 4;
      const spaceAbove = rect.top - 4;
      const maxListHeight = 208; // max-h-52

      if (spaceBelow >= Math.min(maxListHeight, spaceAbove)) {
        setListStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      } else {
        setListStyle({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
      }
    }
    setOpen(true);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="flex h-10 w-full items-center gap-2 rounded border bg-white px-3 text-left text-[13px] transition"
        style={{ borderColor: open ? "rgba(13,13,13,.28)" : "rgba(13,13,13,.12)" }}
      >
        <span className={`flex-1 truncate ${selected ? "text-black" : "text-black/30"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} className={`flex-shrink-0 text-black/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={listRef}
          className="fixed z-[999] max-h-52 overflow-y-auto rounded border bg-white py-1 shadow-lg"
          style={{ ...listStyle, borderColor: "rgba(13,13,13,.12)" }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition hover:bg-black/[.04]"
              style={{ color: opt.value === value ? "#0D0D0D" : "rgba(13,13,13,.60)" }}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check size={12} className="flex-shrink-0 text-black/40" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
