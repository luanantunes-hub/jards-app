"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, FilePenLine, X, List, Columns2, Calendar, Files, ClipboardList, StickyNote, Scale, Trash2, Clock3, ArrowUpRight, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { SegmentedControl } from "@/components/ui/FilterControls";
import type { StatusEdital } from "@/lib/supabase/types";
import { NovaInscricaoModal, type EditDataInscricao } from "@/components/modals/NovaInscricaoModal";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { DocumentosModal } from "@/components/modals/DocumentosModal";
import { RegistrosPanel } from "@/components/modals/RegistrosPanel";
import { AnotacoesEmpresa } from "@/components/AnotacoesEmpresa";
import { PotentialKanban, type PotencialFechamento } from "@/components/kanban/PotentialKanban";
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanEmpty, KanbanSkeleton } from "@/components/kanban/KanbanPrimitives";
import { useIncrementalReveal, RevealSentinel } from "@/components/kanban/useIncrementalReveal";
import StatusBadge from "@/components/ui/StatusBadge";
import PrioBadge from "@/components/ui/PrioBadge";
import { StatusDropdown } from "@/components/ui/StatusDropdown";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { getInscricaoTiming } from "@/lib/inscricoes/timing";
import { useLeiOptions } from "@/hooks/useLeiOptions";
import { escalaUi } from "@/lib/escala-ui";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { DESFECHOS_INSCRICAO, ehDesfecho } from "@/lib/etapas";

type EditalInscrito = {
  id: string;
  lei: string | null;
  valor: number | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  data_resultado: string | null;
  status: StatusEdital;
  prioridade: string | null;
  potencial_fechamento: PotencialFechamento | null;
  created_at: string;
  updated_at: string;
  site: string | null;
  empresa_crm_id: string | null;
  projeto_id: string | null;
  cota_id: string | null;
  responsavel_tipo: "agencia" | "membro" | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  ciclo_ano: number | null;
  ciclo_anterior_id: string | null;
  empresas: { nome: string; logo_url: string | null; site: string | null } | null;
  empresas_crm: { nome: string; domain_key: string | null; site: string | null } | null;
  projetos_crm: { nome: string; identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null; identidade_valor: string | null; identidade_logo_url: string | null; identidade_cor: string | null } | null;
};

type ViewMode = "list" | "kanban" | "potential";
type AtividadeIndicador = { nome: string; atrasada: boolean; dias: number; responsavel: string | null };

const EDITAIS_SELECT = `
  id, lei, valor, data_abertura, data_fechamento, data_resultado,
  status, prioridade, potencial_fechamento, created_at, updated_at, site, empresa_crm_id, projeto_id, cota_id,
  responsavel_tipo, responsavel_id, responsavel_nome, ciclo_ano, ciclo_anterior_id,
  empresas!empresa_pub_id(nome, logo_url, site),
  empresas_crm!empresa_crm_id(nome, domain_key, site),
  projetos_crm!projeto_id(nome, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor)
`;

const EDITAIS_SELECT_NO_POTENTIAL = EDITAIS_SELECT.replace("potencial_fechamento, ", "");
const EDITAIS_SELECT_NO_LEI = EDITAIS_SELECT.replace("lei, ", "");
const EDITAIS_SELECT_LEGACY = EDITAIS_SELECT_NO_POTENTIAL.replace("lei, ", "");

const INSCRICOES_COLUMNS = [
  { id: "projeto",    label: "Projeto",      width: "minmax(10.625rem,1fr)" },
  { id: "empresa",    label: "Empresa",      width: "minmax(11.25rem,1fr)" },
  { id: "lei",        label: "Tipo de patrocínio", width: "10.3125rem" },
  { id: "responsavel", label: "Responsável", width: "minmax(9.375rem,1fr)" },
  { id: "adicionada", label: "Adicionado em", width: "8.125rem" },
  { id: "atualizada", label: "Atualizado em", width: "8.125rem" },
  { id: "fechamento", label: "Fechamento",   width: "7.8125rem" },
  { id: "resultado",  label: "Resultado",    width: "7.8125rem" },
  { id: "valor",      label: "Valor",        width: "7.1875rem" },
  { id: "prioridade", label: "Prioridade",   width: "7.1875rem" },
  { id: "documentos", label: "Docs",   width: "5rem" },
  { id: "registros",  label: "Conteúdo",            width: "5rem"  },
  { id: "anotacoes",  label: "Notas",   width: "5rem" },
  { id: "status",     label: "Status",       width: "8.4375rem", hideable: false },
  { id: "excluir",    label: "",              width: "3rem" },
] as const satisfies readonly ColumnDefinition[];

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d.split("T")[0]).getTime() - Date.now()) / 86_400_000);
}

function fmtShortDate(d: string | null): string {
  if (!d) return "";
  const [, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}`;
}

function fmtValor(v: number | null): string {
  return v ? formatarValorCurto(v) : "—";
}

// A inscrição é identificada por empresa e projeto — não há mais um nome próprio.
function rotuloInscricao(e: Pick<EditalInscrito, "empresas_crm" | "empresas" | "projetos_crm">): string {
  const empresa = e.empresas_crm?.nome ?? e.empresas?.nome;
  return [empresa, e.projetos_crm?.nome].filter(Boolean).join(" · ") || "Inscrição";
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
      {Array.from({ length: 15 }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="h-3.5 w-20 rounded bg-black/8 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

function SkeletonKanbanCard() {
  return (
    <div className="bg-white rounded p-3.5 border animate-pulse" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded bg-black/8" />
        <div className="h-2.5 w-24 bg-black/8 rounded" />
      </div>
      <div className="h-3.5 w-full bg-black/8 rounded mb-1.5" />
      <div className="h-3.5 w-3/4 bg-black/8 rounded mb-3" />
      <div className="flex justify-between">
        <div className="h-4 w-14 bg-black/8 rounded" />
        <div className="h-4 w-10 bg-black/8 rounded" />
      </div>
    </div>
  );
}

// Botões de controle: visualização das inscrições em editais.
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <SegmentedControl
      value={view}
      onChange={onChange}
      ariaLabel="Visualização das inscrições"
      iconOnly
      options={[
        { value: "list", icon: List, ariaLabel: "Lista" },
        { value: "kanban", icon: Columns2, ariaLabel: "Kanban" },
        { value: "potential", icon: Scale, ariaLabel: "Potencial de fechamento" },
      ]}
    />
  );
}

export default function EditaisInscritosPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router = useRouter();
  const { etiquetasInscricao } = useEtiquetas();
  const { options: leiOptions, create: createLei } = useLeiOptions();
  const leiMap = Object.fromEntries(leiOptions.map(option => [option.status, {
    label: option.label,
    bg: "#fff",
    text: option.bg,
  }]));
  const kanbanCols = etiquetasInscricao.map((etiqueta) => etiqueta.key as StatusEdital);
  const statusConfig = Object.fromEntries(etiquetasInscricao.map((etiqueta) => [
    etiqueta.key,
    { label: etiqueta.label, bg: "#fff", text: etiqueta.cor, accent: etiqueta.cor, iconName: etiqueta.icone },
  ])) as Record<StatusEdital, { label: string; bg: string; text: string; accent: string; iconName: string }>;
  const statusFilterOptions: { value: StatusEdital | "todos"; label: string }[] = [
    { value: "todos", label: "Todos" },
    ...etiquetasInscricao.map((etiqueta) => ({ value: etiqueta.key as StatusEdital, label: etiqueta.label })),
  ];

  const [editais, setEditais]           = useState<EditalInscrito[]>([]);
  const [atividadesPorInscricao, setAtividadesPorInscricao] = useState<Record<string, AtividadeIndicador>>({});
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [preStatus, setPreStatus]       = useState<StatusEdital>("interesse");
  const [editingRecord, setEditingRecord] = useState<EditalInscrito | null>(null);
  const [statusMenuId, setStatusMenuId]   = useState<string | null>(null);
  const [menuPos, setMenuPos]             = useState<{ top: number; left: number } | null>(null);
  const [leiMenuId, setLeiMenuId]         = useState<string | null>(null);
  const [leiMenuPos, setLeiMenuPos]       = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch]             = useState("");
  const [dSearch, setDSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusEdital | "todos">("todos");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [cicloFiltro, setCicloFiltro] = useState<string>("atual");
  const [cicloMenuPos, setCicloMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView]                 = useState<ViewMode>("list");
  const [draggingId, setDraggingId]         = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<StatusEdital | null>(null);
  const { getVisible, reveal } = useIncrementalReveal(20);
  const [prePotential, setPrePotential] = useState<PotencialFechamento | undefined>();

  // Feature panels
  const [docInscricao,   setDocInscricao]   = useState<EditalInscrito | null>(null);
  const [regInscricao,   setRegInscricao]   = useState<EditalInscrito | null>(null);
  const [anotEmpresa,    setAnotEmpresa]     = useState<EditalInscrito | null>(null);

  function handleDelete(id: string, rotulo: string) {
    confirmDelete({
      title: `Excluir a inscrição “${rotulo}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "editais_user", id);
        setEditais(prev => prev.filter(e => e.id !== id));
      },
    });
  }

  async function moveEdital(id: string, newStatus: StatusEdital) {
    const previous = editais;
    setEditais(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
    const { error } = await (supabase as any).from("editais_user").update({ status: newStatus }).eq("id", id);
    if (error) setEditais(previous);
  }

  async function handleLeiUpdate(id: string, lei: EditalInscrito["lei"]) {
    const previous = editais;
    setEditais(prev => prev.map(e => e.id === id ? { ...e, lei } : e));
    setLeiMenuId(null); setLeiMenuPos(null);
    const { error } = await (supabase as any).from("editais_user").update({ lei }).eq("id", id);
    if (error) setEditais(previous);
  }

  async function movePotential(id: string, potencial_fechamento: PotencialFechamento) {
    const previous = editais;
    setEditais(prev => prev.map(e => e.id === id ? { ...e, potencial_fechamento } : e));
    const { error } = await (supabase as any)
      .from("editais_user")
      .update({ potencial_fechamento })
      .eq("id", id);
    if (error) {
      setEditais(previous);
      return false;
    }
    return true;
  }

  async function fetchEditais() {
    let result = await supabase.from("editais_user").select(EDITAIS_SELECT).order("created_at", { ascending: false });
    if (result.error) {
      result = await supabase.from("editais_user").select(EDITAIS_SELECT_NO_POTENTIAL).order("created_at", { ascending: false });
    }
    if (result.error) {
      result = await supabase.from("editais_user").select(EDITAIS_SELECT_NO_LEI).order("created_at", { ascending: false });
    }
    if (result.error) {
      result = await supabase.from("editais_user").select(EDITAIS_SELECT_LEGACY).order("created_at", { ascending: false });
    }
    if (!result.data) return [] as EditalInscrito[];
    return (result.data as unknown as Array<Omit<EditalInscrito, "potencial_fechamento" | "lei"> & { potencial_fechamento?: PotencialFechamento | null; lei?: string | null }>)
      .map(item => ({ ...item, lei: item.lei ?? null, potencial_fechamento: item.potencial_fechamento ?? "medio" }));
  }

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const data = await fetchEditais();
      setEditais(data);

      // Indicador de atividade: pega a atividade pendente mais próxima de cada inscrição
      const ids = data.map(e => e.id);
      if (ids.length > 0) {
        const { data: atividadesData } = await (supabase as any)
          .from("atividades")
          .select("edital_user_id, nome, data_prevista, responsavel:profiles!responsavel_id(full_name)")
          .in("edital_user_id", ids)
          .eq("feita", false)
          .not("data_prevista", "is", null)
          .order("data_prevista", { ascending: true });

        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const map: Record<string, AtividadeIndicador> = {};
        for (const a of (atividadesData ?? []) as any[]) {
          if (map[a.edital_user_id]) continue;
          const prevista = new Date(a.data_prevista);
          prevista.setHours(0, 0, 0, 0);
          const dias = Math.round((prevista.getTime() - hoje.getTime()) / 86_400_000);
          map[a.edital_user_id] = { nome: a.nome, atrasada: dias < 0, dias: Math.abs(dias), responsavel: a.responsavel?.full_name ?? null };
        }
        setAtividadesPorInscricao(map);
      } else {
        setAtividadesPorInscricao({});
      }

      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ciclos antigos: uma renovação cria um NOVO registro apontando pro anterior via
  // ciclo_anterior_id — "é o ciclo atual" = nenhum outro registro carregado aponta pra ele.
  // Anos disponíveis vêm sempre dos próprios dados carregados — nunca uma lista fixa,
  // já que a pessoa pode criar quantos ciclos futuros quiser via renovação.
  const idsComRenovacaoMaisNova = new Set(editais.map(e => e.ciclo_anterior_id).filter(Boolean));
  const anosDisponiveis = [...new Set(editais.map(e => e.ciclo_ano).filter((v): v is number => v != null))].sort((a, b) => b - a);
  const editaisVisiveis = cicloFiltro === "todos"
    ? editais
    : cicloFiltro === "atual"
    ? editais.filter(e => !idsComRenovacaoMaisNova.has(e.id))
    : editais.filter(e => e.ciclo_ano === Number(cicloFiltro));

  const filtered = editaisVisiveis.filter((e) => {
    if (statusFilter !== "todos" && e.status !== statusFilter) return false;
    if (!dSearch.trim()) return true;
    const s       = dSearch.toLowerCase();
    const empresa = e.empresas_crm?.nome ?? e.empresas?.nome ?? "";
    const projeto = e.projetos_crm?.nome ?? "";
    const responsavel = e.responsavel_nome ?? "";
    const lei = leiOptions.find(option => option.status === e.lei)?.label ?? e.lei ?? "";
    return empresa.toLowerCase().includes(s) || projeto.toLowerCase().includes(s) || responsavel.toLowerCase().includes(s) || lei.toLowerCase().includes(s);
  });

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function sortValue(e: EditalInscrito, key: string): string | number {
    switch (key) {
      case "empresa": return (e.empresas_crm?.nome ?? e.empresas?.nome ?? "").toLocaleLowerCase("pt-BR");
      case "projeto": return (e.projetos_crm?.nome ?? "").toLocaleLowerCase("pt-BR");
      case "lei": return (leiOptions.find(option => option.status === e.lei)?.label ?? e.lei ?? "").toLocaleLowerCase("pt-BR");
      case "responsavel": return (e.responsavel_nome ?? "").toLocaleLowerCase("pt-BR");
      case "fechamento": return e.data_fechamento ?? "";
      case "resultado": return e.data_resultado ?? "";
      case "valor": return e.valor ?? -Infinity;
      case "status": return (statusConfig[e.status]?.label ?? e.status ?? "").toLocaleLowerCase("pt-BR");
      case "prioridade": return e.prioridade === "alta" ? 3 : e.prioridade === "media" ? 2 : e.prioridade === "baixa" ? 1 : 0;
      default: return "";
    }
  }

  const filteredSorted = sortKey ? [...filtered].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
    return sortDir === "asc" ? cmp : -cmp;
  }) : filtered;

  const byStatus = Object.fromEntries(
    kanbanCols.map((st) => [st, editaisVisiveis.filter((e) => e.status === st)])
  ) as Record<StatusEdital, EditalInscrito[]>;

  const countByStatus = (st: StatusEdital) => editais.filter((e) => e.status === st).length;
  const stats = [
    { label: "Total",      value: editais.length,              color: "#0D0D0D"  },
    { label: "Aprovados",  value: countByStatus("aprovado"),   color: "#2E8932"  },
    { label: "Em análise", value: countByStatus("em_analise"), color: "#B07A14"  },
    { label: "Inscritos",  value: countByStatus("inscrito"),   color: "#2D72B0"  },
  ];

  async function refetch() {
    setEditais(await fetchEditais());
  }

  function renderPotentialCard(e: EditalInscrito, isDragging: boolean, valuePct?: number, dragHandlers?: { onDragStart: () => void; onDragEnd: () => void }) {
    const projeto = e.projetos_crm?.nome ?? "Sem projeto";
    const empresa = e.empresas_crm?.nome ?? e.empresas?.nome ?? "—";
    const atividade = atividadesPorInscricao[e.id];
    return (
      <KanbanCard
        key={e.id}
        dragging={isDragging}
        onClick={() => router.push(`/editais-inscritos/${e.id}`)}
        draggable={Boolean(dragHandlers)}
        onDragStart={dragHandlers?.onDragStart}
        onDragEnd={dragHandlers?.onDragEnd}
      >
        <div className="mb-2 flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <CompanyLogo nome={empresa} domain={e.empresas_crm?.domain_key} site={e.empresas?.site ?? e.empresas_crm?.site} logo_url={e.empresas?.logo_url} size={18} className="flex-shrink-0" />
            <span className="text-[0.625rem] font-semibold text-black/50 truncate">{empresa}</span>
          </div>
          {atividade && (
            <div className="group/atividade relative shrink-0">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${atividade.atrasada ? "border-[#B07A14]/30 bg-white text-[#B07A14]" : "border-black/10 bg-white text-black/30"}`}
                aria-label={atividade.atrasada ? "Atividade atrasada" : "Atividade em dia"}
              >
                <Clock3 size={11}/>
              </span>
              <div
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-max max-w-[11.875rem] rounded bg-[#0D0D0D] px-2.5 py-1.5 text-[0.625rem] leading-snug text-white opacity-0 shadow-lg transition group-hover/atividade:opacity-100"
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
        </div>
        <p className="text-[0.8125rem] font-semibold text-black leading-snug mb-2.5 line-clamp-2">{projeto}</p>
        <div className="flex items-center justify-between">
          {e.data_fechamento ? (
            <span className="flex items-center gap-1 text-[0.625rem] text-black/40 font-semibold"><Calendar size={9} />{fmtShortDate(e.data_fechamento)}</span>
          ) : <span />}
          {e.valor != null && <span className="text-xs font-semibold tabular-nums text-black/65" title={e.valor ? formatarValorCompleto(e.valor) : undefined}>{fmtValor(e.valor)}</span>}
        </div>
        {typeof valuePct === "number" && (
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-black/[.07]">
            <div className="h-full rounded-full bg-black/30" style={{ width: `${valuePct}%` }} />
          </div>
        )}
      </KanbanCard>
    );
  }

  return (
    <div className={`flex flex-col ${view === "list" ? "h-full" : ""}`}>
      {/* Dropdown de status — fixed, fora do fluxo da tabela */}
      {statusMenuId && menuPos && (
        <StatusDropdown
          options={etiquetasInscricao.map((etiqueta) => ({
            status: etiqueta.key,
            label: etiqueta.label,
            bg: etiqueta.cor,
            iconName: etiqueta.icone,
          }))}
          current={editais.find(e => e.id === statusMenuId)?.status ?? ""}
          position={menuPos}
          onSelect={st => moveEdital(statusMenuId, st as StatusEdital)}
          onClose={() => { setStatusMenuId(null); setMenuPos(null); }}
        />
      )}

      {/* Dropdown de lei — fixed, inline edit */}
      {leiMenuId && leiMenuPos && (
        <StatusDropdown
          title="Tipo de patrocínio"
          options={leiOptions}
          current={editais.find(e => e.id === leiMenuId)?.lei ?? ""}
          position={leiMenuPos}
          onSelect={s => handleLeiUpdate(leiMenuId, s || null)}
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
        <NovaInscricaoModal
          statusPre={preStatus}
          potentialPre={prePotential}
          editData={editingRecord ? {
            id:               editingRecord.id,
            empresa_crm_id:   editingRecord.empresa_crm_id,
            empresa_crm_nome: editingRecord.empresas_crm?.nome ?? null,
            projeto_id:       editingRecord.projeto_id,
            projeto_nome:     editingRecord.projetos_crm?.nome ?? null,
            cota_id:          editingRecord.cota_id,
            responsavel_tipo: editingRecord.responsavel_tipo,
            responsavel_id:   editingRecord.responsavel_id,
            responsavel_nome: editingRecord.responsavel_nome,
            lei:              editingRecord.lei,
            valor:            editingRecord.valor,
            status:           editingRecord.status,
            data_abertura:    editingRecord.data_abertura,
            data_fechamento:  editingRecord.data_fechamento,
            data_resultado:   editingRecord.data_resultado,
            potencial_fechamento: editingRecord.potencial_fechamento,
          } as EditDataInscricao : undefined}
          onClose={() => { setShowModal(false); setEditingRecord(null); setPrePotential(undefined); }}
          onSaved={refetch}
        />
      )}
      {/* Feature modals */}
      {docInscricao && (
        <DocumentosModal
          inscricaoId={docInscricao.id}
          projetoId={docInscricao.projeto_id}
          onClose={() => setDocInscricao(null)}
        />
      )}
      {regInscricao && (
        <RegistrosPanel
          inscricao={{
            id:             regInscricao.id,
            projeto_id:     regInscricao.projeto_id,
            empresa_crm_id: regInscricao.empresa_crm_id,
            empresa_nome:   regInscricao.empresas_crm?.nome ?? regInscricao.empresas?.nome ?? "—",
            empresa_logo:   regInscricao.empresas?.logo_url ?? null,
            empresa_domain: regInscricao.empresas_crm?.domain_key ?? null,
            empresa_site:   regInscricao.empresas?.site ?? regInscricao.empresas_crm?.site ?? null,
            projeto_nome:   regInscricao.projetos_crm?.nome ?? null,
            valor:          regInscricao.valor,
            status:         regInscricao.status,
          }}
          onClose={() => setRegInscricao(null)}
          onOpenDocumentos={() => { setDocInscricao(regInscricao); setRegInscricao(null); }}
        />
      )}
      {anotEmpresa && anotEmpresa.empresa_crm_id && (
        <AnotacoesEmpresa
          empresaCrmId={anotEmpresa.empresa_crm_id}
          empresaNome={anotEmpresa.empresas_crm?.nome ?? "—"}
          onClose={() => setAnotEmpresa(null)}
        />
      )}

      <ListPageHeader eyebrow="Operação de editais" title="Inscrições" summary={!loading&&<><ListSummary strong={filtered.length}>registros</ListSummary><ListSummary strong={countByStatus('aprovado')}>aprovados</ListSummary><ListSummary strong={countByStatus('em_analise')}>em análise</ListSummary></>} actions={<><ViewToggle view={view} onChange={setView}/><PrimaryListAction onClick={()=>setShowModal(true)}><Plus size={13}/>Nova inscrição</PrimaryListAction></>}/>

      <div className="flex shrink-0 flex-col gap-3 border-b bg-white px-4 py-3 md:px-8 lg:flex-row lg:items-center" style={{borderColor:"rgba(13,13,13,.06)"}}>
        <ListSearch value={search} onChange={setSearch} placeholder="Buscar empresa ou projeto"/>
        <div className="flex max-w-full items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCicloMenuPos(cicloMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
            }}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3.5 text-xs font-normal text-black/40 transition hover:bg-black/[.04] hover:text-black/65"
          >
            <Calendar size={12}/>
            {cicloFiltro === "atual" ? "Ciclo atual" : cicloFiltro === "todos" ? "Todos os ciclos" : `Ciclo ${cicloFiltro}`}
            <ChevronDown size={11} className="opacity-40" />
          </button>
          <span className="mx-0.5 h-5 w-px shrink-0 bg-black/10" aria-hidden="true"/>
          <SegmentedControl value={statusFilter} onChange={setStatusFilter} ariaLabel="Filtrar inscrições por status" options={statusFilterOptions} />
          {(search || statusFilter !== "todos" || cicloFiltro !== "atual") && (
            <button onClick={() => { setSearch(""); setStatusFilter("todos"); setCicloFiltro("atual"); }} className="flex h-9 shrink-0 items-center gap-1.5 rounded border border-black/[.12] bg-white px-3 text-xs font-semibold text-black/50 transition hover:bg-black/[.04]">
              <X size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── List view ── */}
      {view === "list" && (
        <>
          {/* Table */}
          <ListContent className="md:pr-0"><ListTableSurface className="rounded-r-none border-r-0">
              <ManagedTable storageKey="editais-inscritos-v3" definitions={INSCRICOES_COLUMNS} className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "#F9F9F8" }}>
                    {([
                      { label: "Projeto", key: "projeto" },
                      { label: "Empresa", key: "empresa" },
                      { label: "Tipo de patrocínio", key: "lei" },
                      { label: "Responsável", key: "responsavel" },
                      { label: "Adicionado em", key: undefined },
                      { label: "Atualizado em", key: undefined },
                      { label: "Fechamento", key: "fechamento" },
                      { label: "Resultado", key: "resultado" },
                      { label: "Valor", key: "valor" },
                      { label: "Prioridade", key: "prioridade" },
                      { label: "Docs", key: undefined },
                      { label: "Conteúdo", key: undefined },
                      { label: "Notas", key: undefined },
                      { label: "Status", key: "status" },
                      { label: "", key: undefined },
                    ] satisfies { label: string; key?: string }[]).map((col, i) => (
                      <th key={i} aria-sort={col.key && sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined} className="px-5 py-3 text-left text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em] whitespace-nowrap">
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
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  ) : filteredSorted.length === 0 ? (
                    <tr><td colSpan={15}>{editaisVisiveis.length === 0
                      ? <ListEmptyState icon={FilePenLine} title="Nenhuma inscrição neste ciclo" description="Acompanhe aqui os editais em que seus projetos estão inscritos, do interesse ao resultado." action={<PrimaryListAction onClick={() => setShowModal(true)}><Plus size={13} aria-hidden="true" /> Nova inscrição</PrimaryListAction>} />
                      : <ListEmptyState icon={Search} title="Nenhuma inscrição corresponde aos filtros" filtered onClearFilters={() => { setSearch(""); setStatusFilter("todos"); }} />}</td></tr>
                  ) : (
                    filteredSorted.map((e, i) => {
                      const sc      = statusConfig[e.status] ?? statusConfig.inscrito;
                      const empresa = e.empresas_crm?.nome ?? e.empresas?.nome ?? "—";
                      const projeto = e.projetos_crm?.nome ?? "—";
                      const rotulo  = rotuloInscricao(e);
                      const lei     = e.lei ? leiMap[e.lei] : null;
                      const timing = getInscricaoTiming({
                        status: e.status,
                        dataFechamento: e.data_fechamento,
                        updatedAt: e.updated_at,
                        createdAt: e.created_at,
                      });

                      return (
                        <tr key={e.id} onClick={() => router.push(`/editais-inscritos/${e.id}`)} className="hover:bg-black/[0.02] transition group cursor-pointer" style={{ borderBottom: i < filteredSorted.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}>
                          <td className="px-5 py-3.5 text-black/50 text-[0.78125rem] max-w-[13.75rem]">
                            {e.projetos_crm ? (
                              <div className="flex items-center gap-1.5">
                                <ProjectIdentity nome={e.projetos_crm.nome} tipo={e.projetos_crm.identidade_tipo} valor={e.projetos_crm.identidade_valor} logoUrl={e.projetos_crm.identidade_logo_url} cor={e.projetos_crm.identidade_cor} size="sm" semFundo />
                                <span>{projeto}</span>
                              </div>
                            ) : <span>{projeto}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <CompanyLogo nome={empresa} domain={e.empresas_crm?.domain_key} site={e.empresas?.site ?? e.empresas_crm?.site} logo_url={e.empresas?.logo_url} size={18} className="flex-shrink-0" />
                              {e.empresas_crm?.nome && !e.empresas?.nome ? (
                                <Link href={`/empresas-crm/${e.empresa_crm_id}`} onClick={(e2) => e2.stopPropagation()} className="text-black/60 font-medium text-[0.78125rem] whitespace-nowrap hover:text-[#7259B5] transition">
                                  {empresa}
                                </Link>
                              ) : (
                                <span className="text-black/60 font-medium text-[0.78125rem] whitespace-nowrap">{empresa}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <button type="button" onClick={event => {
                              event.stopPropagation();
                              const rect = event.currentTarget.getBoundingClientRect();
                              setLeiMenuPos({ top: rect.bottom + 4, left: rect.left });
                              setLeiMenuId(leiMenuId === e.id ? null : e.id);
                            }} className="transition hover:opacity-70">
                              {lei ? (
                                <span className="rounded border bg-white text-[0.5625rem] font-bold px-1.5 py-0.5 uppercase tracking-wide" style={{ borderColor: lei.text + "47", color: lei.text }}>
                                  {lei.label}
                                </span>
                              ) : <span className="text-black/20 text-xs hover:text-black/40">+ Lei</span>}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 max-w-[10.625rem]">
                            {e.responsavel_nome ? (
                              <span className="font-medium text-[0.78125rem] text-black/60">
                                <span className="line-clamp-1 truncate">{e.responsavel_nome}</span>
                                <span className="block text-[0.625rem] font-semibold uppercase tracking-wider" style={{ color: e.responsavel_tipo === "agencia" ? "#2D72B0" : "#1A8B7A" }}>
                                  {e.responsavel_tipo === "agencia" ? "Agência" : "Equipe"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-black/25 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-black/40 text-xs whitespace-nowrap">{fmtDate(e.created_at)}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="block text-xs tabular-nums text-black/40">{fmtDate(e.updated_at)}</span>
                            <span
                              className="mt-1 block max-w-[9.375rem] whitespace-normal text-[0.5625rem] font-semibold uppercase leading-tight tracking-[.06em]"
                              style={{ color: timing.color }}
                              title={timing.detail}
                            >
                              {timing.label}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {(() => {
                              const dias = daysUntil(e.data_fechamento);
                              const urgente = dias !== null && dias >= 0 && dias < 7;
                              const passado = dias !== null && dias < 0;
                              return (
                                <span className={`text-xs font-${urgente ? "bold" : "normal"}`} style={{ color: urgente ? "#D94E4E" : passado ? "rgba(13,13,13,.25)" : "rgba(13,13,13,.40)" }}>
                                  {urgente ? `${dias}d` : fmtDate(e.data_fechamento)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-3.5 text-black/40 text-xs whitespace-nowrap">{fmtDate(e.data_resultado)}</td>
                          <td className="px-5 py-3.5 font-semibold tabular-nums text-black/70 text-[0.8125rem] whitespace-nowrap" title={e.valor ? formatarValorCompleto(e.valor) : undefined}>{fmtValor(e.valor)}</td>
                          <td className="px-5 py-3.5"><PrioBadge prio={e.prioridade} size="md" /></td>

                          {/* Documentos */}
                          <td className="px-3 py-3.5">
                            <button
                              onClick={ev => { ev.stopPropagation(); setDocInscricao(e); }}
                              className="p-1.5 rounded text-black/25 hover:text-[#1A8B7A] hover:bg-black/5 transition"
                              title="Documentos"
                            >
                              <Files size={13} />
                            </button>
                          </td>

                          {/* Conteúdo preenchido */}
                          <td className="px-3 py-3.5">
                            <button
                              onClick={ev => { ev.stopPropagation(); setRegInscricao(e); }}
                              className="p-1.5 rounded text-black/25 hover:text-[#2D72B0] hover:bg-black/5 transition"
                              title="Conteúdo preenchido"
                            >
                              <ClipboardList size={13} />
                            </button>
                          </td>

                          {/* Anotações */}
                          <td className="px-3 py-3.5">
                            <button
                              onClick={ev => { ev.stopPropagation(); setAnotEmpresa(e); }}
                              disabled={!e.empresa_crm_id}
                              className="p-1.5 rounded text-black/25 hover:text-[#B07A14] hover:bg-black/5 transition disabled:pointer-events-none disabled:opacity-30"
                              title="Anotações"
                            >
                              <StickyNote size={13} />
                            </button>
                          </td>

                          {/* Status — dropdown rápido */}
                          <td className="px-5 py-3.5">
                            <button
                              onClick={ev => {
                                ev.stopPropagation();
                                const rect = ev.currentTarget.getBoundingClientRect();
                                const menuH = (kanbanCols.length * 36 + 8) * escalaUi();
                                setMenuPos({
                                  top:  window.innerHeight - rect.bottom > menuH ? rect.bottom + 4 : rect.top - menuH - 4,
                                  left: rect.left,
                                });
                                setStatusMenuId(statusMenuId === e.id ? null : e.id);
                              }}
                              className="inline-flex items-center gap-0 hover:opacity-80 transition cursor-pointer"
                            >
                              <StatusBadge status={e.status} label={sc.label} bg={sc.accent} iconName={sc.iconName} size="md" withChevron />
                            </button>
                          </td>

                          {/* Excluir */}
                          <td className="px-3 py-3.5">
                            <button
                              onClick={ev => { ev.stopPropagation(); handleDelete(e.id, rotulo); }}
                              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E]"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </ManagedTable>
          </ListTableSurface></ListContent>
        </>
      )}

      {/* ── Kanban view ── */}
      {view === "kanban" && (
        <KanbanBoard>
            {kanbanCols.map((status) => {
              const cfg   = statusConfig[status];
              const cards = loading ? [] : (byStatus[status] ?? []);

              return (
                <KanbanColumn
                  key={status}
                  label={cfg.label}
                  count={loading ? null : cards.length}
                  total={!loading ? fmtValor(cards.reduce((sum, item) => sum + (item.valor ?? 0), 0)) : null}
                  accent={cfg.accent}
                  iconName={cfg.iconName}
                  active={dragOverStatus === status && Boolean(draggingId)}
                  addLabel={`Nova inscrição em ${cfg.label}`}
                  onAdd={ehDesfecho(status, DESFECHOS_INSCRICAO) ? undefined : () => { setPreStatus(status); setShowModal(true); }}
                  onDragOver={e => { e.preventDefault(); setDragOverStatus(status); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={e => { e.preventDefault(); if (draggingId) moveEdital(draggingId, status); setDraggingId(null); setDragOverStatus(null); }}
                >
                    {loading ? (
                      status === "inscrito" || status === "em_analise"
                        ? Array.from({ length: 2 }).map((_, i) => <KanbanSkeleton key={i} />)
                        : null
                    ) : cards.length === 0 ? (
                      <KanbanEmpty label="Nenhuma inscrição" actionLabel="Adicionar primeira" onAction={ehDesfecho(status, DESFECHOS_INSCRICAO) ? undefined : () => { setPreStatus(status); setShowModal(true); }}/>
                    ) : (
                      cards.slice(0, getVisible(status)).map((e) => {
                        const projeto = e.projetos_crm?.nome ?? "Sem projeto";
                        const empresa = e.empresas_crm?.nome ?? e.empresas?.nome ?? "—";
                        const isGhost = draggingId === e.id;

                        return (
                          <KanbanCard
                            key={e.id}
                            dragging={isGhost}
                            onClick={() => router.push(`/editais-inscritos/${e.id}`)}
                            draggable
                            onDragStart={() => setDraggingId(e.id)}
                            onDragEnd={() => { setDraggingId(null); setDragOverStatus(null); }}
                          >
                            {/* Empresa */}
                            <div className="mb-2 flex items-center gap-1.5">
                              <CompanyLogo nome={empresa} domain={e.empresas_crm?.domain_key} site={e.empresas?.site ?? e.empresas_crm?.site} logo_url={e.empresas?.logo_url} size={18} className="flex-shrink-0" />
                              {e.empresas_crm?.nome && !e.empresas?.nome ? (
                                <Link href={`/empresas-crm/${e.empresa_crm_id}`} onClick={(e2) => e2.stopPropagation()} className="text-[0.625rem] font-semibold text-black/50 truncate hover:text-[#7259B5] transition">
                                  {empresa}
                                </Link>
                              ) : (
                                <span className="text-[0.625rem] font-semibold text-black/50 truncate">{empresa}</span>
                              )}
                              <ArrowUpRight size={12} className="ml-auto shrink-0 text-black/20 opacity-0 transition group-hover:opacity-100"/>
                            </div>

                            {/* Projeto */}
                            <p className="text-[0.8125rem] font-semibold text-black leading-snug mb-2.5 line-clamp-2">{projeto}</p>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                              {e.data_fechamento ? (
                                <span className="flex items-center gap-1 text-[0.625rem] text-black/40 font-semibold">
                                  <Calendar size={9} />
                                  {fmtShortDate(e.data_fechamento)}
                                </span>
                              ) : <span />}
                              <div className="flex items-center gap-1.5">
                                <PrioBadge prio={e.prioridade} size="sm" />
                                <span className="text-xs font-semibold tabular-nums text-black/65" title={e.valor ? formatarValorCompleto(e.valor) : undefined}>{fmtValor(e.valor)}</span>
                              </div>
                            </div>
                          </KanbanCard>
                        );
                      })
                    )}
                    {!loading && cards.length > getVisible(status) && <RevealSentinel onReveal={() => reveal(status)} />}
                </KanbanColumn>
              );
            })}
        </KanbanBoard>
      )}

      {view === "potential" && (
        <PotentialKanban
          items={filtered}
          loading={loading}
          emptyLabel="Sem inscrições"
          onMove={movePotential}
          onAdd={potential => { setPrePotential(potential); setShowModal(true); }}
          renderCard={renderPotentialCard}
        />
      )}
    </div>
  );
}
