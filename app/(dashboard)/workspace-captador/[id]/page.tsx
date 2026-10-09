"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPCs do workspace ainda não constam nos tipos gerados */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MessageCircle, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationName } from "@/contexts/OrganizationContext";
import { CompanyLogo } from "@/components/CompanyLogo";
import { DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { AtribuicaoConversa, PedidoConversa, listarPedidosWorkspace, type WorkspacePedido } from "@/components/captadores/WorkspaceConversation";
import { useEtiquetas } from "@/contexts/EtiquetasContext";

type Atribuicao = {
  id: string;
  status: string;
  organizationId: string;
  empresaNome: string;
  empresaSite?: string | null;
  empresaDomainKey?: string | null;
  workspaceEtapa?: string | null;
};
type ProximoPasso = { texto: string | null; data: string | null; aguardando: "captador" | "gestor" | null };
type Coordenacao = { situacao: string | null; resultado: string | null };

const TIPO_LEGADO: Record<WorkspacePedido["tipo"], string> = {
  empresas: "Relacionamento", negociacoes: "Negociação", inscricoes: "Inscrição",
};

function dataCurta(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CaptadorOportunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const organizationId = useOrganizationId();
  const organizationName = useOrganizationName() || "Organização";
  const supabase = useMemo(() => createClient(), []);
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState<WorkspacePedido | null>(null);
  const [atribuicao, setAtribuicao] = useState<Atribuicao | null>(null);
  const [proximo, setProximo] = useState<ProximoPasso | null>(null);
  const [coordenacao, setCoordenacao] = useState<Coordenacao | null>(null);
  const [tab, setTab] = useState("resumo");
  const [abrirPedidoTrigger, setAbrirPedidoTrigger] = useState(0);
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  async function moverEtapa(etapa: string) {
    if (!atribuicao || movendoEtapa) return;
    setMovendoEtapa(true);
    setErroEtapa(null);
    const { error } = await (supabase as any).rpc("fn_workspace_definir_etapa", {
      p_atribuicao_id: atribuicao.id, p_etapa: etapa,
    });
    setMovendoEtapa(false);
    if (error) { setErroEtapa(error.message); return; }
    setAtribuicao(current => current ? { ...current, workspaceEtapa: etapa } : current);
  }

  const carregar = useCallback(async (mostrarLoading = false) => {
    if (!organizationId) return;
    if (mostrarLoading) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: captador } = await (supabase as any).from("captadores")
      .select("id").eq("organization_id", organizationId).eq("user_id", user.id).maybeSingle();
    if (!captador) { setLoading(false); return; }
    const { data: workspace } = await (supabase as any).from("captador_workspaces")
      .select("id").eq("captador_id", captador.id).eq("organization_id", organizationId).maybeSingle();
    if (!workspace) { setLoading(false); return; }

    const [pedidosResult, atribuicoesResult] = await Promise.all([
      listarPedidosWorkspace(supabase, workspace.id),
      (supabase as any).rpc("fn_captador_minhas_atribuicoes", { p_workspace_id: workspace.id }),
    ]);
    const pedidos = pedidosResult.pedidos;
    const atribuicoes = (atribuicoesResult.data ?? []) as Atribuicao[];
    const selecionado = pedidos.find(item => item.id === id || item.atribuicao_id === id) ?? null;
    const atribuicaoAtual = atribuicoes.find(item => item.id === id || item.id === selecionado?.atribuicao_id) ?? null;
    setPedido(selecionado);
    setAtribuicao(atribuicaoAtual);

    if (atribuicaoAtual) {
      const [passo, estado] = await Promise.all([
        (supabase as any).rpc("fn_workspace_obter_proximo_passo", { p_atribuicao_id: atribuicaoAtual.id }),
        (supabase as any).rpc("fn_workspace_obter_coordenacao", { p_atribuicao_id: atribuicaoAtual.id }),
      ]);
      setProximo(passo.error ? null : passo.data as ProximoPasso);
      setCoordenacao(estado.error ? null : estado.data as Coordenacao);
    } else {
      setProximo(null);
      setCoordenacao(null);
    }
    setLoading(false);
  }, [id, organizationId, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void carregar(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [carregar]);

  if (loading) return <DetailPageContent><div className="space-y-5 animate-pulse"><div className="h-8 w-1/3 rounded bg-black/[.07]"/><div className="h-16 rounded bg-black/[.04]"/><div className="h-40 rounded bg-black/[.04]"/></div></DetailPageContent>;
  if (!pedido && !atribuicao) return <DetailPageContent><Link href="/workspace-captador" className="inline-flex items-center gap-2 text-[0.75rem] text-black/50 hover:text-[#282525]"><ArrowLeft size={14}/>Oportunidades</Link><p className="mt-8 text-[0.875rem] text-black/65">Oportunidade não encontrada.</p></DetailPageContent>;

  const empresaNome = atribuicao?.empresaNome || pedido?.nome_busca || "Organização";
  const site = atribuicao?.empresaSite || pedido?.empresa_site || atribuicao?.empresaDomainKey || null;
  const titulo = pedido?.oportunidade_titulo || null;
  const tipo = pedido?.oportunidade_etiqueta?.nome || (pedido ? TIPO_LEGADO[pedido.tipo] : "Oportunidade");
  const status = atribuicao?.status === "ativa" ? "Em andamento" : pedido?.status === "pendente" ? `Aguardando ${organizationName}`
    : pedido?.status === "aguardando_captador" ? "Sua resposta" : pedido?.status === "recusado" ? "Recusada"
    : atribuicao?.status || "Aprovada";

  return <div className="min-h-full">
    <header className="border-b border-black/[.06] bg-white">
      <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
        <Link href="/workspace-captador" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/70"><ArrowLeft size={14}/>Oportunidades</Link>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyLogo nome={empresaNome} domain={atribuicao?.empresaDomainKey} site={site} size={56} className="shrink-0 border border-black/[.07]"/>
            <div className="min-w-0">
              <h1 className="max-w-4xl text-[2rem] font-semibold leading-[1.04] tracking-[-.045em] text-[#282525] sm:text-[2.375rem]">{empresaNome}</h1>
              {titulo && titulo !== empresaNome && <p className="mt-2 text-[0.8125rem] text-black/55">{titulo}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:pt-2">
            {atribuicao?.status !== "ativa" && <span className="rounded border border-black/[.12] px-3 py-2 text-[0.75rem] font-medium text-black/70">{status}</span>}
            {atribuicao?.status === "ativa" && <button type="button" onClick={() => { setTab("acompanhamento"); setAbrirPedidoTrigger(t => t + 1); }} className="rounded border border-black/[.15] px-3 py-2 text-[0.75rem] font-medium text-black/65 transition hover:border-black/30 hover:text-[#282525]">Solicitar à organização</button>}
            {site && <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir site de ${empresaNome}`} className="flex h-9 w-9 items-center justify-center rounded border border-black/[.12] text-black/50 transition hover:border-black/30 hover:text-[#282525]"><ArrowUpRight size={15}/></a>}
          </div>
        </div>
      </div>
    </header>

    <DetailTabs ariaLabel="Seções da oportunidade" activeTab={tab} onChange={setTab} tabs={[
      { id: "resumo", label: "Resumo", icon: Target },
      { id: "acompanhamento", label: atribuicao ? "Solicitações" : "Conversa", icon: MessageCircle },
    ]}/>

    <DetailPageContent>
      {tab === "resumo" && <div className="space-y-6">
        {atribuicao?.status === "ativa" && (pedido?.tipo === "negociacoes" || pedido?.tipo === "inscricoes") && <section className="rounded border border-black/[.08] bg-white px-5 py-4">
          <h2 className="mb-3 text-[0.75rem] font-semibold text-black/60">Andamento <span className="font-normal text-black/35">— sugestão para {organizationName}</span></h2>
          <div className="flex flex-wrap gap-2">{(pedido.tipo === "negociacoes" ? etiquetas : etiquetasInscricao).map(etapa => <button key={etapa.key} type="button" disabled={movendoEtapa} onClick={() => void moverEtapa(etapa.key)} aria-pressed={atribuicao.workspaceEtapa === etapa.key}
            className={`rounded border px-3 py-2 text-[0.75rem] font-medium transition disabled:opacity-50 ${atribuicao.workspaceEtapa === etapa.key ? "border-[#171717] bg-[#171717] text-white" : "border-black/[.12] text-black/55 hover:border-black/30 hover:text-[#282525]"}`}>{etapa.label}</button>)}</div>
          {erroEtapa && <p role="alert" className="mt-2 text-[0.75rem] text-[#B64545]">{erroEtapa}</p>}
        </section>}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded border border-black/[.08] bg-black/[.08] lg:grid-cols-4">
          {[
            ["Status", status], ["Tipo", tipo], ["Organização", organizationName], ["Entrada", dataCurta(pedido?.created_at)],
          ].map(([label, value]) => <div key={label} className="min-h-24 bg-white px-5 py-4"><p className="text-[0.6875rem] font-medium text-black/40">{label}</p><p className="mt-3 line-clamp-2 text-[1.0625rem] font-semibold leading-tight tracking-tight text-[#171717]">{value}</p></div>)}
        </section>

        <div className="space-y-5">
          <section className="rounded border border-black/[.08] bg-white p-5">
            <h2 className="text-[0.9375rem] font-semibold text-black/80">Próximo passo</h2>
            <p className="mt-4 text-[0.875rem] font-medium text-black/75">{proximo?.texto || (pedido?.status === "pendente" ? "Aguardando avaliação" : pedido?.status === "aguardando_captador" ? "Responder à organização" : "—")}</p>
            {proximo?.data && <p className="mt-1 text-[0.75rem] text-black/45">Até {dataCurta(proximo.data)}</p>}
          </section>
          {(coordenacao?.situacao || pedido?.mensagem) && <section className="rounded border border-black/[.08] bg-white p-5"><h2 className="text-[0.9375rem] font-semibold text-black/80">{coordenacao?.situacao ? "Situação atual" : "Contexto"}</h2><p className="mt-3 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-black/65">{coordenacao?.situacao || pedido?.mensagem}</p></section>}
        </div>
      </div>}
      {tab === "acompanhamento" && <section className="rounded border border-black/[.08] bg-white p-5">
        {atribuicao ? <AtribuicaoConversa id={atribuicao.id} organizationId={atribuicao.organizationId} pedido={pedido} onSent={() => void carregar()} abrirPedidoTrigger={abrirPedidoTrigger}/>
          : pedido && <PedidoConversa pedido={pedido} isGestor={false} onChange={() => void carregar()} onOpenAtribuicao={atribuicaoId => router.push(`/workspace-captador/${atribuicaoId}`)}/>}
      </section>}
    </DetailPageContent>
  </div>;
}
