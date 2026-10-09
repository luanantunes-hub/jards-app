"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Clock, AlertTriangle, Trash2, List, PanelsTopLeft,
  HeartPulse, RefreshCw, TrendingUp, Eye, CalendarDays, UserRound, UserRoundCheck, Plus, Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { NovaContaClienteModal } from "@/components/modals/NovaContaClienteModal";
import { SegmentedControl } from "@/components/ui/FilterControls";
import type { ContaPatrocinio, SaudeConta } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type ViewMode = "lista" | "carteira";
type PortfolioLane = "intervir" | "renovar" | "expandir" | "acompanhar";

const VIEW_MODES = ["lista", "carteira"] as const;
const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "carteira", label: "Carteira", icon: PanelsTopLeft },
] as const;

const HEALTH_WEIGHT: Record<SaudeConta["estado"], number> = {
  saudavel: 90,
  atencao: 58,
  risco: 24,
  sem_dados: 40,
};

const CONTAS_COLUMNS = [
  { id: "empresa", label: "Empresa", width: "minmax(16.25rem,1.5fr)", hideable: false },
  { id: "status", label: "Status", width: "6.5625rem", hideable: false },
  { id: "saude", label: "Saúde", width: "7.8125rem" },
  { id: "responsavel", label: "Responsável", width: "9.375rem" },
  { id: "contratos", label: "Contratos", width: "6.25rem" },
  { id: "valor", label: "Valor total", width: "8.125rem" },
  { id: "renovacao", label: "Próx. renovação", width: "9.0625rem" },
  { id: "atividade", label: "Última interação", width: "8.75rem" },
  { id: "adicionado_em", label: "Adicionado em", width: "7.8125rem", defaultHidden: true },
  { id: "atualizado_em", label: "Atualizado em", width: "7.8125rem", defaultHidden: true },
  { id: "acoes", label: "Ações", width: "5rem", defaultHidden: true },
] as const satisfies readonly ColumnDefinition[];

const STATUS_LABEL: Record<string, { label: string; bg: string }> = {
  ativa:     { label: "Ativa",     bg: "#2E8932" },
  pausada:   { label: "Pausada",   bg: "#B07A14" },
  encerrada: { label: "Encerrada", bg: "#D94E4E" },
};

/** Só o atraso pinta o ícone: âmbar de 31 a 60 dias sem atividade, vermelho depois disso. */
function diasSemAtividadeAlerta(dias: number | null): string | undefined {
  if (dias === null || dias <= 30) return undefined;
  return dias <= 60 ? "#B07A14" : "#D94A4A";
}

/** A leitura fica neutra; só Risco e Atenção pintam o ícone de alerta. */
function healthMeta(score: number | null, readings: number): { label: string; alerta?: string } {
  if (score === null || readings === 0) return { label: "Sem leitura" };
  if (score < 44) return { label: "Risco", alerta: "#D94A4A" };
  if (score < 64) return { label: "Atenção", alerta: "#B07A14" };
  if (score < 84) return { label: "Estável" };
  return { label: "Saudável" };
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

type ContaRow = ContaPatrocinio & {
  empresa_crm: { nome: string; setor: string | null; domain_key: string | null; site: string | null } | null;
  n_contratos: number;
  proxima_renovacao: string | null;
  dias_sem_atividade: number | null;
  compromissos_atrasados: number;
  health_score: number | null;
  health_has_risk: boolean;
  health_readings: number;
  renewal_scenario: "renovar" | "expandir" | "reduzir" | "encerrar" | null;
  renewal_probability: number | null;
  renewal_expected_value: number | null;
  renewal_expected_date: string | null;
  has_expansion_forecast: boolean;
  responsavel_nome: string | null;
  proxima_atividade: { nome: string; data: string | null; responsavel: string | null } | null;
  portfolio_lane: PortfolioLane;
  portfolio_reason: string;
  portfolio_action: string;
  portfolio_deadline: string | null;
  portfolio_urgency: number;
};

type ContaViewRow = ContaPatrocinio & {
  empresa_nome: string;
  setor: string | null;
  domain_key: string | null;
  site: string | null;
  n_contratos: number;
  proxima_renovacao: string | null;
  dias_sem_atividade: number | null;
  compromissos_atrasados: number | null;
};

type HealthSignal = Pick<SaudeConta, "conta_patrocinio_id" | "dimensao" | "estado" | "created_at">;
type HealthScorecardSignal = { conta_patrocinio_id: string; peso: number; ativo: boolean; criterios: Array<{ peso: number; nota: number | null; ativo: boolean }> };
type ForecastSignal = {
  cenario: "renovar" | "expandir" | "reduzir" | "encerrar";
  probabilidade: number | null;
  valor_esperado: number | null;
  data_esperada: string | null;
  contrato: { conta_patrocinio_id: string; proxima_renovacao: string | null } | null;
};
type ActivitySignal = {
  conta_patrocinio_id: string;
  nome: string;
  data_prevista: string | null;
  responsavel: { full_name: string | null } | null;
};
type AccountTimestamp = { id: string; created_at: string; updated_at: string };

function scoreFromCards(cards: HealthScorecardSignal[]) {
  const rated = cards.filter(card => card.ativo).map(card => {
    const criteria = (card.criterios ?? []).filter(item => item.ativo && item.nota !== null);
    const weight = criteria.reduce((sum, item) => sum + item.peso, 0);
    return { score: weight ? criteria.reduce((sum, item) => sum + (item.nota ?? 0) * item.peso, 0) / weight : null, weight: card.peso };
  }).filter(item => item.score !== null);
  const totalWeight = rated.reduce((sum, item) => sum + item.weight, 0);
  return { score: totalWeight ? Math.round(rated.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) / totalWeight / 5 * 100) : null, readings: rated.length };
}

const PORTFOLIO_LANES: Array<{
  key: PortfolioLane;
  label: string;
  description: string;
  /** Só a faixa de alerta pinta o ícone; as demais ficam cinza. */
  alerta?: string;
  icon: typeof HeartPulse;
}> = [
  { key: "intervir", label: "Intervir", description: "Risco ou atraso exige ação", alerta: "#D94A4A", icon: HeartPulse },
  { key: "renovar", label: "Renovar", description: "Renovação nos próximos 90 dias", icon: RefreshCw },
  { key: "expandir", label: "Expandir", description: "Parceria pronta para crescer", icon: TrendingUp },
  { key: "acompanhar", label: "Acompanhar", description: "Relacionamento em curso", icon: Eye },
];

function classifyPortfolio(account: Omit<ContaRow, "portfolio_lane" | "portfolio_reason" | "portfolio_action" | "portfolio_deadline" | "portfolio_urgency">) {
  const renewalDays = daysUntil(account.proxima_renovacao);
  const isActive = account.status === "ativa";
  const nextActivity = account.proxima_atividade;

  if (isActive && (account.health_has_risk || account.compromissos_atrasados > 0 || (account.dias_sem_atividade ?? 0) > 60)) {
    const reason = account.health_has_risk
      ? "Saúde da parceria em risco"
      : account.compromissos_atrasados > 0
        ? `${account.compromissos_atrasados} ${account.compromissos_atrasados === 1 ? "compromisso atrasado" : "compromissos atrasados"}`
        : `${account.dias_sem_atividade} dias sem atividade`;
    return {
      portfolio_lane: "intervir" as const,
      portfolio_reason: reason,
      portfolio_action: nextActivity?.nome ?? "Revisar plano da parceria",
      portfolio_deadline: nextActivity?.data ?? account.proxima_renovacao,
      portfolio_urgency: account.health_has_risk ? 0 : account.compromissos_atrasados > 0 ? 1 : 2,
    };
  }

  if (isActive && renewalDays !== null && renewalDays >= 0 && renewalDays <= 90) {
    return {
      portfolio_lane: "renovar" as const,
      portfolio_reason: renewalDays === 0 ? "Renovação hoje" : `Renovação em ${renewalDays} dias`,
      portfolio_action: "Preparar renovação",
      portfolio_deadline: account.proxima_renovacao,
      portfolio_urgency: renewalDays,
    };
  }

  if (isActive && account.has_expansion_forecast && account.health_readings > 0 && (account.health_score ?? 0) >= 70) {
    return {
      portfolio_lane: "expandir" as const,
      portfolio_reason: account.renewal_probability !== null ? `Expansão com ${account.renewal_probability}% de probabilidade` : "Expansão prevista",
      portfolio_action: "Estruturar expansão",
      portfolio_deadline: account.renewal_expected_date ?? nextActivity?.data ?? null,
      portfolio_urgency: 100 - (account.renewal_probability ?? 0),
    };
  }

  return {
    portfolio_lane: "acompanhar" as const,
    portfolio_reason: account.status !== "ativa"
      ? STATUS_LABEL[account.status]?.label ?? "Cliente sem atividade"
      : account.health_readings === 0
        ? "Saúde ainda não avaliada"
        : nextActivity?.data
          ? `Próxima atividade em ${fmtDate(nextActivity.data)}`
          : "Acompanhamento regular",
    portfolio_action: nextActivity?.nome ?? "Manter acompanhamento",
    portfolio_deadline: nextActivity?.data ?? null,
    portfolio_urgency: nextActivity?.data ? Math.max(0, daysUntil(nextActivity.data) ?? 9999) : 9999,
  };
}

function CustomerPortfolio({ accounts, loading, onOpen }: { accounts: ContaRow[]; loading: boolean; onOpen: (id: string) => void }) {
  if (loading) {
    return <div className="grid min-w-[70rem] grid-cols-4 gap-3">{PORTFOLIO_LANES.map(lane => <div key={lane.key} className="h-[32.5rem] animate-pulse rounded bg-black/[.05]" />)}</div>;
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[70rem] grid-cols-4 gap-3">
        {PORTFOLIO_LANES.map(lane => {
          const LaneIcon = lane.icon;
          const items = accounts.filter(account => account.portfolio_lane === lane.key).sort((a, b) => a.portfolio_urgency - b.portfolio_urgency || b.valor_total - a.valor_total);
          const total = items.reduce((sum, account) => sum + Number(account.valor_total ?? 0), 0);
          return (
            <section key={lane.key} className="flex min-h-[32.5rem] flex-col rounded border border-black/[.08] bg-[#F7F7F5]">
              <header className="border-b border-black/[.07] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="flex items-center gap-1.5"><LaneIcon size={12} strokeWidth={1.75} aria-hidden="true" className={lane.alerta ? "shrink-0" : "shrink-0 text-black/40"} style={lane.alerta ? { color: lane.alerta } : undefined}/><h2 className="text-[0.75rem] font-semibold text-black/75">{lane.label}</h2></div><p className="mt-1 text-[0.59375rem] text-black/30">{lane.description}</p></div>
                  <span className="text-[0.625rem] font-semibold tabular-nums text-black/30">{items.length}</span>
                </div>
                <p className="mt-2 text-[0.625rem] tabular-nums text-black/35">{total > 0 ? <span title={formatarValorCompleto(total)}>{formatarValorCurto(total)} na carteira</span> : "Sem valor registrado"}</p>
              </header>
              <div className="space-y-2 p-2.5">
                {items.length === 0 ? (
                  <div className="rounded border border-dashed border-black/10 px-3 py-10 text-center text-[0.65625rem] text-black/25">Nenhum cliente nesta faixa</div>
                ) : items.map(account => {
                  const companyName = account.empresa_crm?.nome ?? account.nome ?? "Cliente";
                  const alerta = healthMeta(account.health_score, account.health_readings).alerta;
                  return (
                    <button key={account.id} type="button" onClick={() => onOpen(account.id)} className="w-full rounded border border-black/[.08] bg-white p-3 text-left transition hover:border-black/20 hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
                      <div className="flex items-start gap-2.5">
                        <CompanyLogo nome={companyName} domain={account.empresa_crm?.domain_key} site={account.empresa_crm?.site} size={32} className="shrink-0 border border-black/[.06]"/>
                        <div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-[#282525]">{companyName}</p><p className="mt-0.5 truncate text-[0.59375rem] text-black/30">{account.nome && account.nome !== companyName ? account.nome : account.empresa_crm?.setor ?? "Cliente"}</p></div>
                        {account.health_score !== null && <span className="flex shrink-0 items-center gap-1 text-[0.625rem] font-semibold tabular-nums text-[#282525]"><HeartPulse size={12} strokeWidth={1.75} aria-hidden="true" className={alerta ? "shrink-0" : "shrink-0 text-black/40"} style={alerta ? { color: alerta } : undefined}/>{account.health_score}</span>}
                      </div>
                      <div className="mt-3 border-t border-black/[.06] pt-2.5">
                        <p className="text-[0.625rem] font-semibold text-black/55">{account.portfolio_reason}</p>
                        <p className="mt-1 line-clamp-2 text-[0.6875rem] font-medium leading-[1.4] text-black/65">{account.portfolio_action}</p>
                      </div>
                      <div className="mt-2.5 space-y-1.5 text-[0.59375rem] text-black/35">
                        <div className="flex items-center gap-1.5"><CalendarDays size={10}/><span>{account.portfolio_deadline ? fmtDate(account.portfolio_deadline) : "Sem prazo definido"}</span></div>
                        <div className="flex items-center gap-1.5"><UserRound size={10}/><span className="truncate">{account.proxima_atividade?.responsavel ?? account.responsavel_nome ?? "Sem responsável"}</span></div>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-black/[.05] pt-2"><span className="text-[0.5625rem] text-black/25">{account.n_contratos} {account.n_contratos === 1 ? "contrato" : "contratos"}</span><span className="text-[0.625rem] font-semibold tabular-nums text-black/55" title={account.valor_total ? formatarValorCompleto(account.valor_total) : undefined}>{account.valor_total ? formatarValorCurto(account.valor_total) : "—"}</span></div>
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

export default function ContasPatrocinioPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router = useRouter();

  const [contas, setContas] = useState<ContaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [specialFilter, setSpecialFilter] = useState<string>("todas");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:clientes:view", VIEW_MODES, "lista");

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [accountsResult, healthResult, scorecardsResult, forecastsResult, activitiesResult, timestampsResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("vw_contas_carteira").select("*").order("created_at", { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("saude_conta").select("conta_patrocinio_id, dimensao, estado, created_at").order("created_at", { ascending: false }),
        (supabase as any).from("saude_parceria_scorecards").select("conta_patrocinio_id,peso,ativo,criterios:saude_parceria_criterios(peso,nota,ativo)").eq("ativo", true),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("previsoes_renovacao").select("cenario, probabilidade, valor_esperado, data_esperada, contrato:contratos!contrato_id(conta_patrocinio_id, proxima_renovacao)"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("atividades").select("conta_patrocinio_id, nome, data_prevista, responsavel:profiles!responsavel_id(full_name)").eq("feita", false).not("conta_patrocinio_id", "is", null).order("data_prevista", { ascending: true, nullsFirst: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("contas_patrocinio").select("id, created_at, updated_at"),
      ]);

      const { data, error } = accountsResult;

      if (!error && data) {
        const rawAccounts = data as ContaViewRow[];
        const timestampsByAccount = new Map<string, AccountTimestamp>(((timestampsResult.data ?? []) as AccountTimestamp[]).map(item => [item.id, item]));
        const responsibleIds = [...new Set(rawAccounts.map(account => account.responsavel_id).filter((id): id is string => Boolean(id)))];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profilesData } = responsibleIds.length ? await (supabase as any).from("profiles").select("id, full_name").in("id", responsibleIds) : { data: [] };
        const profileNames = new Map<string, string>((profilesData ?? []).map((profile: { id: string; full_name: string | null }) => [profile.id, profile.full_name ?? "Membro"]));

        const healthByAccount = new Map<string, HealthSignal[]>();
        const latestHealthKeys = new Set<string>();
        for (const signal of (healthResult.data ?? []) as HealthSignal[]) {
          const key = `${signal.conta_patrocinio_id}:${signal.dimensao}`;
          if (latestHealthKeys.has(key)) continue;
          latestHealthKeys.add(key);
          const current = healthByAccount.get(signal.conta_patrocinio_id) ?? [];
          current.push(signal);
          healthByAccount.set(signal.conta_patrocinio_id, current);
        }

        const scorecardsByAccount = new Map<string, HealthScorecardSignal[]>();
        for (const card of (scorecardsResult.data ?? []) as HealthScorecardSignal[]) {
          const current = scorecardsByAccount.get(card.conta_patrocinio_id) ?? [];
          current.push(card);
          scorecardsByAccount.set(card.conta_patrocinio_id, current);
        }

        const forecastsByAccount = new Map<string, {
          scenario: ForecastSignal["cenario"] | null;
          probability: number | null;
          expectedValue: number | null;
          expectedDate: string | null;
          hasExpansion: boolean;
          sortDate: string;
        }>();
        for (const forecast of (forecastsResult.data ?? []) as ForecastSignal[]) {
          const accountId = forecast.contrato?.conta_patrocinio_id;
          if (!accountId) continue;
          const sortDate = forecast.data_esperada ?? forecast.contrato?.proxima_renovacao ?? "9999-12-31";
          const current = forecastsByAccount.get(accountId);
          const hasExpansion = Boolean(current?.hasExpansion || forecast.cenario === "expandir");
          if (!current || sortDate < current.sortDate) {
            forecastsByAccount.set(accountId, {
              scenario: forecast.cenario,
              probability: forecast.probabilidade,
              expectedValue: forecast.valor_esperado,
              expectedDate: forecast.data_esperada,
              hasExpansion,
              sortDate,
            });
          } else if (hasExpansion !== current.hasExpansion) {
            forecastsByAccount.set(accountId, { ...current, hasExpansion });
          }
        }

        const activitiesByAccount = new Map<string, ActivitySignal>();
        for (const activity of (activitiesResult.data ?? []) as ActivitySignal[]) {
          if (!activitiesByAccount.has(activity.conta_patrocinio_id)) activitiesByAccount.set(activity.conta_patrocinio_id, activity);
        }

        const enriched = rawAccounts.map((conta) => {
          const health = healthByAccount.get(conta.id) ?? [];
          const scorecardHealth = scoreFromCards(scorecardsByAccount.get(conta.id) ?? []);
          const forecast = forecastsByAccount.get(conta.id);
          const activity = activitiesByAccount.get(conta.id);
          const timestamps = timestampsByAccount.get(conta.id);
          const legacyHealthScore = health.length ? Math.round(health.reduce((sum, signal) => sum + HEALTH_WEIGHT[signal.estado], 0) / health.length) : null;
          const healthScore = scorecardHealth.score ?? legacyHealthScore;
          const base = {
            ...conta,
            created_at: timestamps?.created_at ?? conta.created_at,
            updated_at: timestamps?.updated_at ?? conta.updated_at,
            empresa_crm: { nome: conta.empresa_nome, setor: conta.setor, domain_key: conta.domain_key, site: conta.site },
            compromissos_atrasados: Number(conta.compromissos_atrasados ?? 0),
            health_score: healthScore,
            health_has_risk: scorecardHealth.score !== null ? scorecardHealth.score < 44 : health.some(signal => signal.estado === "risco"),
            health_readings: scorecardHealth.readings || health.length,
            renewal_scenario: forecast?.scenario ?? null,
            renewal_probability: forecast?.probability ?? null,
            renewal_expected_value: forecast?.expectedValue ?? null,
            renewal_expected_date: forecast?.expectedDate ?? null,
            has_expansion_forecast: forecast?.hasExpansion ?? false,
            responsavel_nome: conta.responsavel_id ? profileNames.get(conta.responsavel_id) ?? null : null,
            proxima_atividade: activity ? { nome: activity.nome, data: activity.data_prevista, responsavel: activity.responsavel?.full_name ?? null } : null,
          };
          return { ...base, ...classifyPortfolio(base) } as ContaRow;
        });
        setContas(enriched);
      }
      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const filtered = contas
    .filter((c) => {
      if (statusFilter === "ativas" && c.status !== "ativa") return false;
      if (statusFilter !== "todas" && statusFilter !== "ativas" && c.status !== statusFilter) return false;
      if (!dSearch.trim()) return true;
      const s = dSearch.toLowerCase();
      return (
        (c.empresa_crm?.nome ?? "").toLowerCase().includes(s) ||
        (c.nome ?? "").toLowerCase().includes(s)
      );
    })
    .filter((c) => {
      if (specialFilter === "renovacao_proxima") {
        const days = daysUntil(c.proxima_renovacao);
        return days !== null && days <= 90 && days >= 0;
      }
      if (specialFilter === "sem_atividade") {
        return c.dias_sem_atividade !== null && c.dias_sem_atividade > 60;
      }
      return true;
    });

  const stats = {
    ativas:   contas.filter(c => c.status === "ativa").length,
    pausadas: contas.filter(c => c.status === "pausada").length,
    renovacao: contas.filter(c => { const d = daysUntil(c.proxima_renovacao); return d !== null && d <= 30 && d >= 0; }).length,
    emRisco:  contas.filter(c => c.portfolio_lane === "intervir").length,
  };

  function handleDelete(conta: ContaRow) {
    const nome = conta.nome || conta.empresa_crm?.nome || "este cliente";
    confirmDelete({
      title: `Excluir o cliente “${nome}”?`,
      description: "Contratos e planos de ativação vinculados também serão removidos. Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setDeletingId(conta.id);
        try {
          await excluirPorId(supabase, "contas_patrocinio", conta.id);
        } finally {
          setDeletingId(null);
        }
        setContas(current => current.filter(item => item.id !== conta.id));
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader eyebrow="Gestão da carteira" title="Clientes" summary={!loading&&<><ListSummary strong={stats.ativas}>ativas</ListSummary><ListSummary strong={stats.renovacao}>renovações próximas</ListSummary><ListSummary strong={stats.emRisco} icone={AlertTriangle} alerta={stats.emRisco > 0 ? "vermelho" : undefined}>em atenção</ListSummary></>} actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNovoCliente(true)} className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-white border border-black/12 text-[#282525] rounded hover:bg-black/5 transition">
            <Plus size={13} /> Novo cliente
          </button>
          <EntityViewSwitcher value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS}/>
        </div>
      }/>

      {/* Filters */}
      <ListToolbar search={<ListSearch value={search} onChange={setSearch} placeholder="Buscar cliente ou empresa"/>}>
        <SegmentedControl
          value={statusFilter}
          onChange={setStatusFilter}
          ariaLabel="Filtrar por status"
          options={[
            { value: "todas",     label: "Todas" },
            { value: "ativas",    label: "Ativas" },
            { value: "pausada",   label: "Pausadas" },
            { value: "encerrada", label: "Encerradas" },
          ] as const}
        />

        <div className="h-5 w-px bg-black/10" />

        <SegmentedControl
          value={specialFilter === "todas" ? null : specialFilter as "renovacao_proxima" | "sem_atividade"}
          onChange={(val) => setSpecialFilter(specialFilter === val ? "todas" : val)}
          ariaLabel="Filtrar por alerta"
          options={[
            { value: "renovacao_proxima", label: "Renovação próxima", icon: Clock },
            { value: "sem_atividade",     label: "Sem atividade",     icon: AlertTriangle },
          ] as const}
        />
      </ListToolbar>

      {/* Lista e carteira operacional compartilham busca e filtros */}
      <ListContent className={viewMode === "carteira" ? "" : "md:pr-0"}>{viewMode === "carteira" ? (
        filtered.length === 0 && !loading ? (
          contas.length === 0
            ? <ListEmptyState icon={UserRoundCheck} title="Nenhum cliente cadastrado" description="Clientes surgem de negociações aprovadas ou podem ser cadastrados diretamente." action={<PrimaryListAction onClick={() => setShowNovoCliente(true)}><Plus size={13} aria-hidden="true" /> Novo cliente</PrimaryListAction>} />
            : <ListEmptyState icon={Search} title="Nenhum cliente corresponde aos filtros" filtered onClearFilters={() => { setSearch(""); setStatusFilter("todas"); setSpecialFilter("todas"); }} />
        ) : <CustomerPortfolio accounts={filtered} loading={loading} onOpen={id => router.push(`/contas-patrocinio/${id}`)}/>
      ) : <ListTableSurface className="!overflow-visible rounded-r-none border-r-0">
        <ManagedTable storageKey="contas-patrocinio-v2" definitions={CONTAS_COLUMNS} className="w-full">
          <thead>
            <tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Empresa</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Status</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Saúde</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Responsável</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Contratos</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Valor Total</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Próx. Renovação</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Última interação</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Adicionado em</th>
              <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Atualizado em</th>
              <th className="px-5 py-3 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <td key={j} className="px-5 py-3.5"><div className="h-4 w-20 bg-black/8 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11}>
                  {contas.length === 0
                    ? <ListEmptyState icon={UserRoundCheck} title="Nenhum cliente cadastrado" description="Clientes surgem de negociações aprovadas ou podem ser cadastrados diretamente." action={<PrimaryListAction onClick={() => setShowNovoCliente(true)}><Plus size={13} aria-hidden="true" /> Novo cliente</PrimaryListAction>} />
                    : <ListEmptyState icon={Search} title="Nenhum cliente corresponde aos filtros" filtered onClearFilters={() => { setSearch(""); setStatusFilter("todas"); setSpecialFilter("todas"); }} />}
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => {
                const st = STATUS_LABEL[c.status];
                const days = daysUntil(c.proxima_renovacao);
                const renovWarning = days !== null && days <= 30;
                const health = healthMeta(c.health_score, c.health_readings);

                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/contas-patrocinio/${c.id}`)}
                    className="hover:bg-black/[0.02] transition group cursor-pointer"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                  >
                    {/* Empresa */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo
                          nome={c.empresa_crm?.nome ?? "?"}
                          domain={c.empresa_crm?.domain_key}
                          site={c.empresa_crm?.site}
                          size={28}
                          className="flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[0.8125rem] font-semibold text-[#282525] truncate block">
                            {c.empresa_crm?.nome || "—"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      {st && (
                        <span
                          className="text-[0.625rem] font-bold px-2 py-0.5 rounded text-white uppercase tracking-wide"
                          style={{ background: st.bg }}
                        >
                          {st.label}
                        </span>
                      )}
                    </td>

                    {/* Saúde da parceria */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] font-medium ${c.health_score === null || c.health_readings === 0 ? "text-black/30" : "text-black/60"}`}
                        title={c.health_score === null ? "Saúde ainda não avaliada" : `Score de saúde: ${c.health_score} de 100`}
                      >
                        {health.alerta && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: health.alerta }} />}
                        {health.label}
                      </span>
                    </td>

                    {/* Responsável */}
                    <td className="px-5 py-3.5">
                      <div className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-black/55">
                        <UserRound size={12} className="shrink-0 text-black/25" />
                        <span className="truncate">{c.responsavel_nome ?? "Sem responsável"}</span>
                      </div>
                    </td>

                    {/* Contratos */}
                    <td className="px-5 py-3.5 text-black/50 text-[0.75rem]">
                      {c.n_contratos}
                    </td>

                    {/* Valor Total */}
                    <td className="px-5 py-3.5 text-[0.75rem] font-semibold tabular-nums text-black/75" title={c.valor_total ? formatarValorCompleto(c.valor_total) : undefined}>
                      {c.valor_total ? formatarValorCurto(c.valor_total) : "—"}
                    </td>

                    {/* Próxima Renovação */}
                    <td className="px-5 py-3.5">
                      {c.proxima_renovacao ? (
                        <div className="flex items-center gap-1.5">
                          {renovWarning && (
                            <span role="img" className="shrink-0" title="Renovação próxima" aria-label="Renovação próxima">
                              <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="text-[#B07A14]" />
                            </span>
                          )}
                          <span className="text-[0.75rem] tabular-nums text-black/60">
                            {fmtDate(c.proxima_renovacao)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-black/20 text-[0.75rem]">—</span>
                      )}
                    </td>

                    {/* Última interação */}
                    <td className="px-5 py-3.5">
                      {c.dias_sem_atividade !== null ? (() => {
                        const alerta = diasSemAtividadeAlerta(c.dias_sem_atividade);
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {alerta && <Clock size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: alerta }} />}
                            <span className="text-[0.75rem] font-medium tabular-nums text-black/60">
                              {c.dias_sem_atividade === 0 ? "Hoje" : `há ${c.dias_sem_atividade} dias`}
                            </span>
                          </span>
                        );
                      })() : (
                        <span className="text-black/25 text-[0.75rem]">Sem registro</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-[0.75rem] tabular-nums text-black/40 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-3.5 text-[0.75rem] tabular-nums text-black/40 whitespace-nowrap">{fmtDate(c.updated_at)}</td>

                    {/* Ações */}
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        disabled={deletingId === c.id}
                        onClick={(event) => { event.stopPropagation(); void handleDelete(c); }}
                        className="flex h-7 w-7 items-center justify-center rounded text-black/25 opacity-100 transition hover:bg-black/[.04] hover:text-[#D94E4E] disabled:cursor-wait disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100"
                        title="Excluir cliente"
                        aria-label={`Excluir ${c.nome || c.empresa_crm?.nome || "cliente"}`}
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
      </ListTableSurface>}</ListContent>

      {showNovoCliente && (
        <NovaContaClienteModal
          onClose={() => setShowNovoCliente(false)}
          onSaved={() => { setShowNovoCliente(false); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
