"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, Globe, Mail, Phone,
  ExternalLink, Pencil, MapPin, FileText, Users,
  TrendingUp, FolderOpen, Handshake, Plus, X,
  LayoutDashboard, UserRoundCheck,
  Download, FileArchive, FileImage, FileSpreadsheet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { NovoProponenteModal, type EditDataProponente } from "@/components/modals/NovoProponenteModal";
import { ProponenteWorkspaceModal } from "@/components/modals/ProponenteWorkspaceModal";
import { DetailHeaderAction, DetailPageContent, DetailTabs, DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import type { TipoProponente } from "@/lib/supabase/types";
import { IdentityPickerPopup } from "@/components/ui/IdentityPickerPopup";
import { PROPONENTE_ICON_OPTIONS } from "@/components/ui/ProjectIdentity";
import type { IdentityType } from "@/components/ui/ProjectIdentity";
import { DecisionScorecard } from "@/components/relationship/DecisionScorecard";
import { RelationshipWorkspace } from "@/components/relationship/RelationshipWorkspace";
import { NegotiationsTable, type CaptacaoRow } from "@/components/company/NegotiationsTable";
import { InscricoesTable, type EditalRow } from "@/components/company/InscricoesTable";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TextoRecolhivel } from "@/components/ui/TextoRecolhivel";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type ProponenteDetail = {
  id: string;
  account_id: string;
  nome: string;
  cnpj: string | null;
  tipo: TipoProponente | null;
  maturidade: string | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  descricao: string | null;
  created_at: string;
  identidade_tipo: IdentityType;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  user_id: string | null;
};

type ProjetoRow = {
  id: string;
  nome: string;
  fase: "planejamento" | "captacao" | "execucao" | "prestacao" | "concluido";
  valor_alvo: number | null;
  valor_garantido: number;
  areas_culturais: string[];
  status_operacional: "ativo" | "pausado" | "arquivado";
  mecanismo: string | null;
};

type ContatoRow = {
  id: string;
  nome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
};

type CaptadorVinculado = {
  id: string;
  captador_id: string;
  status: "ativo" | "encerrado" | "suspenso";
  data_inicio: string | null;
  captador: { nome: string; agencia: string | null; email: string | null } | null;
};

type CaptadorOption = { id: string; nome: string; agencia: string | null };

type DocumentoRow = {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  categoria: string | null;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  created_at: string;
  projeto: { id: string; nome: string } | null;
};

type ClienteVendaRow = {
  id: string;
  projeto_id: string;
  valor_vendido: number;
  vendida_em: string;
  empresa_crm_id: string | null;
  empresa_crm: { id: string; nome: string; domain_key: string | null; site: string | null; setor: string | null } | null;
  projeto: { id: string; nome: string } | null;
};

type ClienteRow = {
  id: string;
  nome: string;
  domain_key: string | null;
  site: string | null;
  setor: string | null;
  conta_id: string | null;
  valor: number;
  projetos: { id: string; nome: string }[];
  ultima_venda: string;
};

type PageTab = "overview" | "projetos" | "documentos" | "relationship" | "clientes";
type RelationshipSection = "relationship" | "registrations" | "negotiations";

const FASE_LABEL: Record<string, string> = {
  planejamento: "Planejamento", captacao: "Captação",
  execucao: "Execução", prestacao: "Prestação", concluido: "Concluído",
};
const FASE_COLOR: Record<string, { bg: string; text: string }> = {
  planejamento: { bg: "rgba(13,13,13,.07)", text: "rgba(13,13,13,.45)" },
  captacao:     { bg: "#fff",          text: "#7259B5" },
  execucao:     { bg: "#fff",          text: "#2D72B0" },
  prestacao:    { bg: "#fff",          text: "#B07A14" },
  concluido:    { bg: "#fff",          text: "#2E8932" },
};

const CAPTADOR_STATUS_COLOR: Record<string, string> = {
  ativo:     "#2E8932",
  encerrado: "rgba(13,13,13,.35)",
  suspenso:  "#B07A14",
};

const AREA_PT: Record<string, string> = {
  musica: "Música", audiovisual: "Audiovisual", artes_cenicas: "Artes Cênicas",
  artes_visuais: "Artes Visuais", artes_integradas: "Artes Integradas",
  humanidades: "Humanidades", patrimonio_cultural: "Patrimônio Cultural",
  impacto: "Impacto", visibilidade: "Visibilidade", institucional: "Institucional",
};

function fmtValor(v: number | null) {
  return v ? formatarValorCurto(v) : "—";
}
function fmtDate(d: string) {
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function fmtFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function DocumentIcon({ type, name }: { type: string | null; name: string }) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (type?.startsWith("image/")) return <FileImage size={15} />;
  if (type?.includes("spreadsheet") || type?.includes("excel") || ["csv", "xls", "xlsx"].includes(extension ?? "")) return <FileSpreadsheet size={15} />;
  if (["zip", "rar", "7z"].includes(extension ?? "")) return <FileArchive size={15} />;
  return <FileText size={15} />;
}

export default function ProponenteDetailPage() {
  const supabase      = useMemo(() => createClient(), []);
  const { id }        = useParams<{ id: string }>();
  const router        = useRouter();
  const organizationId = useOrganizationId();
  const { etiquetasMaturidadeProponente } = useEtiquetas();

  const [proponente, setProponente] = useState<ProponenteDetail | null>(null);
  const [projetos, setProjetos]     = useState<ProjetoRow[]>([]);
  const [contatos, setContatos]     = useState<ContatoRow[]>([]);
  const [captadores, setCaptadores] = useState<CaptadorVinculado[]>([]);
  const [allCaptadores, setAllCaptadores] = useState<CaptadorOption[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoRow[]>([]);
  const [negociacoes, setNegociacoes] = useState<CaptacaoRow[]>([]);
  const [inscricoes, setInscricoes] = useState<EditalRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showEdit, setShowEdit]     = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [pageTab, setPageTab]       = useState<PageTab>("overview");
  const [relationshipSection, setRelationshipSection] = useState<RelationshipSection>("relationship");

  // Vincular captador
  const [showVincular, setShowVincular]   = useState(false);
  const [vincularId, setVincularId]       = useState("");
  const [vincularData, setVincularData]   = useState("");
  const [vincularSaving, setVincularSaving] = useState(false);

  const [identitySaving, setIdentitySaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: pData }, { data: prData }, { data: cData }, { data: capData }, { data: allCap }] = await Promise.all([
      supabase.from("proponentes").select("id, account_id, nome, cnpj, tipo, maturidade, cidade, estado, email, telefone, site, descricao, created_at, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor, user_id").eq("id", id).single(),
      (supabase as any).from("projetos_crm").select("id, nome, fase, valor_alvo, valor_garantido, areas_culturais, status_operacional, mecanismo").eq("proponente_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("contatos").select("id, nome, cargo, email, telefone, linkedin_url").eq("proponente_id", id).order("nome", { ascending: true }),
      (supabase as any).from("captador_proponente").select("id, captador_id, status, data_inicio, captador:captadores(nome, agencia, email)").eq("proponente_id", id).order("created_at", { ascending: false }),
      organizationId
        ? (supabase as any).from("captadores").select("id, nome, agencia").eq("organization_id", organizationId).eq("ativo", true).order("nome")
        : Promise.resolve({ data: [] }),
    ]);
    if (pData) {
      const p = pData as unknown as ProponenteDetail;
      setProponente(p);
    }
    const projectRows = (prData ?? []) as unknown as ProjetoRow[];
    setProjetos(projectRows);
    if (cData)   setContatos(cData as unknown as ContatoRow[]);
    if (capData) setCaptadores(capData as unknown as CaptadorVinculado[]);
    if (allCap)  setAllCaptadores(allCap as unknown as CaptadorOption[]);

    const projectIds = projectRows.map(project => project.id);
    if (projectIds.length) {
      const [docsResult, negotiationsResult, registrationsResult, salesResult] = await Promise.all([
        (supabase as any).from("documentos").select("id,nome,arquivo_nome,categoria,tipo,tamanho,url,created_at,projeto:projetos_crm!projeto_id(id,nome)").in("projeto_id", projectIds).order("created_at", { ascending: false }),
        (supabase as any).from("captacoes").select("id,titulo,status,valor_solicitado,potencial_fechamento,proxima_prospeccao,data_previsao,created_at,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)").in("projeto_id", projectIds).order("updated_at", { ascending: false }),
        (supabase as any).from("editais_user").select("id,status,created_at,valor,data_fechamento,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)").in("projeto_id", projectIds).order("updated_at", { ascending: false }),
        (supabase as any).from("vendas_patrocinio").select("id,projeto_id,valor_vendido,vendida_em,empresa_crm_id,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site,setor),projeto:projetos_crm!projeto_id(id,nome)").in("projeto_id", projectIds).order("vendida_em", { ascending: false }),
      ]);
      setDocumentos((docsResult.data ?? []) as DocumentoRow[]);
      setNegociacoes((negotiationsResult.data ?? []) as CaptacaoRow[]);
      setInscricoes((registrationsResult.data ?? []) as EditalRow[]);

      const sales = (salesResult.data ?? []) as ClienteVendaRow[];
      const companyIds = [...new Set(sales.map(sale => sale.empresa_crm_id).filter((value): value is string => Boolean(value)))];
      const accountsResult = companyIds.length
        ? await (supabase as any).from("contas_patrocinio").select("id,empresa_crm_id").in("empresa_crm_id", companyIds).eq("status", "ativa")
        : { data: [] };
      const accountByCompany = new Map<string, string>((accountsResult.data ?? []).map((account: { id: string; empresa_crm_id: string }) => [account.empresa_crm_id, account.id]));
      const clientsByCompany = new Map<string, ClienteRow>();
      for (const sale of sales) {
        if (!sale.empresa_crm) continue;
        const current = clientsByCompany.get(sale.empresa_crm.id);
        if (!current) {
          clientsByCompany.set(sale.empresa_crm.id, {
            ...sale.empresa_crm,
            conta_id: accountByCompany.get(sale.empresa_crm.id) ?? null,
            valor: Number(sale.valor_vendido ?? 0),
            projetos: sale.projeto ? [sale.projeto] : [],
            ultima_venda: sale.vendida_em,
          });
          continue;
        }
        current.valor += Number(sale.valor_vendido ?? 0);
        if (sale.projeto && !current.projetos.some(project => project.id === sale.projeto!.id)) current.projetos.push(sale.projeto);
      }
      setClientes([...clientsByCompany.values()]);
    } else {
      setDocumentos([]);
      setNegociacoes([]);
      setInscricoes([]);
      setClientes([]);
    }
    setLoading(false);
  }, [id, organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "relationship") setPageTab("relationship");
  }, []);

  async function saveIdentity(tipoId: IdentityType, valor: string | null, logoUrl: string | null = null, cor: string | null = null) {
    setIdentitySaving(true);
    const { error } = await (supabase as any)
      .from("proponentes")
      .update({ identidade_tipo: tipoId, identidade_valor: valor, identidade_logo_url: logoUrl, identidade_cor: cor })
      .eq("id", id);

    if (!error) {
      setProponente(current => current ? {
        ...current,
        identidade_tipo: tipoId,
        identidade_valor: valor,
        identidade_logo_url: logoUrl,
        identidade_cor: cor,
      } : current);
    } else {
      console.error("Erro ao salvar identidade do proponente:", error.message);
    }
    setIdentitySaving(false);
  }

  function handleIdentityLogo(file?: File) {
    if (!file || !proponente) return;
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const size = Math.min(image.width, image.height);
      const sx = (image.width - size) / 2;
      const sy = (image.height - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      canvas.getContext("2d")?.drawImage(image, sx, sy, size, size, 0, 0, 512, 512);
      await saveIdentity("logo", null, canvas.toDataURL("image/webp", .88));
    };
    image.onerror = () => URL.revokeObjectURL(objectUrl);
    image.src = objectUrl;
  }

  async function handleVincularCaptador() {
    if (!vincularId || !organizationId) return;
    setVincularSaving(true);
    await (supabase as any).from("captador_proponente").insert({
      organization_id: organizationId,
      captador_id: vincularId,
      proponente_id: id,
      status: "ativo",
      data_inicio: vincularData || null,
    });
    setShowVincular(false);
    setVincularId("");
    setVincularData("");
    setVincularSaving(false);
    fetchAll();
  }

  async function handleDesvincular(cpId: string) {
    await (supabase as any).from("captador_proponente").update({ status: "encerrado" }).eq("id", cpId);
    fetchAll();
  }

  if (loading) return <DetailPageSkeleton />;

  if (!proponente) {
    return <DetailNotFound title="Proponente não encontrado" backHref="/proponentes" backLabel="Proponentes" />;
  }

  const totalGarant = projetos.reduce((s, p) => s + (p.valor_garantido ?? 0), 0);
  const ativos      = projetos.filter(p => p.status_operacional === "ativo").length;
  // captadores já vinculados (para excluir do dropdown)
  const vinculadosIds = new Set(captadores.filter(c => c.status === "ativo").map(c => c.captador_id));
  const disponiveis   = allCaptadores.filter(c => !vinculadosIds.has(c.id));

  const editData: EditDataProponente = {
    id: proponente.id, nome: proponente.nome, cnpj: proponente.cnpj,
    tipo: proponente.tipo, maturidade: proponente.maturidade, cidade: proponente.cidade, estado: proponente.estado,
    email: proponente.email, telefone: proponente.telefone, site: proponente.site,
    descricao: proponente.descricao,
    identidade_tipo: proponente.identidade_tipo, identidade_valor: proponente.identidade_valor,
    identidade_logo_url: proponente.identidade_logo_url, identidade_cor: proponente.identidade_cor,
  };

  return (
    <div className="min-h-full">
      {showEdit && (
        <NovoProponenteModal editData={editData} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); fetchAll(); }}/>
      )}
      {showWorkspaceModal && organizationId && (
        <ProponenteWorkspaceModal
          proponenteId={proponente.id}
          organizationId={organizationId}
          proponenteEmail={proponente.email}
          jaTemAcesso={!!proponente.user_id}
          onClose={() => setShowWorkspaceModal(false)}
          onSaved={() => void fetchAll()}
        />
      )}

      {/* Header */}
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <Link href="/proponentes" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={12} /> Proponentes
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <IdentityPickerPopup
                nome={proponente.nome}
                tipo={proponente.identidade_tipo}
                valor={proponente.identidade_valor}
                logoUrl={proponente.identidade_logo_url}
                cor={proponente.identidade_cor}
                iconOptions={PROPONENTE_ICON_OPTIONS}
                saving={identitySaving}
                title="Identidade do proponente"
                onSave={saveIdentity}
                onLogoFile={handleIdentityLogo}
                triggerLabel="Alterar identidade do proponente"
              />
              <div className="min-w-0">
                <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[2.375rem]">{proponente.nome}</h1>
                {proponente.maturidade && (() => {
                  const item = etiquetasMaturidadeProponente.find(etiqueta => etiqueta.key === proponente.maturidade);
                  return item ? <span className="mt-2 inline-flex rounded border px-2 py-1 text-[0.625rem] font-semibold" style={{ color: item.cor, borderColor: `${item.cor}55` }}>Maturidade: {item.label}</span> : null;
                })()}
                {(proponente.cidade || proponente.estado) && (
                  <p className="mt-2 flex items-center gap-1 text-[0.875rem] text-black/45">
                    <MapPin size={11} />
                    {[proponente.cidade, proponente.estado].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <DetailHeaderAction label={proponente.user_id ? "Acesso concedido" : "Dar acesso ao proponente"} icon={FolderOpen} onClick={() => setShowWorkspaceModal(true)} />
              <DetailHeaderAction label="Editar" icon={Pencil} onClick={() => setShowEdit(true)} />
            </div>
          </div>
        </div>
      </header>

      <DetailTabs
        ariaLabel="Seções do proponente"
        activeTab={pageTab}
        onChange={value => setPageTab(value as PageTab)}
        tabs={[
          { id: "overview", label: "Visão geral", icon: LayoutDashboard },
          { id: "projetos", label: "Projetos", icon: FolderOpen, count: projetos.length },
          { id: "documentos", label: "Documentos", icon: FileText, count: documentos.length },
          { id: "relationship", label: "Relacionamento", icon: Users, count: contatos.length },
          { id: "clientes", label: "Clientes", icon: UserRoundCheck, count: clientes.length },
        ]}
      />

      <DetailPageContent>
        {pageTab === "projetos" ? (
          <ProjetosView projetos={projetos} onOpen={projectId => router.push(`/projetos/${projectId}`)} />
        ) : pageTab === "documentos" ? (
          <DocumentosView documentos={documentos} onOpen={async documento => {
            const { data, error } = await supabase.storage.from("documentos").createSignedUrl(documento.url, 3600);
            if (!error && data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
          }} />
        ) : pageTab === "relationship" ? (
          <div className="flex items-start gap-6 sm:gap-8">
            <nav className="flex w-28 shrink-0 flex-col gap-0.5" aria-label="Áreas de relacionamento">
              <ProponenteSubsectionButton active={relationshipSection === "relationship"} onClick={() => setRelationshipSection("relationship")} count={contatos.length}>Relacionamento</ProponenteSubsectionButton>
              <ProponenteSubsectionButton active={relationshipSection === "registrations"} onClick={() => setRelationshipSection("registrations")} count={inscricoes.length}>Inscrições</ProponenteSubsectionButton>
              <ProponenteSubsectionButton active={relationshipSection === "negotiations"} onClick={() => setRelationshipSection("negotiations")} count={negociacoes.length}>Negociações</ProponenteSubsectionButton>
            </nav>
            <div className="min-w-0 flex-1">
              {relationshipSection === "relationship" && (
                <RelationshipWorkspace
                  mode="commercial"
                  organizationId={organizationId}
                  accountId={proponente.account_id}
                  empresaCrmId={null}
                  proponenteId={id}
                  contacts={contatos.filter(contato => Boolean(contato.nome)).map(contato => ({ id: contato.id, nome: contato.nome!, cargo: contato.cargo }))}
                />
              )}
              {relationshipSection === "registrations" && <InscricoesTable rows={inscricoes} />}
              {relationshipSection === "negotiations" && <NegotiationsTable rows={negociacoes} eyebrow="Pipeline do proponente" title="Negociações" />}
            </div>
          </div>
        ) : pageTab === "clientes" ? (
          <ClientesView clientes={clientes} />
        ) : (
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* Sidebar */}
          <div className="w-full shrink-0 space-y-4 lg:w-[20rem]">

            <DecisionScorecard proponenteId={proponente.id} organizationId={organizationId} />

            {/* Informações */}
            <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.625rem] font-bold text-black/30 uppercase tracking-wider mb-3">Informações</p>
              <div className="space-y-3">
                {proponente.cnpj && (
                  <div><p className="text-[0.625rem] text-black/30 mb-0.5">CNPJ</p><p className="text-[0.75rem] text-black/70 font-mono">{proponente.cnpj}</p></div>
                )}
                {proponente.email && (
                  <div className="flex items-start gap-1.5"><Mail size={12} className="text-black/25 mt-0.5 flex-shrink-0"/><a href={`mailto:${proponente.email}`} className="text-[0.75rem] text-black/60 hover:text-black/80 transition break-all">{proponente.email}</a></div>
                )}
                {proponente.telefone && (
                  <div className="flex items-center gap-1.5"><Phone size={12} className="text-black/25 flex-shrink-0"/><span className="text-[0.75rem] text-black/60">{proponente.telefone}</span></div>
                )}
                {proponente.site && (
                  <div className="flex items-center gap-1.5"><Globe size={12} className="text-black/25 flex-shrink-0"/>
                    <a href={proponente.site} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-black/50 hover:text-[#7259B5] transition flex items-center gap-1">
                      <span className="truncate max-w-[10rem]">{proponente.site.replace(/^https?:\/\//, "")}</span><ExternalLink size={10}/>
                    </a>
                  </div>
                )}
                {!proponente.cnpj && !proponente.email && !proponente.telefone && !proponente.site && (
                  <p className="text-[0.75rem] text-black/25 italic">Sem informações de contato</p>
                )}
              </div>
              {proponente.descricao?.trim() && (
                <>
                  <div className="my-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}/>
                  <div className="flex items-start gap-1.5"><FileText size={12} className="text-black/25 mt-0.5 flex-shrink-0"/>
                    <TextoRecolhivel texto={proponente.descricao.trim()} linhas={5} className="min-w-0 text-[0.75rem] text-black/55 leading-relaxed" />
                  </div>
                </>
              )}
              <div className="my-3 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}/>
              <p className="text-[0.6875rem] text-black/25">Cadastrado em {fmtDate(proponente.created_at)}</p>
            </div>

            {/* Captadores */}
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <Handshake size={13} className="text-black/30"/>
                <span className="text-[0.625rem] font-bold text-black/35 uppercase tracking-wider">Captadores</span>
                <span className="ml-auto text-[0.6875rem] text-black/30">{captadores.filter(c => c.status === "ativo").length}</span>
                {disponiveis.length > 0 && (
                  <button onClick={() => setShowVincular(v => !v)} className="flex items-center gap-1 text-[0.625rem] font-semibold text-black/35 hover:text-[#7259B5] transition">
                    <Plus size={11}/> Vincular
                  </button>
                )}
              </div>

              {/* Inline form vincular */}
              {showVincular && (
                <div className="px-4 py-3 border-b bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <div className="space-y-2">
                    <Select value={vincularId} onChange={e => setVincularId(e.target.value)} className="h-8 text-[0.75rem]">
                      <option value="">Selecionar captador</option>
                      {disponiveis.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}{c.agencia ? ` · ${c.agencia}` : ""}</option>
                      ))}
                    </Select>
                    <div className="flex items-center gap-2">
                      <input type="date" value={vincularData} onChange={e => setVincularData(e.target.value)}
                        className="h-8 flex-1 rounded border border-black/12 bg-white px-2 text-[0.6875rem] outline-none focus:border-[#7259B5]"
                        placeholder="Data início (opcional)"/>
                      <button disabled={!vincularId || vincularSaving} onClick={handleVincularCaptador}
                        className="h-8 px-3 rounded bg-[#7259B5] text-white text-[0.6875rem] font-semibold disabled:opacity-40 transition hover:bg-[#5e48a0]">
                        {vincularSaving ? "…" : "Salvar"}
                      </button>
                      <button onClick={() => setShowVincular(false)} className="h-8 w-8 flex items-center justify-center text-black/35 hover:text-black/60 transition">
                        <X size={12}/>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {captadores.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Handshake size={18} className="text-black/15 mx-auto mb-2"/>
                  <p className="text-[0.75rem] text-black/25">Nenhum captador vinculado</p>
                  <p className="text-[0.6875rem] text-black/20 mt-1">Use “Vincular” para associar um captador</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "rgba(13,13,13,.045)" }}>
                  {captadores.map(cp => (
                    <div key={cp.id} className="px-5 py-3 group">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[0.8125rem] font-semibold text-black leading-tight truncate">{cp.captador?.nome ?? "—"}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[0.5625rem] font-bold uppercase tracking-wide" style={{ color: CAPTADOR_STATUS_COLOR[cp.status] }}>{cp.status}</span>
                          {cp.status === "ativo" && (
                            <button onClick={() => handleDesvincular(cp.id)} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 text-black/20 hover:text-[#D94E4E] transition">
                              <X size={11}/>
                            </button>
                          )}
                        </div>
                      </div>
                      {cp.captador?.agencia && <p className="text-[0.6875rem] text-black/35 mt-0.5">{cp.captador.agencia}</p>}
                      {cp.data_inicio && <p className="text-[0.625rem] text-black/25 mt-1">desde {fmtDate(cp.data_inicio)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: FolderOpen, label: "Projetos",  value: projetos.length.toString(), sub: "total",           vazio: projetos.length === 0, title: undefined },
                { icon: TrendingUp, label: "Ativos",    value: ativos.toString(),          sub: "em andamento",    vazio: ativos === 0,          title: undefined },
                { icon: TrendingUp, label: "Garantido", value: fmtValor(totalGarant),      sub: "valor garantido", vazio: !totalGarant,          title: totalGarant ? formatarValorCompleto(totalGarant) : undefined },
              ].map(({ icon: Icon, label, value, sub, vazio, title }) => (
                <div key={label} className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={13} className="text-black/25"/>
                    <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{label}</p>
                  </div>
                  <p title={title} className={`text-[1.375rem] font-semibold tabular-nums leading-none ${vazio ? "text-black/30" : "text-[#0D0D0D]"}`}>{value}</p>
                  <p className="text-[0.6875rem] text-black/30 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Contatos */}
            {contatos.length > 0 && (
              <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <Users size={14} className="text-black/30"/>
                  <span className="text-[0.6875rem] font-bold text-black/35 uppercase tracking-wider">Contatos vinculados</span>
                  <span className="ml-auto text-[0.6875rem] text-black/30">{contatos.length}</span>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(13,13,13,.045)" }}>
                  {contatos.map(c => (
                    <Link key={c.id} href={`/contatos/${c.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-black/[0.02] transition">
                      <div className="w-7 h-7 rounded bg-black/6 flex items-center justify-center flex-shrink-0">
                        <span className="text-[0.6875rem] font-bold text-black/30">{(c.nome ?? "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-semibold text-black leading-tight">{c.nome ?? "—"}</p>
                        {c.cargo && <p className="text-[0.6875rem] text-black/35">{c.cargo}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {c.email && <span className="text-[0.6875rem] text-black/40 truncate max-w-[10rem]">{c.email}</span>}
                        {c.linkedin_url && <ExternalLink size={12} className="text-black/25"/>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
        )}
      </DetailPageContent>
    </div>
  );
}

function ProponenteSubsectionButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-1.5 border-l-2 py-1.5 pl-3 text-left text-[0.75rem] font-medium transition ${active ? "border-black/55 text-black/75" : "border-transparent text-black/35 hover:text-black/55"}`}>
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined && count > 0 && <span className={`text-[0.625rem] font-semibold tabular-nums ${active ? "text-black/50" : "text-black/25"}`}>{count}</span>}
    </button>
  );
}

function SectionHeading({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) {
  return (
    <header className="flex items-end justify-between gap-4 border-b px-5 py-5 md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <div>
        <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">{eyebrow}</p>
        <h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">{title}</h2>
      </div>
      <span className="text-[0.6875rem] tabular-nums text-black/30">{count} {count === 1 ? "registro" : "registros"}</span>
    </header>
  );
}

function ProjetosView({ projetos, onOpen }: {
  projetos: ProjetoRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <SectionHeading eyebrow="Portfólio do proponente" title="Projetos" count={projetos.length} />
      {!projetos.length ? (
        <EmptyState icon={FolderOpen} title="Nenhum projeto vinculado" description="Os projetos ligados a este proponente aparecerão aqui." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56.25rem] border-collapse text-left">
            <thead>
              <tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                {["Projeto", "Fase", "Áreas", "Valor alvo", "Garantido"].map(label => <th key={label} className="px-5 py-3 text-[0.625rem] font-medium text-black/30">{label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.06]">
              {projetos.map(project => {
                const fase = FASE_COLOR[project.fase] ?? FASE_COLOR.planejamento;
                return (
                  <tr key={project.id} onClick={() => onOpen(project.id)} className="group cursor-pointer transition hover:bg-black/[.018]">
                    <td className="max-w-[16.25rem] px-5 py-4"><p className="truncate text-[0.8125rem] font-semibold text-black/75">{project.nome}</p>{project.mecanismo && <p className="mt-0.5 truncate text-[0.625rem] text-black/30">{project.mecanismo}</p>}</td>
                    <td className="px-5 py-4"><span className="rounded px-1.5 py-0.5 text-[0.625rem] font-medium" style={{ background: fase.bg, color: fase.text }}>{FASE_LABEL[project.fase]}</span></td>
                    <td className="max-w-[13.125rem] px-5 py-4"><div className="flex flex-wrap gap-1">{project.areas_culturais.slice(0, 2).map(area => <span key={area} className="rounded border border-[#7259B5]/30 bg-white px-1.5 py-0.5 text-[0.5625rem] font-medium text-[#7259B5]">{AREA_PT[area] ?? area}</span>)}{project.areas_culturais.length > 2 && <span className="text-[0.5625rem] text-black/30">+{project.areas_culturais.length - 2}</span>}{!project.areas_culturais.length && <span className="text-black/20">—</span>}</div></td>
                    <td className="px-5 py-4 text-[0.75rem] tabular-nums text-black/50" title={project.valor_alvo ? formatarValorCompleto(project.valor_alvo) : undefined}>{fmtValor(project.valor_alvo)}</td>
                    <td className="px-5 py-4 text-[0.75rem] font-medium tabular-nums text-[#0D0D0D]" title={project.valor_garantido > 0 ? formatarValorCompleto(project.valor_garantido) : undefined}>{project.valor_garantido > 0 ? fmtValor(project.valor_garantido) : <span className="font-normal text-black/20">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DocumentosView({ documentos, onOpen }: { documentos: DocumentoRow[]; onOpen: (documento: DocumentoRow) => Promise<void> }) {
  return (
    <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <SectionHeading eyebrow="Arquivos dos projetos" title="Documentos" count={documentos.length} />
      {!documentos.length ? (
        <EmptyState icon={FileText} title="Nenhum documento armazenado" description="Documentos adicionados aos projetos deste proponente aparecerão aqui." />
      ) : (
        <div className="divide-y divide-black/[.06]">
          {documentos.map(documento => (
            <div key={documento.id} className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-black/[.018] md:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-black/[.045] text-black/40"><DocumentIcon type={documento.tipo} name={documento.arquivo_nome ?? documento.nome} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-semibold text-black/70">{documento.nome}</p>
                <p className="mt-0.5 truncate text-[0.625rem] text-black/30">{documento.categoria || "Outro"} · {fmtFileSize(documento.tamanho)} · {fmtDate(documento.created_at)} · {documento.projeto?.nome ?? "Projeto"}</p>
              </div>
              {documento.projeto && <Link href={`/projetos/${documento.projeto.id}`} className="hidden text-[0.6875rem] font-medium text-black/30 transition hover:text-[#7259B5] sm:inline">Ver projeto</Link>}
              <button type="button" onClick={() => void onOpen(documento)} className="rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#7259B5]" title="Abrir documento" aria-label={`Abrir ${documento.nome}`}><Download size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ClientesView({ clientes }: { clientes: ClienteRow[] }) {
  return (
    <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <SectionHeading eyebrow="Relacionamentos convertidos" title="Clientes" count={clientes.length} />
      {!clientes.length ? (
        <EmptyState icon={UserRoundCheck} title="Nenhum cliente convertido" description="Clientes originados por projetos deste proponente aparecerão aqui após a aprovação." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48.75rem] border-collapse text-left">
            <thead><tr className="border-b bg-[#F9F9F8]" style={{ borderColor: "rgba(13,13,13,.07)" }}>{["Cliente", "Projetos", "Valor convertido", "Última conversão"].map(label => <th key={label} className="px-5 py-3 text-[0.625rem] font-medium text-black/30">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-black/[.06]">
              {clientes.map(cliente => {
                const href = cliente.conta_id ? `/contas-patrocinio/${cliente.conta_id}` : `/empresas-crm/${cliente.id}`;
                return (
                  <tr key={cliente.id} className="transition hover:bg-black/[.018]">
                    <td className="px-5 py-4"><Link href={href} className="flex items-center gap-3"><CompanyLogo nome={cliente.nome} domain={cliente.domain_key} site={cliente.site} size={34} className="shrink-0 rounded"/><span><span className="block text-[0.8125rem] font-semibold text-black/75">{cliente.nome}</span>{cliente.setor && <span className="mt-0.5 block text-[0.625rem] text-black/30">{cliente.setor}</span>}</span></Link></td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1">{cliente.projetos.slice(0, 2).map(project => <Link key={project.id} href={`/projetos/${project.id}`} className="rounded bg-black/[.045] px-2 py-1 text-[0.625rem] text-black/45 transition hover:text-[#7259B5]">{project.nome}</Link>)}{cliente.projetos.length > 2 && <span className="px-1 py-1 text-[0.625rem] text-black/25">+{cliente.projetos.length - 2}</span>}</div></td>
                    <td className={`px-5 py-4 text-[0.75rem] font-semibold tabular-nums ${cliente.valor ? "text-[#0D0D0D]" : "text-black/30"}`} title={cliente.valor ? formatarValorCompleto(cliente.valor) : undefined}>{fmtValor(cliente.valor)}</td>
                    <td className="px-5 py-4 text-[0.6875rem] tabular-nums text-black/40">{fmtDate(cliente.ultima_venda)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof FolderOpen; title: string; description: string }) {
  return (
    <div className="px-6 py-20 text-center">
      <Icon size={24} className="mx-auto text-black/15" />
      <p className="mt-4 text-[0.875rem] font-semibold text-black/45">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[0.6875rem] leading-relaxed text-black/25">{description}</p>
    </div>
  );
}
