"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserCheck, Plus, Activity, Shield, ArrowUpDown,
  AlertTriangle, Clock, Check, Mail, Pencil,
  Search, LayoutGrid, List, Network, Trash2,
} from "lucide-react";
import PrioBadge from "@/components/ui/PrioBadge";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import AdicionarCaptadorModal from "@/components/modals/AdicionarCaptadorModal";
import { ProjectIdentity, CAPTADOR_ICON_OPTIONS } from "@/components/ui/ProjectIdentity";
import { NovaAtribuicaoModal } from "@/components/modals/NovaAtribuicaoModal";
import type { Atribuicao, TipoExclusividade, StatusAtribuicao } from "@/lib/supabase/types";
import { BipartiteGraph } from "@/components/graph/BipartiteGraph";
import { CompanyLogo } from "@/components/CompanyLogo";
import { calculateWeightedScore, CompactDecisionScoreRing } from "@/components/relationship/DecisionScorecard";
import { ColumnManager, useColumnManager, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { SegmentedControl } from "@/components/ui/FilterControls";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

type Tab      = "equipe" | "atribuicoes";
type TeamView = "list" | "cards";
type AssignmentView = "list" | "cluster";
type TeamPriorityFilter = "todas" | "alta" | "media" | "baixa";
type TeamLinkFilter = "todos" | "workspace" | "externos";
type TeamSortKey = "nome" | "prioridade" | "empresas" | "conversao" | "valor" | "proximo" | "score";
type SortDirection = "asc" | "desc";

type CaptadorRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  agencia: string | null;
  logo_url: string | null;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  prioridade: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  n_captacoes: number;
  n_aprovadas: number;
  n_encerradas: number;
  valor_captado: number;
  n_empresas: number;
  n_negociacoes_ativas: number;
  proxima_atividade: { nome: string; data_prevista: string } | null;
  score: number | null;
};

type CaptadorScoreRow = {
  captador_id: string;
  peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null;
};

const CAPTADORES_COLUMNS = [
  { id: "captador", label: "Captador", width: "230px", hideable: false, grow: true },
  { id: "contato", label: "Contato", width: "190px" },
  { id: "prioridade", label: "Prioridade", width: "105px" },
  { id: "carteira", label: "Carteira", width: "155px" },
  { id: "conversao", label: "Conversão", width: "125px" },
  { id: "valor", label: "Valor captado", width: "135px" },
  { id: "proximo", label: "Próximo acompanhamento", width: "175px" },
  { id: "score", label: "Score", width: "80px" },
  { id: "adicionado", label: "Adicionado em", width: "120px", defaultHidden: true },
  { id: "atualizado", label: "Atualizado em", width: "120px", defaultHidden: true },
  { id: "acoes", label: "Ações", width: "100px", defaultHidden: true },
] as const satisfies readonly ColumnDefinition[];

type CaptadorColumnId = typeof CAPTADORES_COLUMNS[number]["id"];

type MetricasCaptador = {
  total_captações: number;
  captações_ativas: number;
  captações_ganhas: number;
  captações_perdidas: number;
  score_atividade: number;
  empresas_atribuidas: number;
  empresas_em_risco: number;
  dias_sem_avanco: number;
};

type AtribuicaoCompleta = Atribuicao & {
  empresa_crm: { id: string; nome: string; domain_key: string | null; site: string | null } | null;
  projeto: { id: string; nome: string } | null;
  captador: { nome: string } | null;
};

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

const EXCLUSAO_CONFIG: Partial<Record<TipoExclusividade, { label: string; bg: string; icon: React.ElementType }>> = {
  exclusividade_empresa: { label: "Exclusiva",     bg: "#D94E4E", icon: Shield },
  compartilhada:         { label: "Compartilhada", bg: "#1A8B7A", icon: UserCheck },
};

const FILTRO_EXCLUSIVIDADE = [
  { value: "exclusividade_empresa", label: "Exclusiva" },
  { value: "compartilhada",         label: "Compartilhada" },
];

const STATUS_CONFIG: Record<StatusAtribuicao, { label: string; bg: string }> = {
  ativa:       { label: "Ativa",       bg: "#1A8B7A" },
  suspensa:    { label: "Suspensa",    bg: "#B07A14" },
  expirada:    { label: "Expirada",    bg: "#D94E4E" },
  transferida: { label: "Transferida", bg: "#2D72B0" },
  cancelada:   { label: "Cancelada",   bg: "rgba(13,13,13,.40)" },
};

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function fmtValor(v: number): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function getRiskColor(dias: number) {
  if (dias <= 30) return "#2E8932";
  if (dias <= 60) return "#B07A14";
  return "#D94E4E";
}

function getScoreColor(score: number) {
  if (score >= 80) return "#2E8932";
  if (score >= 50) return "#B07A14";
  return "#D94E4E";
}

function formatDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "Hoje";
  if (dias === 1) return "1 dia";
  return `${dias} dias`;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

function SortableTeamHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: TeamSortKey;
  activeKey: TeamSortKey;
  direction: SortDirection;
  onSort: (key: TeamSortKey) => void;
  align?: "left" | "right";
}) {
  const active = activeKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`group inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-black/35 transition hover:text-black/60 ${align === "right" ? "justify-self-end" : ""}`}
      aria-label={`Ordenar ${label} ${active && direction === "asc" ? "do maior para o menor" : "do menor para o maior"}`}
    >
      <span>{label}</span>
      <ArrowUpDown size={11} strokeWidth={1.8} className="opacity-45 group-hover:opacity-80" />
    </button>
  );
}

function CaptadoresList({
  captadores,
  loading,
  onEdit,
  onDelete,
  sortKey,
  sortDirection,
  onSort,
}: {
  captadores: CaptadorRow[];
  loading: boolean;
  onEdit: (captador: CaptadorRow) => void;
  onDelete: (id: string, nome: string) => void;
  sortKey: TeamSortKey;
  sortDirection: SortDirection;
  onSort: (key: TeamSortKey) => void;
}) {
  const router = useRouter();
  const manager = useColumnManager<CaptadorColumnId>("captadores-v2", CAPTADORES_COLUMNS);
  const template = manager.visible.map(column => column.grow ? `minmax(${column.width ?? "140px"}, 1fr)` : column.width ?? "140px").join(" ");
  const minimumWidth = Math.max(720, manager.visible.reduce((sum, column) => sum + Number.parseInt(column.width ?? "140", 10), 0) + Math.max(0, manager.visible.length - 1) * 16 + 40);

  function renderHeader(id: CaptadorColumnId) {
    if (id === "captador") return <SortableTeamHeader label="Captador" sortKey="nome" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "prioridade") return <SortableTeamHeader label="Prioridade" sortKey="prioridade" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "carteira") return <SortableTeamHeader label="Carteira" sortKey="empresas" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "conversao") return <SortableTeamHeader label="Conversão" sortKey="conversao" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "valor") return <SortableTeamHeader label="Valor captado" sortKey="valor" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "proximo") return <SortableTeamHeader label="Próximo acompanhamento" sortKey="proximo" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    if (id === "score") return <SortableTeamHeader label="Score" sortKey="score" activeKey={sortKey} direction={sortDirection} onSort={onSort} />;
    const label = CAPTADORES_COLUMNS.find(column => column.id === id)?.label ?? id;
    return <span className={`text-[10px] font-medium uppercase tracking-[.08em] text-black/35 ${id === "acoes" ? "block text-right" : ""}`}>{label}</span>;
  }

  function renderCell(id: CaptadorColumnId, captador: CaptadorRow) {
    if (id === "captador") return (
      <div className="flex min-w-0 items-center gap-2.5">
        <ProjectIdentity nome={captador.nome} tipo={captador.identidade_tipo ?? (captador.logo_url ? "logo" : "padrao")} valor={captador.identidade_valor} logoUrl={captador.identidade_logo_url ?? captador.logo_url} cor={captador.identidade_cor} size="sm" iconOptions={CAPTADOR_ICON_OPTIONS} />
        <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-black" title={captador.nome}>{captador.nome}</p>{captador.agencia && <p className="truncate text-[11px] text-black/35" title={captador.agencia}>{captador.agencia}</p>}</div>
      </div>
    );
    if (id === "contato") return <div className="min-w-0"><p className="truncate text-[12px] text-black/55" title={captador.email ?? undefined}>{captador.email || "—"}</p>{captador.telefone && <p className="truncate text-[10px] text-black/30">{captador.telefone}</p>}</div>;
    if (id === "prioridade") return <PrioBadge prio={captador.prioridade} size="sm" />;
    if (id === "carteira") return <div className="min-w-0"><p className="text-[12px] font-medium tabular-nums text-black/60">{captador.n_empresas} {captador.n_empresas === 1 ? "empresa" : "empresas"}</p><p className="mt-0.5 text-[10px] tabular-nums text-black/30">{captador.n_negociacoes_ativas} {captador.n_negociacoes_ativas === 1 ? "negociação ativa" : "negociações ativas"}</p></div>;
    if (id === "conversao") {
      const conversion = captador.n_encerradas > 0 ? Math.round((captador.n_aprovadas / captador.n_encerradas) * 100) : null;
      return <div><p className={`text-[12px] font-semibold tabular-nums ${conversion === null ? "text-black/25" : "text-black/65"}`}>{conversion === null ? "—" : `${conversion}%`}</p><p className="mt-0.5 text-[10px] tabular-nums text-black/30">{captador.n_encerradas > 0 ? `${captador.n_aprovadas} de ${captador.n_encerradas} encerradas` : "Sem amostra"}</p></div>;
    }
    if (id === "valor") return <span className="text-[12px] font-semibold text-black/60">{fmtValor(captador.valor_captado)}</span>;
    if (id === "proximo") return captador.proxima_atividade ? <div className="min-w-0"><p className="truncate text-[11px] font-medium text-black/60" title={captador.proxima_atividade.nome}>{captador.proxima_atividade.nome}</p><p className="mt-0.5 text-[10px] tabular-nums text-black/30">{fmtDate(captador.proxima_atividade.data_prevista)}</p></div> : <span className="text-[11px] text-[#B07A14]">Sem atividade</span>;
    if (id === "adicionado") return <span className="text-[11px] tabular-nums text-black/40">{fmtDate(captador.created_at)}</span>;
    if (id === "atualizado") return <span className="text-[11px] tabular-nums text-black/40">{fmtDate(captador.updated_at)}</span>;
    if (id === "score") return <CompactDecisionScoreRing score={captador.score} />;
    return (
      <div className="flex items-center justify-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
        {captador.email && <a href={`mailto:${captador.email}`} onClick={event => event.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded text-black/25 transition hover:bg-black/[.04] hover:text-black/60" title="Enviar e-mail"><Mail size={13} /></a>}
        <button type="button" onClick={event => { event.stopPropagation(); onEdit(captador); }} className="flex h-7 w-7 items-center justify-center rounded text-black/25 transition hover:bg-black/[.04] hover:text-black/60" title="Editar captador"><Pencil size={13} /></button>
        <button type="button" onClick={event => { event.stopPropagation(); onDelete(captador.id, captador.nome); }} className="flex h-7 w-7 items-center justify-center rounded text-black/20 transition hover:bg-red-50 hover:text-red-500" title="Excluir captador"><Trash2 size={13} /></button>
      </div>
    );
  }

  return (
    <div className="-mr-8 min-w-0 overflow-hidden rounded-l rounded-r-none border border-r-0 bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center border-b px-3 py-2" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <ColumnManager columns={manager.columns} hidden={manager.hidden} onToggle={manager.toggle} onMove={manager.move} onReset={manager.reset} />
      </div>
      <div className="overscroll-x-contain overflow-x-auto">
        <div style={{ minWidth: minimumWidth }}>
          <div className="grid items-center gap-4 border-b bg-black/[0.02] px-5 py-3" style={{ gridTemplateColumns: template, borderColor: "rgba(13,13,13,.06)" }}>
            {manager.visible.map(column => <div key={column.id}>{renderHeader(column.id)}</div>)}
          </div>

          {loading ? Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid items-center gap-4 border-b px-5 py-3.5 last:border-b-0" style={{ gridTemplateColumns: template, borderColor: "rgba(13,13,13,.05)" }}>
              {manager.visible.map((column, cell) => <div key={column.id} className="h-4 max-w-full animate-pulse rounded bg-black/8" style={{ width: cell === 0 ? 180 : 72 }} />)}
            </div>
          )) : captadores.map((captador, index) => (
            <div
              key={captador.id}
              onClick={() => router.push(`/captadores/${captador.id}`)}
              className="group grid cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-black/[0.02]"
              style={{ gridTemplateColumns: template, borderBottom: index < captadores.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
            >
              {manager.visible.map(column => <div key={column.id} className="min-w-0">{renderCell(column.id, captador)}</div>)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                PAGE                                        */
/* -------------------------------------------------------------------------- */

export default function CaptadoresPage() {
  const supabase       = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router         = useRouter();
  const organizationId = useOrganizationId();
  const [activeTab, setActiveTab] = useState<Tab>("equipe");
  const [userId, setUserId]       = useState<string | null>(null);

  // Equipe tab
  const [captadores, setCaptadores]   = useState<CaptadorRow[]>([]);
  const [loadingEquipe, setLoadingEquipe] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingCaptador, setEditingCaptador] = useState<CaptadorRow | null>(null);
  const [teamView, setTeamView]       = useState<TeamView>("list");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamPriority, setTeamPriority] = useState<TeamPriorityFilter>("todas");
  const [teamLink, setTeamLink] = useState<TeamLinkFilter>("todos");
  const [teamSortKey, setTeamSortKey] = useState<TeamSortKey>("empresas");
  const [teamSortDirection, setTeamSortDirection] = useState<SortDirection>("desc");

  // Meu Painel
  const [metricas, setMetricas] = useState<MetricasCaptador | null>(null);

  // Atribuições tab
  const [atribuicoes, setAtribuicoes]           = useState<AtribuicaoCompleta[]>([]);
  const [loadingAtribuicoes, setLoadingAtribuicoes] = useState(true);
  const [busca, setBusca]                       = useState("");
  const [filtroStatus, setFiltroStatus]         = useState<string>("todas");
  const [filtroExclusividade, setFiltroExclusividade] = useState<string>("todas");
  const [showAtribuicaoModal, setShowAtribuicaoModal] = useState(false);
  const [editData, setEditData]                       = useState<AtribuicaoCompleta | null>(null);
  const [assignmentView, setAssignmentView]           = useState<AssignmentView>("list");

  /* ---- Load user ---- */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, [supabase]);

  /* ---- Fetch Equipe ---- */
  const fetchEquipe = useCallback(async () => {
    if (!organizationId) { setLoadingEquipe(false); return; }
    setLoadingEquipe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: captadoresData }, { data: scoreData }] = await Promise.all([
      (supabase as any)
        .from("captadores")
        .select("*")
        .eq("organization_id", organizationId)
        .or("ativo.eq.true,ativo.is.null")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("captador_score_criterios")
        .select("captador_id,peso,nota")
        .eq("organization_id", organizationId),
    ]);

    if (!captadoresData) { setLoadingEquipe(false); return; }

    const captadorIds = (captadoresData as { id: string }[]).map(captador => captador.id);
    const today = new Date().toISOString().split("T")[0];
    const { data: activityData } = captadorIds.length
      ? await (supabase as any)
          .from("atividades")
          .select("captador_id,nome,data_prevista")
          .in("captador_id", captadorIds)
          .eq("feita", false)
          .not("data_prevista", "is", null)
          .gte("data_prevista", today)
          .order("data_prevista", { ascending: true })
      : { data: [] };
    const nextActivityByCaptador = new Map<string, { nome: string; data_prevista: string }>();
    for (const activity of activityData ?? []) {
      if (activity.captador_id && activity.data_prevista && !nextActivityByCaptador.has(activity.captador_id)) {
        nextActivityByCaptador.set(activity.captador_id, { nome: activity.nome, data_prevista: activity.data_prevista });
      }
    }

    const scoresByCaptador = new Map<string, CaptadorScoreRow[]>();
    for (const criterion of (scoreData ?? []) as CaptadorScoreRow[]) {
      const current = scoresByCaptador.get(criterion.captador_id) ?? [];
      current.push(criterion);
      scoresByCaptador.set(criterion.captador_id, current);
    }

    const rows = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (captadoresData as any[]).map(async (c) => {
        let n_captacoes = 0, n_aprovadas = 0, n_encerradas = 0, valor_captado = 0;
        let n_empresas = 0, n_negociacoes_ativas = 0;
        const captadorFilter = c.user_id
          ? `captador_externo_id.eq.${c.id},captador_id.eq.${c.user_id}`
          : `captador_externo_id.eq.${c.id}`;
        const { data: capData } = await (supabase as any)
          .from("captacoes")
          .select("status,valor_solicitado,valor_aprovado")
          .eq("organization_id", organizationId)
          .or(captadorFilter);
        const captacoes = (capData ?? []) as { status: string; valor_solicitado: number | null; valor_aprovado: number | null }[];
        n_captacoes = captacoes.length;
        n_aprovadas = captacoes.filter(captacao => captacao.status === "aprovado").length;
        n_encerradas = captacoes.filter(captacao => captacao.status === "aprovado" || captacao.status === "recusado").length;
        n_negociacoes_ativas = captacoes.filter(captacao => captacao.status !== "aprovado" && captacao.status !== "recusado").length;
        valor_captado = captacoes
          .filter(captacao => captacao.status === "aprovado")
          .reduce((sum, captacao) => sum + (captacao.valor_aprovado ?? captacao.valor_solicitado ?? 0), 0);
        // Buscar atribuições para contar empresas e negociações ativas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: attrData } = await (supabase as any)
          .from("atribuicoes")
          .select("empresa_crm_id, status")
          .eq("captador_user_id", c.id);
        if (attrData?.length) {
          const empresasUnicas = new Set(attrData.map((a: any) => a.empresa_crm_id).filter(Boolean));
          n_empresas = empresasUnicas.size;
        }
        return {
          id: c.id, nome: c.nome, email: c.email, telefone: c.telefone,
          agencia: c.agencia, logo_url: c.logo_url ?? null,
          identidade_tipo: c.identidade_tipo ?? null, identidade_valor: c.identidade_valor ?? null,
          identidade_logo_url: c.identidade_logo_url ?? null, identidade_cor: c.identidade_cor ?? null,
          prioridade: c.prioridade, user_id: c.user_id,
          created_at: c.created_at, updated_at: c.updated_at,
          n_captacoes, n_aprovadas, n_encerradas, valor_captado, n_empresas, n_negociacoes_ativas,
          proxima_atividade: nextActivityByCaptador.get(c.id) ?? null,
          score: calculateWeightedScore(scoresByCaptador.get(c.id) ?? []),
        } satisfies CaptadorRow;
      })
    );

    rows.sort((a, b) => b.n_captacoes - a.n_captacoes);
    setCaptadores(rows);
    setLoadingEquipe(false);
  }, [organizationId, supabase]);

  function handleDeleteCaptador(id: string, nome: string) {
    confirmDelete({
      title: `Excluir o captador “${nome}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "captadores", id, { vinculado: "Este captador ainda tem negociações ou atribuições vinculadas. Reatribua esses registros antes de excluí-lo." });
        setCaptadores(prev => prev.filter(c => c.id !== id));
      },
    });
  }

  /* ---- Fetch Métricas ---- */
  useEffect(() => {
    if (!userId || !organizationId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc("fn_metricas_captador", { p_user_id: userId, p_organization_id: organizationId })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => { if (data?.[0]) setMetricas(data[0]); });
  }, [userId, organizationId, supabase]);

  /* ---- Fetch Atribuições ---- */
  const fetchAtribuicoes = useCallback(async () => {
    setLoadingAtribuicoes(true);
    const { data } = await supabase
      .from("atribuicoes" as any)
      .select(`*, empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site), projeto:projetos_crm!projeto_id(id,nome), captador:captadores!captador_user_id(nome)`)
      .order("created_at", { ascending: false });
    setAtribuicoes((data as any) ?? []);
    setLoadingAtribuicoes(false);
  }, [supabase, organizationId]);

  /* ---- Load on mount ---- */
  useEffect(() => { fetchEquipe(); },       [fetchEquipe]);
  useEffect(() => { fetchAtribuicoes(); },  [fetchAtribuicoes]);

  /* ---- Filtered data ---- */
  const atribuicoesFiltradas = atribuicoes.filter(a => {
    if (filtroStatus !== "todas" && a.status !== filtroStatus) return false;
    if (filtroExclusividade !== "todas" && a.tipo !== filtroExclusividade) return false;
    if (busca) {
      const q = busca.toLowerCase();
      if (![a.empresa_crm?.nome, a.captador?.nome, a.projeto?.nome].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const normalizedTeamSearch = teamSearch.trim().toLocaleLowerCase("pt-BR");
  const captadoresFiltrados = captadores.filter(captador => {
    if (teamPriority !== "todas" && captador.prioridade !== teamPriority) return false;
    if (teamLink === "workspace" && !captador.user_id) return false;
    if (teamLink === "externos" && captador.user_id) return false;
    if (normalizedTeamSearch && ![
      captador.nome,
      captador.agencia,
      captador.email,
      captador.telefone,
    ].some(value => value?.toLocaleLowerCase("pt-BR").includes(normalizedTeamSearch))) return false;
    return true;
  }).sort((a, b) => {
    const direction = teamSortDirection === "asc" ? 1 : -1;
    if (teamSortKey === "nome") return direction * a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
    if (teamSortKey === "prioridade") {
      const rank: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
      return direction * ((rank[a.prioridade] ?? 0) - (rank[b.prioridade] ?? 0));
    }
    if (teamSortKey === "empresas") return direction * (a.n_empresas - b.n_empresas);
    if (teamSortKey === "conversao") {
      const aConversion = a.n_encerradas ? a.n_aprovadas / a.n_encerradas : -1;
      const bConversion = b.n_encerradas ? b.n_aprovadas / b.n_encerradas : -1;
      return direction * (aConversion - bConversion);
    }
    if (teamSortKey === "valor") return direction * (a.valor_captado - b.valor_captado);
    if (teamSortKey === "proximo") return direction * ((a.proxima_atividade?.data_prevista ?? "9999-12-31").localeCompare(b.proxima_atividade?.data_prevista ?? "9999-12-31"));
    if (teamSortKey === "score") return direction * ((a.score ?? -1) - (b.score ?? -1));
    return 0;
  });
  const teamFiltersActive = Boolean(teamSearch.trim()) || teamPriority !== "todas" || teamLink !== "todos";

  function clearTeamFilters() {
    setTeamSearch("");
    setTeamPriority("todas");
    setTeamLink("todos");
  }

  function handleTeamSort(key: TeamSortKey) {
    if (teamSortKey === key) {
      setTeamSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }
    setTeamSortKey(key);
    setTeamSortDirection(key === "nome" ? "asc" : "desc");
  }

  const statsAtribuicoes = {
    total:    atribuicoes.length,
    ativas:   atribuicoes.filter(a => a.status === "ativa").length,
    emRisco:  atribuicoes.filter(a => a.status === "ativa" && (a.dias_sem_avanco ?? 0) > 60).length,
    expiradas:atribuicoes.filter(a => a.status === "expirada").length,
  };

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "equipe",      label: "Equipe",      icon: UserCheck },
    { key: "atribuicoes", label: "Atribuições", icon: Shield },
  ];

  /* -------------------------------------------------------------------------- */
  /*                                RENDER                                      */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-8 pt-8 pb-5 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-bold text-[#0D0D0D] text-[28px]">Captadores</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Visualizações da equipe */}
            {activeTab === "equipe" && !loadingEquipe && captadores.length > 0 && (
              <div className="flex items-center border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                <button
                  onClick={() => setTeamView("list")}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition"
                  style={{ background: teamView === "list" ? "#0D0D0D" : "transparent", color: teamView === "list" ? "white" : "rgba(13,13,13,.4)" }}
                >
                  <List size={12} /> Lista
                </button>
                <button
                  onClick={() => setTeamView("cards")}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition border-l"
                  style={{ background: teamView === "cards" ? "#0D0D0D" : "transparent", color: teamView === "cards" ? "white" : "rgba(13,13,13,.4)", borderColor: "rgba(13,13,13,.12)" }}
                >
                  <LayoutGrid size={12} /> Cards
                </button>
              </div>
            )}

            {/* Visualizações das atribuições */}
            {activeTab === "atribuicoes" && !loadingAtribuicoes && atribuicoes.length > 0 && (
              <div className="flex items-center overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                <button
                  onClick={() => setAssignmentView("list")}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition"
                  style={{ background: assignmentView === "list" ? "#0D0D0D" : "transparent", color: assignmentView === "list" ? "white" : "rgba(13,13,13,.4)" }}
                >
                  <List size={12} /> Lista
                </button>
                <button
                  onClick={() => setAssignmentView("cluster")}
                  className="flex items-center gap-1.5 border-l px-3 py-2 text-[11px] font-semibold transition"
                  style={{ background: assignmentView === "cluster" ? "#0D0D0D" : "transparent", color: assignmentView === "cluster" ? "white" : "rgba(13,13,13,.4)", borderColor: "rgba(13,13,13,.12)" }}
                >
                  <Network size={12} /> Cluster
                </button>
              </div>
            )}

            {activeTab === "equipe" && !loadingEquipe && (
              <span className="text-sm text-black/40">
                <span className="font-bold text-black">{captadoresFiltrados.length}</span> {captadoresFiltrados.length === 1 ? "agência" : "agências"}
              </span>
            )}
            {activeTab === "equipe" && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-white border rounded hover:bg-black/5 transition"
                style={{ borderColor: "rgba(13,13,13,.12)" }}
              >
                <Plus size={14} /> Nova agência
              </button>
            )}
            {activeTab === "atribuicoes" && (
              <button onClick={() => { setEditData(null); setShowAtribuicaoModal(true); }}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-white border rounded hover:bg-black/5 transition"
                style={{ borderColor: "rgba(13,13,13,.12)" }}>
                <Plus size={14} /> Nova Atribuição
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-6 -mb-px">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition"
              style={{ borderColor: activeTab === key ? "#7259B5" : "transparent", color: activeTab === key ? "#7259B5" : "rgba(13,13,13,.4)" }}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto px-8 py-6">

        {/* ═══ EQUIPE ═══ */}
        {activeTab === "equipe" && (
          <div className="space-y-6">
            {!loadingEquipe && captadores.length > 0 && (
              <div className="flex flex-col gap-3 rounded border border-black/[.08] bg-white p-3 lg:flex-row lg:items-center">
                <label className="relative block min-w-0 flex-1 lg:max-w-[360px]">
                  <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                  <input
                    type="search"
                    value={teamSearch}
                    onChange={event => setTeamSearch(event.target.value)}
                    placeholder="Buscar captador, agência ou contato"
                    className="h-9 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-[12px] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/10"
                  />
                </label>

                <div className="flex max-w-full items-center gap-2 overflow-x-auto lg:ml-auto">
                  <SegmentedControl value={teamPriority} onChange={setTeamPriority} ariaLabel="Filtrar por prioridade" options={[{ value: "todas", label: "Prioridade" }, { value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }]} />

                  <SegmentedControl value={teamLink} onChange={setTeamLink} ariaLabel="Filtrar por vínculo" options={[{ value: "todos", label: "Todos" }, { value: "workspace", label: "Workspace" }, { value: "externos", label: "Externos" }]} />

                  {teamFiltersActive && (
                    <button type="button" onClick={clearTeamFilters} className="h-9 shrink-0 rounded px-2.5 text-[11px] font-medium text-black/35 transition hover:bg-black/[.04] hover:text-black/60">
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Meu Painel */}
            {metricas && (
              <div className="rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)", background: "white" }}>
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={14} className="text-[#7259B5]" />
                  <span className="text-[12px] font-bold text-black">Meu Painel</span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label:"Score", value: `${metricas.score_atividade}`, sub:"/100", color: getScoreColor(metricas.score_atividade) },
                    { label:"Ativas", value: `${metricas.captações_ativas}`, sub: `${metricas.captações_ganhas} ganhas · ${metricas.captações_perdidas} perdidas`, color:"#7259B5" },
                    { label:"Em Risco", value: `${metricas.empresas_em_risco}`, sub:`${metricas.dias_sem_avanco}d sem avanço`, color: getRiskColor(metricas.dias_sem_avanco) },
                    { label:"Minhas Empresas", value: `${metricas.empresas_atribuidas}`, sub:`${metricas.total_captações} captações total`, color:"#0D0D0D" },
                  ].map(m => (
                    <div key={m.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">{m.label}</p>
                      <p className="text-[24px] font-bold" style={{ color: m.color }}>{m.value}</p>
                      <p className="text-[10px] text-black/30">{m.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-black/40">Taxa de conversão</span>
                    <span className="text-[12px] font-bold text-black">
                      {metricas.total_captações > 0 ? Math.round((metricas.captações_ganhas / metricas.total_captações) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(13,13,13,.06)" }}>
                    <div className="h-full rounded-full" style={{ width: `${metricas.total_captações > 0 ? (metricas.captações_ganhas / metricas.total_captações) * 100 : 0}%`, background: "#2E8932" }} />
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {captadores.length === 0 && !loadingEquipe ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-14 h-14 rounded flex items-center justify-center mb-4" style={{ background: "rgba(13,13,13,.04)" }}>
                  <UserCheck size={22} className="text-black/25" />
                </div>
                <p className="text-[15px] font-semibold text-black/40 mb-1">Nenhuma agência cadastrada</p>
                <p className="text-sm text-black/25 mb-4">Adicione agências de captação para começar</p>
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white border rounded hover:bg-black/5 transition"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}>
                  <Plus size={14} /> Adicionar Agência
                </button>
              </div>
            ) : captadoresFiltrados.length === 0 && !loadingEquipe ? (
              <div className="rounded border border-black/[.08] bg-white px-5 py-16 text-center">
                <Search size={22} className="mx-auto text-black/15" />
                <p className="mt-3 text-[13px] font-semibold text-black/45">Nenhum captador encontrado</p>
                <button type="button" onClick={clearTeamFilters} className="mt-3 rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[11px] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
                  Limpar filtros
                </button>
              </div>
            ) : teamView === "cards" ? (

              /* Etiqueta estrutural: Lista CRM — captadores em cartões */
              <div className="grid grid-cols-3 gap-4">
                {loadingEquipe
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded border p-5 animate-pulse" style={{ borderColor: "rgba(13,13,13,.07)", background: "linear-gradient(145deg, #ffffff 0%, #f7f7f6 100%)" }}>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-11 h-11 rounded bg-black/8 flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-28 bg-black/8 rounded" />
                          <div className="h-2.5 w-16 bg-black/8 rounded" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                        {[1,2,3].map(j => <div key={j} className="space-y-1"><div className="h-2 w-12 bg-black/8 rounded" /><div className="h-5 w-8 bg-black/8 rounded" /></div>)}
                      </div>
                    </div>
                  ))
                  : captadoresFiltrados.map(c => {
                    return (
                      <div
                        key={c.id}
                        className="rounded border p-5 hover:shadow-md transition cursor-default group"
                        style={{
                          borderColor: "rgba(13,13,13,.08)",
                          background: "linear-gradient(145deg, #ffffff 0%, #f7f7f6 100%)",
                        }}
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <ProjectIdentity
                              nome={c.nome}
                              tipo={c.identidade_tipo ?? (c.logo_url ? "logo" : "padrao")}
                              valor={c.identidade_valor}
                              logoUrl={c.identidade_logo_url ?? c.logo_url}
                              cor={c.identidade_cor}
                              iconOptions={CAPTADOR_ICON_OPTIONS}
                            />
                            <div>
                              <Link href={`/captadores/${c.id}`} className="text-[15px] font-bold text-[#0D0D0D] leading-tight hover:text-[#7259B5] transition">{c.nome}</Link>
                              {c.agencia && (
                                <p className="text-[11px] text-black/35 mt-0.5">{c.agencia}</p>
                              )}
                            </div>
                          </div>
                          <PrioBadge prio={c.prioridade} size="sm" />
                        </div>

                        {/* Meta grid */}
                        <div className="grid grid-cols-3 gap-2 text-[10px] mb-3">
                          <div>
                            <p className="text-black/35 font-semibold uppercase tracking-wide mb-0.5">Empresas</p>
                            <p className="text-[20px] font-bold leading-tight" style={{ color: c.n_empresas > 0 ? "#0D0D0D" : "rgba(13,13,13,.2)" }}>{c.n_empresas}</p>
                          </div>
                          <div>
                            <p className="text-black/35 font-semibold uppercase tracking-wide mb-0.5">Negociações</p>
                            <p className="text-[20px] font-bold leading-tight" style={{ color: c.n_negociacoes_ativas > 0 ? "#2E8932" : "rgba(13,13,13,.2)" }}>{c.n_negociacoes_ativas}</p>
                          </div>
                          <div>
                            <p className="text-black/35 font-semibold uppercase tracking-wide mb-0.5">Valor Captado</p>
                            <p className="text-[13px] font-bold leading-tight mt-1" style={{ color: c.valor_captado > 0 ? "#0D0D0D" : "rgba(13,13,13,.2)" }}>{fmtValor(c.valor_captado)}</p>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                          <div>
                            {c.user_id && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded text-white" style={{ background: "#2E8932" }}>
                                <Check size={9} /> Workspace
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {c.email && (
                              <a
                                href={`mailto:${c.email}`}
                                className="inline-flex items-center gap-1.5 text-black/40 hover:text-black/70 text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap border opacity-0 group-hover:opacity-100 transition-all duration-150"
                                style={{ borderColor: "rgba(13,13,13,.15)" }}
                                onClick={ev => ev.stopPropagation()}
                              >
                                <Mail size={11} /> Contato
                              </a>
                            )}
                            <button
                              className="inline-flex items-center gap-1.5 text-black/40 hover:text-black/70 text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap border opacity-0 group-hover:opacity-100 transition-all duration-150"
                              style={{ borderColor: "rgba(13,13,13,.15)" }}
                              onClick={ev => { ev.stopPropagation(); setEditingCaptador(c); }}
                            >
                              <Pencil size={11} /> Editar
                            </button>
                            <button
                              className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-600 text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap border border-red-200 opacity-0 group-hover:opacity-100 transition-all duration-150"
                              onClick={ev => { ev.stopPropagation(); handleDeleteCaptador(c.id, c.nome); }}
                            >
                              <Trash2 size={11} /> Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>

            ) : (
              <CaptadoresList
                captadores={captadoresFiltrados}
                loading={loadingEquipe}
                onEdit={setEditingCaptador}
                onDelete={handleDeleteCaptador}
                sortKey={teamSortKey}
                sortDirection={teamSortDirection}
                onSort={handleTeamSort}
              />
            )}
          </div>
        )}

        {/* ═══ ATRIBUIÇÕES ═══ */}
        {activeTab === "atribuicoes" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 overflow-hidden rounded border border-black/[.08] bg-white sm:grid-cols-4">
              {[
                { label:"Total",    value:statsAtribuicoes.total,    color:"#0D0D0D" },
                { label:"Ativas",   value:statsAtribuicoes.ativas,   color:"#1A8B7A" },
                { label:"Em risco", value:statsAtribuicoes.emRisco,  color:statsAtribuicoes.emRisco > 0 ? "#A66B10" : "rgba(13,13,13,.28)" },
                { label:"Expiradas",value:statsAtribuicoes.expiradas,color:statsAtribuicoes.expiradas > 0 ? "#C84242" : "rgba(13,13,13,.28)" },
              ].map((s, index) => (
                <div
                  key={s.label}
                  className={`relative px-5 py-4 sm:px-6 sm:py-5 ${index % 2 ? "border-l" : ""} ${index >= 2 ? "border-t sm:border-t-0" : ""} ${index > 0 ? "sm:border-l" : ""}`}
                  style={{ borderColor: "rgba(13,13,13,.065)" }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[.09em] text-black/32">{s.label}</p>
                  <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums tracking-[-.035em]" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/25" />
                <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                  placeholder="Buscar empresa, captador..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
                  style={{ borderColor: "rgba(13,13,13,.12)" }} />
              </div>
              <div className="flex rounded overflow-hidden border bg-white" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                {[{ value: "todas", label: "Status" }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map(({ value, label }, i, arr) => (
                  <button key={value} onClick={() => setFiltroStatus(value)}
                    className={`px-3 py-2 text-xs font-normal transition ${i < arr.length - 1 ? "border-r" : ""} ${filtroStatus === value ? "relative z-10 bg-white text-[#7259B5] shadow-[inset_0_0_0_1px_#7259B5]" : "text-black/40 hover:bg-black/[.04] hover:text-black/70"}`}
                    style={{ borderColor: "rgba(13,13,13,.12)" }}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex rounded overflow-hidden border bg-white" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                {[{ value: "todas", label: "Exclusividade" }, ...FILTRO_EXCLUSIVIDADE].map(({ value, label }, i, arr) => (
                  <button key={value} onClick={() => setFiltroExclusividade(value)}
                    className={`px-3 py-2 text-xs font-normal transition ${i < arr.length - 1 ? "border-r" : ""} ${filtroExclusividade === value ? "relative z-10 bg-white text-[#7259B5] shadow-[inset_0_0_0_1px_#7259B5]" : "text-black/40 hover:bg-black/[.04] hover:text-black/70"}`}
                    style={{ borderColor: "rgba(13,13,13,.12)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadingAtribuicoes ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-black/[0.03] rounded animate-pulse" />)}</div>
            ) : atribuicoesFiltradas.length === 0 ? (
              <div className="bg-white rounded border p-12 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <Shield size={32} className="mx-auto text-black/10 mb-3" />
                <p className="text-sm text-black/30 mb-1">Nenhuma atribuição encontrada</p>
                <p className="text-xs text-black/20">Crie uma atribuição para começar</p>
              </div>
            ) : assignmentView === "cluster" ? (
              /* Etiqueta estrutural: Rede de atribuições — captadores e empresas */
              <div className="relative overflow-hidden rounded border bg-white" style={{ height: 560, borderColor: "rgba(13,13,13,.08)" }}>
                <BipartiteGraph
                  captadores={captadores.map(c => ({
                    id: c.id,
                    nome: c.nome,
                    prioridade: c.prioridade,
                    n_captacoes: c.n_captacoes,
                    n_aprovadas: c.n_aprovadas,
                    valor_captado: c.valor_captado,
                    logo_url: c.identidade_tipo === "logo"
                      ? (c.identidade_logo_url ?? c.logo_url)
                      : c.logo_url,
                  }))}
                  conexoes={atribuicoesFiltradas.flatMap(a => a.empresa_crm ? [{
                    captador_id: a.captador_user_id,
                    empresa: {
                      id: a.empresa_crm.id,
                      nome: a.empresa_crm.nome,
                      domain_key: a.empresa_crm.domain_key,
                      site: a.empresa_crm.site,
                    },
                    status: a.status,
                  }] : [])}
                />
              </div>
            ) : (
              <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.6fr] gap-4 px-5 py-3 border-b bg-black/[0.02]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                  {["Empresa","Captador","Exclusividade","Projeto","Status","Último Avanço","Ações"].map(h => (
                    <span key={h} className={`text-[10px] font-medium uppercase tracking-[.08em] text-black/35 ${h==="Ações"?"text-right":""}`}>{h}</span>
                  ))}
                </div>
                {atribuicoesFiltradas.map(a => {
                  const exc = EXCLUSAO_CONFIG[a.tipo] ?? { label: a.tipo, bg: "rgba(13,13,13,.35)", icon: Shield }, st = STATUS_CONFIG[a.status], ExcIcon = exc.icon;
                  const emRisco = a.status === "ativa" && (a.dias_sem_avanco ?? 0) > 60;
                  return (
                    <div
                      key={a.id}
                      role={a.empresa_crm_id ? "link" : undefined}
                      tabIndex={a.empresa_crm_id ? 0 : undefined}
                      onClick={() => { if (a.empresa_crm_id) router.push(`/empresas-crm/${a.empresa_crm_id}`); }}
                      onKeyDown={event => { if (a.empresa_crm_id && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); router.push(`/empresas-crm/${a.empresa_crm_id}`); } }}
                      className={`grid grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr_0.8fr_0.6fr] items-center gap-4 border-b px-5 py-4 transition last:border-b-0 hover:bg-black/[0.015] ${a.empresa_crm_id ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7259B5]/30" : ""}`}
                      style={{ borderColor: "rgba(13,13,13,.04)" }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CompanyLogo
                          nome={a.empresa_crm?.nome ?? "Empresa"}
                          domain={a.empresa_crm?.domain_key}
                          site={a.empresa_crm?.site}
                          size={32}
                          className="flex-shrink-0"
                        />
                        <span className="truncate text-[13px] font-semibold text-[#0D0D0D]">
                          {a.empresa_crm?.nome || "—"}
                        </span>
                      </div>
                      <span className="text-[12px] text-black/60 truncate">{a.captador?.nome || "—"}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold w-fit text-white" style={{ background: exc.bg }}>
                        <ExcIcon size={10} />{exc.label}
                      </span>
                      <span className="text-[12px] text-black/50 truncate">{a.projeto?.nome || "Todos"}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold w-fit text-white" style={{ background: st.bg }}>{st.label}</span>
                      <div className="flex items-center gap-1.5">
                        {emRisco && <AlertTriangle size={12} className="text-[#B07A14]" />}
                        <span className={`text-[12px] ${emRisco?"text-[#B07A14] font-semibold":"text-black/40"}`}>{formatDias(a.dias_sem_avanco)}</span>
                      </div>
                      <div className="flex items-center justify-end">
                        <button onClick={(event) => { event.stopPropagation(); setEditData(a); setShowAtribuicaoModal(true); }} className="p-1.5 rounded hover:bg-black/6 text-black/30 hover:text-black/70 transition">
                          <ArrowUpDown size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ TRANSFERÊNCIAS ═══ */}
      </div>

      {/* ── Modals ── */}
      <AdicionarCaptadorModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchEquipe(); }} />
      {editingCaptador && (
        <AdicionarCaptadorModal
          open
          editData={{
            id: editingCaptador.id,
            nome: editingCaptador.nome,
            prioridade: editingCaptador.prioridade as "alta" | "media" | "baixa",
            logo_url: editingCaptador.logo_url,
            identidade_tipo: editingCaptador.identidade_tipo,
            identidade_valor: editingCaptador.identidade_valor,
            identidade_logo_url: editingCaptador.identidade_logo_url,
            identidade_cor: editingCaptador.identidade_cor,
            email: editingCaptador.email,
            telefone: editingCaptador.telefone,
            agencia: editingCaptador.agencia,
          }}
          onClose={() => setEditingCaptador(null)}
          onSaved={() => { setEditingCaptador(null); fetchEquipe(); }}
        />
      )}
      {showAtribuicaoModal && (
        <NovaAtribuicaoModal
          editData={editData}
          onClose={() => { setShowAtribuicaoModal(false); setEditData(null); }}
          onSaved={() => { setShowAtribuicaoModal(false); setEditData(null); fetchAtribuicoes(); }}
        />
      )}
    </div>
  );
}
