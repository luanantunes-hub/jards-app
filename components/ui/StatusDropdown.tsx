"use client";
import { useState } from "react";
import { STATUS_BADGE } from "@/components/ui/StatusBadge";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Option = {
  status: string;
  label?: string;
  bg?: string;
  icon?: LucideIcon;
  iconName?: string; // nome string do ícone Lucide (para etiquetas do banco)
  custom?: boolean;
};

export type StatusDropdownCreateInput = { label: string; bg: string; iconName: string };

type Props = {
  options: string[] | Option[];
  current: string;
  position: { top: number; left: number };
  onSelect: (status: string) => void;
  onClose: () => void;
  title?: string;
  onCreate?: (input: StatusDropdownCreateInput) => Promise<string | null>;
  onDelete?: (status: string) => Promise<void>;
};

const CREATE_COLORS = ["#7259B5", "#2D72B0", "#1A8B7A", "#2E8932", "#B07A14", "#D94E4E", "#C2517F", "#5B7C99"];
const CREATE_ICONS = ["Landmark", "Trophy", "Clapperboard", "HeartHandshake", "Building2", "MapPin", "Leaf", "Tag"];

export function StatusDropdown({ options, current, position, onSelect, onClose, title = "Etiquetas", onCreate, onDelete }: Props) {
  const { confirmDelete } = useDeleteConfirm();
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(CREATE_COLORS[0]);
  const [newIcon, setNewIcon] = useState(CREATE_ICONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = options.map(o => {
    const key = typeof o === "string" ? o : o.status;
    const badge = STATUS_BADGE[key];
    const label    = (typeof o === "object" && o.label)    || badge?.label || key;
    const bg       = (typeof o === "object" && o.bg)       || badge?.bg    || "#888888";
    const iconName = (typeof o === "object" && o.iconName) || null;
    const Icon: LucideIcon | undefined =
      (typeof o === "object" && o.icon) ||
      (iconName ? (Icons as any)[iconName] : undefined) ||
      badge?.icon;
    return { status: key, label, bg, Icon, custom: typeof o === "object" && Boolean(o.custom) };
  });

  async function createOption() {
    if (!onCreate || !newLabel.trim() || saving) return;
    setSaving(true);
    setError(null);
    const status = await onCreate({ label: newLabel.trim(), bg: newColor, iconName: newIcon });
    setSaving(false);
    if (!status) { setError("Não foi possível adicionar a lei"); return; }
    onSelect(status);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 overflow-x-hidden overflow-y-auto rounded border bg-white shadow-xl"
        style={{
          top: Math.max(12, Math.min(position.top, window.innerHeight - 532)),
          left: position.left,
          borderColor: "rgba(13,13,13,.10)",
          minWidth: 280,
          maxWidth: 320,
          maxHeight: "calc(100vh - 24px)",
        }}
      >
        {/* Header */}
        <div className="px-3.5 py-2.5 flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
            <rect x="1" y="1" width="6" height="6" rx="1.2" fill="currentColor" />
            <rect x="9" y="1" width="6" height="6" rx="1.2" fill="currentColor" />
            <rect x="1" y="9" width="6" height="6" rx="1.2" fill="currentColor" />
            <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" />
          </svg>
          <span className="text-[11px] font-bold text-black/40 uppercase tracking-widest">{title}</span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(13,13,13,.07)" }} />

        {/* Grid 3 colunas */}
        <div className="p-3 grid grid-cols-3 gap-1.5">
          {resolved.map(({ status, label, bg, Icon, custom }) => {
            const isActive = status === current;
            return (
              <div key={status} className="relative">
                <button
                  type="button"
                  onClick={() => { onSelect(status); onClose(); }}
                  className="relative flex h-full min-h-[70px] w-full flex-col items-center justify-center gap-1.5 rounded px-1 py-2.5 text-white transition"
                  style={{ background: bg, opacity: isActive ? 1 : 0.58, outline: isActive ? `2px solid ${bg}` : "none", outlineOffset: isActive ? 2 : 0 }}
                >
                  {Icon && <Icon size={14} strokeWidth={2.5} />}
                  <span className="text-center text-[9px] font-bold uppercase leading-tight tracking-wide">{label}</span>
                  {isActive && <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded bg-white/30"><Icons.Check size={7} strokeWidth={3}/></span>}
                </button>
                {custom && onDelete && (
                  <button
                    type="button"
                    title={`Excluir ${label}`}
                    aria-label={`Excluir ${label}`}
                    onClick={event => { event.stopPropagation(); confirmDelete({ title: `Excluir a lei “${label}”?`, description: "Registros que já usam esta lei mantêm o valor salvo.", onConfirm: () => onDelete(status) }); }}
                    className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/15 text-white/75 transition hover:bg-black/30 hover:text-white"
                  >
                    <Icons.Trash2 size={9}/>
                  </button>
                )}
              </div>
            );
          })}
          {onCreate && !creating && (
            <button type="button" onClick={() => setCreating(true)} className="flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded border border-dashed border-black/20 bg-white px-1 py-2.5 text-black/35 transition hover:border-[#7259B5]/45 hover:bg-[#7259B5]/[.025] hover:text-[#7259B5]">
              <Icons.Plus size={15}/>
              <span className="text-[9px] font-bold uppercase tracking-wide">Adicionar</span>
            </button>
          )}
        </div>

        {creating && (
          <div className="border-t border-black/[.07] p-3">
            <input autoFocus value={newLabel} onChange={event => setNewLabel(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void createOption(); }} placeholder="Nome da lei" className="h-9 w-full rounded border border-black/10 bg-white px-3 text-[12px] outline-none placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10" />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <div className="flex gap-1">{CREATE_COLORS.map(color => <button key={color} type="button" title={color} onClick={() => setNewColor(color)} className="flex h-6 w-6 items-center justify-center rounded border" style={{ background: color, borderColor: newColor === color ? "#0D0D0D" : "transparent" }}>{newColor === color && <Icons.Check size={10} color="white"/>}</button>)}</div>
            </div>
            <div className="mt-2 flex gap-1">{CREATE_ICONS.map(iconName => { const Icon = (Icons as any)[iconName] as LucideIcon; return <button key={iconName} type="button" title={iconName} onClick={() => setNewIcon(iconName)} className={`flex h-7 w-7 items-center justify-center rounded border ${newIcon === iconName ? "border-[#7259B5]/45 bg-[#7259B5]/[.06] text-[#7259B5]" : "border-black/[.07] text-black/35 hover:bg-black/[.03]"}`}><Icon size={12}/></button>; })}</div>
            {error && <p className="mt-2 text-[10px] font-medium text-[#C84242]">{error}</p>}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setCreating(false); setError(null); }} className="h-8 px-2 text-[11px] font-medium text-black/35 hover:text-black/60">Cancelar</button>
              <button type="button" disabled={!newLabel.trim() || saving} onClick={() => void createOption()} className="h-8 rounded bg-[#2E8932] px-3 text-[11px] font-semibold text-white transition hover:bg-[#26752A] disabled:opacity-35">{saving ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
