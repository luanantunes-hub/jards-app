"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays, CalendarPlus, Check, CircleCheck, Clock, Copy, Gauge, Handshake, ListChecks, MessageCircleQuestion,
  Mic, Search, Star, Timer, Users, Video, X, type LucideIcon,
} from "lucide-react";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CLASSE_DA_FRASE, FAMILIA_DA_FRASE, IlustracaoDaSecao, VARIAVEIS_DA_FRASE } from "@/components/list/TituloComFrase";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { DetailBackLink, DetailNotFound, DetailPageContent, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { PROJECT_ICON_COLORS } from "@/components/ui/ProjectIdentity";
import {
  ehPergunta, estatisticasDaReuniao, formatarDuracao, formatarTimestamp, iniciais, mapaDaConversa,
  parcelasEmPorcentagem, partesEmNegrito, separarResumo, tipoSugeridoDoPasso, type TrechoDaTranscricao,
} from "@/lib/reunioes/analise";

type Reuniao = {
  id: string;
  titulo: string;
  plataforma: "google_meet" | "teams";
  url_reuniao: string;
  status: "agendada" | "bot_entrando" | "gravando" | "processando" | "concluida" | "falhou";
  erro: string | null;
  resumo_ia: string | null;
  captacao_id: string | null;
  empresa_crm_id: string | null;
  agendada_para: string | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  created_at: string;
};

type Participante = { id: string; nome: string | null; email: string | null };
type Marcador = { id: string; tipo: "destaque" | "acao"; texto: string; timestamp_ms: number | null };
type Negociacao = { id: string; titulo: string | null } | null;
type Empresa = { id: string; nome: string; domain_key: string | null; site: string | null } | null;

const FAIXAS_DO_MAPA = 96;
const COR_SEM_NOME = "rgba(13,13,13,.28)";
const BORDA = "rgba(13,13,13,.08)";

const AVISO_DO_STATUS: Record<Exclude<Reuniao["status"], "concluida">, string> = {
  agendada: "Reunião agendada. O assistente entra no horário marcado.",
  bot_entrando: "O assistente está entrando na reunião…",
  gravando: "Reunião em andamento. A transcrição aparece aqui quando terminar.",
  processando: "Reunião encerrada. Preparando a transcrição e o resumo…",
  falhou: "Não foi possível gravar esta reunião.",
};

function dataDaReuniao(reuniao: Reuniao) {
  return new Date(reuniao.iniciada_em ?? reuniao.agendada_para ?? reuniao.created_at).toLocaleString("pt-BR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function realcar(texto: string, termo: string): ReactNode {
  if (!termo) return texto;
  const partes = texto.split(new RegExp(`(${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return partes.map((parte, i) =>
    parte.toLowerCase() === termo.toLowerCase()
      ? <mark key={i} className="rounded-[2px] bg-[#DFA024]/30 px-0.5 text-[#282525]">{parte}</mark>
      : parte,
  );
}

function Negrito({ texto }: { texto: string }) {
  return <>{partesEmNegrito(texto).map((p, i) => p.negrito ? <strong key={i} className="font-semibold text-[#282525]">{p.texto}</strong> : p.texto)}</>;
}

function Avatar({ nome, cor, tamanho = "md" }: { nome: string; cor: string; tamanho?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${tamanho === "sm" ? "h-4 w-4 text-[0.4375rem]" : "h-8 w-8 text-[0.6875rem]"}`}
      style={{ background: cor, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}
    >
      {iniciais(nome)}
    </span>
  );
}

function Metrica({ rotulo, icone: Icone, valor, unidade, detalhe, className = "" }: {
  rotulo: string; icone: LucideIcon; valor: string | null; unidade?: string; detalhe?: string; className?: string;
}) {
  return (
    <div className={`cartao-textura flex min-h-[5.25rem] flex-col justify-between gap-3 rounded px-4 py-3.5 lg:min-h-[6.25rem] ${className}`}>
      <p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
        <Icone size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />
        {rotulo}
      </p>
      <div>
        <p className={`text-[1.625rem] font-semibold leading-none tracking-[-.03em] tabular-nums ${valor ? "text-[#282525]" : "text-black/30"}`}>
          {valor ?? "—"}
          {valor && unidade && <span className="ml-1 text-[0.75rem] font-medium tracking-normal text-black/40">{unidade}</span>}
        </p>
        {detalhe && <p className="mt-1.5 truncate text-[0.6875rem] text-black/40">{detalhe}</p>}
      </div>
    </div>
  );
}

function Cartao({ titulo, icone: Icone, contagem, children }: { titulo: string; icone: LucideIcon; contagem?: number; children: ReactNode }) {
  return (
    <section className="rounded border bg-white p-4" style={{ borderColor: BORDA }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[0.6875rem] font-semibold text-black/45">
          <Icone size={12} aria-hidden="true" className="text-black/30" />
          {titulo}
        </h2>
        {typeof contagem === "number" && <span className="text-[0.625rem] tabular-nums text-black/25">{contagem}</span>}
      </div>
      {children}
    </section>
  );
}

function Etiqueta({ cor, children }: { cor: string; children: ReactNode }) {
  return (
    <span className="rounded border bg-white px-2 py-1 text-[0.625rem] font-medium leading-none" style={{ borderColor: cor + "47", color: cor }}>
      {children}
    </span>
  );
}

export default function ReuniaoDetalhePage() {
  const params = useParams<{ id: string }>();

  const [reuniao, setReuniao] = useState<Reuniao | null>(null);
  const [trechos, setTrechos] = useState<TrechoDaTranscricao[]>([]);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [marcadores, setMarcadores] = useState<Marcador[]>([]);
  const [negociacao, setNegociacao] = useState<Negociacao>(null);
  const [empresa, setEmpresa] = useState<Empresa>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [falanteAtivo, setFalanteAtivo] = useState<string | null>(null);
  const [destacado, setDestacado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [passoEmAtividade, setPassoEmAtividade] = useState<{ id: string; texto: string } | null>(null);
  const [passosComAtividade, setPassosComAtividade] = useState<Set<string>>(() => new Set());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setLoading(true);
      const res = await fetch(`/api/reunioes/${params.id}`);
      if (!ativo) return;
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      if (!ativo) return;
      setReuniao(data.reuniao);
      setTrechos(data.transcricoes ?? []);
      setParticipantes(data.participantes ?? []);
      setMarcadores(data.marcadores ?? []);
      setNegociacao(data.negociacao ?? null);
      setEmpresa(data.empresa ?? null);
      setLoading(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [params.id]);

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const estatisticas = useMemo(() => estatisticasDaReuniao(trechos), [trechos]);
  const porcentagens = useMemo(() => parcelasEmPorcentagem(estatisticas.falantes.map(f => f.parcela)), [estatisticas]);

  const corDoFalante = useMemo(() => {
    const cores = new Map<string, string>();
    estatisticas.falantes
      .filter(f => f.nome !== "Sem nome")
      .forEach((f, i) => cores.set(f.nome, PROJECT_ICON_COLORS[i % PROJECT_ICON_COLORS.length].cor));
    return (nome: string | null) => (nome && cores.get(nome.trim())) || COR_SEM_NOME;
  }, [estatisticas]);

  const resumo = useMemo(() => separarResumo(reuniao?.resumo_ia ?? ""), [reuniao?.resumo_ia]);
  const acoes = marcadores.filter(m => m.tipo === "acao");
  const destaques = marcadores.filter(m => m.tipo === "destaque");
  const proximosPassos = acoes.length > 0
    ? acoes.map(m => ({ id: m.id, texto: m.texto, timestamp: m.timestamp_ms }))
    : resumo.proximosPassos.map((texto, i) => ({ id: `resumo-${i}`, texto, timestamp: null as number | null }));

  const termo = busca.trim();
  const trechosVisiveis = useMemo(() => {
    const t = termo.toLowerCase();
    return trechos.filter(trecho =>
      (!t || trecho.texto.toLowerCase().includes(t)) &&
      (!falanteAtivo || (trecho.falante?.trim() || "Sem nome") === falanteAtivo),
    );
  }, [trechos, termo, falanteAtivo]);
  const filtrando = Boolean(termo || falanteAtivo);
  const idsVisiveis = useMemo(() => new Set(trechosVisiveis.map(t => t.id)), [trechosVisiveis]);

  const mapa = useMemo(() => mapaDaConversa(trechos, FAIXAS_DO_MAPA), [trechos]);
  const fimDaConversa = trechos.reduce((maior, t) => Math.max(maior, t.fim_ms ?? t.inicio_ms), 0);

  function marcadoresDoTrecho(trecho: TrechoDaTranscricao) {
    const fim = trecho.fim_ms ?? trecho.inicio_ms;
    return marcadores.filter(m => m.timestamp_ms !== null && m.timestamp_ms >= trecho.inicio_ms && m.timestamp_ms <= fim);
  }

  function irParaTrecho(id: string) {
    if (!idsVisiveis.has(id)) { setBusca(""); setFalanteAtivo(null); }
    requestAnimationFrame(() => {
      const alvo = document.getElementById(`trecho-${id}`);
      if (!alvo) return;
      const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      alvo.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "center" });
      setDestacado(id);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setDestacado(null), 1800);
    });
  }

  function irParaMomento(ms: number) {
    const trecho = trechos.find(t => ms >= t.inicio_ms && ms <= (t.fim_ms ?? t.inicio_ms)) ??
      trechos.reduce<TrechoDaTranscricao | null>((perto, t) => !perto || Math.abs(t.inicio_ms - ms) < Math.abs(perto.inicio_ms - ms) ? t : perto, null);
    if (trecho) irParaTrecho(trecho.id);
  }

  function clicarNoMapa(evento: React.MouseEvent<HTMLDivElement>) {
    const caixa = evento.currentTarget.getBoundingClientRect();
    const indice = Math.min(mapa.length - 1, Math.max(0, Math.floor(((evento.clientX - caixa.left) / caixa.width) * mapa.length)));
    const faixa = mapa[indice];
    const id = faixa?.trechoIds.find(i => idsVisiveis.has(i)) ?? faixa?.trechoIds[0];
    if (id) irParaTrecho(id);
  }

  async function copiarTranscricao() {
    const texto = trechos.map(t => `[${formatarTimestamp(t.inicio_ms)}] ${t.falante ?? "Sem nome"}: ${t.texto}`).join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  if (loading) return <DetailPageSkeleton />;

  if (!reuniao) {
    return (
      <DetailNotFound
        title="Reunião não encontrada"
        description="Ela pode ter sido removida ou você não tem acesso a ela."
        backHref="/conversas"
        backLabel="Conversas"
      />
    );
  }

  const duracaoMs = reuniao.iniciada_em && reuniao.finalizada_em
    ? new Date(reuniao.finalizada_em).getTime() - new Date(reuniao.iniciada_em).getTime()
    : fimDaConversa;
  const falantesComNome = estatisticas.falantes.filter(f => f.nome !== "Sem nome").length;
  const totalDePessoas = Math.max(falantesComNome, participantes.length);
  const temTranscricao = trechos.length > 0;
  const plataforma = reuniao.plataforma === "google_meet" ? "Google Meet" : "Microsoft Teams";
  const participantesSemFala = participantes.filter(p =>
    !estatisticas.falantes.some(f => p.nome && f.nome.toLowerCase() === p.nome.trim().toLowerCase()),
  );

  return (
    <div className="min-h-full">
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <div className="mb-7">
            <DetailBackLink href="/conversas" label="Conversas" />
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className={`flex min-w-0 items-center gap-4 ${VARIAVEIS_DA_FRASE}`}>
              <IlustracaoDaSecao arquivo="conversas" />
              <div className="min-w-0">
              <h1 className={`text-balance text-[#282525] ${CLASSE_DA_FRASE}`} style={{ fontFamily: FAMILIA_DA_FRASE }}>
                {reuniao.titulo}
              </h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-black/45">
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden="true" className="text-black/35" />{dataDaReuniao(reuniao)}</span>
                {duracaoMs > 0 && <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden="true" className="text-black/35" />{formatarDuracao(duracaoMs)}</span>}
                <span className="inline-flex items-center gap-1.5"><Video size={14} aria-hidden="true" className="text-black/35" />{plataforma}</span>
                {empresa && (
                  <Link href={`/empresas-crm/${empresa.id}`} className="inline-flex items-center gap-1.5 font-medium text-[#7259B5] hover:underline">
                    <CompanyLogo nome={empresa.nome} domain={empresa.domain_key} site={empresa.site} size={14} className="rounded" />
                    {empresa.nome}
                  </Link>
                )}
                {negociacao && (
                  <Link href={`/captacoes/${negociacao.id}`} className="inline-flex items-center gap-1.5 font-medium text-[#7259B5] hover:underline">
                    <Handshake size={14} aria-hidden="true" />
                    {negociacao.titulo || "Negociação"}
                  </Link>
                )}
              </div>
              </div>
            </div>

            {temTranscricao && (
              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={copiarTranscricao}
                  className="inline-flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04] active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                >
                  {copiado ? <Check size={14} strokeWidth={1.8} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.8} aria-hidden="true" />}
                  {copiado ? "Copiada" : "Copiar transcrição"}
                </button>
              </div>
            )}
          </div>

          {reuniao.status !== "concluida" && (
            <div
              role={reuniao.status === "falhou" ? "alert" : "status"}
              className="mt-6 flex items-start gap-2.5 rounded border bg-white px-4 py-3 text-[0.8125rem]"
              style={reuniao.status === "falhou" ? { borderColor: "#D94A4A47", color: "#D94A4A" } : { borderColor: BORDA, color: "rgba(13,13,13,.55)" }}
            >
              <Mic size={15} aria-hidden="true" className="mt-0.5 shrink-0 opacity-70" />
              <span>
                {AVISO_DO_STATUS[reuniao.status]}
                {reuniao.status === "falhou" && reuniao.erro && <span className="block text-[0.75rem] opacity-80">{reuniao.erro}</span>}
              </span>
            </div>
          )}

          {temTranscricao && (
            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metrica rotulo="Duração" icone={Clock} valor={duracaoMs > 0 ? formatarDuracao(duracaoMs) : null} />
              <Metrica rotulo="Pessoas" icone={Users} valor={totalDePessoas > 0 ? String(totalDePessoas) : null} detalhe={totalDePessoas > 0 ? `${trechos.length} falas` : undefined} />
              <Metrica rotulo="Perguntas" icone={MessageCircleQuestion} valor={estatisticas.perguntas > 0 ? String(estatisticas.perguntas) : null} />
              <Metrica rotulo="Ritmo" icone={Gauge} valor={estatisticas.palavrasPorMinuto ? String(estatisticas.palavrasPorMinuto) : null} unidade="palavras/min" />
              <Metrica
                rotulo="Maior fala"
                className="col-span-2 lg:col-span-1"
                icone={Timer}
                valor={estatisticas.maiorFala ? String(Math.round(estatisticas.maiorFala.ms / 1000)) : null}
                unidade="s"
                detalhe={estatisticas.maiorFala?.falante}
              />
            </div>
          )}
        </div>
      </header>

      <DetailPageContent>
        <div className="grid gap-6 lg:grid-cols-[18.75rem_minmax(0,1fr)] lg:gap-7">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            {estatisticas.falantes.length > 0 && (
              <Cartao titulo="Quem falou" icone={Mic} contagem={estatisticas.falantes.length}>
                <ul className="-mx-2 flex flex-col gap-0.5">
                  {estatisticas.falantes.map((falante, i) => {
                    const ativo = falanteAtivo === falante.nome;
                    const cor = corDoFalante(falante.nome);
                    return (
                      <li key={falante.nome}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setFalanteAtivo(ativo ? null : falante.nome)}
                          title={ativo ? "Mostrar todas as falas" : `Mostrar só as falas de ${falante.nome}`}
                          className={`w-full rounded px-2 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] ${ativo ? "bg-black/[.05]" : "hover:bg-black/[.03]"} ${falanteAtivo && !ativo ? "opacity-45" : ""}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <Avatar nome={falante.nome} cor={cor} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.8125rem] font-medium text-[#282525]">{falante.nome}</span>
                              <span className="block text-[0.6875rem] text-black/40">{falante.falas} {falante.falas === 1 ? "fala" : "falas"} · {formatarDuracao(falante.ms)}</span>
                            </span>
                            <span className="text-[0.8125rem] font-semibold tabular-nums text-[#282525]">{porcentagens[i]}%</span>
                          </span>
                          <span className="mt-2 block h-1 overflow-hidden rounded-full bg-black/[.06]">
                            <span className="block h-full rounded-full" style={{ width: `${porcentagens[i]}%`, background: cor }} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            )}

            {proximosPassos.length > 0 && (
              <Cartao titulo="Próximos passos" icone={ListChecks} contagem={proximosPassos.length}>
                <ul className="-mx-1 flex flex-col">
                  {proximosPassos.map(passo => {
                    const criada = passosComAtividade.has(passo.id);
                    return (
                      <li key={passo.id} className="group flex items-start gap-2 rounded px-1 py-1.5 text-[0.8125rem] leading-snug text-black/70">
                        <span className="min-w-0 flex-1 pt-[0.1875rem]">
                          <Negrito texto={passo.texto} />
                          {passo.timestamp !== null && (
                            <button type="button" onClick={() => irParaMomento(passo.timestamp!)} className="ml-1.5 text-[0.6875rem] tabular-nums text-black/35 underline-offset-2 hover:text-black/60 hover:underline">
                              {formatarTimestamp(passo.timestamp)}
                            </button>
                          )}
                        </span>
                        {criada ? (
                          <span title="Atividade criada" className="flex h-7 w-7 shrink-0 items-center justify-center text-[#2E8932]">
                            <CircleCheck size={15} strokeWidth={1.9} aria-hidden="true" />
                            <span className="sr-only">Atividade criada</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPassoEmAtividade({ id: passo.id, texto: passo.texto })}
                            title="Criar atividade"
                            aria-label={`Criar atividade: ${passo.texto}`}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-95"
                          >
                            <CalendarPlus size={15} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            )}

            {destaques.length > 0 && (
              <Cartao titulo="Destaques" icone={Star} contagem={destaques.length}>
                <ul className="flex flex-col gap-2.5">
                  {destaques.map(m => (
                    <li key={m.id} className="text-[0.8125rem] leading-snug text-black/70">
                      {m.texto}
                      {m.timestamp_ms !== null && (
                        <button type="button" onClick={() => irParaMomento(m.timestamp_ms!)} className="ml-1.5 text-[0.6875rem] tabular-nums text-black/35 underline-offset-2 hover:text-black/60 hover:underline">
                          {formatarTimestamp(m.timestamp_ms)}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}

            {participantesSemFala.length > 0 && (
              <Cartao titulo={temTranscricao ? "Também na sala" : "Participantes"} icone={Users} contagem={participantesSemFala.length}>
                <ul className="flex flex-col gap-2">
                  {participantesSemFala.map(p => (
                    <li key={p.id} className="flex items-center gap-2.5">
                      <Avatar nome={p.nome ?? p.email ?? "?"} cor={COR_SEM_NOME} />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.8125rem] text-[#282525]">{p.nome ?? p.email}</span>
                        {p.nome && p.email && <span className="block truncate text-[0.6875rem] text-black/40">{p.email}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            {resumo.blocos.length > 0 && (
              <section className="rounded border bg-white px-5 py-5 sm:px-6" style={{ borderColor: BORDA }} aria-labelledby="titulo-resumo">
                <h2 id="titulo-resumo" className="mb-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Resumo</h2>
                <div className="flex max-w-[44rem] flex-col gap-3 text-[0.875rem] leading-relaxed text-black/70">
                  {resumo.blocos.map((bloco, i) => {
                    if (bloco.tipo === "titulo") return <h3 key={i} className="mt-1 text-[0.8125rem] font-semibold text-[#282525]">{bloco.texto}</h3>;
                    if (bloco.tipo === "lista") {
                      return (
                        <ul key={i} className="flex flex-col gap-1.5">
                          {bloco.itens.map((item, j) => (
                            <li key={j} className="flex gap-2.5">
                              <span aria-hidden="true" className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-black/30" />
                              <span><Negrito texto={item} /></span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={i}><Negrito texto={bloco.texto} /></p>;
                  })}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded border bg-white" style={{ borderColor: BORDA }} aria-labelledby="titulo-transcricao">
              <h2 id="titulo-transcricao" className="sr-only">Transcrição</h2>

              <div className="border-b px-4 pb-4 pt-4 sm:px-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <label className="flex h-11 items-center gap-2.5 rounded border bg-black/[.015] px-3 transition focus-within:border-[#7259B5]/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#7259B5]/15" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                  <Search size={14} aria-hidden="true" className="shrink-0 text-black/35" />
                  <span className="sr-only">Buscar na transcrição</span>
                  <input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar na transcrição"
                    disabled={!temTranscricao}
                    className="min-w-0 flex-1 bg-transparent text-[0.8125rem] text-[#282525] placeholder-black/30 outline-none disabled:cursor-not-allowed"
                  />
                  {filtrando && (
                    <span className="shrink-0 rounded bg-black/[.05] px-2 py-1 text-[0.625rem] font-medium tabular-nums text-black/55">
                      {trechosVisiveis.length} {trechosVisiveis.length === 1 ? "fala" : "falas"}
                    </span>
                  )}
                  {busca && (
                    <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="shrink-0 rounded p-1 text-black/35 hover:bg-black/[.05] hover:text-black/60">
                      <X size={13} />
                    </button>
                  )}
                </label>

                {mapa.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Mapa da conversa</p>
                      {falanteAtivo && (
                        <button type="button" onClick={() => setFalanteAtivo(null)} className="inline-flex items-center gap-1 text-[0.6875rem] text-black/45 hover:text-black/70">
                          Só {falanteAtivo.split(" ")[0]} <X size={11} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div
                      onClick={clicarNoMapa}
                      aria-hidden="true"
                      className="flex h-14 cursor-pointer items-center gap-[2px]"
                    >
                      {mapa.map((faixa, i) => {
                        const acesa = !filtrando || faixa.trechoIds.some(id => idsVisiveis.has(id));
                        const vazia = faixa.trechoIds.length === 0;
                        return (
                          <span
                            key={i}
                            title={vazia ? formatarTimestamp(faixa.inicioMs) : `${formatarTimestamp(faixa.inicioMs)} · ${faixa.falante}`}
                            className="min-w-0 flex-1 rounded-full transition-opacity duration-200"
                            style={{
                              height: vazia ? "8%" : `${Math.round(16 + 84 * faixa.intensidade ** 3)}%`,
                              background: vazia ? "rgba(13,13,13,.12)" : corDoFalante(faixa.falante),
                              opacity: acesa ? 1 : 0.18,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[0.625rem] tabular-nums text-black/35">
                      <span>00:00</span>
                      <span>{formatarTimestamp(fimDaConversa)}</span>
                    </div>
                  </div>
                )}
              </div>

              {!temTranscricao ? (
                <p className="px-4 py-16 text-center text-[0.8125rem] text-black/35">
                  {reuniao.status === "concluida" ? "Esta reunião não tem transcrição." : "A transcrição aparece aqui quando a reunião terminar."}
                </p>
              ) : trechosVisiveis.length === 0 ? (
                <p className="px-4 py-16 text-center text-[0.8125rem] text-black/35">
                  Nenhuma fala{termo ? <> com &ldquo;{termo}&rdquo;</> : null}{falanteAtivo ? ` de ${falanteAtivo}` : ""}.
                </p>
              ) : (
                <ol className="divide-y divide-black/[.05]">
                  {trechosVisiveis.map(trecho => {
                    const nome = trecho.falante?.trim() || "Sem nome";
                    const marcas = marcadoresDoTrecho(trecho);
                    const pergunta = ehPergunta(trecho.texto);
                    return (
                      <li
                        key={trecho.id}
                        id={`trecho-${trecho.id}`}
                        className={`grid scroll-mt-24 grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3.5 transition-colors duration-500 sm:grid-cols-[2rem_8.5rem_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-5 ${destacado === trecho.id ? "bg-black/[.045]" : ""}`}
                      >
                        <span className="row-span-2 pt-0.5 sm:row-span-1"><Avatar nome={nome} cor={corDoFalante(trecho.falante)} /></span>
                        <div className="min-w-0 pt-0.5">
                          <p className="truncate text-[0.75rem] font-semibold text-[#282525]">{nome}</p>
                          <p className="text-[0.6875rem] tabular-nums text-black/35">{formatarTimestamp(trecho.inicio_ms)}</p>
                        </div>
                        <p className="col-start-2 text-[0.875rem] leading-relaxed text-black/70 sm:col-start-auto">{realcar(trecho.texto, termo)}</p>
                        {(pergunta || marcas.length > 0) && (
                          <div className="col-start-2 flex flex-wrap items-start gap-1.5 sm:col-start-auto sm:justify-end sm:pt-0.5">
                            {pergunta && <Etiqueta cor="#2D72B0">Pergunta</Etiqueta>}
                            {marcas.some(m => m.tipo === "acao") && <Etiqueta cor="#1A8B7A">Próximo passo</Etiqueta>}
                            {marcas.some(m => m.tipo === "destaque") && <Etiqueta cor="#B07A14">Destaque</Etiqueta>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </div>
      </DetailPageContent>

      {passoEmAtividade && (
        <NovaAtividadeModal
          prefill={{
            nome: passoEmAtividade.texto.replace(/\*\*/g, ""),
            tipo: tipoSugeridoDoPasso(passoEmAtividade.texto),
            captacao_id: reuniao.captacao_id ?? undefined,
            empresa_crm_id: reuniao.empresa_crm_id ?? undefined,
          }}
          onClose={() => setPassoEmAtividade(null)}
          onSaved={() => {
            const id = passoEmAtividade.id;
            setPassosComAtividade(atuais => new Set(atuais).add(id));
            setPassoEmAtividade(null);
          }}
        />
      )}
    </div>
  );
}
