"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- migração experimental ainda não consta nos tipos gerados */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

export type OpportunityLabel = { id: string; nome: string; tipo_fluxo: "negociacoes" | "inscricoes"; ordem: number };

export function useOpportunityLabels(organizationId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [labels, setLabels] = useState<OpportunityLabel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!organizationId) { setLabels([]); return; }
    const result = await (supabase as any).from("captador_oportunidade_etiquetas")
      .select("id,nome,tipo_fluxo,ordem").eq("organization_id", organizationId).order("ordem").order("nome");
    setLabels((result.data ?? []) as OpportunityLabel[]);
    setError(result.error?.code === "PGRST205" ? "Os tipos de oportunidade aguardam a atualização do banco." : result.error?.message ?? null);
  }, [organizationId, supabase]);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);
  return { labels, error, reload, supabase };
}

export function OpportunityLabelsConfig() {
  const organizationId = useOrganizationId();
  const { labels, error, reload, supabase } = useOpportunityLabels(organizationId);
  const { confirmDelete } = useDeleteConfirm();
  const [draft, setDraft] = useState("");
  const [draftFlow, setDraftFlow] = useState<OpportunityLabel["tipo_fluxo"]>("negociacoes");
  const [newName, setNewName] = useState("");
  const [newFlow, setNewFlow] = useState<OpportunityLabel["tipo_fluxo"]>("negociacoes");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function saveName(label: OpportunityLabel) {
    if (saving) return;
    const nome = draft.trim();
    if (nome.length < 2) { setActionError("Informe ao menos dois caracteres."); return; }
    if (nome === label.nome && draftFlow === label.tipo_fluxo) { setEditing(null); return; }
    setSaving(true);
    const { error: updateError } = await (supabase as any).from("captador_oportunidade_etiquetas")
      .update({ nome, tipo_fluxo: draftFlow }).eq("id", label.id).eq("organization_id", organizationId);
    setSaving(false);
    setActionError(updateError?.code === "23505" ? "Essa etiqueta já existe." : updateError?.message ?? null);
    if (!updateError) setEditing(null);
    await reload();
  }

  async function create() {
    const nome = newName.trim();
    if (!organizationId || nome.length < 2 || saving) return;
    setSaving(true);
    const { error: insertError } = await (supabase as any).from("captador_oportunidade_etiquetas")
      .insert({ organization_id: organizationId, nome, tipo_fluxo: newFlow, ordem: Math.max(0, ...labels.map(label => label.ordem)) + 1 });
    setSaving(false);
    setActionError(insertError?.code === "23505" ? "Essa etiqueta já existe." : insertError?.message ?? null);
    if (!insertError) setNewName("");
    await reload();
  }

  function remove(label: OpportunityLabel) {
    confirmDelete({
      title: `Excluir “${label.nome}”?`,
      description: "Os pedidos antigos permanecem, mas deixam de exibir esta etiqueta.",
      onConfirm: async () => {
        const { error: deleteError } = await (supabase as any).from("captador_oportunidade_etiquetas")
          .delete().eq("id", label.id).eq("organization_id", organizationId);
        setActionError(deleteError?.message ?? null);
        await reload();
      },
    });
  }

  return <section aria-label="Etiquetas de oportunidades" className="max-w-2xl">
    <div className="divide-y divide-black/[.07] border-y border-black/[.09]">
      {labels.map(label => <div key={label.id} className="group py-2">
        <div className="flex min-h-9 items-center gap-3">
          {editing === label.id ? <input autoFocus value={draft} maxLength={80} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void saveName(label); if (e.key === "Escape") setEditing(null); }} className="min-w-0 flex-1 border-b border-[#5F4AA8] bg-transparent py-1 text-[0.8125rem] text-[#282525] outline-none" aria-label={`Nome do tipo ${label.nome}`} />
            : <button type="button" onClick={() => { setDraft(label.nome); setDraftFlow(label.tipo_fluxo); setEditing(label.id); }} className="min-w-0 flex-1 truncate py-1 text-left text-[0.8125rem] text-black/75 transition hover:text-[#5F4AA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8]" title="Editar tipo">{label.nome}</button>}
          <span className="text-[0.6875rem] text-black/40">{label.tipo_fluxo === "inscricoes" ? "Edital" : "Negociação"}</span>
          <button type="button" onClick={() => remove(label)} aria-label={`Excluir ${label.nome}`} className="rounded p-1.5 text-black/35 transition hover:text-[#B64545] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8]"><Trash2 size={14} /></button>
        </div>
        {editing === label.id && <div className="mt-2 flex flex-wrap items-center gap-2">
          {(["negociacoes", "inscricoes"] as const).map(flow => <button key={flow} type="button" onClick={() => setDraftFlow(flow)} aria-pressed={draftFlow === flow} className={`rounded border px-2.5 py-1 text-[0.6875rem] ${draftFlow === flow ? "border-[#282525] bg-[#282525] text-white" : "border-black/[.14] text-black/55"}`}>{flow === "inscricoes" ? "Edital" : "Negociação"}</button>)}
          <button type="button" onClick={() => void saveName(label)} disabled={saving} className="ml-auto text-[0.6875rem] font-semibold text-[#5F4AA8] disabled:opacity-40">Salvar</button>
          <button type="button" onClick={() => setEditing(null)} className="text-[0.6875rem] text-black/45">Cancelar</button>
        </div>}
      </div>)}
      {labels.length === 0 && !error && <p className="py-3 text-[0.75rem] text-black/45">Nenhuma etiqueta. Adicione a primeira abaixo.</p>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      <label htmlFor="novo-tipo-oportunidade" className="sr-only">Novo tipo de oportunidade</label>
      <input id="novo-tipo-oportunidade" value={newName} maxLength={80} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") void create(); }} placeholder="Novo tipo de oportunidade" className="h-9 min-w-44 flex-1 rounded border border-black/[.14] px-3 text-[0.75rem] outline-none focus:border-[#5F4AA8]" />
      {(["negociacoes", "inscricoes"] as const).map(flow => <button key={flow} type="button" onClick={() => setNewFlow(flow)} aria-pressed={newFlow === flow} className={`rounded border px-2.5 py-1 text-[0.6875rem] ${newFlow === flow ? "border-[#282525] bg-[#282525] text-white" : "border-black/[.14] text-black/55"}`}>{flow === "inscricoes" ? "Edital" : "Negociação"}</button>)}
      <button type="button" onClick={() => void create()} disabled={saving || newName.trim().length < 2} className="inline-flex items-center gap-1 rounded border border-black/[.14] px-3 text-[0.75rem] font-semibold text-black/70 transition hover:border-[#5F4AA8] hover:text-[#5F4AA8] disabled:opacity-40"><Plus size={13} />Adicionar</button>
    </div>
    {(error || actionError) && <p role="alert" className="mt-2 text-[0.6875rem] text-[#B64545]">{actionError || error}</p>}
  </section>;
}
