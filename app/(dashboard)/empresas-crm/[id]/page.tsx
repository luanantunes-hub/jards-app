"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  FileStack,
  FolderOpen,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Shield,
  Target,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyTimeline } from "@/components/company/CompanyTimeline";
import { AbrirContaModal } from "@/components/modals/AbrirContaModal";
import { EditarEmpresaModal } from "@/components/modals/EditarEmpresaModal";
import { EditarLocalizacaoModal } from "@/components/modals/EditarLocalizacaoModal";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { NovaAtribuicaoModal } from "@/components/modals/NovaAtribuicaoModal";
import { RelationshipWorkspace } from "@/components/relationship/RelationshipWorkspace";
import { RelationshipScoreGauge } from "@/components/ui/RelationshipScoreGauge";
import { NegotiationsTable, type CaptacaoRow } from "@/components/company/NegotiationsTable";
import { InscricoesTable, type EditalRow } from "@/components/company/InscricoesTable";
import { TagsDoRegistro } from "@/components/ui/Tags";
import { DetailHeaderAction, DetailPageContent, DetailSidebarCard, DetailTabs, DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { usePortalPosition, PortalMenu } from "@/components/ui/ComboboxPortalMenu";
import type { EmpresaCrm } from "@/lib/supabase/types";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

const CLOSED_STATUSES = new Set(["aprovado", "recusado", "ganha", "perdida"]);
const EDITAL_CLOSED_STATUSES = new Set(["aprovado", "reprovado", "cancelado"]);

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

type ContactRow = { id: string; nome: string; cargo: string | null; email: string | null; score: number };
type ProjectRow = { id: string; nome: string; created_at: string };
type ClientLink = { id: string; nome: string | null; status: string };
type AtribuicaoRow = { id: string; tipo: string; captador_user_id: string; captadores: { nome: string } | null };
type PageTab = "overview" | "negotiations" | "inscricoes" | "relationship";

export default function EmpresaCrmDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const [empresa, setEmpresa] = useState<EmpresaCrm | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [negotiations, setNegotiations] = useState<CaptacaoRow[]>([]);
  const [notices, setNotices] = useState<EditalRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clientAccount, setClientAccount] = useState<ClientLink | null>(null);
  const [atribuicao, setAtribuicao] = useState<AtribuicaoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageTab, setPageTab] = useState<PageTab>("overview");
  const [timelineSources, setTimelineSources] = useState(["atividades", "notas", "historico_captações", "inscricoes", "interacoes"]);
  const [showOpenAccount, setShowOpenAccount] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEditLocalizacao, setShowEditLocalizacao] = useState(false);
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showInscricao, setShowInscricao] = useState(false);
  const [pendingFollowups, setPendingFollowups] = useState<{ id: string; titulo: string; previsto_para: string }[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const companyResult = await (supabase as any).from("empresas_crm").select("*").eq("id", id).single();
    if (companyResult.error || !companyResult.data) {
      setEmpresa(null);
      setLoading(false);
      return;
    }
    setEmpresa(companyResult.data as EmpresaCrm);

    const [contactsResult, negotiationsResult, noticesResult, clientResult, atribuicaoResult, followupsResult] = await Promise.all([
      supabase.from("contatos").select("id,nome,cargo,email,score").eq("empresa_crm_id", id).order("score", { ascending: false }).limit(20),
      (supabase as any).from("captacoes").select("id,titulo,status,valor_solicitado,potencial_fechamento,proxima_prospeccao,data_previsao,created_at,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)").eq("empresa_crm_id", id).order("updated_at", { ascending: false }),
      (supabase as any).from("editais_user").select("id,status,created_at,valor,data_fechamento,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)").eq("empresa_crm_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("contas_patrocinio").select("id,nome,status").eq("empresa_crm_id", id).in("status", ["ativa", "pausada"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("atribuicoes").select("id,tipo,captador_user_id,captadores!captador_user_id(nome)").eq("empresa_crm_id", id).eq("status", "ativa").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from("crm_followups").select("id,titulo,previsto_para").eq("empresa_crm_id", id).eq("status", "pendente").order("previsto_para", { ascending: true }),
    ]);

    setContacts(((contactsResult.data ?? []) as ContactRow[]).filter(contact => Boolean(contact.nome)));
    const negotiationRows = (negotiationsResult.data ?? []) as CaptacaoRow[];
    setNegotiations(negotiationRows);
    setNotices((noticesResult.data ?? []) as EditalRow[]);
    setClientAccount((clientResult.data as ClientLink | null) ?? null);
    setAtribuicao((atribuicaoResult.data as AtribuicaoRow | null) ?? null);
    setPendingFollowups((followupsResult.data as { id: string; titulo: string; previsto_para: string }[] | null) ?? []);

    const projectMap = new Map<string, ProjectRow>();
    negotiationRows.forEach(row => { if (row.projeto?.id) projectMap.set(row.projeto.id, row.projeto); });
    (noticesResult.data as EditalRow[] | null ?? []).forEach(row => { if (row.projeto?.id) projectMap.set(row.projeto.id, row.projeto); });
    setProjects([...projectMap.values()]);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "relationship") setPageTab("relationship");
  }, []);

  if (loading) return <DetailPageSkeleton />;
  if (!empresa) return <DetailNotFound title="Empresa não encontrada" description="Ela pode ter sido removida ou você não tem acesso a ela." backHref="/empresas-crm" backLabel="Empresas" />;

  const openNegotiations = negotiations.filter(item => !CLOSED_STATUSES.has(item.status));
  const openNotices = notices.filter(item => !EDITAL_CLOSED_STATUSES.has(item.status));
  const pipelineValue = openNegotiations.reduce((total, item) => total + (item.valor_solicitado ?? 0), 0)
    + openNotices.reduce((total, item) => total + (item.valor ?? 0), 0);
  const nextFollowup = [...openNegotiations].filter(item => item.proxima_prospeccao).sort((a, b) => String(a.proxima_prospeccao).localeCompare(String(b.proxima_prospeccao)))[0] ?? null;
  const nextNoticeDeadline = [...openNotices].filter(item => item.data_fechamento).sort((a, b) => String(a.data_fechamento).localeCompare(String(b.data_fechamento)))[0] ?? null;
  const nextPendingFollowup = pendingFollowups[0] ?? null;
  const nextContactDate = [nextFollowup?.proxima_prospeccao, nextNoticeDeadline?.data_fechamento, nextPendingFollowup?.previsto_para].filter((d): d is string => Boolean(d)).sort()[0] ?? null;
  const staleCount = openNegotiations.filter(item => daysSince(item.updated_at) >= 14).length
    + openNotices.filter(item => daysSince(item.updated_at) >= 14).length;
  const nextOpening = [...openNotices].sort((a, b) => String(a.data_fechamento ?? a.created_at).localeCompare(String(b.data_fechamento ?? b.created_at)))[0] ?? null;
  const nextStep = (() => {
    const candidates: { kind: "negociacao" | "followup"; id: string; titulo: string; data: string; projetoNome?: string | null }[] = [];
    if (nextFollowup) candidates.push({ kind: "negociacao", id: nextFollowup.id, titulo: nextFollowup.titulo || "Retomar a negociação", data: nextFollowup.proxima_prospeccao!, projetoNome: nextFollowup.projeto?.nome });
    if (nextPendingFollowup) candidates.push({ kind: "followup", id: nextPendingFollowup.id, titulo: nextPendingFollowup.titulo, data: nextPendingFollowup.previsto_para });
    return candidates.sort((a, b) => a.data.localeCompare(b.data))[0] ?? null;
  })();

  return <div className="min-h-full">
    <header className="border-b" style={{borderColor:"rgba(13,13,13,.06)"}}>
      <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
      <Link href="/empresas-crm" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65"><ArrowLeft size={14}/>Empresas</Link>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <CompanyLogo nome={empresa.nome} site={empresa.domain_key} size={56} className="rounded"/>
          <div className="min-w-0">
            {empresa.setor && <p className="mb-1.5 text-[0.75rem] text-black/45">{empresa.setor}</p>}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#282525] sm:text-[2.375rem]">{empresa.nome}</h1>
              {empresa.domain_key && <a href={empresa.domain_key.startsWith("http") ? empresa.domain_key : `https://${empresa.domain_key}`} target="_blank" rel="noopener noreferrer" className="text-black/25 hover:text-[#7259B5] transition" title={empresa.domain_key}><Globe size={16}/></a>}
            </div>
            <div className="mt-2.5"><TagsDoRegistro tabela="empresas_crm" id={empresa.id} tags={empresa.tags} onSalvo={tags => setEmpresa(atual => atual ? { ...atual, tags } : atual)}/></div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <RelationshipScoreGauge
            score={empresa.tipo === "cliente_ativo" ? 100 : (empresa.potencial_relacionamento ?? 50)}
            label={empresa.tipo === "ex_cliente" ? "Chance de reconquistar" : "Chance de converter"}
            variant="conversion"
            titleOverride={empresa.tipo === "cliente_ativo" ? "Convertido" : undefined}
            compact
          />
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <DetailHeaderAction label="Nova negociação" icon={BriefcaseBusiness} onClick={() => setShowNegotiation(true)}/>
            <DetailHeaderAction label="Nova atividade" icon={CalendarClock} onClick={() => setShowActivity(true)}/>
            <DetailHeaderAction label="Editar" icon={Pencil} onClick={() => setShowEdit(true)}/>
          </div>
        </div>
      </div>
      </div>
    </header>

    <DetailTabs ariaLabel="Seções da empresa" activeTab={pageTab} onChange={value => setPageTab(value as PageTab)} tabs={[{id:"overview",label:"Visão geral",icon:Target},{id:"negotiations",label:"Negociações",icon:BriefcaseBusiness,count:negotiations.length},{id:"inscricoes",label:"Inscrições",icon:FileStack,count:notices.length},{id:"relationship",label:"Relacionamento",icon:Users}]} />

    <DetailPageContent>
      {pageTab === "overview" && <CommercialOverview empresa={empresa} companyId={id} contacts={contacts} negotiations={openNegotiations} projects={projects} notices={notices} clientAccount={clientAccount} atribuicao={atribuicao} pipelineValue={pipelineValue} nextStep={nextStep} nextOpening={nextOpening} nextContactDate={nextContactDate} openOpportunitiesCount={openNegotiations.length + openNotices.length} staleCount={staleCount} timelineSources={timelineSources} setTimelineSources={setTimelineSources} onNewNegotiation={() => setShowNegotiation(true)} onGoToRelationship={() => setPageTab("relationship")} onDataChanged={() => void fetchData()} onEditLocalizacao={() => setShowEditLocalizacao(true)}/>}
      {pageTab === "negotiations" && <NegotiationsTable rows={negotiations} onNew={() => setShowNegotiation(true)}/>}
      {pageTab === "inscricoes" && <InscricoesTable rows={notices} onNew={() => setShowInscricao(true)}/>}
      {pageTab === "relationship" && <RelationshipWorkspace mode="commercial" organizationId={empresa.organization_id} accountId={empresa.account_id} empresaCrmId={id} contacts={contacts.map(contact => ({id:contact.id,nome:contact.nome,cargo:contact.cargo}))}/>}
    </DetailPageContent>

    {showOpenAccount && <AbrirContaModal empresaCrmId={id} empresaNome={empresa.nome} onClose={() => setShowOpenAccount(false)} onSaved={() => {setShowOpenAccount(false);void fetchData();}}/>}
    {showEdit && <EditarEmpresaModal empresa={empresa} onClose={() => setShowEdit(false)} onSaved={() => {setShowEdit(false);void fetchData();}}/>}
    {showEditLocalizacao && <EditarLocalizacaoModal empresa={empresa} onClose={() => setShowEditLocalizacao(false)} onSaved={() => {setShowEditLocalizacao(false);void fetchData();}}/>}
    {showNegotiation && <NovaCaptacaoModal empresaPreId={id} nomePreEmpresa={empresa.nome} onClose={() => setShowNegotiation(false)} onSaved={() => {setShowNegotiation(false);void fetchData();}}/>}
    {showInscricao && <NovaInscricaoModal empresaPreId={id} nomePreEmpresa={empresa.nome} onClose={() => setShowInscricao(false)} onSaved={() => {setShowInscricao(false);void fetchData();}}/>}
    {showActivity && <NovaAtividadeModal prefill={{empresa_crm_id:id}} onClose={() => setShowActivity(false)} onSaved={() => {setShowActivity(false);void fetchData();}}/>}
  </div>;
}

function CommercialOverview({empresa,companyId,contacts,negotiations,projects,notices,clientAccount,atribuicao,pipelineValue,nextStep,nextOpening,nextContactDate,openOpportunitiesCount,staleCount,timelineSources,setTimelineSources,onNewNegotiation,onGoToRelationship,onDataChanged,onEditLocalizacao}:{empresa:EmpresaCrm;companyId:string;contacts:ContactRow[];negotiations:CaptacaoRow[];projects:ProjectRow[];notices:EditalRow[];clientAccount:ClientLink|null;atribuicao:AtribuicaoRow|null;pipelineValue:number;nextStep:{kind:"negociacao"|"followup";id:string;titulo:string;data:string;projetoNome?:string|null}|null;nextOpening:EditalRow|null;nextContactDate:string|null;openOpportunitiesCount:number;staleCount:number;timelineSources:string[];setTimelineSources:React.Dispatch<React.SetStateAction<string[]>>;onNewNegotiation:()=>void;onGoToRelationship:()=>void;onDataChanged:()=>void;onEditLocalizacao:()=>void}) {
  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric label="Oportunidades abertas" value={String(openOpportunitiesCount)} vazio={!openOpportunitiesCount}/>
      <Metric label="Valor no pipeline" value={formatarValorCurto(pipelineValue)} title={formatarValorCompleto(pipelineValue)} vazio={!pipelineValue}/>
      <Metric label="Próximo contato" value={nextContactDate ? fmtDate(nextContactDate) : "Não definido"} vazio={!nextContactDate}/>
      <Metric label="Sem avanço há 14 dias" value={String(staleCount)} vazio={!staleCount} alerta={staleCount > 0}/>
    </section>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        <section className="rounded border bg-white p-5" style={{borderColor:"rgba(13,13,13,.08)"}}>
          <p className="mb-1 text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">Próximos passos</p>
          {nextStep ? (
            <NextStepRow
              label={nextStep.kind === "followup" ? "Follow-up" : "Comercial"}
              title={nextStep.titulo}
              subtitle={`${nextStep.kind === "followup" ? "Previsto para" : "Contato previsto para"} ${fmtDate(nextStep.data)}${nextStep.projetoNome ? ` · ${nextStep.projetoNome}` : ""}`}
              actionLabel={nextStep.kind === "followup" ? "Ver follow-up" : "Abrir negociação"}
              onAction={nextStep.kind === "followup" ? onGoToRelationship : undefined}
              href={nextStep.kind === "followup" ? undefined : `/captacoes/${nextStep.id}`}
            />
          ) : (
            <NextStepRow label="Comercial" title="Defina o próximo movimento" subtitle="Não há follow-up futuro registrado" actionLabel="Nova negociação" onAction={onNewNegotiation}/>
          )}
          {nextOpening ? (
            <NextStepRow
              label="Inscrição"
              title={nextOpening.projeto?.nome || "Inscrição em andamento"}
              subtitle={`Inscrita em ${fmtDate(nextOpening.created_at)}`}
              actionLabel="Ver inscrição"
              href={`/editais-inscritos/${nextOpening.id}`}
            />
          ) : (
            <NextStepRow label="Inscrição" title="Nenhuma inscrição ativa" subtitle="Procure por novos editais e oportunidades" actionLabel="Buscar editais" href="/editais-abertos"/>
          )}
        </section>

        <PerfilComercialSection empresa={empresa} atribuicao={atribuicao} onAtribuicaoSaved={onDataChanged} onEditLocalizacao={onEditLocalizacao}/>

        <section className="overflow-hidden rounded border bg-white" style={{borderColor:"rgba(13,13,13,.08)"}}>
          <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{borderColor:"rgba(13,13,13,.07)"}}><div><p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">Histórico comercial</p><h2 className="mt-1 text-[0.9375rem] font-semibold text-black/75">Movimento da empresa</h2></div><div className="flex flex-wrap gap-1">{[{value:"atividades",label:"Atividades"},{value:"notas",label:"Notas"},{value:"historico_captações",label:"Mudanças"},{value:"inscricoes",label:"Inscrições"},{value:"interacoes",label:"Interações"}].map(option => <button key={option.value} onClick={() => setTimelineSources(previous => previous.includes(option.value) ? previous.filter(item => item !== option.value) : [...previous, option.value])} className="rounded border bg-white px-2.5 py-1.5 text-[0.6875rem] font-medium transition hover:bg-black/[.04]" style={{color:timelineSources.includes(option.value)?'#7259B5':'rgba(13,13,13,.4)',borderColor:timelineSources.includes(option.value)?'#7259B540':'transparent'}}>{option.label}</button>)}</div></header>
          <div className="p-5"><CompanyTimeline empresaCrmId={companyId} sources={timelineSources} showHeader={false} embedded/></div>
        </section>
      </div>

      <aside className="space-y-4">
        {clientAccount && <Link href={`/contas-patrocinio/${clientAccount.id}`} className="block rounded border bg-white p-4 transition hover:bg-black/[.025]" style={{borderColor:"#2E893240"}}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Building2 size={14} className="text-[#2E8932]"/><p className="text-[0.75rem] font-semibold text-black/65">Parceria ativa</p></div><ArrowUpRight size={13} className="text-[#2E8932]"/></div><p className="mt-2 text-[0.6875rem] leading-relaxed text-black/45">Acesse contratos, entregas, saúde e renovação na página do cliente.</p></Link>}
        <DetailSidebarCard title="Contatos-chave" icon={Users} count={contacts.length}>{contacts.length ? <div className="space-y-2">{contacts.slice(0,6).map(contact => <div key={contact.id} className="flex items-center gap-3 py-1.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-gradient-to-br from-white via-black/[.035] to-black/[.10] text-[0.9375rem] font-semibold text-black/45">{contact.nome.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-semibold text-black/75">{contact.nome}</p><p className="truncate text-[0.625rem] text-black/45">{contact.cargo || "Cargo não informado"}</p></div>{contact.email && <a href={`mailto:${contact.email}`} className="text-black/25 hover:text-[#7259B5]" aria-label={`Enviar e-mail para ${contact.nome}`}><Mail size={13}/></a>}</div>)}</div> : <EmptySide copy="Nenhum contato vinculado à empresa."/>}</DetailSidebarCard>
        <DetailSidebarCard title="Contexto comercial" icon={FolderOpen} count={projects.length + notices.length}><div className="space-y-3"><ContextLine icon={FolderOpen} label="Projetos relacionados" value={String(projects.length)}/><ContextLine icon={FileStack} label="Editais relacionados" value={String(notices.length)}/><ContextLine icon={Users} label="Contatos mapeados" value={String(contacts.length)}/></div></DetailSidebarCard>
      </aside>
    </div>
  </div>;
}


const LEIS_INCENTIVO = [
  { value: "rouanet", label: "Rouanet" },
  { value: "lei_esporte", label: "Lei do Esporte" },
  { value: "audiovisual", label: "Audiovisual" },
  { value: "lei_estadual", label: "Lei estadual" },
];

const TRIMESTRES_DECISAO = [
  { value: "Q1", label: "Q1 · jan-mar" },
  { value: "Q2", label: "Q2 · abr-jun" },
  { value: "Q3", label: "Q3 · jul-set" },
  { value: "Q4", label: "Q4 · out-dez" },
];

function SelectableChip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded border bg-white px-2.5 py-1 text-[0.6875rem] font-medium transition ${active ? "" : "hover:bg-black/[.04]"}`}
      style={active ? { borderColor: color + "66", color } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)" }}
    >
      {children}
    </button>
  );
}

function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => onChange(true)}
        className="rounded border px-2.5 py-1 text-[0.6875rem] font-medium transition"
        style={value === true ? { background: "#2E8932", color: "white", borderColor: "#2E8932" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)" }}>
        Sim
      </button>
      <button type="button" onClick={() => onChange(false)}
        className="rounded border px-2.5 py-1 text-[0.6875rem] font-medium transition"
        style={value === false ? { background: "rgba(13,13,13,.65)", color: "white", borderColor: "rgba(13,13,13,.65)" } : { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)" }}>
        Não
      </button>
    </div>
  );
}

const TIPO_ATRIBUICAO_CARDS = [
  { value: "exclusividade_empresa" as const, label: "Exclusiva", color: "#D94E4E", Icon: Shield },
  { value: "compartilhada" as const, label: "Compartilhada", color: "#1A8B7A", Icon: UserCheck },
];

function AtribuicaoCardsSection({ empresaId, empresaNome, atribuicao, onSaved }: { empresaId: string; empresaNome: string; atribuicao: AtribuicaoRow | null; onSaved: () => void }) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [tipoAlvo, setTipoAlvo] = useState<"exclusividade_empresa" | "compartilhada">("exclusividade_empresa");
  const [loading, setLoading] = useState(false);

  async function abrirModal(tipo: "exclusividade_empresa" | "compartilhada") {
    setTipoAlvo(tipo);
    if (atribuicao) {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("atribuicoes")
        .select("*, empresa_crm:empresas_crm(id,nome), projeto:projetos_crm(id,nome), captador:captadores!captador_user_id(nome)")
        .eq("id", atribuicao.id)
        .single();
      setLoading(false);
      setEditData(data ? { ...data, tipo } : null);
    } else {
      setEditData(null);
    }
    setShowModal(true);
  }

  return (
    <div className="mb-5 border-b pb-5" style={{borderColor:"rgba(13,13,13,.06)"}}>
      <div className="mb-3 flex items-center gap-2">
        <Shield size={13} className="text-black/30"/>
        <h3 className="text-[0.75rem] font-semibold text-black/65">Atribuição</h3>
      </div>
      <div className="flex gap-2">
        {TIPO_ATRIBUICAO_CARDS.map(card => {
          const active = atribuicao?.tipo === card.value;
          return (
            <button key={card.value} type="button" onClick={() => void abrirModal(card.value)} disabled={loading}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[0.625rem] font-bold uppercase tracking-[.06em] transition hover:brightness-[0.85] disabled:opacity-60"
              style={active
                ? { background: card.color, color: "#fff", border: "1px solid transparent" }
                : { background: "white", color: "rgba(13,13,13,.45)", border: "1px solid rgba(13,13,13,.45)" }}
            >
              <card.Icon size={12} strokeWidth={1.8}/>
              {card.label}
            </button>
          );
        })}
      </div>
      {atribuicao ? (
        <p className="mt-2 text-[0.6875rem] text-black/45">{atribuicao.captadores?.nome ?? "—"}</p>
      ) : (
        <p className="mt-2 text-[0.6875rem] text-black/30">Sem atribuição ativa para esta empresa.</p>
      )}
      {showModal && (
        <NovaAtribuicaoModal
          editData={editData}
          empresaPreSelecionada={!editData ? { id: empresaId, nome: empresaNome } : undefined}
          tipoPreSelecionado={tipoAlvo}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onSaved(); }}
        />
      )}
    </div>
  );
}

function PerfilComercialSection({ empresa, atribuicao, onAtribuicaoSaved, onEditLocalizacao }: { empresa: EmpresaCrm; atribuicao: AtribuicaoRow | null; onAtribuicaoSaved: () => void; onEditLocalizacao: () => void }) {
  const supabase = createClient();
  const cidades = empresa.cidades_interesse ?? [];
  const [jaPatrocinaCultura, setJaPatrocinaCultura] = useState<boolean | null>(empresa.ja_patrocina_cultura);
  const [jaPatrocinaEsporte, setJaPatrocinaEsporte] = useState<boolean | null>(empresa.ja_patrocina_esporte);
  const [leisQueUsa, setLeisQueUsa] = useState<string[]>(empresa.leis_que_usa ?? []);
  const [janelasDecisao, setJanelasDecisao] = useState<string[]>(empresa.janela_decisao ?? []);

  async function save(patch: Record<string, unknown>) {
    await (supabase as any).from("empresas_crm").update(patch).eq("id", empresa.id);
  }

  function toggleLei(lei: string) {
    const next = leisQueUsa.includes(lei) ? leisQueUsa.filter(l => l !== lei) : [...leisQueUsa, lei];
    setLeisQueUsa(next);
    void save({ leis_que_usa: next });
  }

  function toggleJanela(janela: string) {
    const next = janelasDecisao.includes(janela) ? janelasDecisao.filter(j => j !== janela) : [...janelasDecisao, janela];
    setJanelasDecisao(next);
    void save({ janela_decisao: next });
  }

  return (
    <section className="rounded border bg-white p-5" style={{borderColor:"rgba(13,13,13,.08)"}}>
      <p className="mb-4 text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">Perfil comercial</p>

      <div className="mb-5 border-b pb-5" style={{borderColor:"rgba(13,13,13,.06)"}}>
        <div className="mb-3 flex items-center gap-2">
          <Target size={13} className="text-black/30"/>
          <h3 className="text-[0.75rem] font-semibold text-black/65">Classificação</h3>
        </div>
        <TipoBadge empresa={empresa} onSaved={onAtribuicaoSaved}/>
      </div>

      <AtribuicaoCardsSection empresaId={empresa.id} empresaNome={empresa.nome} atribuicao={atribuicao} onSaved={onAtribuicaoSaved}/>

      <div className="mb-5 border-b pb-5" style={{borderColor:"rgba(13,13,13,.06)"}}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-black/30"/>
            <h3 className="text-[0.75rem] font-semibold text-black/65">Localização e cidades de interesse</h3>
          </div>
          <button type="button" onClick={onEditLocalizacao} title="Editar" aria-label="Editar localização e cidades" className="rounded p-1.5 text-black/25 transition hover:bg-black/[.04] hover:text-black/55">
            <Pencil size={12}/>
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[0.625rem] font-medium text-black/30">Sede</p>
            <p className="mt-1 text-[0.8125rem] text-black/65">{empresa.localizacao || "Não informada"}</p>
          </div>
          <div>
            <p className="text-[0.625rem] font-medium text-black/30">Cidades de interesse para patrocínio</p>
            {cidades.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {cidades.map(c => (
                  <span key={c} className="rounded border border-black/10 bg-black/[.035] px-2.5 py-1 text-[0.6875rem] text-black/65">{c}</span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[0.6875rem] text-black/30">Nenhuma cidade registrada.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Award size={13} className="text-black/30"/>
        <h3 className="text-[0.75rem] font-semibold text-black/65">Perfil de patrocínio</h3>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="mb-1.5 text-[0.625rem] font-medium text-black/45">Já patrocina cultura?</p>
          <YesNoToggle value={jaPatrocinaCultura} onChange={v => { setJaPatrocinaCultura(v); void save({ ja_patrocina_cultura: v }); }}/>
        </div>

        <div>
          <p className="mb-1.5 text-[0.625rem] font-medium text-black/45">Já patrocina esporte?</p>
          <YesNoToggle value={jaPatrocinaEsporte} onChange={v => { setJaPatrocinaEsporte(v); void save({ ja_patrocina_esporte: v }); }}/>
        </div>

        <div>
          <p className="mb-1.5 text-[0.625rem] font-medium text-black/45">Leis que usa</p>
          <div className="flex flex-wrap gap-1.5">
            {LEIS_INCENTIVO.map(lei => (
              <SelectableChip key={lei.value} active={leisQueUsa.includes(lei.value)} color="#7259B5" onClick={() => toggleLei(lei.value)}>
                {lei.label}
              </SelectableChip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[0.625rem] font-medium text-black/45">Janela de decisão orçamentária</p>
          <div className="flex flex-wrap gap-1.5">
            {TRIMESTRES_DECISAO.map(trimestre => (
              <SelectableChip key={trimestre.value} active={janelasDecisao.includes(trimestre.value)} color="#7259B5" onClick={() => toggleJanela(trimestre.value)}>
                {trimestre.label}
              </SelectableChip>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TipoBadge({empresa,onSaved}:{empresa:EmpresaCrm;onSaved:()=>void}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState(empresa.tipo);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuPos = usePortalPosition(boxRef, open);
  const tipos = [
    { value: "prospect", label: "Prospect", Icon: Target },
    { value: "cliente_ativo", label: "Cliente Ativo", Icon: Shield },
    { value: "ex_cliente", label: "Ex-Cliente", Icon: X },
  ] as const;
  const tipoColors: Record<string, string> = {
    "prospect": "rgba(13,13,13,.40)",
    "cliente_ativo": "#2E8932",
    "ex_cliente": "#D94E4E",
  };
  const currentTipo = tipos.find(t => t.value === tipo)
    ?? tipos.find(t => t.value === "prospect");
  const currentColor = tipoColors[tipo ?? "prospect"] ?? "rgba(13,13,13,.40)";

  async function updateTipo(newTipo: "prospect" | "cliente_ativo" | "ex_cliente") {
    setSaving(true);
    setErro(null);
    const { error: erroTipo } = await (supabase as any).from("empresas_crm").update({ tipo: newTipo }).eq("id", empresa.id);
    if (erroTipo) {
      setSaving(false);
      setErro("Não foi possível alterar o tipo da empresa. Tente novamente.");
      return;
    }
    if (newTipo === "cliente_ativo") {
      // Marcar como cliente precisa criar a conta de patrocínio, senão a empresa não aparece em Clientes.
      const { data: contaExistente } = await (supabase as any).from("contas_patrocinio").select("id").eq("empresa_crm_id", empresa.id).limit(1).maybeSingle();
      if (!contaExistente) {
        const { error: erroConta } = await (supabase as any).from("contas_patrocinio").insert({
          account_id: empresa.account_id,
          organization_id: empresa.organization_id,
          empresa_crm_id: empresa.id,
          nome: null,
          status: "ativa",
        });
        if (erroConta) {
          await (supabase as any).from("empresas_crm").update({ tipo: empresa.tipo }).eq("id", empresa.id);
          setSaving(false);
          setErro(`Não foi possível criar o cliente: ${erroConta.message}`);
          return;
        }
      }
    }
    setTipo(newTipo);
    setSaving(false);
    setOpen(false);
    onSaved();
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => { setErro(null); setOpen(!open); }}
        disabled={saving}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded border bg-white px-2.5 py-1 text-[0.6875rem] font-semibold transition hover:bg-black/[.04] disabled:opacity-60"
        style={{borderColor: currentColor + "66", color: currentColor}}
      >
        {currentTipo && <currentTipo.Icon size={11}/>}
        {currentTipo?.label ?? "Selecionar"}
        <ChevronDown size={11} className="opacity-70"/>
      </button>
      {open && (
        <PortalMenu position={menuPos} width={300}>
          <div className="grid grid-cols-3 gap-1.5 p-2">
            {tipos.map(t => {
              const color = tipoColors[t.value];
              const active = tipo === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => updateTipo(t.value)}
                  disabled={saving || active}
                  className="relative flex flex-col items-center justify-center gap-2 rounded py-3.5 transition hover:opacity-90 disabled:cursor-default"
                  style={{ background: color, border: `1.5px solid ${active ? color : "transparent"}`, boxShadow: active ? `0 0 0 1.5px ${color}` : undefined }}
                >
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white/25">
                      <Check size={9} className="text-white" strokeWidth={3}/>
                    </span>
                  )}
                  <t.Icon size={16} className="text-white" strokeWidth={1.8}/>
                  <span className="text-[0.5625rem] font-bold uppercase tracking-[.06em] leading-none text-white text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
          {erro && <p role="alert" className="border-t border-black/[.06] px-3 py-2 text-[0.6875rem] leading-snug text-[#B23A3A]">{erro}</p>}
        </PortalMenu>
      )}
    </div>
  );
}

function Metric({label,value,title,vazio=false,alerta=false}:{label:string;value:string;title?:string;vazio?:boolean;alerta?:boolean}) { return <div className="rounded border bg-black/[.025] px-4 py-4" style={{borderColor:"rgba(13,13,13,.07)"}}><p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{alerta && <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]"/>}{label}</p><p title={title} className={`mt-1.5 break-words text-[1.375rem] font-semibold tabular-nums ${vazio ? "text-black/30" : "text-[#282525]"}`}>{value}</p></div>; }
function NextStepRow({label,title,subtitle,actionLabel,onAction,href}:{label:string;title:string;subtitle:string;actionLabel:string;onAction?:()=>void;href?:string}) {
  const action = href
    ? <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#7259B5]/25 bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-[#7259B5] hover:bg-black/[.04]">{actionLabel}<ArrowUpRight size={11}/></Link>
    : <button onClick={onAction} className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#7259B5]/25 bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-[#7259B5] hover:bg-black/[.04]">{actionLabel}<ArrowUpRight size={11}/></button>;
  return (
    <div className="flex items-center justify-between gap-4 border-t py-3 first:border-t-0 first:pt-2" style={{borderColor:"rgba(13,13,13,.06)"}}>
      <div className="min-w-0">
        <p className="text-[0.5625rem] font-bold uppercase tracking-[.08em] text-black/30">{label}</p>
        <p className="mt-0.5 truncate text-[0.875rem] font-semibold text-black/75">{title}</p>
        <p className="mt-0.5 text-[0.6875rem] text-black/45">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function ContextLine({icon:Icon,label,value}:{icon:typeof Target;label:string;value:string}) { return <div className="flex items-center gap-2.5"><Icon size={13} className="text-black/25"/><span className="flex-1 text-[0.6875rem] text-black/45">{label}</span><span className="text-[0.75rem] font-semibold tabular-nums text-black/65">{value}</span></div>; }
function EmptySide({copy}:{copy:string}) { return <p className="py-4 text-center text-[0.6875rem] leading-relaxed text-black/30">{copy}</p>; }
