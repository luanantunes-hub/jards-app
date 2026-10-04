"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck, ArrowUpRight, CalendarDays, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoContas, StatusPrestacao } from "@/lib/supabase/types";
import { NovaPrestacaoModal } from "@/components/modals/NovaPrestacaoModal";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { organizacaoDaPrestacao } from "@/lib/prestacao/armazenamento";
import { percentualExecutado, totalExecutado, type ComprovanteParaExecucao } from "@/lib/prestacao/execucao";
import { LIST_HEADER_CELL, ListContent, ListEmptyState, ListPageHeader, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";

type PrestacaoRow = PrestacaoContas & {
  organization_id?: string | null;
  captacao: { titulo: string | null; lei: string | null; organization_id: string | null } | null;
  projeto: { nome: string; organization_id: string | null } | null;
  executado: number;
};

const STATUS_META: Record<StatusPrestacao, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  rascunho:         { label: "Rascunho",          color: "rgba(13,13,13,.45)", bg: "rgba(13,13,13,.06)",  icon: <Clock size={11} /> },
  revisao_interna:  { label: "Revisão interna",   color: "#2D72B0",            bg: "#2D72B010",            icon: <Clock size={11} /> },
  enviado:          { label: "Enviado",            color: "#B07A14",            bg: "#B07A1410",            icon: <ArrowUpRight size={11} /> },
  ajuste_solicitado:{ label: "Ajuste solicitado", color: "#D94E4E",            bg: "#D94E4E10",            icon: <AlertCircle size={11} /> },
  aprovado:         { label: "Aprovado",           color: "#2E8932",            bg: "#2E893210",            icon: <CheckCircle2 size={11} /> },
  arquivado:        { label: "Arquivado",          color: "rgba(13,13,13,.35)", bg: "rgba(13,13,13,.05)",  icon: <CheckCircle2 size={11} /> },
};

const fmt = (v: number | null) => {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v}`;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PrestacoesList() {
  const router = useRouter();
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const [prestacoes, setPrestacoes] = useState<PrestacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusPrestacao | "todos">("todos");

  const fetch = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("prestacoes_contas")
      .select("*, captacao:captacao_id(titulo, lei, organization_id), projeto:projeto_id(nome, organization_id)")
      .order("created_at", { ascending: false });
    // O acesso vale para todas as organizações da pessoa; a lista mostra só a atual.
    // Prestação sem organização conhecida só é visível para quem criou e continua na lista.
    const daOrganizacao = ((data ?? []) as Omit<PrestacaoRow, "executado">[]).filter(p => {
      const org = organizacaoDaPrestacao(p);
      return org === null || org === organizationId;
    });

    // Executado provisório: soma dos comprovantes aceitos (valor_realizado nunca foi calculado no banco).
    const ids = daOrganizacao.map(p => p.id);
    const { data: comps } = ids.length > 0
      ? await (supabase as any)
          .from("prestacao_comprovantes")
          .select("prestacao_id, item_id, status, valor_extraido")
          .eq("status", "aceito")
          .in("prestacao_id", ids)
      : { data: [] };
    const porPrestacao = new Map<string, ComprovanteParaExecucao[]>();
    for (const c of (comps ?? []) as (ComprovanteParaExecucao & { prestacao_id: string })[]) {
      porPrestacao.set(c.prestacao_id, [...(porPrestacao.get(c.prestacao_id) ?? []), c]);
    }

    setPrestacoes(daOrganizacao.map(p => ({ ...p, executado: totalExecutado(porPrestacao.get(p.id) ?? []) })));
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtradas = filtroStatus === "todos"
    ? prestacoes
    : prestacoes.filter(p => p.status === filtroStatus);

  const contadores = Object.fromEntries(
    (Object.keys(STATUS_META) as StatusPrestacao[]).map(s => [s, prestacoes.filter(p => p.status === s).length])
  ) as Record<StatusPrestacao, number>;

  const hasFilter = filtroStatus !== "todos";

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader
        eyebrow="Prestação de contas"
        title="Prestações"
        summary={!loading && <ListSummary strong={prestacoes.length}>{prestacoes.length === 1 ? "prestação" : "prestações"}</ListSummary>}
        actions={<PrimaryListAction onClick={() => setShowNova(true)}><Plus size={13} aria-hidden="true" />Nova prestação</PrimaryListAction>}
      />

      <ListToolbar>
        <div role="group" aria-label="Filtrar por status" className="flex gap-2">
          <button
            type="button"
            aria-pressed={filtroStatus === "todos"}
            onClick={() => setFiltroStatus("todos")}
            className={`h-9 shrink-0 rounded border px-3 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
              filtroStatus === "todos"
                ? "border-[#7259B5]/40 bg-white text-[#7259B5]"
                : "border-black/[.08] bg-white text-black/45 hover:bg-black/[.03]"
            }`}
          >
            Todas <span className="tabular-nums">({prestacoes.length})</span>
          </button>
          {(Object.entries(STATUS_META) as [StatusPrestacao, typeof STATUS_META[StatusPrestacao]][]).map(([s, meta]) => (
            <button
              key={s}
              type="button"
              aria-pressed={filtroStatus === s}
              onClick={() => setFiltroStatus(s)}
              className="h-9 shrink-0 rounded border bg-white px-3 text-[0.75rem] font-medium transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              style={{
                borderColor: filtroStatus === s ? meta.color : "rgba(13,13,13,.08)",
                color: filtroStatus === s ? meta.color : "rgba(13,13,13,.45)",
              }}
            >
              {meta.label} {contadores[s] > 0 && <span className="tabular-nums">({contadores[s]})</span>}
            </button>
          ))}
        </div>
      </ListToolbar>

      <ListContent>
        <ListTableSurface>
          {!loading && filtradas.length === 0 ? (
            <ListEmptyState
              icon={ClipboardCheck}
              title={hasFilter ? "Nenhuma prestação com este status" : "Nenhuma prestação cadastrada"}
              description={hasFilter ? undefined : "Crie uma prestação vinculando-a a uma negociação aprovada."}
              filtered={hasFilter}
              onClearFilters={() => setFiltroStatus("todos")}
              action={hasFilter ? undefined : <PrimaryListAction onClick={() => setShowNova(true)}><Plus size={13} aria-hidden="true" />Nova prestação</PrimaryListAction>}
            />
          ) : (
          <table className="w-full min-w-[47.5rem] text-sm">
            <thead>
              <tr style={{ background: "#F9F9F8" }}>
                {["Título", "Negociação", "Status", "Prazo", "Aprovado", "Realizado"].map(col => (
                  <th
                    key={col}
                    className={`px-4 py-3 text-left ${LIST_HEADER_CELL} border-b`}
                    style={{ borderColor: "rgba(13,13,13,.07)" }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                  <td colSpan={6} className="px-4 py-4"><div className="h-3.5 w-2/3 animate-pulse rounded bg-black/[.06]" /></td>
                </tr>
              )) : filtradas.map((p, i) => {
                const meta = STATUS_META[p.status];
                const pct = percentualExecutado(p.executado, p.valor_aprovado ?? 0);
                const vencida = p.prazo && new Date(p.prazo) < new Date() && p.status !== "aprovado" && p.status !== "arquivado";
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/prestacoes/${p.id}`)}
                    className="cursor-pointer hover:bg-black/[.025] transition"
                    style={{ borderBottom: i < filtradas.length - 1 ? "1px solid rgba(13,13,13,.05)" : undefined }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/prestacoes/${p.id}`} onClick={event => event.stopPropagation()} className="text-[0.8125rem] font-semibold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{p.titulo}</Link>
                      {p.projeto && <p className="text-[0.625rem] text-black/35 mt-0.5">{p.projeto.nome}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.captacao ? (
                        <p className="text-[0.6875rem] text-black/55">{p.captacao.titulo ?? "—"}</p>
                      ) : (
                        <span className="text-[0.6875rem] text-black/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
                        style={{ borderColor: meta.color.startsWith("#") ? meta.color + "47" : "rgba(13,13,13,.12)", color: meta.color }}
                      >
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`whitespace-nowrap text-[0.6875rem] font-medium tabular-nums ${vencida ? "text-[#D94E4E]" : "text-black/55"}`}>
                        {fmtDate(p.prazo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[0.75rem] tabular-nums text-black/55">
                      {fmt(p.valor_aprovado)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.75rem] font-medium tabular-nums text-black/55">{fmt(p.executado)}</span>
                        {pct !== null && (
                          <span className="text-[0.625rem] font-semibold tabular-nums" style={{
                            color: pct >= 90 ? "#2E8932" : pct >= 50 ? "#B07A14" : "rgba(13,13,13,.35)"
                          }}>
                            {pct}%
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </ListTableSurface>
      </ListContent>

      {showNova && (
        <NovaPrestacaoModal
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); fetch(); }}
        />
      )}
    </div>
  );
}
