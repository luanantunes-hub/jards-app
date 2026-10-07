"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronDown, Info, RefreshCw, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { destinoDaChecagem, pendenciasPorSeveridade, tituloDaChecagem, type DestinoDaChecagem } from "@/lib/prestacao/checagens";
import { mensagemErroPrestacao, type PermissoesPrestacao } from "@/lib/prestacao/status";
import { EVENTO_VERIFICADA, verificarAgora } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoVerificacao } from "@/lib/supabase/types";

/** Verificação mais velha que isso roda de novo quando o painel abre. */
const VALIDADE_MS = 10 * 60 * 1000;

const SEVERIDADE = {
  bloqueio: { rotulo: "Bloqueia o envio", cor: "#B23B3B", icone: Ban },
  alerta: { rotulo: "Revisar ou justificar", cor: "#B07A14", icone: AlertTriangle },
  justificativa: { rotulo: "Pede justificativa", cor: "#B07A14", icone: AlertTriangle },
  info: { rotulo: "Aviso", cor: "#2D72B0", icone: Info },
} as const;

const ORDEM: Record<PrestacaoVerificacao["severidade"], number> = { bloqueio: 0, alerta: 1, justificativa: 1, info: 2 };
const LIMITE = 8;

const DESTINOS: Record<DestinoDaChecagem, { caminho: string; rotulo: string }> = {
  visao_geral: { caminho: "#dados-oficiais", rotulo: "Preencher dados" },
  orcamento: { caminho: "/orcamento", rotulo: "Abrir orçamento" },
  comprovantes: { caminho: "/comprovantes", rotulo: "Abrir despesas" },
  extrato: { caminho: "/extrato", rotulo: "Abrir extrato" },
  conciliacao: { caminho: "/conciliacao", rotulo: "Conciliar" },
  objeto: { caminho: "/objeto", rotulo: "Abrir objeto" },
  atividades: { caminho: "/atividades", rotulo: "Abrir atividades" },
};

function destino(prestacaoId: string, v: PrestacaoVerificacao): { href: string; rotulo: string } {
  const qual = destinoDaChecagem(v.check_codigo);
  // O achado de uma despesa abre a própria despesa na aba de comprovantes.
  if (qual === "comprovantes" && v.entidade_tipo === "despesa" && v.entidade_id) {
    return { href: `/prestacoes/${prestacaoId}/comprovantes?despesa=${v.entidade_id}`, rotulo: "Abrir despesa" };
  }
  // O achado de uma meta, de um local ou de uma evidência abre o cadastro na aba Objeto.
  if (qual === "objeto" && (v.entidade_tipo === "meta" || v.entidade_tipo === "local" || v.entidade_tipo === "evidencia") && v.entidade_id) {
    const rotulo = { meta: "Abrir meta", local: "Abrir local", evidencia: "Abrir evidência" }[v.entidade_tipo];
    return { href: `/prestacoes/${prestacaoId}/objeto?${v.entidade_tipo}=${v.entidade_id}`, rotulo };
  }
  const { caminho, rotulo } = DESTINOS[qual];
  return { href: caminho.startsWith("#") ? caminho : `/prestacoes/${prestacaoId}${caminho}`, rotulo };
}

function quando(iso: string | null): string {
  if (!iso) return "ainda não verificada";
  const data = new Date(iso);
  const hoje = new Date().toDateString() === data.toDateString();
  return `verificada ${hoje ? "às" : "em"} ${data.toLocaleString("pt-BR", hoje ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
}

function Item({ v, prestacaoId, permissoes, onDecidir, emEdicao, onEditar }: {
  v: PrestacaoVerificacao;
  prestacaoId: string;
  permissoes: PermissoesPrestacao;
  onDecidir: (v: PrestacaoVerificacao, status: "justificada" | "dispensada" | "aberta", texto?: string) => Promise<string | null>;
  emEdicao: "justificada" | "dispensada" | null;
  onEditar: (status: "justificada" | "dispensada" | null) => void;
}) {
  const idTexto = useId();
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const meta = SEVERIDADE[v.severidade];
  const Icone = meta.icone;
  const decidida = v.status === "justificada" || v.status === "dispensada";
  const ir = destino(prestacaoId, v);
  const sobre = typeof v.dados?.despesa === "string" ? v.dados.despesa : null;

  async function salvar() {
    if (!emEdicao) return;
    setSalvando(true);
    setErro("");
    const falha = await onDecidir(v, emEdicao, texto);
    setSalvando(false);
    if (falha) { setErro(falha); return; }
    setTexto("");
    onEditar(null);
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Icone size={14} className="mt-0.5 shrink-0" style={{ color: decidida ? "rgba(13,13,13,.35)" : meta.cor }} aria-label={meta.rotulo} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-medium text-black/80">
            {tituloDaChecagem(v.check_codigo)}
            {sobre && <span className="font-normal text-black/45"> · {sobre}</span>}
          </p>
          <p className="mt-0.5 text-[0.6875rem] leading-4 text-black/60">{v.mensagem}</p>
          {v.fonte && (
            <p className="mt-1 text-[0.625rem] text-black/40" title={v.fonte.citacao ?? v.fonte.regra?.descricao ?? undefined}>
              Fonte: {v.fonte.documento}, {v.fonte.dispositivo}{v.fonte.aConfirmar ? " (a confirmar)" : ""}
            </p>
          )}
          {decidida && v.justificativa && (
            <p className="mt-1 text-[0.6875rem] leading-4 text-black/55">
              <span className="font-medium">{v.status === "dispensada" ? "Dispensada" : "Justificada"}:</span> {v.justificativa}
            </p>
          )}

          {emEdicao ? (
            <div className="mt-2">
              <label htmlFor={idTexto} className="mb-1 block text-[0.625rem] font-medium text-black/45">
                {emEdicao === "dispensada" ? "Por que dispensar (fica no histórico)" : "Justificativa (entra no relatório e no histórico)"}
              </label>
              <textarea
                id={idTexto}
                value={texto}
                onChange={e => setTexto(e.target.value)}
                rows={2}
                autoFocus
                className="w-full rounded border border-black/[.12] px-3 py-2 text-[0.75rem] outline-none transition focus:border-[#7259B5] focus-visible:ring-2 focus-visible:ring-[#7259B5]/20"
              />
              {erro && <p role="alert" className="mt-1 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { onEditar(null); setErro(""); }} className="rounded px-3 py-1.5 text-[0.6875rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvar}
                  disabled={salvando}
                  className="rounded bg-[#2E8932] px-3 py-1.5 text-[0.6875rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
              {!decidida && (
                <Link href={ir.href} className="flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  {ir.rotulo} <ArrowRight size={11} aria-hidden />
                </Link>
              )}
              {!decidida && permissoes.editar && v.severidade !== "bloqueio" && v.severidade !== "info" && (
                <button type="button" onClick={() => onEditar("justificada")} className="rounded px-1.5 py-1 text-[0.6875rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Justificar
                </button>
              )}
              {!decidida && permissoes.avaliar && (
                <button type="button" onClick={() => onEditar("dispensada")} className="rounded px-1.5 py-1 text-[0.6875rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Dispensar
                </button>
              )}
              {decidida && permissoes.editar && (
                <button type="button" onClick={async () => { const falha = await onDecidir(v, "aberta"); if (falha) setErro(falha); }} className="flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] text-black/55 transition hover:bg-black/[.04] hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <RotateCcw size={11} aria-hidden /> Reabrir
                </button>
              )}
              {!emEdicao && erro && <p role="alert" className="w-full text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Grupo({ titulo, itens, aberto: abertoInicial, children }: { titulo: string; itens: number; aberto: boolean; children: (limite: number | null) => React.ReactNode }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [todos, setTodos] = useState(false);
  const idLista = useId();
  if (!itens) return null;
  return (
    <div className="border-t first:border-t-0" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        aria-controls={idLista}
        className="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left text-[0.6875rem] font-medium text-black/60 transition hover:bg-black/[.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
      >
        <span>{titulo} <span className="tabular-nums text-black/35">({itens})</span></span>
        <ChevronDown size={13} className={`transition-transform duration-200 motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {aberto && (
        <div id={idLista} className="px-5 pb-2">
          <ul className="divide-y divide-black/[.05]">{children(todos ? null : LIMITE)}</ul>
          {!todos && itens > LIMITE && (
            <button type="button" onClick={() => setTodos(true)} className="mb-2 rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Mostrar as {itens}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Verificações do motor de checagens (P2.7): o que bloqueia o envio, o que
 * pede revisão ou justificativa e os avisos, cada um com a fonte e o caminho
 * para resolver. Justificar pede o papel de editar; dispensar, o de avaliar.
 * Em `resumo` (visão geral), só as contagens e o caminho para a aba Pendências.
 */
export function VerificacoesPrestacao({ prestacaoId, permissoes, resumo = false }: { prestacaoId: string; permissoes: PermissoesPrestacao; resumo?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [dados, setDados] = useState<{ prestacaoId: string; lista: PrestacaoVerificacao[]; verificadaEm: string | null } | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const [edicao, setEdicao] = useState<{ id: string; status: "justificada" | "dispensada" } | null>(null);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [lista, prestacao] = await Promise.all([
      db.from("prestacao_verificacoes").select("*").eq("prestacao_id", prestacaoId).neq("status", "resolvida").order("detectada_em"),
      db.from("prestacoes_contas").select("verificada_em").eq("id", prestacaoId).maybeSingle(),
    ]);
    if (lista.error) return { erro: mensagemErroPrestacao(lista.error, "Não foi possível ler as verificações"), lidas: null };
    return {
      erro: "",
      lidas: { prestacaoId, lista: (lista.data ?? []) as PrestacaoVerificacao[], verificadaEm: (prestacao.data?.verificada_em as string | null) ?? null },
    };
  }, [prestacaoId, supabase]);

  const ler = useCallback(async () => {
    const { erro: falha, lidas } = await buscar();
    if (falha) setErro(falha);
    else setDados(lidas);
  }, [buscar]);

  const verificar = useCallback(async () => {
    setRodando(true);
    setErro("");
    try {
      await verificarAgora(prestacaoId);
    } catch (e) {
      setErro(mensagemErroPrestacao({ message: e instanceof Error ? e.message : "" }, "Não foi possível verificar agora"));
    }
    setRodando(false);
  }, [prestacaoId]);

  // Abre lendo; verificação velha (ou nunca feita) roda de novo sozinha.
  useEffect(() => {
    let ativo = true;
    buscar().then(({ erro: falha, lidas }) => {
      if (!ativo) return;
      if (falha || !lidas) { setErro(falha); return; }
      setDados(lidas);
      const velha = !lidas.verificadaEm || Date.now() - new Date(lidas.verificadaEm).getTime() > VALIDADE_MS;
      if (velha) verificar();
    });
    return () => { ativo = false; };
  }, [buscar, verificar]);

  useEffect(() => {
    const aoVerificar = (e: Event) => {
      if ((e as CustomEvent<{ prestacaoId: string }>).detail?.prestacaoId === prestacaoId) ler();
    };
    window.addEventListener(EVENTO_VERIFICADA, aoVerificar);
    return () => window.removeEventListener(EVENTO_VERIFICADA, aoVerificar);
  }, [ler, prestacaoId]);

  async function decidir(v: PrestacaoVerificacao, status: "justificada" | "dispensada" | "aberta", texto?: string): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função ainda não está no tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_verificacao_decidir", { p_verificacao_id: v.id, p_status: status, p_justificativa: texto ?? null });
    if (error) return mensagemErroPrestacao(error, "Não foi possível salvar");
    await ler();
    return null;
  }

  const lista = dados?.prestacaoId === prestacaoId ? dados.lista : [];
  const abertas = lista.filter(v => v.status === "aberta").sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]);
  const bloqueios = abertas.filter(v => v.severidade === "bloqueio");
  const revisar = abertas.filter(v => v.severidade === "alerta" || v.severidade === "justificativa");
  const avisos = abertas.filter(v => v.severidade === "info");
  // Decisão sobre algo que não apareceu na última verificação (a despesa saiu, o débito foi desfeito) fica guardada, fora da lista.
  const ultima = dados?.verificadaEm ? Date.parse(dados.verificadaEm) : null;
  const decididas = lista.filter(v => (v.status === "justificada" || v.status === "dispensada") && (ultima === null || Date.parse(v.visto_em) >= ultima));
  const contagem = pendenciasPorSeveridade(lista);
  const carregado = dados?.prestacaoId === prestacaoId;

  const itens = (grupo: PrestacaoVerificacao[]) => (limite: number | null) =>
    (limite ? grupo.slice(0, limite) : grupo).map(v => (
      <Item
        key={v.id}
        v={v}
        prestacaoId={prestacaoId}
        permissoes={permissoes}
        onDecidir={decidir}
        emEdicao={edicao?.id === v.id ? edicao.status : null}
        onEditar={status => setEdicao(status ? { id: v.id, status } : null)}
      />
    ));

  return (
    <section aria-labelledby="verificacoes-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="min-w-0">
          <h2 id="verificacoes-titulo" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">Verificações</h2>
          <p className="mt-1 text-[0.75rem] text-black/65" aria-live="polite">
            {!carregado ? "Carregando…" : (
              <>
                {contagem.bloqueio > 0 && <span className="font-medium text-[#B23B3B] tabular-nums">{contagem.bloqueio} {contagem.bloqueio === 1 ? "bloqueia" : "bloqueiam"} o envio · </span>}
                <span className="tabular-nums">{contagem.alerta + contagem.justificativa}</span> a revisar ou justificar
                {avisos.length > 0 && <span className="text-black/45"> · <span className="tabular-nums">{avisos.length}</span> {avisos.length === 1 ? "aviso" : "avisos"}</span>}
              </>
            )}
          </p>
          <p className="mt-0.5 text-[0.625rem] text-black/40">{rodando ? "Verificando…" : quando(dados?.verificadaEm ?? null)}</p>
        </div>
        <button
          type="button"
          onClick={verificar}
          disabled={rodando}
          className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
          style={{ borderColor: "rgba(13,13,13,.16)" }}
        >
          <RefreshCw size={13} className={rodando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden /> Verificar agora
        </button>
      </div>

      {erro && <p role="alert" className="mx-5 mt-3 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

      {carregado && !abertas.length && !decididas.length && (
        <p className="flex items-center gap-2 px-5 py-4 text-[0.75rem] text-black/55">
          <CheckCircle2 size={14} className="shrink-0 text-[#2E8932]" aria-hidden />
          {dados?.verificadaEm ? "Nenhuma pendência nas checagens." : "Ainda sem verificação."}
        </p>
      )}

      {resumo ? (
        carregado && (abertas.length > 0 || decididas.length > 0) && (
          <div className="px-5 py-3">
            <Link href={`/prestacoes/${prestacaoId}/pendencias`} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Ver pendências por item <ArrowRight size={11} aria-hidden />
            </Link>
          </div>
        )
      ) : <>
      <Grupo titulo="Bloqueiam o envio" itens={bloqueios.length} aberto>{itens(bloqueios)}</Grupo>
      <Grupo titulo="Revisar ou justificar" itens={revisar.length} aberto>{itens(revisar)}</Grupo>
      <Grupo titulo="Avisos" itens={avisos.length} aberto={false}>{itens(avisos)}</Grupo>
      <Grupo titulo="Justificadas e dispensadas" itens={decididas.length} aberto={false}>{itens(decididas)}</Grupo>
      </>}
    </section>
  );
}
