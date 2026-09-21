"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- RPCs experimentais ainda não constam nos tipos gerados */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Plus, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationName } from "@/contexts/OrganizationContext";
import { DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { TopSheet } from "@/components/ui/TopSheet";
import { KanbanBoard, KanbanColumn, KanbanCard, KanbanEmpty } from "@/components/kanban/KanbanPrimitives";
import { listarPedidosWorkspace, type WorkspacePedido } from "@/components/captadores/WorkspaceConversation";
import { useOpportunityLabels } from "@/components/captadores/OpportunityLabels";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useEtiquetas, type Etiqueta } from "@/contexts/EtiquetasContext";

type EscopoTipo = "empresas" | "negociacoes" | "inscricoes";
type EscopoModo = "pedido" | "consulta" | "ver_tudo";
type Escopo = { tipo: EscopoTipo; habilitado: boolean; modo: EscopoModo };
type PedidoStatus = WorkspacePedido["status"];
type Pedido = WorkspacePedido;

const TIPO_LABEL: Record<EscopoTipo, string> = { empresas: "Relacionamento", negociacoes: "Negociação", inscricoes: "Edital" };
const rotuloOportunidade = (pedido: Pedido) => pedido.oportunidade_etiqueta?.nome ?? TIPO_LABEL[pedido.tipo];

const STATUS_PEDIDO: Record<PedidoStatus, { label: string; cor: string; fundo: string }> = {
  pendente: { label: "Pendente", cor: "#B07A14", fundo: "#B07A1414" },
  aguardando_captador: { label: "Responder", cor: "#5F4AA8", fundo: "#5F4AA814" },
  aprovado: { label: "Aprovado", cor: "#2E8932", fundo: "#2E893214" },
  recusado: { label: "Recusado", cor: "#D94E4E", fundo: "#D94E4E14" },
};

type LinhaEmpresa = { id: string; nome: string; status: string | null };
type LinhaCaptacao = { id: string; titulo: string; status: string; empresaNome: string; atualizadoEm: string };
type AtribuicaoLinha = { id: string; status: string; organizationId: string; empresaNome: string; empresaSite?: string | null; empresaDomainKey?: string | null; workspaceEtapa?: string | null };

// resultado negativo = precisa de atenção; resultado positivo = concluída, fica discreta.
// tudo que não é nem um nem outro (em negociação, aguardando etc.) é "em andamento".
const NEGOCIACAO_NEGATIVO = new Set(["recusado"]);
const NEGOCIACAO_POSITIVO = new Set(["aprovado"]);
const INSCRICAO_NEGATIVO = new Set(["reprovado", "cancelado"]);
const INSCRICAO_POSITIVO = new Set(["aprovado"]);

function diasParado(atualizadoEm: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(atualizadoEm).getTime()) / 86_400_000));
}

function normalizarSite(valor: string): string | null {
  if (!valor.trim()) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(valor.trim()) ? valor.trim() : `https://${valor.trim()}`);
    if (!(["http:", "https:"].includes(url.protocol)) || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function StatusPedidoBadge({ status }: { status: PedidoStatus }) {
  const organizationName = useOrganizationName() || "sua organização";
  const cfg = STATUS_PEDIDO[status];
  return <span className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: cfg.cor, background: cfg.fundo }}>{status === "aguardando_captador" ? `Responder a ${organizationName}` : cfg.label}</span>;
}

function ListaCaptacaoOrganizada({ linhas, vazio, negativos, positivos }: { linhas: LinhaCaptacao[]; vazio: string; negativos: Set<string>; positivos: Set<string> }) {
  if (linhas.length === 0) return <p className="text-[13px] text-black/40">{vazio}</p>;

  const atencao = linhas.filter(l => negativos.has(l.status));
  const concluidas = linhas.filter(l => positivos.has(l.status));
  const andamento = linhas.filter(l => !negativos.has(l.status) && !positivos.has(l.status));

  return (
    <div className="space-y-6">
      {atencao.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-[#B07A14]" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#B07A14]">Precisa de atenção</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {atencao.map(linha => (
              <div key={linha.id} className="rounded border border-[#B07A14]/25 bg-[#B07A14]/[.06] p-3">
                <p className="truncate text-[13px] font-medium text-black/80">{linha.titulo}</p>
                <p className="mt-1 truncate text-[11px] text-black/45">{linha.empresaNome} · parada há {diasParado(linha.atualizadoEm)} dias</p>
                <span className="mt-2 inline-block rounded bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#B07A14]">{linha.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {andamento.length > 0 && (
        <div>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-black/30">Em andamento</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {andamento.map(linha => (
              <div key={linha.id} className="rounded border border-black/[.08] p-3">
                <p className="truncate text-[13px] font-medium text-black/80">{linha.titulo}</p>
                <p className="mt-1 truncate text-[11px] text-black/40">{linha.empresaNome}</p>
                <span className="mt-2 inline-block rounded bg-black/[.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/50">{linha.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {concluidas.length > 0 && (
        <div className="opacity-60">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-black/30">Concluídas</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {concluidas.map(linha => (
              <div key={linha.id} className="rounded border border-black/[.08] p-3">
                <p className="truncate text-[13px] text-black/70">{linha.titulo}</p>
                <p className="mt-1 truncate text-[11px] text-black/40">{linha.empresaNome}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusAtribuicaoBadge({ status }: { status: string }) {
  const ativa = status === "ativa";
  return (
    <span
      className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
      style={ativa ? { color: "#2E8932", background: "#2E893214" } : { color: "rgba(0,0,0,.5)", background: "rgba(0,0,0,.04)" }}
    >
      {status}
    </span>
  );
}

function OportunidadeRow({ href, empresa, titulo, tipo, site, domain, trailing }: {
  href: string; empresa: string; titulo: string; tipo?: string; site?: string | null; domain?: string | null; trailing?: React.ReactNode;
}) {
  return <Link href={href} className="group flex min-h-18 items-center gap-3 border-b border-black/[.07] px-4 py-3 transition hover:bg-black/[.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8] last:border-b-0">
    <CompanyLogo nome={empresa} domain={domain} site={site} size={36} className="shrink-0 border border-black/[.07]"/>
    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-black/80">{titulo}</span><span className="mt-0.5 block truncate text-[11px] text-black/45">{empresa}{tipo ? ` · ${tipo}` : ""}</span></span>
    {trailing}<ChevronRight size={15} className="shrink-0 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black/55"/>
  </Link>;
}

function NovaOportunidadeSheet({ workspaceId, escopos, organizationId, onClose, onSaved }: {
  workspaceId: string;
  escopos: Escopo[];
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const organizationName = useOrganizationName() || "sua organização";
  const { labels } = useOpportunityLabels(organizationId);
  const [titulo, setTitulo] = useState("");
  const [nome, setNome] = useState("");
  const [site, setSite] = useState("");
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null);
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"criado" | "ocupado" | null>(null);
  const etiqueta = labels.find(e => e.id === etiquetaId);
  const tipo = etiqueta?.tipo_fluxo;
  const escopo = escopos.find(e => e.tipo === tipo && e.habilitado);
  const etiquetasDisponiveis = labels.filter(e => escopos.some(esc => esc.tipo === e.tipo_fluxo && esc.habilitado));
  const siteNormalizado = normalizarSite(site);

  async function enviar(close: () => void) {
    if (!titulo.trim() || !nome.trim() || !tipo || !escopo || (site.trim() && !siteNormalizado) || enviando) return;
    setEnviando(true);
    setErro(null);
    if (escopo.modo === "pedido") {
      const { error } = await (supabase as any).from("captador_workspace_pedidos").insert({
        workspace_id: workspaceId, tipo, nome_busca: nome.trim(),
        oportunidade_titulo: titulo.trim(), oportunidade_etiqueta_id: etiquetaId,
        empresa_site: siteNormalizado, mensagem: mensagem.trim() || null,
      });
      setEnviando(false);
      if (error) { setErro(error.message); return; }
      onSaved();
      close();
      return;
    }
    const { data, error } = await (supabase as any).rpc("fn_captador_consultar_oportunidade", {
      p_workspace_id: workspaceId, p_tipo: tipo, p_nome_busca: nome.trim(),
      p_titulo: titulo.trim(), p_etiqueta_id: etiquetaId, p_site: siteNormalizado,
      p_mensagem: mensagem.trim() || null,
    });
    setEnviando(false);
    if (error) { setErro(error.message); return; }
    if (!data?.livre) { setResultado("ocupado"); return; }
    setResultado("criado");
    onSaved();
  }

  return <TopSheet titulo="Nova oportunidade" onClose={onClose} footer={close => resultado ? (
    <button type="button" onClick={close} className="rounded bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white">Fechar</button>
  ) : <>
    <button type="button" onClick={close} className="text-[12px] text-black/50">Cancelar</button>
    <button type="button" onClick={() => void enviar(close)} disabled={enviando || titulo.trim().length < 2 || nome.trim().length < 2 || !etiqueta || !escopo || !!site.trim() && !siteNormalizado}
      className="inline-flex items-center gap-1.5 rounded bg-[#171717] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-black/75 disabled:opacity-40">
      <Send size={12} />{enviando ? "Enviando…" : escopo?.modo === "pedido" ? "Enviar para avaliação" : "Consultar e iniciar"}
    </button>
  </>}>
    {resultado ? <p className="text-[13px] text-black/70">{resultado === "criado" ? "A oportunidade entrou no seu trabalho." : "Esta organização já tem uma oportunidade em andamento."}</p> : <div className="space-y-4">
      <>
        <div><label htmlFor="oportunidade-titulo" className="mb-1.5 block text-[11px] font-semibold text-black/55">Qual é a oportunidade?</label>
          <input id="oportunidade-titulo" autoFocus value={titulo} maxLength={200} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Apoio ao projeto, edital 2026…" className="h-10 w-full rounded border border-black/[.15] px-3 text-[13px] outline-none focus:border-[#5F4AA8]" />
        </div>
        <div><label htmlFor="oportunidade-organizacao" className="mb-1.5 block text-[11px] font-semibold text-black/55">Empresa ou instituição relacionada</label>
          <input id="oportunidade-organizacao" value={nome} maxLength={200} onChange={e => setNome(e.target.value)} placeholder="Nome da organização" className="h-10 w-full rounded border border-black/[.15] px-3 text-[13px] outline-none focus:border-[#5F4AA8]" />
        </div>
        <div><label htmlFor="oportunidade-site" className="mb-1.5 block text-[11px] font-semibold text-black/55">Site da empresa ou instituição</label>
          <div className="flex items-center gap-3"><input id="oportunidade-site" type="url" value={site} maxLength={500} onChange={e => setSite(e.target.value)} placeholder="exemplo.com.br" className="h-10 min-w-0 flex-1 rounded border border-black/[.15] px-3 text-[13px] outline-none focus:border-[#5F4AA8]" />
            {siteNormalizado && <CompanyLogo nome={nome || "Organização"} site={siteNormalizado} size={38} className="shrink-0 border border-black/[.08]" />}</div>
          {site.trim() && !siteNormalizado && <p role="alert" className="mt-1 text-[11px] text-[#B64545]">Informe um endereço de site válido.</p>}
        </div>
        <div className="relative">
          <p className="mb-1.5 text-[11px] font-semibold text-black/55">Tipo de oportunidade</p>
          <button type="button" onClick={() => setMostrarEtiquetas(v => !v)} disabled={etiquetasDisponiveis.length === 0} aria-expanded={mostrarEtiquetas} className="flex h-10 w-full items-center justify-between rounded border border-black/[.15] px-3 text-left text-[12px] text-black/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5F4AA8] disabled:opacity-50">
            {etiqueta?.nome ?? (etiquetasDisponiveis.length ? "Selecione o tipo" : "Nenhum tipo disponível")} <ChevronRight size={13} className="rotate-90" />
          </button>
          {mostrarEtiquetas && <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-black/[.12] bg-white shadow-sm">
            {etiquetasDisponiveis.map(label => <button type="button" key={label.id} onClick={() => { setEtiquetaId(label.id); setMostrarEtiquetas(false); }} className="block w-full px-3 py-2 text-left text-[12px] text-black/70 hover:bg-black/[.04]">{label.nome}</button>)}
          </div>}
        </div>
        <div><label htmlFor="oportunidade-contexto" className="mb-1.5 block text-[11px] font-semibold text-black/55">Contexto para {organizationName} · opcional</label>
          <textarea id="oportunidade-contexto" value={mensagem} onChange={e => setMensagem(e.target.value)} maxLength={4000} rows={3} placeholder="O que a organização precisa saber?" className="w-full resize-none rounded border border-black/[.15] px-3 py-2 text-[13px] outline-none focus:border-[#5F4AA8]" />
        </div>
      </>
      {erro && <p role="alert" className="text-[11px] text-[#B64545]">{erro}</p>}
    </div>}
  </TopSheet>;
}

function FunilKanban({ titulo, etapas, itens, pedidos, draggingId, setDraggingId, overEtapa, setOverEtapa, moverEtapa, router }: {
  titulo: string;
  etapas: Etiqueta[];
  itens: AtribuicaoLinha[];
  pedidos: Pedido[];
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  overEtapa: string | null;
  setOverEtapa: (etapa: string | null) => void;
  moverEtapa: (id: string, etapa: string) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (etapas.length === 0) return null;
  const chaveEfetiva = (item: AtribuicaoLinha) => item.workspaceEtapa ?? etapas[0].key;
  return <div>
    <h3 className="mb-3 text-[12px] font-semibold text-black/70">{titulo} <span className="font-normal tabular-nums text-black/40">{itens.length}</span></h3>
    <KanbanBoard>
      {etapas.map((etapa, indice) => {
        const emEtapa = itens.filter(item => chaveEfetiva(item) === etapa.key);
        return <KanbanColumn key={etapa.key} label={etapa.label} count={emEtapa.length} accent={etapa.cor} iconName={etapa.icone}
          active={overEtapa === etapa.key && Boolean(draggingId)}
          onDragOver={event => { event.preventDefault(); setOverEtapa(etapa.key); }}
          onDragLeave={() => setOverEtapa(null)}
          onDrop={event => {
            event.preventDefault();
            const id = draggingId;
            setDraggingId(null); setOverEtapa(null);
            const item = itens.find(candidate => candidate.id === id);
            if (id && item && chaveEfetiva(item) !== etapa.key) moverEtapa(id, etapa.key);
          }}
        >
          {emEtapa.length === 0 ? <KanbanEmpty label="Nenhuma oportunidade." /> : emEtapa.map(item => {
            const pedido = pedidos.find(p => p.atribuicao_id === item.id);
            return <KanbanCard key={item.id} draggable dragging={draggingId === item.id}
              onClick={() => router.push(`/workspace-captador/${item.id}`)}
              onDragStart={() => setDraggingId(item.id)} onDragEnd={() => { setDraggingId(null); setOverEtapa(null); }}>
              <div className="flex items-center gap-2.5">
                <CompanyLogo nome={item.empresaNome} domain={item.empresaDomainKey} site={item.empresaSite || pedido?.empresa_site} size={32} className="shrink-0 border border-black/[.07]"/>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-black/80">{pedido?.oportunidade_titulo || item.empresaNome}</p>
                  <p className="mt-0.5 truncate text-[11px] text-black/45">{item.empresaNome}</p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-black/[.06] pt-2">
                <button type="button" disabled={indice === 0} onClick={event => { event.stopPropagation(); moverEtapa(item.id, etapas[indice - 1].key); }} className="text-[11px] font-medium text-black/45 hover:text-black disabled:invisible">← Voltar</button>
                <button type="button" disabled={indice === etapas.length - 1} onClick={event => { event.stopPropagation(); moverEtapa(item.id, etapas[indice + 1].key); }} className="text-[11px] font-medium text-[#5F4AA8] hover:underline disabled:invisible">Avançar →</button>
              </div>
            </KanbanCard>;
          })}
        </KanbanColumn>;
      })}
    </KanbanBoard>
  </div>;
}

export default function WorkspaceCaptadorPage() {
  const router = useRouter();
  const organizationId = useOrganizationId();
  const organizationName = useOrganizationName() || "sua organização";
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const [carregando, setCarregando] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [escopos, setEscopos] = useState<Escopo[] | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [erroPedidos, setErroPedidos] = useState<string | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [empresas, setEmpresas] = useState<LinhaEmpresa[]>([]);
  const [negociacoes, setNegociacoes] = useState<LinhaCaptacao[]>([]);
  const [inscricoes, setInscricoes] = useState<LinhaCaptacao[]>([]);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [aba, setAba] = useState("resumo");
  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoLinha[]>([]);
  const [acoesPendentes, setAcoesPendentes] = useState<{ id: string; atribuicao_id: string; descricao: string }[]>([]);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overEtapa, setOverEtapa] = useState<string | null>(null);

  async function moverEtapa(atribuicaoId: string, etapa: string) {
    const anterior = atribuicoes;
    setErroEtapa(null);
    setAtribuicoes(current => current.map(item => item.id === atribuicaoId ? { ...item, workspaceEtapa: etapa } : item));
    const { error } = await (createClient() as any).rpc("fn_workspace_definir_etapa", {
      p_atribuicao_id: atribuicaoId, p_etapa: etapa,
    });
    if (error) { setAtribuicoes(anterior); setErroEtapa(error.message); }
  }

  async function carregarAtribuicoes(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any).rpc("fn_captador_minhas_atribuicoes", { p_workspace_id: wsId });
    const novas = ((data ?? []) as any[]).map(r => ({
      id: r.id, status: r.status, organizationId: r.organizationId, empresaNome: r.empresaNome ?? "—",
      empresaSite: r.empresaSite ?? null, empresaDomainKey: r.empresaDomainKey ?? null,
      workspaceEtapa: r.workspaceEtapa ?? "a_iniciar",
    }));
    setAtribuicoes(novas);
    if (novas.length === 0) { setAcoesPendentes([]); return; }
    const { data: acoes } = await (supabase as any).from("workspace_acoes")
      .select("id, atribuicao_id, descricao").in("atribuicao_id", novas.map((r: AtribuicaoLinha) => r.id))
      .eq("destinatario", "captador").eq("status", "pendente");
    setAcoesPendentes((acoes ?? []) as typeof acoesPendentes);
  }

  async function carregarPedidos(wsId: string) {
    const supabase = createClient();
    const { pedidos: novos, error } = await listarPedidosWorkspace(supabase, wsId);
    setErroPedidos(error);
    setPedidos(novos);
    return novos;
  }

  async function carregarEmpresas(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any).rpc("fn_captador_listar_empresas", { p_workspace_id: wsId });
    setEmpresas((data ?? []) as LinhaEmpresa[]);
  }

  async function carregarNegociacoes(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any).rpc("fn_captador_listar_negociacoes", { p_workspace_id: wsId });
    setNegociacoes(((data ?? []) as any[]).map(r => ({
      id: r.id, titulo: r.titulo, status: r.status, atualizadoEm: r.updatedAt, empresaNome: r.empresaNome ?? "—",
    })));
  }

  async function carregarInscricoes(wsId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any).rpc("fn_captador_listar_inscricoes", { p_workspace_id: wsId });
    setInscricoes(((data ?? []) as any[]).map(r => ({
      id: r.id, titulo: r.titulo, status: r.status, atualizadoEm: r.updatedAt, empresaNome: r.empresaNome ?? "—",
    })));
  }

  useEffect(() => {
    async function carregar() {
      if (!organizationId) return;
      setCarregando(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCarregando(false); return; }

      const { data: captador } = await (supabase as any)
        .from("captadores")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!captador) { setNaoEncontrado(true); setCarregando(false); return; }

      const { data: workspace } = await (supabase as any)
        .from("captador_workspaces")
        .select("id, captador_workspace_escopos(tipo, habilitado, modo)")
        .eq("captador_id", captador.id)
        .maybeSingle();

      if (!workspace) { setNaoEncontrado(true); setCarregando(false); return; }

      setWorkspaceId(workspace.id);
      const escoposCarregados = (workspace.captador_workspace_escopos ?? []) as Escopo[];
      setEscopos(escoposCarregados);
      void carregarPedidos(workspace.id);
      void carregarAtribuicoes(workspace.id);

      const verTudo = (tipo: EscopoTipo) => escoposCarregados.some(e => e.tipo === tipo && e.habilitado && e.modo === "ver_tudo");

      if (verTudo("empresas")) await carregarEmpresas(workspace.id);
      if (verTudo("negociacoes")) await carregarNegociacoes(workspace.id);
      if (verTudo("inscricoes")) await carregarInscricoes(workspace.id);

      setCarregando(false);
    }
    void carregar();
  }, [organizationId]);

  if (carregando) return <DetailPageContent><div className="animate-pulse space-y-5"><div className="h-8 w-1/3 rounded bg-black/[.07]"/><div className="h-24 rounded bg-black/[.04]"/><div className="h-44 rounded bg-black/[.04]"/></div></DetailPageContent>;

  const habilitados = (escopos ?? []).filter(e => e.habilitado);
  const esperandoResposta = pedidos.filter(p => p.status === "aguardando_captador");
  const aguardandoGestor = pedidos.filter(p => p.status === "pendente");

  return (
    <div className="min-h-full">
      <header className="border-b border-black/[.06] bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-5 px-4 pb-8 pt-7 sm:flex-row sm:items-end sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <div><p className="mb-2 text-[11px] font-medium text-black/40">Workspace do captador</p><h1 className="text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[38px]">{organizationName}</h1></div>
          {!naoEncontrado && <button type="button" onClick={() => setSheetAberto(true)} disabled={!(escopos ?? []).some(e => e.habilitado && (e.tipo === "negociacoes" || e.tipo === "inscricoes"))}
            className="inline-flex h-11 items-center gap-2 self-start rounded border border-black/[.15] bg-white px-4 text-[12px] font-medium text-black transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40 sm:self-auto"><Plus size={14}/>Nova oportunidade</button>}
        </div>
      </header>

      {naoEncontrado ? (
        <DetailPageContent>
          <p className="text-[13px] text-black/50">Workspace indisponível.</p>
        </DetailPageContent>
      ) : (
        <>
          <DetailTabs ariaLabel="Seções do workspace" activeTab={aba} onChange={setAba} tabs={[
            { id: "resumo", label: "Resumo", count: atribuicoes.length + esperandoResposta.length + aguardandoGestor.length },
            { id: "fluxo", label: "Fluxo", count: atribuicoes.filter(a => a.status === "ativa").length },
            { id: "historico", label: "Histórico", count: pedidos.filter(p => p.status === "recusado").length },
            ...(habilitados.some(e => e.modo === "ver_tudo") ? [{ id: "carteira", label: "Carteira" }] : []),
          ]}/>
          <DetailPageContent>
            {erroPedidos && <p role="alert" className="mb-4 text-[12px] text-[#B64545]">Oportunidades indisponíveis.</p>}
            {erroEtapa && <p role="alert" className="mb-4 text-[12px] text-[#B64545]">{erroEtapa}</p>}
            {aba === "resumo" && <div className="space-y-6">
              <section className="grid grid-cols-3 gap-px overflow-hidden rounded border border-black/[.08] bg-black/[.08]">
                {[["Em andamento", atribuicoes.length], ["Sua resposta", esperandoResposta.length + acoesPendentes.length], ["Em análise", aguardandoGestor.length]].map(([label, value]) => <div key={label} className="bg-white px-4 py-4 sm:px-5"><p className="text-[11px] text-black/40">{label}</p><p className="mt-3 text-[25px] font-semibold tabular-nums tracking-tight text-[#171717]">{value}</p></div>)}
              </section>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5">
                  <section className="overflow-hidden rounded border border-black/[.08] bg-white">
                    <header className="flex items-center justify-between border-b border-black/[.07] px-4 py-4"><h2 className="text-[15px] font-semibold text-black/80">Em andamento</h2><span className="text-[11px] tabular-nums text-black/35">{atribuicoes.length}</span></header>
                    {atribuicoes.length === 0 ? <p className="px-4 py-6 text-[12px] text-black/40">Nenhuma oportunidade.</p> : atribuicoes.map(a => {
                      const pedido = pedidos.find(p => p.atribuicao_id === a.id);
                      return <OportunidadeRow key={a.id} href={`/workspace-captador/${a.id}`} empresa={a.empresaNome} titulo={pedido?.oportunidade_titulo || a.empresaNome} tipo={pedido && rotuloOportunidade(pedido)} site={a.empresaSite || pedido?.empresa_site} domain={a.empresaDomainKey} trailing={<StatusAtribuicaoBadge status={a.status}/>}/>;
                    })}
                  </section>
                </div>
                <aside className="order-first space-y-5 xl:order-last">
                  <section className="overflow-hidden rounded border border-black/[.08] bg-white">
                    <header className="flex items-center justify-between border-b border-black/[.07] px-4 py-4"><h2 className="text-[15px] font-semibold text-black/80">Sua atenção</h2><span className="text-[11px] tabular-nums text-black/35">{esperandoResposta.length + acoesPendentes.length}</span></header>
                    {esperandoResposta.length + acoesPendentes.length === 0 ? <p className="px-4 py-5 text-[12px] text-black/40">Nenhuma pendência.</p> : <>
                      {esperandoResposta.map(p => <OportunidadeRow key={p.id} href={`/workspace-captador/${p.id}`} empresa={p.nome_busca} titulo={p.oportunidade_titulo || p.nome_busca} tipo={rotuloOportunidade(p)} site={p.empresa_site}/>)}
                      {acoesPendentes.map(a => { const vinculada = atribuicoes.find(item => item.id === a.atribuicao_id); return <OportunidadeRow key={a.id} href={`/workspace-captador/${a.atribuicao_id}`} empresa={vinculada?.empresaNome || "Organização"} titulo={a.descricao} site={vinculada?.empresaSite} domain={vinculada?.empresaDomainKey}/>; })}
                    </>}
                  </section>
                  <section className="overflow-hidden rounded border border-black/[.08] bg-white">
                    <header className="flex items-center justify-between border-b border-black/[.07] px-4 py-4"><h2 className="text-[15px] font-semibold text-black/80">Em análise</h2><span className="text-[11px] tabular-nums text-black/35">{aguardandoGestor.length}</span></header>
                    {aguardandoGestor.length === 0 ? <p className="px-4 py-5 text-[12px] text-black/40">Nenhuma oportunidade.</p> : aguardandoGestor.map(p => <OportunidadeRow key={p.id} href={`/workspace-captador/${p.id}`} empresa={p.nome_busca} titulo={p.oportunidade_titulo || p.nome_busca} tipo={rotuloOportunidade(p)} site={p.empresa_site}/>)}
                  </section>
                </aside>
              </div>
            </div>}
            {aba === "fluxo" && (() => {
              const ativas = atribuicoes.filter(a => a.status === "ativa");
              const idsNegociacao = new Set(pedidos.filter(p => p.tipo === "negociacoes" && p.atribuicao_id).map(p => p.atribuicao_id));
              const idsInscricao = new Set(pedidos.filter(p => p.tipo === "inscricoes" && p.atribuicao_id).map(p => p.atribuicao_id));
              const props = { pedidos, draggingId, setDraggingId, overEtapa, setOverEtapa, moverEtapa, router };
              return <div className="space-y-8">
                <FunilKanban titulo="Negociações" etapas={etiquetas} itens={ativas.filter(a => idsNegociacao.has(a.id))} {...props} />
                <FunilKanban titulo="Inscrições" etapas={etiquetasInscricao} itens={ativas.filter(a => idsInscricao.has(a.id))} {...props} />
              </div>;
            })()}
            {aba === "historico" && <section className="overflow-hidden rounded border border-black/[.08] bg-white"><header className="border-b border-black/[.07] px-4 py-4"><h2 className="text-[15px] font-semibold text-black/80">Histórico</h2></header>
              {pedidos.filter(p => p.status === "aprovado" || p.status === "recusado").length === 0 ? <p className="px-4 py-6 text-[12px] text-black/40">Nenhum registro.</p> : pedidos.filter(p => p.status === "aprovado" || p.status === "recusado").map(p => <OportunidadeRow key={p.id} href={`/workspace-captador/${p.id}`} empresa={p.nome_busca} titulo={p.oportunidade_titulo || p.nome_busca} tipo={rotuloOportunidade(p)} site={p.empresa_site} trailing={<StatusPedidoBadge status={p.status}/>}/>)}
            </section>}
            {aba === "carteira" && <div className="space-y-6">
              {habilitados.some(e => e.tipo === "empresas" && e.modo === "ver_tudo") && <section className="rounded border border-black/[.08] bg-white p-5"><h2 className="mb-4 text-[15px] font-semibold text-black/80">Empresas</h2>{empresas.length ? empresas.map(e => <p key={e.id} className="border-t border-black/[.08] py-3 text-[12px] text-black/70">{e.nome}</p>) : <p className="text-[12px] text-black/40">Nenhuma empresa.</p>}</section>}
              {habilitados.some(e => e.tipo === "negociacoes" && e.modo === "ver_tudo") && <section className="rounded border border-black/[.08] bg-white p-5"><h2 className="mb-4 text-[15px] font-semibold text-black/80">Negociações</h2><ListaCaptacaoOrganizada linhas={negociacoes} vazio="Nenhuma negociação." negativos={NEGOCIACAO_NEGATIVO} positivos={NEGOCIACAO_POSITIVO}/></section>}
              {habilitados.some(e => e.tipo === "inscricoes" && e.modo === "ver_tudo") && <section className="rounded border border-black/[.08] bg-white p-5"><h2 className="mb-4 text-[15px] font-semibold text-black/80">Inscrições</h2><ListaCaptacaoOrganizada linhas={inscricoes} vazio="Nenhuma inscrição." negativos={INSCRICAO_NEGATIVO} positivos={INSCRICAO_POSITIVO}/></section>}
            </div>}
          </DetailPageContent>
        </>
      )}

      {sheetAberto && workspaceId && (
        <NovaOportunidadeSheet workspaceId={workspaceId} escopos={escopos ?? []} organizationId={organizationId!}
          onClose={() => setSheetAberto(false)} onSaved={() => {
            void carregarPedidos(workspaceId);
            void carregarAtribuicoes(workspaceId);
            if (habilitados.some(e => e.tipo === "negociacoes" && e.modo === "ver_tudo")) void carregarNegociacoes(workspaceId);
            if (habilitados.some(e => e.tipo === "inscricoes" && e.modo === "ver_tudo")) void carregarInscricoes(workspaceId);
          }} />
      )}

    </div>
  );
}
