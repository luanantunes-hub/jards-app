"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  Globe,
  HeartPulse,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DetailNotFound } from "@/components/ui/DetailPagePrimitives";
import { CompanyLogo } from "@/components/CompanyLogo";
import {
  PartnershipWorkspace,
  type PartnershipAction,
} from "@/components/customer-success/PartnershipWorkspace";
import { DeliveriesPanel } from "@/components/customer-success/DeliveriesPanel";
import { ClientContractsView, type ClientAgencyParticipation, type ClientContract } from "@/components/customer-success/ClientContractsView";
import { RelationshipWorkspace } from "@/components/relationship/RelationshipWorkspace";
import { RelationshipScoreGauge } from "@/components/ui/RelationshipScoreGauge";
import { NegotiationsTable, type CaptacaoRow } from "@/components/company/NegotiationsTable";
import { InscricoesTable, type EditalRow } from "@/components/company/InscricoesTable";
import { FilterButton } from "@/components/ui/FilterControls";
import type { SaudeConta } from "@/lib/supabase/types";

const HEALTH_WEIGHT: Record<SaudeConta["estado"], number> = {
  saudavel: 90,
  atencao: 58,
  risco: 24,
  sem_dados: 40,
};

function money(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

type AccountDetail = {
  id: string;
  account_id: string;
  organization_id: string | null;
  nome: string | null;
  status: string;
  data_abertura: string;
  data_encerramento: string | null;
  motivo_encerramento: string | null;
  valor_total: number;
  notas: string | null;
  empresa_crm_id: string;
  created_at: string;
  empresa_crm: { nome: string; setor: string | null; tipo: string; domain_key: string | null; site: string | null } | null;
};
type ContactRow = { id: string; nome: string; cargo: string | null };
type ProjectRow = { id: string; nome: string };
type NegotiationHistoryRow = CaptacaoRow & { ciclo_ano: number | null; ciclo_anterior_id: string | null };
type PageTab = "overview" | "execution" | "contracts" | "renewal" | "relationship";
type RelationshipSection = "relationship" | "registrations" | "negotiations";
type ActionRequest = { kind: PartnershipAction; nonce: number };
type HealthScorecardRow = { peso: number; ativo: boolean; criterios: Array<{ peso: number; nota: number | null; ativo: boolean }> };
type HealthScoreSummary = { score: number | null; evaluated: number; total: number };

function scoreFromCards(cards: HealthScorecardRow[]) {
  const activeCards = cards.filter(card => card.ativo);
  const dimensions = activeCards.map(card => {
    const criteria = (card.criterios ?? []).filter(item => item.ativo && item.nota !== null);
    const criterionWeight = criteria.reduce((sum, item) => sum + item.peso, 0);
    const score = criterionWeight ? criteria.reduce((sum, item) => sum + (item.nota ?? 0) * item.peso, 0) / criterionWeight : null;
    return { score, weight: card.peso };
  }).filter(item => item.score !== null);
  const totalWeight = dimensions.reduce((sum, item) => sum + item.weight, 0);
  return {
    score: totalWeight ? Math.round(dimensions.reduce((sum, item) => sum + (item.score ?? 0) * item.weight, 0) / totalWeight / 5 * 100) : null,
    evaluated: dimensions.length,
    total: activeCards.length,
  };
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [agencyParticipations, setAgencyParticipations] = useState<ClientAgencyParticipation[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationHistoryRow[]>([]);
  const [registrations, setRegistrations] = useState<EditalRow[]>([]);
  const [health, setHealth] = useState<SaudeConta[]>([]);
  const [scorecardHealth, setScorecardHealth] = useState<HealthScoreSummary>({ score: null, evaluated: 0, total: 0 });
  const [pageTab, setPageTab] = useState<PageTab>("overview");
  const [relationshipSection, setRelationshipSection] = useState<RelationshipSection>("relationship");
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [contractActionNonce, setContractActionNonce] = useState(0);
  const [deliveryActionNonce, setDeliveryActionNonce] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleHealthScoreChange = useCallback((score: number | null, evaluated: number, total: number) => {
    setScorecardHealth(previous => previous.score === score && previous.evaluated === evaluated && previous.total === total ? previous : { score, evaluated, total });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const accountResult = await (supabase as any).from("contas_patrocinio").select("*,empresa_crm:empresas_crm!empresa_crm_id(nome,setor,tipo,domain_key,site)").eq("id", id).single();
    if (accountResult.error || !accountResult.data) {
      setAccount(null);
      setLoading(false);
      return;
    }
    const accountData = accountResult.data as AccountDetail;
    setAccount(accountData);

    const [contractsResult, agencyResult, contactsResult, projectsResult, negotiationsResult, registrationsResult, healthResult, scorecardsResult] = await Promise.all([
      supabase.from("contratos").select("id,numero,titulo,valor,status,data_inicio,data_fim,proxima_renovacao").eq("conta_patrocinio_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("participacoes_agencia_cliente").select("id,contrato_id,captador_id,papel,status,captador:captadores!captador_id(id,nome,logo_url)").eq("conta_patrocinio_id", id).order("created_at"),
      supabase.from("contatos").select("id,nome,cargo").eq("empresa_crm_id", accountData.empresa_crm_id).eq("ativo_na_empresa", true).order("nome"),
      (supabase as any).from("captacoes").select("projeto:projetos_crm!projeto_id(id,nome)").eq("empresa_crm_id", accountData.empresa_crm_id).not("projeto_id", "is", null),
      (supabase as any).from("captacoes").select("id,titulo,status,valor_solicitado,potencial_fechamento,proxima_prospeccao,data_previsao,created_at,updated_at,ciclo_ano,ciclo_anterior_id,projeto:projetos_crm!projeto_id(id,nome,created_at)").eq("empresa_crm_id", accountData.empresa_crm_id).order("updated_at", { ascending: false }),
      (supabase as any).from("editais_user").select("id,status,created_at,valor,data_fechamento,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)").eq("empresa_crm_id", accountData.empresa_crm_id).order("updated_at", { ascending: false }),
      (supabase as any).from("saude_conta").select("*").eq("conta_patrocinio_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("saude_parceria_scorecards").select("peso,ativo,criterios:saude_parceria_criterios(peso,nota,ativo)").eq("conta_patrocinio_id", id).eq("ativo", true),
    ]);
    setContracts((contractsResult.data ?? []) as ClientContract[]);
    setAgencyParticipations((agencyResult.data ?? []) as ClientAgencyParticipation[]);
    setContacts(((contactsResult.data ?? []) as ContactRow[]).filter(item => Boolean(item.nome)));
    const projectMap = new Map<string, ProjectRow>();
    for (const row of (projectsResult.data ?? []) as Array<{ projeto: ProjectRow | null }>) if (row.projeto?.id) projectMap.set(row.projeto.id, row.projeto);
    for (const row of (registrationsResult.data ?? []) as EditalRow[]) if (row.projeto?.id) projectMap.set(row.projeto.id, row.projeto);
    setProjects([...projectMap.values()]);
    setNegotiations((negotiationsResult.data ?? []) as NegotiationHistoryRow[]);
    setRegistrations((registrationsResult.data ?? []) as EditalRow[]);
    setHealth(latestHealth((healthResult.data ?? []) as SaudeConta[]));
    setScorecardHealth(scoreFromCards((scorecardsResult.data ?? []) as HealthScorecardRow[]));
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "relationship") setPageTab("relationship");
  }, []);

  function requestPartnershipAction(tab: PageTab, kind: PartnershipAction) {
    setPageTab(tab);
    if (kind === "commitment") setDeliveryActionNonce(value => value + 1);
    else setActionRequest({ kind, nonce: Date.now() });
  }

  if (loading) return <ClientSkeleton/>;
  if (!account) return <DetailNotFound title="Cliente não encontrado" backHref="/contas-patrocinio" backLabel="Clientes" />;

  const healthScore = scorecardHealth.score ?? calculateHealth(health);
  const displayName = account.nome || account.empresa_crm?.nome || "Cliente";
  const companyName = account.empresa_crm?.nome ?? "";
  const repeatedCompanyName = displayName.trim().toLocaleLowerCase("pt-BR") === companyName.trim().toLocaleLowerCase("pt-BR");
  const coverageRatio = scorecardHealth.total ? scorecardHealth.evaluated / scorecardHealth.total : 0;
  const coverageLabel = !scorecardHealth.evaluated ? "Sem leitura" : coverageRatio < .5 ? "Leitura inicial" : coverageRatio < .8 ? "Leitura parcial" : "Leitura completa";
  const nextRenewal = contracts.filter(contract => contract.proxima_renovacao).sort((a, b) => String(a.proxima_renovacao).localeCompare(String(b.proxima_renovacao)))[0]?.proxima_renovacao ?? null;
  const contractedValue = account.valor_total > 0 ? money(account.valor_total) : "Não informado";
  const activeAgencies = [...new Map(agencyParticipations.filter(item => item.status === "ativa" && item.captador).map(item => [item.captador_id, item.captador!])).values()];
  const agencyLabel = !activeAgencies.length ? "Sem agência" : activeAgencies.length === 1 ? activeAgencies[0].nome : `${activeAgencies[0].nome} +${activeAgencies.length - 1}`;

  return <div className="min-h-full">
    <header>
      <div className="mx-auto max-w-pagina px-4 pb-5 pt-6 sm:px-6 lg:px-10 lg:pt-8">
      <Link href="/contas-patrocinio" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-black/35 transition hover:text-black"><ArrowLeft size={13}/>Clientes</Link>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CompanyLogo nome={account.empresa_crm?.nome ?? account.nome ?? "Cliente"} domain={account.empresa_crm?.domain_key} site={account.empresa_crm?.site} size={48} className="rounded"/>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5"><h1 className="truncate text-[1.5rem] font-semibold tracking-[-.03em] text-[#0D0D0D]">{displayName}</h1></div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.75rem] text-black/40">{!repeatedCompanyName && companyName && <Link href={`/empresas-crm/${account.empresa_crm_id}`} className="inline-flex items-center gap-1 text-black/55 transition hover:text-[#7259B5]">{companyName}<ArrowUpRight size={10}/></Link>}{account.empresa_crm?.setor && <span>{!repeatedCompanyName && companyName ? "· " : ""}{account.empresa_crm.setor}</span>}{(account.empresa_crm?.site || account.empresa_crm?.domain_key) && <a href={(() => { const u = account.empresa_crm?.site || account.empresa_crm?.domain_key || ""; return u.startsWith("http") ? u : `https://${u}`; })()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 transition hover:text-[#7259B5]" title={account.empresa_crm?.site || account.empresa_crm?.domain_key || ""}><Globe size={11}/>Website</a>}</div>
          </div>
        </div>
        {contracts.length > 0 && <div className="flex flex-wrap gap-2 lg:justify-end">
          <ClientAction label="Registrar entrega" icon={ClipboardCheck} accent onClick={() => requestPartnershipAction("execution", "commitment")}/><ClientAction label="Novo contrato" icon={FileText} onClick={() => {setPageTab("contracts");setContractActionNonce(value => value + 1);}}/>{nextRenewal && <ClientAction label="Planejar renovação" icon={RefreshCw} onClick={() => requestPartnershipAction("renewal", "renewal")}/>} 
        </div>}
      </div>

      <section className="mt-6 grid gap-px bg-black/[.07] min-[480px]:grid-cols-2 xl:grid-cols-[13.75rem_repeat(4,minmax(0,1fr))]" aria-label="Resumo da parceria">
        <div className="flex min-h-[7rem] items-center justify-center bg-white px-4 py-3"><RelationshipScoreGauge score={healthScore} label="Saúde da parceria" variant="health" compact/></div>
        <SummaryMetric label="Qualidade da leitura" value={coverageLabel} detail={scorecardHealth.total ? `${scorecardHealth.evaluated} de ${scorecardHealth.total} dimensões avaliadas` : "Avalie os scorecards"}/>
        <SummaryMetric label="Valor contratado" value={contractedValue}/>
        <SummaryMetric label="Próxima renovação" value={nextRenewal ? new Date(`${nextRenewal}T12:00:00`).toLocaleDateString("pt-BR") : "Sem previsão"}/>
        <SummaryMetric label="Agência de captação" value={agencyLabel} className="min-[480px]:col-span-2 xl:col-span-1"/>
      </section>
      </div>
    </header>

    <div className="border-y bg-white" style={{borderColor:"rgba(13,13,13,.06)"}}>
      <nav className="mx-auto flex max-w-pagina items-center gap-1.5 overflow-x-auto px-4 py-3 sm:px-6 lg:px-10" aria-label="Seções do cliente">
        {([['overview','Visão geral',HeartPulse,0],['execution','Entregas',ClipboardCheck,0],['contracts','Contratos',FileText,contracts.length],['renewal','Renovação',RefreshCw,0],['relationship','Relacionamento',Users,contacts.length]] as const).map(([value,label,Icon,count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPageTab(value)}
            className={`flex h-11 shrink-0 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium transition active:scale-[.98] ${pageTab===value?'border-[#7259B5]/40 text-[#7259B5]':'border-transparent text-black/40 hover:bg-black/[.04] hover:text-black/60'}`}
          >
            <Icon size={12}/>{label}
            {count > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7259B5]/10 px-1 text-[0.5625rem] font-semibold tabular-nums text-[#7259B5]">{count}</span>}
          </button>
        ))}
      </nav>
    </div>

    <main className="mx-auto w-full max-w-pagina px-4 py-7 sm:px-6 sm:py-9 lg:px-10 lg:py-10">
      {pageTab === "overview" && <PartnershipWorkspace contaId={id} organizationId={account.organization_id!} accountId={account.account_id} contracts={contracts} projects={projects} section="overview" actionRequest={actionRequest} onActionRequestHandled={() => setActionRequest(null)} onDataChanged={() => void fetchData()} onHealthScoreChange={handleHealthScoreChange}/>} 
      {pageTab === "execution" && <DeliveriesPanel organizationId={account.organization_id!} accountId={account.account_id} contaId={id} contracts={contracts} projects={projects} createRequestNonce={deliveryActionNonce}/>} 
      {pageTab === "contracts" && <ClientContractsView contaId={id} organizationId={account.organization_id!} accountId={account.account_id} contracts={contracts} participations={agencyParticipations} actionRequestNonce={contractActionNonce} onSaved={() => void fetchData()}/>} 
      {pageTab === "renewal" && <PartnershipWorkspace contaId={id} organizationId={account.organization_id!} accountId={account.account_id} contracts={contracts} projects={projects} section="renewal" actionRequest={actionRequest} onActionRequestHandled={() => setActionRequest(null)} onDataChanged={() => void fetchData()} onHealthScoreChange={handleHealthScoreChange}/>} 
      {pageTab === "relationship" && <div className="flex items-start gap-6 sm:gap-8">
        <nav className="flex w-28 shrink-0 flex-col gap-0.5" aria-label="Áreas de relacionamento">
          <ClientSubsectionButton active={relationshipSection === "relationship"} onClick={() => setRelationshipSection("relationship")} count={contacts.length}>Relacionamento</ClientSubsectionButton>
          <ClientSubsectionButton active={relationshipSection === "registrations"} onClick={() => setRelationshipSection("registrations")} count={registrations.length}>Inscrições</ClientSubsectionButton>
          <ClientSubsectionButton active={relationshipSection === "negotiations"} onClick={() => setRelationshipSection("negotiations")} count={negotiations.length}>Negociações</ClientSubsectionButton>
        </nav>
        <div className="min-w-0 flex-1">
          {relationshipSection === "relationship" && <RelationshipWorkspace mode="customer_success" organizationId={account.organization_id!} accountId={account.account_id} empresaCrmId={account.empresa_crm_id} contaPatrocinioId={id} contacts={contacts}/>} 
          {relationshipSection === "registrations" && <InscricoesTable rows={registrations}/>} 
          {relationshipSection === "negotiations" && <ClientNegotiationsHistory rows={negotiations}/>} 
        </div>
      </div>} 
    </main>
  </div>;
}

function latestHealth(rows: SaudeConta[]) {
  const dimensions = new Set<string>();
  return rows.filter(row => !dimensions.has(row.dimensao) && dimensions.add(row.dimensao));
}

function calculateHealth(rows: SaudeConta[]) {
  if (!rows.length) return null;
  return Math.round(rows.reduce((total, row) => total + HEALTH_WEIGHT[row.estado], 0) / rows.length);
}

function SummaryMetric({label,value,detail,className=""}:{label:string;value:string;detail?:string;className?:string}) {
  return <div className={`flex min-h-[7rem] flex-col justify-center bg-white px-5 py-4 ${className}`}><p className="text-[0.625rem] font-medium text-black/30">{label}</p><p className="mt-1.5 text-[1rem] font-semibold tracking-[-.02em] text-black/70">{value}</p>{detail && <p className="mt-1 text-[0.625rem] text-black/30">{detail}</p>}</div>;
}

function ClientNegotiationsHistory({ rows }: { rows: NegotiationHistoryRow[] }) {
  const [showHistorico, setShowHistorico] = useState(false);
  const idsComRenovacaoMaisNova = new Set(rows.map(r => r.ciclo_anterior_id).filter(Boolean));
  const visiveis = showHistorico ? rows : rows.filter(r => !idsComRenovacaoMaisNova.has(r.id));
  const totalCiclosAntigos = rows.length - rows.filter(r => !idsComRenovacaoMaisNova.has(r.id)).length;
  return <div className="flex flex-col gap-3">
    {totalCiclosAntigos > 0 && <div className="flex justify-end"><FilterButton active={showHistorico} onClick={() => setShowHistorico(v => !v)}>Histórico{!showHistorico ? ` (${totalCiclosAntigos})` : ""}</FilterButton></div>}
    <NegotiationsTable rows={visiveis} eyebrow="Histórico comercial" hideNegotiationColumn/>
  </div>;
}

function ClientAction({label,icon:Icon,onClick,accent=false}:{label:string;icon:typeof Plus;onClick:()=>void;accent?:boolean}) {
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded border bg-white px-3 py-2 text-xs font-medium transition hover:bg-black/[.04] active:translate-y-px" style={{color:accent?'#7259B5':'rgba(13,13,13,.62)',borderColor:accent?'#7259B540':'rgba(13,13,13,.11)'}}><Icon size={12}/>{label}</button>;
}

function ClientSubsectionButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-1.5 border-l-2 py-1.5 pl-3 text-left text-[0.75rem] font-medium transition ${active ? "border-black/55 text-black/75" : "border-transparent text-black/35 hover:text-black/55"}`}>
    <span className="min-w-0 truncate">{children}</span>
    {count !== undefined && count > 0 && <span className={`text-[0.625rem] font-semibold tabular-nums ${active ? "text-black/50" : "text-black/25"}`}>{count}</span>}
  </button>;
}

function ClientSkeleton() { return <div className="animate-pulse px-4 py-6 md:px-8"><div className="h-4 w-24 rounded bg-black/8"/><div className="mt-6 h-16 w-full max-w-2xl rounded bg-black/8"/><div className="mt-8 h-12 rounded bg-black/8"/><div className="mt-5 h-96 rounded bg-black/8"/></div>; }
