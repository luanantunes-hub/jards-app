"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPCs do workspace ainda não constam nos tipos gerados */

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Building2, MessageCircle, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationName } from "@/contexts/OrganizationContext";
import { CompanyLogo } from "@/components/CompanyLogo";
import { DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { AtribuicaoConversa, PedidoConversa, listarPedidosWorkspace, type WorkspacePedido } from "@/components/captadores/WorkspaceConversation";
import { WORKSPACE_ETAPAS, type WorkspaceEtapa } from "@/components/captadores/WorkspaceStages";

type Atribuicao = {
  id: string;
  status: string;
  organizationId: string;
  empresaNome: string;
  empresaSite?: string | null;
  empresaDomainKey?: string | null;
  workspaceEtapa?: WorkspaceEtapa;
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

function Campo({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 border-b border-black/[.07] py-3 last:border-b-0">
    <dt className="text-[12px] text-black/45">{label}</dt>
    <dd className="max-w-[65%] text-right text-[12px] font-medium text-black/75">{value}</dd>
  </div>;
}

export default function CaptadorOportunidadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const organizationId = useOrganizationId();
  const organizationName = useOrganizationName() || "Organização";
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState<WorkspacePedido | null>(null);
  const [atribuicao, setAtribuicao] = useState<Atribuicao | null>(null);
  const [proximo, setProximo] = useState<ProximoPasso | null>(null);
  const [coordenacao, setCoordenacao] = useState<Coordenacao | null>(null);
  const [tab, setTab] = useState("resumo");
  const [movendoEtapa, setMovendoEtapa] = useState(false);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  async function moverEtapa(etapa: WorkspaceEtapa) {
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
  if (!pedido && !atribuicao) return <DetailPageContent><Link href="/workspace-captador" className="inline-flex items-center gap-2 text-[12px] text-black/50 hover:text-black"><ArrowLeft size={14}/>Oportunidades</Link><p className="mt-8 text-[14px] text-black/65">Oportunidade não encontrada.</p></DetailPageContent>;

  const empresaNome = atribuicao?.empresaNome || pedido?.nome_busca || "Organização";
  const site = atribuicao?.empresaSite || pedido?.empresa_site || atribuicao?.empresaDomainKey || null;
  const titulo = pedido?.oportunidade_titulo || null;
  const tipo = pedido?.oportunidade_etiqueta?.nome || (pedido ? TIPO_LEGADO[pedido.tipo] : "Oportunidade");
  const status = atribuicao?.status === "ativa" ? "Em andamento" : pedido?.status === "pendente" ? `Aguardando ${organizationName}`
    : pedido?.status === "aguardando_captador" ? "Sua resposta" : pedido?.status === "recusado" ? "Recusada"
    : atribuicao?.status || "Aprovada";

  return <div className="min-h-full">
    <header className="border-b border-black/[.06] bg-white">
      <div className="mx-auto max-w-[1280px] px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
        <Link href="/workspace-captador" className="mb-7 inline-flex items-center gap-2 text-[12px] font-medium text-black/40 transition hover:text-black/70"><ArrowLeft size={14}/>Oportunidades</Link>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-center gap-4">
            <CompanyLogo nome={empresaNome} domain={atribuicao?.empresaDomainKey} site={site} size={56} className="shrink-0 border border-black/[.07]"/>
            <div className="min-w-0">
              <p className="mb-1.5 text-[12px] text-black/45">{tipo} · {organizationName}</p>
              <h1 className="max-w-4xl text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[38px]">{empresaNome}</h1>
              {titulo && titulo !== empresaNome && <p className="mt-2 text-[13px] text-black/55">{titulo}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 sm:pt-2">
            <span className="rounded border border-black/[.12] px-3 py-2 text-[12px] font-medium text-black/70">{status}</span>
            {atribuicao?.status === "ativa" && <button type="button" onClick={() => setTab("acompanhamento")} className="rounded border border-[#5F4AA8] px-3 py-2 text-[12px] font-medium text-[#5F4AA8] transition hover:bg-[#5F4AA8]/[.06]">Pedir à organização</button>}
            {site && <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir site de ${empresaNome}`} className="flex h-9 w-9 items-center justify-center rounded border border-black/[.12] text-black/50 transition hover:border-black/30 hover:text-black"><ArrowUpRight size={15}/></a>}
          </div>
        </div>
      </div>
    </header>

    <DetailTabs ariaLabel="Seções da oportunidade" activeTab={tab} onChange={setTab} tabs={[
      { id: "resumo", label: "Resumo", icon: Target },
      { id: "acompanhamento", label: atribuicao ? "Pedidos e conversa" : "Conversa", icon: MessageCircle },
    ]}/>

    <DetailPageContent>
      {tab === "resumo" && <div className="space-y-6">
        {atribuicao?.status === "ativa" && <section className="rounded border border-black/[.08] bg-white px-5 py-4">
          <h2 className="mb-3 text-[12px] font-semibold text-black/60">Andamento</h2>
          <div className="flex flex-wrap gap-2">{WORKSPACE_ETAPAS.map(etapa => <button key={etapa.id} type="button" disabled={movendoEtapa} onClick={() => void moverEtapa(etapa.id)} aria-pressed={(atribuicao.workspaceEtapa ?? "a_iniciar") === etapa.id}
            className={`rounded border px-3 py-2 text-[12px] font-medium transition disabled:opacity-50 ${(atribuicao.workspaceEtapa ?? "a_iniciar") === etapa.id ? "border-[#5F4AA8] bg-[#5F4AA8] text-white" : "border-black/[.12] text-black/55 hover:border-black/30 hover:text-black"}`}>{etapa.label}</button>)}</div>
          {erroEtapa && <p role="alert" className="mt-2 text-[12px] text-[#B64545]">{erroEtapa}</p>}
        </section>}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded border border-black/[.08] bg-black/[.08] lg:grid-cols-4">
          {[
            ["Status", status], ["Tipo", tipo], ["Organização", organizationName], ["Entrada", dataCurta(pedido?.created_at)],
          ].map(([label, value]) => <div key={label} className="min-h-24 bg-white px-5 py-4"><p className="text-[11px] font-medium text-black/40">{label}</p><p className="mt-3 line-clamp-2 text-[17px] font-semibold leading-tight tracking-tight text-[#171717]">{value}</p></div>)}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <section className="rounded border border-black/[.08] bg-white p-5">
              <div className="flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold text-black/80">Próximo passo</h2><button type="button" onClick={() => setTab("acompanhamento")} className="text-[12px] font-medium text-[#5F4AA8] hover:underline">{atribuicao ? "Abrir acompanhamento" : "Abrir conversa"}</button></div>
              <p className="mt-4 text-[14px] font-medium text-black/75">{proximo?.texto || (pedido?.status === "pendente" ? "Aguardando avaliação" : pedido?.status === "aguardando_captador" ? "Responder à organização" : "—")}</p>
              {proximo?.data && <p className="mt-1 text-[12px] text-black/45">Até {dataCurta(proximo.data)}</p>}
            </section>
            {(coordenacao?.situacao || pedido?.mensagem) && <section className="rounded border border-black/[.08] bg-white p-5"><h2 className="text-[15px] font-semibold text-black/80">{coordenacao?.situacao ? "Situação atual" : "Contexto"}</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-black/65">{coordenacao?.situacao || pedido?.mensagem}</p></section>}
          </div>
          <aside className="self-start rounded border border-black/[.08] bg-white p-5">
            <div className="flex items-center gap-2"><Building2 size={14} className="text-black/35"/><h2 className="text-[15px] font-semibold text-black/80">Dados da oportunidade</h2></div>
            <dl className="mt-3"><Campo label="Empresa" value={empresaNome}/><Campo label="Oportunidade" value={titulo || "—"}/><Campo label="Tipo" value={tipo}/><Campo label="Site" value={site ? <a href={site.startsWith("http") ? site : `https://${site}`} target="_blank" rel="noopener noreferrer" className="break-all text-[#5F4AA8] hover:underline">{site.replace(/^https?:\/\//, "")}</a> : "—"}/></dl>
          </aside>
        </div>
      </div>}
      {tab === "acompanhamento" && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded border border-black/[.08] bg-white p-5">
          {atribuicao ? <AtribuicaoConversa id={atribuicao.id} organizationId={atribuicao.organizationId} pedido={pedido} onSent={() => void carregar()}/>
            : pedido && <PedidoConversa pedido={pedido} isGestor={false} onChange={() => void carregar()} onOpenAtribuicao={atribuicaoId => router.push(`/workspace-captador/${atribuicaoId}`)}/>}
        </section>
        <aside className="self-start rounded border border-black/[.08] bg-white p-5"><h2 className="text-[15px] font-semibold text-black/80">{empresaNome}</h2><dl className="mt-3"><Campo label="Tipo" value={tipo}/><Campo label="Status" value={status}/><Campo label="Organização" value={organizationName}/></dl></aside>
      </div>}
    </DetailPageContent>
  </div>;
}
