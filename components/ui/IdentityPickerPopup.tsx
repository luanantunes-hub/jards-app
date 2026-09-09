"use client";
import { useEffect, useRef, useState } from "react";
import { FolderOpen, ImagePlus, Pencil } from "lucide-react";
import { ProjectIdentity, IDENTITY_COLORS, type IdentityIconOption, type IdentityType } from "./ProjectIdentity";

type IdentityPickerPopupProps = {
  nome: string;
  tipo: IdentityType;
  valor: string | null;
  logoUrl: string | null;
  cor: string | null;
  iconOptions: readonly IdentityIconOption[];
  iconColors?: readonly { key: string; label: string; cor: string }[];
  saving: boolean;
  title: string;
  onSave: (tipo: IdentityType, valor: string | null, logoUrl?: string | null, cor?: string | null) => void;
  onLogoFile: (file?: File) => void;
  triggerLabel: string;
};

export function IdentityPickerPopup({
  nome,
  tipo,
  valor,
  logoUrl,
  cor,
  iconColors = IDENTITY_COLORS,
  iconOptions,
  saving,
  title,
  onSave,
  onLogoFile,
  triggerLabel,
}: IdentityPickerPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-0.5">
      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { onLogoFile(event.target.files?.[0]); event.target.value = ""; }} />
      <button type="button" onClick={() => setOpen(open => !open)} aria-label={triggerLabel} aria-expanded={open} className="group relative rounded outline-none ring-[#7259B5]/25 focus-visible:ring-2">
        <ProjectIdentity nome={nome} tipo={tipo} valor={valor} logoUrl={logoUrl} cor={cor} size="md" iconOptions={iconOptions} />
        <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded border border-black/10 bg-white text-black/45 opacity-0 shadow-sm transition group-hover:opacity-100 group-hover:text-[#7259B5] group-focus-visible:opacity-100 ${open ? "opacity-100" : ""}`}><Pencil size={8} /></span>
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-[286px] rounded border border-black/[.09] bg-white p-3 shadow-[0_16px_45px_rgba(13,13,13,.12)]">
          <div className="px-1 pb-3"><p className="text-[13px] font-semibold text-black/70">{title}</p></div>
          <div className="grid grid-cols-4 gap-1.5">
            {iconOptions.map(({ key, label, Icon }) => {
              const active = tipo === "icone" && valor === key;
              return (
                <button key={key} type="button" title={label} disabled={saving} onClick={() => void onSave("icone", key, null, cor ?? iconColors[0].cor)} className={`flex h-12 items-center justify-center rounded border bg-white transition hover:bg-black/[.04] disabled:opacity-40 ${active ? "border-[#7259B5]/45 text-[#7259B5]" : "border-black/[.08] text-black/40"}`}>
                  <Icon size={17} />
                </button>
              );
            })}
            <button type="button" title="Identidade padrão" disabled={saving} onClick={() => void onSave("padrao", null)} className={`flex h-12 items-center justify-center rounded border bg-white transition hover:bg-black/[.04] disabled:opacity-40 ${tipo === "padrao" ? "border-[#7259B5]/45 text-[#7259B5]" : "border-black/[.08] text-black/40"}`}>
              <FolderOpen size={17} />
            </button>
          </div>
          {tipo === "icone" && (
            <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="px-1 pb-2 text-[10px] font-semibold text-black/40">Cor do ícone</p>
              <div className="grid grid-cols-8 gap-1.5">
                {iconColors.map(({ key, label, cor: corValue }) => {
                  const active = (cor ?? iconColors[0].cor) === corValue;
                  return (
                    <button key={key} type="button" title={label} disabled={saving} onClick={() => void onSave("icone", valor ?? iconOptions[0].key, null, corValue)} className={`flex h-7 items-center justify-center rounded border bg-white transition hover:scale-105 disabled:opacity-40 ${active ? "border-[#7259B5]/60 ring-1 ring-[#7259B5]/25" : "border-black/[.08]"}`}>
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: corValue }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <button type="button" disabled={saving} onClick={() => logoInputRef.current?.click()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded border border-[#7259B5]/25 bg-white text-[12px] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40">
            <ImagePlus size={14} />
            {saving ? "Salvando…" : tipo === "logo" ? "Trocar logo" : "Usar logo"}
          </button>
        </div>
      )}
    </div>
  );
}
