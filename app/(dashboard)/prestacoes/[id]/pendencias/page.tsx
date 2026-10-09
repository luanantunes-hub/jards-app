"use client";

// Aba Pendências (P2.9): a fila por item do orçamento em uso, com o que falta
// conciliar, as regras pendentes e o saldo de cada item, e cada despesa com o
// caminho para resolver. Embaixo, todas as verificações, com justificar e
// dispensar (P2.7).

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { VerificacoesPrestacao } from "@/components/prestacao/VerificacoesPrestacao";
import { tituloDaChecagem } from "@/lib/prestacao/checagens";
import { filaDePendencias, soComPendencia, type DespesaDaFila, type LinhaDaFila, type PagamentoDaFila, type VerificacaoDaFila } from "@/lib/prestacao/pendencias";
import type { NoOrcamento } from "@/lib/prestacao/orcamento";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { EVENTO_VERIFICADA } from "@/lib/prestacao/verificar-cliente";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-3 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const NUMERO = "px-3 py-2.5 text-right text-[0.75rem] tabular-nums";

type Dados = {
  prestacaoId: string;
  nos: NoOrcamento[];
  despesas: DespesaDaFila[];
  pagamentos: PagamentoDaFila[];
  verificacoes: VerificacaoDaFila[];
  erro: string;
};

const chaveDaLinha = (l: LinhaDaFila) => l.id ?? "sem-item";

function Contagem({ quantidade, valor, alerta }: { quantidade: number; valor: number; alerta?: boolean }) {
  if (!quantidade) return <span className="text-black/25">—</span>;
  return (
    <span className={alerta ? "inline-flex items-center gap-1 text-black/70" : undefined}>
      {alerta && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
      <span>{fmt(valor)} <span className="text-[0.625rem] text-black/40">({quantidade})</span></span>
    </span>
  );
}

function Pendencias({ linha }: { linha: LinhaDaFila }) {
  const { bloqueios, outras } = linha.pendencias;
  if (!bloqueios && !outras) return <span className="text-black/25">—</span>;
  return (
    <span>
      {bloqueios > 0 && (
        <span className="inline-flex items-center gap-1 font-medium tabular-nums text-black/70">
          <Ban size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />
          {bloqueios} {bloqueios === 1 ? "bloqueio" : "bloqueios"}
        </span>
      )}
      {bloqueios > 0 && outras > 0 && <span className="text-black/30"> · </span>}
      {outras > 0 && (
        <span className="inline-flex items-center gap-1 tabular-nums text-black/70">
          <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
          {outras} a revisar
        </span>
      )}
    </span>
  );
}

/** Despesas do item, cada uma com o que falta e o link que abre a despesa. */
function DespesasDoItem({ linha, prestacaoId }: { linha: LinhaDaFila; prestacaoId: string }) {
  if (!linha.despesasDoItem.length) {
    return <p className="px-4 py-3 text-[0.6875rem] text-black/45">Nenhuma despesa ligada a este item.</p>;
  }
  return (
    <ul className="divide-y divide-black/[.05]">
      {linha.despesasDoItem.map(d => (
        <li key={d.id} className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] text-black/80">{d.nome}</p>
            <p className="text-[0.625rem] text-black/45">
              <span className="tabular-nums">{fmt(d.valor)}</span>
              {d.aConciliar > 0 && <> · <span className="tabular-nums">{fmt(d.aConciliar)}</span> sem pagamento conciliado</>}
            </p>
            {d.pendencias.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {d.pendencias.map(v => (
                  <li key={v.id} className="flex items-start gap-1 text-[0.6875rem] leading-4 text-black/60">
                    {v.severidade === "bloqueio"
                      ? <Ban size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#D94A4A]" />
                      : <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />}
                    <span><span className="font-medium text-black/75">{tituloDaChecagem(v.check_codigo)}:</span> {v.mensagem}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href={`/prestacoes/${prestacaoId}/comprovantes?despesa=${d.id}`}
            className="inline-flex shrink-0 items-center gap-1 self-start rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
          >
            Abrir despesa <ArrowRight size={11} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PendenciasPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const [dados, setDados] = useState<Dados | null>(null);
  const [soPendentes, setSoPendentes] = useState(true);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const buscar = useCallback(async (): Promise<Dados> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [versao, despesas, pagamentos, verificacoes] = await Promise.all([
      db.from("prestacao_orcamento_versoes").select("id").eq("prestacao_id", id).eq("ativa", true).maybeSingle(),
      db.from("prestacao_comprovantes").select("id, nome_arquivo, tipo, status, no_id, valor_extraido, valor_liquido, data_doc, descricao_servico").eq("prestacao_id", id),
      db.from("prestacao_pagamentos").select("id, despesa_id, valor, lancamento_id").eq("prestacao_id", id),
      db.from("prestacao_verificacoes").select("id, chave, check_codigo, severidade, status, entidade_tipo, entidade_id, mensagem, dados").eq("prestacao_id", id).eq("status", "aberta"),
    ]);
    const nos = versao.data?.id ? await db.from("prestacao_orcamento_nos").select("*").eq("versao_id", versao.data.id) : { data: [] };
    const falha = [versao, despesas, pagamentos, verificacoes, nos].find(r => r.error)?.error;
    return {
      prestacaoId: id,
      nos: (nos.data ?? []) as NoOrcamento[],
      despesas: (despesas.data ?? []) as DespesaDaFila[],
      pagamentos: (pagamentos.data ?? []) as PagamentoDaFila[],
      verificacoes: (verificacoes.data ?? []) as VerificacaoDaFila[],
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível ler as pendências") : "",
    };
  }, [id, supabase]);

  useEffect(() => {
    let ativo = true;
    buscar().then(lidos => { if (ativo) setDados(lidos); });
    // O painel de verificações avisa quando uma verificação termina.
    const aoVerificar = (e: Event) => {
      if ((e as CustomEvent<{ prestacaoId: string }>).detail?.prestacaoId === id) buscar().then(lidos => { if (ativo) setDados(lidos); });
    };
    window.addEventListener(EVENTO_VERIFICADA, aoVerificar);
    return () => { ativo = false; window.removeEventListener(EVENTO_VERIFICADA, aoVerificar); };
  }, [buscar, id]);

  const fila = useMemo(() => (dados?.prestacaoId === id ? filaDePendencias(dados) : null), [dados, id]);
  const alternar = (chave: string) => setAbertas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(chave)) proximo.delete(chave); else proximo.add(chave);
    return proximo;
  });

  if (!fila || !dados) {
    return (
      <div className="space-y-3 px-4 py-6 sm:px-8" aria-hidden>
        {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}
      </div>
    );
  }

  const { linhas, resumo } = fila;
  const visiveis = soPendentes ? soComPendencia(linhas) : linhas;
  const semNada = !linhas.length;

  return (
    <div className="mx-auto max-w-pagina space-y-5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-[#282525]">Pendências</h2>
          <p className="mt-0.5 text-[0.75rem] text-black/50">
            {semNada ? "Cadastre o orçamento e envie as despesas: aqui aparece o que falta em cada item." : <>
              <span className="tabular-nums">{resumo.itensComPendencia}</span> {resumo.itensComPendencia === 1 ? "item com pendência" : "itens com pendência"}
              {resumo.aConciliar.quantidade > 0 && <> · <span className="tabular-nums">{fmt(resumo.aConciliar.valor)}</span> sem pagamento conciliado</>}
              {resumo.bloqueios > 0 && <> · <Ban size={12} strokeWidth={1.75} aria-hidden className="mr-0.5 inline-block align-[-0.125rem] text-[#D94A4A]" /><span className="font-medium text-black/70"><span className="tabular-nums">{resumo.bloqueios}</span> {resumo.bloqueios === 1 ? "bloqueio" : "bloqueios"}</span></>}
            </>}
          </p>
        </div>
        {!semNada && (
          <div role="group" aria-label="Itens na fila" className="inline-flex rounded border bg-white p-0.5" style={BORDA}>
            {[{ valor: true, rotulo: "Só com pendência" }, { valor: false, rotulo: "Todos os itens" }].map(opcao => (
              <button
                key={opcao.rotulo}
                type="button"
                aria-pressed={soPendentes === opcao.valor}
                onClick={() => setSoPendentes(opcao.valor)}
                className={`rounded px-3 py-1.5 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5] ${soPendentes === opcao.valor ? "bg-black/[.06] font-medium text-[#282525]" : "text-black/55 hover:bg-black/[.03] hover:text-black/80"}`}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        )}
      </div>

      {dados.erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{dados.erro}</p>}

      {resumo.debitosSemDespesa.quantidade > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded border bg-white px-4 py-3 text-[0.75rem] text-black/65" style={{ borderColor: "#B23B3B47" }}>
          <span>
            <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mr-1 inline-block align-[-0.125rem] text-[#D94A4A]" />
            <span className="font-semibold text-[#282525] tabular-nums">{resumo.debitosSemDespesa.quantidade}</span> {resumo.debitosSemDespesa.quantidade === 1 ? "débito do extrato" : "débitos do extrato"} sem despesa
            (<span className="tabular-nums">{fmt(resumo.debitosSemDespesa.valor)}</span>): ainda não têm item, por isso ficam fora da fila.
          </span>
          <Link href={`/prestacoes/${id}/conciliacao`} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[0.6875rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Conciliar <ArrowRight size={11} aria-hidden />
          </Link>
        </p>
      )}

      {!semNada && (
        <section aria-labelledby="fila-titulo" className="overflow-hidden rounded border bg-white" style={BORDA}>
          <h3 id="fila-titulo" className="sr-only">Fila por item</h3>
          {!visiveis.length ? (
            <p className="flex items-center gap-2 px-5 py-4 text-[0.75rem] text-black/55">
              <CheckCircle2 size={14} className="shrink-0 text-black/40" aria-hidden /> Nenhum item com pendência.
            </p>
          ) : (
            <>
              {/* Tabela a partir de md; no celular, uma lista de cartões com os mesmos dados. */}
              <table className="hidden w-full md:table">
                <thead className="border-b" style={BORDA}>
                  <tr>
                    <th scope="col" className={CABECALHO}>Item</th>
                    <th scope="col" className={`${CABECALHO} text-right`}>Despesas</th>
                    <th scope="col" className={`${CABECALHO} text-right`} title="Parte das despesas sem pagamento conciliado com o extrato">A conciliar</th>
                    <th scope="col" className={CABECALHO}>Regras pendentes</th>
                    <th scope="col" className={`${CABECALHO} text-right`}>Saldo</th>
                    <th scope="col" className="w-10"><span className="sr-only">Despesas do item</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.05]">
                  {visiveis.map(l => {
                    const chave = chaveDaLinha(l);
                    const aberta = abertas.has(chave);
                    return (
                      <Fragment key={chave}>
                        <tr className="transition hover:bg-black/[.02]">
                          <td className="min-w-0 px-3 py-2.5">
                            <p className="text-[0.75rem] text-black/80">{l.nome}</p>
                            {l.caminho.length > 0 && <p className="text-[0.625rem] text-black/40">{l.caminho.join(" › ")}</p>}
                          </td>
                          <td className={`${NUMERO} text-black/70`}><Contagem {...l.despesas} /></td>
                          <td className={NUMERO}><Contagem {...l.aConciliar} alerta /></td>
                          <td className="px-3 py-2.5 text-[0.6875rem]"><Pendencias linha={l} /></td>
                          <td className={`${NUMERO} ${l.saldo !== null && l.saldo < 0 ? "font-medium text-[#282525]" : "text-black/60"}`}>
                            {l.saldo !== null && l.saldo < 0 && <AlertTriangle size={12} strokeWidth={1.75} role="img" aria-label="Saldo negativo" className="mr-1 inline-block align-[-0.125rem] text-[#D94A4A]" />}
                            {l.saldo === null ? "—" : fmt(l.saldo)}
                          </td>
                          <td className="px-2 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => alternar(chave)}
                              aria-expanded={aberta}
                              aria-label={`${aberta ? "Fechar" : "Ver"} despesas de ${l.nome}`}
                              className="rounded p-1.5 text-black/40 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                            >
                              <ChevronDown size={14} className={`transition-transform duration-200 motion-reduce:transition-none ${aberta ? "rotate-180" : ""}`} aria-hidden />
                            </button>
                          </td>
                        </tr>
                        {aberta && (
                          <tr>
                            <td colSpan={6} className="bg-black/[.02] p-0"><DespesasDoItem linha={l} prestacaoId={id} /></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              <ul className="divide-y divide-black/[.05] md:hidden">
                {visiveis.map(l => {
                  const chave = chaveDaLinha(l);
                  const aberta = abertas.has(chave);
                  return (
                    <li key={chave}>
                      <button
                        type="button"
                        onClick={() => alternar(chave)}
                        aria-expanded={aberta}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
                      >
                        <span className="block min-w-0 flex-1 space-y-1">
                          <span className="block text-[0.75rem] text-black/80">{l.nome}</span>
                          <span className="block text-[0.6875rem] text-black/55">
                            Despesas <span className="tabular-nums"><Contagem {...l.despesas} /></span>
                            {l.saldo !== null && <> · Saldo {l.saldo < 0 && <AlertTriangle size={12} strokeWidth={1.75} role="img" aria-label="Saldo negativo" className="mr-0.5 inline-block align-[-0.125rem] text-[#D94A4A]" />}<span className={`tabular-nums ${l.saldo < 0 ? "font-medium text-[#282525]" : ""}`}>{fmt(l.saldo)}</span></>}
                          </span>
                          {(l.aConciliar.quantidade > 0 || l.pendencias.bloqueios + l.pendencias.outras > 0) && (
                            <span className="block text-[0.6875rem]">
                              {l.aConciliar.quantidade > 0 && (
                                <span className="inline-flex items-center gap-1 text-black/55">
                                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                                  <span>A conciliar <span className="tabular-nums">{fmt(l.aConciliar.valor)}</span></span>
                                </span>
                              )}
                              {l.aConciliar.quantidade > 0 && l.pendencias.bloqueios + l.pendencias.outras > 0 && <span className="text-black/30"> · </span>}
                              <Pendencias linha={l} />
                            </span>
                          )}
                        </span>
                        <ChevronDown size={14} className={`mt-0.5 shrink-0 text-black/40 transition-transform duration-200 motion-reduce:transition-none ${aberta ? "rotate-180" : ""}`} aria-hidden />
                      </button>
                      {aberta && <div className="bg-black/[.02]"><DespesasDoItem linha={l} prestacaoId={id} /></div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      )}

      <VerificacoesPrestacao prestacaoId={id} permissoes={permissoes} />
    </div>
  );
}
