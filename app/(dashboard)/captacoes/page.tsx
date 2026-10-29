"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowUpRight, BriefcaseBusiness, Building2, Calendar, List, Columns2, Scale, Trash2, Search, Clock3, CheckCircle2, ChevronUp, ChevronDown, ChevronsUpDown, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import type { StatusCaptacao, MeioContato, OrigemOportunidade, CanalContato } from "@/lib/supabase/types";
import { NovaCaptacaoModal, type EditDataCaptacao } from "@/components/modals/NovaCaptacaoModal";
import StatusBadge from "@/components/ui/StatusBadge";
import PrioBadge from "@/components/ui/PrioBadge";
import { StatusDropdown } from "@/components/ui/StatusDropdown";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { PotentialKanban, type PotencialFechamento } from "@/components/kanban/PotentialKanban";
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanEmpty, KanbanSkeleton } from "@/components/kanban/KanbanPrimitives";
import { useIncrementalReveal, RevealSentinel } from "@/components/kanban/useIncrementalReveal";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { FiltrosDoFunil } from "@/components/list/FiltrosDoFunil";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { opcoesDoFiltro, passaNoFiltro, TODOS, type Marcador } from "@/lib/filtros-do-funil";
import { ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { useLeiOptions } from "@/hooks/useLeiOptions";
import { escalaUi } from "@/lib/escala-ui";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { DESFECHOS_NEGOCIACAO, ehDesfecho } from "@/lib/etapas";
import { FecharNegocioSheet, useRecusarNegociacao } from "@/components/captacoes/FechamentoNegociacao";

const CAPTACOES_COLUMNS = [
  { id: "empresa", label: "Empresa", width: "13.75rem", grow: true, hideable: false }, { id: "titulo", label: "Projeto", width: "15.625rem", grow: true }, { id: "lei", label: "Tipo de patrocínio", width: "10.3125rem" }, { id: "status", label: "Status", width: "8.75rem", hideable: false }, { id: "valor", label: "Valor", width: "7.5rem" }, { id: "prioridade", label: "Prioridade", width: "6.875rem" }, { id: "responsavel", label: "Responsável", width: "11.25rem" }, { id: "agencia", label: "Agência", width: "10rem" }, { id: "contato", label: "Próx. contato", width: "8.75rem" }, { id: "adicionado_em", label: "Adicionado em", width: "7.8125rem" }, { id: "atualizado_em", label: "Atualizado em", width: "7.8125rem" }, { id: "acoes", label: "Ações", width: "5rem" },
] as const satisfies readonly ColumnDefinition[];

type CaptacaoRow = {
  id: string;
  titulo: string | null;
  lei: string | null;
  valor_solicitado: number | null;
  status: StatusCaptacao;
  prioridade: "alta" | "media" | "baixa" | null;
  potencial_fechamento: PotencialFechamento | null;
  proxima_prospeccao: string | null;
  empresa_crm_id: string | null;
  projeto_id: string | null;
  meio_contato: MeioContato | null;
  origem_oportunidade: OrigemOportunidade | null;
  canal_planejado: CanalContato | null;
  data_previsao: string | null;
  captador_id: string | null;
  supervisor_id: string | null;
  captador_externo_id: string | null;
  contato_empresa_id: string | null;
  ciclo_ano: number | null;
  ciclo_anterior_id: string | null;
  created_at: string;
  updated_at: string;
  empresa_pub: { nome: string; logo_url: string | null; site: string | null } | null;
  empresa_crm: { nome: string; domain_key: string | null; site: string | null } | null;
  projeto: { nome: string; identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null; identidade_valor: string | null; identidade_logo_url: string | null; identidade_cor: string | null } | null;
  captador_externo: { nome: string; agencia: string | null } | null;
};

type ViewMode = "kanban" | "list" | "potential";
type PipelineFilter = "todas" | "abertas" | "fechadas" | "recentes";
type AtividadeIndicador = { nome: string; atrasada: boolean; dias: number; responsavel: string | null };

// COLUNAS agora vem do EtiquetasContext (ver abaixo no componente)

// STATUS_MAP é gerado dinamicamente dentro do componente via useEtiquetas()

const CAPTACOES_SELECT = `
  id, titulo, lei, valor_solicitado, status, prioridade, potencial_fechamento, proxima_prospeccao, created_at, updated_at,
  ciclo_ano, ciclo_anterior_id,
  empresa_crm_id, projeto_id, meio_contato, origem_oportunidade, canal_planejado, data_previsao,
  captador_id, supervisor_id, captador_externo_id, contato_empresa_id,
  empresa_pub:empresas!empresa_id(nome, logo_url, site),
  empresa_crm:empresas_crm!empresa_crm_id(nome, domain_key, site),
  projeto:projetos_crm!projeto_id(nome, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor),
  captador_externo:captadores!captador_externo_id(nome, agencia)
`;

const CAPTACOES_SELECT_LEGACY = CAPTACOES_SELECT
  .replace("potencial_fechamento, ", "")
  .replace("origem_oportunidade, canal_planejado, ", "")
  .replace(", captador_externo_id,", "")
  .replace(",\n  captador_externo:captadores!captador_externo_id(nome, agencia)", "");

function fmtValor(v: number | null): string {
  return v ? formatarValorCurto(v) : "—";
}

function fmtShortDate(d: string | null): string {
  if (!d) return "";
  const parts = d.split("T")[0].split("-");
  return `${parts[2]}/${parts[1]}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [year, month, day] = d.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

function updateRecency(value: string | null): { label: string; color: string; days: number } | null {
  if (!value) return null;
  const updatedAt = new Date(value).getTime();
  if (Number.isNaN(updatedAt)) return null;
  const days = Math.max(0, Math.floor((Date.now() - updatedAt) / 86_400_000));

  if (days <= 20) return { label: "Quente", color: "#2E8932", days };
  if (days <= 45) return { label: "Em andamento", color: "#2D72B0", days };
  if (days <= 75) return { label: "Esfriando", color: "#B07A14", days };
  if (days <= 120) return { label: "Perdendo o timing", color: "#C15F24", days };
  return { label: "Frio / risco de perda", color: "#D94E4E", days };
}

function colorFrom(nome: string): string {
  const palette = [
    "#2E8932","#7259B5","#B07A14","#2D72B0","#1A8B7A",
    "#D94E4E","#B07A14","#2D72B0","#2E8932","#7259B5","#D94E4E",
  ];
  let h = 0;
  for (const c of nome) h = c.charCodeAt(0) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function colSum(deals: CaptacaoRow[]): number {
  return deals.reduce((s, d) => s + (d.valor_solicitado ?? 0), 0);
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded p-3.5 border animate-pulse" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="h-2.5 w-3/4 bg-black/8 rounded mb-2" />
      <div className="h-3.5 w-full bg-black/8 rounded mb-2" />
      <div className="h-3.5 w-2/3 bg-black/8 rounded mb-3" />
      <div className="flex justify-between">
        <div className="h-4 w-16 bg-black/8 rounded-full" />
        <div className="h-4 w-12 bg-black/8 rounded" />
      </div>
    </div>
  );
}


// Botões de controle: visualização das negociações.
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <SegmentedControl
      value={view}
      onChange={onChange}
      ariaLabel="Visualização das negociações"
      iconOnly
      options={[
        { value: "list", icon: List, ariaLabel: "Lista" },
        { value: "kanban", icon: Columns2, ariaLabel: "Kanban" },
        { value: "potential", icon: Scale, ariaLabel: "Potencial de fechamento" },
      ]}
    />
  );
}

type MembroMap = Record<string, { nome: string; initial: string }>;

function getInitialCap(nome: string) {
  return nome.charAt(0).toUpperCase();
}

export default function CaptacoesPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const { recusar, novoCicloSheet } = useRecusarNegociacao();
  const [fechando, setFechando] = useState<CaptacaoRow | null>(null);
  const router = useRouter();
  const organizationId = useOrganizationId();
  const { options: leiOptions, create: createLei } = useLeiOptions();
  const leiMap = Object.fromEntries(leiOptions.map(option => [option.status, {
    label: option.label,
    bg: "#fff",
    text: option.bg,
  }]));
  const { etiquetas } = useEtiquetas();
  const COLUNAS = etiquetas.map(e => ({ status: e.key as StatusCaptacao, label: e.label, accent: e.cor, iconName: e.icone }));
  const STATUS_MAP = Object.fromEntries(COLUNAS.map(c => [c.status, c]));

  const [captacoes, setCaptacoes] = useState<CaptacaoRow[]>([]);
  const [membros, setMembros]     = useState<MembroMap>({});
  const [atividadesPorCaptacao, setAtividadesPorCaptacao] = useState<Record<string, AtividadeIndicador>>({});
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<ViewMode>("list");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("todas");
  const [cicloFiltro, setCicloFiltro] = useState<string>("atual");
  const [cicloMenuPos, setCicloMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  // O link "Ver na lista" da página da pessoa da equipe chega com ?responsavel=.
  const [filtroResponsavel, setFiltroResponsavel] = useState(
    () => {
      const doEndereco = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("responsavel");
      return doEndereco ? `membro:${doEndereco}` : TODOS;
    },
  );
  const [filtroLei, setFiltroLei] = useState(TODOS);
  const [filtroProjeto, setFiltroProjeto] = useState(TODOS);
  const [recentCutoff, setRecentCutoff] = useState<number | null>(null);
  const [showModal, setShowModal]           = useState(false);
  const [preStatus, setPreStatus]           = useState<StatusCaptacao>("prospeccao");
  const [editingRecord, setEditingRecord]   = useState<CaptacaoRow | null>(null);
  const [statusMenuId, setStatusMenuId]     = useState<string | null>(null);
  const [menuPos, setMenuPos]               = useState<{ top: number; left: number } | null>(null);
  const [leiMenuId, setLeiMenuId]           = useState<string | null>(null);
  const [leiMenuPos, setLeiMenuPos]         = useState<{ top: number; left: number } | null>(null);
  const [draggingId, setDraggingId]         = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<StatusCaptacao | null>(null);
  const { getVisible, reveal } = useIncrementalReveal(20);
  const [prePotential, setPrePotential] = useState<PotencialFechamento | undefined>();

  async function handleLeiUpdate(id: string, lei: CaptacaoRow["lei"]) {
    const previous = captacoes;
    setCaptacoes(prev => prev.map(c => c.id === id ? { ...c, lei } : c));
    setLeiMenuId(null); setLeiMenuPos(null);
    const { error } = await (supabase as any).from("captacoes").update({ lei }).eq("id", id);
    if (error) setCaptacoes(previous);
  }

  function handleDelete(id: string, nome: string) {
    confirmDelete({
      title: nome ? `Excluir a negociação “${nome}”?` : "Excluir a negociação?",
      description: "O histórico e os documentos da negociação são apagados. Atividades, notas e propostas continuam salvas, sem o vínculo. Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "captacoes", id);
        setCaptacoes(prev => prev.filter(c => c.id !== id));
      },
    });
  }

  async function moveCard(id: string, newStatus: StatusCaptacao) {
    // Desfecho tem fluxo próprio: aprovar pede o valor fechado; recusar, confirmação.
    if (newStatus === "aprovado") {
      const alvo = captacoes.find(c => c.id === id);
      if (alvo && alvo.status !== "aprovado") setFechando(alvo);
      return;
    }
    if (newStatus === "recusado") {
      if (captacoes.find(c => c.id === id)?.status !== "recusado") recusar(id, refetch);
      return;
    }
    const previous = captacoes;
    setCaptacoes(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    const { error } = await (supabase as any).from("captacoes").update({ status: newStatus }).eq("id", id);
    if (error) setCaptacoes(previous);
  }

  async function movePotential(id: string, potencial_fechamento: PotencialFechamento) {
    const previous = captacoes;
    setCaptacoes(prev => prev.map(c => c.id === id ? { ...c, potencial_fechamento } : c));
    const { error } = await (supabase as any)
      .from("captacoes")
      .update({ potencial_fechamento })
      .eq("id", id);
    if (error) {
      setCaptacoes(previous);
      return false;
    }
    return true;
  }

  async function fetchCaptacoes() {
    let result = await supabase.from("captacoes").select(CAPTACOES_SELECT).order("created_at", { ascending: false });
    if (result.error) {
      result = await supabase.from("captacoes").select(CAPTACOES_SELECT_LEGACY).order("created_at", { ascending: false });
    }
    if (!result.data) return [] as CaptacaoRow[];
    return (result.data as unknown as Array<Omit<CaptacaoRow, "potencial_fechamento"> & { potencial_fechamento?: PotencialFechamento | null }>)
      .map(item => ({ ...item, potencial_fechamento: item.potencial_fechamento ?? "medio" }));
  }

  // /captacoes?novo=1 (vindo dos primeiros passos) abre o cadastro direto.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowModal(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await fetchCaptacoes();

      setCaptacoes(data);

      // Indicador de atividade: pega a atividade pendente mais próxima de cada negociação
      const ids = data.map(c => c.id);
      if (ids.length > 0) {
        const { data: atividadesData } = await (supabase as any)
          .from("atividades")
          .select("captacao_id, nome, data_prevista, responsavel:profiles!responsavel_id(full_name)")
          .in("captacao_id", ids)
          .eq("feita", false)
          .not("data_prevista", "is", null)
          .order("data_prevista", { ascending: true });

        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const map: Record<string, AtividadeIndicador> = {};
        for (const a of (atividadesData ?? []) as any[]) {
          if (map[a.captacao_id]) continue; // já achou a mais próxima dessa negociação
          const prevista = new Date(a.data_prevista);
          prevista.setHours(0, 0, 0, 0);
          const dias = Math.round((prevista.getTime() - hoje.getTime()) / 86_400_000);
          map[a.captacao_id] = { nome: a.nome, atrasada: dias < 0, dias: Math.abs(dias), responsavel: a.responsavel?.full_name ?? null };
        }
        setAtividadesPorCaptacao(map);
      } else {
        setAtividadesPorCaptacao({});
      }

      // Carrega membros via API (mesmo mecanismo do modal)
      if (organizationId) {
        try {
          const members = await fetchOrganizationMembers(organizationId);
          const map: MembroMap = {};
          for (const m of members) {
            const nome = m.full_name || m.email?.split("@")[0] || m.user_id.slice(0, 6);
            map[m.user_id] = { nome, initial: getInitialCap(nome) };
          }
          setMembros(map);
        } catch {
          // silently ignore — avatares ficam em branco
        }
      }

      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  useEffect(() => {
    setRecentCutoff(Date.now() - 30 * 86_400_000);
  }, []);

  // Ciclos antigos: uma renovação cria um NOVO registro apontando pro anterior via
  // ciclo_anterior_id — "é o ciclo atual" = nenhum outro registro carregado aponta pra ele.
  // Anos disponíveis vêm sempre dos próprios dados carregados — nunca uma lista fixa,
  // já que a pessoa pode criar quantos ciclos futuros quiser via renovação.
  const idsComRenovacaoMaisNova = new Set(captacoes.map(c => c.ciclo_anterior_id).filter(Boolean));
  const anosDisponiveis = [...new Set(captacoes.map(c => c.ciclo_ano).filter((v): v is number => v != null))].sort((a, b) => b - a);
  const captacoesVisiveis = cicloFiltro === "todos"
    ? captacoes
    : cicloFiltro === "atual"
    ? captacoes.filter(c => !idsComRenovacaoMaisNova.has(c.id))
    : captacoes.filter(c => c.ciclo_ano === Number(cicloFiltro));

  // Busca, responsável, tipo de patrocínio e projeto valem nas três visões. A
  // etapa (abertas, fechadas, recentes) só na lista e no potencial: no kanban
  // as colunas já são as etapas, e o filtro só esvaziaria colunas.
  const pessoasDaNegociacao = (c: CaptacaoRow): Marcador[] => [
    ...[c.captador_id, c.supervisor_id].filter((id): id is string => Boolean(id))
      .map(id => ({ valor: `membro:${id}`, nome: membros[id]?.nome ?? "Sem nome" })),
    ...(c.captador_externo_id ? [{ valor: `agencia:${c.captador_externo_id}`, nome: `${c.captador_externo?.nome ?? "Agência"} (agência)` }] : []),
  ];
  const leiDaNegociacao = (c: CaptacaoRow): Marcador[] => c.lei ? [{ valor: c.lei, nome: leiMap[c.lei]?.label ?? c.lei }] : [];
  const projetoDaNegociacao = (c: CaptacaoRow): Marcador[] => c.projeto_id ? [{ valor: c.projeto_id, nome: c.projeto?.nome ?? "Projeto sem nome" }] : [];
  const opcoesResponsavel = opcoesDoFiltro(captacoesVisiveis, pessoasDaNegociacao, "Sem responsável");
  const opcoesLei = opcoesDoFiltro(captacoesVisiveis, leiDaNegociacao, "Sem tipo de patrocínio");
  const opcoesProjeto = opcoesDoFiltro(captacoesVisiveis, projetoDaNegociacao, "Sem projeto");

  const term = search.trim().toLocaleLowerCase("pt-BR");
  const captacoesNosFiltros = captacoesVisiveis.filter(c =>
    (!term || [c.titulo, c.empresa_pub?.nome, c.empresa_crm?.nome, c.projeto?.nome, c.lei].some(value => value?.toLocaleLowerCase("pt-BR").includes(term)))
    && passaNoFiltro(c, filtroResponsavel, pessoasDaNegociacao)
    && passaNoFiltro(c, filtroLei, leiDaNegociacao)
    && passaNoFiltro(c, filtroProjeto, projetoDaNegociacao));

  const closedStatuses = new Set<StatusCaptacao>(["aprovado", "recusado"]);
  const filtraEtapa = view !== "kanban";
  const filteredCaptacoes = !filtraEtapa ? captacoesNosFiltros : captacoesNosFiltros.filter(c => {
    const isClosed = closedStatuses.has(c.status);
    const isRecent = recentCutoff !== null && new Date(c.created_at).getTime() >= recentCutoff;
    return pipelineFilter === "todas" || (pipelineFilter === "abertas" && !isClosed) || (pipelineFilter === "fechadas" && isClosed) || (pipelineFilter === "recentes" && isRecent);
  });

  const filtrosAtivos = Boolean(term) || cicloFiltro !== "atual" || (filtraEtapa && pipelineFilter !== "todas")
    || filtroResponsavel !== TODOS || filtroLei !== TODOS || filtroProjeto !== TODOS;
  function limparFiltros() {
    setSearch(""); setPipelineFilter("todas"); setCicloFiltro("atual");
    setFiltroResponsavel(TODOS); setFiltroLei(TODOS); setFiltroProjeto(TODOS);
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortValue(c: CaptacaoRow, key: string): string | number {
    switch (key) {
      case "empresa": return (c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? "").toLocaleLowerCase("pt-BR");
      case "projeto": return (c.projeto?.nome ?? "").toLocaleLowerCase("pt-BR");
      case "lei": return (c.lei ? leiMap[c.lei]?.label ?? c.lei : "").toLocaleLowerCase("pt-BR");
      case "status": return (STATUS_MAP[c.status]?.label ?? c.status ?? "").toLocaleLowerCase("pt-BR");
      case "valor": return c.valor_solicitado ?? -Infinity;
      case "prioridade": return c.prioridade === "alta" ? 3 : c.prioridade === "media" ? 2 : c.prioridade === "baixa" ? 1 : 0;
      case "responsavel": {
        const id = c.supervisor_id ?? c.captador_id;
        return (id ? membros[id]?.nome ?? "" : "").toLocaleLowerCase("pt-BR");
      }
      case "agencia": return (c.captador_externo?.nome ?? "").toLocaleLowerCase("pt-BR");
      case "proxContato": return c.proxima_prospeccao ?? "";
      default: return "";
    }
  }

  const filteredCaptacoesSorted = sortKey ? [...filteredCaptacoes].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
    return sortDir === "asc" ? cmp : -cmp;
  }) : filteredCaptacoes;

  const byStatus = Object.fromEntries(
    COLUNAS.map(({ status }) => [status, filteredCaptacoes.filter((c) => c.status === status)])
  ) as Record<StatusCaptacao, CaptacaoRow[]>;

  const pipelineTotal = captacoesVisiveis
    .filter((c) => c.status !== "recusado")
    .reduce((s, c) => s + (c.valor_solicitado ?? 0), 0);

  /* ─── shared card renderer (used in both views) ─── */
  function renderCard(c: CaptacaoRow, compact = false, dragHandlers?: { onDragStart: () => void; onDragEnd: () => void }, ghost = false, valuePct?: number) {
    const empresa  = c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? "—";
    const titulo   = c.titulo ?? c.projeto?.nome ?? "";
    const lei      = c.lei ? leiMap[c.lei] : null;
    const atividade = atividadesPorCaptacao[c.id];
    const isGhost  = ghost || draggingId === c.id;

    return (
      <KanbanCard
        key={c.id}
        onClick={() => router.push(`/captacoes/${c.id}`)}
        dragging={isGhost}
        draggable={Boolean(dragHandlers)}
        onDragStart={dragHandlers?.onDragStart}
        onDragEnd={dragHandlers?.onDragEnd}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <CompanyLogo nome={empresa} domain={c.empresa_crm?.domain_key} site={c.empresa_pub?.site ?? c.empresa_crm?.site} logo_url={c.empresa_pub?.logo_url} size={20} className="flex-shrink-0" />
            {c.empresa_crm?.nome && !c.empresa_pub?.nome ? (
              <Link href={`/empresas-crm/${c.empresa_crm_id}`} onClick={(e) => e.stopPropagation()} className="text-[0.625rem] font-semibold text-black/50 truncate hover:text-[#7259B5] transition">
                {empresa}
              </Link>
            ) : (
              <span className="text-[0.625rem] font-semibold text-black/50 truncate">{empresa}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {atividade && (
              <div className="group/atividade relative">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${atividade.atrasada ? "border-[#B07A14]/30 bg-white text-[#B07A14]" : "border-black/10 bg-white text-black/30"}`}
                  aria-label={atividade.atrasada ? "Atividade atrasada" : "Atividade em dia"}
                >
                  <Clock3 size={11}/>
                </span>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-max max-w-[11.875rem] rounded bg-[#282525] px-2.5 py-1.5 text-[0.625rem] leading-snug text-white opacity-0 shadow-lg transition group-hover/atividade:opacity-100"
                >
                  <p className="font-semibold">{atividade.nome}</p>
                  <p className={atividade.atrasada ? "text-[#F0B24D]" : "text-white/55"}>
                    {atividade.atrasada
                      ? `${atividade.dias} ${atividade.dias === 1 ? "dia" : "dias"} atrasada`
                      : atividade.dias === 0 ? "Prevista para hoje" : `Em ${atividade.dias} ${atividade.dias === 1 ? "dia" : "dias"}`}
                    {atividade.responsavel ? ` · ${atividade.responsavel}` : ""}
                  </p>
                </div>
              </div>
            )}
            <ArrowUpRight size={12} className="text-black/20 opacity-0 transition group-hover:opacity-100"/>
          </div>
        </div>
        {titulo && <p className="mb-3 line-clamp-2 text-[0.8125rem] font-semibold leading-[1.35] tracking-[-.01em] text-black/85">{titulo}</p>}
        <div className="flex items-center justify-between">
          {lei ? (
            <span className="rounded border bg-white text-[0.5625rem] font-bold px-1.5 py-0.5 uppercase tracking-wide" style={{ borderColor: lei.text + "47", color: lei.text }}>
              {lei.label}
            </span>
          ) : <span />}
          <span className="text-[0.75rem] font-semibold tabular-nums text-black/65" title={c.valor_solicitado ? formatarValorCompleto(c.valor_solicitado) : undefined}>{fmtValor(c.valor_solicitado)}</span>
        </div>
        {typeof valuePct === "number" && (
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-black/[.07]">
            <div className="h-full rounded-full bg-black/30" style={{ width: `${valuePct}%` }} />
          </div>
        )}
        {c.proxima_prospeccao && (
          <div className="mt-3 flex items-center justify-between border-t pt-2.5 text-[0.625rem] font-medium" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <span className="text-black/45">Próximo contato</span>
            <span className="flex items-center gap-1 tabular-nums text-black/60">
            <Calendar size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40" />
            {fmtShortDate(c.proxima_prospeccao)}
            </span>
          </div>
        )}
      </KanbanCard>
    );
  }

  async function refetch() {
    setCaptacoes(await fetchCaptacoes());
  }

  return (
    <div className={`flex flex-col ${view === "list" ? "h-full" : ""}`}>
      {/* Dropdown de status — fixed, fora do fluxo da tabela */}
      {statusMenuId && menuPos && (
        <StatusDropdown
          options={etiquetas.map(e => ({ status: e.key, label: e.label, bg: e.cor, iconName: e.icone }))}
          current={captacoes.find(c => c.id === statusMenuId)?.status ?? ""}
          position={menuPos}
          onSelect={s => moveCard(statusMenuId, s as StatusCaptacao)}
          onClose={() => { setStatusMenuId(null); setMenuPos(null); }}
        />
      )}

      {fechando && (
        <FecharNegocioSheet
          captacao={fechando}
          empresaNome={fechando.empresa_crm?.nome ?? fechando.empresa_pub?.nome ?? fechando.titulo ?? "Negociação"}
          onClose={() => setFechando(null)}
          onChanged={refetch}
        />
      )}
      {novoCicloSheet}

      {/* Dropdown de lei — fixed, inline edit */}
      {leiMenuId && leiMenuPos && (
        <StatusDropdown
          title="Tipo de patrocínio"
          options={leiOptions}
          current={captacoes.find(c => c.id === leiMenuId)?.lei ?? ""}
          position={leiMenuPos}
          onSelect={s => handleLeiUpdate(leiMenuId, (s || null) as CaptacaoRow["lei"])}
          onCreate={createLei}
          onClose={() => { setLeiMenuId(null); setLeiMenuPos(null); }}
        />
      )}

      {/* Dropdown de ciclo — fixed, escapa do overflow-x-auto do toolbar */}
      {cicloMenuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCicloMenuPos(null)} />
          <div
            className="fixed z-50 min-w-[10rem] overflow-hidden rounded border bg-white shadow-xl"
            style={{ top: cicloMenuPos.top, left: cicloMenuPos.left, borderColor: "rgba(13,13,13,.12)" }}
          >
            {([
              { value: "atual", label: "Ciclo atual" },
              ...anosDisponiveis.map(ano => ({ value: String(ano), label: `Ciclo ${ano}` })),
              { value: "todos", label: "Todos os ciclos" },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setCicloFiltro(opt.value); setCicloMenuPos(null); }}
                className="flex w-full items-center px-3 py-2 text-left text-[0.75rem] transition hover:bg-black/[.04]"
                style={{ fontWeight: cicloFiltro === opt.value ? 700 : 500 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {(showModal || editingRecord) && (
        <NovaCaptacaoModal
          statusPre={preStatus}
          potentialPre={prePotential}
          editData={editingRecord ? {
            id:               editingRecord.id,
            empresa_crm_id:   editingRecord.empresa_crm_id,
            empresa_crm_nome: editingRecord.empresa_crm?.nome ?? null,
            projeto_id:       editingRecord.projeto_id,
            projeto_nome:     editingRecord.projeto?.nome ?? null,
            valor_solicitado: editingRecord.valor_solicitado,
            meio_contato:     editingRecord.meio_contato,
            status:           editingRecord.status,
            captador_id:      editingRecord.captador_id,
            captador_externo_id: editingRecord.captador_externo_id,
            supervisor_id:    editingRecord.supervisor_id,
            contato_empresa_id: editingRecord.contato_empresa_id,
            proxima_prospeccao: editingRecord.proxima_prospeccao,
            data_previsao:    editingRecord.data_previsao,
            potencial_fechamento: editingRecord.potencial_fechamento,
          } as EditDataCaptacao : undefined}
          onClose={() => { setShowModal(false); setEditingRecord(null); setPrePotential(undefined); }}
          onSaved={refetch}
        />
      )}
      <ListPageHeader
        eyebrow="Pipeline comercial"
        title="Negociações"
        summary={!loading && <>
          <ListSummary strong={filteredCaptacoes.length}>de {captacoes.length}</ListSummary>
          <ListSummary strong={<span title={pipelineTotal ? formatarValorCompleto(pipelineTotal) : undefined}>{fmtValor(pipelineTotal)}</span>}>no pipeline</ListSummary>
        </>}
        actions={<>
          <ViewToggle view={view} onChange={setView} />
          <PrimaryListAction onClick={() => setShowModal(true)}><Plus size={13} aria-hidden="true" /> Nova negociação</PrimaryListAction>
        </>}
      />

      {/* Botões de controle: escopo e busca das negociações */}
      <ListToolbar search={<ListSearch value={search} onChange={setSearch} placeholder="Buscar empresa, projeto ou lei" />}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={Boolean(cicloMenuPos)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCicloMenuPos(cicloMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3.5 text-[0.75rem] font-medium text-black/45 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          >
            <Calendar size={12} aria-hidden="true"/>
            {cicloFiltro === "atual" ? "Ciclo atual" : cicloFiltro === "todos" ? "Todos os ciclos" : `Ciclo ${cicloFiltro}`}
            <ChevronDown size={11} className="opacity-40" aria-hidden="true" />
          </button>
          {filtraEtapa && (
            <>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-black/10" aria-hidden="true"/>
              <SegmentedControl
                value={pipelineFilter}
                onChange={setPipelineFilter}
                ariaLabel="Filtrar negociações"
                options={[
                  { value: "todas",    label: "Todas" },
                  { value: "abertas",  label: "Abertas",  icon: Clock3 },
                  { value: "fechadas", label: "Fechadas", icon: CheckCircle2 },
                  { value: "recentes", label: "Recentes", icon: Calendar },
                ] as const}
              />
            </>
          )}
          <FiltrosDoFunil
            responsavel={{ valor: filtroResponsavel, opcoes: opcoesResponsavel, onChange: setFiltroResponsavel }}
            lei={{ valor: filtroLei, opcoes: opcoesLei, onChange: setFiltroLei }}
            projeto={{ valor: filtroProjeto, opcoes: opcoesProjeto, onChange: setFiltroProjeto }}
          />
          {filtrosAtivos && (
            <button type="button" onClick={limparFiltros} className="flex h-9 shrink-0 items-center gap-1.5 rounded px-2.5 text-[0.75rem] font-medium text-black/50 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
              <X size={12} aria-hidden="true" /> Limpar filtros
            </button>
          )}
      </ListToolbar>

      {/* ── Kanban view ── */}
      {view === "kanban" && (
        <KanbanBoard>
            {COLUNAS.map(({ status, label, accent, iconName }) => {
              const cards = loading ? [] : (byStatus[status] ?? []);
              const sum = colSum(cards);

              return (
                <KanbanColumn
                  key={status}
                  label={label}
                  count={loading ? null : cards.length}
                  total={loading ? null : fmtValor(sum)}
                  accent={accent}
                  iconName={iconName}
                  active={dragOverStatus === status && Boolean(draggingId)}
                  addLabel={`Nova negociação em ${label}`}
                  onAdd={ehDesfecho(status, DESFECHOS_NEGOCIACAO) ? undefined : () => { setPreStatus(status); setShowModal(true); }}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(status); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={e => { e.preventDefault(); if (draggingId) moveCard(draggingId, status); setDraggingId(null); setDragOverStatus(null); }}
                >
                    {loading ? (
                      status === "prospeccao" || status === "primeiro_contato"
                        ? Array.from({ length: 2 }).map((_, i) => <KanbanSkeleton key={i} />)
                        : null
                    ) : cards.length === 0 ? (
                      filtrosAtivos
                        ? <KanbanEmpty label="Nada com esses filtros" />
                        : <KanbanEmpty label="Nenhuma negociação" actionLabel="Adicionar primeira" onAction={ehDesfecho(status, DESFECHOS_NEGOCIACAO) ? undefined : () => { setPreStatus(status); setShowModal(true); }}/>
                    ) : (
                      <>
                        {cards.slice(0, getVisible(status)).map((c) => renderCard(c, false, { onDragStart: () => setDraggingId(c.id), onDragEnd: () => { setDraggingId(null); setDragOverStatus(null); } }))}
                        {cards.length > getVisible(status) && <RevealSentinel onReveal={() => reveal(status)} />}
                      </>
                    )}
                </KanbanColumn>
              );
            })}
        </KanbanBoard>
      )}

      {/* ── Potential board — commercial confidence, independent from priority ── */}
      {view === "potential" && (
        <PotentialKanban
          items={filteredCaptacoes}
          loading={loading}
          emptyLabel="Sem negociações"
          onMove={movePotential}
          onAdd={potential => { setPrePotential(potential); setShowModal(true); }}
          getValue={captacao => captacao.valor_solicitado}
          renderCard={(captacao, isDragging, valuePct, dragHandlers) => renderCard(captacao, false, dragHandlers, isDragging, valuePct)}
        />
      )}

      {/* ── Etiqueta estrutural: Tabela CRM — modo lista das negociações ── */}
      {view === "list" && (
        <div className="flex-1 overflow-y-auto px-4 py-5 md:py-6 md:pl-8 md:pr-0">
          <ListTableSurface className="md:rounded-r-none md:border-r-0">
              <ManagedTable storageKey="captacoes" definitions={CAPTACOES_COLUMNS} className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "#F9F9F8" }}>
                    {([
                      { label: "Empresa", key: "empresa" },
                      { label: "Projeto", key: "projeto" },
                      { label: "Tipo de patrocínio", key: "lei" },
                      { label: "Status", key: "status" },
                      { label: "Valor", key: "valor" },
                      { label: "Prio.", key: "prioridade" },
                      { label: "Responsável", key: "responsavel" },
                      { label: "Agência", key: "agencia" },
                      { label: "Próx. contato", key: "proxContato" },
                      { label: "Adicionado em", key: undefined },
                      { label: "Atualizado em", key: undefined },
                      { label: "", key: undefined },
                    ] satisfies { label: string; key?: string }[]).map((col, i) => (
                      <th key={i} aria-sort={col.key && sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="px-4 py-3 text-left text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em] whitespace-nowrap">
                        {col.key ? (
                          <button type="button" onClick={() => toggleSort(col.key)} className="flex items-center gap-1 uppercase tracking-[.08em] transition hover:text-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
                            {col.label}
                            {sortKey === col.key ? (
                              sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                            ) : (
                              <ChevronsUpDown size={11} className="opacity-30" />
                            )}
                          </button>
                        ) : col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
                        {[140, 200, 80, 90, 70, 40, 150, 130, 80, 90, 90, 40].map((w, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-3.5 rounded bg-black/8 animate-pulse" style={{ width: `${w / 16}rem` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredCaptacoesSorted.length === 0 ? (
                    <tr>
                      <td colSpan={12}>
                        {captacoes.length === 0 ? (
                          <ListEmptyState
                            icon={BriefcaseBusiness}
                            title="Nenhuma negociação neste ciclo"
                            description="Registre a primeira conversa com um patrocinador para acompanhar valores, etapas e próximos contatos."
                            action={<PrimaryListAction onClick={() => setShowModal(true)}><Plus size={13} aria-hidden="true" /> Nova negociação</PrimaryListAction>}
                          />
                        ) : (
                          <ListEmptyState
                            icon={Search}
                            title="Nenhuma negociação corresponde aos filtros"
                            filtered
                            onClearFilters={limparFiltros}
                          />
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredCaptacoesSorted.map((c, i) => {
                      const empresa  = c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? "—";
                      const lei      = c.lei ? leiMap[c.lei] : null;
                      const prio     = c.prioridade;
                      const col      = STATUS_MAP[c.status];

                      return (
                        <tr
                          key={c.id}
                          onClick={() => router.push(`/captacoes/${c.id}`)}
                          className="hover:bg-black/[0.025] transition cursor-pointer group"
                          style={{ borderBottom: i < filteredCaptacoesSorted.length - 1 ? "1px solid rgba(13,13,13,.045)" : "none" }}
                        >
                          {/* Empresa */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CompanyLogo nome={empresa} domain={c.empresa_crm?.domain_key} site={c.empresa_pub?.site ?? c.empresa_crm?.site} logo_url={c.empresa_pub?.logo_url} size={20} className="flex-shrink-0" />
                              {c.empresa_crm?.nome && !c.empresa_pub?.nome ? (
                                <Link href={`/empresas-crm/${c.empresa_crm_id}`} onClick={(e) => e.stopPropagation()} className="text-[0.78125rem] font-medium text-black/60 hover:text-[#7259B5] transition">
                                  {empresa}
                                </Link>
                              ) : (
                                <span className="text-[0.78125rem] font-medium text-black/60">{empresa}</span>
                              )}
                            </div>
                          </td>

                          {/* Projeto */}
                          <td className="px-4 py-3.5">
                            {c.projeto?.nome ? (
                              <span className="flex items-center gap-1.5 text-[0.78125rem] text-black/50">
                                <ProjectIdentity nome={c.projeto.nome} tipo={c.projeto.identidade_tipo} valor={c.projeto.identidade_valor} logoUrl={c.projeto.identidade_logo_url} cor={c.projeto.identidade_cor} size="sm" semFundo />
                                {c.projeto.nome}
                              </span>
                            ) : (
                              <span className="text-black/25 text-xs">Sem projeto</span>
                            )}
                          </td>

                          {/* Lei — clicável para edição rápida */}
                          <td className="px-4 py-3.5">
                            <button type="button" onClick={e => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setLeiMenuPos({ top: rect.bottom + 4, left: rect.left });
                              setLeiMenuId(leiMenuId === c.id ? null : c.id);
                            }} className="transition hover:opacity-70">
                              {lei ? (
                                <span className="rounded border bg-white text-[0.5625rem] font-bold px-1.5 py-0.5 uppercase tracking-wide" style={{ borderColor: lei.text + "47", color: lei.text }}>
                                  {lei.label}
                                </span>
                              ) : <span className="text-black/20 text-xs hover:text-black/40">+ Lei</span>}
                            </button>
                          </td>

                          {/* Status — dropdown rápido */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {col && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const menuH = (COLUNAS.length * 36 + 8) * escalaUi();
                                  setMenuPos({
                                    top:  window.innerHeight - rect.bottom > menuH ? rect.bottom + 4 : rect.top - menuH - 4,
                                    left: rect.left,
                                  });
                                  setStatusMenuId(statusMenuId === c.id ? null : c.id);
                                }}
                                className="inline-flex items-center gap-0 hover:opacity-80 transition cursor-pointer"
                              >
                                <StatusBadge status={c.status} size="md" withChevron label={col?.label} bg={col?.accent} iconName={col?.iconName} />
                              </button>
                            )}
                          </td>

                          {/* Valor */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-semibold tabular-nums text-[0.8125rem] text-black/70" title={c.valor_solicitado ? formatarValorCompleto(c.valor_solicitado) : undefined}>{fmtValor(c.valor_solicitado)}</span>
                          </td>

                          {/* Prioridade */}
                          <td className="px-4 py-3.5">
                            <PrioBadge prio={prio} size="md" />
                          </td>

                          {/* Responsável (supervisor ou captador) */}
                          <td className="px-4 py-3.5">
                            {(() => {
                              const id = c.supervisor_id ?? c.captador_id;
                              const m = id ? membros[id] : null;
                              return m ? (
                                <span className="font-medium text-[0.78125rem] text-black/60">{m.nome}</span>
                              ) : <span className="text-black/25 text-xs">—</span>;
                            })()}
                          </td>

                          {/* Agência de captação */}
                          <td className="px-4 py-3.5">
                            {c.captador_externo?.nome ? (
                              <span className="font-medium text-[0.78125rem] text-black/60">
                                <span className="break-words min-w-0">{c.captador_externo.nome}</span>
                                <span className="flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                                  <Building2 size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40" />
                                  Agência
                                </span>
                              </span>
                            ) : <span className="text-black/25 text-xs">—</span>}
                          </td>

                          {/* Próx. contato */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {c.proxima_prospeccao ? (
                              <span className="flex items-center gap-1 text-[0.6875rem] font-medium tabular-nums text-black/55">
                                <Calendar size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40" />
                                {fmtShortDate(c.proxima_prospeccao)}
                              </span>
                            ) : <span className="text-black/20 text-xs">—</span>}
                          </td>

                          <td className="px-4 py-3.5 text-[0.6875rem] tabular-nums text-black/40 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="block text-[0.6875rem] tabular-nums text-black/40">{fmtDate(c.updated_at)}</span>
                            {(() => {
                              const recency = updateRecency(c.updated_at);
                              return recency ? (
                                <span
                                  className="mt-1 inline-flex rounded border bg-white px-1.5 py-0.5 text-[0.5625rem] font-semibold"
                                  style={{ borderColor: `${recency.color}40`, color: recency.color }}
                                  title={`${recency.days} ${recency.days === 1 ? "dia" : "dias"} sem atualização`}
                                >
                                  {recency.label}
                                </span>
                              ) : null;
                            })()}
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
                              <button
                                onClick={e => { e.stopPropagation(); handleDelete(c.id, c.titulo ?? c.projeto?.nome ?? c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? ""); }}
                                className="p-1 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </ManagedTable>
          </ListTableSurface>
        </div>
      )}
    </div>
  );
}
