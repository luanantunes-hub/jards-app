"use client";

import { ImagePlus, Shapes } from "lucide-react";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import type { IdentityIconOption, IdentityType } from "@/components/ui/ProjectIdentity";

type IdentityColorOption = {
  key: string;
  label: string;
  cor: string;
};

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
  name,
  type,
  value,
  logoUrl,
  color,
  iconOptions,
  colors,
  onTypeChange,
  onValueChange,
  onColorChange,
  onLogoRequest,
  logoHelp,
}: IdentityEditorProps) {
  return (
    <div className="flex items-start gap-3 rounded border border-black/[.09] bg-white p-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-black/[.07] bg-black/[.015]">
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

      <div className="min-w-0 flex-1">
        <div className="inline-flex rounded border border-black/[.09] bg-white p-0.5">
          {([
            { key: "icone" as const, label: "Ícone", Icon: Shapes },
            { key: "logo" as const, label: "Logo", Icon: ImagePlus },
          ] as const).map(({ key, label, Icon }) => {
            const selected = type === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => onTypeChange(key)}
                className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-medium transition-colors ${
                  selected
                    ? "bg-black/[.055] text-black/75"
                    : "text-black/40 hover:bg-black/[.03] hover:text-black/60"
                }`}
              >
                <Icon size={11} strokeWidth={1.7} />
                {label}
              </button>
            );
          })}
        </div>

        {type === "icone" && (
          <>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {iconOptions.map(({ key, label, Icon }) => {
                const selected = value === key;
                return (
                  <button
                    type="button"
                    key={key}
                    title={label}
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => onValueChange(key)}
                    className={`flex h-8 w-8 items-center justify-center rounded border transition-colors ${
                      selected
                        ? "border-black/30 bg-black/[.045] text-black/70"
                        : "border-black/[.09] bg-white text-black/35 hover:border-black/20 hover:text-black/60"
                    }`}
                  >
                    <Icon size={13} strokeWidth={1.7} />
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {colors.map(({ key, label, cor }) => {
                const selected = color === cor;
                return (
                  <button
                    type="button"
                    key={key}
                    title={label}
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => onColorChange(cor)}
                    className={`h-6 w-6 rounded border transition-all ${
                      selected
                        ? "border-transparent ring-2 ring-black/30 ring-offset-2"
                        : "border-black/[.10] hover:scale-105 hover:border-black/30"
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                );
              })}
            </div>
          </>
        )}

        {type === "logo" && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={onLogoRequest}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-black/[.1] px-2.5 text-[10px] font-medium text-black/55 transition-colors hover:bg-black/[.03] hover:text-black/75"
            >
              <ImagePlus size={12} strokeWidth={1.7} />
              {logoUrl ? "Trocar logotipo" : "Enviar logotipo"}
            </button>
            <p className="mt-1 text-[9.5px] leading-relaxed text-black/35">{logoHelp}</p>
          </div>
        )}
      </div>
    </div>
  );
}
