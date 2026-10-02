"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CaretDown } from "@phosphor-icons/react";

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

  const selected = options.find((o) => o.value === value);

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
            ? `border-black/12 text-[#0D0D0D] ${emphasized ? "font-semibold" : "font-normal"}`
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
            className="fixed max-h-[12.5rem] overflow-y-auto rounded border bg-white py-1 shadow-xl"
            style={{ ...menuPosition, zIndex: portalZIndex, borderColor: "rgba(13,13,13,.12)" }}
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
                    ? "text-[#0D0D0D] bg-black/[0.03]"
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
