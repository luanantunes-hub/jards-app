"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Check, ChevronDown, ClipboardCheck, Gauge, Handshake, Pencil, Plus,
  RefreshCw, Trash2, Users, WalletCards, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SegmentedScoreArc } from "@/components/ui/SegmentedScoreArc";

type Criterion = {
  id: string; scorecard_id: string; nome: string; peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null; observacao: string | null; ordem: number; ativo: boolean;
};
type Scorecard = {
  id: string; nome: string; dimensao_base: string | null; peso: 1 | 2 | 3;
  cor: string; icone: string; ordem: number; ativo: boolean; criterios: Criterion[];
};

const ICONS = { Handshake, ClipboardCheck, Users, BarChart3, WalletCards, RefreshCw, Gauge } as const;
const ICON_LABELS: Record<keyof typeof ICONS, string> = {
  Handshake: "Relacionamento",
  ClipboardCheck: "Entregas",
  Users: "Engajamento",
  BarChart3: "Resultados",
  WalletCards: "Financeiro",
  RefreshCw: "Renovação",
  Gauge: "Geral",
};
const SCORECARD_COLORS = [
  "#7259B5", "#2D72B0", "#1A8B7A", "#2E8932",
  "#B07A14", "#9D174D", "#D94E4E", "#505A6B",
] as const;

const SUGGESTIONS = [
  { key: "relacionamento", nome: "Relacionamento", cor: "#7259B5", icone: "Handshake", criterios: ["Confiança na relação", "Acesso aos decisores", "Qualidade da comunicação"] },
  { key: "entregas", nome: "Entregas", cor: "#2D72B0", icone: "ClipboardCheck", criterios: ["Cumprimento de prazos", "Qualidade das entregas", "Organização das evidências"] },
  { key: "engajamento", nome: "Engajamento", cor: "#1A8B7A", icone: "Users", criterios: ["Participação nas ações", "Agilidade nas respostas", "Mobilização interna"] },
  { key: "resultados", nome: "Resultados", cor: "#2E8932", icone: "BarChart3", criterios: ["Alcance dos objetivos", "Impacto percebido", "Valor gerado para a parceria"] },
  { key: "financeiro", nome: "Financeiro", cor: "#B07A14", icone: "WalletCards", criterios: ["Pontualidade dos pagamentos", "Previsibilidade orçamentária", "Equilíbrio entre investimento e entrega"] },
  { key: "renovacao", nome: "Renovação", cor: "#9D174D", icone: "RefreshCw", criterios: ["Intenção de continuidade", "Orçamento disponível", "Aderência estratégica futura"] },
] as const;

export function calculateScore(criteria: Pick<Criterion, "peso" | "nota" | "ativo">[]) {
  const rated = criteria.filter(item => item.ativo && item.nota !== null);
  const weight = rated.reduce((sum, item) => sum + item.peso, 0);
  return weight ? rated.reduce((sum, item) => sum + (item.nota ?? 0) * item.peso, 0) / weight : null;
}

export function calculateOverallScore(scorecards: Array<Pick<Scorecard, "peso" | "ativo" | "criterios">>) {
  const rated = scorecards.map(card => ({ card, score: calculateScore(card.criterios) })).filter(item => item.card.ativo && item.score !== null);
  const weight = rated.reduce((sum, item) => sum + item.card.peso, 0);
  return weight ? rated.reduce((sum, item) => sum + (item.score ?? 0) * item.card.peso, 0) / weight : null;
}

function scoreMeta(score: number | null) {
  if (score === null) return { label: "Sem leitura", color: "rgba(13,13,13,.30)" };
  if (score < 2.2) return { label: "Risco", color: "#D94E4E" };
  if (score < 3.2) return { label: "Atenção", color: "#B07A14" };
  if (score < 4.2) return { label: "Estável", color: "#2D72B0" };
  return { label: "Saudável", color: "#2E8932" };
}

function ScoreRing({ score, size = 70 }: { score: number | null; size?: number }) {
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    <SegmentedScoreArc score={score} viewBoxSize={100} radius={43} strokeWidth={8} label={score === null ? "Sem avaliação" : `Nota ${score.toFixed(1)} de 5`} />
    <span className="absolute inset-0 flex items-center justify-center text-[0.9375rem] font-semibold tabular-nums tracking-[-.04em] text-black/70">{score === null ? "—" : score.toFixed(1).replace(".", ",")}</span>
  </div>;
}

function InternalIconPicker({ value, color, onChange }: { value: string; color: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedKey = (value in ICONS ? value : "Gauge") as keyof typeof ICONS;
  const SelectedIcon = ICONS[selectedKey];

  return <div className="relative">
    <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} className="flex h-8 w-full items-center justify-between rounded border border-black/10 bg-white px-2.5 text-black/55 transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25">
      <span className="flex min-w-0 items-center gap-2"><SelectedIcon size={13} style={{color}}/><span className="truncate text-[0.625rem]">{ICON_LABELS[selectedKey]}</span></span>
      <ChevronDown size={11} className={`shrink-0 text-black/25 transition ${open ? "rotate-180" : ""}`}/>
    </button>
    {open && <>
      <button type="button" aria-label="Fechar seletor de ícone" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)}/>
      <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-[13rem] rounded border border-black/[.09] bg-white p-2 shadow-[0_14px_36px_rgba(13,13,13,.13)]">
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(ICONS) as Array<keyof typeof ICONS>).map(key => {
            const Icon = ICONS[key]; const active = key === selectedKey;
            return <button key={key} type="button" title={ICON_LABELS[key]} aria-label={ICON_LABELS[key]} aria-pressed={active} onClick={() => {onChange(key);setOpen(false);}} className={`flex h-9 items-center justify-center rounded border transition active:scale-[.96] ${active ? "border-[#7259B5]/45 bg-white" : "border-transparent text-black/38 hover:border-black/[.07] hover:bg-black/[.025]"}`} style={active ? {color} : undefined}><Icon size={15}/></button>;
          })}
        </div>
      </div>
    </>}
  </div>;
}

function InternalColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  function commit(raw: string) {
    const color = raw.trim().toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(color)) onChange(color);
  }

  return <div className="relative">
    <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} className="flex h-8 w-full items-center justify-between rounded border border-black/10 bg-white px-2.5 transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25">
      <span className="flex min-w-0 items-center gap-2"><span className="h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10" style={{background:value}}/><span className="truncate font-mono text-[0.5625rem] text-black/45">{value.toUpperCase()}</span></span>
      <ChevronDown size={11} className={`shrink-0 text-black/25 transition ${open ? "rotate-180" : ""}`}/>
    </button>
    {open && <>
      <button type="button" aria-label="Fechar seletor de cor" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)}/>
      <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-[11.5rem] rounded border border-black/[.09] bg-white p-3 shadow-[0_14px_36px_rgba(13,13,13,.13)]">
        <div className="grid grid-cols-4 gap-2">
          {SCORECARD_COLORS.map(color => <button key={color} type="button" title={color} aria-label={`Usar cor ${color}`} aria-pressed={value.toUpperCase() === color} onClick={() => {onChange(color);setOpen(false);}} className={`flex h-8 items-center justify-center rounded border transition active:scale-[.96] ${value.toUpperCase() === color ? "border-black/25 ring-2 ring-black/10" : "border-black/[.05] hover:scale-105"}`} style={{background:color}}>{value.toUpperCase() === color && <Check size={11} className="text-white" strokeWidth={3}/>}</button>)}
        </div>
        <label className="mt-3 block border-t border-black/[.06] pt-3"><span className="mb-1.5 block text-[0.5625rem] font-medium text-black/30">Cor personalizada</span><input key={value} defaultValue={value.toUpperCase()} onBlur={event => commit(event.currentTarget.value)} onKeyDown={event => {if(event.key==="Enter"){commit(event.currentTarget.value);setOpen(false);}}} maxLength={7} className="h-8 w-full rounded border border-black/10 bg-white px-2.5 font-mono text-[0.625rem] uppercase text-black/55 outline-none focus:border-[#7259B5]/40" placeholder="#7259B5"/></label>
      </div>
    </>}
  </div>;
}

function Segments({ values, selected, onSelect, suffix = "" }: { values: readonly number[]; selected: number | null; onSelect: (value: number) => void; suffix?: string }) {
  return <div className="inline-flex rounded bg-black/[.05] p-0.5">{values.map(value => <button key={value} type="button" onClick={() => onSelect(value)} className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[0.625rem] font-semibold transition active:scale-[.96] ${selected === value ? "bg-white text-[#7259B5] shadow-sm" : "text-black/35 hover:text-black/60"}`}>{value}{suffix}</button>)}</div>;
}

export function PartnershipHealthScorecards({ contaId, organizationId, onScoreChange, onCardsChange }: { contaId: string; organizationId: string; onScoreChange?: (score: number | null, evaluated: number, total: number) => void; onCardsChange?: (cards: Scorecard[]) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [criterionFor, setCriterionFor] = useState<string | null>(null);
  const [newCriterionName, setNewCriterionName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let { data, error: queryError } = await (supabase as any).from("saude_parceria_scorecards")
      .select("id,nome,dimensao_base,peso,cor,icone,ordem,ativo,criterios:saude_parceria_criterios(id,scorecard_id,nome,peso,nota,observacao,ordem,ativo)")
      .eq("conta_patrocinio_id", contaId).eq("ativo", true).order("ordem");
    if (!queryError) {
      const existing = new Set(((data ?? []) as Scorecard[]).map(card => card.dimensao_base));
      const missing = SUGGESTIONS.filter(item => !existing.has(item.key));
      if (missing.length) {
        const seeded = await (supabase as any).from("saude_parceria_scorecards").upsert(
          missing.map(item => ({ organization_id: organizationId, conta_patrocinio_id: contaId, nome: item.nome, dimensao_base: item.key, peso: 1, cor: item.cor, icone: item.icone, ordem: SUGGESTIONS.findIndex(candidate => candidate.key === item.key) })),
          { onConflict: "conta_patrocinio_id,dimensao_base", ignoreDuplicates: true },
        );
        if (seeded.error) queryError = seeded.error;
        else {
          const refreshed = await (supabase as any).from("saude_parceria_scorecards")
            .select("id,nome,dimensao_base,peso,cor,icone,ordem,ativo,criterios:saude_parceria_criterios(id,scorecard_id,nome,peso,nota,observacao,ordem,ativo)")
            .eq("conta_patrocinio_id", contaId).eq("ativo", true).order("ordem");
          data = refreshed.data;
          queryError = refreshed.error;
        }
      }
    }
    if (queryError) setError(queryError.message);
    else setCards(((data ?? []) as Scorecard[]).map(card => ({ ...card, criterios: (card.criterios ?? []).filter(item => item.ativo).sort((a, b) => a.ordem - b.ordem) })));
    setLoading(false);
  }, [contaId, organizationId, supabase]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editingId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setEditingId(null); setCriterionFor(null); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKeyDown); };
  }, [editingId]);

  const overall = calculateOverallScore(cards);
  const activeCards = cards.filter(card => card.ativo);
  const evaluatedCards = activeCards.filter(card => calculateScore(card.criterios) !== null).length;
  const editingCard = cards.find(card => card.id === editingId) ?? null;

  useEffect(() => { onScoreChange?.(overall === null ? null : Math.round(overall / 5 * 100), evaluatedCards, activeCards.length); }, [activeCards.length, evaluatedCards, onScoreChange, overall]);
  useEffect(() => { onCardsChange?.(cards); }, [cards, onCardsChange]);

  async function addSuggestedCriteria(card: Scorecard) {
    const suggestion = SUGGESTIONS.find(item => item.key === card.dimensao_base);
    if (!suggestion) return;
    setSaving(true); setError(null);
    const existing = new Set(card.criterios.map(item => item.nome.toLocaleLowerCase("pt-BR")));
    const rows = suggestion.criterios.filter(nome => !existing.has(nome.toLocaleLowerCase("pt-BR"))).map((nome, index) => ({ organization_id: organizationId, scorecard_id: card.id, nome, peso: 2, ordem: card.criterios.length + index }));
    if (!rows.length) { setSaving(false); return; }
    const { error: insertError } = await (supabase as any).from("saude_parceria_criterios").insert(rows);
    if (insertError) setError(insertError.message); else await load();
    setSaving(false);
  }

  async function updateCard(id: string, changes: Partial<Pick<Scorecard, "nome" | "peso" | "cor" | "icone">>) {
    const previous = cards;
    setCards(items => items.map(item => item.id === id ? { ...item, ...changes } : item));
    const { error: updateError } = await (supabase as any).from("saude_parceria_scorecards").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) { setCards(previous); setError(updateError.message); }
  }

  async function addCriterion(cardId: string) {
    const nome = newCriterionName.trim(); if (!nome) return;
    const card = cards.find(item => item.id === cardId); if (!card) return;
    const { error: insertError } = await (supabase as any).from("saude_parceria_criterios").insert({ organization_id: organizationId, scorecard_id: cardId, nome, peso: 2, ordem: card.criterios.length });
    if (insertError) setError(insertError.message); else { setCriterionFor(null); setNewCriterionName(""); await load(); }
  }

  async function updateCriterion(cardId: string, id: string, changes: Partial<Pick<Criterion, "nome" | "peso" | "nota">>) {
    const previous = cards;
    setCards(items => items.map(card => card.id === cardId ? { ...card, criterios: card.criterios.map(item => item.id === id ? { ...item, ...changes } : item) } : card));
    const { error: updateError } = await (supabase as any).from("saude_parceria_criterios").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id);
    if (updateError) { setCards(previous); setError(updateError.message); }
  }

  async function removeCriterion(cardId: string, id: string) {
    const previous = cards;
    setCards(items => items.map(card => card.id === cardId ? { ...card, criterios: card.criterios.filter(item => item.id !== id) } : card));
    const { error: deleteError } = await (supabase as any).from("saude_parceria_criterios").delete().eq("id", id);
    if (deleteError) { setCards(previous); setError(deleteError.message); }
  }

  if (loading) return <div className="grid gap-px overflow-hidden rounded border border-black/[.07] bg-black/[.07] md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse bg-black/[.035]" />)}</div>;

  return <div className="space-y-3">
    <div className="grid gap-px overflow-hidden rounded border border-black/[.07] bg-black/[.07] md:grid-cols-2 xl:grid-cols-3">{cards.map(card => {
      const score = calculateScore(card.criterios); const meta = scoreMeta(score); const Icon = ICONS[card.icone as keyof typeof ICONS] ?? Gauge; const rated = card.criterios.filter(item => item.nota !== null).length;
      return <button key={card.id} type="button" onClick={() => setEditingId(card.id)} className="group flex min-h-[7rem] min-w-0 items-center gap-3 bg-white px-4 py-4 text-left transition hover:bg-[#FAFAFB] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7259B5]/30">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center" style={{color:card.cor}}><Icon size={17}/></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[0.8125rem] font-semibold text-black/70">{card.nome}</span><span className="mt-1 block text-[0.625rem] font-medium" style={{color:meta.color}}>{meta.label}</span><span className="mt-2 block text-[0.5625rem] text-black/25">{card.criterios.length ? `${rated} de ${card.criterios.length} critérios avaliados` : "Configurar critérios"}</span></span>
        <ScoreRing score={score} size={48}/>
        <Pencil size={11} className="shrink-0 text-black/0 transition group-hover:text-black/25"/>
      </button>;
    })}</div>
    {error && !editingCard && <p className="rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.625rem] text-[#B23A3A]">{error}</p>}

    {editingCard && (() => {
      const score = calculateScore(editingCard.criterios); const meta = scoreMeta(score); const Icon = ICONS[editingCard.icone as keyof typeof ICONS] ?? Gauge;
      return <div className="fixed inset-0 z-[70] flex flex-col items-center bg-black/40" onMouseDown={() => { setEditingId(null); setCriterionFor(null); }}>
        <section className="flex max-h-[88vh] w-full max-w-[38.75rem] flex-col overflow-hidden rounded-b bg-white shadow-[0_18px_60px_rgba(13,13,13,.18)]" onMouseDown={event => event.stopPropagation()}>
          <header className="flex items-center gap-3 border-b border-black/[.07] px-5 py-4 sm:px-6"><span className="flex h-9 w-9 items-center justify-center" style={{color:editingCard.cor}}><Icon size={17}/></span><div className="min-w-0 flex-1"><p className="text-[0.625rem] font-medium text-black/30">Avaliar dimensão</p><h2 className="mt-0.5 truncate text-[0.9375rem] font-semibold text-black/80">{editingCard.nome}</h2></div><ScoreRing score={score} size={46}/><button type="button" onClick={() => { setEditingId(null); setCriterionFor(null); }} className="flex h-8 w-8 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60" aria-label="Fechar"><X size={15}/></button></header>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-3 rounded border border-black/[.07] bg-[#FAFAFB] p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
              <label><span className="mb-1.5 block text-[0.5625rem] font-medium text-black/30">Nome</span><input defaultValue={editingCard.nome} onBlur={event => { const nome = event.target.value.trim(); if (nome && nome !== editingCard.nome) void updateCard(editingCard.id, {nome}); }} className="h-8 w-full rounded border border-black/10 bg-white px-2.5 text-[0.6875rem] font-semibold text-black/65 outline-none focus:border-[#7259B5]/40"/></label>
              <div><span className="mb-1.5 block text-[0.5625rem] font-medium text-black/30">Ícone</span><InternalIconPicker value={editingCard.icone} color={editingCard.cor} onChange={icone => void updateCard(editingCard.id, {icone})}/></div>
              <div><span className="mb-1.5 block text-[0.5625rem] font-medium text-black/30">Cor</span><InternalColorPicker value={editingCard.cor} onChange={cor => void updateCard(editingCard.id, {cor})}/></div>
              <div className="sm:col-span-3"><span className="mb-1.5 block text-[0.5625rem] font-medium text-black/30">Peso na saúde geral</span><Segments values={[1,2,3]} selected={editingCard.peso} suffix="×" onSelect={value => void updateCard(editingCard.id, {peso:value as 1|2|3})}/></div>
            </div>

            <div className="mb-3 mt-5 flex items-center justify-between"><div><h3 className="text-[0.8125rem] font-semibold text-black/70">Critérios</h3><p className="mt-0.5 text-[0.625rem] text-black/30">A nota da dimensão é a média ponderada dos critérios.</p></div><span className="text-[0.625rem] font-medium" style={{color:meta.color}}>{meta.label}</span></div>
            {editingCard.criterios.length ? <div className="divide-y divide-black/[.06] overflow-hidden rounded border border-black/[.07]">{editingCard.criterios.map(criterion=><div key={criterion.id} className="bg-white p-3.5"><div className="flex items-center gap-2"><input defaultValue={criterion.nome} onBlur={event => {const nome=event.target.value.trim();if(nome&&nome!==criterion.nome)void updateCriterion(editingCard.id,criterion.id,{nome});}} className="min-w-0 flex-1 bg-transparent text-[0.6875rem] font-semibold text-black/60 outline-none focus:text-black"/><button type="button" onClick={()=>void removeCriterion(editingCard.id,criterion.id)} className="flex h-7 w-7 items-center justify-center rounded text-black/15 transition hover:bg-black/[.04] hover:text-[#D94E4E]" aria-label={`Excluir ${criterion.nome}`}><Trash2 size={11}/></button></div><div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><span className="mb-1 block text-[0.5rem] font-medium text-black/25">Peso</span><Segments values={[1,2,3]} selected={criterion.peso} suffix="×" onSelect={value=>void updateCriterion(editingCard.id,criterion.id,{peso:value as 1|2|3})}/></div><div><span className="mb-1 block text-[0.5rem] font-medium text-black/25">Nota</span><Segments values={[1,2,3,4,5]} selected={criterion.nota} onSelect={value=>void updateCriterion(editingCard.id,criterion.id,{nota:value as 1|2|3|4|5})}/></div></div></div>)}</div> : <div className="rounded border border-dashed border-black/10 py-7 text-center"><p className="text-[0.6875rem] text-black/30">Nenhum critério configurado.</p>{editingCard.dimensao_base&&<button type="button" disabled={saving} onClick={()=>void addSuggestedCriteria(editingCard)} className="mt-2 rounded border border-black/[.09] bg-white px-3 py-2 text-[0.625rem] font-semibold text-black/50 transition hover:bg-black/[.035] disabled:opacity-40">Usar critérios sugeridos</button>}</div>}

            {criterionFor===editingCard.id?<div className="mt-3 flex gap-2"><input autoFocus value={newCriterionName} onChange={event=>setNewCriterionName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void addCriterion(editingCard.id);if(event.key==="Escape")setCriterionFor(null);}} placeholder="Nome do critério" className="h-9 min-w-0 flex-1 rounded border border-black/10 px-3 text-[0.6875rem] outline-none focus:border-[#7259B5]/40"/><button type="button" onClick={()=>void addCriterion(editingCard.id)} className="flex h-9 w-9 items-center justify-center rounded bg-[#2E8932] text-white"><Check size={12}/></button><button type="button" onClick={()=>setCriterionFor(null)} className="flex h-9 w-9 items-center justify-center rounded text-black/30 hover:bg-black/[.04]"><X size={12}/></button></div>:<button type="button" onClick={()=>{setCriterionFor(editingCard.id);setNewCriterionName("");}} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded border border-black/10 bg-white px-3 text-[0.625rem] font-semibold text-black/50 transition hover:bg-black/[.035]"><Plus size={11}/>Adicionar critério</button>}
            {error&&<p className="mt-3 rounded border border-[#D94E4E]/25 bg-white px-3 py-2 text-[0.625rem] text-[#B23A3A]">{error}</p>}
          </div>

          <footer className="flex items-center justify-end border-t border-black/[.07] px-5 py-4 sm:px-6"><button type="button" onClick={()=>{setEditingId(null);setCriterionFor(null);}} className="rounded bg-[#2E8932] px-4 py-2 text-[0.6875rem] font-semibold text-white transition hover:bg-[#26752A] active:translate-y-px">Concluir</button></footer>
        </section>
      </div>;
    })()}
  </div>;
}
