"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, FolderOpen, ImagePlus } from "lucide-react";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import type { IdentityIconOption, IdentityType } from "@/components/ui/ProjectIdentity";
import { escalaUi } from "@/lib/escala-ui";

type IdentityColorOption = { key: string; label: string; cor: string };

type IdentityEditorProps = {
  name: string;
  type: IdentityType;
  value: string;
  logoUrl?: string | null;
  color: string;
  iconOptions: readonly IdentityIconOption[];
  colors: readonly IdentityColorOption[];
  onTypeChange: (type: "icone" | "logo") => void;
  onValueChange: (value: string) => void;
  onColorChange: (color: string) => void;
  onLogoRequest: () => void;
  logoHelp: string;
};

export function IdentityEditor({
  name, type, value, logoUrl, color, iconOptions, colors,
  onTypeChange, onValueChange, onColorChange, onLogoRequest, logoHelp,
}: IdentityEditorProps) {
  const [openPicker, setOpenPicker] = useState<"icon" | "color" | null>(null);
  const [openAbove, setOpenAbove] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const selectedIcon = iconOptions.find((option) => option.key === value);
  const SelectedIcon = selectedIcon?.Icon ?? FolderOpen;
  const selectedColor = colors.find((option) => option.cor.toLowerCase() === color.toLowerCase());
  const logoMode = type === "logo";

  function togglePicker(picker: "icon" | "color", trigger: HTMLButtonElement) {
    if (openPicker === picker) { setOpenPicker(null); return; }
    const scrollArea = trigger.closest(".overflow-y-auto");
    const bounds = scrollArea?.getBoundingClientRect();
    const triggerBounds = trigger.getBoundingClientRect();
    const bottom = Math.min(bounds?.bottom ?? window.innerHeight, window.innerHeight);
    const top = Math.max(bounds?.top ?? 0, 0);
    const espaco = 140 * escalaUi();
    setOpenAbove(bottom - triggerBounds.bottom < espaco && triggerBounds.top - top > espaco);
    setOpenPicker(picker);
  }

  useEffect(() => {
    if (!openPicker) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!editorRef.current?.contains(event.target as Node)) setOpenPicker(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpenPicker(null); }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openPicker]);

  return (
    <div ref={editorRef} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-[0.75rem] font-semibold text-black/85">Identidade visual</span>
        <div className="flex items-center gap-3" aria-label="Tipo de identidade visual">
          {([
            { key: "icone" as const, label: "Ícone" },
            { key: "logo" as const, label: "Logotipo" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={logoMode ? key === "logo" : key === "icone"}
              onClick={() => { setOpenPicker(null); onTypeChange(key); }}
              className={`rounded-sm py-1 text-[0.6875rem] font-semibold underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
                (logoMode ? key === "logo" : key === "icone")
                  ? "text-[#6149A7] underline"
                  : "text-black/40 hover:text-black/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 items-stretch gap-3 py-3 sm:gap-5">
        <div className="flex w-[38%] min-w-0 shrink-0 items-center gap-2.5 border-r border-black/[.09] pr-3 sm:w-auto sm:max-w-[42%] sm:pr-5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border ${logoMode ? "border-black/[.12]" : "border-current"}`}
            style={logoMode ? undefined : { color }}
          >
            <ProjectIdentity
              nome={name}
              tipo={type}
              valor={value}
              logoUrl={logoUrl}
              cor={color}
              size="md"
              iconOptions={iconOptions}
            />
          </div>
          <span className="min-w-0 truncate text-[0.75rem] font-semibold text-black/85">{name}</span>
        </div>

        {logoMode ? (
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onLogoRequest}
              className="inline-flex min-h-9 items-center gap-2 rounded-sm text-[0.6875rem] font-semibold text-[#6149A7] underline underline-offset-4 transition-colors hover:text-[#493581] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              <ImagePlus size={16} strokeWidth={1.7} aria-hidden="true" />
              {logoUrl ? "Trocar logotipo" : "Escolher logotipo"}
            </button>
            <p className="text-[0.625rem] leading-relaxed text-black/40">{logoHelp}</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Escolher símbolo"
                aria-expanded={openPicker === "icon"}
                aria-controls={`${id}-icons`}
                onClick={(event) => togglePicker("icon", event.currentTarget)}
                className="flex h-[2.375rem] min-w-[9.0625rem] items-center gap-2 rounded-[5px] border border-black/[.13] bg-white px-2.5 text-[0.6875rem] font-semibold text-black/85 transition-colors hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              >
                <span className="hidden font-medium text-black/45 min-[520px]:inline">Símbolo</span>
                <SelectedIcon size={16} strokeWidth={1.7} className="shrink-0 text-[#252329]" aria-hidden="true" />
                <span>{selectedIcon?.label ?? "Padrão"}</span>
                <ChevronDown size={13} className="ml-auto text-black/45" aria-hidden="true" />
              </button>
              {openPicker === "icon" && (
                <div id={`${id}-icons`} role="group" aria-label="Símbolos" className={`absolute left-0 z-30 grid w-[12.25rem] grid-cols-4 gap-1.5 rounded-[7px] bg-white p-2.5 ${openAbove ? "bottom-[calc(100%+5px)]" : "top-[calc(100%+5px)]"} border elevacao-1`}>
                  {iconOptions.map(({ key, label, Icon }) => (
                    <button
                      type="button"
                      key={key}
                      title={label}
                      aria-label={label}
                      aria-pressed={value === key}
                      onClick={() => { onValueChange(key); setOpenPicker(null); }}
                      className={`flex h-[2.375rem] w-[2.375rem] items-center justify-center rounded-[5px] border bg-white text-[#252329] transition-colors hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${value === key ? "border-black/70" : "border-transparent"}`}
                    >
                      <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                aria-label="Escolher cor"
                aria-expanded={openPicker === "color"}
                aria-controls={`${id}-colors`}
                onClick={(event) => togglePicker("color", event.currentTarget)}
                className="flex h-[2.375rem] min-w-[6.5625rem] items-center gap-2 rounded-[5px] border border-black/[.13] bg-white px-2.5 text-[0.6875rem] font-semibold text-black/85 transition-colors hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              >
                <span className="hidden font-medium text-black/45 min-[520px]:inline">Cor</span>
                <span className="h-[0.875rem] w-[0.875rem] shrink-0 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
                <span>{selectedColor?.label ?? "Personalizada"}</span>
                <ChevronDown size={13} className="ml-auto text-black/45" aria-hidden="true" />
              </button>
              {openPicker === "color" && (
                <div id={`${id}-colors`} role="group" aria-label="Cores" className={`absolute left-0 z-30 grid w-[9.625rem] grid-cols-4 justify-items-center gap-2.5 rounded-[7px] bg-white p-2.5 ${openAbove ? "bottom-[calc(100%+5px)]" : "top-[calc(100%+5px)]"} border elevacao-1`}>
                  {colors.map(({ key, label, cor }) => (
                    <button
                      type="button"
                      key={key}
                      title={label}
                      aria-label={label}
                      aria-pressed={color.toLowerCase() === cor.toLowerCase()}
                      onClick={() => { onColorChange(cor); setOpenPicker(null); }}
                      className={`h-[1.4375rem] w-[1.4375rem] rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-black ${color.toLowerCase() === cor.toLowerCase() ? "outline-2 outline-offset-[3px] outline-black/80" : "hover:scale-110"}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
