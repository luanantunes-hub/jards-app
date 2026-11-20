"use client";
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { ProjectIdentity, type IdentityIconOption, type IdentityType } from "./ProjectIdentity";
import { IconePicker } from "./IconePicker";

type IdentityPickerPopupProps = {
  nome: string;
  tipo: IdentityType;
  valor: string | null;
  logoUrl: string | null;
  cor: string | null;
  iconOptions: readonly IdentityIconOption[];
  saving: boolean;
  title: string;
  onSave: (tipo: IdentityType, valor: string | null, logoUrl?: string | null, cor?: string | null) => void;
  onLogoFile: (file?: File) => void;
  triggerLabel: string;
};

/** Identidade no cabeçalho das páginas de detalhe: clica no ícone e escolhe ali mesmo. */
export function IdentityPickerPopup({
  nome, tipo, valor, logoUrl, cor, iconOptions, saving, title, onSave, onLogoFile, triggerLabel,
}: IdentityPickerPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fecharFora = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    const fecharEsc = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) { setOpen(false); gatilhoRef.current?.focus(); } };
    window.addEventListener("mousedown", fecharFora);
    window.addEventListener("keydown", fecharEsc);
    return () => { window.removeEventListener("mousedown", fecharFora); window.removeEventListener("keydown", fecharEsc); };
  }, [open]);

  return (
    <div ref={containerRef} className="relative mt-0.5">
      <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => { onLogoFile(event.target.files?.[0]); event.target.value = ""; setOpen(false); }} />
      <button
        ref={gatilhoRef}
        type="button"
        onClick={() => setOpen(atual => !atual)}
        aria-label={triggerLabel}
        aria-expanded={open}
        className={`group relative rounded outline-none transition-colors hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${open ? "bg-black/[.05]" : ""}`}
      >
        <ProjectIdentity nome={nome} tipo={tipo} valor={valor} logoUrl={logoUrl} cor={cor} size="md" iconOptions={iconOptions} />
        <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded bg-white text-black/45 opacity-0 shadow-[0_1px_3px_rgba(13,13,13,.18)] transition group-hover:opacity-100 group-focus-visible:opacity-100 ${open ? "opacity-100" : ""}`} aria-hidden><Pencil size={8} /></span>
      </button>
      {open && (
        <div role="dialog" aria-label={title} className="absolute left-0 top-12 z-30 rounded bg-white p-3 animate-[aparecer_.14s_ease-out] motion-reduce:animate-none" style={{ boxShadow: "var(--elevacao-sombra-2)" }}>
          <IconePicker
            tipo={tipo}
            valor={valor}
            cor={cor}
            iconOptions={iconOptions}
            saving={saving}
            temLogo={tipo === "logo" && !!logoUrl}
            onEscolher={(icone, novaCor) => { onSave("icone", icone, null, novaCor); setOpen(false); gatilhoRef.current?.focus(); }}
            onRemover={() => { onSave("padrao", null); setOpen(false); }}
            onLogo={() => logoInputRef.current?.click()}
          />
        </div>
      )}
    </div>
  );
}
