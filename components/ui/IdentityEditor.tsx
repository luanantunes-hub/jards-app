"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import type { IdentityIconOption, IdentityType } from "@/components/ui/ProjectIdentity";
import { IconePicker } from "@/components/ui/IconePicker";
import { escalaUi } from "@/lib/escala-ui";

type IdentityColorOption = { key: string; label: string; cor: string };

type IdentityEditorProps = {
  name: string;
  type: IdentityType;
  value: string;
  logoUrl?: string | null;
  color: string;
  iconOptions: readonly IdentityIconOption[];
  /** Mantido por compatibilidade: as cores agora vêm de PROJECT_ICON_COLORS, dentro do seletor. */
  colors?: readonly IdentityColorOption[];
  onTypeChange: (type: "icone" | "logo") => void;
  onValueChange: (value: string) => void;
  onColorChange: (color: string) => void;
  onLogoRequest: () => void;
  logoHelp: string;
};

/**
 * Identidade nos cadastros: o ícone atual é o botão; clicar abre o mesmo
 * seletor do cabeçalho (ícones em cinza, cada um nas cinco cores ao clicar).
 */
export function IdentityEditor({
  name, type, value, logoUrl, color, iconOptions,
  onTypeChange, onValueChange, onColorChange, onLogoRequest, logoHelp,
}: IdentityEditorProps) {
  const [aberto, setAberto] = useState(false);
  const [acima, setAcima] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const logoMode = type === "logo";
  const nomeIcone = iconOptions.find(option => option.key === value)?.label;

  function alternar() {
    if (aberto) { setAberto(false); return; }
    const gatilho = gatilhoRef.current;
    if (gatilho) {
      const area = gatilho.closest(".overflow-y-auto")?.getBoundingClientRect();
      const g = gatilho.getBoundingClientRect();
      const baixo = Math.min(area?.bottom ?? window.innerHeight, window.innerHeight);
      const topo = Math.max(area?.top ?? 0, 0);
      const altura = 300 * escalaUi();
      setAcima(baixo - g.bottom < altura && g.top - topo > altura);
    }
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    function fora(event: PointerEvent) { if (!editorRef.current?.contains(event.target as Node)) setAberto(false); }
    function esc(event: KeyboardEvent) { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); setAberto(false); gatilhoRef.current?.focus(); } }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  return (
    <div ref={editorRef} className="relative min-w-0">
      <span className="mb-2 block text-[0.75rem] font-semibold text-black/85">Identidade visual</span>
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={gatilhoRef}
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-controls={`${id}-seletor`}
          aria-label="Escolher ícone ou logo"
          className={`group relative flex h-12 w-12 shrink-0 items-center justify-center rounded transition-colors hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${aberto ? "bg-black/[.05]" : "bg-black/[.025]"}`}
        >
          <ProjectIdentity nome={name} tipo={type} valor={value} logoUrl={logoUrl} cor={color} size="md" iconOptions={iconOptions} />
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded bg-white text-black/45 shadow-[0_1px_3px_rgba(13,13,13,.18)]" aria-hidden><Pencil size={8} /></span>
        </button>
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-semibold text-black/85">{name}</p>
          <p className="truncate text-[0.6875rem] text-black/40">
            {logoMode ? (logoUrl ? "Logo próprio" : "Escolha um logo") : nomeIcone ? `Ícone: ${nomeIcone}` : "Clique no ícone para escolher"}
          </p>
        </div>
      </div>
      {logoMode && <p className="mt-2 text-[0.625rem] leading-relaxed text-black/40">{logoHelp}</p>}

      {aberto && (
        <div
          id={`${id}-seletor`}
          role="dialog"
          aria-label="Identidade visual"
          className={`absolute left-0 z-30 rounded bg-white p-3 animate-[aparecer_.14s_ease-out] motion-reduce:animate-none ${acima ? "bottom-full mb-2" : "top-full mt-2"}`}
          style={{ boxShadow: "var(--elevacao-sombra-2)" }}
        >
          <IconePicker
            tipo={type}
            valor={value || null}
            cor={color}
            iconOptions={iconOptions}
            temLogo={logoMode && !!logoUrl}
            onEscolher={(icone, cor) => { onTypeChange("icone"); onValueChange(icone); onColorChange(cor); setAberto(false); gatilhoRef.current?.focus(); }}
            onLogo={() => { onTypeChange("logo"); onLogoRequest(); setAberto(false); }}
          />
        </div>
      )}
    </div>
  );
}
