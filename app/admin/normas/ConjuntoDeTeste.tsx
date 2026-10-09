"use client";

// Conjunto de teste do agente normativo (P6.5): a última rodada, caso a caso,
// com o que a IA acertou, o que faltou, o valor errado e o falso alarme; o
// histórico das rodadas; e o botão para rodar de novo. A rodada é do modo
// "avaliar" da função agente-normativo e não gera proposta.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, FlaskConical, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { rotuloDoCaminho, valorLegivel } from "@/lib/prestacao/regimes/revisao";

type Nota = {
  id: string;
  execucao_id: string;
  caso: string;
  titulo: string;
  regime_codigo: string;
  documento: string;
  classificacao: string | null;
  classificacao_certa: boolean | null;
  esperadas: number;
  acertos: number;
  erradas: number;
  faltas: number;
  falsos_alarmes: number;
  cobertura: number | null;
  custo_usd: number | null;
  erro: string | null;
  created_at: string;
  resultado: {
    resumo?: string;
    faltas?: { caminho: string; esperado: unknown; atual: unknown }[];
    erradas?: { caminho: string; esperado: unknown; proposto: unknown }[];
    falsosAlarmes?: { caminho: string; proposto: unknown; esperado: unknown }[];
    extrasCertos?: number;
    redacao?: number;
    descartadas?: number;
  };
};

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const VERDE = "#2E8932";
const AMBAR = "#B07A14";
const VERMELHO = "#B23B3B";
const CLASSIFICACAO: Record<string, string> = { altera_regra: "muda regras", informativo: "informativo", irrelevante: "sem relação" };

const horaBr = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: `${cor}47`, color: cor }}>{texto}</span>
  );
}

type Totais = { casos: number; esperadas: number; acertos: number; alarmes: number; certas: number; falhas: number };

function totais(notas: Nota[]): Totais {
  return notas.reduce<Totais>((t, n) => ({
    casos: t.casos + 1,
    esperadas: t.esperadas + (n.erro ? 0 : n.esperadas),
    acertos: t.acertos + n.acertos,
    alarmes: t.alarmes + n.falsos_alarmes,
    certas: t.certas + (n.classificacao_certa ? 1 : 0),
    falhas: t.falhas + (n.erro ? 1 : 0),
  }), { casos: 0, esperadas: 0, acertos: 0, alarmes: 0, certas: 0, falhas: 0 });
}

function CasoDaRodada({ n, regime }: { n: Nota; regime: unknown }) {
  const rotulo = (caminho: string) => rotuloDoCaminho(regime, caminho);
  const r = n.resultado ?? {};
  const linhas = [
    ...(r.erradas ?? []).map(e => ({ chave: `e:${e.caminho}`, cor: VERMELHO, rotulo: rotulo(e.caminho), texto: `a IA propôs ${valorLegivel(e.proposto)}; o certo é ${valorLegivel(e.esperado)}` })),
    ...(r.faltas ?? []).map(f => ({ chave: `f:${f.caminho}`, cor: AMBAR, rotulo: rotulo(f.caminho), texto: `faltou: ficou ${valorLegivel(f.atual)}, o certo é ${valorLegivel(f.esperado)}` })),
    ...(r.falsosAlarmes ?? []).map(f => ({
      chave: `a:${f.caminho}`, cor: VERMELHO, rotulo: rotulo(f.caminho),
      texto: `falso alarme: a IA propôs ${valorLegivel(f.proposto)}${f.esperado !== null && f.esperado !== undefined ? `; o regime conferido tem ${valorLegivel(f.esperado)}` : ""}`,
    })),
  ];
  const extras = [
    r.extrasCertos ? plural(r.extrasCertos, "mudança a mais que bate com o regime conferido", "mudanças a mais que batem com o regime conferido") : null,
    r.redacao ? plural(r.redacao, "mudança de redação", "mudanças de redação") : null,
    r.descartadas ? plural(r.descartadas, "descartada por citação ou caminho", "descartadas por citação ou caminho") : null,
  ].filter(Boolean);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-full min-w-0 text-[0.8125rem] font-medium text-[#0D0D0D] sm:w-auto sm:flex-1">{n.titulo}</span>
        {n.erro ? (
          <Etiqueta texto="Não rodou" cor={VERMELHO} />
        ) : (
          <>
            <Etiqueta texto={`Classificou: ${CLASSIFICACAO[n.classificacao ?? ""] ?? "—"}`} cor={n.classificacao_certa ? VERDE : VERMELHO} />
            {n.esperadas > 0 && (
              <span className="text-[0.75rem] tabular-nums text-black/70">{n.acertos} de {n.esperadas} mudanças</span>
            )}
            <span className={`inline-flex items-center gap-1 text-[0.75rem] tabular-nums ${n.falsos_alarmes ? "text-black/70" : "text-black/50"}`}>
              {n.falsos_alarmes > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]" />}
              {plural(n.falsos_alarmes, "falso alarme", "falsos alarmes")}
            </span>
          </>
        )}
      </div>
      <p className="mt-0.5 text-[0.6875rem] text-black/45">Regime {n.regime_codigo} · {n.documento}</p>
      {n.erro && <p className="mt-1 text-[0.75rem] text-[#B23B3B]">{n.erro}</p>}
      {linhas.length > 0 && (
        <ul className="mt-2 space-y-1">
          {linhas.map(l => (
            <li key={l.chave} className="border-l-2 pl-2.5 text-[0.75rem] leading-relaxed" style={{ borderColor: l.cor }}>
              <span className="text-black/60">{l.rotulo}</span> <span className="text-black/80">— {l.texto}</span>
            </li>
          ))}
        </ul>
      )}
      {extras.length > 0 && <p className="mt-1.5 text-[0.6875rem] text-black/45">Também: {extras.join(" · ")}.</p>}
      {r.resumo && (
        <details className="mt-1.5">
          <summary className="cursor-pointer rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Resumo da IA</summary>
          <p className="mt-1 text-[0.75rem] leading-relaxed text-black/60">{r.resumo}</p>
        </details>
      )}
    </li>
  );
}

export function ConjuntoDeTeste() {
  const supabase = useMemo(() => createClient(), []);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [regimes, setRegimes] = useState<Record<string, unknown>>({});
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
    const { data, error } = await (supabase as any).from("normas_avaliacoes")
      .select("id, execucao_id, caso, titulo, regime_codigo, documento, classificacao, classificacao_certa, esperadas, acertos, erradas, faltas, falsos_alarmes, cobertura, custo_usd, erro, created_at, resultado")
      .order("created_at", { ascending: false }).limit(60);
    const lidas = (data ?? []) as Nota[];
    const codigos = [...new Set(lidas.map(n => n.regime_codigo))];
    const comParametros = codigos.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_regimes ainda não está no tipo Database
      ? await (supabase as any).from("prestacao_regimes").select("codigo, parametros").eq("status", "publicado").in("codigo", codigos)
      : { data: [] };
    return { error, lidas, parametros: (comParametros.data ?? []) as { codigo: string; parametros: unknown }[] };
  }, [supabase]);

  const aplicar = useCallback(({ error, lidas, parametros }: Awaited<ReturnType<typeof buscar>>) => {
    if (error) { setErro("Não foi possível carregar as rodadas."); setNotas([]); return; }
    setNotas(lidas);
    setRegimes(Object.fromEntries(parametros.map(r => [r.codigo, r.parametros])));
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  // A função responde com o id da rodada e lê em segundo plano: a tela
  // acompanha a rodada em agente_execucoes até ela terminar.
  async function rodar() {
    setRodando(true);
    setErro("");
    const { data, error } = await supabase.functions.invoke("agente-normativo", { body: { modo: "avaliar" } });
    const execucao = (data as { execucao?: string } | null)?.execucao;
    if (error || !execucao) {
      setRodando(false);
      setErro("Não foi possível rodar o conjunto agora.");
      return;
    }
    const limite = Date.now() + 6 * 60_000;
    let fim: { situacao: string; detalhe: string | null } | null = null;
    while (!fim && Date.now() < limite) {
      await new Promise(resolve => setTimeout(resolve, 4_000));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
      const { data: linha } = await (supabase as any).from("agente_execucoes").select("situacao, detalhe").eq("id", execucao).maybeSingle();
      if (linha && linha.situacao !== "rodando") fim = linha;
    }
    setRodando(false);
    if (!fim) setErro("A rodada ainda não terminou. Atualize a página daqui a pouco.");
    else if (fim.situacao === "falhou") setErro(`A rodada falhou: ${fim.detalhe ?? "sem detalhe"}.`);
    aplicar(await buscar());
  }

  // As rodadas, da mais nova para a mais velha, com as notas de cada uma.
  const rodadas = useMemo(() => {
    const porExecucao = new Map<string, Nota[]>();
    for (const n of notas ?? []) porExecucao.set(n.execucao_id, [...(porExecucao.get(n.execucao_id) ?? []), n]);
    return [...porExecucao.values()].map(lista => ({ quando: lista[0].created_at, notas: [...lista].sort((a, b) => a.titulo.localeCompare(b.titulo)) }));
  }, [notas]);
  const ultima = rodadas[0];
  const t = ultima ? totais(ultima.notas) : null;
  const custo = ultima?.notas.reduce((soma, n) => soma + (n.custo_usd ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <section className="rounded border bg-white px-5 py-4" style={BORDA} aria-labelledby="titulo-conjunto">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[48rem]">
            <h2 id="titulo-conjunto" className="text-[0.875rem] font-semibold text-[#0D0D0D]">Conjunto de teste do agente</h2>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-black/55">
              A IA lê as mudanças de 2026 a partir do regime antigo (Portaria 424 → Portaria MESP 10/2026; Anexo LXXXVI → LXXXVI-A), uma alteração simulada da IN 29 e dois documentos que não mudam nada.
              A proposta é comparada com os regimes conferidos à mão, parâmetro a parâmetro; nada vira proposta de verdade.
            </p>
          </div>
          <button type="button" onClick={rodar} disabled={rodando}
            className="flex h-10 items-center gap-1.5 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/75 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            <RefreshCw size={13} className={rodando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
            {rodando ? "Lendo os casos…" : "Rodar o conjunto"}
          </button>
        </div>
        {rodando && <p className="mt-3 text-[0.75rem] text-black/55">A IA lê os casos ao mesmo tempo; a rodada leva de um a dois minutos.</p>}
        {erro && <p role="alert" className="mt-3 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
        {t && ultima && (
          <p className="mt-3 text-[0.75rem] tabular-nums text-black/70" role="status">
            Última rodada em {horaBr(ultima.quando)}: <strong className="font-semibold text-[#0D0D0D]">{t.acertos} de {t.esperadas} mudanças esperadas</strong>
            {t.esperadas ? ` (${Math.round((t.acertos / t.esperadas) * 100)}%)` : ""} · {plural(t.alarmes, "falso alarme", "falsos alarmes")} ·{" "}
            {t.certas} de {t.casos} classificações certas{t.falhas ? ` · ${plural(t.falhas, "caso não rodou", "casos não rodaram")}` : ""}
            {custo > 0 ? ` · US$ ${custo.toFixed(4)}` : ""}
          </p>
        )}
      </section>

      {notas === null ? (
        <div className="h-48 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
      ) : !ultima ? (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <FlaskConical size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">Nenhuma rodada ainda. Rode o conjunto para ver como a IA se sai em cada caso.</p>
        </div>
      ) : (
        <>
          <section className="rounded border bg-white" style={BORDA} aria-labelledby="titulo-ultima-rodada">
            <h3 id="titulo-ultima-rodada" className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              Casos da última rodada
            </h3>
            <ul className="divide-y divide-black/[.06]">
              {ultima.notas.map(n => <CasoDaRodada key={n.id} n={n} regime={regimes[n.regime_codigo]} />)}
            </ul>
          </section>

          {rodadas.length > 1 && (
            <section className="rounded border bg-white" style={BORDA} aria-labelledby="titulo-rodadas">
              <h3 id="titulo-rodadas" className="border-b px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                Rodadas anteriores
              </h3>
              <ul className="divide-y divide-black/[.06]">
                {rodadas.slice(1, 10).map(r => {
                  const x = totais(r.notas);
                  return (
                    <li key={r.quando} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[0.75rem] tabular-nums">
                      <span className="w-[7rem] text-black/55">{horaBr(r.quando)}</span>
                      <span className="text-black/75">{x.acertos} de {x.esperadas} mudanças</span>
                      <span className={`inline-flex items-center gap-1 ${x.alarmes ? "text-black/70" : "text-black/50"}`}>
                        {x.alarmes > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]" />}
                        {plural(x.alarmes, "falso alarme", "falsos alarmes")}
                      </span>
                      <span className="text-black/55">{x.certas} de {x.casos} classificações certas</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
