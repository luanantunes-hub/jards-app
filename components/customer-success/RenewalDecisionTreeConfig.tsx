"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus, Save, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { DEFAULT_RENEWAL_DECISION_TREE, OUTCOME_LABELS, cloneDecisionTree, type RenewalDecisionNode, type RenewalDecisionOutcome } from "@/lib/customer-success/renewalDecisionTree";

export function RenewalDecisionTreeConfig({ organizationId }: { organizationId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tree, setTree] = useState<RenewalDecisionNode[]>(cloneDecisionTree(DEFAULT_RENEWAL_DECISION_TREE));
  const [draft, setDraft] = useState<RenewalDecisionNode[]>(cloneDecisionTree(DEFAULT_RENEWAL_DECISION_TREE));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("renovacao_arvores_decisao").select("nos").eq("organization_id", organizationId).maybeSingle();
      if (Array.isArray(data?.nos) && data.nos.length) setTree(data.nos as RenewalDecisionNode[]);
    })();
  }, [organizationId, supabase]);

  function beginEdit() { setDraft(cloneDecisionTree(tree)); setError(null); setOpen(true); }
  function updateNode(nodeId: string, patch: Partial<RenewalDecisionNode>) { setDraft(current => current.map(node => node.id === nodeId ? { ...node, ...patch } : node)); }
  function updateOption(nodeId: string, optionId: string, patch: Record<string, string | undefined>) {
    setDraft(current => current.map(node => node.id === nodeId ? { ...node, options: node.options.map(option => option.id === optionId ? { ...option, ...patch } : option) } : node));
  }
  function setDestination(nodeId: string, optionId: string, value: string) {
    if (value.startsWith("node:")) updateOption(nodeId, optionId, { nextNodeId: value.slice(5), outcome: undefined });
    else updateOption(nodeId, optionId, { nextNodeId: undefined, outcome: value.slice(8) });
  }
  function move(index: number, direction: -1 | 1) { setDraft(current => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function removeNode(nodeId: string) {
    setDraft(current => current.filter(node => node.id !== nodeId).map(node => ({ ...node, options: node.options.map(option => option.nextNodeId === nodeId ? { ...option, nextNodeId: undefined, outcome: "aguardando_cliente" as const } : option) })));
  }
  function addNode() {
    const id = `etapa_${Date.now()}`;
    setDraft(current => [...current, { id, title: "Nova pergunta", options: [{ id: `resposta_${Date.now()}`, label: "Resposta", outcome: "aguardando_cliente" }] }]);
  }

  async function save() {
    if (!draft.length || draft.some(node => !node.title.trim() || !node.options.length || node.options.some(option => !option.label.trim() || (!option.nextNodeId && !option.outcome)))) {
      setError("Preencha todas as perguntas, respostas e destinos."); return;
    }
    setSaving(true); setError(null);
    const { error: saveError } = await (supabase as any).from("renovacao_arvores_decisao").upsert({ organization_id: organizationId, nome: "Renovação de parceria", nos: draft, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setTree(cloneDecisionTree(draft)); setOpen(false);
  }

  const outcomes = new Set(tree.flatMap(node => node.options.map(option => option.outcome).filter(Boolean))).size;
  return <>
    <div className="overflow-hidden rounded border border-black/[.07] bg-white">
      <div className="flex items-center gap-3 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded border border-black/20 bg-transparent text-black/55"><GitBranch size={15}/></span><div className="min-w-0 flex-1"><p className="text-[0.8125rem] font-semibold text-black/70">Árvore de renovação</p><p className="mt-0.5 text-[0.6875rem] text-black/35">{tree.length} etapas · {outcomes} diagnósticos configurados</p></div><button type="button" onClick={beginEdit} className="rounded border border-black/[.1] bg-white px-3 py-2 text-[0.6875rem] font-semibold text-black/55 hover:bg-black/[.04]">Editar árvore</button></div>
    </div>

    {open && <div className="fixed inset-0 z-[1200] bg-black/35" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}><aside role="dialog" aria-modal="true" aria-labelledby="tree-config-title" className="ml-auto flex h-full w-full max-w-[45rem] flex-col border-l border-black/[.08] bg-white shadow-[-20px_0_60px_rgba(13,13,13,.12)]">
      <header className="flex items-center justify-between border-b border-black/[.07] px-5 py-4"><div><p className="text-[0.625rem] font-medium text-black/30">Processo comercial</p><h2 id="tree-config-title" className="mt-0.5 text-[0.9375rem] font-semibold text-black/80">Editar árvore de renovação</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded text-black/30 hover:bg-black/[.04]"><X size={15}/></button></header>
      <div className="flex-1 space-y-3 overflow-y-auto p-5">{draft.map((node, index) => {
        const destinationOptions = [
          ...draft.filter(item => item.id !== node.id).map(item => ({ value: `node:${item.id}`, label: `Ir para: ${item.title}` })),
          ...(Object.entries(OUTCOME_LABELS) as Array<[RenewalDecisionOutcome, string]>).map(([value, label]) => ({ value: `outcome:${value}`, label: `Diagnóstico: ${label}` })),
        ];
        return <section key={node.id} className="rounded border border-black/[.08] bg-white p-4"><div className="flex items-start gap-2"><span className="mt-2 text-[0.625rem] font-semibold tabular-nums text-black/25">{String(index + 1).padStart(2,"0")}</span><input value={node.title} onChange={event => updateNode(node.id, { title: event.target.value })} className="h-9 min-w-0 flex-1 rounded border border-black/[.1] px-3 text-[0.75rem] font-semibold text-black/70 outline-none focus:border-black/25"/><div className="flex"><button type="button" onClick={() => move(index,-1)} disabled={index===0} className="flex h-8 w-8 items-center justify-center rounded text-black/25 hover:bg-black/[.04] disabled:opacity-20"><ArrowUp size={12}/></button><button type="button" onClick={() => move(index,1)} disabled={index===draft.length-1} className="flex h-8 w-8 items-center justify-center rounded text-black/25 hover:bg-black/[.04] disabled:opacity-20"><ArrowDown size={12}/></button><button type="button" onClick={() => removeNode(node.id)} disabled={draft.length===1} className="flex h-8 w-8 items-center justify-center rounded text-black/25 hover:bg-black/[.04] hover:text-[#D94E4E] disabled:opacity-20"><Trash2 size={12}/></button></div></div>
          <div className="mt-3 space-y-2 pl-6">{node.options.map(option => { const destination = option.nextNodeId ? `node:${option.nextNodeId}` : `outcome:${option.outcome}`; return <div key={option.id} className="grid gap-2 sm:grid-cols-[minmax(7.5rem,.7fr)_minmax(13.75rem,1.3fr)_2rem]"><input value={option.label} onChange={event => updateOption(node.id, option.id, { label: event.target.value })} className="h-9 rounded border border-black/[.1] px-3 text-[0.6875rem] text-black/60 outline-none focus:border-black/25"/><CustomDropdown value={destination} onChange={value => setDestination(node.id, option.id, value)} options={destinationOptions} compact portalZIndex={1300} className="w-full [&>button]:h-9 [&>button]:w-full"/><button type="button" onClick={() => updateNode(node.id,{ options: node.options.filter(item => item.id !== option.id) })} disabled={node.options.length===1} className="flex h-9 w-8 items-center justify-center rounded text-black/20 hover:bg-black/[.04] hover:text-[#D94E4E] disabled:opacity-20"><X size={12}/></button></div>})}<button type="button" onClick={() => updateNode(node.id,{ options: [...node.options,{ id:`resposta_${Date.now()}`,label:"Nova resposta",outcome:"aguardando_cliente" }] })} className="inline-flex items-center gap-1.5 py-1 text-[0.6875rem] font-medium text-black/35 hover:text-black/55"><Plus size={11}/>Adicionar resposta</button></div>
        </section>;
      })}<button type="button" onClick={addNode} className="flex h-11 w-full items-center justify-center gap-2 rounded border border-dashed border-black/[.14] text-[0.6875rem] font-medium text-black/35 hover:bg-black/[.02] hover:text-black/55"><Plus size={12}/>Adicionar etapa</button>{error && <p className="text-[0.6875rem] text-[#D94E4E]">{error}</p>}</div>
      <footer className="flex justify-end gap-3 border-t border-black/[.07] px-5 py-4"><button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40"><Save size={12}/>{saving?"Salvando…":"Salvar"}</button></footer>
    </aside></div>}
  </>;
}
