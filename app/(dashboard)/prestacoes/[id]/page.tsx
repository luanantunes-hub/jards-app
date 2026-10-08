"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import type { PrestacaoContas, StatusPrestacao } from "@/lib/supabase/types";
import { useItensDoOrcamento } from "@/hooks/useItensDoOrcamento";
import { executadoPorItem, percentualExecutado, totalExecutado, type ComprovanteParaExecucao } from "@/lib/prestacao/execucao";
import { mensagemErroPrestacao, proximosBloqueados, proximosStatus } from "@/lib/prestacao/status";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { PrazoPrestacao } from "@/components/prestacao/PrazoPrestacao";
import { RegimeDadosOficiais } from "@/components/prestacao/RegimeDadosOficiais";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { avaliarProntidao, prazosDaPrestacao } from "@/lib/prestacao/prontidao";
import { coberturaDaMeta } from "@/lib/prestacao/objeto";
import { ProntidaoPrestacao } from "@/components/prestacao/ProntidaoPrestacao";
import { VerificacoesPrestacao } from "@/components/prestacao/VerificacoesPrestacao";
import { EVENTO_VERIFICADA, pedirVerificacao, verificarAgora } from "@/lib/prestacao/verificar-cliente";
import { MarcosDaPrestacao, ProximosPrazos } from "@/components/prestacao/PrazosEMarcos";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { checklistDeEnvio } from "@/lib/prestacao/envio";
import { ResponsavelDaPrestacao } from "@/components/prestacao/ResponsavelDaPrestacao";
import { LinksDoPatrocinador } from "@/components/prestacao/LinksDoPatrocinador";

type PrestacaoDetalhe = PrestacaoContas & {
  captacao: { id: string; titulo: string | null; lei: string | null; valor_solicitado: number | null } | null;
  projeto: { id: string; nome: string } | null;
  proponente: { id: string; nome: string } | null;
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
  revisao_interna:  { label: "Revisão interna",   color: "#2D72B0",            bg: "#fff"            },
  enviado:          { label: "Enviado",            color: "#B07A14",            bg: "#fff"            },
  ajuste_solicitado:{ label: "Ajuste solicitado", color: "#D94E4E",            bg: "#fff"            },
  aprovado:         { label: "Aprovado",           color: "#2E8932",            bg: "#fff"            },
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
  // Itens da versão em uso do orçamento em árvore (P1.6).
  const { itens } = useItensDoOrcamento(id);
  const [atividadesCount, setAtividadesCount] = useState(0);
  const [comprovantes, setComprovantes] = useState<ComprovanteParaExecucao[]>([]);
  const [alteracoesAguardando, setAlteracoesAguardando] = useState<{ numero: number; solicitada_em: string | null }[]>([]);
  // Bloqueios abertos nas verificações (null até a primeira leitura).
  const [bloqueiosAbertos, setBloqueiosAbertos] = useState<number | null>(null);
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
  // P3.3: metas do objeto e quantas estão comprovadas por evidência.
  const [objeto, setObjeto] = useState<{ metas: number; comprovadas: number } | undefined>(undefined);
  const permissoes = usePermissoesPrestacao(id);
  const regimes = useRegimesPublicados();
  // Checklist de envio da etapa final (P4.1), para a prontidão.
  const { dados: dadosDoEnvio } = useDadosDoEnvio(id);
  const resumoDoEnvio = useMemo(() => {
    if (!dadosDoEnvio) return undefined;
    const checklist = checklistDeEnvio({ ...dadosDoEnvio, etapa: "final" });
    return checklist.semChecklist ? undefined : checklist.resumo;
  }, [dadosDoEnvio]);

  const fetch = useCallback(async () => {
    const [
      { data },
      { data: logData },
      { count: atCount },
      { data: compData },
      { data: alteracoesData },
      { count: bloqueiosCount },
      { data: metasData },
      { data: atividadesData },
      { data: evidenciasData },
    ] = await Promise.all([
      (supabase as any)
        .from("prestacoes_contas")
        .select("*, captacao:captacao_id(id, titulo, lei, valor_solicitado), projeto:projeto_id(id, nome), proponente:proponente_id(id, nome)")
        .eq("id", id)
        .maybeSingle(),
      (supabase as any)
        .from("prestacao_status_log")
        .select("*")
        .eq("prestacao_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("prestacao_atividades")
        .select("*", { count: "exact", head: true })
        .eq("prestacao_id", id),
      (supabase as any)
        .from("prestacao_comprovantes")
        .select("no_id, status, valor_extraido")
        .eq("prestacao_id", id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_alteracoes ainda não está no tipo Database
      (supabase as any)
        .from("prestacao_alteracoes")
        .select("numero, solicitada_em")
        .eq("prestacao_id", id)
        .eq("status", "solicitada"),
      // Bloqueios abertos nas verificações: impedem o envio.
      (supabase as any)
        .from("prestacao_verificacoes")
        .select("id", { count: "exact", head: true })
        .eq("prestacao_id", id)
        .eq("status", "aberta")
        .eq("severidade", "bloqueio"),
      // Cobertura das metas (P3.3).
      (supabase as any).from("prestacao_metas").select("id").eq("prestacao_id", id),
      (supabase as any).from("prestacao_atividades").select("id, meta_id, status_realizacao").eq("prestacao_id", id),
      (supabase as any).from("prestacao_evidencias").select("atividade_id, meta_id").eq("prestacao_id", id),
    ]);

    setPrestacao(data as PrestacaoDetalhe);
    setLog((logData as LogEntry[]) ?? []);

    setAtividadesCount(atCount ?? 0);
    setComprovantes((compData as ComprovanteParaExecucao[]) ?? []);
    setAlteracoesAguardando(alteracoesData ?? []);
    setBloqueiosAbertos(bloqueiosCount ?? 0);
    const metasLidas = (metasData ?? []) as { id: string }[];
    setObjeto(metasData ? {
      metas: metasLidas.length,
      comprovadas: metasLidas.filter(m => coberturaDaMeta(m, atividadesData ?? [], evidenciasData ?? []).comprovada).length,
    } : undefined);

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  // Cada verificação pode abrir ou fechar bloqueios: a trava do envio acompanha.
  useEffect(() => {
    const aoVerificar = (e: Event) => {
      if ((e as CustomEvent<{ prestacaoId: string }>).detail?.prestacaoId === id) fetch();
    };
    window.addEventListener(EVENTO_VERIFICADA, aoVerificar);
    return () => window.removeEventListener(EVENTO_VERIFICADA, aoVerificar);
  }, [fetch, id]);

  async function avancar(novoStatus: StatusPrestacao) {
    if (!prestacao) return;
    setSaving(true);
    setErro("");
    // Antes de enviar, uma verificação nova: o banco recusa o envio com bloqueio aberto.
    if (novoStatus === "enviado") await verificarAgora(id).catch(() => null);
    // Status e histórico mudam juntos, numa função do banco que confere a
    // transição, o papel (P0.10) e, no envio, os bloqueios.
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

  /** Grava campos da prestação; o banco refaz o prazo final, então recarrega. */
  async function salvarCampos(campos: Record<string, unknown>): Promise<boolean> {
    setErro("");
    const { error } = await (supabase as any).from("prestacoes_contas").update(campos).eq("id", id);
    if (error) {
      setErro(mensagemErroPrestacao(error, "Não foi possível salvar"));
      return false;
    }
    await fetch();
    // Datas e regime mudam as checagens de período, liberação e limites.
    pedirVerificacao(id);
    return true;
  }

  async function salvarPeriodo(campo: "data_inicio_execucao" | "data_fim_execucao", valor: string) {
    if ((prestacao?.[campo] ?? "") === valor) return;
    await salvarCampos({ [campo]: valor || null });
  }

  if (loading) return <DetailPageSkeleton />;

  if (!prestacao) {
    return <DetailNotFound title="Prestação não encontrada" description="Ela pode ter sido removida ou você não tem acesso a ela." backHref="/prestacoes" backLabel="Prestações" />;
  }

  const meta = STATUS_META[prestacao.status];
  // O envio fica travado enquanto houver bloqueio aberto ou nenhuma verificação.
  const envioTravado = bloqueiosAbertos === null ? false : bloqueiosAbertos > 0 || !prestacao.verificada_em;
  const proximos = proximosStatus(prestacao.status, permissoes).filter(s => !(s === "enviado" && envioTravado));
  const travados = proximosStatus(prestacao.status, permissoes).filter(s => s === "enviado" && envioTravado);
  const bloqueados = proximosBloqueados(prestacao.status, permissoes);

  // Totais de comprovação financeira: soma dos comprovantes aceitos
  const totalAprovado = itens.length > 0
    ? itens.reduce((s, i) => s + i.vigente, 0)
    : (prestacao.valor_aprovado ?? 0);
  const totalComprovado = totalExecutado(comprovantes);
  const executadoItem = executadoPorItem(comprovantes);
  const totalAComprovar = totalAprovado - totalComprovado;
  const pct = percentualExecutado(totalComprovado, totalAprovado) ?? 0;

  // Prontidão e prazos (P1.9).
  const regime = regimes.find(r => r.id === prestacao.regime_id)?.regime ?? null;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const prontidao = avaliarProntidao({
    regime,
    identificadorOficial: prestacao.identificador_oficial ?? null,
    prazo: prestacao.prazo,
    itens: itens.map(item => ({ id: item.id, grupo: item.grupo, vigente: item.vigente })),
    comprovantes,
    atividades: atividadesCount,
    objeto,
    alteracoesAguardando: alteracoesAguardando.length,
    verificacoes: bloqueiosAbertos === null ? undefined : { verificada: Boolean(prestacao.verificada_em), bloqueios: bloqueiosAbertos },
    envio: resumoDoEnvio,
  });
  const prazos = prazosDaPrestacao(prestacao, regime, alteracoesAguardando, hoje);

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
    <div className="mx-auto max-w-pagina px-4 py-6 md:px-8">
      {/* Avançar status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[0.6875rem] text-black/40">
          {prestacao.captacao && <span>Negociação: {prestacao.captacao.titulo ?? "—"}</span>}
          {prestacao.projeto && <span className="ml-2">· Projeto: {prestacao.projeto.nome}</span>}
        </div>

        {proximos.length + travados.length > 0 && (
          <div className="relative flex-shrink-0" ref={avancarBoxRef}>
            <button
              onClick={() => setAvancarOpen(!avancarOpen)}
              aria-expanded={avancarOpen}
              className="flex items-center gap-2 rounded bg-[#0D0D0D] px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]"
            >
              Avançar status <ChevronDown size={13} aria-hidden />
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
                {travados.map(s => (
                  <div
                    key={s}
                    className="flex items-start gap-2 px-4 py-3 text-[0.75rem] text-black/45 border-b last:border-0"
                    style={{ borderColor: "rgba(13,13,13,.05)" }}
                  >
                    <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-black/15" />
                    <span>
                      {STATUS_META[s].label}
                      <span className="block text-[0.625rem] text-[#B23B3B]">
                        {prestacao.verificada_em
                          ? `${bloqueiosAbertos} ${bloqueiosAbertos === 1 ? "bloqueio aberto impede" : "bloqueios abertos impedem"} o envio.`
                          : "Rode a verificação antes de enviar."}
                      </span>
                      <Link
                        href={`/prestacoes/${id}/pendencias`}
                        className="mt-1 inline-flex items-center gap-1 rounded text-[0.625rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                      >
                        Ver pendências <ArrowRight size={10} aria-hidden />
                      </Link>
                    </span>
                  </div>
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
        {proximos.length + travados.length === 0 && bloqueados.length > 0 && (
          <p className="max-w-[20rem] text-right text-[0.6875rem] text-black/40">
            Próximo passo: {bloqueados.map(s => STATUS_META[s].label.toLowerCase()).join(" ou ")}. Cabe ao administrador ou ao responsável pela prestação.
          </p>
        )}
      </div>

      {erro && (
        <p role="alert" className="mb-4 px-4 py-3 rounded border text-[0.75rem]"
          style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          {erro}
        </p>
      )}

      {/* Alerta de prazo próximo */}
      {prazoAlerta && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded border mb-4 text-[0.75rem]"
          style={{ background: "#fff", borderColor: "#B07A1430", color: "#B07A14" }}>
          <AlertCircle size={13} />
          <span>Prazo em <strong>{diasRestantes} dia{diasRestantes !== 1 ? "s" : ""}</strong> — {fmtDate(prestacao.prazo)}</span>
        </div>
      )}
      {vencida && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded border mb-4 text-[0.75rem]"
          style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          <AlertCircle size={13} />
          <span>Prazo vencido em {fmtDate(prestacao.prazo)} — regularize o envio o quanto antes.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="min-w-0 space-y-4 lg:col-span-2">

          <ProntidaoPrestacao prontidao={prontidao} prestacaoId={id} />

          <VerificacoesPrestacao prestacaoId={id} permissoes={permissoes} resumo />

          {/* Painel de comprovação financeira */}
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <p className="text-[0.6875rem] font-semibold text-black/50 mb-3">Comprovação financeira</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                      const itemPct = percentualExecutado(itemExecutado, item.vigente) ?? 0;
                      return (
                        <div key={item.id} className="px-5 py-3 border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[0.6875rem] font-medium text-black/70 truncate" title={item.caminho.length ? `${item.caminho.join(" › ")} › ${item.nome}` : item.nome}>{item.nome}</p>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              <span className="text-[0.625rem] text-black/35 tabular-nums">{fmt(itemExecutado)} / {fmt(item.vigente)}</span>
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
          <div id="prazo" className="scroll-mt-4 bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <PrazoPrestacao
              prestacao={prestacao}
              regime={regimes.find(r => r.id === prestacao.regime_id)?.regime ?? null}
              podeEditar={permissoes.editar}
              onSalvar={salvarCampos}
            />
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
                    key={`inicio-${prestacao.data_inicio_execucao ?? ""}`}
                    defaultValue={prestacao.data_inicio_execucao ?? ""}
                    disabled={!permissoes.editar}
                    onBlur={e => salvarPeriodo("data_inicio_execucao", e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-[0.6875rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <p className="text-[0.5625rem] text-black/30 mb-1">Fim</p>
                  <input
                    type="date"
                    key={`fim-${prestacao.data_fim_execucao ?? ""}`}
                    defaultValue={prestacao.data_fim_execucao ?? ""}
                    disabled={!permissoes.editar}
                    onBlur={e => salvarPeriodo("data_fim_execucao", e.target.value)}
                    className="w-full border rounded px-2 py-1.5 text-[0.6875rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div id="dados-oficiais" className="scroll-mt-4">
            <RegimeDadosOficiais
              prestacao={prestacao}
              regimes={regimes}
              podeEditar={permissoes.editar}
              onSalvar={campos => void salvarCampos(campos)}
            />
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
        <div className="min-w-0 space-y-4">

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

          <ProximosPrazos prazos={prazos} />
          <MarcosDaPrestacao prestacao={prestacao} hoje={hoje} />
          <LinksDoPatrocinador prestacaoId={id} captacaoId={prestacao.captacao_id} projetoId={prestacao.projeto_id} podeEditar={permissoes.editar} />

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
              <p className="text-[0.5625rem] text-black/30 mb-0.5">Responsável</p>
              <ResponsavelDaPrestacao
                organizationId={prestacao.organization_id}
                responsavelId={prestacao.responsavel_id ?? null}
                podeEditar={permissoes.editar}
                onSalvar={salvarCampos}
              />
            </div>
            {prestacao.proponente && (
              <div>
                <p className="text-[0.5625rem] text-black/30 mb-0.5">Cliente (proponente)</p>
                <Link href={`/proponentes/${prestacao.proponente.id}`} className="rounded text-[0.6875rem] text-black/60 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{prestacao.proponente.nome}</Link>
              </div>
            )}
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
