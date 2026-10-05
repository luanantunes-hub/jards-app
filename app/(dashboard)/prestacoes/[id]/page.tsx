"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import type { PrestacaoContas, StatusPrestacao, PrestacaoItem } from "@/lib/supabase/types";
import { executadoPorItem, percentualExecutado, totalExecutado, type ComprovanteParaExecucao } from "@/lib/prestacao/execucao";
import { mensagemErroPrestacao, proximosBloqueados, proximosStatus } from "@/lib/prestacao/status";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";

type PrestacaoDetalhe = PrestacaoContas & {
  captacao: { id: string; titulo: string | null; lei: string | null; valor_solicitado: number | null } | null;
  projeto: { id: string; nome: string } | null;
};

type LogEntry = {
  id: string;
  status_anterior: StatusPrestacao | null;
  status_novo: StatusPrestacao;
  comentario: string | null;
  created_at: string;
};

const STATUS_ORDER: StatusPrestacao[] = [
  "rascunho", "revisao_interna", "enviado", "ajuste_solicitado", "aprovado", "arquivado",
];

const STATUS_META: Record<StatusPrestacao, { label: string; color: string; bg: string }> = {
  rascunho:         { label: "Rascunho",          color: "rgba(13,13,13,.45)", bg: "rgba(13,13,13,.06)"  },
  revisao_interna:  { label: "Revisão interna",   color: "#2D72B0",            bg: "#2D72B010"            },
  enviado:          { label: "Enviado",            color: "#B07A14",            bg: "#B07A1410"            },
  ajuste_solicitado:{ label: "Ajuste solicitado", color: "#D94E4E",            bg: "#D94E4E10"            },
  aprovado:         { label: "Aprovado",           color: "#2E8932",            bg: "#2E893210"            },
  arquivado:        { label: "Arquivado",          color: "rgba(13,13,13,.35)", bg: "rgba(13,13,13,.05)"  },
};

const fmt = (v: number | null) => {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v}`;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function PrestacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [prestacao, setPrestacao] = useState<PrestacaoDetalhe | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [itens, setItens] = useState<PrestacaoItem[]>([]);
  const [atividadesCount, setAtividadesCount] = useState(0);
  const [comprovantes, setComprovantes] = useState<ComprovanteParaExecucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [avancarOpen, setAvancarOpen] = useState(false);
  const avancarBoxRef = useRef<HTMLDivElement>(null);
  const [avancarMenuPos, setAvancarMenuPos] = useState<{ right: number; top: number } | null>(null);
  useEffect(() => {
    if (!avancarOpen) { setAvancarMenuPos(null); return; }
    const update = () => {
      const rect = avancarBoxRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAvancarMenuPos({ right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [avancarOpen]);
  const [rubricsOpen, setRubricsOpen] = useState(false);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const permissoes = usePermissoesPrestacao(id);

  const fetch = useCallback(async () => {
    const [
      { data },
      { data: logData },
      { data: itensData },
      { count: atCount },
      { data: compData },
    ] = await Promise.all([
      (supabase as any)
        .from("prestacoes_contas")
        .select("*, captacao:captacao_id(id, titulo, lei, valor_solicitado), projeto:projeto_id(id, nome)")
        .eq("id", id)
        .maybeSingle(),
      (supabase as any)
        .from("prestacao_status_log")
        .select("*")
        .eq("prestacao_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("prestacao_itens")
        .select("*")
        .eq("prestacao_id", id)
        .order("ordem"),
      (supabase as any)
        .from("prestacao_atividades")
        .select("*", { count: "exact", head: true })
        .eq("prestacao_id", id),
      (supabase as any)
        .from("prestacao_comprovantes")
        .select("item_id, status, valor_extraido")
        .eq("prestacao_id", id),
    ]);

    setPrestacao(data as PrestacaoDetalhe);
    setLog((logData as LogEntry[]) ?? []);
    setItens((itensData as PrestacaoItem[]) ?? []);

    setAtividadesCount(atCount ?? 0);
    setComprovantes((compData as ComprovanteParaExecucao[]) ?? []);

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  async function avancar(novoStatus: StatusPrestacao) {
    if (!prestacao) return;
    setSaving(true);
    setErro("");
    // Status e histórico mudam juntos, numa função do banco que confere a
    // transição e o papel (P0.10).
    const { error } = await (supabase as any).rpc("fn_prestacao_mudar_status", {
      p_prestacao_id: id,
      p_novo_status: novoStatus,
      p_comentario: comentario.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErro(mensagemErroPrestacao(error, "Não foi possível mudar o status"));
      return;
    }
    setComentario("");
    setAvancarOpen(false);
    fetch();
  }

  async function salvarPeriodo(campo: "data_inicio_execucao" | "data_fim_execucao", valor: string) {
    setErro("");
    const { error } = await (supabase as any).from("prestacoes_contas").update({ [campo]: valor || null }).eq("id", id);
    if (error) setErro(`Não foi possível salvar o período de execução: ${error.message}`);
  }

  if (loading) return <DetailPageSkeleton />;

  if (!prestacao) {
    return <DetailNotFound title="Prestação não encontrada" description="Ela pode ter sido removida ou você não tem acesso a ela." backHref="/prestacoes" backLabel="Prestações" />;
  }

  const meta = STATUS_META[prestacao.status];
  const proximos = proximosStatus(prestacao.status, permissoes);
  const bloqueados = proximosBloqueados(prestacao.status, permissoes);

  // Totais de comprovação financeira: soma dos comprovantes aceitos
  const totalAprovado = itens.length > 0
    ? itens.reduce((s, i) => s + i.valor_aprovado, 0)
    : (prestacao.valor_aprovado ?? 0);
  const totalComprovado = totalExecutado(comprovantes);
  const executadoItem = executadoPorItem(comprovantes);
  const totalAComprovar = totalAprovado - totalComprovado;
  const pct = percentualExecutado(totalComprovado, totalAprovado) ?? 0;

  // Alerta de prazo (60 dias após data_fim_execucao, ou campo prazo)
  const vencida = prestacao.prazo && new Date(prestacao.prazo) < new Date()
    && prestacao.status !== "aprovado" && prestacao.status !== "arquivado";

  // Dias restantes até o prazo
  const diasRestantes = (() => {
    if (!prestacao.prazo) return null;
    const diff = Math.ceil((new Date(prestacao.prazo).getTime() - Date.now()) / 86400000);
    return diff;
  })();
  const prazoAlerta = diasRestantes !== null && diasRestantes <= 15 && diasRestantes >= 0
    && prestacao.status !== "aprovado" && prestacao.status !== "arquivado";

  return (
    <div className="px-8 py-6">
      {/* Avançar status */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-[0.6875rem] text-black/40">
          {prestacao.captacao && <span>Negociação: {prestacao.captacao.titulo ?? "—"}</span>}
          {prestacao.projeto && <span className="ml-2">· Projeto: {prestacao.projeto.nome}</span>}
        </div>

        {proximos.length > 0 && (
          <div className="relative flex-shrink-0" ref={avancarBoxRef}>
            <button
              onClick={() => setAvancarOpen(!avancarOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded text-[0.8125rem] font-semibold text-white transition hover:opacity-90"
              style={{ background: "#7259B5" }}
            >
              Avançar status <ChevronDown size={13} />
            </button>

            {avancarOpen && avancarMenuPos && createPortal(
              <div
                className="fixed bg-white rounded border shadow-lg z-20"
                style={{ right: avancarMenuPos.right, top: avancarMenuPos.top, borderColor: "rgba(13,13,13,.10)", minWidth: "15rem" }}
              >
                <div className="p-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <textarea
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    placeholder="Comentário"
                    rows={2}
                    className="w-full text-[0.6875rem] border rounded px-2.5 py-2 resize-none focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                {proximos.map(s => (
                  <button
                    key={s}
                    onClick={() => avancar(s)}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-[0.75rem] font-medium hover:bg-black/[.03] transition border-b last:border-0"
                    style={{ borderColor: "rgba(13,13,13,.05)" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: STATUS_META[s].color }}
                    />
                    {STATUS_META[s].label}
                  </button>
                ))}
                {bloqueados.map(s => (
                  <div
                    key={s}
                    className="flex items-start gap-2 px-4 py-3 text-[0.75rem] text-black/35 border-b last:border-0"
                    style={{ borderColor: "rgba(13,13,13,.05)" }}
                  >
                    <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-black/15" />
                    <span>
                      {STATUS_META[s].label}
                      <span className="block text-[0.625rem]">Cabe ao administrador ou ao responsável pela prestação.</span>
                    </span>
                  </div>
                ))}
              </div>,
              document.body,
            )}
          </div>
        )}
        {proximos.length === 0 && bloqueados.length > 0 && (
          <p className="max-w-[20rem] text-right text-[0.6875rem] text-black/40">
            Próximo passo: {bloqueados.map(s => STATUS_META[s].label.toLowerCase()).join(" ou ")}. Cabe ao administrador ou ao responsável pela prestação.
          </p>
        )}
      </div>

      {erro && (
        <p role="alert" className="mb-4 px-4 py-3 rounded border text-[0.75rem]"
          style={{ background: "#D94E4E08", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          {erro}
        </p>
      )}

      {/* Alerta de prazo próximo */}
      {prazoAlerta && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded border mb-4 text-[0.75rem]"
          style={{ background: "#B07A1408", borderColor: "#B07A1430", color: "#B07A14" }}>
          <AlertCircle size={13} />
          <span>Prazo em <strong>{diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}</strong> — {fmtDate(prestacao.prazo)}</span>
        </div>
      )}
      {vencida && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded border mb-4 text-[0.75rem]"
          style={{ background: "#D94E4E08", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          <AlertCircle size={13} />
          <span>Prazo vencido em {fmtDate(prestacao.prazo)} — regularize o envio o quanto antes.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Coluna principal */}
        <div className="col-span-2 space-y-4">

          {/* Painel de comprovação financeira */}
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <p className="text-[0.6875rem] font-semibold text-black/50 mb-3">Comprovação financeira</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30 mb-1">Aprovado</p>
                  <p className="text-[1.0625rem] font-bold text-black/80">{fmt(totalAprovado)}</p>
                </div>
                <div>
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-wide mb-1" style={{ color: "#2E893280" }}>Comprovado</p>
                  <p className="text-[1.0625rem] font-bold" style={{ color: pct >= 90 ? "#2E8932" : pct >= 50 ? "#B07A14" : "#7259B5" }}>
                    {fmt(totalComprovado)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30 mb-1">A comprovar</p>
                  <p className="text-[1.0625rem] font-bold" style={{ color: totalAComprovar > 0 ? "#D94E4E" : "#2E8932" }}>
                    {totalAComprovar > 0 ? fmt(totalAComprovar) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[0.625rem] text-black/35">Percentual comprovado</p>
                <span className="text-[0.6875rem] font-bold tabular-nums" style={{
                  color: pct >= 90 ? "#2E8932" : pct >= 50 ? "#B07A14" : "rgba(13,13,13,.4)"
                }}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(13,13,13,.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct >= 90 ? "#2E8932" : pct >= 50 ? "#B07A14" : "#7259B5",
                  }}
                />
              </div>
            </div>

            {/* Breakdown por rubrica */}
            {itens.length > 0 && (
              <div>
                <button
                  onClick={() => setRubricsOpen(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-black/[.015] transition"
                >
                  <span className="text-[0.625rem] font-semibold text-black/40">Por rubrica</span>
                  <ChevronRight size={12} className="text-black/30 transition-transform" style={{ transform: rubricsOpen ? "rotate(90deg)" : "none" }} />
                </button>

                {rubricsOpen && (
                  <div className="border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    {itens.map(item => {
                      const itemExecutado = executadoItem.get(item.id) ?? 0;
                      const itemPct = percentualExecutado(itemExecutado, item.valor_aprovado) ?? 0;
                      return (
                        <div key={item.id} className="px-5 py-3 border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[0.6875rem] font-medium text-black/70 truncate">{item.rubrica}</p>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              <span className="text-[0.625rem] text-black/35 tabular-nums">{fmt(itemExecutado)} / {fmt(item.valor_aprovado)}</span>
                              <span className="text-[0.625rem] font-semibold tabular-nums" style={{
                                color: itemPct >= 90 ? "#2E8932" : itemPct >= 50 ? "#B07A14" : "rgba(13,13,13,.35)"
                              }}>{itemPct}%</span>
                            </div>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(13,13,13,.06)" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(itemPct, 100)}%`,
                                background: itemPct >= 90 ? "#2E8932" : itemPct >= 50 ? "#B07A14" : "#7259B5",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prazo */}
          <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-2">Prazo de envio</p>
            <p className="text-[0.9375rem] font-bold" style={{ color: vencida ? "#D94E4E" : "rgba(13,13,13,.75)" }}>
              {fmtDate(prestacao.prazo)}
            </p>
            {diasRestantes !== null && !vencida && (
              <p className="text-[0.625rem] mt-1" style={{ color: diasRestantes <= 15 ? "#B07A14" : "rgba(13,13,13,.30)" }}>
                {diasRestantes > 0 ? `${diasRestantes} dias restantes` : "Vence hoje"}
              </p>
            )}
            {prestacao.captacao && (
              <p className="text-[0.625rem] text-black/30 mt-0.5">Negociação: {prestacao.captacao.titulo ?? "—"}</p>
            )}
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30 mb-2">Período de execução</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[0.5625rem] text-black/30 mb-1">Início</p>
                  <input
                    type="date"
                    defaultValue={prestacao.data_inicio_execucao ?? ""}
                    onBlur={e => salvarPeriodo("data_inicio_execucao", e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-[0.6875rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <p className="text-[0.5625rem] text-black/30 mb-1">Fim</p>
                  <input
                    type="date"
                    defaultValue={prestacao.data_fim_execucao ?? ""}
                    onBlur={e => salvarPeriodo("data_fim_execucao", e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-[0.6875rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Observações */}
          {prestacao.observacoes && (
            <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-2">Observações</p>
              <p className="text-[0.8125rem] text-black/65 leading-relaxed">{prestacao.observacoes}</p>
            </div>
          )}

        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">

          {/* Info do status */}
          <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-3">Status atual</p>
            <div className="flex items-center gap-2">
              {STATUS_ORDER.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: s === prestacao.status
                        ? STATUS_META[s].color
                        : STATUS_ORDER.indexOf(prestacao.status) > i
                        ? "#2E8932"
                        : "rgba(13,13,13,.12)",
                    }}
                  />
                  {i < STATUS_ORDER.length - 1 && (
                    <div className="w-3 h-px" style={{ background: "rgba(13,13,13,.10)" }} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-[0.6875rem] font-semibold mt-2" style={{ color: meta.color }}>{meta.label}</p>
          </div>

          {/* Checklist de prontidão */}
          <div className="bg-white rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.6875rem] font-semibold text-black/50">Prontidão para envio</p>
            </div>
            <div className="p-4 space-y-2.5">
              {[
                {
                  label: "Atividades cadastradas",
                  ok: atividadesCount > 0,
                  detail: atividadesCount > 0 ? `${atividadesCount} atividade${atividadesCount > 1 ? "s" : ""}` : "Nenhuma cadastrada",
                },
                {
                  label: "Comprovantes enviados",
                  ok: comprovantes.length > 0,
                  detail: comprovantes.length > 0 ? `${comprovantes.length} comprovante${comprovantes.length > 1 ? "s" : ""}` : "Nenhum enviado",
                },
                {
                  label: "Orçamento em comprovação",
                  ok: pct >= 50,
                  detail: `${pct}% comprovado`,
                },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                    style={{ background: item.ok ? "#2E8932" : "#D94E4E" }}
                  />
                  <div>
                    <p className="text-[0.6875rem] font-medium text-black/70">{item.label}</p>
                    <p className="text-[0.625rem]" style={{ color: item.ok ? "#2E8932" : "#D94E4E" }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico */}
          <div className="bg-white rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.6875rem] font-semibold text-black/50">Histórico</p>
            </div>
            <div className="p-4">
              {log.length === 0 ? (
                <p className="text-[0.6875rem] text-black/25 text-center py-4">Nenhuma movimentação ainda.</p>
              ) : (
                <div className="space-y-3">
                  {log.map(entry => (
                    <div key={entry.id} className="flex gap-2.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                        style={{ background: STATUS_META[entry.status_novo].color }}
                      />
                      <div>
                        <p className="text-[0.6875rem] font-medium text-black/70">
                          → {STATUS_META[entry.status_novo].label}
                        </p>
                        {entry.comentario && (
                          <p className="text-[0.625rem] text-black/40 mt-0.5 italic">"{entry.comentario}"</p>
                        )}
                        <p className="text-[0.5625rem] text-black/25 mt-0.5">
                          {new Date(entry.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white rounded border p-4 space-y-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35">Informações</p>
            <div>
              <p className="text-[0.5625rem] text-black/30 mb-0.5">Criada em</p>
              <p className="text-[0.6875rem] text-black/60">{fmtDate(prestacao.created_at.split("T")[0])}</p>
            </div>
            <div>
              <p className="text-[0.5625rem] text-black/30 mb-0.5">Atualizada em</p>
              <p className="text-[0.6875rem] text-black/60">{fmtDate(prestacao.updated_at.split("T")[0])}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fechar dropdown ao clicar fora */}
      {avancarOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setAvancarOpen(false)} />
      )}
    </div>
  );
}
