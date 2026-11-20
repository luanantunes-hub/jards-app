"use client";
import { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { escalaUi } from "@/lib/escala-ui";

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
  /** Nome acessível quando não há <label> associado ao campo. */
  ariaLabel?: string;
  disabled?: boolean;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  className = "",
  ariaLabel,
  disabled = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const openedByKeyboard = useRef(false);

  const selected = options.find(o => o.value === value);

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
  }, [open]);

  // Ao abrir pelo teclado, o foco vai para a opção selecionada (ou a primeira).
  useEffect(() => {
    if (!open || !openedByKeyboard.current) return;
    openedByKeyboard.current = false;
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]");
    const index = Math.max(0, options.findIndex(o => o.value === value));
    items?.[index]?.focus();
  }, [open, options, value]);

  function openList() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom - 4;
      const spaceAbove = rect.top - 4;
      const maxListHeight = 208 * escalaUi(); // max-h-52 (13rem)

      if (spaceBelow >= Math.min(maxListHeight, spaceAbove)) {
        setListStyle({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      } else {
        setListStyle({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
      }
    }
    setOpen(true);
  }

  function handleToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (open) { setOpen(false); return; }
    // detail === 0: o "clique" veio de Enter/Espaço.
    openedByKeyboard.current = event.detail === 0;
    openList();
  }

  function closeAndFocusTrigger() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: string) {
    onChange(next);
    closeAndFocusTrigger();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openedByKeyboard.current = true;
      openList();
    } else if (open && event.key === "Escape") {
      // Marca o evento como consumido: o modal que contém o campo continua aberto.
      event.preventDefault();
      setOpen(false);
    }
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (index: number) => items[(index + items.length) % items.length]?.focus();
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); focusAt(current + 1); break;
      case "ArrowUp": event.preventDefault(); focusAt(current - 1); break;
      case "Home": event.preventDefault(); focusAt(0); break;
      case "End": event.preventDefault(); focusAt(items.length - 1); break;
      case "Escape": event.preventDefault(); closeAndFocusTrigger(); break;
      case "Tab": setOpen(false); break;
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className="flex h-10 w-full items-center gap-2 rounded border bg-white px-3 text-left text-[0.8125rem] transition focus-visible:border-[#7259B5]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/15 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderColor: open ? "rgba(13,13,13,.28)" : "rgba(13,13,13,.12)" }}
      >
        <span className={`flex-1 truncate ${selected ? "text-[#282525]" : "text-black/30"}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} aria-hidden="true" className={`flex-shrink-0 text-black/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          onKeyDown={handleListKeyDown}
          className="fixed z-[999] max-h-52 overflow-y-auto rounded bg-white py-1 border elevacao-1"
          style={{ ...listStyle, borderColor: "rgba(13,13,13,.12)" }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={e => e.preventDefault()}
              // Sem o preventDefault, um <label> em volta do campo repassa o clique
              // ao gatilho (a opção já saiu da tela) e o menu reabre.
              onClick={e => { e.preventDefault(); choose(opt.value); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.8125rem] outline-none transition hover:bg-black/[.04] focus-visible:bg-black/[.04]"
              style={{ color: opt.value === value ? "#282525" : "rgba(13,13,13,.60)" }}
            >
              <span className="flex-1 truncate">{opt.label}</span>
              {opt.value === value && <Check size={12} aria-hidden="true" className="flex-shrink-0 text-black/40" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
