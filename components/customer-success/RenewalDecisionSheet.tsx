"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Check, RotateCcw, Settings2, X } from "lucide-react";
import { OUTCOME_LABELS, nextDecision, type RenewalDecisionAnswers, type RenewalDecisionNode, type RenewalDecisionOutcome } from "@/lib/customer-success/renewalDecisionTree";

type EvaluationState = {
  answers: RenewalDecisionAnswers;
  currentNodeId: string | null;
  outcome: RenewalDecisionOutcome | null;
  status: "nao_avaliada" | "em_andamento" | "concluida";
};

type GraphVertex = { id: string; kind: "question" | "outcome"; title: string; x: number; y: number };
type GraphEdge = { id: string; sourceId: string; targetId: string; optionId: string; label: string };

const NODE_W = 216;
const NODE_H = 72;
const COLUMN_GAP = 128;
const ROW_GAP = 28;

function buildGraph(tree: RenewalDecisionNode[]) {
  const nodeById = new Map(tree.map(node => [node.id, node]));
  const edges: GraphEdge[] = [];
  const outcomeIds = new Set<string>();

  tree.forEach(node => node.options.forEach(option => {
    const targetId = option.nextNodeId && nodeById.has(option.nextNodeId)
      ? option.nextNodeId
      : option.outcome ? `outcome:${option.outcome}` : null;
    if (!targetId) return;
    if (targetId.startsWith("outcome:")) outcomeIds.add(targetId);
    edges.push({ id: `${node.id}:${option.id}`, sourceId: node.id, targetId, optionId: option.id, label: option.label });
  }));

  const depths = new Map<string, number>();
  const rootId = tree[0]?.id;
  if (rootId) {
    depths.set(rootId, 0);
    const queue = [rootId];
    for (let cursor = 0; cursor < queue.length && cursor < 500; cursor += 1) {
      const sourceId = queue[cursor];
      const sourceDepth = depths.get(sourceId) ?? 0;
      edges.filter(edge => edge.sourceId === sourceId).forEach(edge => {
        if (depths.has(edge.targetId)) return;
        depths.set(edge.targetId, sourceDepth + 1);
        if (nodeById.has(edge.targetId)) queue.push(edge.targetId);
      });
    }
  }

  let deepest = Math.max(0, ...depths.values());
  tree.forEach(node => { if (!depths.has(node.id)) depths.set(node.id, ++deepest); });
  outcomeIds.forEach(id => { if (!depths.has(id)) depths.set(id, deepest + 1); });

  const rawVertices = [
    ...tree.map(node => ({ id: node.id, kind: "question" as const, title: node.title })),
    ...Array.from(outcomeIds).map(id => {
      const outcome = id.slice("outcome:".length) as RenewalDecisionOutcome;
      return { id, kind: "outcome" as const, title: OUTCOME_LABELS[outcome] };
    }),
  ];
  const columns = new Map<number, typeof rawVertices>();
  rawVertices.forEach(vertex => {
    const depth = depths.get(vertex.id) ?? 0;
    columns.set(depth, [...(columns.get(depth) ?? []), vertex]);
  });
  const maxRows = Math.max(1, ...Array.from(columns.values()).map(column => column.length));
  const contentHeight = Math.max(560, maxRows * (NODE_H + ROW_GAP) + 160);
  const vertices: GraphVertex[] = [];
  Array.from(columns.entries()).sort(([a], [b]) => a - b).forEach(([depth, column]) => {
    const columnHeight = column.length * NODE_H + Math.max(0, column.length - 1) * ROW_GAP;
    const startY = Math.max(80, (contentHeight - columnHeight) / 2);
    column.forEach((vertex, index) => vertices.push({ ...vertex, x: 72 + depth * (NODE_W + COLUMN_GAP), y: startY + index * (NODE_H + ROW_GAP) }));
  });
  const maxDepth = Math.max(0, ...Array.from(depths.values()));
  return { vertices, edges, width: Math.max(1100, 144 + (maxDepth + 1) * NODE_W + maxDepth * COLUMN_GAP), height: contentHeight };
}

export function RenewalDecisionSheet({ open, tree, value, onChange, onClose }: { open: boolean; tree: RenewalDecisionNode[]; value: EvaluationState; onChange: (value: EvaluationState) => void; onClose: () => void }) {
  const graph = useMemo(() => buildGraph(tree), [tree]);
  const currentId = value.currentNodeId ?? (value.status === "nao_avaliada" ? tree[0]?.id : null);
  const viewportRef = useRef<HTMLElement>(null);
  const focusId = value.outcome ? `outcome:${value.outcome}` : currentId;

  useEffect(() => {
    if (!open || !focusId) return;
    const viewport = viewportRef.current;
    const vertex = graph.vertices.find(item => item.id === focusId);
    if (!viewport || !vertex) return;
    const frame = window.requestAnimationFrame(() => viewport.scrollTo({
      left: Math.max(0, vertex.x + NODE_W / 2 - viewport.clientWidth / 2),
      top: Math.max(0, vertex.y + NODE_H / 2 - viewport.clientHeight / 2),
      behavior: value.status === "nao_avaliada" ? "auto" : "smooth",
    }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusId, graph.vertices, open, value.status]);

  if (!open) return null;

  const current = tree.find(node => node.id === currentId);
  const answered = Object.keys(value.answers).length;
  const positions = new Map(graph.vertices.map(vertex => [vertex.id, vertex]));
  const selectedEdges = new Set(Object.entries(value.answers).map(([nodeId, optionId]) => `${nodeId}:${optionId}`));
  const parallelOffsets = new Map<string, number>();
  const parallelGroups = new Map<string, GraphEdge[]>();
  graph.edges.forEach(edge => {
    const key = `${edge.sourceId}->${edge.targetId}`;
    parallelGroups.set(key, [...(parallelGroups.get(key) ?? []), edge]);
  });
  parallelGroups.forEach(group => group.forEach((edge, index) => {
    parallelOffsets.set(edge.id, (index - (group.length - 1) / 2) * 30);
  }));

  function answer(optionId: string) {
    if (!current) return;
    const route = nextDecision(tree, current.id, optionId);
    if (!route) return;
    const answers = { ...value.answers, [current.id]: optionId };
    onChange({ answers, currentNodeId: route.nextNodeId, outcome: route.outcome, status: route.outcome ? "concluida" : "em_andamento" });
  }

  function reset() {
    onChange({ answers: {}, currentNodeId: tree[0]?.id ?? null, outcome: null, status: "nao_avaliada" });
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="decision-title" className="fixed inset-0 z-[1200] flex flex-col bg-[#F7F7F5]">
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-black/[.08] bg-white px-5 md:px-7">
      <div className="min-w-0">
        <h2 id="decision-title" className="text-[15px] font-semibold tracking-[-.01em] text-black/80">Árvore de renovação</h2>
        <p className="mt-0.5 text-[10px] text-black/35">{value.outcome ? "Diagnóstico concluído" : `${answered} ${answered === 1 ? "decisão registrada" : "decisões registradas"}`}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/configuracoes?section=funis" onClick={onClose} className="inline-flex h-8 items-center gap-1.5 rounded border border-black/[.08] bg-white px-2.5 text-[10px] font-medium text-black/40 hover:bg-black/[.035] hover:text-black/60"><Settings2 size={12}/>Editar árvore</Link>
        <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded text-black/30 hover:bg-black/[.04] hover:text-black/55"><X size={15}/></button>
      </div>
    </header>

    <main ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle,rgba(13,13,13,.11)_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="relative" style={{ width: graph.width, height: graph.height }}>
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          {graph.edges.map(edge => {
            const source = positions.get(edge.sourceId);
            const target = positions.get(edge.targetId);
            if (!source || !target) return null;
            const sx = source.x + NODE_W;
            const sy = source.y + NODE_H / 2;
            const tx = target.x;
            const ty = target.y + NODE_H / 2;
            const control = Math.max(54, (tx - sx) * .44);
            const parallelOffset = parallelOffsets.get(edge.id) ?? 0;
            const selected = selectedEdges.has(edge.id);
            return <g key={edge.id} className="tree-edge-enter">
              <path d={`M ${sx} ${sy} C ${sx + control} ${sy + parallelOffset}, ${tx - control} ${ty + parallelOffset}, ${tx} ${ty}`} fill="none" stroke={selected ? "#2E8932" : "rgba(13,13,13,.13)"} strokeWidth={selected ? 2 : 1.2} strokeDasharray={selected ? "7 5" : "4 6"} className={selected ? "tree-edge-active" : ""}/>
              {selected && <foreignObject x={(sx + tx) / 2 - 48} y={(sy + ty) / 2 + parallelOffset - 12} width="96" height="24">
                <div className="mx-auto w-fit max-w-[92px] truncate rounded border border-[#2E8932]/20 bg-[#F1F8F1] px-1.5 py-0.5 text-[8px] font-medium text-[#2E8932]">{edge.label}</div>
              </foreignObject>}
            </g>;
          })}
        </svg>

        {graph.vertices.map((vertex, index) => {
          const isCurrent = vertex.kind === "question" && vertex.id === currentId && !value.outcome;
          const isAnswered = vertex.kind === "question" && Boolean(value.answers[vertex.id]);
          const outcomeKey = vertex.id.startsWith("outcome:") ? vertex.id.slice("outcome:".length) : null;
          const isOutcome = Boolean(outcomeKey && value.outcome === outcomeKey);
          return <div key={vertex.id} className={`tree-node-enter absolute flex flex-col justify-center rounded border px-4 ${isCurrent ? "tree-node-active border-[#7259B5] bg-white shadow-[0_10px_35px_rgba(74,54,126,.14)]" : isAnswered || isOutcome ? "border-[#2E8932]/30 bg-[#F7FBF7]" : vertex.kind === "outcome" ? "border-black/[.08] bg-[#F1F1EF]" : "border-black/[.09] bg-white/95"}`} style={{ left: vertex.x, top: vertex.y, width: NODE_W, height: NODE_H, animationDelay: `${Math.min(index * 35, 350)}ms` }}>
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[8px] font-semibold ${isAnswered || isOutcome ? "border-[#2E8932]/20 bg-[#2E8932] text-white" : isCurrent ? "border-[#7259B5]/25 bg-[#7259B5] text-white" : "border-black/[.08] bg-black/[.025] text-black/25"}`}>{isAnswered || isOutcome ? <Check size={10}/> : vertex.kind === "outcome" ? "◆" : index + 1}</span>
              <div className="min-w-0"><p className="text-[9px] font-medium uppercase tracking-[.08em] text-black/25">{vertex.kind === "outcome" ? "Diagnóstico" : isCurrent ? "Pergunta atual" : "Decisão"}</p><p className="mt-1 text-[11px] font-semibold leading-snug text-black/65">{vertex.title}</p></div>
            </div>
          </div>;
        })}
      </div>
    </main>

    <footer className="pointer-events-none absolute inset-x-0 bottom-4 z-20 px-4 md:bottom-5">
      <div className="pointer-events-auto mx-auto w-full max-w-[680px] rounded border border-black/[.1] bg-white p-3 shadow-[0_18px_55px_rgba(13,13,13,.16)]">
        {value.outcome ? <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#2E8932]/10 text-[#2E8932]"><Check size={14}/></span>
            <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#2E8932]/60">Diagnóstico</p><p className="truncate text-[14px] font-semibold text-black/75">{OUTCOME_LABELS[value.outcome]}</p></div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded border border-black/[.09] bg-white px-3 py-2 text-[10px] font-medium text-black/45 hover:bg-black/[.035]"><RotateCcw size={11}/>Refazer</button>
            <button type="button" onClick={onClose} className="rounded bg-[#2E8932] px-3.5 py-2 text-[10px] font-semibold text-white hover:bg-[#26752A]">Concluir avaliação</button>
          </div>
        </div> : current ? <div className="flex items-end gap-2.5">
          <button type="button" onClick={reset} aria-label="Voltar ao início" className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/25 hover:bg-black/[.04] hover:text-black/50"><ArrowLeft size={13}/></button>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[12px] font-semibold leading-snug text-black/70">{current.title}</p>
            <div className="flex flex-wrap gap-1.5">{current.options.map(option => <button key={option.id} type="button" onClick={() => answer(option.id)} className="rounded border border-black/[.1] bg-white px-3 py-2 text-[10px] font-medium text-black/55 transition hover:border-black/20 hover:bg-black/[.035] hover:text-black/75">{option.label}</button>)}</div>
          </div>
        </div> : <div className="flex items-center justify-between gap-3"><p className="text-[12px] text-black/40">A árvore não possui uma etapa inicial.</p><button type="button" onClick={onClose} className="rounded bg-[#2E8932] px-3.5 py-2 text-[10px] font-semibold text-white hover:bg-[#26752A]">Fechar</button></div>}
      </div>
    </footer>

    <style jsx>{`
      @keyframes treeNodeEnter { from { opacity: 0; transform: translateY(7px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes treeEdgeEnter { from { opacity: 0; } to { opacity: 1; } }
      @keyframes treeEdgeFlow { to { stroke-dashoffset: -24; } }
      @keyframes treeNodePulse { 0%, 100% { box-shadow: 0 10px 35px rgba(74,54,126,.14); } 50% { box-shadow: 0 10px 42px rgba(74,54,126,.23); } }
      .tree-node-enter { opacity: 0; animation: treeNodeEnter .38s cubic-bezier(.2,.8,.2,1) forwards; }
      .tree-edge-enter { animation: treeEdgeEnter .45s ease both; }
      .tree-edge-active { animation: treeEdgeFlow 1.1s linear infinite; }
      .tree-node-active { animation: treeNodeEnter .38s cubic-bezier(.2,.8,.2,1) forwards, treeNodePulse 2.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .tree-node-enter, .tree-edge-enter, .tree-edge-active, .tree-node-active { animation: none !important; opacity: 1; } }
    `}</style>
  </div>;
}

export type { EvaluationState as RenewalEvaluationState };
