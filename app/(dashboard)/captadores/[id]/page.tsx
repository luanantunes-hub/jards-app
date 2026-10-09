"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Pencil, Shield, UserCheck, Building2, Check, FileStack, Briefcase, MessageCircle, Lightbulb } from "lucide-react";
import { CaptadorWorkspaceModal, type EscopoConfig } from "@/components/modals/CaptadorWorkspaceModal";
import { AtribuicaoConversa, PedidoConversa, listarPedidosWorkspace, type WorkspacePedido } from "@/components/captadores/WorkspaceConversation";
import { createClient } from "@/lib/supabase/client";
import { CAPTADOR_ICON_OPTIONS, type IdentityType } from "@/components/ui/ProjectIdentity";
import { IdentityPickerPopup } from "@/components/ui/IdentityPickerPopup";
import AdicionarCaptadorModal from "@/components/modals/AdicionarCaptadorModal";
import { NegotiationsTable, type CaptacaoRow } from "@/components/company/NegotiationsTable";
import { InscricoesTable, type EditalRow } from "@/components/company/InscricoesTable";
import { DetailHeaderAction, DetailPageContent, DetailTabs, DetailNotFound } from "@/components/ui/DetailPagePrimitives";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CaptadorOverview, type CaptadorOverviewData } from "@/components/captadores/CaptadorOverview";
import { CaptadorRelationshipScorecard } from "@/components/relationship/DecisionScorecard";
import { useEtiquetas } from "@/contexts/EtiquetasContext";

type CaptadorDetalhe = {
  id: string;
  organization_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  agencia: string | null;
  prioridade: "alta" | "media" | "baixa";
  user_id: string | null;
  logo_url: string | null;
  identidade_tipo: IdentityType | null;
  identidade_valor: string | null;
  identidade_logo_url: string | null;
  identidade_cor: string | null;
  created_at: string;
};

type AtribuicaoRow = {
  id: string;
  tipo: string;
  status: string;
  dias_sem_avanco: number | null;
  workspace_etapa?: string | null;
  empresa_crm: { id: string; nome: string; domain_key: string | null; site: string | null } | null;
  projeto: { id: string; nome: string } | null;
};

const EXC_LABEL: Record<string, string> = { exclusividade_empresa: "Exclusiva", compartilhada: "Compartilhada" };
const PEDIDO_TIPO_LABEL: Record<string, string> = { empresas: "Relacionamento", negociacoes: "Negociação", inscricoes: "Edital" };
const STATUS_ATRIB: Record<string, { label: string; color: string }> = {
  ativa: { label: "Ativa", color: "#1A8B7A" },
  suspensa: { label: "Suspensa", color: "#B07A14" },
  expirada: { label: "Expirada", color: "#D94E4E" },
  transferida: { label: "Transferida", color: "#2D72B0" },
  cancelada: { label: "Cancelada", color: "rgba(13,13,13,.40)" },
};

type PageTab = "overview" | "workspace" | "negociacoes" | "inscricoes" | "atribuicoes";

export default function CaptadorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const [captador, setCaptador] = useState<CaptadorDetalhe | null>(null);
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoRow[]>([]);
  const [negociacoes, setNegociacoes] = useState<CaptacaoRow[]>([]);
  const [inscricoes, setInscricoes] = useState<EditalRow[]>([]);
  const [overview, setOverview] = useState<CaptadorOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [pageTab, setPageTab] = useState<PageTab>("overview");
  const [workspace, setWorkspace] = useState<{ id: string; escopos: EscopoConfig[] } | null>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [pedidosWorkspace, setPedidosWorkspace] = useState<WorkspacePedido[]>([]);
  const [erroWorkspace, setErroWorkspace] = useState<string | null>(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | null>(null);
  const [atribuicaoSelecionada, setAtribuicaoSelecionada] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const atribuicaoId = new URLSearchParams(window.location.search).get("workspace");
      if (atribuicaoId) { setPageTab("workspace"); setAtribuicaoSelecionada(atribuicaoId); setPedidoSelecionado(null); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await (supabase as any).from("captadores").select("*").eq("id", id).single();
    if (error || !row) {
      setCaptador(null);
      setLoading(false);
      return;
    }
    const captadorData = row as CaptadorDetalhe;
    setCaptador(captadorData);

    const negociacoesSelect = "id,titulo,status,valor_solicitado,potencial_fechamento,proxima_prospeccao,data_previsao,created_at,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)";
    const inscricoesSelect = "id,status,created_at,valor,data_fechamento,updated_at,projeto:projetos_crm!projeto_id(id,nome,created_at)";
    const inscricoesFiltro = captadorData.user_id
      ? `and(responsavel_tipo.eq.agencia,responsavel_id.eq.${id}),and(responsavel_tipo.eq.membro,responsavel_id.eq.${captadorData.user_id})`
      : `and(responsavel_tipo.eq.agencia,responsavel_id.eq.${id})`;

    const [atribRes, negExtRes, negIntRes, inscRes, overviewRes] = await Promise.all([
      (supabase as any)
        .from("atribuicoes")
        .select("id,tipo,status,dias_sem_avanco,workspace_etapa,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site),projeto:projetos_crm!projeto_id(id,nome)")
        .eq("captador_user_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("captacoes")
        .select(negociacoesSelect)
        .eq("captador_externo_id", id)
        .order("updated_at", { ascending: false }),
      captadorData.user_id
        ? (supabase as any)
            .from("captacoes")
            .select(negociacoesSelect)
            .eq("captador_id", captadorData.user_id)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      (supabase as any)
        .from("editais_user")
        .select(inscricoesSelect)
        .or(inscricoesFiltro)
        .order("updated_at", { ascending: false }),
      (supabase as any).rpc("fn_captador_overview", { p_captador_id: id }),
    ]);

    const atribuicoesResult = atribRes.error?.code === "42703"
      ? await (supabase as any).from("atribuicoes")
          .select("id,tipo,status,dias_sem_avanco,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site),projeto:projetos_crm!projeto_id(id,nome)")
          .eq("captador_user_id", id).order("created_at", { ascending: false })
      : atribRes;
    setAtribuicoes((atribuicoesResult.data ?? []) as AtribuicaoRow[]);
    setNegociacoes([...(negExtRes.data ?? []), ...(negIntRes.data ?? [])] as CaptacaoRow[]);
    setInscricoes((inscRes.data ?? []) as EditalRow[]);
    setOverview(overviewRes.error ? null : overviewRes.data as CaptadorOverviewData);

    const { data: workspaceRow } = await (supabase as any)
      .from("captador_workspaces")
      .select("id, captador_workspace_escopos(tipo, habilitado, modo)")
      .eq("captador_id", id)
      .maybeSingle();
    setWorkspace(workspaceRow ? { id: workspaceRow.id, escopos: workspaceRow.captador_workspace_escopos } : null);

    if (workspaceRow) {
      const { pedidos, error: erroPedidos } = await listarPedidosWorkspace(supabase, workspaceRow.id);
      setPedidosWorkspace(pedidos);
      setErroWorkspace(erroPedidos);
    } else {
      setPedidosWorkspace([]);
      setErroWorkspace(null);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function saveIdentity(tipo: IdentityType, valor: string | null, logoUrl: string | null = null, cor: string | null = null) {
    setIdentitySaving(true);
    // Campos de identidade ainda não constam no tipo gerado do Supabase.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("captadores")
      .update({
        identidade_tipo: tipo,
        identidade_valor: valor,
        identidade_logo_url: logoUrl,
        identidade_cor: cor,
      })
      .eq("id", id);

    if (!error) {
      setCaptador(current => current ? {
        ...current,
        identidade_tipo: tipo,
        identidade_valor: valor,
        identidade_logo_url: logoUrl,
        identidade_cor: cor,
      } : current);
    } else {
      console.error("Erro ao salvar identidade do captador:", error.message);
    }
    setIdentitySaving(false);
  }

  function handleIdentityLogo(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const image = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const cropSize = Math.min(image.width, image.height);
      const sourceX = (image.width - cropSize) / 2;
      const sourceY = (image.height - cropSize) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      canvas.getContext("2d")?.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 512, 512);
      await saveIdentity("logo", null, canvas.toDataURL("image/webp", .88));
    };
    image.onerror = () => URL.revokeObjectURL(objectUrl);
    image.src = objectUrl;
  }

  async function atualizarPedidos() {
    if (!workspace) return;
    const { pedidos, error } = await listarPedidosWorkspace(supabase, workspace.id);
    setPedidosWorkspace(pedidos);
    setErroWorkspace(error);
    const { data: atribuicoesComEtapa, error: erroAtribuicoes } = await (supabase as any).from("atribuicoes")
      .select("id,tipo,status,dias_sem_avanco,workspace_etapa,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site),projeto:projetos_crm!projeto_id(id,nome)")
      .eq("captador_user_id", id).order("created_at", { ascending: false });
    let novasAtribuicoes = atribuicoesComEtapa;
    if (erroAtribuicoes?.code === "42703") {
      ({ data: novasAtribuicoes } = await (supabase as any).from("atribuicoes")
        .select("id,tipo,status,dias_sem_avanco,empresa_crm:empresas_crm!empresa_crm_id(id,nome,domain_key,site),projeto:projetos_crm!projeto_id(id,nome)")
        .eq("captador_user_id", id).order("created_at", { ascending: false }));
    }
    setAtribuicoes((novasAtribuicoes ?? []) as AtribuicaoRow[]);
  }

  if (loading) return <CaptadorSkeleton />;
  if (!captador) return <DetailNotFound title="Captador não encontrado" backHref="/captadores" backLabel="Captadores" />;

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <Link href="/captadores" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={14} /> Captadores
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <IdentityPickerPopup
                nome={captador.nome}
                tipo={captador.identidade_tipo ?? (captador.logo_url ? "logo" : "padrao")}
                valor={captador.identidade_valor}
                logoUrl={captador.identidade_logo_url ?? captador.logo_url}
                cor={captador.identidade_cor}
                iconOptions={CAPTADOR_ICON_OPTIONS}
                saving={identitySaving}
                title="Identidade do captador"
                onSave={saveIdentity}
                onLogoFile={handleIdentityLogo}
                triggerLabel="Alterar identidade do captador"
              />
              <div className="min-w-0">
                {captador.user_id && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[0.5625rem] font-bold uppercase tracking-wide text-white" style={{ background: "#2E8932" }}>
                      <Check size={9} /> Workspace
                    </span>
                  </div>
                )}
                <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[2.375rem]">{captador.nome}</h1>
                <p className="mt-2 text-sm text-black/50">{captador.agencia || "Agência independente"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {captador.email && (
                <DetailHeaderAction label="Enviar e-mail" icon={Mail} href={`mailto:${captador.email}`} />
              )}
              <DetailHeaderAction label={workspace ? "Configurar workspace" : "Criar workspace"} icon={Briefcase} onClick={() => setShowWorkspaceModal(true)} />
              <DetailHeaderAction label="Editar" icon={Pencil} onClick={() => setShowEditModal(true)} />
            </div>
          </div>
        </div>
      </header>

      <DetailTabs
        ariaLabel="Seções do captador"
        activeTab={pageTab}
        onChange={value => setPageTab(value as PageTab)}
        tabs={[
          { id: "overview", label: "Visão geral", icon: UserCheck },
          ...(workspace ? [{ id: "workspace", label: "Trabalho conjunto", icon: MessageCircle, count: pedidosWorkspace.filter(p => p.status === "pendente").length }] : []),
          { id: "negociacoes", label: "Negociações", icon: Building2, count: negociacoes.length },
          { id: "inscricoes", label: "Inscrições", icon: FileStack, count: inscricoes.length },
          { id: "atribuicoes", label: "Atribuições", icon: Shield, count: atribuicoes.length },
        ]}
      />

      <DetailPageContent>
        {pageTab === "workspace" && workspace ? (
          <div className="space-y-8">
            <div>
              <h2 className="text-[1.1875rem] font-semibold tracking-tight text-[#171717]">Oportunidades com {captador.nome}</h2>
              <p className="mt-1 text-[0.8125rem] text-black/50">Pedidos, respostas e acompanhamento compartilhado.</p>
              {erroWorkspace && <p role="alert" className="mt-2 text-[0.75rem] text-[#B64545]">Não foi possível carregar os pedidos: {erroWorkspace}</p>}
            </div>
            <div className="grid gap-8 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
              <div>
                <h3 className="mb-3 text-[0.75rem] font-semibold text-black/70">Pedidos <span className="font-normal tabular-nums text-black/40">{pedidosWorkspace.length}</span></h3>
                {pedidosWorkspace.length === 0 ? <p className="text-[0.75rem] text-black/45">Ainda não há pedidos. O captador pode iniciar um pela própria área.</p> : (
                  <div className="divide-y divide-black/[.08] border-y border-black/[.08]">
                    {pedidosWorkspace.map(p => (
                      <button key={p.id} type="button" onClick={() => { setPedidoSelecionado(p.id); setAtribuicaoSelecionada(null); }}
                        className={`w-full py-3 text-left transition hover:text-[#5F4AA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8] ${pedidoSelecionado === p.id ? "text-[#5F4AA8]" : "text-black/80"}`}>
                        <span className="block truncate text-[0.8125rem] font-medium">{p.oportunidade_titulo || p.nome_busca}</span>
                        <span className="mt-1 block text-[0.6875rem] text-black/40">{p.oportunidade_etiqueta?.nome ?? PEDIDO_TIPO_LABEL[p.tipo]} · {p.nome_busca} · {p.status === "pendente" ? "Pede sua decisão" : p.status === "aguardando_captador" ? "Aguardando captador" : p.status === "aprovado" ? "Aprovado" : "Recusado"}</span>
                      </button>
                    ))}
                  </div>
                )}
                <h3 className="mb-3 mt-7 text-[0.75rem] font-semibold text-black/70">Em andamento <span className="font-normal tabular-nums text-black/40">{atribuicoes.length}</span></h3>
                <div className="divide-y divide-black/[.08] border-y border-black/[.08]">
                  {atribuicoes.map(a => {
                    const tipoFluxo = pedidosWorkspace.find(p => p.atribuicao_id === a.id)?.tipo;
                    const lista = tipoFluxo === "negociacoes" ? etiquetas : tipoFluxo === "inscricoes" ? etiquetasInscricao : [];
                    const sugestao = a.workspace_etapa ? (lista.find(item => item.key === a.workspace_etapa)?.label ?? a.workspace_etapa) : null;
                    return <button key={a.id} type="button" onClick={() => { setAtribuicaoSelecionada(a.id); setPedidoSelecionado(null); }}
                      className={`block w-full py-3 text-left text-[0.8125rem] transition hover:text-[#5F4AA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8] ${atribuicaoSelecionada === a.id ? "font-semibold text-[#5F4AA8]" : "text-black/75"}`}>
                      <span className="block">{a.empresa_crm?.nome ?? "Empresa"}</span>
                      {sugestao && <span className="mt-0.5 inline-flex items-center gap-1 text-[0.6875rem] font-normal text-black/55"><Lightbulb size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40"/>Sugestão do captador: {sugestao}</span>}
                    </button>;
                  })}
                  {atribuicoes.length === 0 && <p className="py-3 text-[0.75rem] text-black/45">Nenhuma atribuição ainda.</p>}
                </div>
              </div>
              <div className="min-h-72 border-l border-black/[.08] pl-0 lg:pl-7">
                {pedidoSelecionado ? (
                  <PedidoConversa key={pedidoSelecionado} pedido={pedidosWorkspace.find(p => p.id === pedidoSelecionado)!} isGestor onChange={() => void atualizarPedidos()}
                    onOpenAtribuicao={atribuicaoId => { setPedidoSelecionado(null); setAtribuicaoSelecionada(atribuicaoId); }} />
                ) : atribuicaoSelecionada ? (
                  <AtribuicaoConversa key={atribuicaoSelecionada} id={atribuicaoSelecionada} organizationId={captador.organization_id} isGestor
                    pedido={pedidosWorkspace.find(p => p.atribuicao_id === atribuicaoSelecionada)} />
                ) : <div className="py-8 text-center text-[0.8125rem] text-black/40">Selecione um pedido ou uma oportunidade para acompanhar a conversa.</div>}
              </div>
            </div>
          </div>
        ) : pageTab === "negociacoes" ? (
          <NegotiationsTable rows={negociacoes} />
        ) : pageTab === "inscricoes" ? (
          <InscricoesTable rows={inscricoes} />
        ) : pageTab === "atribuicoes" ? (
          <AtribuicoesList rows={atribuicoes} />
        ) : (
          <div className="space-y-5">
            {pedidosWorkspace.some(p => p.status === "pendente") && (
              <button type="button" onClick={() => { setPageTab("workspace"); setPedidoSelecionado(pedidosWorkspace.find(p => p.status === "pendente")?.id ?? null); }}
                className="flex w-full items-center justify-between gap-3 border-y border-[#B07A14]/25 py-3 text-left transition hover:text-[#5F4AA8]">
                <span className="text-[0.8125rem] font-semibold">{pedidosWorkspace.filter(p => p.status === "pendente").length} pedido(s) aguardando sua decisão</span>
                <span className="text-[0.75rem] font-medium">Abrir conversa →</span>
              </button>
            )}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div className="w-full shrink-0 lg:w-[20rem]">
                <CaptadorRelationshipScorecard captadorId={captador.id} organizationId={captador.organization_id} />
              </div>
              <div className="min-w-0 flex-1">
                <CaptadorOverview data={overview} />
              </div>
            </div>
          </div>
        )}
      </DetailPageContent>

      {showEditModal && (
        <AdicionarCaptadorModal
          open
          editData={{
            id: captador.id,
            nome: captador.nome,
            prioridade: captador.prioridade,
            logo_url: captador.logo_url,
            identidade_tipo: captador.identidade_tipo,
            identidade_valor: captador.identidade_valor,
            identidade_logo_url: captador.identidade_logo_url,
            identidade_cor: captador.identidade_cor,
            email: captador.email,
            agencia: captador.agencia,
          }}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); void fetchData(); }}
        />
      )}
      {showWorkspaceModal && (
        <CaptadorWorkspaceModal
          captadorId={captador.id}
          organizationId={captador.organization_id}
          captadorEmail={captador.email}
          workspaceId={workspace?.id ?? null}
          escoposIniciais={workspace?.escopos ?? null}
          onClose={() => setShowWorkspaceModal(false)}
          onSaved={() => void fetchData()}
        />
      )}
    </div>
  );
}

function AtribuicoesList({ rows }: { rows: AtribuicaoRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded border bg-white px-5 py-12 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <Shield size={22} className="mx-auto text-black/15" />
        <p className="mt-3 text-sm font-medium text-black/35">Nenhuma atribuição registrada</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {rows.map(a => {
        const st = STATUS_ATRIB[a.status] ?? { label: a.status, color: "rgba(13,13,13,.4)" };
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2.5">
              <CompanyLogo
                nome={a.empresa_crm?.nome ?? "Empresa"}
                domain={a.empresa_crm?.domain_key}
                site={a.empresa_crm?.site}
                size={32}
                className="flex-shrink-0"
              />
              <div className="min-w-0">
                {a.empresa_crm ? (
                  <span className="block truncate text-[0.8125rem] font-semibold text-[#0D0D0D]">
                    {a.empresa_crm.nome}
                  </span>
                ) : (
                  <span className="text-[0.8125rem] font-semibold text-black/40">—</span>
                )}
                <p className="truncate text-[0.6875rem] text-black/35">{a.projeto?.nome ?? "Todos os projetos"} · {EXC_LABEL[a.tipo] ?? a.tipo}</p>
              </div>
            </div>
            <span className="shrink-0 rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: st.color + "47", color: st.color }}>
              {st.label}
            </span>
          </>
        );

        return a.empresa_crm ? (
          <Link
            key={a.id}
            href={`/empresas-crm/${a.empresa_crm.id}`}
            aria-label={`Abrir empresa ${a.empresa_crm.nome}`}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 text-inherit transition last:border-b-0 hover:bg-black/[.018] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
            style={{ borderColor: "rgba(13,13,13,.06)" }}
          >
            {content}
          </Link>
        ) : (
          <div key={a.id} className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function CaptadorSkeleton() {
  return (
    <div className="animate-pulse px-4 py-6 md:px-8">
      <div className="h-4 w-24 rounded bg-black/8" />
      <div className="mt-6 h-16 w-full max-w-2xl rounded bg-black/8" />
      <div className="mt-8 h-12 rounded bg-black/8" />
      <div className="mt-5 h-96 rounded bg-black/8" />
    </div>
  );
}

