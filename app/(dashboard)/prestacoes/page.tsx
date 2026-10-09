"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ClipboardCheck, ArrowUpRight, CheckCircle2, AlertCircle, Clock, List, Columns3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoCarteira, StatusPrestacao } from "@/lib/supabase/types";
import { NovaPrestacaoModal } from "@/components/modals/NovaPrestacaoModal";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { Select } from "@/components/ui/Select";
import { itensDaArvore, montarArvore, type NoOrcamento } from "@/lib/prestacao/orcamento";
import { avaliarProntidao, prazosDaPrestacao, proximoPrazo, quandoVence, type PrazoDaPrestacao, type Prontidao } from "@/lib/prestacao/prontidao";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";
import { KanbanBoard, KanbanCard, KanbanColumn, KanbanEmpty } from "@/components/kanban/KanbanPrimitives";
import { fetchOrganizationMembers, type OrganizationMemberSummary } from "@/lib/organization/members";
import { nomeDoMembro, podeConduzir } from "@/components/prestacao/ResponsavelDaPrestacao";
import { clientesDaCarteira, execucaoDoCaptado, filtrarCarteira, quadroDaCarteira, resumoDaCarteira, type LinhaDaCarteira } from "@/lib/prestacao/carteira";
import { LIST_HEADER_CELL, ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type PrestacaoLida = {
  id: string;
  titulo: string;
  status: StatusPrestacao;
  prazo: string | null;
  data_envio: string | null;
  regime_id: string | null;
  identificador_oficial: string | null;
  created_at: string;
  responsavel_id: string | null;
  captacao: { titulo: string | null } | null;
  projeto: { nome: string } | null;
  proponente: { id: string; nome: string } | null;
};

type Relacionados = {
  nos: (NoOrcamento & { prestacao_id: string })[];
  comprovantes: { prestacao_id: string; no_id: string | null; status: string; valor_extraido: number | null }[];
  atividades: { prestacao_id: string }[];
  alteracoes: { prestacao_id: string; numero: number; solicitada_em: string | null }[];
  carteira: PrestacaoCarteira[];
};

type Linha = PrestacaoLida & LinhaDaCarteira & {
  regime: RegimeNormativo | null;
  vigente: number;
  pago: number;
  prontidao: Prontidao;
  prazoProximo: PrazoDaPrestacao | null;
};

const STATUS_META: Record<StatusPrestacao, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho:          { label: "Rascunho",          color: "#6B6B6B", icon: <Clock size={11} aria-hidden /> },
  revisao_interna:   { label: "Revisão interna",   color: "#2D72B0", icon: <Clock size={11} aria-hidden /> },
  enviado:           { label: "Enviado",           color: "#B07A14", icon: <ArrowUpRight size={11} aria-hidden /> },
  ajuste_solicitado: { label: "Ajuste solicitado", color: "#D94A4A", icon: <AlertCircle size={11} aria-hidden /> },
  aprovado:          { label: "Aprovado",          color: "#2E8932", icon: <CheckCircle2 size={11} aria-hidden /> },
  arquivado:         { label: "Arquivado",         color: "#8A8A8A", icon: <CheckCircle2 size={11} aria-hidden /> },
};

const EM_PREPARO: StatusPrestacao[] = ["rascunho", "revisao_interna", "ajuste_solicitado"];

const VISOES = [
  { value: "lista", label: "Lista", icon: List },
  { value: "quadro", label: "Quadro", icon: Columns3 },
] as const;
const VISOES_PERMITIDAS = VISOES.map(v => v.value);

const COLUNAS: ColumnDefinition<string>[] = [
  { id: "prestacao", label: "Prestação", width: "16rem", grow: true, hideable: false },
  { id: "cliente", label: "Cliente", width: "11rem" },
  { id: "identificador", label: "Identificador", width: "8.5rem" },
  { id: "regime", label: "Regime", width: "11rem" },
  { id: "status", label: "Status", width: "9.5rem" },
  { id: "responsavel", label: "Responsável", width: "10rem" },
  { id: "prazo", label: "Próximo prazo", width: "10.5rem" },
  { id: "prontidao", label: "Prontidão", width: "9.5rem" },
  { id: "risco", label: "Em risco", width: "8.5rem" },
  { id: "orcamento", label: "Orçamento", width: "8.5rem" },
  { id: "comprovado", label: "Comprovado", width: "9rem" },
  { id: "captado", label: "Captado × executado", width: "10.5rem" },
  { id: "negociacao", label: "Negociação", width: "11rem", defaultHidden: true },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Valor de resumo ("R$ 400.000", "R$ 1,5 mi"), com o exato no title. */
function Valor({ v }: { v: number }) {
  return <span title={formatarValorCompleto(v)}>{formatarValorCurto(v)}</span>;
}
const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const dataNumerica = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");

/** "Venceu há 45 dias", "Vence hoje", "Vence em 12 dias": cabe numa linha da coluna. */
function vencimento(dias: number): string {
  const texto = quandoVence(dias);
  return dias < 0 ? texto.charAt(0).toUpperCase() + texto.slice(1) : `Vence ${texto}`;
}

function hojeEmBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function semAcento(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function corDaProntidao(percentual: number): string {
  return percentual >= 80 ? "#2E8932" : percentual >= 50 ? "#B07A14" : "rgba(13,13,13,.45)";
}

/** Só o prazo do proponente vencido ou perto de vencer é alerta: pinta o ícone, não o texto. */
function alertaDoPrazo(prazo: PrazoDaPrestacao): string | null {
  if (prazo.quem === "proponente" && prazo.dias < 0) return "#D94A4A";
  if (prazo.quem === "proponente" && prazo.dias <= 15) return "#B07A14";
  return null;
}

function EtiquetaStatus({ status }: { status: StatusPrestacao }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: `${meta.color}47`, color: meta.color }}>
      {meta.icon} {meta.label}
    </span>
  );
}

function BarraProntidao({ prontidao }: { prontidao: Prontidao }) {
  const cor = corDaProntidao(prontidao.percentual);
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-black/[.07]" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${prontidao.percentual}%`, background: cor }} />
        </div>
        <span className={`text-[0.6875rem] font-semibold tabular-nums ${prontidao.percentual ? "text-[#0D0D0D]" : "text-black/30"}`}>{prontidao.percentual}%</span>
      </div>
      <p className="mt-0.5 text-[0.625rem] text-black/40">
        {prontidao.pendencias.length ? `${prontidao.pendencias.length} ${prontidao.pendencias.length === 1 ? "pendência" : "pendências"}` : "Sem pendências"}
      </p>
    </div>
  );
}

function PrazoCelula({ prazo }: { prazo: PrazoDaPrestacao | null }) {
  if (!prazo) return <span className="text-[0.6875rem] text-black/25">—</span>;
  const alerta = alertaDoPrazo(prazo);
  return (
    <div className="min-w-0" title={`${prazo.rotulo}: ${dataCurta(prazo.data)}`}>
      <p className="flex min-w-0 items-center gap-1 text-[0.6875rem] font-medium text-black/60">
        {alerta && <Clock size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: alerta }} />}
        <span className="truncate">{vencimento(prazo.dias)}</span>
      </p>
      <p className="truncate text-[0.625rem] tabular-nums text-black/40">{dataNumerica(prazo.data)} · {prazo.rotulo}</p>
    </div>
  );
}

function RiscoCelula({ carteira, curto = false }: { carteira: Linha["carteira"]; curto?: boolean }) {
  if (!carteira?.achados_em_risco) return <span className="text-[0.75rem] text-black/25">—</span>;
  const achados = `${carteira.achados_em_risco} ${carteira.achados_em_risco === 1 ? "achado aberto" : "achados abertos"}`;
  if (!carteira.valor_em_risco) return <p className="text-[0.6875rem] text-black/50">{achados}</p>;
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[0.75rem] tabular-nums text-[#0D0D0D]">
        <AlertCircle size={12} strokeWidth={1.75} role="img" aria-label="Em risco" className="shrink-0 text-[#D94A4A]" />
        {curto ? <Valor v={carteira.valor_em_risco} /> : fmt(carteira.valor_em_risco)}
      </p>
      <p className="text-[0.625rem] text-black/40">{achados}</p>
    </div>
  );
}

function CaptadoCelula({ carteira }: { carteira: Linha["carteira"] }) {
  if (!carteira || (!carteira.captado && !carteira.executado)) return <span className="text-[0.75rem] text-black/25">—</span>;
  const { percentual, acima } = execucaoDoCaptado(carteira);
  if (percentual === null) return <p className="text-[0.6875rem] text-black/50">{fmt(carteira.executado)} executado, sem aporte no extrato</p>;
  return (
    <div className="min-w-0">
      <p className="text-[0.75rem] tabular-nums text-black/60">{fmt(carteira.captado)}</p>
      <p className="flex items-center gap-1 text-[0.625rem] tabular-nums text-black/40">
        {acima && <AlertCircle size={12} strokeWidth={1.75} role="img" aria-label="Acima do captado" className="shrink-0 text-[#D94A4A]" />}
        <span>{fmt(carteira.executado)} executado · {percentual}%</span>
      </p>
    </div>
  );
}

export default function PrestacoesList() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  // Sem assinatura o módulo fica só para leitura (P5.6): sem criar prestações.
  const { assinatura } = useAssinaturaPrestacao(organizationId);
  const podeCriar = !assinatura?.descricao.somenteLeitura;
  const regimes = useRegimesPublicados();
  const [recarga, setRecarga] = useState(0);
  const [lidas, setLidas] = useState<{ chave: string; prestacoes: PrestacaoLida[]; relacionados: Relacionados } | null>(null);
  const [showNova, setShowNova] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<StatusPrestacao | "todos">("todos");
  const [filtroRegime, setFiltroRegime] = useState("todos");
  const [busca, setBusca] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [visao, setVisao] = usePersistedViewMode("prestacoes:visao", VISOES_PERMITIDAS, "lista");
  const [membros, setMembros] = useState<OrganizationMemberSummary[]>([]);
  const chave = `${organizationId}:${recarga}`;

  useEffect(() => {
    let ativo = true;
    fetchOrganizationMembers(organizationId).then(lista => { if (ativo) setMembros(lista); }).catch(() => {});
    return () => { ativo = false; };
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    (async () => {
      // O acesso vale para todas as organizações da pessoa; a lista mostra só a atual.
      const { data } = await db
        .from("prestacoes_contas")
        .select("id, titulo, status, prazo, data_envio, regime_id, identificador_oficial, created_at, responsavel_id, captacao:captacao_id(titulo), projeto:projeto_id(nome), proponente:proponente_id(id, nome)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      const prestacoes = (data ?? []) as PrestacaoLida[];
      const ids = prestacoes.map(p => p.id);
      const vazio = { data: [] };
      const [nos, comprovantes, atividades, alteracoes, carteira] = ids.length
        ? await Promise.all([
            db.from("prestacao_orcamento_nos").select("*, versao:prestacao_orcamento_versoes!inner(ativa)").in("prestacao_id", ids).eq("versao.ativa", true),
            db.from("prestacao_comprovantes").select("prestacao_id, no_id, status, valor_extraido").in("prestacao_id", ids),
            db.from("prestacao_atividades").select("prestacao_id").in("prestacao_id", ids),
            db.from("prestacao_alteracoes").select("prestacao_id, numero, solicitada_em").eq("status", "solicitada").in("prestacao_id", ids),
            // Valor em risco, captado e executado (P5.1).
            db.from("prestacao_carteira").select("prestacao_id, valor_em_risco, achados_em_risco, captado, executado").in("prestacao_id", ids),
          ])
        : [vazio, vazio, vazio, vazio, vazio];
      if (!ativo) return;
      setLidas({
        chave,
        prestacoes,
        relacionados: {
          nos: nos.data ?? [],
          comprovantes: comprovantes.data ?? [],
          atividades: atividades.data ?? [],
          alteracoes: alteracoes.data ?? [],
          carteira: carteira.data ?? [],
        },
      });
    })();
    return () => { ativo = false; };
  }, [supabase, organizationId, chave]);

  const loading = !lidas;
  const hoje = hojeEmBrasilia();

  const linhas = useMemo<Linha[]>(() => {
    if (!lidas) return [];
    const { prestacoes, relacionados } = lidas;
    const agrupar = <T extends { prestacao_id: string }>(lista: T[]) => {
      const mapa = new Map<string, T[]>();
      for (const item of lista) mapa.set(item.prestacao_id, [...(mapa.get(item.prestacao_id) ?? []), item]);
      return mapa;
    };
    const nosPor = agrupar(relacionados.nos);
    const comprovantesPor = agrupar(relacionados.comprovantes);
    const atividadesPor = agrupar(relacionados.atividades);
    const alteracoesPor = agrupar(relacionados.alteracoes);
    const carteiraPor = new Map(relacionados.carteira.map(c => [c.prestacao_id, {
      valor_em_risco: Number(c.valor_em_risco) || 0, achados_em_risco: Number(c.achados_em_risco) || 0,
      captado: Number(c.captado) || 0, executado: Number(c.executado) || 0,
    }]));

    return prestacoes.map(p => {
      const regime = regimes.find(r => r.id === p.regime_id)?.regime ?? null;
      const itens = itensDaArvore(montarArvore(nosPor.get(p.id) ?? [], []).raizes)
        .map(linha => ({ id: linha.no.id, grupo: linha.grupo, vigente: linha.totais.vigente }));
      const comprovantes = comprovantesPor.get(p.id) ?? [];
      const idsDosItens = new Set(itens.map(item => item.id));
      const alteracoes = alteracoesPor.get(p.id) ?? [];
      const prontidao = avaliarProntidao({
        regime,
        identificadorOficial: p.identificador_oficial,
        prazo: p.prazo,
        itens,
        comprovantes,
        atividades: (atividadesPor.get(p.id) ?? []).length,
        alteracoesAguardando: alteracoes.length,
      });
      return {
        ...p,
        cliente: p.proponente,
        responsavelId: p.responsavel_id,
        carteira: carteiraPor.get(p.id) ?? null,
        regime,
        vigente: itens.reduce((soma, item) => soma + item.vigente, 0),
        pago: comprovantes
          .filter(c => c.status === "aceito" && c.no_id && idsDosItens.has(c.no_id))
          .reduce((soma, c) => soma + (Number(c.valor_extraido) || 0), 0),
        prontidao,
        prazoProximo: proximoPrazo(prazosDaPrestacao(p, regime, alteracoes, hoje)),
      };
    }).sort((a, b) => {
      // Prazos mais urgentes primeiro; sem prazo, as mais recentes.
      if (a.prazoProximo && b.prazoProximo) return a.prazoProximo.data.localeCompare(b.prazoProximo.data);
      if (a.prazoProximo) return -1;
      if (b.prazoProximo) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [lidas, regimes, hoje]);

  const termo = semAcento(busca.trim());
  const filtradas = filtrarCarteira(linhas, { cliente: filtroCliente, responsavel: filtroResponsavel }).filter(p =>
    (filtroStatus === "todos" || p.status === filtroStatus) &&
    (filtroRegime === "todos" || (filtroRegime === "sem" ? !p.regime_id : p.regime_id === filtroRegime)) &&
    (!termo || semAcento([p.titulo, p.projeto?.nome, p.captacao?.titulo, p.identificador_oficial, p.cliente?.nome].filter(Boolean).join(" ")).includes(termo)));

  const contadores = Object.fromEntries(
    (Object.keys(STATUS_META) as StatusPrestacao[]).map(s => [s, linhas.filter(p => p.status === s).length]),
  ) as Record<StatusPrestacao, number>;
  const emPreparo = linhas.filter(p => EM_PREPARO.includes(p.status)).length;
  const envioProximo = linhas.filter(p => p.prazoProximo?.quem === "proponente" && p.prazoProximo.dias >= 0 && p.prazoProximo.dias <= 30).length;
  const vencidas = linhas.filter(p => p.prazoProximo?.quem === "proponente" && p.prazoProximo.dias < 0).length;
  const regimesNaLista = [...new Map(linhas.filter(p => p.regime_id && p.regime).map(p => [p.regime_id as string, p.regime as RegimeNormativo])).entries()];
  const hasFilter = filtroStatus !== "todos" || filtroRegime !== "todos" || filtroCliente !== "todos" || filtroResponsavel !== "todos" || termo !== "";
  const limparFiltros = () => { setFiltroStatus("todos"); setFiltroRegime("todos"); setFiltroCliente("todos"); setFiltroResponsavel("todos"); setBusca(""); };
  const resumo = resumoDaCarteira(linhas);
  const clientes = clientesDaCarteira(linhas);
  const nomePorId = new Map(membros.map(m => [m.user_id, nomeDoMembro(m)]));
  const responsaveis = membros.filter(podeConduzir);
  const nomeDoResponsavel = (id: string | null) => (id ? nomePorId.get(id) ?? "Fora da equipe" : null);

  return (
    <div className="flex h-full flex-col">
      <ListPageHeader
        eyebrow="Prestação de contas"
        title="Prestações"
        summary={!loading && (
          <>
            <ListSummary strong={linhas.length}>{linhas.length === 1 ? "prestação" : "prestações"}</ListSummary>
            {emPreparo > 0 && <ListSummary strong={emPreparo}>em preparo</ListSummary>}
            {envioProximo > 0 && <ListSummary strong={envioProximo} icone={Clock} alerta="ambar">com envio em até 30 dias</ListSummary>}
            {vencidas > 0 && <ListSummary strong={vencidas} icone={Clock} alerta="vermelho">{vencidas === 1 ? "vencida" : "vencidas"}</ListSummary>}
            {resumo.valorEmRisco > 0 && <ListSummary strong={<Valor v={resumo.valorEmRisco} />} alerta="vermelho">em risco</ListSummary>}
            {resumo.clientes > 1 && <ListSummary strong={resumo.clientes}>clientes</ListSummary>}
          </>
        )}
        actions={<>
          <EntityViewSwitcher value={visao} onChange={setVisao} options={VISOES} />
          {podeCriar && <PrimaryListAction onClick={() => setShowNova(true)}><Plus size={13} aria-hidden="true" />Nova prestação</PrimaryListAction>}
        </>}
      />

      <ListToolbar search={<ListSearch value={busca} onChange={setBusca} placeholder="Buscar prestação, projeto ou identificador" />}>
        <div role="group" aria-label="Filtrar por status" className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-pressed={filtroStatus === "todos"}
            onClick={() => setFiltroStatus("todos")}
            className={`h-9 shrink-0 rounded border px-3 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
              filtroStatus === "todos"
                ? "border-[#7259B5]/40 bg-white text-[#7259B5]"
                : "border-black/[.08] bg-white text-black/45 hover:bg-black/[.03]"
            }`}
          >
            Todas <span className="tabular-nums">({linhas.length})</span>
          </button>
          {(Object.entries(STATUS_META) as [StatusPrestacao, typeof STATUS_META[StatusPrestacao]][]).filter(([s]) => contadores[s] > 0 || filtroStatus === s).map(([s, meta]) => (
            <button
              key={s}
              type="button"
              aria-pressed={filtroStatus === s}
              onClick={() => setFiltroStatus(s)}
              className="h-9 shrink-0 rounded border bg-white px-3 text-[0.75rem] font-medium transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              style={{
                borderColor: filtroStatus === s ? meta.color : "rgba(13,13,13,.08)",
                color: filtroStatus === s ? meta.color : "rgba(13,13,13,.45)",
              }}
            >
              {meta.label} <span className="tabular-nums">({contadores[s]})</span>
            </button>
          ))}
        </div>
        {regimesNaLista.length > 0 && (
          <Select
            block={false}
            aria-label="Filtrar por regime"
            value={filtroRegime}
            onChange={event => setFiltroRegime(event.target.value)}
            className="h-9 shrink-0 pl-3 pr-8 text-black/60"
          >
            <option value="todos">Todos os regimes</option>
            {regimesNaLista.map(([id, regime]) => <option key={id} value={id}>{regime.nome}</option>)}
            {linhas.some(p => !p.regime_id) && <option value="sem">Sem regime</option>}
          </Select>
        )}
        {clientes.length > 0 && (
          <Select block={false} aria-label="Filtrar por cliente" value={filtroCliente} onChange={event => setFiltroCliente(event.target.value)} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
            <option value="todos">Todos os clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.quantas})</option>)}
            {linhas.some(p => !p.cliente) && <option value="sem">Sem cliente</option>}
          </Select>
        )}
        {(responsaveis.length > 1 || linhas.some(p => p.responsavelId)) && (
          <Select block={false} aria-label="Filtrar por responsável" value={filtroResponsavel} onChange={event => setFiltroResponsavel(event.target.value)} className="h-9 shrink-0 pl-3 pr-8 text-black/60">
            <option value="todos">Todos os responsáveis</option>
            {responsaveis.map(m => <option key={m.user_id} value={m.user_id}>{nomeDoMembro(m)}</option>)}
            <option value="sem">Automático</option>
          </Select>
        )}
      </ListToolbar>

      <ListContent>
        {!loading && filtradas.length === 0 ? (
          <ListTableSurface>
            <ListEmptyState
              icon={ClipboardCheck}
              title={hasFilter ? "Nenhuma prestação com esses filtros" : "Nenhuma prestação cadastrada"}
              description={hasFilter ? undefined : "Crie a prestação a partir de um projeto ou de uma negociação aprovada; o Jards calcula o prazo pelo regime."}
              filtered={hasFilter}
              onClearFilters={limparFiltros}
              action={hasFilter || !podeCriar ? undefined : <PrimaryListAction onClick={() => setShowNova(true)}><Plus size={13} aria-hidden="true" />Nova prestação</PrimaryListAction>}
            />
          </ListTableSurface>
        ) : visao === "quadro" ? (
          <div className="-mx-4 -my-5 md:-mx-8 md:-my-6">
            <KanbanBoard>
              {quadroDaCarteira(filtradas).map(coluna => {
                const meta = STATUS_META[coluna.status];
                const risco = resumoDaCarteira(coluna.linhas).valorEmRisco;
                return (
                  <KanbanColumn key={coluna.status} label={meta.label} accent={meta.color} count={loading ? null : coluna.linhas.length} total={risco > 0 ? `${formatarValorCurto(risco)} em risco` : null} compact>
                    {coluna.linhas.length === 0 ? <KanbanEmpty label="Nenhuma prestação" /> : coluna.linhas.map(p => (
                      <KanbanCard key={p.id} onClick={() => router.push(`/prestacoes/${p.id}`)}>
                        <Link href={`/prestacoes/${p.id}`} onClick={event => event.stopPropagation()} className="line-clamp-2 rounded text-[0.8125rem] font-semibold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{p.titulo}</Link>
                        <p className="mt-0.5 truncate text-[0.6875rem] text-black/45">{[p.cliente?.nome, nomeDoResponsavel(p.responsavelId)].filter(Boolean).join(" · ") || "Sem cliente"}</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <PrazoCelula prazo={p.prazoProximo} />
                          <BarraProntidao prontidao={p.prontidao} />
                        </div>
                        {p.carteira?.achados_em_risco ? <div className="mt-2.5 border-t pt-2.5" style={{ borderColor: "rgba(13,13,13,.06)" }}><RiscoCelula carteira={p.carteira} curto /></div> : null}
                      </KanbanCard>
                    ))}
                  </KanbanColumn>
                );
              })}
            </KanbanBoard>
          </div>
        ) : (
          <>
            {/* Celular: cartões */}
            <ul className="space-y-2 md:hidden" aria-busy={loading}>
              {loading ? Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="h-28 animate-pulse rounded border bg-white motion-reduce:animate-none" style={{ borderColor: "rgba(13,13,13,.08)" }} />
              )) : filtradas.map(p => (
                <li key={p.id}>
                  <Link href={`/prestacoes/${p.id}`} className="block rounded border bg-white p-4 transition hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.8125rem] font-semibold text-black">{p.titulo}</p>
                        <p className="truncate text-[0.6875rem] text-black/40">
                          {[p.cliente?.nome, p.regime?.identificadorOficial && p.identificador_oficial ? `${p.regime.identificadorOficial.rotulo} ${p.identificador_oficial}` : null, p.projeto?.nome].filter(Boolean).join(" · ") || "Sem projeto"}
                        </p>
                      </div>
                      <EtiquetaStatus status={p.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <PrazoCelula prazo={p.prazoProximo} />
                      <BarraProntidao prontidao={p.prontidao} />
                    </div>
                    {(p.carteira?.achados_em_risco || p.responsavelId) ? (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-[0.6875rem] text-black/55">
                        <RiscoCelula carteira={p.carteira} />
                        <span className="truncate">{nomeDoResponsavel(p.responsavelId) ?? ""}</span>
                      </div>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Telas maiores: tabela com colunas configuráveis */}
            <ListTableSurface className="hidden md:block">
              <ManagedTable storageKey="prestacoes" definitions={COLUNAS} className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#F9F9F8", borderBottom: "1px solid rgba(13,13,13,.07)" }}>
                    {COLUNAS.map(coluna => (
                      <th key={coluna.id} scope="col" className={`px-4 py-3 text-left ${LIST_HEADER_CELL} whitespace-nowrap`}>{coluna.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(13,13,13,.05)" }}>
                      {COLUNAS.map(coluna => (
                        <td key={coluna.id} className="px-4 py-4"><div className="h-3.5 w-3/4 animate-pulse rounded bg-black/[.06] motion-reduce:animate-none" /></td>
                      ))}
                    </tr>
                  )) : filtradas.map(p => {
                    const percentualPago = p.vigente > 0 ? Math.floor((p.pago / p.vigente) * 100) : null;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/prestacoes/${p.id}`)}
                        className="cursor-pointer transition hover:bg-black/[.025]"
                        style={{ borderBottom: "1px solid rgba(13,13,13,.05)" }}
                      >
                        <td className="px-4 py-3">
                          <Link href={`/prestacoes/${p.id}`} onClick={event => event.stopPropagation()} className="line-clamp-1 text-[0.8125rem] font-semibold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{p.titulo}</Link>
                          {p.projeto && <p className="mt-0.5 line-clamp-1 text-[0.625rem] text-black/35">{p.projeto.nome}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 text-[0.6875rem] text-black/60">{p.cliente?.nome ?? <span className="text-black/25">—</span>}</p>
                        </td>
                        <td className="px-4 py-3 text-[0.6875rem] tabular-nums text-black/60">
                          {p.identificador_oficial
                            ? <><span className="block text-[0.5625rem] uppercase tracking-[.08em] text-black/30">{p.regime?.identificadorOficial?.rotulo ?? "Identificador"}</span>{p.identificador_oficial}</>
                            : <span className="text-black/25">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 text-[0.6875rem] text-black/60" title={p.regime?.normaReferencia}>{p.regime?.nome ?? <span className="text-black/30">Sem regime</span>}</p>
                        </td>
                        <td className="px-4 py-3"><EtiquetaStatus status={p.status} /></td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 text-[0.6875rem] text-black/60">{nomeDoResponsavel(p.responsavelId) ?? <span className="text-black/30">Automático</span>}</p>
                        </td>
                        <td className="px-4 py-3"><PrazoCelula prazo={p.prazoProximo} /></td>
                        <td className="px-4 py-3"><BarraProntidao prontidao={p.prontidao} /></td>
                        <td className="px-4 py-3"><RiscoCelula carteira={p.carteira} /></td>
                        <td className="px-4 py-3 text-[0.75rem] tabular-nums text-black/60">{p.vigente ? fmt(p.vigente) : <span className="text-black/25">—</span>}</td>
                        <td className="px-4 py-3">
                          {p.vigente ? (
                            <>
                              <p className="text-[0.75rem] tabular-nums text-black/60">{fmt(p.pago)}</p>
                              <p className="text-[0.625rem] tabular-nums text-black/40">{percentualPago}% do orçamento</p>
                            </>
                          ) : <span className="text-[0.75rem] text-black/25">—</span>}
                        </td>
                        <td className="px-4 py-3"><CaptadoCelula carteira={p.carteira} /></td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 text-[0.6875rem] text-black/55">{p.captacao?.titulo ?? <span className="text-black/25">—</span>}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ManagedTable>
            </ListTableSurface>
          </>
        )}
      </ListContent>

      {showNova && (
        <NovaPrestacaoModal
          onClose={() => setShowNova(false)}
          onSaved={() => { setShowNova(false); setRecarga(n => n + 1); }}
        />
      )}
    </div>
  );
}
