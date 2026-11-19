"use client";
import { useState, useEffect } from "react";
import { SEGMENTS as GAUGE_SEGMENTS_DO_DETALHE } from "@/components/ui/RelationshipScoreGauge";
import { useRouter } from "next/navigation";
import { Building2, Trash2, List, Grid2X2, TrendingUp, UsersRound, Plus, Search, Shield, UserCheck, CalendarClock, CircleHelp } from "lucide-react";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { NovoClienteModal } from "@/components/modals/NovoClienteModal";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { EmpresaCrm } from "@/lib/supabase/types";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { useFiltroResponsavel } from "@/hooks/useFiltroResponsavel";
import { FiltroResponsavel } from "@/components/list/FiltroResponsavel";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type ViewMode = "lista" | "matriz";
const VIEW_MODES = ["lista", "matriz"] as const;
const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "matriz", label: "Matriz", icon: Grid2X2 },
] as const;

type EmpresaViewRow = EmpresaCrm & {
  activePipelineValue: number;
  activeNegotiations: number;
  convertedValue: number;
  projectsCount: number;
  inscricoesCount: number;
  inscricoesValue: number;
  contatosCount: number;
  ultimoContatoDias: number | null;
  proximoFollowup: string | null;
  responsavelNome: string | null;
  /** Quem responde pela empresa: o responsável dela e os das negociações com ela. */
  donos: string[];
  atribuicao: { captadorNome: string; tipo: string } | null;
};

type CaptacaoMetricRow = {
  empresa_crm_id: string | null;
  status: string;
  valor_solicitado: number | null;
  projeto_id: string | null;
  captador_id: string | null;
  supervisor_id: string | null;
};

const TIPO_ETIQUETA: Record<string, { label: string; color: string }> = {
  prospect:      { label: "Prospect",   color: "#7259B5" },
  cliente_ativo: { label: "Cliente",    color: "#2E8932" },
  ex_cliente:    { label: "Ex-Cliente", color: "#D94E4E" },
};

const EXCLUSAO_CONFIG: Record<string, { label: string; bg: string; icon: React.ElementType }> = {
  exclusividade_empresa: { label: "Exclusiva",     bg: "#D94E4E", icon: Shield },
  compartilhada:         { label: "Compartilhada", bg: "#1A8B7A", icon: UserCheck },
};

const EMPRESAS_COLUMNS = [
  { id: "empresa",          label: "Empresa",            width: "minmax(13.75rem,1.5fr)", hideable: false },
  { id: "localizacao",      label: "Localização",        width: "minmax(5.625rem,.7fr)",   hideable: true },
  { id: "setor",            label: "Setor",              width: "minmax(5.625rem,.7fr)",   hideable: true },
  { id: "tipo",             label: "Tipo",               width: "6.875rem",               hideable: false },
  { id: "negociacoes",      label: "Negociações",        width: "9.6875rem",               hideable: true },
  { id: "valor_convertido", label: "Convertido",         width: "7.5rem",               hideable: true },
  { id: "potencial",        label: "Potencial",          width: "8.75rem",               hideable: true },
  { id: "agencia",          label: "Agência",            width: "minmax(5.625rem,.7fr)",   hideable: true },
  { id: "proximo_followup", label: "Próx. follow-up",   width: "8.125rem",               hideable: true },
  { id: "ultimo_contato",   label: "Últ. contato",      width: "7.1875rem",               hideable: true },
  { id: "contatos",         label: "Contatos",           width: "6.25rem",               hideable: true },
  { id: "inscricoes",       label: "Inscrições",         width: "6.875rem",               hideable: true },
  { id: "projetos",         label: "Projetos",           width: "6.25rem",               hideable: true },
  { id: "cidades_interesse",label: "Cidades",            width: "minmax(9.375rem,1fr)",   hideable: true },
  { id: "responsavel",      label: "Responsável",        width: "8.75rem",               hideable: true },
  { id: "adicionado_em",    label: "Adicionado em",      width: "7.8125rem",               hideable: true },
  { id: "atualizado_em",    label: "Atualizado em",      width: "7.8125rem",               hideable: true },
  { id: "acoes",            label: "Ações",              width: "5rem",                hideable: false },
] as const satisfies readonly ColumnDefinition[];

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const parts = d.split("T")[0].split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** A mesma escala do RelationshipScoreGauge, que mostra este dado no detalhe da empresa. */
const GAUGE_SEGMENTS = GAUGE_SEGMENTS_DO_DETALHE;
function gaugePoint(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: 80 + radius * Math.cos(rad), y: 68 - radius * Math.sin(rad) };
}
function gaugeArc(from: number, to: number) {
  const s = gaugePoint(from, 48), e = gaugePoint(to, 48);
  return `M ${s.x} ${s.y} A 48 48 0 0 1 ${e.x} ${e.y}`;
}

function PotencialGauge({ score }: { score: number | null }) {
  const value = Math.max(0, Math.min(100, score ?? 50));
  const angle = 180 - value * 1.76 - 2;
  const tip = gaugePoint(angle, 29);
  const rad = (angle * Math.PI) / 180;
  const base = gaugePoint(angle, 6);
  const px = -Math.sin(rad) * 5, py = -Math.cos(rad) * 5;
  const nL = { x: base.x + px, y: base.y + py };
  const nR = { x: base.x - px, y: base.y - py };
  const label = value < 20 ? "Improvável" : value < 40 ? "Pouco provável" : value < 60 ? "Possível" : value < 80 ? "Provável" : "Alta chance";
  return (
    <svg viewBox="0 0 160 78" width={80} height={38} style={{ display: "block" }} role="img" aria-label={`Potencial: ${label}`}>
      <title>{label} ({value}/100)</title>
      {GAUGE_SEGMENTS.map((seg, i) => (
        <path key={i} d={gaugeArc(seg.from, seg.to)} fill="none"
          stroke={value >= i * 20 ? seg.color : "rgba(13,13,13,.075)"} strokeWidth="17" />
      ))}
      <path d={`M ${nL.x} ${nL.y} L ${tip.x} ${tip.y} L ${nR.x} ${nR.y} Z`}
        fill="white" stroke="#282525" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="80" cy="68" r="7" fill="white" stroke="#282525" strokeWidth="2.25" />
      <circle cx="80" cy="68" r="2.25" fill="#282525" />
    </svg>
  );
}

function CompanyMatrixView({ empresas, onOpen }: { empresas: EmpresaViewRow[]; onOpen: (id: string) => void }) {
  const positiveValues = empresas.map(item => item.activePipelineValue).filter(value => value > 0).sort((a, b) => a - b);
  const median = positiveValues.length ? positiveValues[Math.floor(positiveValues.length / 2)] : 0;
  const quadrants = [
    { key: "high-high", title: "Priorizar",          subtitle: "Relação forte, oportunidade alta",         highRelation: true,  highValue: true },
    { key: "low-high",  title: "Desenvolver relação", subtitle: "Relação em construção, oportunidade alta", highRelation: false, highValue: true },
    { key: "high-low",  title: "Cultivar",            subtitle: "Relação forte, oportunidade menor",        highRelation: true,  highValue: false },
    { key: "low-low",   title: "Monitorar",           subtitle: "Relação e oportunidade menores",           highRelation: false, highValue: false },
  ];

  return (
    <div className="relative rounded border border-black/[.08] bg-white p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-[0.625rem] text-black/35"><UsersRound size={12}/><span>Força do relacionamento</span></div>
        <div className="flex items-center gap-2 text-[0.625rem] text-black/35"><TrendingUp size={12}/><span>Valor das negociações ativas</span></div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {quadrants.map(quadrant => {
          const items = empresas.filter(item => {
            const relationHigh = Number(item.potencial_relacionamento ?? 50) >= 60;
            const valueHigh = median > 0 && item.activePipelineValue >= median;
            return relationHigh === quadrant.highRelation && valueHigh === quadrant.highValue;
          });
          const total = items.reduce((sum, item) => sum + item.activePipelineValue, 0);
          return (
            <section key={quadrant.key} className="min-h-[15rem] rounded border border-black/[.07] bg-[#F8F8F6] p-3.5">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div><h2 className="text-[0.75rem] font-semibold text-black/75">{quadrant.title}</h2><p className="mt-0.5 text-[0.625rem] text-black/30">{quadrant.subtitle}</p></div>
                <div className="text-right"><p className="text-[0.625rem] font-semibold tabular-nums text-black/45">{items.length} {items.length === 1 ? "empresa" : "empresas"}</p>{total > 0 && <p className="mt-0.5 text-[0.5625rem] tabular-nums text-black/30" title={formatarValorCompleto(total)}>{formatarValorCurto(total)}</p>}</div>
              </header>
              {items.length === 0 ? (
                <div className="flex min-h-[10rem] items-center justify-center rounded border border-dashed border-black/10 text-[0.6875rem] text-black/25">Nenhuma empresa neste quadrante</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                  {items.map(item => (
                    <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 items-center gap-2.5 rounded border border-black/[.07] bg-white p-2.5 text-left transition hover:border-black/20 hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <CompanyLogo nome={item.nome} domain={item.domain_key} site={item.site} size={item.activeNegotiations > 2 ? 36 : 30} className="shrink-0 border border-black/[.06]"/>
                      <div className="min-w-0"><p className="truncate text-[0.6875rem] font-semibold text-black/75">{item.nome}</p><p className="mt-0.5 text-[0.59375rem] text-black/30">{item.activeNegotiations} {item.activeNegotiations === 1 ? "negociação" : "negociações"}{item.activePipelineValue > 0 && <>, <span title={formatarValorCompleto(item.activePipelineValue)}>{formatarValorCurto(item.activePipelineValue)}</span></>}</p>{item.potencial_relacionamento == null && <p className="mt-0.5 flex items-center gap-1 text-[0.5625rem] text-black/40"><CircleHelp size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />Relação não avaliada</p>}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function EmpresasCrmPage() {
  const router = useRouter();
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const organizationId = useOrganizationId();
  const responsavel = useFiltroResponsavel(organizationId);

  const [empresas, setEmpresas] = useState<EmpresaViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("todos");
  const [showNovoProspect, setShowNovoProspect] = useState(false);
  const [showNovoCliente, setShowNovoCliente] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:empresas:view", VIEW_MODES, "lista");

  function handleDelete(id: string, nome: string) {
    confirmDelete({
      title: `Excluir a empresa “${nome}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "empresas_crm", id, { vinculado: "Esta empresa ainda tem negociações, contatos ou contratos vinculados. Remova esses vínculos antes de excluí-la." });
        setEmpresas(prev => prev.filter(e => e.id !== id));
      },
    });
  }

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [
        { data, error },
        { data: captacoes },
        { data: atribuicoes },
        { data: inscricoes },
        { data: contatos },
        { data: followups },
        { data: interacoes },
      ] = await Promise.all([
        supabase.from("empresas_crm").select("*").order("created_at", { ascending: false }),
        supabase.from("captacoes").select("empresa_crm_id, status, valor_solicitado, projeto_id, captador_id, supervisor_id"),
        (supabase as any).from("atribuicoes").select("empresa_crm_id, tipo, captadores!captador_user_id(nome)").eq("status", "ativa"),
        supabase.from("editais_user").select("empresa_crm_id, valor").not("empresa_crm_id", "is", null),
        supabase.from("contatos").select("empresa_crm_id").not("empresa_crm_id", "is", null),
        (supabase as any).from("crm_followups").select("empresa_crm_id, previsto_para").eq("status", "pendente").not("empresa_crm_id", "is", null).order("previsto_para"),
        (supabase as any).from("crm_interacoes").select("empresa_crm_id, ocorreu_em").not("empresa_crm_id", "is", null).order("ocorreu_em", { ascending: false }),
      ]);

      const members = organizationId ? await fetchOrganizationMembers(organizationId) : [];
      const memberMap = new Map(members.map(m => [m.user_id, m.full_name ?? m.email ?? null]));

      if (!error && data) {
        const terminalStatuses = new Set(["aprovado", "recusado", "perdido", "cancelado", "encerrado"]);
        const convertedStatuses = new Set(["aprovado", "ganha"]);
        const metrics = new Map<string, { value: number; count: number }>();
        const convertedMap = new Map<string, number>();
        const projectsMap = new Map<string, Set<string>>();
        const donosMap = new Map<string, Set<string>>();
        for (const captacao of (captacoes ?? []) as unknown as CaptacaoMetricRow[]) {
          if (!captacao.empresa_crm_id) continue;
          const donos = donosMap.get(captacao.empresa_crm_id) ?? new Set<string>();
          for (const dono of [captacao.captador_id, captacao.supervisor_id]) if (dono) donos.add(dono);
          donosMap.set(captacao.empresa_crm_id, donos);
          if (!terminalStatuses.has(captacao.status)) {
            const current = metrics.get(captacao.empresa_crm_id) ?? { value: 0, count: 0 };
            current.value += Number(captacao.valor_solicitado ?? 0);
            current.count += 1;
            metrics.set(captacao.empresa_crm_id, current);
          }
          if (convertedStatuses.has(captacao.status)) {
            convertedMap.set(captacao.empresa_crm_id, (convertedMap.get(captacao.empresa_crm_id) ?? 0) + Number(captacao.valor_solicitado ?? 0));
          }
          if (captacao.projeto_id) {
            const set = projectsMap.get(captacao.empresa_crm_id) ?? new Set<string>();
            set.add(captacao.projeto_id);
            projectsMap.set(captacao.empresa_crm_id, set);
          }
        }

        const followupMap = new Map<string, string>();
        for (const f of (followups ?? []) as Array<{ empresa_crm_id: string | null; previsto_para: string }>) {
          if (!f.empresa_crm_id || followupMap.has(f.empresa_crm_id)) continue;
          followupMap.set(f.empresa_crm_id, f.previsto_para);
        }

        const interacaoMap = new Map<string, string>();
        for (const i of (interacoes ?? []) as Array<{ empresa_crm_id: string | null; ocorreu_em: string }>) {
          if (!i.empresa_crm_id || interacaoMap.has(i.empresa_crm_id)) continue;
          interacaoMap.set(i.empresa_crm_id, i.ocorreu_em);
        }

        const atribuicaoMap = new Map<string, { captadorNome: string; tipo: string }>();
        for (const a of (atribuicoes ?? []) as any[]) {
          if (!a.empresa_crm_id || atribuicaoMap.has(a.empresa_crm_id)) continue;
          atribuicaoMap.set(a.empresa_crm_id, { captadorNome: a.captadores?.nome ?? "—", tipo: a.tipo });
        }

        const contatosMap = new Map<string, number>();
        for (const c of (contatos ?? []) as Array<{ empresa_crm_id: string | null }>) {
          if (!c.empresa_crm_id) continue;
          contatosMap.set(c.empresa_crm_id, (contatosMap.get(c.empresa_crm_id) ?? 0) + 1);
        }

        const inscricoesMap = new Map<string, { count: number; value: number }>();
        for (const item of (inscricoes ?? []) as Array<{ empresa_crm_id: string | null; valor: number | null }>) {
          if (!item.empresa_crm_id) continue;
          const cur = inscricoesMap.get(item.empresa_crm_id) ?? { count: 0, value: 0 };
          inscricoesMap.set(item.empresa_crm_id, { count: cur.count + 1, value: cur.value + Number(item.valor ?? 0) });
        }

        const nowMs = Date.now();
        setEmpresas((data as EmpresaCrm[]).map(item => {
          const lastInteracao = interacaoMap.get(item.id) ?? null;
          let ultimoContatoDias: number | null = null;
          if (lastInteracao) {
            const diff = nowMs - new Date(lastInteracao).getTime();
            ultimoContatoDias = Math.floor(diff / 86_400_000);
          }
          return {
            ...item,
            activePipelineValue: metrics.get(item.id)?.value ?? 0,
            activeNegotiations: metrics.get(item.id)?.count ?? 0,
            convertedValue: convertedMap.get(item.id) ?? 0,
            projectsCount: projectsMap.get(item.id)?.size ?? 0,
            contatosCount: contatosMap.get(item.id) ?? 0,
            inscricoesCount: inscricoesMap.get(item.id)?.count ?? 0,
            inscricoesValue: inscricoesMap.get(item.id)?.value ?? 0,
            proximoFollowup: followupMap.get(item.id) ?? null,
            ultimoContatoDias,
            responsavelNome: item.responsavel_interno_id ? (memberMap.get(item.responsavel_interno_id) ?? null) : null,
            donos: [...(donosMap.get(item.id) ?? []), ...(item.responsavel_interno_id ? [item.responsavel_interno_id] : [])],
            atribuicao: atribuicaoMap.get(item.id) ?? null,
          };
        }));
      }
      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, refreshKey]);

  const filtered = empresas.filter((e) => {
    if (tipoFilter !== "todos" && e.tipo !== tipoFilter) return false;
    if (!responsavel.casa(e.donos)) return false;
    if (!dSearch.trim()) return true;
    const s = dSearch.toLowerCase();
    return (
      e.nome.toLowerCase().includes(s) ||
      (e.setor ?? "").toLowerCase().includes(s) ||
      (e.localizacao ?? "").toLowerCase().includes(s)
    );
  });

  const COL_COUNT = EMPRESAS_COLUMNS.length;

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader secao="empresas"
        eyebrow="Inteligência de contas"
        title="Empresas"
        summary={!loading && <ListSummary strong={filtered.length}>{filtered.length === 1 ? "empresa" : "empresas"}</ListSummary>}
        actions={
          <div className="flex items-center gap-2">
            <EntityViewSwitcher value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS}/>
            {tipoFilter === "cliente_ativo"
              ? <PrimaryListAction onClick={() => setShowNovoCliente(true)}><Plus size={13} aria-hidden="true" /> Novo cliente</PrimaryListAction>
              : <PrimaryListAction onClick={() => setShowNovoProspect(true)}><Plus size={13} aria-hidden="true" /> Novo prospect</PrimaryListAction>}
          </div>
        }
      />

      <ListToolbar search={<ListSearch value={search} onChange={setSearch} placeholder="Buscar empresa, setor ou localização"/>}>
        <SegmentedControl
          value={tipoFilter}
          onChange={setTipoFilter}
          ariaLabel="Filtrar empresas por tipo"
          options={[
            { value: "todos",         label: "Todos" },
            { value: "prospect",      label: "Prospects" },
            { value: "cliente_ativo", label: "Clientes" },
            { value: "ex_cliente",    label: "Ex-Clientes" },
          ] as const}
        />
        <FiltroResponsavel membros={responsavel.membros} meuId={responsavel.meuId} value={responsavel.filtro} onChange={responsavel.setFiltro} />
      </ListToolbar>

      <ListContent className="md:pr-0">{viewMode === "matriz" ? (
        <CompanyMatrixView empresas={filtered} onOpen={id => router.push(`/empresas-crm/${id}`)}/>
      ) : (
        <ListTableSurface className="rounded-r-none border-r-0">
          <ManagedTable storageKey="empresas-crm-v6" definitions={EMPRESAS_COLUMNS} className="w-full">
            <thead>
              <tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Empresa</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Localização</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Setor</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Tipo</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Negociações</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Convertido</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Potencial</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Agência</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Próx. follow-up</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Últ. contato</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Contatos</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Inscrições</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Projetos</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Cidades</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Responsável</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Adicionado em</th>
                <th className="text-left px-5 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Atualizado em</th>
                <th className="text-left px-4 py-3 text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em]">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    {Array.from({ length: COL_COUNT }).map((__, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-4 w-20 bg-black/8 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT}>
                    {empresas.length === 0
                      ? <ListEmptyState icon={Building2} title="Nenhuma empresa cadastrada" description="Adicione empresas que você está prospectando ou explore a base de patrocinadores." action={<PrimaryListAction onClick={() => setShowNovoProspect(true)}><Plus size={13} aria-hidden="true" /> Novo prospect</PrimaryListAction>} />
                      : <ListEmptyState icon={Search} title="Nenhuma empresa corresponde aos filtros" filtered onClearFilters={() => { setSearch(""); setTipoFilter("todos"); responsavel.setFiltro("todos"); }} />}
                  </td>
                </tr>
              ) : (
                filtered.map((e, i) => (
                  <tr
                    key={e.id}
                    onClick={() => router.push(`/empresas-crm/${e.id}`)}
                    className="hover:bg-black/[0.02] transition group cursor-pointer"
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                  >
                    {/* Empresa */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo nome={e.nome} domain={e.domain_key} size={28} className="flex-shrink-0" />
                        <span className="text-[0.8125rem] font-semibold text-[#282525] min-w-0 break-words block">
                          {e.nome}
                        </span>
                      </div>
                    </td>

                    {/* Localização */}
                    <td className="px-5 py-3.5 text-black/50 text-[0.78125rem]">
                      {e.localizacao || "—"}
                    </td>

                    {/* Setor */}
                    <td className="px-5 py-3.5 text-black/50 text-[0.78125rem]">
                      {e.setor || "—"}
                    </td>

                    {/* Tipo */}
                    <td className="px-5 py-3.5">
                      {e.tipo && TIPO_ETIQUETA[e.tipo] ? (
                        <span
                          className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium"
                          style={{
                            borderColor: TIPO_ETIQUETA[e.tipo].color + "47",
                            color: TIPO_ETIQUETA[e.tipo].color,
                          }}
                        >
                          {TIPO_ETIQUETA[e.tipo].label}
                        </span>
                      ) : (
                        <span className="text-black/20 text-[0.75rem]">—</span>
                      )}
                    </td>

                    {/* Negociações */}
                    <td className="px-5 py-3.5">
                      {e.activeNegotiations > 0 ? (
                        <div>
                          <span className="text-[0.8125rem] font-semibold tabular-nums text-black/70">{e.activeNegotiations}</span>
                          <span className="text-[0.6875rem] text-black/35"> {e.activeNegotiations === 1 ? "negociação" : "negociações"}</span>
                          {e.activePipelineValue > 0 && (
                            <p className="mt-0.5 text-[0.6875rem] text-black/40 tabular-nums" title={formatarValorCompleto(e.activePipelineValue)}>{formatarValorCurto(e.activePipelineValue)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Convertido */}
                    <td className="px-5 py-3.5">
                      <span className={`text-[0.75rem] font-semibold tabular-nums ${e.convertedValue > 0 ? "text-[#282525]" : "text-black/30"}`} title={e.convertedValue > 0 ? formatarValorCompleto(e.convertedValue) : undefined}>
                        {formatarValorCurto(e.convertedValue)}
                      </span>
                    </td>

                    {/* Potencial */}
                    <td className="px-5 py-3.5">
                      <PotencialGauge score={e.tipo === "cliente_ativo" ? 100 : e.potencial_relacionamento} />
                    </td>

                    {/* Agência / Atribuição */}
                    <td className="px-5 py-3.5">
                      {e.atribuicao ? (() => {
                        const exc = EXCLUSAO_CONFIG[e.atribuicao.tipo] ?? { label: e.atribuicao.tipo, bg: "rgba(13,13,13,.35)", icon: Shield };
                        const ExcIcon = exc.icon;
                        return (
                          <div className="min-w-0">
                            <p className="text-[0.75rem] font-medium text-black/70 min-w-0 break-words">{e.atribuicao.captadorNome}</p>
                            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 text-[0.625rem] font-semibold text-white" style={{ background: exc.bg }}>
                              <ExcIcon size={10} />{exc.label}
                            </span>
                          </div>
                        );
                      })() : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Próximo follow-up */}
                    <td className="px-5 py-3.5">
                      {e.proximoFollowup ? (() => {
                        const d = new Date(e.proximoFollowup);
                        const isOverdue = d < new Date();
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {isOverdue && (
                              <span role="img" className="shrink-0" title="Follow-up atrasado" aria-label="Follow-up atrasado">
                                <CalendarClock size={12} strokeWidth={1.75} aria-hidden="true" className="text-[#D94A4A]" />
                              </span>
                            )}
                            <span className={`text-[0.75rem] tabular-nums ${isOverdue ? "font-medium text-[#282525]" : "text-black/50"}`}>
                              {fmtDate(e.proximoFollowup)}
                            </span>
                          </span>
                        );
                      })() : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Último contato */}
                    <td className="px-5 py-3.5">
                      {e.ultimoContatoDias !== null ? (() => {
                        const d = e.ultimoContatoDias!;
                        const alerta = d > 30 ? "#D94A4A" : d > 14 ? "#B07A14" : undefined;
                        const label = d === 0 ? "Hoje" : d === 1 ? "1 dia" : `${d} dias`;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            {alerta && <CalendarClock size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: alerta }} />}
                            <span className="text-[0.75rem] font-medium tabular-nums text-black/60">{label}</span>
                          </span>
                        );
                      })() : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Contatos */}
                    <td className="px-5 py-3.5">
                      {e.contatosCount > 0 ? (
                        <div>
                          <span className="text-[0.8125rem] font-semibold tabular-nums text-black/70">{e.contatosCount}</span>
                          <span className="text-[0.6875rem] text-black/35"> {e.contatosCount === 1 ? "contato" : "contatos"}</span>
                        </div>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Inscrições */}
                    <td className="px-5 py-3.5">
                      {e.inscricoesCount > 0 ? (
                        <div>
                          <span className="text-[0.8125rem] font-semibold tabular-nums text-black/70">{e.inscricoesCount}</span>
                          <span className="text-[0.6875rem] text-black/35"> {e.inscricoesCount === 1 ? "edital" : "editais"}</span>
                          {e.inscricoesValue > 0 && (
                            <p className="mt-0.5 text-[0.6875rem] text-black/40 tabular-nums" title={formatarValorCompleto(e.inscricoesValue)}>{formatarValorCurto(e.inscricoesValue)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Projetos */}
                    <td className="px-5 py-3.5">
                      {e.projectsCount > 0 ? (
                        <div>
                          <span className="text-[0.8125rem] font-semibold tabular-nums text-black/70">{e.projectsCount}</span>
                          <span className="text-[0.6875rem] text-black/35"> {e.projectsCount === 1 ? "projeto" : "projetos"}</span>
                        </div>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Cidades de interesse */}
                    <td className="px-5 py-3.5">
                      {(e.cidades_interesse ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(e.cidades_interesse ?? []).slice(0, 3).map(c => (
                            <span key={c} className="rounded border border-black/10 bg-black/[.035] px-1.5 py-0.5 text-[0.625rem] text-black/50">{c}</span>
                          ))}
                          {(e.cidades_interesse ?? []).length > 3 && (
                            <span className="rounded border border-black/10 bg-black/[.035] px-1.5 py-0.5 text-[0.625rem] text-black/35">+{(e.cidades_interesse ?? []).length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Responsável */}
                    <td className="px-5 py-3.5">
                      {e.responsavelNome ? (
                        <span className="text-[0.75rem] text-black/55 min-w-0 break-words block">
                          {e.responsavelNome.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-black/20 text-xs">—</span>
                      )}
                    </td>

                    {/* Adicionado em */}
                    <td className="px-5 py-3.5 text-[0.75rem] text-black/40 tabular-nums">
                      {fmtDate(e.created_at)}
                    </td>

                    {/* Atualizado em */}
                    <td className="px-5 py-3.5 text-[0.75rem] text-black/40 tabular-nums">
                      {fmtDate(e.updated_at)}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
                        <button
                          onClick={ev => { ev.stopPropagation(); handleDelete(e.id, e.nome); }}
                          className="p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition"
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
      )}</ListContent>

      {showNovoProspect && (
        <NovoProspectModal
          onClose={() => setShowNovoProspect(false)}
          onSaved={() => { setShowNovoProspect(false); setRefreshKey(k => k + 1); }}
        />
      )}
      {showNovoCliente && (
        <NovoClienteModal
          onClose={() => setShowNovoCliente(false)}
          onSaved={() => { setShowNovoCliente(false); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}
