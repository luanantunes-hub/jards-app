"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type Followup = {
  id: string;
  titulo: string;
  status: "pendente" | "concluido" | "cancelado";
  previstoPara: string | null;
  sourceLink?: string;
};

export function GerenciarFollowupModal({ followup, onClose, onChanged }: {
  followup: Followup;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(() => { if (!saving) onClose(); });

  async function complete() {
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await (createClient() as any)
      .from("crm_followups")
      .update({ status: "concluido", concluido_em: new Date().toISOString() })
      .eq("id", followup.id)
      .eq("status", "pendente")
      .select("id, status")
      .single();
    setSaving(false);
    if (updateError || data?.status !== "concluido") {
      setError(updateError?.message ?? "Não foi possível concluir este follow-up. Atualize a lista e tente novamente.");
      return;
    }
    onChanged();
  }

  function remove() {
    confirmDelete({
      title: `Excluir o follow-up “${followup.titulo}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setSaving(true);
        setError(null);
        try {
          await excluirPorId(createClient(), "crm_followups", followup.id);
        } finally {
          setSaving(false);
        }
        onChanged();
      },
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" onClick={() => { if (!saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-black/[.08] px-6 py-4">
          <div>
            <p id={titleId} className="text-[0.875rem] font-bold text-black">{followup.status === "pendente" ? "Gerenciar follow-up" : "Follow-up"}</p>
            <p className="mt-1 text-[0.75rem] text-black/55">{followup.titulo}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar" className="text-black/35 hover:text-black/60 disabled:opacity-40"><X size={16} /></button>
        </header>
        <div className="space-y-4 px-6 py-5">
          <p className="text-[0.6875rem] text-black/45">
            {followup.status === "pendente" ? "Pendente" : followup.status === "concluido" ? "Concluído" : "Cancelado"}
            {followup.previstoPara ? ` · Prazo ${new Date(followup.previstoPara).toLocaleDateString("pt-BR")}` : ""}
          </p>
          {followup.sourceLink ? (
            <Link href={followup.sourceLink} className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#7259B5] hover:underline">
              Abrir vínculo <ExternalLink size={12} />
            </Link>
          ) : (
            <p className="rounded border border-[#B07A14]/25 bg-white px-3 py-2 text-[0.6875rem] text-black/55">
              O vínculo original não está disponível. Você ainda pode concluir ou excluir este follow-up aqui.
            </p>
          )}
          {error && <p role="alert" className="text-[0.6875rem] font-medium text-[#D94E4E]">{error}</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[.08] px-6 py-4">
          <button type="button" onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-[#D94E4E] hover:underline disabled:opacity-40"><Trash2 size={13} /> Excluir</button>
          {followup.status === "pendente" && (
            <button type="button" onClick={() => void complete()} disabled={saving} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed">
              <Check size={14} /> {saving ? "Salvando…" : "Concluir sem interação"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
