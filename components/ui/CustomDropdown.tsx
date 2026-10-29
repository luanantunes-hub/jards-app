"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { escalaUi } from "@/lib/escala-ui";

interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  placement?: "top" | "bottom";
  portalZIndex?: number;
  disabled?: boolean;
  emphasized?: boolean;
  /** Campo de busca no topo do menu, para listas longas. */
  searchable?: boolean;
  /** Largura mínima do menu em px na base de 16px; o menu cresce além do gatilho para os nomes caberem. */
  menuMinWidth?: number;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  className = "",
  icon,
  compact = false,
  placement = "bottom",
  portalZIndex = 50,
  disabled = false,
  emphasized = true,
  searchable = false,
  menuMinWidth = 0,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const [busca, setBusca] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const termo = semAcento(busca.trim());
  const visiveis = termo ? options.filter((o) => semAcento(o.label).includes(termo)) : options;

  const updateMenuPosition = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, menuMinWidth * escalaUi()), window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setMenuPosition(placement === "top"
      ? { left, bottom: window.innerHeight - rect.top + 4, width }
      : { left, top: rect.bottom + 4, width });
  }, [placement, menuMinWidth]);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setIsOpen(false); } };
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (disabled) return; setBusca(""); setIsOpen(!isOpen); }}
        disabled={disabled}
        title={selected?.label}
        className={`flex items-center gap-2 bg-white border rounded transition cursor-pointer ${
          compact ? `px-3 py-2.5 text-xs ${emphasized ? "font-semibold" : "font-normal"}` : `px-3.5 py-2.5 text-sm ${emphasized ? "" : "font-normal"}`
        } ${
          value
            ? `border-black/12 text-[#282525] ${emphasized ? "font-semibold" : "font-normal"}`
            : "border-black/12 text-black/40 font-normal"
        } hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-black/[.02] disabled:text-black/25 disabled:hover:border-black/12`}
      >
        {icon && <span className="flex-shrink-0 text-black/35">{icon}</span>}
        <span className="flex-1 text-left truncate">
          {selected?.label || placeholder}
        </span>
        <CaretDown
          size={12}
          className={`flex-shrink-0 text-black/35 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && menuPosition && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: portalZIndex - 1 }} onClick={() => setIsOpen(false)} />
          <div
            className={`fixed overflow-y-auto rounded border bg-white py-1 shadow-xl ${searchable ? "max-h-[20rem]" : "max-h-[12.5rem]"}`}
            style={{ ...menuPosition, zIndex: portalZIndex, borderColor: "rgba(13,13,13,.12)" }}
          >
            {searchable && (
              <div className="sticky top-0 bg-white px-2 pb-1 pt-1">
                <label className="flex items-center gap-2 rounded border border-black/12 px-2.5 py-2 focus-within:ring-2 focus-within:ring-black/10">
                  <MagnifyingGlass size={12} className="flex-shrink-0 text-black/35" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar…"
                    aria-label={`Buscar ${placeholder.toLowerCase()}`}
                    className="w-full bg-transparent text-[0.75rem] text-[#282525] outline-none placeholder:text-black/35"
                  />
                </label>
              </div>
            )}
            {searchable && visiveis.length === 0 && (
              <p className="px-3 py-2 text-[0.75rem] text-black/40">Nada encontrado</p>
            )}
            {visiveis.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[0.8125rem] ${emphasized ? "font-medium" : "font-normal"} flex items-center gap-2 transition ${
                  compact ? "text-[0.75rem]" : ""
                } ${
                  value === opt.value
                    ? "text-[#282525] bg-black/[0.03]"
                    : "text-black/55 hover:bg-black/[0.04]"
                } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
              >
                {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                <span className={`flex-1 ${menuMinWidth ? "break-words" : "truncate"}`}>{opt.label}</span>
                {value === opt.value && (
                  <span className="ml-auto text-[0.625rem] text-black/30">✓</span>
                )}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
