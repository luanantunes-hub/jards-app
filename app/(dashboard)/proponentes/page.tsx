"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, List, Network, FolderOpen, CalendarClock, Mail, Landmark, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { NovoProponenteModal } from "@/components/modals/NovoProponenteModal";
import type { TipoProponente } from "@/lib/supabase/types";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListEmptyState, ListPageHeader, ListSummary, ListToolbar, PrimaryListAction, ListTableSurface } from "@/components/list/ListPagePrimitives";
import { ProjectIdentity, PROPONENTE_ICON_OPTIONS } from "@/components/ui/ProjectIdentity";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { calculateWeightedScore, CompactDecisionScoreRing } from "@/components/relationship/DecisionScorecard";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";

type ViewMode = "lista" | "mapa";
const VIEW_MODES = ["lista", "mapa"] as const;
const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "mapa", label: "Mapa", icon: Network },
] as const;

type ProponenteProject = {
  id: string;
  nome: string;
  fase: string | null;
  valor_alvo: number | null;
  valor_garantido: number | null;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
};

type ProponenteProjectRow = ProponenteProject & { proponente_id: string | null };

const PROPONENTES_COLUMNS = [
  { id: "proponente", label: "Proponente", width: "15.625rem", grow: true, hideable: false },
  { id: "perfil", label: "Perfil", width: "11.25rem" },
  { id: "portfolio", label: "Portfólio", width: "9.0625rem" },
  { id: "captacao", label: "Captação", width: "13.75rem" },
  { id: "proximo_movimento", label: "Próximo movimento", width: "11.875rem" },
  { id: "contato", label: "Contato principal", width: "12.5rem" },
  { id: "score", label: "Score", width: "5.625rem" },
  { id: "cnpj", label: "CNPJ / CPF", width: "10.625rem", defaultHidden: true },
  { id: "site", label: "Site", width: "10rem", defaultHidden: true },
  { id: "adicionado_em", label: "Adicionado em", width: "8.75rem", defaultHidden: true },
  { id: "atualizado_em", label: "Atualizado em", width: "8.75rem", defaultHidden: true },
  { id: "acoes", label: "Ações", width: "5rem", defaultHidden: true },
] as const satisfies readonly ColumnDefinition[];

type QuickFilter = "todos" | "com_projetos" | "sem_projetos" | "com_captacao" | "sem_atividade";
type ProponenteContact = { id: string; nome: string | null; email: string | null; cargo: string | null; influencia: number | null; ultima_interacao: string | null; ativo_na_empresa: boolean };
type ProponenteActivity = { id: string; proponente_id: string | null; projeto_id: string | null; nome: string; data_prevista: string | null; created_at: string };

type ProponenteScoreRow = {
  proponente_id: string;
  peso: 1 | 2 | 3;
  nota: 1 | 2 | 3 | 4 | 5 | null;
};

type ProponenteRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: TipoProponente | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  descricao: string | null;
  created_at: string;
  updated_at: string;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  score: number | null;
  n_projetos: number;
  projetos: ProponenteProject[];
  contato_principal: ProponenteContact | null;
  proxima_atividade: ProponenteActivity | null;
};

const TIPO_LABEL: Record<string, string> = {
  oscip:         "OSCIP",
  associacao:    "Associação",
  empresa:       "Empresa",
  pessoa_fisica: "Pessoa física",
  outro:         "Outro",
};

const TIPO_COLOR: Record<string, string> = {
  oscip:         "#7259B5",
  associacao:    "#2D72B0",
  empresa:       "#1A8B7A",
  pessoa_fisica: "#B07A14",
  outro:         "#888888",
};

function fmtMoney(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)} mi`;
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

function ProponentesMapView({ items, onOpenProponente, onOpenProjeto }: {
  items: ProponenteRow[];
  onOpenProponente: (id: string) => void;
  onOpenProjeto: (id: string) => void;
}) {
  const { etiquetasProponente } = useEtiquetas();
  const tipoLabels = Object.fromEntries(etiquetasProponente.map(item => [item.key, item.label]));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map(item => {
        const target = item.projetos.reduce((sum, project) => sum + Number(project.valor_alvo ?? 0), 0);
        const guaranteed = item.projetos.reduce((sum, project) => sum + Number(project.valor_garantido ?? 0), 0);
        return (
          <section key={item.id} className="overflow-hidden rounded border border-black/[.08] bg-white">
            <button type="button" onClick={() => onOpenProponente(item.id)} className="flex w-full items-start gap-3 border-b border-black/[.07] p-4 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]">
              <ProjectIdentity nome={item.nome} tipo={item.identidade_tipo} valor={item.identidade_valor} logoUrl={item.identidade_logo_url} cor={item.identidade_cor} iconOptions={PROPONENTE_ICON_OPTIONS} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="truncate text-[0.875rem] font-bold text-black">{item.nome}</h2>
                  <span className="text-[0.625rem] font-semibold text-black/35">{item.n_projetos} {item.n_projetos === 1 ? "projeto" : "projetos"}</span>
                </div>
                <p className="mt-1 text-[0.6875rem] text-black/40">{[item.tipo ? tipoLabels[item.tipo] ?? TIPO_LABEL[item.tipo] ?? item.tipo : null, item.cidade, item.estado].filter(Boolean).join(" / ") || "Sem classificação"}</p>
                {(target > 0 || guaranteed > 0) && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] text-black/35"><span>Objetivo <strong className="text-black/60">{fmtMoney(target)}</strong></span><span>Garantido <strong className="text-[#2E8932]">{fmtMoney(guaranteed)}</strong></span></div>}
              </div>
            </button>
            <div className="grid gap-2 bg-[#F7F7F5] p-3 sm:grid-cols-2">
              {item.projetos.length === 0 ? (
                <div className="col-span-full flex items-center justify-center gap-2 rounded border border-dashed border-black/10 py-8 text-[0.6875rem] text-black/25"><FolderOpen size={13}/>Nenhum projeto vinculado</div>
              ) : item.projetos.map(project => (
                <button key={project.id} type="button" onClick={() => onOpenProjeto(project.id)} className="flex min-w-0 items-center gap-2.5 rounded border border-black/[.07] bg-white p-2.5 text-left transition hover:border-black/20 hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <ProjectIdentity nome={project.nome} tipo={project.identidade_tipo} valor={project.identidade_valor} logoUrl={project.identidade_logo_url} size="sm"/>
                  <div className="min-w-0"><p className="truncate text-[0.6875rem] font-semibold text-black/75">{project.nome}</p><p className="mt-0.5 text-[0.59375rem] capitalize text-black/30">{project.fase?.replaceAll("_", " ") ?? "Planejamento"}</p></div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function ProponentesPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router = useRouter();
  const organizationId = useOrganizationId();
  const { etiquetasProponente } = useEtiquetas();
  const [proponentes, setProponentes] = useState<ProponenteRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]             = useState(false);
  const [tipoFilter, setTipoFilter]           = useState<string>("todos");
  const [quickFilter, setQuickFilter]         = useState<QuickFilter>("todos");
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:proponentes:view", VIEW_MODES, "lista");

  function handleDelete(proponente: ProponenteRow) {
    if (proponente.n_projetos > 0) {
      confirmDelete({
        blocked: true,
        title: "Este proponente tem projetos vinculados",
        description: `“${proponente.nome}” está vinculado a ${proponente.n_projetos} ${proponente.n_projetos === 1 ? "projeto" : "projetos"}. Remova ou altere esses vínculos antes de excluí-lo.`,
      });
      return;
    }
    confirmDelete({
      title: `Excluir o proponente “${proponente.nome}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setDeletingId(proponente.id);
        try {
          await excluirPorId(supabase, "proponentes", proponente.id, { vinculado: "Este proponente ainda possui registros vinculados e não pode ser excluído." });
        } finally {
          setDeletingId(null);
        }
        setProponentes(current => current.filter(item => item.id !== proponente.id));
      },
    });
  }

  async function fetchData() {
    if (!organizationId) return;
    setLoading(true);
    // Restrito à organização atual em todas as cinco consultas — proponentes
    // e projetos_crm são visíveis em todas as organizações de que o usuário
    // participa (a segunda isola só por dono via RLS, nem por organização),
    // então sem esses filtros a lista misturava dados de outras organizações.
    const [{ data: rawData, error }, { data: projectData }, { data: scoreData }, { data: contactData }, { data: activityData }] = await Promise.all([
      supabase.from("proponentes").select("id, nome, cnpj, tipo, cidade, estado, email, telefone, site, descricao, created_at, updated_at, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor").eq("organization_id", organizationId).order("nome", { ascending: true }),
      supabase.from("projetos_crm").select("id, nome, proponente_id, fase, valor_alvo, valor_garantido, identidade_tipo, identidade_valor, identidade_logo_url").eq("organization_id", organizationId).order("nome", { ascending: true }),
      supabase.from("proponente_score_criterios").select("proponente_id,peso,nota").eq("organization_id", organizationId),
      supabase.from("contatos").select("id,proponente_id,nome,email,cargo,influencia,ultima_interacao,ativo_na_empresa").eq("organization_id", organizationId).not("proponente_id", "is", null),
      supabase.from("atividades").select("id,proponente_id,projeto_id,nome,data_prevista,created_at").eq("organization_id", organizationId).eq("feita", false).order("data_prevista", { ascending: true, nullsFirst: false }),
    ]);

    if (error || !rawData) { setLoading(false); return; }
    const data = rawData as unknown as Omit<ProponenteRow, "score" | "n_projetos" | "projetos">[];
    const projectsByProponente = new Map<string, ProponenteProject[]>();
    for (const project of (projectData ?? []) as unknown as ProponenteProjectRow[]) {
      if (!project.proponente_id) continue;
      const current = projectsByProponente.get(project.proponente_id) ?? [];
      current.push(project as ProponenteProject);
      projectsByProponente.set(project.proponente_id, current);
    }
    const scoresByProponente = new Map<string, ProponenteScoreRow[]>();
    for (const criterion of (scoreData ?? []) as unknown as ProponenteScoreRow[]) {
      const current = scoresByProponente.get(criterion.proponente_id) ?? [];
      current.push(criterion);
      scoresByProponente.set(criterion.proponente_id, current);
    }
    const contactsByProponente = new Map<string, ProponenteContact[]>();
    for (const contact of (contactData ?? []) as unknown as (ProponenteContact & { proponente_id: string })[]) {
      const current = contactsByProponente.get(contact.proponente_id) ?? [];
      current.push(contact);
      contactsByProponente.set(contact.proponente_id, current);
    }
    const activities = (activityData ?? []) as unknown as ProponenteActivity[];
    const enriched = data.map(p => {
      const projetos = projectsByProponente.get(p.id) ?? [];
      const score = calculateWeightedScore(scoresByProponente.get(p.id) ?? []);
      const projectIds = new Set(projetos.map(project => project.id));
      const contatoPrincipal = [...(contactsByProponente.get(p.id) ?? [])].sort((a, b) => Number(b.ativo_na_empresa) - Number(a.ativo_na_empresa) || Number(b.influencia ?? 0) - Number(a.influencia ?? 0) || String(b.ultima_interacao ?? "").localeCompare(String(a.ultima_interacao ?? "")))[0] ?? null;
      const proximaAtividade = activities.find(activity => activity.proponente_id === p.id || Boolean(activity.projeto_id && projectIds.has(activity.projeto_id))) ?? null;
      return { ...p, score, projetos, n_projetos: projetos.length, contato_principal: contatoPrincipal, proxima_atividade: proximaAtividade };
    });

    setProponentes(enriched as ProponenteRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  function handleSaved() {
    fetchData();
  }

  const visibleProponentes = proponentes.filter(p => {
    if (tipoFilter !== "todos" && p.tipo !== tipoFilter) return false;
    const captado = p.projetos.reduce((sum, project) => sum + Number(project.valor_garantido ?? 0), 0);
    if (quickFilter === "com_projetos") return p.n_projetos > 0;
    if (quickFilter === "sem_projetos") return p.n_projetos === 0;
    if (quickFilter === "com_captacao") return captado > 0;
    if (quickFilter === "sem_atividade") return !p.proxima_atividade;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {showModal && (
        <NovoProponenteModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}

      <ListPageHeader eyebrow="Estrutura institucional" title="Proponentes" summary={!loading&&<ListSummary strong={visibleProponentes.length}>proponentes</ListSummary>} actions={<><EntityViewSwitcher value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS}/><PrimaryListAction onClick={()=>setShowModal(true)}><Plus size={13}/>Novo proponente</PrimaryListAction></>}/>

      {!loading && proponentes.length > 0 && <ListToolbar><div className="flex max-w-full flex-col gap-2 lg:flex-row"><SegmentedControl value={tipoFilter} onChange={setTipoFilter} ariaLabel="Filtrar proponentes por tipo" options={[{ value: "todos", label: "Todos os tipos" }, ...etiquetasProponente.map(item => ({ value: item.key, label: item.label }))]}/><SegmentedControl value={quickFilter} onChange={value => setQuickFilter(value as QuickFilter)} ariaLabel="Filtrar proponentes por situação" options={[{ value: "todos", label: "Todos" }, { value: "com_projetos", label: "Com projetos" }, { value: "sem_projetos", label: "Sem projetos" }, { value: "com_captacao", label: "Com captação" }, { value: "sem_atividade", label: "Sem atividade" }]}/></div></ListToolbar>}

      {/* Table */}
      <div className={`flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6 ${viewMode === "lista" ? "md:pr-0" : ""}`}>
        {proponentes.length === 0 && !loading ? (
          <ListEmptyState
            icon={Landmark}
            title="Nenhum proponente ainda"
            description="Cadastre as organizações e pessoas que propõem projetos incentivados."
            action={<PrimaryListAction onClick={() => setShowModal(true)}><Plus size={13} aria-hidden="true" /> Cadastrar proponente</PrimaryListAction>}
          />
        ) : !loading && visibleProponentes.length === 0 ? (
          <ListEmptyState
            icon={Search}
            title="Nenhum proponente corresponde aos filtros"
            filtered
            onClearFilters={() => { setTipoFilter("todos"); setQuickFilter("todos"); }}
          />
        ) : viewMode === "mapa" ? (
          <ProponentesMapView
            items={visibleProponentes}
            onOpenProponente={id => router.push(`/proponentes/${id}`)}
            onOpenProjeto={id => router.push(`/projetos/${id}`)}
          />
        ) : (
          <ListTableSurface className="!overflow-visible rounded-r-none border-r-0">
            {/* Etiqueta estrutural: Tabela CRM — cadastro de proponentes */}
              <ManagedTable storageKey="proponentes-decisao-v2" definitions={PROPONENTES_COLUMNS} className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "#F9F9F8" }}>
                    {["Proponente", "Perfil", "Portfólio", "Captação", "Próximo movimento", "Contato principal", "Score", "CNPJ / CPF", "Site", "Adicionado em", "Atualizado em", "Ações"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
                        {[200, 120, 100, 170, 150, 150, 40, 130, 100, 90, 90, 40].map((w, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-3.5 rounded bg-black/8 animate-pulse" style={{ width: `${w / 16}rem` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    visibleProponentes
                    .map((p, i, arr) => {
                      const tipoMeta = p.tipo ? etiquetasProponente.find(item => item.key === p.tipo) : null;
                      const tipoBg = tipoMeta?.cor ?? (p.tipo ? TIPO_COLOR[p.tipo] : null);
                      const activeProjects = p.projetos.filter(project => project.fase !== "concluido").length;
                      const target = p.projetos.reduce((sum, project) => sum + Number(project.valor_alvo ?? 0), 0);
                      const guaranteed = p.projetos.reduce((sum, project) => sum + Number(project.valor_garantido ?? 0), 0);
                      const progress = target > 0 ? Math.min(100, Math.round((guaranteed / target) * 100)) : 0;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-black/[0.025] transition group cursor-pointer"
                          style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(13,13,13,.045)" : "none" }}
                          onClick={() => router.push(`/proponentes/${p.id}`)}
                        >
                          {/* Nome */}
                          <td className="px-4 py-3.5 max-w-[15rem]">
                            <div className="flex items-center gap-2.5">
                              <ProjectIdentity nome={p.nome} tipo={p.identidade_tipo} valor={p.identidade_valor} logoUrl={p.identidade_logo_url} cor={p.identidade_cor} iconOptions={PROPONENTE_ICON_OPTIONS} />
                              <div className="min-w-0">
                                <p className="text-[0.8125rem] font-semibold text-black leading-tight line-clamp-1">{p.nome}</p>
                                {p.descricao && (
                                  <p className="text-[0.6875rem] text-black/35 line-clamp-1 mt-0.5">{p.descricao}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Perfil */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <p className="text-[0.6875rem] font-medium" style={{ color: tipoBg ?? "rgba(13,13,13,.35)" }}>{p.tipo ? tipoMeta?.label ?? TIPO_LABEL[p.tipo] ?? p.tipo : "Sem tipo"}</p>
                              <p className="truncate text-[0.625rem] text-black/35">{[p.cidade, p.estado].filter(Boolean).join(" · ") || "Sem localização"}</p>
                            </div>
                          </td>

                          {/* Portfólio */}
                          <td className="px-4 py-3.5">
                            <p className="text-[0.75rem] font-medium text-black/60">{p.n_projetos} {p.n_projetos === 1 ? "projeto" : "projetos"}</p>
                            <p className="mt-1 text-[0.625rem] text-black/30">{activeProjects} {activeProjects === 1 ? "ativo" : "ativos"}</p>
                          </td>

                          {/* Captação */}
                          <td className="px-4 py-3.5">
                            {target > 0 ? <div>
                              <p className="text-[0.6875rem] font-medium tabular-nums text-black/60"><span className="text-[#2E8932]">{fmtMoney(guaranteed)}</span> de {fmtMoney(target)}</p>
                              <div className="mt-2 flex items-center gap-2"><span className="h-1 flex-1 overflow-hidden rounded-full bg-black/[.06]"><span className="block h-full rounded-full bg-[#2E8932]" style={{ width: `${progress}%` }}/></span><span className="w-8 text-right text-[0.59375rem] tabular-nums text-black/35">{progress}%</span></div>
                            </div> : <span className="text-[0.6875rem] text-black/25">Sem meta definida</span>}
                          </td>

                          {/* Próximo movimento */}
                          <td className="px-4 py-3.5">
                            {p.proxima_atividade ? <div className="flex items-start gap-2"><CalendarClock size={12} className="mt-0.5 shrink-0 text-black/25"/><div className="min-w-0"><p className="truncate text-[0.6875rem] font-medium text-black/60">{p.proxima_atividade.nome}</p><p className="mt-1 text-[0.625rem] tabular-nums text-black/30">{p.proxima_atividade.data_prevista ? fmtDate(p.proxima_atividade.data_prevista) : "Sem data"}</p></div></div> : <span className="text-[0.6875rem] text-[#D94E4E]">Sem atividade</span>}
                          </td>

                          {/* Contato principal */}
                          <td className="px-4 py-3.5">
                            {p.contato_principal ? <div className="min-w-0"><p className="truncate text-[0.6875rem] font-medium text-black/60">{p.contato_principal.nome || "Contato sem nome"}</p><p className="mt-1 truncate text-[0.625rem] text-black/30">{p.contato_principal.cargo || p.contato_principal.email || "Sem detalhes"}</p></div> : p.email ? <div className="flex min-w-0 items-center gap-1.5"><Mail size={11} className="shrink-0 text-black/25"/><span className="truncate text-[0.625rem] text-black/40">{p.email}</span></div> : <span className="text-[0.6875rem] text-black/25">Sem contato</span>}
                          </td>

                          {/* Score */}
                          <td className="px-4 py-2.5">
                            <CompactDecisionScoreRing score={p.score} />
                          </td>

                          <td className="px-4 py-3.5">{p.cnpj ? <span className="text-[0.6875rem] font-mono text-black/45">{p.cnpj}</span> : <span className="text-black/20">—</span>}</td>
                          <td className="px-4 py-3.5">{p.site ? <a href={p.site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[0.625rem] text-black/40 hover:text-[#7259B5]" onClick={e=>e.stopPropagation()}><ExternalLink size={11}/><span className="truncate">{p.site.replace(/^https?:\/\//, "")}</span></a> : <span className="text-black/20">—</span>}</td>
                          <td className="px-4 py-3.5 text-[0.625rem] tabular-nums text-black/35 whitespace-nowrap">{fmtDate(p.created_at)}</td>
                          <td className="px-4 py-3.5 text-[0.625rem] tabular-nums text-black/35 whitespace-nowrap">{fmtDate(p.updated_at)}</td>

                          {/* Ações */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
                              <button
                                disabled={deletingId === p.id}
                                onClick={e => { e.stopPropagation(); void handleDelete(p); }}
                                className="p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition disabled:cursor-wait disabled:opacity-30"
                                title="Excluir"
                                aria-label={`Excluir ${p.nome}`}
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
        )}
      </div>
    </div>
  );
}
