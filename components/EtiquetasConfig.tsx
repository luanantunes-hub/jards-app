"use client";
import { useRef, useState } from "react";
import { Plus, Trash2, GripVertical, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useEtiquetas, type Etiqueta } from "@/contexts/EtiquetasContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePortalPosition, PortalMenu, type PortalPosition } from "@/components/ui/ComboboxPortalMenu";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// 30 ícones curados
const ICONES_DISPONIVEIS: string[] = [
  "Eye", "Phone", "Send", "MessageSquare", "Check", "X", "RotateCcw",
  "Star", "Heart", "Zap", "Flag", "Clock", "Search", "Mail",
  "Calendar", "UserCheck", "ThumbsUp", "Target", "TrendingUp",
  "Briefcase", "FileText", "Award", "Handshake", "Megaphone",
  "AlertCircle", "Ban", "Pause", "Play", "RefreshCw",
];

const CORES_SUGERIDAS = [
  "#888888", "#7259B5", "#2D72B0", "#B07A14",
  "#2E8932", "#D94E4E", "#1A8B7A", "#C2410C",
  "#0369A1", "#7C3AED", "#BE185D", "#0D9488",
];

function IconePickerPopup({ current, position, onSelect, onClose }: {
  current: string;
  position: PortalPosition | null;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <PortalMenu position={position} width={220}>
        <div className="grid grid-cols-6 gap-1.5 p-3">
          {ICONES_DISPONIVEIS.map(name => {
            const Icon = (Icons as any)[name] as LucideIcon | undefined;
            if (!Icon) return null;
            const isActive = name === current;
            return (
              <button key={name} onClick={() => { onSelect(name); onClose(); }}
                className="w-8 h-8 flex items-center justify-center rounded transition"
                style={isActive
                  ? { background: "rgba(114,89,181,.12)", color: "#7259B5" }
                  : { color: "rgba(13,13,13,.45)" }}
                title={name}>
                <Icon size={14} strokeWidth={2} />
              </button>
            );
          })}
        </div>
      </PortalMenu>
    </>
  );
}

function EtiquetaRow({ etiqueta, onUpdate, onDelete }: {
  etiqueta: Etiqueta;
  onUpdate: (id: string, patch: Partial<Etiqueta>) => void;
  onDelete: (id: string) => void;
}) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showCorPicker, setShowCorPicker] = useState(false);
  const [label, setLabel] = useState(etiqueta.label);
  const iconBoxRef = useRef<HTMLDivElement>(null);
  const iconMenuPos = usePortalPosition(iconBoxRef, showIconPicker);
  const corBoxRef = useRef<HTMLDivElement>(null);
  const corMenuPos = usePortalPosition(corBoxRef, showCorPicker);

  const Icon = (Icons as any)[etiqueta.icone] as LucideIcon | undefined;

  function commitLabel() {
    if (label.trim() && label !== etiqueta.label) onUpdate(etiqueta.id, { label: label.trim() });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group border-b last:border-b-0"
      style={{ borderColor: "rgba(13,13,13,.06)" }}>

      {/* Drag handle */}
      <GripVertical size={14} className="text-black/20 group-hover:text-black/40 transition flex-shrink-0 cursor-grab" />

      {/* Cor */}
      <div className="relative flex-shrink-0" ref={corBoxRef}>
        <button
          onClick={() => setShowCorPicker(v => !v)}
          className="w-6 h-6 rounded flex-shrink-0 border-2 border-white shadow-sm transition hover:scale-110"
          style={{ background: etiqueta.cor }}
        />
        {showCorPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowCorPicker(false)} />
            <PortalMenu position={corMenuPos} width={160}>
              <div className="p-2.5">
              <div className="grid grid-cols-4 gap-1.5">
                {CORES_SUGERIDAS.map(cor => (
                  <button key={cor} onClick={() => { onUpdate(etiqueta.id, { cor }); setShowCorPicker(false); }}
                    className="w-8 h-8 rounded transition hover:scale-110 flex items-center justify-center"
                    style={{ background: cor }}>
                    {cor === etiqueta.cor && <Check size={12} color="white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-black/30 mt-2 text-center">Cor personalizada</p>
              <input type="color" value={etiqueta.cor}
                onChange={e => onUpdate(etiqueta.id, { cor: e.target.value })}
                className="w-full h-6 mt-1 rounded cursor-pointer border-0 bg-transparent" />
              </div>
            </PortalMenu>
          </>
        )}
      </div>

      {/* Ícone */}
      <div className="relative flex-shrink-0" ref={iconBoxRef}>
        <button onClick={() => setShowIconPicker(v => !v)}
          className="w-7 h-7 rounded flex items-center justify-center transition"
          style={{ background: `${etiqueta.cor}18`, color: etiqueta.cor }}>
          {Icon ? <Icon size={14} strokeWidth={2.5} /> : <span className="text-[10px]">?</span>}
        </button>
        {showIconPicker && (
          <IconePickerPopup current={etiqueta.icone}
            position={iconMenuPos}
            onSelect={name => onUpdate(etiqueta.id, { icone: name })}
            onClose={() => setShowIconPicker(false)} />
        )}
      </div>

      {/* Label */}
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
        className="flex-1 text-[13px] font-semibold text-black bg-transparent outline-none border-b border-transparent focus:border-black/20 transition py-0.5"
        placeholder="Nome da etiqueta"
      />

      {/* Preview */}
      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold text-white flex-shrink-0"
        style={{ background: etiqueta.cor }}>
        {Icon && <Icon size={9} strokeWidth={2.5} />}
        {etiqueta.label}
      </span>

      {/* Delete */}
      {etiqueta.deletavel ? (
        <button onClick={() => onDelete(etiqueta.id)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-black/20 hover:text-red-500 transition flex-shrink-0">
          <Trash2 size={13} />
        </button>
      ) : (
        <div className="w-7 flex-shrink-0" title="Etiqueta obrigatória">
          <span className="text-[9px] text-black/20 opacity-0 group-hover:opacity-100">fixo</span>
        </div>
      )}
    </div>
  );
}

export function EtiquetasConfig({ entidade = "captacao" }: { entidade?: "captacao" | "inscricao" | "proponente" }) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { etiquetas: etiquetasCaptacao, etiquetasInscricao, etiquetasProponente, recarregar } = useEtiquetas();
  const { confirmDelete } = useDeleteConfirm();
  const etiquetas = entidade === "inscricao" ? etiquetasInscricao : entidade === "proponente" ? etiquetasProponente : etiquetasCaptacao;
  const [criando, setCriando] = useState(false);
  const [novaLabel, setNovaLabel] = useState("");

  async function handleUpdate(id: string, patch: Partial<Etiqueta>) {
    if (!organizationId) return;
    const isVirtualDefault = id.startsWith("default-inscricao-") || id.startsWith("default-proponente-");
    if (isVirtualDefault) {
      const padrao = etiquetas.find((item) => item.id === id);
      if (!padrao) return;
      const { data: existente } = await (supabase as any)
        .from("etiquetas")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("entidade", entidade)
        .eq("key", padrao.key)
        .maybeSingle();
      if (existente?.id) {
        await (supabase as any).from("etiquetas").update(patch).eq("id", existente.id);
      } else {
        await (supabase as any).from("etiquetas").insert({
          organization_id: organizationId,
          entidade,
          key: padrao.key,
          label: padrao.label,
          cor: padrao.cor,
          icone: padrao.icone,
          ordem: padrao.ordem,
          deletavel: false,
          ...patch,
        });
      }
    } else {
      await (supabase as any).from("etiquetas").update(patch).eq("id", id);
    }
    recarregar();
  }

  async function handleDelete(id: string) {
    const etiqueta = etiquetas.find(item => item.id === id);
    if (!etiqueta) return;
    confirmDelete({
      title: `Excluir a etiqueta “${etiqueta.label}”?`,
      description: entidade === "proponente" ? "Os proponentes que usam essa etiqueta ficarão sem tipo." : "Os registros que usam esta etiqueta poderão ficar sem classificação.",
      onConfirm: async () => {
        if (entidade === "proponente" && organizationId) {
          await (supabase as any).from("proponentes").update({ tipo: null }).eq("organization_id", organizationId).eq("tipo", etiqueta.key);
        }
        await (supabase as any).from("etiquetas").delete().eq("id", id);
        await recarregar();
      },
    });
  }

  async function handleCriar() {
    if (!novaLabel.trim() || !organizationId) return;
    setCriando(true);
    const maxOrdem = etiquetas.length > 0 ? Math.max(...etiquetas.map(e => e.ordem)) + 1 : 1;
    await (supabase as any).from("etiquetas").insert({
      organization_id: organizationId,
      entidade,
      key: `custom_${Date.now()}`,
      label: novaLabel.trim(),
      cor: "#7259B5",
      icone: "Star",
      ordem: maxOrdem,
      deletavel: true,
    });
    setNovaLabel("");
    setCriando(false);
    recarregar();
  }

  return (
    <div>
      <div className="bg-white border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {etiquetas.map(e => (
          <EtiquetaRow key={e.id} etiqueta={e} onUpdate={handleUpdate} onDelete={handleDelete} />
        ))}

        {/* Nova etiqueta */}
        {(entidade === "captacao" || entidade === "proponente") && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <Plus size={13} className="text-black/30 flex-shrink-0" />
          <input
            value={novaLabel}
            onChange={e => setNovaLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCriar(); }}
            placeholder="Nova etiqueta…"
            className="flex-1 text-[13px] text-black bg-transparent outline-none placeholder:text-black/25"
          />
          {novaLabel.trim() && (
            <button onClick={handleCriar} disabled={criando}
              className="px-3 py-1 text-[11px] font-bold text-[#7259B5] hover:bg-[#7259B5]/8 rounded transition disabled:opacity-40">
              {criando ? "Criando…" : "Criar"}
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
