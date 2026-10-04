"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Trash2, List, Columns3, CalendarDays, UserRound, Calendar, TrendingUp, Zap, FileText, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { NovoProjetoModal } from "@/components/modals/NovoProjetoModal";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListPageHeader, ListSummary, PrimaryListAction, ListContent, ListTableSurface, ListToolbar, ListSearch } from "@/components/list/ListPagePrimitives";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { SegmentedControl, FilterButton } from "@/components/ui/FilterControls";

type ViewMode = "lista" | "portfolio";
const VIEW_MODES = ["lista", "portfolio"] as const;
const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "portfolio", label: "Portfólio", icon: Columns3 },
] as const;

const PROJETOS_COLUMNS = [
  { id: "projeto", label: "Projeto", width: "15.625rem", grow: true, hideable: false }, { id: "proponente", label: "Proponente", width: "11.875rem" }, { id: "fase", label: "Fase", width: "7.8125rem" }, { id: "objetivo", label: "Objetivo", width: "7.8125rem" }, { id: "captado", label: "Captado", width: "7.8125rem" }, { id: "progresso", label: "Progresso", width: "9.375rem" }, { id: "captacoes", label: "Negociações", width: "6.5625rem" }, { id: "inscricoes", label: "Inscrições", width: "6.5625rem" }, { id: "prazo", label: "Próximo prazo", width: "9.0625rem" }, { id: "focal", label: "Ponto focal", width: "10.625rem" }, { id: "atualizacao", label: "Atualização", width: "8.75rem" }, { id: "acoes", label: "Ações", width: "5rem" },
] as const satisfies readonly ColumnDefinition[];

type ProjetoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  valor_alvo: number | null;
  proponente_id: string | null;
  proponente_nome: string | null;
  proponente_cidade: string | null;
  proponente_estado: string | null;
  identidade_tipo: "padrao" | "icone" | "emoji" | "logo";
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  account_id: string;
  created_at: string;
  updated_at: string;
  n_captacoes: number;
  n_inscricoes: number;
  valor_captado: number;
  fase: "Planejamento" | "Captação" | "Execução" | "Concluído";
  fase_codigo: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  proximo_prazo: string | null;
  ponto_focal: string | null;
  ultima_atualizacao: string;
  ponto_focal_id: string | null; mecanismo: string | null; data_inicio: string | null; data_fim: string | null;
  cidade: string | null; estado: string | null; abrangencia: string | null; areas_culturais: string[];
  valor_garantido: number; tags: string[]; visibilidade: "equipe" | "restrita"; status_operacional: "ativo" | "pausado" | "arquivado";
};

function fmtValor(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtAtualizacao(value: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `${days} dias atrás`;
  return new Date(value).toLocaleDateString("pt-BR");
}

function FinancialProgress({ captured, target }: { captured: number; target: number | null }) {
  if (!target || target <= 0) return <span className="text-black/20 text-xs">—</span>;

  const rawProgress = Math.max(0, Math.round((captured / target) * 100));
  const progress = Math.min(100, rawProgress);
  const completed = rawProgress >= 100;

  return (
    <div className="w-[7.375rem]" title={`${rawProgress}% do objetivo captado`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={`text-[0.625rem] font-semibold tabular-nums tracking-[-.01em] ${completed ? "text-[#267A49]" : "text-black/55"}`}>
          {progress}%
        </span>
        {completed && <span className="text-[0.5rem] font-semibold uppercase tracking-[.06em] text-[#267A49]/70">Meta</span>}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded bg-black/[.075] ring-1 ring-inset ring-black/[.025]"
        role="progressbar"
        aria-label="Progresso financeiro"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <div
          className="h-full rounded bg-[#34A368] transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

const PORTFOLIO_PHASES = [
  { key: "planejamento", label: "Planejamento", color: "#6B7280", Icon: Calendar },
  { key: "captacao", label: "Captação", color: "#7259B5", Icon: TrendingUp },
  { key: "execucao", label: "Execução", color: "#1A8B7A", Icon: Zap },
  { key: "prestacao", label: "Prestação", color: "#B07A14", Icon: FileText },
  { key: "concluido", label: "Concluído", color: "#2E8932", Icon: Check },
] as const;

function ProjectsPortfolioView({ projetos, onOpen }: { projetos: ProjetoRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[73.75rem] grid-cols-5 gap-3">
        {PORTFOLIO_PHASES.map(phase => {
          const items = projetos.filter(project => project.fase_codigo === phase.key);
          const value = items.reduce((sum, project) => sum + Number(project.valor_alvo ?? 0), 0);
          return (
            <section key={phase.key} className="flex min-h-[32.5rem] flex-col rounded border border-black/[.08] bg-[#F7F7F5]">
              <header className="border-b border-black/[.07] px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[0.75rem] font-bold" style={{ color: phase.color }}>{phase.label}</h2>
                  <span className="text-[0.625rem] font-semibold tabular-nums text-black/30">{items.length}</span>
                </div>
                <p className="mt-1 text-[0.625rem] tabular-nums text-black/35">{value > 0 ? fmtValor(value) : "Sem objetivo financeiro"}</p>
              </header>
              <div className="space-y-2 p-2.5">
                {items.length === 0 ? (
                  <div className="rounded border border-dashed border-black/10 px-3 py-8 text-center text-[0.6875rem] text-black/25">Nenhum projeto nesta fase</div>
                ) : items.map(project => {
                  const progress = project.valor_alvo ? Math.min(100, Math.round((project.valor_captado / project.valor_alvo) * 100)) : 0;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => onOpen(project.id)}
                      className="w-full rounded border border-black/[.08] bg-white p-3 text-left transition hover:border-black/20 hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                    >
                      <div className="flex items-start gap-2.5">
                        <ProjectIdentity nome={project.nome} tipo={project.identidade_tipo} valor={project.identidade_valor} logoUrl={project.identidade_logo_url} cor={project.identidade_cor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[0.75rem] font-semibold leading-[1.35] text-black">{project.nome}</p>
                          <p className="mt-1 truncate text-[0.625rem] text-black/35">{project.proponente_nome ?? "Sem proponente"}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/[.06] pt-2.5">
                        <div><p className="text-[0.5625rem] font-semibold uppercase tracking-[.08em] text-black/25">Captado</p><p className="mt-0.5 text-[0.6875rem] font-bold text-black/65">{fmtValor(project.valor_captado)}</p></div>
                        <div><p className="text-[0.5625rem] font-semibold uppercase tracking-[.08em] text-black/25">Progresso</p><p className="mt-0.5 text-[0.6875rem] font-bold tabular-nums text-black/65">{progress}%</p></div>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-[0.625rem] text-black/40">
                        <div className="flex items-center gap-1.5"><CalendarDays size={11}/><span>{project.proximo_prazo ? new Date(`${project.proximo_prazo}T00:00:00`).toLocaleDateString("pt-BR") : "Sem prazo próximo"}</span></div>
                        <div className="flex items-center gap-1.5"><UserRound size={11}/><span className="truncate">{project.ponto_focal ?? "Sem ponto focal"}</span></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function ProjetosPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router = useRouter();
  const [projetos, setProjetos] = useState<ProjetoRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [proponentePreId, setProponentePreId] = useState<string | undefined>();
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:projetos:view", VIEW_MODES, "lista");
  const [search, setSearch] = useState("");
  const [faseFilter, setFaseFilter] = useState<"todas" | ProjetoRow["fase_codigo"]>("todas");
  const [showArquivados, setShowArquivados] = useState(false);

  function handleDelete(id: string, nome: string) {
    confirmDelete({
      title: `Excluir o projeto “${nome}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "projetos_crm", id, { vinculado: "Este projeto ainda tem negociações, inscrições ou contratos vinculados. Arquive o projeto ou remova esses vínculos antes de excluí-lo." });
        setProjetos(prev => prev.filter(p => p.id !== id));
      },
    });
  }

  async function fetchData() {
    setLoading(true);
    const { data: rawData, error } = await supabase
      .from("projetos_crm")
      .select("id, account_id, nome, descricao, valor_alvo, proponente_id, proponente_nome, proponente_cidade, proponente_estado, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor, fase, ponto_focal_id, mecanismo, data_inicio, data_fim, cidade, estado, abrangencia, areas_culturais, valor_garantido, tags, visibilidade, status_operacional, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error || !rawData) { setLoading(false); return; }
    const data = rawData as unknown as Omit<ProjetoRow, "n_captacoes" | "n_inscricoes" | "valor_captado" | "fase_codigo" | "proximo_prazo" | "ponto_focal" | "ultima_atualizacao">[];

    const accountIds = [...new Set(data.map(project => project.account_id))];
    const { data: profilesData } = accountIds.length
      ? await (supabase as any).from("profiles").select("id, full_name").in("id", accountIds)
      : { data: [] };
    const profileNames = new Map<string, string>((profilesData ?? []).map((profile: any) => [profile.id, profile.full_name ?? "Membro"]));

    // Contar captações e inscrições para cada projeto em paralelo
    const enriched = await Promise.all(
      data.map(async (p) => {
        const [captacoesResult, inscricoesResult, atividadesResult, resultadoResult] = await Promise.all([
          (supabase as any).from("captacoes").select("id, status, valor_solicitado, updated_at").eq("projeto_id", p.id),
          (supabase as any).from("editais_user").select("id, status, updated_at").eq("projeto_id", p.id),
          (supabase as any).from("atividades").select("data_prevista, updated_at, feita, responsavel:profiles!responsavel_id(full_name)").eq("projeto_id", p.id).order("data_prevista", { ascending: true, nullsFirst: false }),
          (supabase as any).from("resultados_projeto").select("valor_captado, updated_at").eq("projeto_id", p.id).order("data_resultado", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
        ]);
        const captacoes = captacoesResult.data ?? [];
        const inscricoes = inscricoesResult.data ?? [];
        const atividades = atividadesResult.data ?? [];
        const resultado = resultadoResult.data;
        const captadoAprovado = captacoes.filter((captacao: any) => captacao.status === "aprovado").reduce((sum: number, captacao: any) => sum + Number(captacao.valor_solicitado ?? 0), 0);
        const valorCaptado = Number(resultado?.valor_captado ?? captadoAprovado);
        const today = new Date().toISOString().split("T")[0];
        const upcoming = atividades.find((atividade: any) => !atividade.feita && atividade.data_prevista && atividade.data_prevista >= today);
        const activeCapture = captacoes.some((captacao: any) => !["aprovado", "recusado"].includes(captacao.status));
        const hasApproved = captacoes.some((captacao: any) => captacao.status === "aprovado") || inscricoes.some((inscricao: any) => inscricao.status === "aprovado");
        const fase: ProjetoRow["fase"] = resultado ? "Concluído" : hasApproved ? "Execução" : activeCapture || inscricoes.length > 0 ? "Captação" : "Planejamento";
        const updateDates = [p.updated_at, ...captacoes.map((item: any) => item.updated_at), ...inscricoes.map((item: any) => item.updated_at), ...atividades.map((item: any) => item.updated_at), resultado?.updated_at].filter(Boolean);
        const ultimaAtualizacao = updateDates.sort().at(-1) ?? p.updated_at;
        return {
          ...p,
          n_captacoes: captacoes.length,
          n_inscricoes: inscricoes.length,
          valor_captado: valorCaptado,
          fase,
          fase_codigo: (p as any).fase,
          proximo_prazo: upcoming?.data_prevista ?? null,
          ponto_focal: upcoming?.responsavel?.full_name ?? profileNames.get(p.account_id) ?? null,
          ultima_atualizacao: ultimaAtualizacao,
        };
      })
    );

    setProjetos(enriched as ProjetoRow[]);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProponentePreId(params.get("proponente") ?? undefined);
    setShowModal(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const archivedCount = projetos.filter(p => p.status_operacional === "arquivado").length;
  const searchTerm = search.trim().toLowerCase();
  const filteredProjetos = projetos.filter(p => {
    if (faseFilter !== "todas" && p.fase_codigo !== faseFilter) return false;
    if (!showArquivados && p.status_operacional === "arquivado") return false;
    if (searchTerm && !`${p.nome} ${p.proponente_nome ?? ""}`.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  const totalValor = filteredProjetos.reduce((s, p) => s + (p.valor_alvo ?? 0), 0);

  return (
    <div className="flex flex-col h-full">
      {showModal && (
        <NovoProjetoModal
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
          proponentePreId={proponentePreId}
        />
      )}

      <ListPageHeader eyebrow="Portfólio" title="Projetos" summary={!loading&&<><ListSummary strong={filteredProjetos.length}>projetos</ListSummary>{totalValor>0&&<ListSummary strong={fmtValor(totalValor)}>em objetivos</ListSummary>}</>} actions={<><EntityViewSwitcher value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS}/><PrimaryListAction onClick={()=>setShowModal(true)}><Plus size={13}/>Novo projeto</PrimaryListAction></>}/>

      {projetos.length > 0 && (
        <ListToolbar search={<ListSearch value={search} onChange={setSearch} placeholder="Buscar projeto ou proponente"/>}>
          <SegmentedControl
            value={faseFilter}
            onChange={setFaseFilter}
            ariaLabel="Filtrar projetos por fase"
            options={[
              { value: "todas", label: "Todas" },
              ...PORTFOLIO_PHASES.map(phase => ({ value: phase.key, label: phase.label })),
            ] as const}
          />
          {archivedCount > 0 && (
            <FilterButton active={showArquivados} onClick={() => setShowArquivados(v => !v)}>
              Arquivados{showArquivados ? "" : ` (${archivedCount})`}
            </FilterButton>
          )}
        </ListToolbar>
      )}

      {/* Etiqueta estrutural: Tabela CRM — portfólio de projetos */}
      <ListContent className="md:pr-0">
        {projetos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-14 h-14 rounded bg-black/4 flex items-center justify-center mb-4">
              <FolderOpen size={22} className="text-black/25" />
            </div>
            <p className="text-[0.9375rem] font-semibold text-black/40 mb-1">Nenhum projeto ainda</p>
            <p className="text-sm text-black/25 mb-5">Crie projetos para organizar suas negociações e inscrições</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white border border-black/12 text-black rounded hover:bg-black/5 transition"
            >
              <Plus size={13} /> Criar primeiro projeto
            </button>
          </div>
        ) : filteredProjetos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-14 h-14 rounded bg-black/4 flex items-center justify-center mb-4">
              <FolderOpen size={22} className="text-black/25" />
            </div>
            <p className="text-[0.9375rem] font-semibold text-black/40 mb-1">Nenhum projeto encontrado</p>
            <p className="text-sm text-black/25 mb-5">Ajuste a busca ou os filtros para ver mais resultados</p>
            <button
              onClick={() => { setSearch(""); setFaseFilter("todas"); setShowArquivados(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white border border-black/12 text-black rounded hover:bg-black/5 transition"
            >
              Limpar filtros
            </button>
          </div>
        ) : viewMode === "portfolio" ? (
          <ProjectsPortfolioView projetos={filteredProjetos} onOpen={id => router.push(`/projetos/${id}`)} />
        ) : (
          <ListTableSurface className="rounded-r-none border-r-0">
              <ManagedTable storageKey="projetos" definitions={PROJETOS_COLUMNS} className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "#F9F9F8" }}>
                    {["Projeto", "Proponente", "Fase", "Objetivo", "Captado", "Progresso", "Negociações", "Inscrições", "Próximo prazo", "Ponto focal", "Atualização", ""].map((h) => (
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
                        {[200, 160, 80, 90, 90, 120, 60, 60, 100, 120, 90, 40].map((w, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-3.5 rounded bg-black/8 animate-pulse" style={{ width: `${w / 16}rem` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    filteredProjetos.map((p, i) => (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/projetos/${p.id}`)}
                        className="hover:bg-black/[0.025] transition group cursor-pointer"
                        style={{ borderBottom: i < filteredProjetos.length - 1 ? "1px solid rgba(13,13,13,.045)" : "none" }}
                      >
                        {/* Nome */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <ProjectIdentity nome={p.nome} tipo={p.identidade_tipo} valor={p.identidade_valor} logoUrl={p.identidade_logo_url} cor={p.identidade_cor} size="sm" />
                            <div className="min-w-0">
                              <p className="text-[0.8125rem] font-semibold text-black leading-tight line-clamp-1">{p.nome}</p>
                              {p.descricao && (
                                <p className="text-[0.6875rem] text-black/35 line-clamp-1 mt-0.5">{p.descricao}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Proponente */}
                        <td className="px-4 py-3.5">
                          {p.proponente_nome ? (
                            <div>
                              <p className="text-[0.8125rem] font-medium text-black/70">{p.proponente_nome}</p>
                              {(p.proponente_cidade || p.proponente_estado) && (
                                <p className="text-[0.6875rem] text-black/35">
                                  {[p.proponente_cidade, p.proponente_estado].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-black/20 text-xs">—</span>
                          )}
                        </td>

                        {/* Fase salva no banco */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {(() => {
                            const FASE_META: Record<string, { label: string; color: string; Icon: any }> = {
                              planejamento: { label: "Planejamento", color: "rgba(13,13,13,.40)", Icon: Calendar },
                              captacao:     { label: "Captação",     color: "#7259B5", Icon: TrendingUp },
                              execucao:     { label: "Execução",     color: "#2D72B0", Icon: Zap },
                              prestacao:    { label: "Prestação",    color: "#B07A14", Icon: FileText },
                              concluido:    { label: "Concluído",    color: "#2E8932", Icon: Check },
                            };
                            const fm = FASE_META[p.fase_codigo] ?? FASE_META.planejamento;
                            return (
                              <span className="inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: fm.color + "47", color: fm.color }}>
                                <fm.Icon size={10} />{fm.label}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Objetivo */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-[0.8125rem] font-bold text-black/70">{fmtValor(p.valor_alvo)}</span>
                        </td>

                        {/* Captado */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-[0.8125rem] font-semibold" style={{ color: p.valor_captado > 0 ? "#2E8932" : "rgba(13,13,13,.20)" }}>{fmtValor(p.valor_captado)}</span>
                        </td>

                        {/* Progresso financeiro */}
                        <td className="px-4 py-3.5 min-w-[8.75rem]">
                          <FinancialProgress captured={p.valor_captado} target={p.valor_alvo} />
                        </td>

                        {/* Captações */}
                        <td className="px-4 py-3.5">
                          <span className="text-[0.8125rem] font-semibold text-black/60">{p.n_captacoes || <span className="text-black/20">0</span>}</span>
                        </td>

                        {/* Inscrições */}
                        <td className="px-4 py-3.5">
                          <span className="text-[0.8125rem] font-semibold text-black/60">{p.n_inscricoes || <span className="text-black/20">0</span>}</span>
                        </td>

                        {/* Próximo prazo */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-[0.6875rem] font-medium text-black/45">{p.proximo_prazo ? new Date(`${p.proximo_prazo}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</span>
                        </td>

                        {/* Ponto focal */}
                        <td className="px-4 py-3.5">
                          <span className={`block max-w-[8.75rem] truncate text-[0.6875rem] font-medium ${p.ponto_focal ? "text-black/55" : "text-[#B07A14]"}`}>{p.ponto_focal ?? "Sem ponto focal"}</span>
                        </td>

                        {/* Última atualização */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-[0.65625rem] text-black/35">{fmtAtualizacao(p.ultima_atualizacao)}</span>
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(p.id, p.nome); }}
                              className="p-1.5 rounded hover:bg-[#D94E4E]/[.06] text-black/20 hover:text-[#D94E4E] transition"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </ManagedTable>
          </ListTableSurface>
        )}
      </ListContent>
    </div>
  );
}
