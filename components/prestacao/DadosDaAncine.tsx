"use client";

// Dados públicos do projeto na ANCINE (P7.5): situação, aprovação, período de
// captação, valores por mecanismo e contas, pela consulta de projetos do SAD,
// comparados com o que a prestação registra (aportes do extrato e contas).

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compararComSad, type ComparacaoComSad, type ProjetoNoSad } from "@/lib/prestacao/ancine-sad";

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-not-allowed disabled:text-black/30";
const ROTULO = "text-[0.625rem] text-black/40";

const ERROS: Record<string, string> = {
  salic_invalido: "Informe o SALIC (NN-NNNN) nos dados oficiais da prestação para consultar a ANCINE.",
  salic_nao_encontrado: "A ANCINE não encontrou um projeto com esse SALIC. Confira o número nos dados oficiais.",
  ancine_indisponivel: "A consulta da ANCINE não respondeu agora. Tente de novo em alguns minutos.",
};

type Resultado = { projeto: ProjetoNoSad; url: string; consultadoEm: string; comparacao: ComparacaoComSad };

export function DadosDaAncine({ prestacaoId }: { prestacaoId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");

  async function consultar() {
    setConsultando(true);
    setErro("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
      const db = supabase as any;
      const [resposta, aportes, contas] = await Promise.all([
        fetch(`/api/prestacoes/${prestacaoId}/ancine`, { cache: "no-store" }),
        db.from("prestacao_lancamentos").select("valor").eq("prestacao_id", prestacaoId).eq("natureza", "credito").eq("categoria", "aporte"),
        db.from("prestacao_contas_bancarias").select("conta").eq("prestacao_id", prestacaoId),
      ]);
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) { setErro(ERROS[corpo.error] ?? "Não foi possível consultar a ANCINE."); return; }
      const totalAportes = ((aportes.data ?? []) as { valor: number }[]).reduce((s, l) => s + Math.round(Number(l.valor) * 100), 0);
      setResultado({ ...corpo, comparacao: compararComSad(corpo.projeto, { aportes: totalAportes, contas: (contas.data ?? []) as { conta: string | null }[] }) });
    } catch {
      setErro("Não foi possível consultar a ANCINE.");
    } finally {
      setConsultando(false);
    }
  }

  const p = resultado?.projeto;
  const c = resultado?.comparacao;
  const diferencaCaptado = c ? c.aportesNoExtrato - c.captadoNoSad : 0;

  return (
    <section className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }} aria-labelledby="dados-ancine-titulo">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id="dados-ancine-titulo" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Dados na ANCINE</h3>
          <p className="mt-1 text-[0.6875rem] text-black/50">Situação, aprovação, captação e contas do projeto na consulta pública da ANCINE, pelo SALIC.</p>
        </div>
        <button type="button" onClick={consultar} disabled={consultando} className={BOTAO} style={{ borderColor: "rgba(13,13,13,.1)" }}>
          <RefreshCw size={12} className={consultando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />
          {resultado ? "Consultar de novo" : "Consultar"}
        </button>
      </div>

      {erro && <p role="alert" className="mt-3 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A47" }}>{erro}</p>}

      {p && c && resultado && (
        <div className="mt-3 space-y-3 text-[0.75rem]">
          <div>
            <p className="font-medium text-black/80">{p.projeto}</p>
            <p className={ROTULO}>{[`SALIC ${p.salic}`, p.processo ? `processo ${p.processo}` : null, p.segmento, p.uf].filter(Boolean).join(" · ")}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div className="col-span-2">
              <dt className={ROTULO}>Situação</dt>
              <dd className="text-black/75">{p.situacao ?? "—"}{p.dataSituacao ? <span className="text-black/40"> · {dataBr(p.dataSituacao)}</span> : null}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Aprovação</dt>
              <dd className="tabular-nums text-black/75">{dataBr(p.aprovacaoInicial?.data)}{p.aprovacaoInicial?.ato ? <span className="text-black/40"> · {p.aprovacaoInicial.ato}</span> : null}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Captação</dt>
              <dd className="tabular-nums text-black/75">{p.captacao ? `${dataBr(p.captacao.inicio)} a ${dataBr(p.captacao.fim)}` : "—"}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Primeira liberação</dt>
              <dd className="tabular-nums text-black/75">{dataBr(p.primeiraLiberacao)}</dd>
            </div>
            <div>
              <dt className={ROTULO}>Última prorrogação</dt>
              <dd className="tabular-nums text-black/75">{dataBr(p.ultimaProrrogacao)}</dd>
            </div>
          </dl>

          {p.valores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-[0.6875rem]">
                <thead>
                  <tr className="border-b text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className="py-1.5 pr-2 font-medium">Mecanismo</th>
                    <th className="py-1.5 px-2 text-right font-medium">Aprovado</th>
                    <th className="py-1.5 px-2 text-right font-medium">Captado</th>
                    <th className="py-1.5 pl-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {p.valores.map(v => (
                    <tr key={v.mecanismo} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="py-1.5 pr-2 text-black/70">{v.mecanismo}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-black/70">{reais(v.aprovado)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-black/70">{reais(v.captado)}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums text-black/70">{reais(v.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ul className="space-y-1 text-[0.6875rem]">
            <li className="flex items-start gap-1 text-black/60">
              {diferencaCaptado !== 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[#B07A14]" />}
              <span>
                Captado na ANCINE {reais(c.captadoNoSad / 100)}; aportes no extrato {reais(c.aportesNoExtrato / 100)}
                {diferencaCaptado !== 0 && <>: diferença de {reais(Math.abs(diferencaCaptado) / 100)}. Confira se todos os aportes foram importados.</>}
              </span>
            </li>
            {c.contasQueFaltam.length > 0 && (
              <li className="flex items-start gap-1 text-black/60">
                <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[#B07A14]" />
                <span>
                  {c.contasQueFaltam.length === 1 ? "Conta da ANCINE que não está cadastrada na prestação" : "Contas da ANCINE que não estão cadastradas na prestação"}:{" "}
                  {c.contasQueFaltam.map(x => `${x.mecanismo} (ag. ${x.agencia}, conta ${x.conta})`).join("; ")}.{" "}
                  <Link href={`/prestacoes/${prestacaoId}/extrato`} className="inline-flex items-center gap-0.5 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    Cadastrar no Extrato <ArrowRight size={10} aria-hidden />
                  </Link>
                </span>
              </li>
            )}
          </ul>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.625rem] text-black/40">
            <span>Consultado em {new Date(resultado.consultadoEm).toLocaleString("pt-BR")}</span>
            <a href={resultado.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              Ver na ANCINE <ExternalLink size={10} aria-hidden />
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
