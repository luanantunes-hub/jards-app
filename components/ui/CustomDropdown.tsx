"use client";
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";
import { escalaUi } from "@/lib/escala-ui";

const LIMITE_PARA_COLUNAS = 12;

// Altura de uma opção (py-2 + uma linha de texto) e o respiro do menu, em px na base de 16px.
const ALTURA_OPCAO = 36;
const RESPIRO_MENU = 8;

/** Quantas colunas cabem na largura da janela (1 no celular, até 4 em telas largas). */
function colunasQueCabem(): number {
  if (typeof window === "undefined") return 1;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const largura = window.innerWidth / rem;
  return largura >= 64 ? 4 : largura >= 44 ? 3 : largura >= 24 ? 2 : 1;
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
  const [menuPosition, setMenuPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; colunas: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // O menu mostra todas as opções sem rolar por dentro: abre para o lado com
  // mais espaço e, quando a lista não cabe na altura, reparte em colunas
  // (ordem de cima para baixo). Só rola se nem as colunas couberem.
  const colunas = menuPosition?.colunas ?? 1;
  const linhasPorColuna = Math.ceil(options.length / colunas);

  const updateMenuPosition = useCallback(() => {
    const rect = dropdownRef.current?.getBoundingClientRect();
    if (!rect) return;
    const escala = escalaUi();
    const alturaLista = options.length * ALTURA_OPCAO * escala + RESPIRO_MENU * escala;
    const espacoAbaixo = window.innerHeight - rect.bottom - 12;
    const espacoAcima = rect.top - 12;
    const paraCima = placement === "top"
      ? espacoAcima >= alturaLista || espacoAcima > espacoAbaixo
      : espacoAbaixo < alturaLista && espacoAcima > espacoAbaixo;
    const espaco = paraCima ? espacoAcima : espacoAbaixo;
    const linhasQueCabem = Math.max(1, Math.floor((espaco - RESPIRO_MENU * escala) / (ALTURA_OPCAO * escala)));
    const porAltura = Math.ceil(options.length / linhasQueCabem);
    const porQuantidade = options.length > LIMITE_PARA_COLUNAS ? Math.ceil(options.length / LIMITE_PARA_COLUNAS) : 1;
    const colunasMenu = Math.min(colunasQueCabem(), Math.max(porAltura, porQuantidade));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - rect.width - 8));
    setMenuPosition(paraCima
      ? { left, bottom: window.innerHeight - rect.top + 4, width: rect.width, colunas: colunasMenu }
      : { left, top: rect.bottom + 4, width: rect.width, colunas: colunasMenu });
  }, [placement, options.length]);

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
              maxWidth: colunas > 2 ? "min(56rem, calc(100vw - 1rem))" : colunas > 1 ? "min(42rem, calc(100vw - 1rem))" : "min(24rem, calc(100vw - 1rem))",
              ...(colunas > 1
                ? {
                    display: "grid",
                    gridAutoFlow: "column" as const,
                    gridTemplateRows: `repeat(${linhasPorColuna}, auto)`,
                    gridTemplateColumns: `repeat(${colunas}, minmax(max-content, 1fr))`,
                    alignContent: "start",
                  }
                : {}),
              // Limite só de segurança: a altura toda que sobra na tela.
              maxHeight: `calc(100vh - ${menuPosition.top ?? menuPosition.bottom ?? 0}px - 0.5rem)`,
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
