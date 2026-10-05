"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  TrendingUp, CheckCircle2, Percent, ListChecks, AlertTriangle,
  Mail, Phone, Users, Calendar, MoreHorizontal, CheckSquare,
  ArrowRight, ArrowUpRight, Clock, CircleDollarSign, List, Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PotencialFechamento, StatusCaptacao, TipoAtividade } from "@/lib/supabase/types";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { PrimeirosPassos } from "@/components/onboarding/PrimeirosPassos";
import { useDashboardPreferences } from "@/components/dashboard/useDashboardPreferences";
import type { DashboardModuleId } from "@/components/dashboard/dashboardModules";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { escalaUi } from "@/lib/escala-ui";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FunnelStage = {
  status: StatusCaptacao;
  label: string;
  count: number;
  valor: number;
  color: string;
};

type StagnantCap = {
  id: string;
  status: StatusCaptacao;
  empresa: string;
  diasSemAtividade: number;
};

type AtividadeRecente = {
  id: string;
  nome: string;
  tipo: TipoAtividade | null;
  created_at: string;
  empresa_crm: { nome: string } | null;
  empresa_crm_id: string | null;
  contato: { nome: string | null } | null;
  captacao: { titulo: string | null } | null;
};

type Evento = {
  id: string;
  data: string;
  tipo: "edital" | "followup";
  titulo: string;
  sub: string;
};

type TempoEstagio = { mediana_dias: number; amostras: number };

type TipoRanking = "equipe" | "externo";

type RankingCaptador = {
  captador_id: string;
  nome: string;
  ciclos_fechados: number;
  mediana_dias: number;
  taxa_aprovacao: number;
};

type ChannelMetric = {
  canal: string;
  interacoes: number;
  respostas: number;
  reunioes_agendadas: number;
  propostas_solicitadas: number;
  negociacoes: number;
  negociacoes_aprovadas: number;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGE_ORDER: Array<{ status: StatusCaptacao; label: string; color: string }> = [
  { status: "prospeccao",       label: "Prospecção",       color: "rgba(13,13,13,.35)" },
  { status: "primeiro_contato", label: "1º contato",       color: "rgba(13,13,13,.40)" },
  { status: "proposta_enviada", label: "Proposta enviada", color: "#7259B5" },
  { status: "em_negociacao",    label: "Em negociação",    color: "#7259B5" },
  { status: "renovacao",        label: "Renovação",        color: "#2D72B0" },
];

const STATUS_LABEL: Record<StatusCaptacao, string> = {
  prospeccao:       "Prospecção",
  primeiro_contato: "1º contato",
  proposta_enviada: "Proposta enviada",
  em_negociacao:    "Em negociação",
  aprovado:         "Aprovado",
  recusado:         "Recusado",
  renovacao:        "Renovação",
};

const TIPO_CONFIG: Record<TipoAtividade, { Icon: React.ElementType; color: string }> = {
  email:    { Icon: Mail,           color: "#2D72B0" },
  telefone: { Icon: Phone,          color: "#1A8B7A" },
  linkedin: { Icon: ArrowUpRight,   color: "#2D72B0" },
  reuniao:  { Icon: Users,          color: "rgba(13,13,13,.45)" },
  evento:   { Icon: Calendar,       color: "#B07A14" },
  tarefa:   { Icon: CheckSquare,    color: "#7259B5" },
  outro:    { Icon: MoreHorizontal, color: "rgba(13,13,13,.40)" },
};

const POTENCIAL_PESO: Record<PotencialFechamento, number> = {
  baixo: 0.25,
  medio: 0.5,
  alto: 0.75,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtValor(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000)     return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "agora";
  if (mins  < 60) return `${mins}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days === 1) return "ontem";
  if (days  <  7) return `${days} dias atrás`;
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function fmtEventDate(iso: string): { mes: string; dia: string } {
  const [, m, d] = iso.split("T")[0].split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return { mes: meses[parseInt(m) - 1], dia: d };
}

function fmtDias(dias: number): string {
  if (dias < 1) return "<1 d";
  return `${Math.round(dias)} d`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white rounded border p-5 animate-pulse" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="h-2.5 w-16 bg-black/8 rounded mb-4" />
      <div className="h-7 w-24 bg-black/8 rounded mb-2" />
      <div className="h-2.5 w-20 bg-black/8 rounded" />
    </div>
  );
}

function BlockSkeleton({ h = 220 }: { h?: number }) {
  return (
    <div
      className="bg-white rounded border animate-pulse"
      style={{ borderColor: "rgba(13,13,13,.08)", height: `${h / 16}rem` }}
    />
  );
}

// ─── Funil consolidado de eficácia dos canais ──────────────────────────────────

const FUNNEL_STAGES: { key: keyof ChannelMetric; label: string }[] = [
  { key: "interacoes", label: "Interações" },
  { key: "respostas", label: "Respostas" },
  { key: "reunioes_agendadas", label: "Reuniões" },
  { key: "propostas_solicitadas", label: "Propostas" },
  { key: "negociacoes_aprovadas", label: "Conversão" },
];

function ChannelFunnelChart({ metrics, canais }: { metrics: ChannelMetric[]; canais: ReturnType<typeof useTaxonomiasComerciais>["canais"] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // O desenho é feito numa largura lógica (px ÷ fator da fonte base); o
    // viewBox amplia tudo junto, como o restante da página em telas grandes.
    const observer = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w / escalaUi());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 300;
  const labelZoneHeight = 80;
  const funnelHeight = height - labelZoneHeight - 10;
  const midY = labelZoneHeight + funnelHeight / 2;
  const maxBandHeight = funnelHeight * 0.92;
  // Mantém a última etapa afastada da borda para o rótulo "Conversão" não ser cortado.
  const chartLeft = 8;
  const chartRight = Math.max(chartLeft, width - 54);
  const stageX = FUNNEL_STAGES.map((_, i) => chartLeft + (i / (FUNNEL_STAGES.length - 1)) * (chartRight - chartLeft));

  const stageTotals = FUNNEL_STAGES.map(stage => metrics.reduce((sum, m) => sum + Number(m[stage.key] ?? 0), 0));
  const topTotal = stageTotals[0] || 0;

  // Ordem "inside-out": o canal de maior volume fica na faixa mais central da pilha,
  // os menores se alternam pras bordas — efeito de silhouette simétrica em torno do meio.
  const activeChannels = metrics.filter(m => m.interacoes > 0).slice().sort((a, b) => b.interacoes - a.interacoes);
  const ordered: ChannelMetric[] = [];
  activeChannels.forEach((metric, index) => { if (index % 2 === 0) ordered.push(metric); else ordered.unshift(metric); });

  if (topTotal === 0 || ordered.length === 0) {
    return <p className="px-5 py-14 text-center text-xs text-black/25">Sem interações suficientes para montar o funil</p>;
  }

  const scale = maxBandHeight / topTotal;
  const offsets = FUNNEL_STAGES.map(stage => {
    const total = ordered.reduce((s, m) => s + Number(m[stage.key] ?? 0), 0);
    let cum = -total / 2;
    return ordered.map(m => {
      const v = Number(m[stage.key] ?? 0);
      const top = cum;
      cum += v;
      return { top, bottom: cum };
    });
  });
  const yFor = (value: number) => midY - value * scale;

  function pathForChannel(channelIndex: number): string {
    const points = stageX.map((x, stageIndex) => ({ x, top: yFor(offsets[stageIndex][channelIndex].top), bottom: yFor(offsets[stageIndex][channelIndex].bottom) }));
    let d = `M ${points[0].x} ${points[0].top}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cx = (points[i].x + points[i + 1].x) / 2;
      d += ` C ${cx} ${points[i].top} ${cx} ${points[i + 1].top} ${points[i + 1].x} ${points[i + 1].top}`;
    }
    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].bottom}`;
    for (let i = points.length - 1; i > 0; i--) {
      const cx = (points[i].x + points[i - 1].x) / 2;
      d += ` C ${cx} ${points[i].bottom} ${cx} ${points[i - 1].bottom} ${points[i - 1].x} ${points[i - 1].bottom}`;
    }
    return d + " Z";
  }

  return (
    <div className="px-5 py-5" ref={containerRef}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-[18.75rem] w-full" role="img" aria-label="Funil consolidado de eficácia dos canais">
        {stageX.map((x, i) => (
          <line key={i} x1={x} y1={4} x2={x} y2={height - 4} stroke="rgba(13,13,13,.09)" strokeWidth={1.5} />
        ))}
        {ordered.map((metric, channelIndex) => {
          const option = canais.find(item => item.chave === metric.canal);
          return <path key={metric.canal} d={pathForChannel(channelIndex)} fill={option?.cor ?? "#7259B5"} opacity={0.85} />;
        })}
        {FUNNEL_STAGES.map((stage, i) => {
          const total = stageTotals[i];
          const pct = topTotal ? Math.round((total / topTotal) * 100) : 0;
          const isLast = i === FUNNEL_STAGES.length - 1;
          const textX = isLast ? stageX[i] : stageX[i] + (i === 0 ? 6 : 16);
          const anchor = isLast ? "middle" : "start";
          return (
            <g key={stage.key}>
              <text x={textX} y={28} textAnchor={anchor} fontSize={22} className="font-bold" fill="#0D0D0D">{total}</text>
              <text x={textX} y={48} textAnchor={anchor} fontSize={13} fill="rgba(13,13,13,.5)">{stage.label}</text>
              <text x={textX} y={65} textAnchor={anchor} fontSize={13} className="font-bold" fill="rgba(13,13,13,.7)">{pct}%</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        {ordered.map(metric => {
          const option = canais.find(item => item.chave === metric.canal);
          return (
            <div key={metric.canal} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: option?.cor ?? "#7259B5" }} />
              <span className="text-[0.6875rem] font-medium text-black/55">{option?.label ?? metric.canal.replaceAll("_", " ")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient();
  const { canais } = useTaxonomiasComerciais();
  const [loading, setLoading] = useState(true);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const dashboardPreferences = useDashboardPreferences();

  const [pipeline,        setPipeline]        = useState(0);
  const [pipelinePonderado, setPipelinePonderado] = useState(0);
  const [pipelineCount,   setPipelineCount]   = useState(0);
  const [aprovadoValor,   setAprovadoValor]   = useState(0);
  const [aprovadoCount,   setAprovadoCount]   = useState(0);
  const [conversao,       setConversao]       = useState<number | null>(null);
  const [pendentes,       setPendentes]       = useState(0);
  const [editaisUrgentes, setEditaisUrgentes] = useState(0);
  const [followupsVencidos, setFollowupsVencidos] = useState(0);

  const [funnel,     setFunnel]     = useState<FunnelStage[]>([]);
  const [stagnant,   setStagnant]   = useState<StagnantCap[]>([]);
  const [atividades, setAtividades] = useState<AtividadeRecente[]>([]);
  const [eventos,    setEventos]    = useState<Evento[]>([]);
  const [channelMetrics, setChannelMetrics] = useState<ChannelMetric[]>([]);
  const [channelView, setChannelView] = useState<"tabela" | "funil">("tabela");

  const organizationId = useOrganizationId();
  const [tempoPorEstagio, setTempoPorEstagio] = useState<Record<string, TempoEstagio>>({});
  const [ranking, setRanking] = useState<Record<TipoRanking, RankingCaptador[]>>({ equipe: [], externo: [] });
  const [rankingView, setRankingView] = useState<TipoRanking>("equipe");
  const [velocidadeLoading, setVelocidadeLoading] = useState(true);

  // Velocidade do funil vem de RPCs agregadas no banco (histórico de status é
  // grande demais para buscar inteiro, e o ranking é visível pra toda a org
  // sem expor as captações em si).
  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = (supabase as any).rpc.bind(supabase);
      const [tempoRes, equipeRes, externoRes] = await Promise.all([
        rpc("fn_dashboard_tempo_por_estagio", { p_organization_id: organizationId }),
        rpc("fn_dashboard_ranking_captadores", { p_organization_id: organizationId, p_tipo: "equipe" }),
        rpc("fn_dashboard_ranking_captadores", { p_organization_id: organizationId, p_tipo: "externo" }),
      ]);
      if (!ativo) return;

      const tempos: Record<string, TempoEstagio> = {};
      for (const row of (tempoRes.data ?? []) as Array<{ status: string; mediana_dias: number; amostras: number }>) {
        tempos[row.status] = { mediana_dias: Number(row.mediana_dias), amostras: Number(row.amostras) };
      }
      const normalizar = (rows: unknown): RankingCaptador[] =>
        ((rows ?? []) as RankingCaptador[])
          .map((r) => ({
            ...r,
            ciclos_fechados: Number(r.ciclos_fechados),
            mediana_dias: Number(r.mediana_dias),
            taxa_aprovacao: Number(r.taxa_aprovacao),
          }))
          .sort((a, b) => a.mediana_dias - b.mediana_dias);

      setTempoPorEstagio(tempos);
      setRanking({ equipe: normalizar(equipeRes.data), externo: normalizar(externoRes.data) });
      setVelocidadeLoading(false);
    })();
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const hoje = new Date().toISOString().split("T")[0];
      const d14  = new Date(Date.now() + 14 * 86_400_000).toISOString().split("T")[0];
      const d30  = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];

      const [
        allCapsRes,
        recusadoRes,
        pendentesRes,
        urgentesRes,
        atividadesRes,
        stagnantRes,
        editaisJanelaRes,
        capsJanelaRes,
        followupsVencidosRes,
        channelRes,
      ] = await Promise.all([
        // Todos os captações (exceto recusado): status + valor → funil + KPIs
        supabase
          .from("captacoes")
          .select("id, status, valor_solicitado, valor_aprovado, potencial_fechamento"),

        // Recusado count → taxa de conversão
        supabase
          .from("captacoes")
          .select("id", { count: "exact", head: true })
          .eq("status", "recusado"),

        // Atividades pendentes
        supabase
          .from("atividades")
          .select("id", { count: "exact", head: true })
          .eq("feita", false),

        // Editais urgentes (≤ 14 dias)
        supabase
          .from("editais")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .gte("data_fechamento", hoje)
          .lte("data_fechamento", d14),

        // Feed de atividades recentes
        supabase
          .from("atividades")
          .select("id, nome, tipo, created_at, empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_crm_id, contato:contatos!contato_id(nome), captacao:captacoes!captacao_id(titulo)")
          .order("created_at", { ascending: false })
          .limit(5),

        // Captações ativas + atividades recentes (para detectar estagnação)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("captacoes")
          .select("id, titulo, status, created_at, empresa_pub:empresas!empresa_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), atividades(created_at)")
          .not("status", "in", '("aprovado","recusado")')
          .limit(150),

        // Editais com fechamento nos próximos 30 dias
        supabase
          .from("editais")
          .select("id, titulo, data_fechamento, empresa_pub:empresas!empresa_id(nome)")
          .eq("ativo", true)
          .gte("data_fechamento", hoje)
          .lte("data_fechamento", d30)
          .order("data_fechamento")
          .limit(8),

        // Follow-ups canônicos agendados nos próximos 30 dias
        (supabase as any)
          .from("crm_followups")
          .select("id,titulo,previsto_para,captacao_id,empresa_crm:empresas_crm!empresa_crm_id(nome),captacao:captacoes!captacao_id(titulo,status,valor_solicitado)")
          .eq("status", "pendente")
          .gte("previsto_para", `${hoje}T00:00:00`)
          .lte("previsto_para", `${d30}T23:59:59`)
          .order("previsto_para")
          .limit(8),

        // Follow-ups vencidos ainda pendentes
        (supabase as any)
          .from("crm_followups")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente")
          .lt("previsto_para", `${hoje}T00:00:00`),

        // Eficácia por canal (agregado de todos os meses)
        (supabase as any)
          .from("vw_eficacia_canais")
          .select("canal,interacoes,respostas,reunioes_agendadas,propostas_solicitadas,negociacoes,negociacoes_aprovadas"),
      ]);

      // ── KPIs ───────────────────────────────────────────────────────────────
      const allCaps = (allCapsRes.data ?? []) as Array<{
        id: string;
        status: StatusCaptacao;
        valor_solicitado: number | null;
        valor_aprovado: number | null;
        potencial_fechamento: PotencialFechamento | null;
      }>;

      const pipelineCaps = allCaps.filter(c => c.status !== "aprovado");
      setPipeline(pipelineCaps.reduce((s, c) => s + (c.valor_solicitado ?? 0), 0));
      setPipelinePonderado(
        pipelineCaps.reduce(
          (total, c) => total + (c.valor_solicitado ?? 0) * POTENCIAL_PESO[c.potencial_fechamento ?? "medio"],
          0
        )
      );
      setPipelineCount(pipelineCaps.length);

      const aprovadoCaps = allCaps.filter(c => c.status === "aprovado");
      // Vale o valor aceito; sem ele (fechada à mão), o valor da negociação.
      setAprovadoValor(aprovadoCaps.reduce((s, c) => s + (c.valor_aprovado ?? c.valor_solicitado ?? 0), 0));
      setAprovadoCount(aprovadoCaps.length);

      const recusadoCount = recusadoRes.count ?? 0;
      const totalFechados = aprovadoCaps.length + recusadoCount;
      setConversao(totalFechados > 0 ? Math.round((aprovadoCaps.length / totalFechados) * 100) : null);

      setPendentes(pendentesRes.count ?? 0);
      setEditaisUrgentes(urgentesRes.count ?? 0);
      setFollowupsVencidos(followupsVencidosRes.count ?? 0);

      // ── Funil ──────────────────────────────────────────────────────────────
      const stageMap = new Map<StatusCaptacao, { count: number; valor: number }>();
      for (const c of pipelineCaps) {
        const prev = stageMap.get(c.status) ?? { count: 0, valor: 0 };
        stageMap.set(c.status, {
          count: prev.count + 1,
          valor: prev.valor + (c.valor_solicitado ?? 0),
        });
      }
      setFunnel(
        STAGE_ORDER.map(({ status, label, color }) => {
          const d = stageMap.get(status) ?? { count: 0, valor: 0 };
          return { status, label, count: d.count, valor: d.valor, color };
        })
      );

      // ── Captações estagnadas ────────────────────────────────────────────────
      type RawStagnant = {
        id: string;
        titulo: string | null;
        status: StatusCaptacao;
        created_at: string;
        empresa_pub: { nome: string } | null;
        empresa_crm: { nome: string } | null;
        atividades: Array<{ created_at: string }>;
      };

      const rawStagnant = (stagnantRes.data ?? []) as RawStagnant[];
      const stagnantList: StagnantCap[] = rawStagnant
        .map((c) => {
          const acts = c.atividades ?? [];
          const lastMs = acts.length > 0
            ? Math.max(...acts.map(a => new Date(a.created_at).getTime()))
            : new Date(c.created_at).getTime();
          return {
            id: c.id,
            status: c.status,
            empresa: c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? c.titulo ?? "—",
            diasSemAtividade: Math.floor((Date.now() - lastMs) / 86_400_000),
          };
        })
        .filter(c => c.diasSemAtividade >= 21)
        .sort((a, b) => b.diasSemAtividade - a.diasSemAtividade)
        .slice(0, 5);
      setStagnant(stagnantList);

      // ── Atividades recentes ────────────────────────────────────────────────
      setAtividades((atividadesRes.data ?? []) as unknown as AtividadeRecente[]);

      // ── Próximos eventos ───────────────────────────────────────────────────
      type RawEdital = {
        id: string;
        titulo: string | null;
        data_fechamento: string | null;
        empresa_pub: { nome: string } | null;
      };
      type RawFollowup = {
        id: string;
        titulo: string | null;
        previsto_para: string;
        empresa_crm: { nome: string } | null;
        captacao: { titulo: string | null; status: StatusCaptacao; valor_solicitado: number | null } | null;
      };

      const evEditais: Evento[] = ((editaisJanelaRes.data ?? []) as RawEdital[])
        .filter(e => e.data_fechamento)
        .map(e => ({
          id: `ed-${e.id}`,
          data: e.data_fechamento!,
          tipo: "edital" as const,
          titulo: e.empresa_pub?.nome ?? e.titulo ?? "Edital",
          sub: `Fecha em ${daysUntil(e.data_fechamento!)} dias`,
        }));

      const evCaps: Evento[] = ((capsJanelaRes.data ?? []) as RawFollowup[])
        .map(item => ({
          id: `followup-${item.id}`,
          data: item.previsto_para,
          tipo: "followup" as const,
          titulo: item.empresa_crm?.nome ?? item.titulo ?? "Follow-up",
          sub: item.captacao
            ? `${STATUS_LABEL[item.captacao.status]}${item.captacao.valor_solicitado ? " · " + fmtValor(item.captacao.valor_solicitado) : ""}`
            : "Relacionamento",
        }));

      setEventos(
        [...evEditais, ...evCaps]
          .sort((a, b) => a.data.localeCompare(b.data))
          .slice(0, 5)
      );

      // ── Eficácia por canal ──────────────────────────────────────────────────
      const channelGrouped = new Map<string, ChannelMetric>();
      for (const row of (channelRes.data ?? []) as Array<Record<string, unknown>>) {
        const canal = row.canal as string;
        const current = channelGrouped.get(canal) ?? { canal, interacoes: 0, respostas: 0, reunioes_agendadas: 0, propostas_solicitadas: 0, negociacoes: 0, negociacoes_aprovadas: 0 };
        for (const key of ["interacoes", "respostas", "reunioes_agendadas", "propostas_solicitadas", "negociacoes", "negociacoes_aprovadas"] as const) {
          current[key] += Number(row[key] ?? 0);
        }
        channelGrouped.set(canal, current);
      }
      setChannelMetrics(
        [...channelGrouped.values()].sort((a, b) => {
          const winRateA = a.negociacoes ? a.negociacoes_aprovadas / a.negociacoes : -1;
          const winRateB = b.negociacoes ? b.negociacoes_aprovadas / b.negociacoes : -1;
          return winRateB - winRateA;
        })
      );

      setLoading(false);
    }

    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxFunnelValor  = Math.max(...funnel.map(s => s.valor), 1);
  const globalMax       = Math.max(maxFunnelValor, aprovadoValor);
  const aprovadoBarPct  = Math.round((aprovadoValor / globalMax) * 100);
  const prioridades = [
    {
      label: "Follow-ups vencidos",
      detail: followupsVencidos === 1 ? "1 contato pede retorno" : `${followupsVencidos} contatos pedem retorno`,
      value: followupsVencidos,
      href: "/captacoes",
      Icon: Clock,
      color: followupsVencidos > 0 ? "#D94E4E" : "#2E8932",
    },
    {
      label: "Tarefas em aberto",
      detail: pendentes === 1 ? "1 atividade pendente" : `${pendentes} atividades pendentes`,
      value: pendentes,
      href: "/atividades",
      Icon: ListChecks,
      color: pendentes > 0 ? "#B07A14" : "#2E8932",
    },
    {
      label: "Editais próximos",
      detail: editaisUrgentes === 1 ? "1 encerra em até 14 dias" : `${editaisUrgentes} encerram em até 14 dias`,
      value: editaisUrgentes,
      href: "/editais-abertos",
      Icon: Calendar,
      color: editaisUrgentes > 0 ? "#D94E4E" : "#2E8932",
    },
    {
      label: "Negociações em risco",
      detail: stagnant.length === 1 ? "1 sem atividade há 21 dias" : `${stagnant.length} sem atividade há 21 dias`,
      value: stagnant.length,
      href: "/captacoes",
      Icon: AlertTriangle,
      color: stagnant.length > 0 ? "#B07A14" : "#2E8932",
    },
  ];
  const modulePosition = (id: DashboardModuleId) => dashboardPreferences.preferences.find((item) => item.id === id)?.position ?? 99;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">

      {/* Header */}
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">Gerenciamento</p>
          <h1 className="mt-1 text-[1.75rem] font-bold tracking-[-.025em] text-[#0D0D0D]">Visão geral</h1>
        </div>
        <DashboardCustomizer open={customizerOpen} onOpenChange={setCustomizerOpen} preferences={dashboardPreferences.preferences} onToggle={dashboardPreferences.toggle} onMove={dashboardPreferences.move} onReset={dashboardPreferences.reset} />
      </div>

      <PrimeirosPassos />

      <div className="flex flex-col">

      {/* KPIs */}
      {dashboardPreferences.isEnabled("kpis") && <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-5" style={{ order: modulePosition("kpis") }}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
          : (
            <>
              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em]">Pipeline</p>
                  <TrendingUp size={14} className="text-[#7259B5]" />
                </div>
                <p className="text-[1.375rem] font-bold text-[#0D0D0D] leading-none mb-1">{fmtValor(pipeline)}</p>
                <p className="text-[0.6875rem] text-black/35">{pipelineCount} em andamento</p>
              </div>

              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em]">Ponderado</p>
                  <CircleDollarSign size={14} className="text-[#7259B5]" />
                </div>
                <p className="text-[1.375rem] font-bold text-[#0D0D0D] leading-none mb-1">{fmtValor(pipelinePonderado)}</p>
              </div>

              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em]">Aprovado</p>
                  <CheckCircle2 size={14} className="text-[#2E8932]" />
                </div>
                <p className="text-[1.375rem] font-bold text-[#0D0D0D] leading-none mb-1">{fmtValor(aprovadoValor)}</p>
                <p className="text-[0.6875rem] text-black/35">{aprovadoCount} patrocínios</p>
              </div>

              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em]">Conversão</p>
                  <Percent size={14} className="text-[#7259B5]" />
                </div>
                <p className="text-[1.375rem] font-bold text-[#0D0D0D] leading-none mb-1">
                  {conversao !== null ? `${conversao}%` : "—"}
                </p>
              </div>

              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em]">Pendentes</p>
                  <ListChecks size={14} className="text-black/45" />
                </div>
                <p className="text-[1.375rem] font-bold text-[#0D0D0D] leading-none mb-1">{pendentes}</p>
              </div>
            </>
          )
        }
      </div>}

      {/* Prioridades do dia: regras operacionais transparentes e acionáveis */}
      {dashboardPreferences.isEnabled("priorities") && (loading ? <div style={{ order: modulePosition("priorities") }}><BlockSkeleton h={132} /></div> : (
        <section className="mb-4 overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)", order: modulePosition("priorities") }}>
          <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <p className="text-[0.625rem] font-bold uppercase tracking-[.09em] text-black/30">Foco</p>
              <h2 className="mt-0.5 text-[0.8125rem] font-semibold text-[#0D0D0D]">Prioridades do dia</h2>
            </div>
            <p className="hidden text-[0.625rem] text-black/30 sm:block">Ordenadas por urgência operacional</p>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {prioridades.map(({ label, detail, value, href, Icon, color }, index) => (
              <Link
                key={label}
                href={href}
                className={`group flex min-h-[5.25rem] items-center gap-3 px-5 py-4 transition-colors hover:bg-black/[.025] ${
                  index > 0 ? "border-t sm:border-t-0 sm:border-l" : ""
                } ${index === 2 ? "sm:border-l-0 xl:border-l" : ""}`}
                style={{ borderColor: "rgba(13,13,13,.06)" }}
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded border bg-white" style={{ borderColor: `${color}38`, color }}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[0.75rem] font-semibold text-black/70">{label}</p>
                    <span className="text-[0.9375rem] font-bold tabular-nums" style={{ color }}>{value}</span>
                  </div>
                  <p className="mt-1 truncate text-[0.625rem] text-black/32">{value > 0 ? detail : "Nenhuma ação necessária"}</p>
                </div>
                <ArrowRight size={12} className="flex-none text-black/20 transition-transform group-hover:translate-x-0.5 group-hover:text-black/40" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Funil + Estagnadas */}
      {(dashboardPreferences.isEnabled("funnel") || dashboardPreferences.isEnabled("risks")) && <div className={`grid gap-4 mb-4 ${dashboardPreferences.isEnabled("funnel") && dashboardPreferences.isEnabled("risks") ? "xl:grid-cols-[1fr_18.75rem]" : "grid-cols-1"}`} style={{ order: Math.min(modulePosition("funnel"), modulePosition("risks")) }}>

        {/* Funil */}
        {dashboardPreferences.isEnabled("funnel") && (loading ? <BlockSkeleton h={250} /> : (
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <div>
                <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">Pipeline</p>
                <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Distribuição por estágio</p>
              </div>
              <Link
                href="/captacoes"
                className="flex items-center gap-1 text-[0.6875rem] font-semibold text-black/30 hover:text-black transition"
              >
                Ver kanban <ArrowRight size={11} />
              </Link>
            </div>

            <div className="px-6 py-5 flex flex-col gap-3.5">
              {funnel.map(({ status, label, count, valor, color }) => {
                const pct = Math.round((valor / globalMax) * 100);
                const tempo = tempoPorEstagio[status];
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-[0.6875rem] text-black/45 w-[8.25rem] flex-shrink-0 whitespace-nowrap">
                      {label}
                    </span>
                    <div className="flex-1 h-[0.3125rem] rounded-full" style={{ background: "rgba(13,13,13,.05)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: color,
                          opacity: status === "em_negociacao" ? 1 : 0.6,
                        }}
                      />
                    </div>
                    <span
                      className="text-[0.6875rem] text-black/30 w-[2.625rem] text-right flex-shrink-0 tabular-nums"
                      title={tempo ? `Tempo mediano neste estágio · ${tempo.amostras} ${tempo.amostras === 1 ? "passagem" : "passagens"}` : "Ainda sem passagens concluídas por este estágio"}
                    >
                      {tempo ? `~${fmtDias(tempo.mediana_dias)}` : "—"}
                    </span>
                    <span className="text-[0.6875rem] text-black/25 w-5 text-right flex-shrink-0">{count}</span>
                    <span className="text-[0.6875rem] font-semibold text-black/55 w-[3.625rem] text-right flex-shrink-0">
                      {valor > 0 ? fmtValor(valor) : "—"}
                    </span>
                  </div>
                );
              })}

              <div className="border-t mt-1 pt-3.5 flex items-center gap-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <span className="text-[0.6875rem] font-semibold w-[8.25rem] flex-shrink-0 whitespace-nowrap text-[#2E8932]">
                  Aprovado
                </span>
                <div className="flex-1 h-[0.3125rem] rounded-full" style={{ background: "rgba(13,13,13,.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${aprovadoBarPct}%`, background: "#2E8932", opacity: 0.7 }}
                  />
                </div>
                <span className="w-[2.625rem] flex-shrink-0" aria-hidden="true" />
                <span className="text-[0.6875rem] text-black/25 w-5 text-right flex-shrink-0">{aprovadoCount}</span>
                <span className="text-[0.6875rem] font-semibold w-[3.625rem] text-right flex-shrink-0 text-[#2E8932]">
                  {aprovadoValor > 0 ? fmtValor(aprovadoValor) : "—"}
                </span>
              </div>

              {Object.keys(tempoPorEstagio).length > 0 && (
                <p className="text-[0.625rem] text-black/30">
                  ~ dias: tempo mediano que as negociações passam em cada estágio
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Negociações estagnadas */}
        {dashboardPreferences.isEnabled("risks") && (loading ? <BlockSkeleton h={250} /> : (
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">Atenção</p>
              <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Negociações estagnadas</p>
            </div>

            {stagnant.length === 0 ? (
              <p className="px-5 py-12 text-xs text-black/25 text-center">Nenhuma negociação estagnada</p>
            ) : (
              <div className="divide-y divide-black/[.06]">
                {stagnant.map((c) => {
                  const urgente = c.diasSemAtividade >= 30;
                  return (
                    <Link
                      key={c.id}
                      href={`/captacoes/${c.id}`}
                      className="px-5 py-3 flex items-center gap-3 hover:bg-black/[0.015] transition"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(13,13,13,.04)" }}
                      >
                        <Clock size={13} style={{ color: urgente ? "#D94E4E" : "#B07A14" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.75rem] font-semibold text-[#0D0D0D] truncate">{c.empresa}</p>
                        <p className="text-[0.625rem] text-black/35 mt-0.5">{STATUS_LABEL[c.status]}</p>
                      </div>
                      <span
                        className="text-[0.6875rem] font-bold flex-shrink-0"
                        style={{ color: urgente ? "#D94E4E" : "#B07A14" }}
                      >
                        {c.diasSemAtividade}d
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>}

      {/* Atividades + Próximos eventos */}
      {(dashboardPreferences.isEnabled("recentActivities") || dashboardPreferences.isEnabled("upcomingEvents")) && <div className={`grid gap-4 ${dashboardPreferences.isEnabled("recentActivities") && dashboardPreferences.isEnabled("upcomingEvents") ? "xl:grid-cols-2" : "grid-cols-1"}`} style={{ order: Math.min(modulePosition("recentActivities"), modulePosition("upcomingEvents")) }}>

        {/* Atividades recentes */}
        {dashboardPreferences.isEnabled("recentActivities") && (loading ? <BlockSkeleton h={220} /> : (
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">CRM</p>
              <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Atividades recentes</p>
            </div>

            {atividades.length === 0 ? (
              <p className="px-5 py-10 text-xs text-black/25 text-center">Nenhuma atividade registrada</p>
            ) : (
              <>
                <div className="divide-y divide-black/[.06]">
                  {atividades.map((a) => {
                    const tc   = a.tipo ? TIPO_CONFIG[a.tipo] : TIPO_CONFIG.outro;
                    const Icon = tc.Icon;
                    const entity = a.contato?.nome ?? a.captacao?.titulo ?? a.empresa_crm?.nome;
                    return (
                      <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                        <div
                          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "rgba(13,13,13,.04)" }}
                        >
                          <Icon size={12} style={{ color: tc.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[0.75rem] font-semibold text-black/75 truncate">{a.nome}</p>
                          {entity && (
                            a.empresa_crm?.nome && !a.contato?.nome && !a.captacao?.titulo ? (
                              <Link href={`/empresas-crm/${a.empresa_crm_id}`} className="text-[0.625rem] text-black/35 mt-0.5 truncate block hover:text-[#7259B5] transition">
                                {entity}
                              </Link>
                            ) : (
                              <p className="text-[0.625rem] text-black/35 mt-0.5 truncate">{entity}</p>
                            )
                          )}
                        </div>
                        <span className="text-[0.625rem] text-black/22 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {timeAgo(a.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <Link
                    href="/atividades"
                    className="flex items-center gap-1 text-[0.6875rem] font-semibold text-black/30 hover:text-black transition"
                  >
                    Ver todas <ArrowUpRight size={11} />
                  </Link>
                </div>
              </>
            )}
          </div>
        ))}

        {/* Próximos 30 dias */}
        {dashboardPreferences.isEnabled("upcomingEvents") && (loading ? <BlockSkeleton h={220} /> : (
          <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">Calendário</p>
              <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Próximos 30 dias</p>
            </div>

            {eventos.length === 0 ? (
              <p className="px-5 py-10 text-xs text-black/25 text-center">Nenhum evento próximo</p>
            ) : (
              <>
                <div className="divide-y divide-black/[.06]">
                  {eventos.map((ev) => {
                    const { mes, dia } = fmtEventDate(ev.data);
                    const isEdital     = ev.tipo === "edital";
                    const badge = isEdital ? { text: "#D94E4E" } : { text: "#7259B5" };
                    const dayColor = daysUntil(ev.data) <= 5 ? "#D94E4E" : "#0D0D0D";
                    return (
                      <div key={ev.id} className="px-5 py-3.5 flex items-start gap-3">
                        <div className="w-9 text-center flex-shrink-0">
                          <p className="text-[0.5625rem] font-bold text-black/25 uppercase tracking-[.06em]">{mes}</p>
                          <p className="text-[1.125rem] font-bold leading-tight" style={{ color: dayColor }}>{dia}</p>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <span
                            className="mb-1.5 inline-block rounded border bg-transparent px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-[.05em]"
                            style={{ borderColor: `${badge.text}59`, color: badge.text }}
                          >
                            {isEdital ? "Edital" : "Follow-up"}
                          </span>
                          <p className="text-[0.75rem] font-semibold text-[#0D0D0D] truncate">{ev.titulo}</p>
                          <p className="text-[0.6875rem] text-black/35 mt-0.5">{ev.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <Link
                    href="/atividades"
                    className="flex items-center gap-1 text-[0.6875rem] font-semibold text-black/30 hover:text-black transition"
                  >
                    Abrir calendário <ArrowUpRight size={11} />
                  </Link>
                </div>
              </>
            )}
          </div>
        ))}

      </div>}

      {/* Eficácia dos canais */}
      {dashboardPreferences.isEnabled("channelEffectiveness") && (loading ? <div className="mt-4" style={{ order: modulePosition("channelEffectiveness") }}><BlockSkeleton h={220} /></div> : (
        <div className="mt-4 bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)", order: modulePosition("channelEffectiveness") }}>
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">Aquisição</p>
              <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Eficácia dos canais</p>
            </div>
            {channelMetrics.length > 0 && (
              <SegmentedControl
                ariaLabel="Visualização da eficácia dos canais"
                iconOnly
                value={channelView}
                onChange={setChannelView}
                options={[
                  { value: "tabela", icon: List, ariaLabel: "Tabela" },
                  { value: "funil", icon: Filter, ariaLabel: "Funil" },
                ]}
              />
            )}
          </div>

          {channelMetrics.length === 0 ? (
            <p className="px-5 py-10 text-xs text-black/25 text-center">Nenhuma interação registrada ainda</p>
          ) : channelView === "funil" ? (
            <ChannelFunnelChart metrics={channelMetrics} canais={canais} />
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_repeat(4,5.5rem)] gap-4 px-5 py-2 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25">Canal</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center">Resposta</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center">Reunião</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center">Proposta</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center border-l" style={{ borderColor: "rgba(13,13,13,.07)" }}>Conversão</span>
              </div>
              <div className="divide-y divide-black/[.06]">
                {channelMetrics.map(metric => {
                  const option = canais.find(item => item.chave === metric.canal);
                  const responseRate = metric.interacoes ? Math.round((metric.respostas / metric.interacoes) * 100) : 0;
                  const meetingRate = metric.interacoes ? Math.round((metric.reunioes_agendadas / metric.interacoes) * 100) : 0;
                  const proposalRate = metric.interacoes ? Math.round((metric.propostas_solicitadas / metric.interacoes) * 100) : 0;
                  const winRate = metric.negociacoes ? Math.round((metric.negociacoes_aprovadas / metric.negociacoes) * 100) : null;
                  return (
                    <div key={metric.canal} className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(4,5.5rem)] items-center gap-3 sm:gap-4 px-5 py-3.5">
                      <div className="col-span-2 sm:col-span-1 min-w-0">
                        <p className="truncate text-[0.75rem] font-semibold text-[#0D0D0D]">{option?.label ?? metric.canal.replaceAll("_", " ")}</p>
                        <p className="mt-0.5 text-[0.625rem] text-black/30">
                          {metric.interacoes} interações · {metric.negociacoes} negociações
                          {metric.interacoes < 5 && <span className="text-[#D94E4E]"> · amostra pequena</span>}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Resposta</p>
                        <p className="text-[0.8125rem] font-semibold text-black/65">{responseRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Reunião</p>
                        <p className="text-[0.8125rem] font-semibold text-black/65">{meetingRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Proposta</p>
                        <p className="text-[0.8125rem] font-semibold text-black/65">{proposalRate}%</p>
                      </div>
                      <div className="text-center sm:border-l" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                        <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Conversão</p>
                        <p className="text-[0.9375rem] font-bold text-[#7259B5]">{winRate === null ? "—" : `${winRate}%`}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ))}

      {/* Velocidade por captador */}
      {dashboardPreferences.isEnabled("captadoresRanking") && (velocidadeLoading ? <div className="mt-4" style={{ order: modulePosition("captadoresRanking") }}><BlockSkeleton h={220} /></div> : (
        <div className="mt-4 bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)", order: modulePosition("captadoresRanking") }}>
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-[.09em] mb-0.5">Velocidade</p>
              <p className="text-[0.8125rem] font-semibold text-[#0D0D0D]">Velocidade por captador</p>
            </div>
            <SegmentedControl
              ariaLabel="Tipo de captador"
              value={rankingView}
              onChange={setRankingView}
              options={[
                { value: "equipe", label: "Equipe" },
                { value: "externo", label: "Externos" },
              ]}
            />
          </div>

          {ranking[rankingView].length === 0 ? (
            <p className="px-5 py-10 text-xs text-black/25 text-center">
              {rankingView === "equipe"
                ? "O ranking aparece quando negociações com responsável chegarem a aprovado ou recusado"
                : "O ranking aparece quando negociações com captador externo chegarem a aprovado ou recusado"}
            </p>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_repeat(3,6.5rem)] gap-4 px-5 py-2 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25">Captador</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center">Ciclos fechados</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center">Tempo mediano</span>
                <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] text-black/25 text-center border-l" style={{ borderColor: "rgba(13,13,13,.07)" }}>Aprovação</span>
              </div>
              <div className="divide-y divide-black/[.06]">
                {ranking[rankingView].map((item) => (
                  <div key={item.captador_id} className="grid grid-cols-3 sm:grid-cols-[1fr_repeat(3,6.5rem)] items-center gap-3 sm:gap-4 px-5 py-3.5">
                    <div className="col-span-3 sm:col-span-1 min-w-0">
                      <p className="truncate text-[0.75rem] font-semibold text-[#0D0D0D]">{item.nome}</p>
                      {item.ciclos_fechados < 5 && (
                        <p className="mt-0.5 text-[0.625rem] text-[#D94E4E]">amostra pequena</p>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Ciclos</p>
                      <p className="text-[0.8125rem] font-semibold text-black/65 tabular-nums">{item.ciclos_fechados}</p>
                    </div>
                    <div className="text-center">
                      <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Tempo</p>
                      <p className="text-[0.8125rem] font-semibold text-black/65 tabular-nums">{fmtDias(item.mediana_dias)}</p>
                    </div>
                    <div className="text-center sm:border-l" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <p className="sm:hidden text-[0.5625rem] uppercase tracking-wide text-black/25">Aprovação</p>
                      <p className="text-[0.9375rem] font-bold text-[#7259B5] tabular-nums">{Math.round(item.taxa_aprovacao * 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="px-5 py-3 border-t text-[0.625rem] text-black/30" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                Ciclo = da abertura (ou retomada) da negociação até aprovado/recusado. Ordenado pelo tempo mediano.
              </p>
            </>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
