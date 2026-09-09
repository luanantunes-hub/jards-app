"use client";

import { useState, type ReactNode } from "react";
import type { PotencialFechamento as PotencialFechamentoType } from "@/lib/supabase/types";
import { KanbanBoard, KanbanColumn, KanbanEmpty, KanbanSkeleton } from "@/components/kanban/KanbanPrimitives";

export type PotencialFechamento = PotencialFechamentoType;

export type PotentialKanbanItem = {
  id: string;
  potencial_fechamento?: PotencialFechamento | null;
  valor?: number | null;
};

type Column = {
  value: PotencialFechamento;
  label: string;
  accent: string;
  iconName: string;
  weight: number;
};

const COLUMNS: Column[] = [
  { value: "baixo", label: "Baixo", accent: "#D94E4E", iconName: "ArrowDown", weight: 0.25 },
  { value: "medio", label: "Médio", accent: "#B07A14", iconName: "Minus", weight: 0.6 },
  { value: "alto", label: "Alto", accent: "#2E8932", iconName: "ArrowUp", weight: 0.85 },
];

function formatValue(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${value.toLocaleString("pt-BR")}`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

/**
 * Reusable inverted potential board. The data model remains domain-owned:
 * callers persist only `potencial_fechamento` and render their own cards.
 */
export function PotentialKanban<T extends PotentialKanbanItem>({
  items,
  loading = false,
  emptyLabel,
  renderCard,
  onMove,
  onAdd,
  getValue = (item) => item.valor ?? null,
}: {
  items: T[];
  loading?: boolean;
  emptyLabel: string;
  renderCard: (item: T, dragging: boolean, valuePct: number, dragHandlers: { onDragStart: () => void; onDragEnd: () => void }) => ReactNode;
  onMove: (id: string, potential: PotencialFechamento) => Promise<boolean> | boolean;
  onAdd?: (potential: PotencialFechamento) => void;
  getValue?: (item: T) => number | null;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [over, setOver] = useState<PotencialFechamento | null>(null);
  const maxValue = Math.max(...items.map((item) => getValue(item) ?? 0), 1);

  return (
    <KanbanBoard>
        {COLUMNS.map((column) => {
          const cards = items.filter((item) => (item.potencial_fechamento ?? "medio") === column.value);
          const valuedCards = cards.filter((item) => getValue(item) != null);
          const total = valuedCards.reduce((sum, item) => sum + (getValue(item) ?? 0), 0);
          const weighted = total * column.weight;

          return (
            <KanbanColumn
              key={column.value}
              label={column.label}
              count={loading ? null : cards.length}
              total={!loading && valuedCards.length ? formatValue(total) : null}
              forecast={!loading && valuedCards.length ? formatValue(weighted) : null}
              accent={column.accent}
              iconName={column.iconName}
              compact
              active={over === column.value && Boolean(draggingId)}
              addLabel={`Adicionar com potencial ${column.label}`}
              onAdd={onAdd ? () => onAdd(column.value) : undefined}
              onDragOver={(event) => { event.preventDefault(); setOver(column.value); }}
              onDragLeave={() => setOver(null)}
              onDrop={async (event) => {
                event.preventDefault();
                const id = draggingId;
                setDraggingId(null); setOver(null);
                if (id) await onMove(id, column.value);
              }}
            >
                {loading ? (
                  Array.from({ length: 2 }).map((_, index) => <KanbanSkeleton key={index}/>)
                ) : cards.length === 0 ? (
                  <KanbanEmpty label={emptyLabel} actionLabel="Adicionar primeiro" onAction={onAdd ? () => onAdd(column.value) : undefined}/>
                ) : cards.map((item) => {
                  const value = getValue(item) ?? 0;
                  const pct = Math.max(4, Math.round((value / maxValue) * 100));
                  return renderCard(item, draggingId === item.id, pct, {
                    onDragStart: () => setDraggingId(item.id),
                    onDragEnd: () => { setDraggingId(null); setOver(null); },
                  });
                })}
            </KanbanColumn>
          );
        })}
    </KanbanBoard>
  );
}
