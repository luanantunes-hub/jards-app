"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeftRight, Link2, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useFornecedoresDaOrganizacao } from "@/hooks/useFornecedoresDaOrganizacao";
import { rotuloDaConta } from "@/components/prestacao/extrato/ContaBancariaModal";
import {
  formaPeloHistorico,
  lancamentoEsperaPagamento,
  resumoDaConciliacao,
  situacaoDoLancamento,
  sugerirConciliacoes,
} from "@/lib/prestacao/conciliacao";
import { ehDespesa } from "@/lib/prestacao/despesas";
import { nomeDoFornecedor } from "@/lib/prestacao/fornecedores";
import { rotuloDaForma, situacaoDosPagamentos } from "@/lib/prestacao/pagamentos";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoComprovante, PrestacaoContaBancaria, PrestacaoLancamento, PrestacaoPagamento } from "@/lib/supabase/types";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const SECAO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35";
const BOTAO = "flex h-8 shrink-0 items-center gap-1.5 rounded border bg-white px-2.5 text-[0.6875rem] font-medium text-black/70 transition hover:border-black/25 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-wait disabled:text-black/35 motion-reduce:transform-none";

type Dados = {
  lancamentos: PrestacaoLancamento[];
  pagamentos: PrestacaoPagamento[];
  despesas: PrestacaoComprovante[];
  contas: PrestacaoContaBancaria[];
  erro: string;
};

/** Um lançamento do extrato em uma linha: data, histórico, número e valor. */
function Lancamento({ l, conta }: { l: PrestacaoLancamento; conta?: PrestacaoContaBancaria }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[0.75rem] text-black/80" title={l.historico}>{l.historico || "Sem histórico"}</p>
      <p className="text-[0.625rem] text-black/40">
        <span className="tabular-nums">{dataCurta(l.data)}</span>
        {l.numero_documento && <> · nº <span className="tabular-nums">{l.numero_documento}</span></>}
        {conta && <> · {rotuloDaConta(conta)}</>}
      </p>
    </div>
  );
}

export default function ConciliacaoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const organizationId = usePrestacaoOrganizacao(id);
  const permissoes = usePermissoesPrestacao(id);
  const { fornecedores } = useFornecedoresDaOrganizacao(organizationId);
  const [dados, setDados] = useState<Dados | null>(null);
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [escolhaDespesa, setEscolhaDespesa] = useState<Record<string, string>>({});
  const [escolhaLancamento, setEscolhaLancamento] = useState<Record<string, string>>({});

  const buscar = useCallback(async (): Promise<Dados> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [l, p, d, c] = await Promise.all([
      db.from("prestacao_lancamentos").select("*").eq("prestacao_id", id).order("data").limit(5000),
      db.from("prestacao_pagamentos").select("*").eq("prestacao_id", id).order("data"),
      db.from("prestacao_comprovantes").select("*").eq("prestacao_id", id),
      db.from("prestacao_contas_bancarias").select("*").eq("prestacao_id", id),
    ]);
    const falha = l.error ?? p.error ?? d.error ?? c.error;
    return {
      lancamentos: ((l.data ?? []) as PrestacaoLancamento[]).map(x => ({ ...x, valor: Number(x.valor) })),
      pagamentos: ((p.data ?? []) as PrestacaoPagamento[]).map(x => ({ ...x, valor: Number(x.valor) })),
      despesas: (d.data ?? []) as PrestacaoComprovante[],
      contas: (c.data ?? []) as PrestacaoContaBancaria[],
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar a conciliação") : "",
    };
  }, [id, supabase]);

  const recarregar = useCallback(async () => setDados(await buscar()), [buscar]);

  useEffect(() => {
    let ativo = true;
    buscar().then(d => { if (ativo) setDados(d); });
    return () => { ativo = false; };
  }, [buscar]);

  const lancamentos = useMemo(() => dados?.lancamentos ?? [], [dados]);
  const pagamentos = useMemo(() => dados?.pagamentos ?? [], [dados]);
  const despesas = useMemo(() => (dados?.despesas ?? []).filter(d => ehDespesa(d.tipo)), [dados]);
  const contaPorId = useMemo(() => new Map((dados?.contas ?? []).map(c => [c.id, c])), [dados]);
  const despesaPorId = useMemo(() => new Map(despesas.map(d => [d.id, d])), [despesas]);
  const lancamentoPorId = useMemo(() => new Map(lancamentos.map(l => [l.id, l])), [lancamentos]);
  const fornecedorPorId = useMemo(() => new Map(fornecedores.map(f => [f.id, f])), [fornecedores]);
  const pagamentosPorLancamento = useMemo(() => {
    const mapa = new Map<string, PrestacaoPagamento[]>();
    for (const p of pagamentos) if (p.lancamento_id) mapa.set(p.lancamento_id, [...(mapa.get(p.lancamento_id) ?? []), p]);
    return mapa;
  }, [pagamentos]);

  const resumo = useMemo(() => resumoDaConciliacao(lancamentos, pagamentos), [lancamentos, pagamentos]);
  const sugestoes = useMemo(() => sugerirConciliacoes(lancamentos, pagamentos), [lancamentos, pagamentos]);
  const fortes = sugestoes.filter(s => s.forca === "forte");
  const emSugestao = new Set(sugestoes.flatMap(s => [s.lancamentoId, s.pagamentoId]));
  const debitosAbertos = lancamentos.filter(l => {
    const situacao = situacaoDoLancamento(l, pagamentosPorLancamento.get(l.id) ?? []);
    return situacao === "pendente" || situacao === "parcial";
  });
  const pagamentosSoltos = pagamentos.filter(p => !p.lancamento_id);
  const conciliados = lancamentos.filter(l => (pagamentosPorLancamento.get(l.id)?.length ?? 0) > 0);

  /** Quanto falta pagar de cada despesa (líquido menos pagamentos). */
  const faltaDa = useCallback((d: PrestacaoComprovante) => {
    const { falta } = situacaoDosPagamentos(d.valor_liquido ?? d.valor_extraido, pagamentos.filter(p => p.despesa_id === d.id));
    return falta;
  }, [pagamentos]);
  const despesasAbertas = despesas.filter(d => (faltaDa(d) ?? 1) > 0);

  const rotuloDespesa = (d: PrestacaoComprovante) => {
    const f = d.fornecedor_id ? fornecedorPorId.get(d.fornecedor_id) : null;
    const falta = faltaDa(d);
    return [d.descricao_servico || d.nome_arquivo, f ? nomeDoFornecedor(f) : null, falta !== null ? `falta ${fmt(falta)}` : null].filter(Boolean).join(" · ");
  };

  async function executar(chave: string, acao: () => Promise<{ error: unknown } | void>, mensagem: string) {
    setOcupado(chave);
    setErro("");
    setAviso("");
    const r = await acao();
    const falha = r && (r as { error: unknown }).error;
    // Recarrega antes do aviso, para o resumo e a mensagem mudarem juntos.
    await recarregar();
    setOcupado("");
    if (falha) { setErro(mensagemErroPrestacao(falha as { message?: string }, "Não foi possível conciliar")); return; }
    setAviso(mensagem);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
  const tabela = () => (supabase as any).from("prestacao_pagamentos");
  const ligar = (pagamentoId: string, lancamentoId: string | null) => tabela().update({ lancamento_id: lancamentoId }).eq("id", pagamentoId);

  async function conciliarFortes() {
    await executar("fortes", async () => {
      for (const s of fortes) {
        const r = await ligar(s.pagamentoId, s.lancamentoId);
        if (r.error) return r;
      }
    }, `${fortes.length} ${fortes.length === 1 ? "pagamento conciliado" : "pagamentos conciliados"}.`);
  }

  async function criarPagamento(l: PrestacaoLancamento) {
    const despesa = despesaPorId.get(escolhaDespesa[l.id] ?? "");
    if (!despesa) { setErro("Escolha a despesa que o débito paga."); return; }
    const jaLigado = (pagamentosPorLancamento.get(l.id) ?? []).reduce((s, p) => s + Number(p.valor), 0);
    const restoDoLancamento = Math.round((Number(l.valor) - jaLigado) * 100) / 100;
    const falta = faltaDa(despesa);
    const valor = falta !== null && falta > 0 ? Math.min(restoDoLancamento, falta) : restoDoLancamento;
    const fornecedor = despesa.fornecedor_id ? fornecedorPorId.get(despesa.fornecedor_id) : null;
    await executar(`criar-${l.id}`, () => tabela().insert({
      despesa_id: despesa.id,
      lancamento_id: l.id,
      forma: formaPeloHistorico(l.historico) ?? "ted",
      data: l.data,
      valor,
      numero_documento: l.numero_documento,
      favorecido_documento: fornecedor?.documento ?? null,
      favorecido_nome: fornecedor ? nomeDoFornecedor(fornecedor) : null,
    }), `Pagamento de ${fmt(valor)} registrado e conciliado.`);
  }

  const podeEditar = permissoes.editar;
  if (!dados) {
    return (
      <div className="space-y-3 px-8 py-6" aria-hidden>
        {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[0.875rem] font-semibold text-[#0D0D0D]">Conciliação</h2>
          <p className="mt-0.5 text-[0.75rem] text-black/50">
            {resumo.debitos === 0 && pagamentos.length === 0
              ? "Importe o extrato e registre os pagamentos das despesas para conciliar."
              : <>
                <span className="tabular-nums">{resumo.conciliados}</span> de <span className="tabular-nums">{resumo.debitos}</span> débitos conciliados
                {resumo.parciais > 0 && <> · <span className="tabular-nums">{resumo.parciais}</span> em parte</>}
                {resumo.pendentes > 0 && <> · <span className="tabular-nums">{resumo.pendentes}</span> sem despesa (<span className="tabular-nums">{fmt(resumo.valorPendente)}</span>)</>}
                {resumo.pagamentosSoltos > 0 && <> · <span className="tabular-nums">{resumo.pagamentosSoltos}</span> {resumo.pagamentosSoltos === 1 ? "pagamento" : "pagamentos"} sem lançamento (<span className="tabular-nums">{fmt(resumo.valorSolto)}</span>)</>}
              </>}
          </p>
        </div>
        {podeEditar && fortes.length > 0 && (
          <button type="button" onClick={conciliarFortes} disabled={ocupado !== ""} className="flex items-center gap-1.5 rounded bg-[#0D0D0D] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-wait disabled:opacity-50 motion-reduce:transform-none">
            <ArrowLeftRight size={13} aria-hidden /> Conciliar {fortes.length} {fortes.length === 1 ? "sugestão certa" : "sugestões certas"}
          </button>
        )}
      </div>

      {(erro || dados.erro) && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro || dados.erro}</p>}
      {aviso && <p role="status" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}

      {sugestoes.length > 0 && (
        <section aria-labelledby="sugestoes" className="overflow-hidden rounded border bg-white" style={BORDA}>
          <h3 id="sugestoes" className={`${SECAO} border-b px-5 py-3`} style={BORDA}>Sugestões ({sugestoes.length})</h3>
          <ul className="divide-y divide-black/[.05]">
            {sugestoes.map(s => {
              const l = lancamentoPorId.get(s.lancamentoId)!;
              const p = pagamentos.find(x => x.id === s.pagamentoId)!;
              const d = despesaPorId.get(p.despesa_id);
              return (
                <li key={`${s.lancamentoId}-${s.pagamentoId}`} className="grid grid-cols-1 gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <Lancamento l={l} conta={contaPorId.get(l.conta_id)} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.75rem] text-black/80">{d ? rotuloDespesa(d) : "Despesa"}</p>
                    <p className="text-[0.625rem] text-black/40">
                      {rotuloDaForma(p.forma)} · <span className="tabular-nums">{dataCurta(p.data)}</span>
                      {s.motivos.map(m => <span key={m} className="ml-1.5 rounded border bg-white px-1.5 py-px text-black/50" style={{ borderColor: s.forca === "forte" ? "#2E893247" : "rgba(13,13,13,.12)" }}>{m}</span>)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-[0.75rem] font-medium tabular-nums text-black/80">{fmt(Number(l.valor))}</span>
                    {podeEditar && (
                      <button type="button" disabled={ocupado !== ""} onClick={() => executar(s.pagamentoId, () => ligar(s.pagamentoId, s.lancamentoId), "Pagamento conciliado.")} className={BOTAO} style={BORDA}>
                        <Link2 size={12} aria-hidden /> Conciliar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="debitos" className="overflow-hidden rounded border bg-white" style={BORDA}>
        <h3 id="debitos" className={`${SECAO} border-b px-5 py-3`} style={BORDA}>Débitos sem despesa ({debitosAbertos.length})</h3>
        {debitosAbertos.length === 0 ? (
          <p className="px-5 py-6 text-[0.75rem] text-black/40">
            {lancamentos.some(lancamentoEsperaPagamento) ? "Todo débito de pagamento do extrato está ligado a uma despesa." : "Nenhum débito de pagamento no extrato. Importe o extrato na aba Extrato."}
          </p>
        ) : (
          <ul className="divide-y divide-black/[.05]">
            {debitosAbertos.map(l => {
              const ligados = pagamentosPorLancamento.get(l.id) ?? [];
              const resto = Number(l.valor) - ligados.reduce((s, p) => s + Number(p.valor), 0);
              return (
                <li key={l.id} className="grid grid-cols-1 gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <Lancamento l={l} conta={contaPorId.get(l.conta_id)} />
                    <span className="shrink-0 text-right text-[0.75rem] font-medium tabular-nums text-black/80">
                      {fmt(Number(l.valor))}
                      {(ligados.length > 0 || emSugestao.has(l.id)) && (
                        <span className="block text-[0.625rem] font-normal text-black/40">
                          {[ligados.length > 0 ? `faltam ${fmt(resto)}` : null, emSugestao.has(l.id) ? "com sugestão" : null].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </div>
                  {podeEditar && despesasAbertas.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 sm:w-[20rem]">
                        <Dropdown
                          value={escolhaDespesa[l.id] ?? ""}
                          onChange={v => setEscolhaDespesa(e => ({ ...e, [l.id]: v }))}
                          ariaLabel={`Despesa paga pelo débito de ${dataCurta(l.data)}`}
                          placeholder="Escolha a despesa"
                          options={despesasAbertas.map(d => ({ value: d.id, label: rotuloDespesa(d) }))}
                        />
                      </div>
                      <button type="button" disabled={ocupado !== "" || !escolhaDespesa[l.id]} onClick={() => criarPagamento(l)} className={BOTAO} style={BORDA}>
                        <Link2 size={12} aria-hidden /> Ligar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="soltos" className="overflow-hidden rounded border bg-white" style={BORDA}>
        <h3 id="soltos" className={`${SECAO} border-b px-5 py-3`} style={BORDA}>Pagamentos sem lançamento ({pagamentosSoltos.length})</h3>
        {pagamentosSoltos.length === 0 ? (
          <p className="px-5 py-6 text-[0.75rem] text-black/40">Todo pagamento registrado está ligado ao extrato.</p>
        ) : (
          <ul className="divide-y divide-black/[.05]">
            {pagamentosSoltos.map(p => {
              const d = despesaPorId.get(p.despesa_id);
              const opcoes = [...debitosAbertos].sort((a, b) =>
                Number(Math.abs(Number(a.valor) - Number(p.valor)) > 0.004) - Number(Math.abs(Number(b.valor) - Number(p.valor)) > 0.004) || a.data.localeCompare(b.data));
              return (
                <li key={p.id} className="grid grid-cols-1 gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.75rem] text-black/80">{d ? rotuloDespesa(d) : "Despesa"}</p>
                      <p className="text-[0.625rem] text-black/40">{rotuloDaForma(p.forma)} · <span className="tabular-nums">{dataCurta(p.data)}</span>{p.numero_documento && <> · nº {p.numero_documento}</>}{emSugestao.has(p.id) && " · com sugestão"}</p>
                    </div>
                    <span className="shrink-0 text-[0.75rem] font-medium tabular-nums text-black/80">{fmt(Number(p.valor))}</span>
                  </div>
                  {podeEditar && opcoes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 sm:w-[20rem]">
                        <Dropdown
                          value={escolhaLancamento[p.id] ?? ""}
                          onChange={v => setEscolhaLancamento(e => ({ ...e, [p.id]: v }))}
                          ariaLabel={`Lançamento do pagamento de ${dataCurta(p.data)}`}
                          placeholder="Escolha o débito do extrato"
                          options={opcoes.map(l => ({ value: l.id, label: `${dataCurta(l.data)} · ${fmt(Number(l.valor))} · ${l.historico}` }))}
                        />
                      </div>
                      <button type="button" disabled={ocupado !== "" || !escolhaLancamento[p.id]} onClick={() => executar(p.id, () => ligar(p.id, escolhaLancamento[p.id]), "Pagamento conciliado.")} className={BOTAO} style={BORDA}>
                        <Link2 size={12} aria-hidden /> Ligar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {conciliados.length > 0 && (
        <details className="overflow-hidden rounded border bg-white" style={BORDA}>
          <summary className={`${SECAO} cursor-pointer px-5 py-3 focus-visible:outline-2 focus-visible:outline-[#7259B5]`}>Conciliados ({conciliados.length})</summary>
          <ul className="divide-y divide-black/[.05] border-t" style={BORDA}>
            {conciliados.map(l => (
              <li key={l.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Lancamento l={l} conta={contaPorId.get(l.conta_id)} />
                  <span className="shrink-0 text-[0.75rem] font-medium tabular-nums text-black/80">{fmt(Number(l.valor))}</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {(pagamentosPorLancamento.get(l.id) ?? []).map(p => {
                    const d = despesaPorId.get(p.despesa_id);
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 text-[0.6875rem] text-black/55">
                        <span className="min-w-0 truncate">↳ {d ? rotuloDespesa(d) : "Despesa"} · <span className="tabular-nums">{fmt(Number(p.valor))}</span></span>
                        {podeEditar && (
                          <button type="button" disabled={ocupado !== ""} onClick={() => executar(p.id, () => ligar(p.id, null), "Conciliação desfeita.")} className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-black/45 transition hover:bg-black/[.04] hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                            <Undo2 size={11} aria-hidden /> Desfazer
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
