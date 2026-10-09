"use client";

// Dados da parceria no Transferegov (P9.4), nas prestações do Pronon e do
// Pronas/PCD: situação, assinatura, autorização de execução, captação,
// contas com saldo e a captação como o Transferegov classifica, pela API
// pública de parcerias, comparados com o que a prestação registra (datas,
// contas e aportes do extrato).

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  compararComTransferegov,
  ERROS_DO_TRANSFEREGOV,
  saldoDaConta,
  type CampoDeData,
  type ComparacaoComTransferegov,
  type RespostaDoTransferegov,
} from "@/lib/prestacao/transferegov";

const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-not-allowed disabled:text-black/30";
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (c: number) => `font-semibold tabular-nums ${c ? "text-[#282525]" : "text-black/30"}`;
const LINK = "inline-flex items-center gap-0.5 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]";

type Resultado = RespostaDoTransferegov & { comparacao: ComparacaoComTransferegov };

export function DadosDoTransferegov({ prestacao, podeEditar, onSalvar }: {
  prestacao: { id: string } & Partial<Record<CampoDeData, string | null>>;
  podeEditar: boolean;
  onSalvar: (campos: Record<string, unknown>) => Promise<boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function consultar() {
    setConsultando(true);
    setErro("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
      const db = supabase as any;
      const [resposta, aportes, contas] = await Promise.all([
        fetch(`/api/prestacoes/${prestacao.id}/transferegov`, { cache: "no-store" }),
        db.from("prestacao_lancamentos").select("valor").eq("prestacao_id", prestacao.id).eq("natureza", "credito").eq("categoria", "aporte"),
        db.from("prestacao_contas_bancarias").select("conta").eq("prestacao_id", prestacao.id),
      ]);
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) { setErro(ERROS_DO_TRANSFEREGOV[corpo.error] ?? "Não foi possível consultar o Transferegov."); return; }
      const totalAportes = ((aportes.data ?? []) as { valor: number }[]).reduce((s, l) => s + Math.round(Number(l.valor) * 100), 0);
      setResultado({ ...corpo, comparacao: compararComTransferegov(corpo, prestacao, { aportes: totalAportes, contas: (contas.data ?? []) as { conta: string | null }[] }) });
    } catch {
      setErro("Não foi possível consultar o Transferegov.");
    } finally {
      setConsultando(false);
    }
  }

  async function usarDatas() {
    if (!resultado) return;
    setSalvando(true);
    const campos = Object.fromEntries(resultado.comparacao.datas.map(d => [d.campo, d.noTransferegov]));
    const ok = await onSalvar(campos);
    setSalvando(false);
    if (ok) setResultado({ ...resultado, comparacao: { ...resultado.comparacao, datas: [] } });
  }

  const p = resultado?.parceria;
  const c = resultado?.comparacao;
  const i = c?.ingressos;
  const diferenca = c && i ? c.aportesNoExtrato - (i.aprovado + i.aguardando) : 0;

  return (
    <section className="rounded border bg-white p-4" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="dados-transferegov-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="dados-transferegov-titulo" className={ROTULO}>Dados no Transferegov</h3>
          <p className="mt-1 text-[0.6875rem] text-black/50">Parceria, captação classificada e contas do projeto na API pública do Transferegov, pelo NUP.</p>
        </div>
        <button type="button" onClick={consultar} disabled={consultando} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.1)" }}>
          <RefreshCw size={12} className={consultando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
          {resultado ? "Consultar de novo" : "Consultar"}
        </button>
      </div>

      {erro && <p role="alert" className="mt-3 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}

      {p && c && i && resultado && (
        <div className="mt-3 space-y-4 text-[0.75rem]">
          <div>
            <p className="font-medium text-black/80">Parceria {p.codigo ?? p.id}{p.situacao ? ` · ${p.situacao}` : ""}</p>
            <p className="text-[0.625rem] text-black/45">
              {[p.processo ? `NUP ${p.processo}` : null, resultado.proposta?.instituicao, resultado.proposta?.municipio].filter(Boolean).join(" · ")}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div>
              <dt className={ROTULO}>Assinatura</dt>
              <dd className="tabular-nums text-black/75">{dataBr(p.assinatura)}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Autorização de execução</dt>
              <dd className="tabular-nums text-black/75">{dataBr(p.autorizacao.data)}</dd>
            </div>
            <div className="col-span-2">
              <dt className={ROTULO}>Captação</dt>
              <dd className="tabular-nums text-black/75">{p.captacao.inicio || p.captacao.fim ? `${dataBr(p.captacao.inicio)} a ${dataBr(p.captacao.fim)}` : "—"}</dd>
            </div>
          </dl>

          <div>
            <p className={ROTULO}>Captação no Transferegov</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div><dt className="text-[0.625rem] text-black/45">Doação aprovada pelo MS</dt><dd className={VALOR(i.aprovado)}>{reais(i.aprovado)}</dd></div>
              <div><dt className="text-[0.625rem] text-black/45">Aguardando análise</dt><dd className={VALOR(i.aguardando)}>{reais(i.aguardando)}</dd></div>
              <div><dt className="text-[0.625rem] text-black/45">Sem classificação</dt><dd className={VALOR(i.naoClassificado)}>{reais(i.naoClassificado)}</dd></div>
              <div><dt className="text-[0.625rem] text-black/45">Ingresso indevido</dt><dd className={VALOR(i.indevido)}>{reais(i.indevido)}</dd></div>
            </dl>
          </div>

          {resultado.contas.length > 0 && (
            <div>
              <p className={ROTULO}>Contas</p>
              <ul className="mt-1.5 divide-y divide-black/[.05]">
                {resultado.contas.map(conta => {
                  const saldo = saldoDaConta(conta);
                  return (
                    <li key={conta.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
                      <span className="min-w-0 text-black/70">
                        {conta.nome}{conta.numero ? ` · c/c ${conta.numero}` : ""}
                        <span className="block text-[0.625rem] text-black/40">{[conta.agencia ? `ag. ${conta.agencia}` : null, conta.situacao, conta.lancamentos.length ? `${conta.lancamentos.length} linhas no extrato` : "sem linhas no extrato"].filter(Boolean).join(" · ")}</span>
                      </span>
                      {saldo && (
                        <span className="text-right">
                          <span className={VALOR(saldo.valor)}>{reais(saldo.valor)}</span>
                          <span className="block text-[0.625rem] text-black/40">saldo com a aplicação{saldo.data ? ` em ${dataBr(saldo.data)}` : ""}</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <ul className="space-y-1.5 text-[0.6875rem]">
            {i.quantidadeNaoClassificada > 0 && (
              <li className="flex items-start gap-1 text-black/60">
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />
                <span>
                  {i.quantidadeNaoClassificada === 1 ? "1 crédito da Conta Captação está" : `${i.quantidadeNaoClassificada} créditos da Conta Captação estão`} sem classificação ({reais(i.naoClassificado)}): no Transferegov, a instituição classifica cada crédito como doação ou ingresso indevido para o MS analisar.
                </span>
              </li>
            )}
            <li className="flex items-start gap-1 text-black/60">
              {diferenca !== 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />}
              <span>
                Doações no Transferegov (aprovadas e em análise) {reais(i.aprovado + i.aguardando)}; aportes no extrato {reais(c.aportesNoExtrato)}
                {diferenca !== 0 && <>: diferença de {reais(Math.abs(diferenca))}. Importe o extrato do Transferegov ou confira a categoria dos créditos.</>}
              </span>
            </li>
            {c.contasQueFaltam.length > 0 && (
              <li className="flex items-start gap-1 text-black/60">
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />
                <span>
                  {c.contasQueFaltam.length === 1 ? "Conta do Transferegov que não está cadastrada na prestação" : "Contas do Transferegov que não estão cadastradas na prestação"}:{" "}
                  {c.contasQueFaltam.map(x => `${x.nome}${x.numero ? ` ${x.numero}` : ""}`).join("; ")}. A importação do extrato cadastra.
                </span>
              </li>
            )}
          </ul>

          {c.datas.length > 0 && (
            <div className="rounded border px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.6875rem] text-black/60">Datas do Transferegov diferentes das da prestação:</p>
              <ul className="mt-1 space-y-0.5 text-[0.6875rem] tabular-nums text-black/70">
                {c.datas.map(d => (
                  <li key={d.campo}>{d.rotulo}: {dataBr(d.noTransferegov)} <span className="text-black/40">(na prestação, {d.naPrestacao ? dataBr(d.naPrestacao) : "em branco"})</span></li>
                ))}
              </ul>
              {podeEditar && (
                <button type="button" onClick={usarDatas} disabled={salvando} className={`${BOTAO} mt-2`} style={{ borderColor: "rgba(13,13,13,.1)" }}>
                  {salvando && <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50 motion-reduce:animate-none" aria-hidden />}
                  Usar as datas do Transferegov
                </button>
              )}
            </div>
          )}

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-black/40">
            <span>Dados do Transferegov de {dataBr(resultado.atualizadoEm)} (a API é atualizada uma vez por dia)</span>
            <Link href={`/prestacoes/${prestacao.id}/extrato`} className={LINK}>Importar o extrato <ArrowRight size={10} aria-hidden /></Link>
          </p>
        </div>
      )}
    </section>
  );
}
