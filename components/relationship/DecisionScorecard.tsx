"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { SegmentedScoreArc } from "@/components/ui/SegmentedScoreArc";

export type DecisionCriterion = {
  id: string;
  organization_id: string;
  nome: string;
  peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null;
  ordem: number;
};

const PROPONENTE_STARTER_CRITERIA = [
  { nome: "Alinhamento estratégico", peso: 3 },
  { nome: "Qualidade da execução", peso: 3 },
  { nome: "Confiança na relação", peso: 3 },
  { nome: "Capacidade de mobilização", peso: 2 },
  { nome: "Potencial de continuidade", peso: 2 },
] as const;

const CAPTADOR_STARTER_CRITERIA = [
  { nome: "Qualidade das oportunidades", peso: 3 },
  { nome: "Disciplina de acompanhamento", peso: 3 },
  { nome: "Avanço das negociações", peso: 3 },
  { nome: "Qualidade do relacionamento", peso: 2 },
  { nome: "Conversão em captação", peso: 2 },
] as const;

export function calculateWeightedScore(criteria: Pick<DecisionCriterion, "peso" | "nota">[]) {
  const rated = criteria.filter((item): item is Pick<DecisionCriterion, "peso"> & { nota: 1 | 2 | 3 | 4 | 5 } => item.nota !== null);
  const totalWeight = rated.reduce((sum, item) => sum + item.peso, 0);
  if (totalWeight === 0) return null;
  return rated.reduce((sum, item) => sum + item.nota * item.peso, 0) / totalWeight;
}

function scoreMeta(score: number | null) {
  if (score === null) return { label: "Sem avaliação", color: "rgba(13,13,13,.30)" };
  if (score < 2) return { label: "Reavaliar relação", color: "#D94E4E" };
  if (score < 3) return { label: "Exige atenção", color: "#B07A14" };
  if (score < 4) return { label: "Vale continuar", color: "#2D72B0" };
  if (score < 4.6) return { label: "Relação promissora", color: "#7259B5" };
  return { label: "Relação prioritária", color: "#2E8932" };
}

function ScoreRing({ score }: { score: number | null }) {
  return (
    <div className="relative h-[124px] w-[124px] shrink-0">
      <SegmentedScoreArc score={score} label={score === null ? "Score sem avaliação" : `Score ${score.toFixed(1)} de 5`} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-semibold tracking-[-.055em] text-[#1D1D1F]">{score === null ? "N/A" : score.toFixed(1).replace(".", ",")}</span>
        <span className="mt-0.5 text-[10px] font-medium text-black/35">de 5</span>
      </div>
    </div>
  );
}

export function CompactDecisionScoreRing({ score }: { score: number | null }) {
  const meta = scoreMeta(score);

  return (
    <div
      className="relative h-10 w-10 shrink-0"
      title={score === null ? "Sem avaliação" : `${meta.label}: ${score.toFixed(1).replace(".", ",")} de 5`}
    >
      <SegmentedScoreArc
        score={score}
        radius={45}
        strokeWidth={10}
        label={score === null ? "Score sem avaliação" : `Score ${score.toFixed(1)} de 5`}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tracking-[-.04em] text-[#1D1D1F]">
        {score === null ? "N/A" : score.toFixed(1).replace(".", ",")}
      </span>
    </div>
  );
}

function SegmentedControl({
  label,
  values,
  selected,
  suffix = "",
  onSelect,
}: {
  label: string;
  values: readonly number[];
  selected: number | null;
  suffix?: string;
  onSelect: (value: number) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[9px] font-semibold text-black/35">{label}</span>
      <div className="inline-flex rounded bg-black/[.055] p-[2px]" role="group" aria-label={label}>
        {values.map(value => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-pressed={selected === value}
            className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[10px] font-semibold transition-[background,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/35 active:scale-[.96] ${
              selected === value
                ? "bg-white text-[#7259B5] shadow-[0_1px_3px_rgba(0,0,0,.12)]"
                : "text-black/40 hover:text-black/65"
            }`}
          >
            {value}{suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

type RelationshipScorecardProps = {
  entityId: string;
  organizationId: string | null;
  table: "proponente_score_criterios" | "captador_score_criterios";
  foreignKey: "proponente_id" | "captador_id";
  starterCriteria: readonly { nome: string; peso: number }[];
  starterActionLabel: string;
  placeholder: string;
};

function RelationshipScorecard({ entityId, organizationId, table, foreignKey, starterCriteria, starterActionLabel, placeholder }: RelationshipScorecardProps) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [criteria, setCriteria] = useState<DecisionCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from(table as any)
      .select(`id,organization_id,${foreignKey},nome,peso,nota,ordem`)
      .eq(foreignKey, entityId)
      .order("ordem");
    if (queryError) setError(queryError.message);
    else setCriteria((data ?? []) as DecisionCriterion[]);
    setLoading(false);
  }, [entityId, foreignKey, supabase, table]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const score = calculateWeightedScore(criteria);
  const scoreState = scoreMeta(score);
  const ratedCount = criteria.filter(item => item.nota !== null).length;

  async function resolveOrganization() {
    if (organizationId) return organizationId;
    const { data } = await supabase.rpc("auth_org_ids");
    return (data as unknown as string[] | null)?.[0] ?? null;
  }

  async function addCriterion() {
    const name = newName.trim();
    if (!name) return;
    const orgId = await resolveOrganization();
    if (!orgId) { setError("Organização não encontrada."); return; }
    setSavingId("new");
    setError(null);
    const { error: insertError } = await (supabase as any).from(table).insert({
      organization_id: orgId,
      [foreignKey]: entityId,
      nome: name,
      peso: 2,
      nota: null,
      ordem: criteria.length,
    });
    setSavingId(null);
    if (insertError) { setError(insertError.message); return; }
    setNewName("");
    setAdding(false);
    await load();
  }

  async function addStarterCriteria() {
    const orgId = await resolveOrganization();
    if (!orgId) { setError("Organização não encontrada."); return; }
    setSavingId("starter");
    setError(null);
    const { error: insertError } = await (supabase as any).from(table).insert(
      starterCriteria.map((item, index) => ({
        organization_id: orgId,
        [foreignKey]: entityId,
        nome: item.nome,
        peso: item.peso,
        nota: null,
        ordem: index,
      })),
    );
    setSavingId(null);
    if (insertError) { setError(insertError.message); return; }
    await load();
  }

  async function updateCriterion(id: string, changes: Partial<Pick<DecisionCriterion, "nome" | "peso" | "nota">>) {
    const previous = criteria;
    setCriteria(items => items.map(item => item.id === id ? { ...item, ...changes } : item));
    setSavingId(id);
    setError(null);
    const { error: updateError } = await (supabase as any).from(table).update(changes).eq("id", id);
    setSavingId(null);
    if (updateError) {
      setCriteria(previous);
      setError(updateError.message);
    }
  }

  function removeCriterion(id: string) {
    confirmDelete({
      title: "Excluir este critério do scorecard?",
      description: "A nota ponderada é recalculada sem ele.",
      onConfirm: async () => {
        await excluirPorId(supabase, table, id);
        setCriteria(items => items.filter(item => item.id !== id));
      },
    });
  }

  return (
    <section className="overflow-hidden rounded border border-black/[.08] bg-white">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-.02em] text-[#1D1D1F]">Score de relacionamento</h2>
          <p className="mt-0.5 text-[11px] text-black/40">Média ponderada</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-[#7259B5]/20 bg-white px-3 text-[10px] font-semibold text-[#7259B5] shadow-[0_1px_2px_rgba(0,0,0,.04)] transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30 active:scale-[.97]"
        >
          <Plus size={11} strokeWidth={2} /> Adicionar
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-4 rounded border border-black/[.045] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,.025)]">
          <ScoreRing score={score} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-tight tracking-[-.02em]" style={{ color: scoreState.color }}>{scoreState.label}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-black/45">
              {criteria.length === 0
                ? "Nenhum critério definido"
                : `${ratedCount} de ${criteria.length} ${criteria.length === 1 ? "critério avaliado" : "critérios avaliados"}`}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2" aria-label="Carregando critérios">
            <div className="h-[94px] animate-pulse rounded bg-black/[.045]" />
            <div className="h-[94px] animate-pulse rounded bg-black/[.045]" />
          </div>
        ) : criteria.length === 0 && !adding ? (
          <div className="mt-3 rounded bg-white px-4 py-5 text-center shadow-[0_1px_2px_rgba(0,0,0,.025)]">
            <p className="text-[12px] font-medium text-black/55">Comece sua avaliação</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" onClick={() => setAdding(true)} className="rounded border border-[#7259B5]/20 bg-white px-3 py-2 text-[10px] font-semibold text-[#7259B5] transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30 active:scale-[.97]">Criar critério</button>
              <button type="button" disabled={savingId === "starter"} onClick={() => void addStarterCriteria()} className="rounded border border-black/[.08] bg-white px-3 py-2 text-[10px] font-semibold text-black/50 transition hover:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 active:scale-[.97] disabled:opacity-40">{starterActionLabel}</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {criteria.map(item => (
              <div key={item.id} className="group rounded border border-black/[.04] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,.025)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,.055)]">
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={item.nome}
                    onBlur={event => { const value = event.target.value.trim(); if (value && value !== item.nome) void updateCriterion(item.id, { nome: value }); else event.target.value = item.nome; }}
                    className="min-w-0 flex-1 rounded bg-transparent px-0.5 py-1 text-[12px] font-semibold tracking-[-.01em] text-black/70 outline-none transition focus:bg-black/[.025] focus:px-2 focus:ring-2 focus:ring-[#7259B5]/20"
                    aria-label={`Nome do critério ${item.nome}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCriterion(item.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-black/20 opacity-60 transition hover:bg-red-50 hover:text-red-500 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 group-hover:opacity-100 active:scale-[.94]"
                    aria-label={`Excluir ${item.nome}`}
                  >
                    <Trash2 size={11} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-3">
                  <SegmentedControl
                    label="Peso"
                    values={[1, 2, 3]}
                    selected={item.peso}
                    suffix="×"
                    onSelect={weight => void updateCriterion(item.id, { peso: weight as 1 | 2 | 3 })}
                  />
                  <SegmentedControl
                    label="Nota"
                    values={[1, 2, 3, 4, 5]}
                    selected={item.nota}
                    onSelect={rating => void updateCriterion(item.id, { nota: rating as 1 | 2 | 3 | 4 | 5 })}
                  />
                </div>
                {savingId === item.id && <span className="mt-2 block text-right text-[9px] text-black/25" aria-live="polite">Salvando...</span>}
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mt-3 rounded border border-[#7259B5]/15 bg-white p-3.5 shadow-[0_4px_16px_rgba(0,0,0,.045)]">
            <label htmlFor={`new-score-criterion-${entityId}`} className="mb-1.5 block text-[10px] font-semibold text-black/50">Novo critério</label>
            <input
              id={`new-score-criterion-${entityId}`}
              autoFocus
              value={newName}
              onChange={event => setNewName(event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") void addCriterion(); if (event.key === "Escape") setAdding(false); }}
              placeholder={placeholder}
              className="h-9 w-full rounded border border-black/[.10] bg-[#F5F5F7] px-3 text-[11px] text-black/70 outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:bg-white focus:ring-2 focus:ring-[#7259B5]/15"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setAdding(false); setNewName(""); }} className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-[10px] font-semibold text-black/40 transition hover:bg-black/[.04] hover:text-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 active:scale-[.97]" aria-label="Cancelar"><X size={11} /> Cancelar</button>
              <button type="button" disabled={!newName.trim() || savingId === "new"} onClick={() => void addCriterion()} className="inline-flex h-8 items-center gap-1.5 rounded bg-[#2E8932] px-3 text-[10px] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8932]/30 active:scale-[.97] disabled:opacity-40" aria-label="Salvar critério"><Check size={11} /> Salvar</button>
            </div>
          </div>
        )}

        {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] leading-relaxed text-red-700" role="alert">{error}</p>}
      </div>
    </section>
  );
}

export function DecisionScorecard({ proponenteId, organizationId }: { proponenteId: string; organizationId: string | null }) {
  return (
    <RelationshipScorecard
      entityId={proponenteId}
      organizationId={organizationId}
      table="proponente_score_criterios"
      foreignKey="proponente_id"
      starterCriteria={PROPONENTE_STARTER_CRITERIA}
      starterActionLabel="Usar modelo"
      placeholder="Ex.: qualidade da entrega"
    />
  );
}

export function CaptadorRelationshipScorecard({ captadorId, organizationId }: { captadorId: string; organizationId: string | null }) {
  return (
    <RelationshipScorecard
      entityId={captadorId}
      organizationId={organizationId}
      table="captador_score_criterios"
      foreignKey="captador_id"
      starterCriteria={CAPTADOR_STARTER_CRITERIA}
      starterActionLabel="Usar sugestões"
      placeholder="Ex.: qualidade das oportunidades"
    />
  );
}
