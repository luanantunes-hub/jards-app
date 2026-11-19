"use client";

// Planilhas do STR (P7.3): a Relação de Pagamentos, o Demonstrativo do Extrato
// e o Demonstrativo Orçamentário e Financeiro da ANCINE, montados da prestação
// sobre os modelos oficiais, com as críticas que o STR faz na carga e no envio.
// A pessoa corrige o que aparece aqui e baixa os .xls para carregar no STR.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { definida } from "@/lib/prestacao/regimes";
import {
  FONTES_DO_DO,
  fonteSugerida,
  planilhasDoStr,
  type ContaDoStr,
  type CriticaDoStr,
  type DestinoDaCritica,
  type FonteDoDo,
  type PlanilhasDoStr,
} from "@/lib/prestacao/planilhas-str";
import { partesDoZip, type ArquivoDoZip } from "@/lib/zip";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:cursor-not-allowed disabled:text-black/30";
const LINK = "inline-flex items-center gap-1 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]";

type Prestacao = {
  titulo: string;
  identificador_oficial: string | null;
  fonte_recurso: string | null;
  valor_aprovado: number | null;
  proponente: { nome: string } | null;
};

function linkDoDestino(id: string, destino: DestinoDaCritica | null): { href: string; rotulo: string } | null {
  if (!destino) return null;
  switch (destino.tipo) {
    case "despesa": return { href: `/prestacoes/${id}/comprovantes?despesa=${destino.id}`, rotulo: "Abrir despesa" };
    case "conciliacao": return { href: `/prestacoes/${id}/conciliacao`, rotulo: "Abrir conciliação" };
    case "orcamento": return { href: `/prestacoes/${id}/orcamento`, rotulo: "Abrir orçamento" };
    case "extrato": return { href: `/prestacoes/${id}/extrato`, rotulo: "Abrir extrato" };
    case "dados": return { href: `/prestacoes/${id}`, rotulo: "Abrir dados da prestação" };
  }
}

function ListaDeCriticas({ id, titulo, criticas, aviso }: { id: string; titulo: string; criticas: readonly CriticaDoStr[]; aviso?: boolean }) {
  if (!criticas.length) return null;
  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label={titulo}>
      <h3 className="border-b px-5 py-3 text-[0.75rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        {titulo} <span className="font-normal text-black/40">({criticas.length})</span>
      </h3>
      <ul className="divide-y divide-black/[.05]">
        {criticas.map((c, i) => {
          const link = linkDoDestino(id, c.destino);
          return (
            <li key={`${c.arquivo}-${c.linha}-${c.campo}-${i}`} className="flex items-start gap-2.5 px-5 py-3 text-[0.75rem]">
              {aviso
                ? <Info size={13} className="mt-0.5 shrink-0 text-black/40" aria-label="Aviso" />
                : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#D94A4A]" aria-label={c.momento === "carga" ? "Impede a carga" : "Impede o envio"} />}
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] text-black/45">
                  {[c.arquivo ?? "Todas as planilhas", c.linha ? `linha ${c.linha}` : null, c.campo, aviso ? null : c.momento === "carga" ? "recusa na carga" : "recusa no envio"].filter(Boolean).join(" · ")}
                </p>
                <p className="text-black/75">{c.mensagem}</p>
              </div>
              {link && (
                <Link href={link.href} className={`${LINK} shrink-0 text-[0.6875rem]`}>
                  {link.rotulo} <ArrowRight size={10} aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlanilhasStrPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { dados, erro } = useDadosDoEnvio(id);
  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [contas, setContas] = useState<ContaDoStr[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState("");
  const [fonteEscolhida, setFonteEscolhida] = useState<FonteDoDo | "" | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroAoGerar, setErroAoGerar] = useState("");

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    Promise.all([
      db.from("prestacoes_contas").select("titulo, identificador_oficial, fonte_recurso, valor_aprovado, proponente:proponente_id(nome)").eq("id", id).maybeSingle(),
      db.from("prestacao_contas_bancarias").select("id, tipo, banco, agencia, conta, apelido").eq("prestacao_id", id).order("created_at"),
    ]).then(([p, c]: { data: unknown; error: { message: string } | null }[]) => {
      if (!ativo) return;
      const falha = p.error ?? c.error;
      if (falha) { setErroAoCarregar(mensagemErroPrestacao(falha, "Não foi possível carregar a prestação")); return; }
      setPrestacao(p.data as Prestacao | null);
      setContas((c.data ?? []) as ContaDoStr[]);
    });
    return () => { ativo = false; };
  }, [id, supabase]);

  const fonte = fonteEscolhida === null ? fonteSugerida(prestacao?.fonte_recurso) : fonteEscolhida || null;
  const doStr = dados?.regime?.sistemaOficial?.includes("STR") ?? false;
  const planilhas: PlanilhasDoStr | null = useMemo(() => {
    if (!dados || !prestacao || !contas) return null;
    return planilhasDoStr({
      estado: dados.estado,
      contas,
      prestacao: {
        titulo: prestacao.titulo,
        identificador: prestacao.identificador_oficial,
        proponente: prestacao.proponente?.nome ?? null,
        valorAprovado: prestacao.valor_aprovado === null ? null : Number(prestacao.valor_aprovado),
      },
      fonte,
    });
  }, [dados, prestacao, contas, fonte]);

  const bloqueiam = planilhas?.criticas.filter(c => c.momento !== "aviso") ?? [];
  const avisos = planilhas?.criticas.filter(c => c.momento === "aviso") ?? [];
  const modelos = dados?.regime ? definida(dados.regime.envio)?.modelos ?? [] : [];
  const arquivoDoModelo = (codigo: string) => modelos.find(m => m.codigo === codigo)?.arquivo ?? null;

  async function gerar(): Promise<ArquivoDoZip[]> {
    if (!planilhas) return [];
    const [X, gravacao] = await Promise.all([import("xlsx"), import("@/lib/prestacao/planilhas-str-xls")]);
    const ler = async (codigo: string) => {
      const arquivo = arquivoDoModelo(codigo);
      if (!arquivo) throw new Error(`O regime não traz o modelo ${codigo.toUpperCase()}.`);
      const resposta = await fetch(`/modelos/${arquivo}`);
      if (!resposta.ok) throw new Error(`Não foi possível abrir o modelo ${codigo.toUpperCase()}.`);
      return new Uint8Array(await resposta.arrayBuffer());
    };
    const [rp, de, doModelo] = await Promise.all([ler("rp"), ler("de"), ler("do")]);
    return [
      { nome: planilhas.do.arquivo, dados: gravacao.gravarDo(X, doModelo, planilhas.cabecalho, planilhas.do) },
      ...planilhas.des.map(d => ({ nome: d.arquivo, dados: gravacao.gravarDe(X, de, planilhas.cabecalho, d) })),
      ...planilhas.rps.map(r => ({ nome: r.arquivo, dados: gravacao.gravarRp(X, rp, planilhas.cabecalho, r) })),
    ];
  }

  async function baixarTodas() {
    setGerando(true);
    setErroAoGerar("");
    try {
      const arquivos = await gerar();
      const nome = `planilhas-str-${(planilhas?.cabecalho.salic || prestacao?.titulo || id).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.zip`;
      baixar(new Blob(partesDoZip(arquivos) as BlobPart[], { type: "application/zip" }), nome);
    } catch (e) {
      setErroAoGerar(e instanceof Error ? e.message : "Não foi possível gerar as planilhas.");
    } finally {
      setGerando(false);
    }
  }

  async function baixarUma(nome: string) {
    setGerando(true);
    setErroAoGerar("");
    try {
      const arquivo = (await gerar()).find(a => a.nome === nome);
      if (arquivo) baixar(new Blob([arquivo.dados as BlobPart], { type: "application/vnd.ms-excel" }), arquivo.nome);
    } catch (e) {
      setErroAoGerar(e instanceof Error ? e.message : "Não foi possível gerar a planilha.");
    } finally {
      setGerando(false);
    }
  }

  const linhasDasPlanilhas = planilhas ? [
    { nome: planilhas.do.arquivo, tipo: "Demonstrativo Orçamentário e Financeiro (DO)", conta: "—", linhas: planilhas.do.linhas.filter(l => l.tipo === "item").length, unidade: "itens", total: planilhas.do.totalExecutado, nota: "executado" },
    ...planilhas.des.map(d => ({ nome: d.arquivo, tipo: `Demonstrativo do Extrato (DE), ${d.contaDe === "CAPTAÇÃO" ? "captação" : "movimentação"}`, conta: [d.banco, d.agencia, d.conta].filter(Boolean).join(" · ") || "—", linhas: d.linhas.length, unidade: "lançamentos", total: d.totais.saldo, nota: "saldo final" })),
    ...planilhas.rps.map(r => ({ nome: r.arquivo, tipo: r.contrapartida ? "Relação de Pagamentos (RP), contrapartida fora da conta" : "Relação de Pagamentos (RP)", conta: r.contrapartida ? "Contrapartida" : [r.banco, r.agencia, r.conta].filter(Boolean).join(" · ") || "—", linhas: r.linhas.length, unidade: "pagamentos", total: r.total, nota: null })),
  ] : [];
  const diferenca = planilhas ? planilhas.totais.comprovado - planilhas.totais.aComprovar : 0;
  const carregando = !planilhas && !erro && !erroAoCarregar;

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Planilhas do STR</h2>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
            Relação de Pagamentos, Demonstrativo do Extrato e Demonstrativo Orçamentário no modelo da ANCINE, montados com as despesas, o extrato e o orçamento.
            Resolva aqui o que o STR recusaria e baixe os arquivos em Excel 97-2003 para carregar.
          </p>
        </div>
        {planilhas && doStr && (
          <button
            type="button"
            onClick={baixarTodas}
            disabled={gerando}
            className="flex h-9 items-center gap-1.5 rounded bg-[#1C0E33] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none"
          >
            {gerando
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />
              : <Download size={13} aria-hidden />}
            Baixar planilhas
          </button>
        )}
      </div>

      {(erro || erroAoCarregar || erroAoGerar) && (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro || erroAoCarregar || erroAoGerar}</p>
      )}
      {dados && !doStr && (
        <p className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-black/60" style={BORDA}>
          As planilhas do STR são da ANCINE. {dados.regime ? `Esta prestação é de outro regime (${dados.regime.sistemaOficial ?? "sem sistema oficial"}).` : "Esta prestação ainda não tem regime."}
        </p>
      )}

      {carregando && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {planilhas && doStr && (
        <>
          <div className="grid gap-3 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="rounded border bg-white px-5 py-4" style={BORDA}>
              <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Fonte do recurso no DO</span>
              <Dropdown
                value={fonte ?? ""}
                onChange={v => setFonteEscolhida(v as FonteDoDo | "")}
                ariaLabel="Fonte do recurso no DO"
                options={[{ value: "", label: "Escolha a fonte" }, ...FONTES_DO_DO.map(f => ({ value: f.id, label: f.rotulo }))]}
              />
              <p className="mt-1.5 text-[0.625rem] text-black/45">
                Define o mecanismo (I.d) e a linha da captação na seção III.
                {prestacao?.fonte_recurso ? ` Na prestação: "${prestacao.fonte_recurso}".` : ""}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 text-[0.6875rem] md:grid-cols-3" style={BORDA}>
              <div>
                <dt className={ROTULO}>A comprovar</dt>
                <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${planilhas.totais.aComprovar ? "text-[#282525]" : "text-black/30"}`}>{reais(planilhas.totais.aComprovar)}</dd>
                <dd className="tabular-nums text-black/40">
                  captado {reais(planilhas.totais.captado)}
                  {planilhas.totais.contrapartidaMinima > 0 && ` + contrapartida ${reais(planilhas.totais.contrapartidaMinima)}`}
                  {` + rendimentos ${reais(planilhas.totais.rendimentos)}`}
                </dd>
              </div>
              <div>
                <dt className={ROTULO}>Comprovado</dt>
                <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${planilhas.totais.comprovado ? "text-[#282525]" : "text-black/30"}`}>{reais(planilhas.totais.comprovado)}</dd>
                <dd className="tabular-nums text-black/40">RPs {reais(planilhas.totais.rps)} + despesas bancárias {reais(planilhas.totais.despesasBancarias)}</dd>
              </div>
              <div className="col-span-2 md:col-span-1">
                <dt className={ROTULO}>Comprovado × a comprovar</dt>
                <dd className={`mt-0.5 flex items-center gap-1 text-[0.875rem] tabular-nums ${diferenca >= 0 ? "font-medium text-black/70" : "font-semibold text-[#282525]"}`}>
                  {diferenca < 0 && <AlertCircle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />}
                  {diferenca >= 0 ? "Fecha" : `Faltam ${reais(-diferenca)}`}
                </dd>
                <dd className="text-black/40">{diferenca >= 0 ? "O STR libera o envio." : "O STR bloqueia o envio."}</dd>
              </div>
            </dl>
          </div>

          {bloqueiam.length === 0 ? (
            <p className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>
              <CheckCircle2 size={14} aria-hidden /> Nenhuma crítica do STR nas planilhas.
            </p>
          ) : (
            <ListaDeCriticas id={id} titulo="O STR recusaria" criticas={bloqueiam} />
          )}
          <ListaDeCriticas id={id} titulo="Avisos" criticas={avisos} aviso />

          <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label="Planilhas">
            <h3 className="border-b px-5 py-3 text-[0.75rem] font-semibold text-[#282525]" style={{ borderColor: "rgba(13,13,13,.07)" }}>Planilhas</h3>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className={CABECALHO}>Arquivo</th>
                    <th className={CABECALHO}>Conta</th>
                    <th className={`${CABECALHO} text-right`}>Linhas</th>
                    <th className={`${CABECALHO} text-right`}>Total</th>
                    <th className={CABECALHO}><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {linhasDasPlanilhas.map(p => (
                    <tr key={p.nome} className="border-b align-top last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="px-4 py-3">
                        <p className="text-black/80">{p.nome}</p>
                        <p className="text-[0.625rem] text-black/40">{p.tipo}</p>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-black/60">{p.conta}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-black/70">{p.linhas} <span className="text-black/40">{p.unidade}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/80">
                        {reais(p.total)}
                        {p.nota && <span className="block text-[0.625rem] text-black/40">{p.nota}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" onClick={() => baixarUma(p.nome)} disabled={gerando} className={BOTAO} style={BORDA} aria-label={`Baixar ${p.nome}`}>
                          <FileSpreadsheet size={12} aria-hidden /> .xls
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-black/[.05] md:hidden">
              {linhasDasPlanilhas.map(p => (
                <li key={p.nome} className="space-y-1.5 px-5 py-3 text-[0.75rem]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-black/80">{p.nome}</p>
                      <p className="text-[0.625rem] text-black/40">{p.tipo}</p>
                    </div>
                    <span className="shrink-0 text-right tabular-nums text-black/80">
                      {reais(p.total)}
                      {p.nota && <span className="block text-[0.625rem] text-black/40">{p.nota}</span>}
                    </span>
                  </div>
                  <p className="text-[0.625rem] tabular-nums text-black/45">{p.conta} · {p.linhas} {p.unidade}</p>
                  <button type="button" onClick={() => baixarUma(p.nome)} disabled={gerando} className={BOTAO} style={BORDA} aria-label={`Baixar ${p.nome}`}>
                    <FileSpreadsheet size={12} aria-hidden /> Baixar .xls
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <p className="text-[0.625rem] text-black/40">
            Os arquivos saem do modelo oficial com os valores já calculados nas células de total e de saldo. Confira no Excel antes de carregar: o STR só aceita planilha salva como Excel 97-2003, e depois do envio não deixa alterar.
          </p>
        </>
      )}
    </div>
  );
}
