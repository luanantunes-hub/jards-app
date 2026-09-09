"use client";
import { useState } from "react";
import { X, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  empresaCrmId: string;
  empresaNome: string;
  onClose: () => void;
  onSaved: () => void;
};

export function AbrirContaModal({ empresaCrmId, empresaNome, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgData } = await (supabase as any)
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("contas_patrocinio").insert({
      account_id: user.id,
      organization_id: orgData?.organization_id ?? null,
      empresa_crm_id: empresaCrmId,
      nome: nome.trim() || null,
      notas: notas.trim() || null,
      status: "ativa",
    });

    if (!error) {
      onSaved();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded shadow-2xl w-full max-w-md p-6"
        style={{ borderColor: "rgba(13,13,13,.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#7259B5]/10 flex items-center justify-center">
              <Building2 size={16} className="text-[#7259B5]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-[#0D0D0D]">Criar cliente</h2>
              <p className="text-[12px] text-black/40">{empresaNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 transition">
            <X size={16} className="text-black/40" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-black/40 uppercase tracking-wide block mb-1.5">Nome do cliente</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Patrocínio Anual 2026"
              className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 focus:border-[#7259B5] transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-black/40 uppercase tracking-wide block mb-1.5">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observações sobre o cliente..."
              rows={3}
              className="w-full px-3 py-2.5 text-[13px] border rounded resize-none focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-black/40 hover:text-black/60 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 text-[13px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Building2 size={13} />
            )}
            Criar cliente
          </button>
        </div>
      </div>
    </div>
  );
}
