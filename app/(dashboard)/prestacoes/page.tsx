"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck, ArrowUpRight, CalendarDays, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoContas, StatusPrestacao } from "@/lib/supabase/types";
import { NovaPrestacaoModal } from "@/components/modals/NovaPrestacaoModal";

type PrestacaoRow = PrestacaoContas & {
  captacao: { titulo: string | null; lei: string | null } | null;
  projeto: { nome: string } | null;
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
  const [prestacoes, setPrestacoes] = useState<PrestacaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusPrestacao | "todos">("todos");

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("prestacoes_contas")
      .select("*, captacao:captacao_id(titulo, lei), projeto:projeto_id(nome)")
      .order("created_at", { ascending: false });
    setPrestacoes((data as PrestacaoRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtradas = filtroStatus === "todos"
    ? prestacoes
    : prestacoes.filter(p => p.status === filtroStatus);

  const contadores = Object.fromEntries(
    (Object.keys(STATUS_META) as StatusPrestacao[]).map(s => [s, prestacoes.filter(p => p.status === s).length])
  ) as Record<StatusPrestacao, number>;

  return (
    <div className="px-8 py-8 min-h-full" style={{ background: "#F2F2F2" }}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-bold text-[#0D0D0D] text-[28px]">Prestação de contas</h1>
          <p className="text-sm text-black/40 mt-1">
            {prestacoes.length} {prestacoes.length === 1 ? "prestação" : "prestações"}
          </p>
        </div>
        <button
          onClick={() => setShowNova(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded text-[13px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7259B5" }}
        >
          <Plus size={15} />
          Nova prestação
        </button>
      </div>

      {/* Filtros por status */}
      <div className="flex gap-2 flex-wrap mb-5">
        <button
          onClick={() => setFiltroStatus("todos")}
          className={`px-3 py-1.5 rounded text-[11px] font-semibold border transition ${
            filtroStatus === "todos"
              ? "bg-white border-black/20 text-black"
              : "bg-white border-black/[.08] text-black/40 hover:bg-black/[.03]"
          }`}
        >
          Todas ({prestacoes.length})
        </button>
        {(Object.entries(STATUS_META) as [StatusPrestacao, typeof STATUS_META[StatusPrestacao]][]).map(([s, meta]) => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className="px-3 py-1.5 rounded text-[11px] font-semibold border transition bg-white"
            style={{
              borderColor: filtroStatus === s ? meta.color : "rgba(13,13,13,.08)",
              color: filtroStatus === s ? meta.color : "rgba(13,13,13,.40)",
            }}
          >
            {meta.label} {contadores[s] > 0 && `(${contadores[s]})`}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-black/10 border-t-[#7259B5] rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardCheck size={28} className="text-black/10 mb-3" />
            <p className="text-[13px] font-medium text-black/40">
              {filtroStatus === "todos" ? "Nenhuma prestação cadastrada" : "Nenhuma prestação com este status"}
            </p>
            {filtroStatus === "todos" && (
              <p className="text-[11px] text-black/25 mt-1">Crie uma prestação vinculando a uma captação aprovada</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F9F9F8" }}>
                {["Título", "Captação", "Status", "Prazo", "Aprovado", "Realizado"].map(col => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-black/35 border-b"
                    style={{ borderColor: "rgba(13,13,13,.07)" }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((p, i) => {
                const meta = STATUS_META[p.status];
                const pct = p.valor_aprovado && p.valor_aprovado > 0
                  ? Math.round((p.valor_realizado / p.valor_aprovado) * 100)
                  : null;
                const vencida = p.prazo && new Date(p.prazo) < new Date() && p.status !== "aprovado" && p.status !== "arquivado";
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/prestacoes/${p.id}`)}
                    className="cursor-pointer hover:bg-black/[.025] transition"
                    style={{ borderBottom: i < filtradas.length - 1 ? "1px solid rgba(13,13,13,.05)" : undefined }}
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-black">{p.titulo}</p>
                      {p.projeto && <p className="text-[10px] text-black/35 mt-0.5">{p.projeto.nome}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.captacao ? (
                        <p className="text-[11px] text-black/55">{p.captacao.titulo ?? "—"}</p>
                      ) : (
                        <span className="text-[11px] text-black/25">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium ${vencida ? "text-[#D94E4E]" : "text-black/55"}`}>
                        {fmtDate(p.prazo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-variant-numeric text-[12px] text-black/55">
                      {fmt(p.valor_aprovado)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-black/55 font-medium">{fmt(p.valor_realizado)}</span>
                        {pct !== null && (
                          <span className="text-[10px] font-semibold" style={{
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
      </div>

      {showNova && (
        <NovaPrestacaoModal
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); fetch(); }}
        />
      )}
    </div>
  );
}
