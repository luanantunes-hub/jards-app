"use client";

// Espelho do Salic (P4.2): as despesas na ordem da tela de comprovação do
// Salic, uma linha por pagamento, agrupadas por item do orçamento. Cada linha
// diz o campo que falta; "Lançar no Salic" mostra os campos para copiar um a
// um, e a planilha leva tudo para o Excel.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Copy, Download, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CampoParaCopiar } from "@/components/prestacao/CampoParaCopiar";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { camposDaLinha, espelhoDoSalic, planilhaDoEspelho, type GrupoDoEspelho, type LinhaDoEspelho } from "@/lib/prestacao/espelho-salic";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : null);
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98]";

const caminhoDoGrupo = (g: GrupoDoEspelho) => [g.produto, g.etapa, [g.uf, g.cidade].filter(Boolean).join(", ")].filter(Boolean).join(" › ");

function Faltas({ linha }: { linha: LinhaDoEspelho }) {
  if (!linha.faltando.length && !linha.avisos.length) return null;
  return (
    <div className="mt-1 space-y-0.5 text-[0.6875rem]">
      {linha.faltando.length > 0 && (
        <p className="flex items-start gap-1 text-black/60">
          <AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden /> Falta: {linha.faltando.join(", ")}
        </p>
      )}
      {linha.avisos.map(a => <p key={a} className="text-black/45">{a}</p>)}
    </div>
  );
}

function Contratado({ l }: { l: LinhaDoEspelho }) {
  return (
    <>
      <p className="text-black/80">{l.nomeFornecedor ?? <span className="text-black/30">Sem fornecedor</span>}</p>
      <p className="text-[0.625rem] tabular-nums text-black/40">{l.tela === "internacional" ? "Estrangeiro" : [l.tipoFornecedor, l.documentoFornecedor].filter(Boolean).join(" ") || "—"}</p>
    </>
  );
}

function Comprovante({ l }: { l: LinhaDoEspelho }) {
  return (
    <>
      <p className="text-black/75">{l.tipoComprovante ?? <span className="text-black/30">Sem tipo do Salic</span>}</p>
      <p className="text-[0.625rem] tabular-nums text-black/40">
        {[l.numero ? `nº ${l.numero}` : null, l.serie ? `série ${l.serie}` : null, dataBr(l.dataEmissao)].filter(Boolean).join(" · ") || "—"}
      </p>
    </>
  );
}

function Pagamento({ l }: { l: LinhaDoEspelho }) {
  if (!l.pagamentoId) return <span className="text-black/30">Sem pagamento</span>;
  return (
    <>
      <p className="text-black/75">{l.formaPagamento ?? (l.tela === "internacional" ? "Internacional" : <span className="text-black/30">Sem forma do Salic</span>)}</p>
      <p className="text-[0.625rem] tabular-nums text-black/40">{[dataBr(l.dataPagamento), l.numeroPagamento ? `nº ${l.numeroPagamento}` : null].filter(Boolean).join(" · ")}</p>
    </>
  );
}

function LancarNoSalic({ fila, indice, onIndice, onClose }: {
  fila: { grupo: GrupoDoEspelho; linha: LinhaDoEspelho }[];
  indice: number;
  onIndice: (i: number) => void;
  onClose: () => void;
}) {
  const atual = fila[indice];
  const campos = camposDaLinha(atual.grupo, atual.linha);
  const blocos = [...new Set(campos.map(c => c.bloco))];
  return (
    <ModalPrestacao
      titulo="Lançar no Salic"
      subtitulo={`${indice + 1} de ${fila.length} · ${atual.linha.tela === "internacional" ? "comprovante internacional" : "comprovante nacional"}`}
      onClose={onClose}
      largura="max-w-[36rem]"
      rodape={
        <>
          <p className="hidden text-[0.6875rem] text-black/40 sm:block">Copie cada campo e cole na tela de comprovação.</p>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={indice === 0} onClick={() => onIndice(indice - 1)} className={`${BOTAO} disabled:cursor-not-allowed disabled:text-black/30`} style={BORDA}>
              <ArrowLeft size={12} aria-hidden /> Anterior
            </button>
            <button type="button" disabled={indice === fila.length - 1} onClick={() => onIndice(indice + 1)} className={`${BOTAO} disabled:cursor-not-allowed disabled:text-black/30`} style={BORDA}>
              Próxima <ArrowRight size={12} aria-hidden />
            </button>
          </div>
        </>
      }
    >
      <div className="py-2">
        {atual.linha.faltando.length > 0 && (
          <p className="mx-6 my-2 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B07A14]" style={{ borderColor: "#B07A1440" }}>
            Falta: {atual.linha.faltando.join(", ")}. Complete na despesa antes de lançar.
          </p>
        )}
        {blocos.map(bloco => (
          <section key={bloco} className="py-1" aria-label={bloco}>
            <h3 className="px-6 pb-1 pt-2 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{bloco}</h3>
            {campos.filter(c => c.bloco === bloco).map(c => <CampoParaCopiar key={c.rotulo} rotulo={c.rotulo} valor={c.valor} />)}
          </section>
        ))}
        {atual.linha.avisos.length > 0 && (
          <ul className="mx-6 mt-2 space-y-0.5 text-[0.6875rem] text-black/50">
            {atual.linha.avisos.map(a => <li key={a}>{a}</li>)}
          </ul>
        )}
      </div>
    </ModalPrestacao>
  );
}

export default function EspelhoSalicPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { dados, erro } = useDadosDoEnvio(id);
  const [prestacao, setPrestacao] = useState<{ titulo: string; identificador_oficial: string | null } | null>(null);
  const [soIncompletas, setSoIncompletas] = useState(false);
  const [lancando, setLancando] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacoes_contas ainda não está no tipo Database
    (supabase as any).from("prestacoes_contas").select("titulo, identificador_oficial").eq("id", id).maybeSingle()
      .then(({ data }: { data: { titulo: string; identificador_oficial: string | null } | null }) => { if (ativo) setPrestacao(data); });
    return () => { ativo = false; };
  }, [id, supabase]);

  const espelho = useMemo(() => (dados ? espelhoDoSalic(dados.estado) : null), [dados]);
  const grupos = useMemo(() => (espelho?.grupos ?? [])
    .map(g => ({ ...g, linhas: soIncompletas ? g.linhas.filter(l => l.faltando.length > 0) : g.linhas }))
    .filter(g => g.linhas.length > 0 || !soIncompletas), [espelho, soIncompletas]);
  const fila = useMemo(() => grupos.flatMap(grupo => grupo.linhas.map(linha => ({ grupo, linha }))), [grupos]);
  const doSalic = dados?.regime?.sistemaOficial === "Salic";
  const totais = espelho?.totais;
  const diferenca = totais ? totais.comprovado - totais.debitosDoExtrato : 0;

  function baixar() {
    if (!espelho) return;
    const nome = `espelho-salic-${(prestacao?.identificador_oficial || prestacao?.titulo || id).toString().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`;
    const url = URL.createObjectURL(new Blob(["﻿" + planilhaDoEspelho(espelho)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Espelho do Salic</h2>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
            As despesas na ordem da tela de comprovação do Salic, uma linha por pagamento, ligadas ao item da planilha. Lance cada uma copiando campo a campo, ou baixe a planilha.
          </p>
        </div>
        {espelho && espelho.totais.linhas > 0 && (
          <button
            type="button"
            onClick={baixar}
            className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]"
          >
            <Download size={13} aria-hidden /> Baixar planilha
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}
      {dados && !doSalic && (
        <p className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-black/60" style={BORDA}>
          O espelho segue a tela do Salic, da Lei Rouanet. {dados.regime ? `Esta prestação é de outro regime (${dados.regime.sistemaOficial ?? "sem sistema oficial"}).` : "Esta prestação ainda não tem regime."}
        </p>
      )}

      {!dados && !erro && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {totais && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 text-[0.6875rem] md:grid-cols-4" style={BORDA}>
          <div>
            <dt className={ROTULO}>Linhas</dt>
            <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${totais.linhas ? "text-[#0D0D0D]" : "text-black/30"}`}>
              {totais.linhas}
              {totais.incompletas > 0 && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-[0.6875rem] font-normal text-black/45">
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                  {totais.incompletas} {totais.incompletas === 1 ? "incompleta" : "incompletas"}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className={ROTULO}>Comprovado no espelho</dt>
            <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${totais.comprovado ? "text-[#0D0D0D]" : "text-black/30"}`}>{reais(totais.comprovado)}</dd>
            <dd className="tabular-nums text-black/40">de {reais(totais.vigente)} vigente</dd>
          </div>
          <div>
            <dt className={ROTULO}>Débitos do extrato</dt>
            <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${totais.debitosDoExtrato ? "text-[#0D0D0D]" : "text-black/30"}`}>{reais(totais.debitosDoExtrato)}</dd>
            <dd className="tabular-nums text-black/40">{reais(totais.conciliado)} conciliados</dd>
          </div>
          <div>
            <dt className={ROTULO}>Espelho × extrato</dt>
            <dd className={`mt-0.5 flex items-center gap-1 text-[0.875rem] tabular-nums ${diferenca === 0 ? "font-medium text-black/70" : "font-semibold text-[#0D0D0D]"}`}>
              {diferenca !== 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
              {diferenca === 0 ? "Batem" : reais(diferenca)}
            </dd>
            {diferenca !== 0 && (
              <dd>
                <Link href={`/prestacoes/${id}/conciliacao`} className="inline-flex items-center gap-1 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Ver conciliação <ArrowRight size={10} aria-hidden />
                </Link>
              </dd>
            )}
          </div>
          {totais.aguardandoAvaliacao > 0 && (
            <p className="col-span-2 text-black/50 md:col-span-4">
              {totais.aguardandoAvaliacao} {totais.aguardandoAvaliacao === 1 ? "despesa ainda não foi avaliada e aparece" : "despesas ainda não foram avaliadas e aparecem"} com aviso.
            </p>
          )}
        </dl>
      )}

      {espelho && espelho.totais.linhas === 0 && (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <FileSpreadsheet size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma despesa para lançar.</p>
          <Link href={`/prestacoes/${id}/comprovantes`} className="mt-1 inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Lançar despesas em Comprovantes <ArrowRight size={11} aria-hidden />
          </Link>
        </div>
      )}

      {espelho && espelho.totais.linhas > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              aria-pressed={soIncompletas}
              onClick={() => setSoIncompletas(v => !v)}
              className="h-8 rounded border px-3 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              style={soIncompletas ? { background: "#684DB0", color: "#fff", borderColor: "#684DB0" } : { ...BORDA, background: "#fff", color: "rgba(13,13,13,.65)" }}
            >
              Só as incompletas ({espelho.totais.incompletas})
            </button>
            {fila.length > 0 && (
              <button type="button" onClick={() => setLancando(0)} className={BOTAO} style={BORDA}>
                <Copy size={12} aria-hidden /> Lançar no Salic, uma a uma
              </button>
            )}
          </div>

          {grupos.map(g => {
            const falta = g.vigente - g.comprovado;
            return (
              <section key={g.itemId ?? "sem-item"} className="overflow-hidden rounded border bg-white" style={BORDA} aria-label={g.item}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  <div className="min-w-0">
                    <h3 className="text-[0.75rem] font-semibold text-black">{g.item}</h3>
                    {caminhoDoGrupo(g) && <p className="text-[0.625rem] text-black/40">{caminhoDoGrupo(g)}</p>}
                  </div>
                  {g.itemId && (
                    <p className="text-[0.6875rem] tabular-nums text-black/50">
                      {reais(g.comprovado)} de {reais(g.vigente)}
                      {" · "}
                      {falta < 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mr-1 inline-block align-[-0.125rem] text-[#B07A14]" />}
                      {falta < 0 ? `${reais(-falta)} acima do vigente` : falta === 0 ? "comprovado" : `falta ${reais(falta)}`}
                    </p>
                  )}
                </div>
                {g.linhas.length === 0 ? (
                  <p className="px-5 py-3 text-[0.6875rem] text-black/35">Nenhuma despesa neste item.</p>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      {/* Larguras fixas: as colunas alinham de um item para o outro. */}
                      <table className="w-full table-fixed text-[0.75rem]">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                            <th className={`${CABECALHO} w-[34%]`}>Contratado</th>
                            <th className={`${CABECALHO} w-[24%]`}>Comprovante</th>
                            <th className={`${CABECALHO} w-[20%]`}>Pagamento</th>
                            <th className={`${CABECALHO} w-[12%] text-right`}>Valor</th>
                            <th className={`${CABECALHO} w-[10%]`}><span className="sr-only">Ações</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.linhas.map(l => (
                            <tr key={`${l.despesaId}:${l.pagamentoId ?? "-"}`} className="border-b align-top last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                              <td className="px-4 py-3"><Contratado l={l} /><Faltas linha={l} /></td>
                              <td className="px-4 py-3"><Comprovante l={l} /></td>
                              <td className="px-4 py-3"><Pagamento l={l} /></td>
                              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/80">{l.valor === null ? "—" : reais(l.valor)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right">
                                <button type="button" onClick={() => setLancando(fila.findIndex(f => f.linha === l))} className={BOTAO} style={BORDA}>
                                  <Copy size={12} aria-hidden /> Lançar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="divide-y divide-black/[.05] md:hidden">
                      {g.linhas.map(l => (
                        <li key={`${l.despesaId}:${l.pagamentoId ?? "-"}`} className="space-y-2 px-5 py-3 text-[0.75rem]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><Contratado l={l} /></div>
                            <span className="shrink-0 tabular-nums text-black/80">{l.valor === null ? "—" : reais(l.valor)}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Comprovante l={l} /></div>
                            <div><Pagamento l={l} /></div>
                          </div>
                          <Faltas linha={l} />
                          <button type="button" onClick={() => setLancando(fila.findIndex(f => f.linha === l))} className={BOTAO} style={BORDA}>
                            <Copy size={12} aria-hidden /> Lançar no Salic
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}

      {lancando !== null && fila[lancando] && (
        <LancarNoSalic fila={fila} indice={lancando} onIndice={setLancando} onClose={() => setLancando(null)} />
      )}
    </div>
  );
}
