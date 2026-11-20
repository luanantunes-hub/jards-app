"use client";

// Planilhas da saúde (P9.3): a Planilha II (conciliação bancária), a Tabela 1
// (rendimentos de aplicação financeira), as informações compiladas e a relação
// de bens com o inventário, montadas da prestação para a prestação anual de um
// exercício ou para a final. As colunas seguem o roteiro de análise do MS,
// porque o Manual Orientativo do Anexo LXXXVI-A ainda não foi publicado.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Download, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { exerciciosDaPrestacao } from "@/lib/prestacao/exercicios";
import { MESES, nomeDasPlanilhas, planilhasDaSaude, type BemDaRelacao, type PeriodoDasPlanilhas } from "@/lib/prestacao/planilhas-saude";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CABECALHO = "px-3 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#282525]" : "text-black/30"}`;
const LINK = "inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]";
const reais = (c: number | null) => (c === null ? "—" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

type Prestacao = { titulo: string; identificador_oficial: string | null; proponente: { nome: string } | null };

function Criticas({ criticas }: { criticas: readonly string[] }) {
  if (!criticas.length) return null;
  return (
    <span className="mt-0.5 flex items-start gap-1 text-[0.625rem] text-black/50">
      <AlertTriangle size={12} strokeWidth={1.75} aria-label="Atenção" className="mt-px shrink-0 text-[#B07A14]" />
      {criticas.join("; ").replace(/^./, c => c.toUpperCase())}.
    </span>
  );
}

export default function PlanilhasDaSaudePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { dados, erro: erroDoEnvio } = useDadosDoEnvio(id);
  const [extras, setExtras] = useState<{ prestacao: Prestacao | null; bens: BemDaRelacao[]; tomadores: string[]; erro: string } | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoDasPlanilhas>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    Promise.all([
      db.from("prestacoes_contas").select("titulo, identificador_oficial, proponente:proponente_id(nome)").eq("id", id).maybeSingle(),
      db.from("prestacao_bens").select("id, tipo, descricao, quantidade, valor, numero_patrimonio, despesa_id, destinacao, beneficiario").eq("prestacao_id", id).order("ordem").order("created_at"),
      // Documento em nome de outra pessoa (P2.4): o requisito "nome da instituição" da Planilha II.
      db.from("prestacao_verificacoes").select("entidade_id").eq("prestacao_id", id).eq("check_codigo", "DOC_TOMADOR").eq("status", "aberta"),
    ]).then(([p, b, v]) => {
      if (!ativo) return;
      const falha = p.error ?? b.error ?? v.error;
      setExtras({
        prestacao: (p.data ?? null) as Prestacao | null,
        bens: (b.data ?? []) as BemDaRelacao[],
        tomadores: ((v.data ?? []) as { entidade_id: string | null }[]).map(x => x.entidade_id).filter((x): x is string => Boolean(x)),
        erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar as planilhas") : "",
      });
    });
    return () => { ativo = false; };
  }, [id, supabase]);

  const exercicios = useMemo(() => (dados ? exerciciosDaPrestacao(dados.regime, dados.estado.prestacao ?? {}) : []), [dados]);
  const planilhas = useMemo(
    () => (dados && extras ? planilhasDaSaude(dados.estado, extras.bens, periodo, new Set(extras.tomadores)) : null),
    [dados, extras, periodo],
  );

  async function baixar() {
    if (!planilhas || !extras?.prestacao) return;
    setGerando(true);
    setErro("");
    try {
      const [X, { gravarPlanilhasDaSaude }] = await Promise.all([import("xlsx"), import("@/lib/prestacao/planilhas-saude-xlsx")]);
      const bytes = gravarPlanilhasDaSaude(X, planilhas, {
        titulo: extras.prestacao.titulo,
        nup: extras.prestacao.identificador_oficial,
        proponente: extras.prestacao.proponente?.nome ?? null,
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDasPlanilhas(extras.prestacao.identificador_oficial, periodo);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar as planilhas.");
    }
    setGerando(false);
  }

  const erroGeral = erro || erroDoEnvio || extras?.erro;
  const naoESaude = dados?.regime && dados.regime.area !== "saude";
  const c = planilhas?.compiladas;
  const totalPago = planilhas?.planilhaII.reduce((s, l) => s + l.valorPago, 0) ?? 0;
  const anos = planilhas ? [...new Set(planilhas.tabela1.map(l => l.ano))] : [];

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Planilhas da saúde</h2>
          <p className="max-w-[46rem] text-[0.6875rem] text-black/45">
            A Planilha II (conciliação bancária), a Tabela 1 (rendimentos), as informações compiladas e a relação de bens, montadas das despesas, dos pagamentos, do extrato e dos bens, para a prestação anual de um exercício ou para a final.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exercicios.length > 0 && (
            <div className="w-[17rem] max-w-full">
              <Dropdown
                value={periodo === null ? "final" : String(periodo)}
                onChange={v => setPeriodo(v === "final" ? null : Number(v))}
                ariaLabel="Período das planilhas"
                options={[
                  { value: "final", label: "Execução inteira (prestação final)" },
                  ...exercicios.map(e => ({ value: String(e.ano), label: `Exercício ${e.ano}${e.naFinal ? " (vai na final)" : ""}` })),
                ]}
              />
            </div>
          )}
          <button
            type="button"
            onClick={baixar}
            disabled={!planilhas || !extras?.prestacao || gerando}
            className="flex h-9 items-center gap-1.5 rounded bg-[#1C0E33] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {gerando
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />
              : <Download size={13} aria-hidden />}
            Baixar planilhas (.xlsx)
          </button>
        </div>
      </div>

      {erroGeral && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erroGeral}</p>}
      <p className="flex items-start gap-1.5 rounded border bg-white px-4 py-2.5 text-[0.6875rem] text-black/55" style={BORDA}>
        <Info size={13} className="mt-px shrink-0 text-black/40" aria-hidden />
        {naoESaude
          ? "As planilhas são da prestação do Pronon e do Pronas/PCD; o regime desta prestação tem outras saídas."
          : "O Manual Orientativo do Anexo LXXXVI-A, com os modelos novos do Ministério, ainda não foi publicado: as colunas seguem o roteiro de análise do MS. A página do processo no SEI fica em branco para completar."}
      </p>

      {!planilhas && !erroGeral && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {planilhas && c && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 md:grid-cols-5" style={BORDA}>
            <div><dt className={ROTULO}>Despesas</dt><dd className={`mt-0.5 text-[0.9375rem] ${VALOR(planilhas.planilhaII.length)}`}>{planilhas.planilhaII.length}</dd></div>
            <div><dt className={ROTULO}>Valor pago</dt><dd className={`mt-0.5 text-[0.9375rem] ${VALOR(totalPago)}`}>{reais(totalPago)}</dd></div>
            <div><dt className={ROTULO}>Rendimentos líquidos</dt><dd className={`mt-0.5 text-[0.9375rem] ${VALOR(c.rendimentos)}`}>{reais(c.rendimentos)}</dd></div>
            <div><dt className={ROTULO}>Saldo remanescente</dt><dd className={`mt-0.5 text-[0.9375rem] ${VALOR(c.saldoRemanescente)}`}>{reais(c.saldoRemanescente)}</dd></div>
            <div>
              <dt className={`${ROTULO} flex items-center gap-1`}>
                {planilhas.criticas > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                Linhas para revisar
              </dt>
              <dd className={`mt-0.5 text-[0.9375rem] ${VALOR(planilhas.criticas)}`}>{planilhas.criticas}</dd>
            </div>
          </dl>

          <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="planilha-ii">
            <h3 id="planilha-ii" className="border-b px-5 py-3 text-[0.75rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              Planilha II – conciliação bancária <span className="font-normal tabular-nums text-black/35">({planilhas.planilhaII.length})</span>
            </h3>
            {planilhas.planilhaII.length === 0 ? (
              <p className="px-5 py-8 text-center text-[0.75rem] text-black/50">Nenhuma despesa no período. As despesas de Comprovantes, com os pagamentos, entram aqui.</p>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-[0.75rem]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                        <th className={CABECALHO}>N.</th>
                        <th className={`${CABECALHO} w-full`}>Favorecido e despesa</th>
                        <th className={CABECALHO}>Documento</th>
                        <th className={`${CABECALHO} text-right`}>Valor</th>
                        <th className={`${CABECALHO} text-right`}>Retido</th>
                        <th className={`${CABECALHO} text-right`}>Pago</th>
                        <th className={CABECALHO}>Pagamento</th>
                        <th className={CABECALHO}>Instituição · projeto · processo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planilhas.planilhaII.map(l => (
                        <tr key={l.despesaId} className="border-b align-top last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <td className="px-3 py-2.5 tabular-nums text-black/45">{l.n}</td>
                          <td className="px-3 py-2.5">
                            <Link href={`/prestacoes/${id}/comprovantes?despesa=${l.despesaId}`} className="text-black/80 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{l.favorecido || "Sem favorecido"}</Link>
                            <p className="text-[0.625rem] text-black/45">{l.descricao}</p>
                            <Criticas criticas={l.criticas} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[0.6875rem] text-black/60">{l.tipo} {l.numero}<p className="text-[0.625rem] tabular-nums text-black/40">{dataBr(l.emissao)}</p></td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-black/70">{reais(l.valorDocumento)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-black/50">{l.impostoRetido ? reais(l.impostoRetido) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-black/70">{l.valorPago ? reais(l.valorPago) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[0.6875rem] tabular-nums text-black/60">{dataBr(l.dataPagamento)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[0.6875rem] text-black/60">{[l.requisitos.nomeInstituicao, l.requisitos.nomeProjeto, l.requisitos.processo].join(" · ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-black/[.05] md:hidden">
                  {planilhas.planilhaII.map(l => (
                    <li key={l.despesaId} className="space-y-0.5 px-5 py-3">
                      <Link href={`/prestacoes/${id}/comprovantes?despesa=${l.despesaId}`} className="text-[0.75rem] text-black/80 hover:underline">{l.n}. {l.favorecido || "Sem favorecido"}</Link>
                      <p className="text-[0.625rem] text-black/45">{[`${l.tipo} ${l.numero}`.trim(), dataBr(l.emissao), `pago ${l.valorPago ? reais(l.valorPago) : "—"} em ${dataBr(l.dataPagamento)}`].join(" · ")}</p>
                      <Criticas criticas={l.criticas} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="tabela-1">
              <h3 id="tabela-1" className="border-b px-5 py-3 text-[0.75rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.07)" }}>Tabela 1 – rendimentos de aplicação financeira</h3>
              {anos.length === 0 ? (
                <p className="px-5 py-8 text-center text-[0.75rem] text-black/50">Sem lançamentos do extrato no período. Os rendimentos e o IR e IOF da aplicação vêm do extrato da Conta Movimento.</p>
              ) : (
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <th className={CABECALHO}>Mês/Ano</th>
                      <th className={`${CABECALHO} text-right`}>Rendimento</th>
                      <th className={`${CABECALHO} text-right`}>IR e IOF</th>
                      <th className={`${CABECALHO} text-right`}>Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planilhas.tabela1.filter(l => l.rendimento || l.impostos).map(l => (
                      <tr key={`${l.ano}-${l.mes}`} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-3 py-2 text-black/70">{MESES[l.mes - 1]}/{l.ano}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-black/70">{reais(l.rendimento)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-black/50">{reais(l.impostos)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#282525]">{reais(l.liquido)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Total</td>
                      <td colSpan={3} className="px-3 py-2 text-right font-semibold tabular-nums text-[#282525]">{reais(planilhas.tabela1.reduce((s, l) => s + l.liquido, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              <p className="border-t px-5 py-2.5 text-[0.625rem] text-black/40" style={{ borderColor: "rgba(13,13,13,.07)" }}>Na planilha, os 12 meses de cada ano aparecem, com os sem rendimento zerados.</p>
            </section>

            <section className="rounded border bg-white" style={BORDA} aria-labelledby="compiladas">
              <h3 id="compiladas" className="border-b px-5 py-3 text-[0.75rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.07)" }}>Informações compiladas</h3>
              <dl className="divide-y divide-black/[.05] text-[0.75rem]">
                {([
                  ...(c.saldoAnterior === null ? [] : [["Saldo dos exercícios anteriores", c.saldoAnterior]]),
                  ["Recursos recebidos na Conta Movimento", c.recursosRecebidos],
                  ["Rendimentos líquidos", c.rendimentos],
                  ["Total de recursos", c.totalDeRecursos],
                  ["Total de despesas pagas", c.totalDeDespesas],
                  ["Saldo remanescente", c.saldoRemanescente],
                  ["Saldo residual da Conta Captação", c.saldoDaCaptacao],
                ] as [string, number | null][]).map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                    <dt className="text-black/60">{rotulo}</dt>
                    <dd className={VALOR(valor ?? 0)}>{reais(valor)}</dd>
                  </div>
                ))}
              </dl>
              {c.semMovimento && (
                <p className="flex items-start gap-1 border-t px-5 py-2.5 text-[0.625rem] text-black/50" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-px shrink-0 text-[#B07A14]" />
                  <span>Sem lançamentos da Conta Movimento no período: importe o extrato em <Link href={`/prestacoes/${id}/extrato`} className="underline decoration-black/20 underline-offset-2 hover:text-[#282525]">Extrato</Link>.</span>
                </p>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="bens">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <h3 id="bens" className="text-[0.75rem] font-semibold text-[#282525]">Bens, equipamentos e materiais permanentes <span className="font-normal tabular-nums text-black/35">({planilhas.bens.length})</span></h3>
              <Link href={`/prestacoes/${id}/bens`} className={LINK}>Abrir bens <ArrowRight size={10} aria-hidden /></Link>
            </div>
            {planilhas.bens.length === 0 ? (
              <p className="px-5 py-8 text-center text-[0.75rem] text-black/50">Nenhum bem no período. Os bens de Bens, com o patrimônio, entram aqui.</p>
            ) : (
              <ul className="divide-y divide-black/[.05]">
                {planilhas.bens.map(b => (
                  <li key={b.n} className="flex flex-col gap-0.5 px-5 py-3 md:flex-row md:items-start md:justify-between md:gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.75rem] text-black/80">{b.n}. {b.descricao} <span className="text-black/40">· {b.quantidade} un.</span></p>
                      <p className="text-[0.625rem] text-black/45">{[b.identificacao ? `patrimônio ${b.identificacao}` : null, b.documento, b.fornecedor, b.destinacao].filter(Boolean).join(" · ")}</p>
                      <Criticas criticas={b.criticas} />
                    </div>
                    <span className="shrink-0 text-[0.75rem] tabular-nums text-black/70">{reais(b.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
