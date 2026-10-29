"use client";
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";

const LIMITE_PARA_COLUNAS = 12;

/** Quantas colunas cabem na largura da janela (1 no celular, até 3 no desktop). */
function colunasQueCabem(): number {
  if (typeof window === "undefined") return 1;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const largura = window.innerWidth / rem;
  return largura >= 44 ? 3 : largura >= 24 ? 2 : 1;
}

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
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Listas longas abrem em colunas (ordem alfabética de cima para baixo) para
  // aparecerem inteiras, sem rolar dentro de um menu pequeno.
  const colunas = options.length > LIMITE_PARA_COLUNAS ? colunasQueCabem() : 1;
  const linhasPorColuna = Math.ceil(options.length / colunas);

  const updateMenuPosition = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - rect.width - 8));
    setMenuPosition(placement === "top"
      ? { left, bottom: window.innerHeight - rect.top + 4, width: rect.width }
      : { left, top: rect.bottom + 4, width: rect.width });
  }, [placement]);

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

  // O menu pode ser mais largo que o botão (nomes longos, colunas): depois de
  // desenhado, empurra para a esquerda o que passaria da borda direita da tela.
  useLayoutEffect(() => {
    if (!isOpen || !menuPosition || !menuRef.current) return;
    const { width } = menuRef.current.getBoundingClientRect();
    const esquerdaMaxima = Math.max(8, window.innerWidth - width - 8);
    if (menuPosition.left > esquerdaMaxima) {
      setMenuPosition({ ...menuPosition, left: esquerdaMaxima });
    }
  }, [isOpen, menuPosition, colunas, options.length]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        disabled={disabled}
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
            ref={menuRef}
            className="fixed overflow-y-auto rounded border bg-white py-1 shadow-xl"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              // Pelo menos a largura do botão; cresce até caber o nome mais
              // longo (sem cortar com "…") e nunca passa da tela.
              minWidth: menuPosition.width,
              width: "max-content",
              maxWidth: colunas > 1 ? "min(42rem, calc(100vw - 1rem))" : "min(24rem, calc(100vw - 1rem))",
              ...(colunas > 1
                ? {
                    display: "grid",
                    gridAutoFlow: "column" as const,
                    gridTemplateRows: `repeat(${linhasPorColuna}, auto)`,
                    gridTemplateColumns: `repeat(${colunas}, minmax(max-content, 1fr))`,
                    alignContent: "start",
                  }
                : {}),
              // Usa a altura que a tela permite (a lista inteira quando cabe),
              // mas nunca menos que os 12,5rem de antes.
              maxHeight: `max(12.5rem, min(32rem, calc(100vh - ${menuPosition.top ?? menuPosition.bottom ?? 0}px - 1rem)))`,
              zIndex: portalZIndex,
              borderColor: "rgba(13,13,13,.12)",
            }}
          >
            {options.map((opt) => (
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
                <span className="flex-1 truncate">{opt.label}</span>
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
