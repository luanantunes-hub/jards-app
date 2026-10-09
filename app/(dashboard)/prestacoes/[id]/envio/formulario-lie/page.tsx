"use client";

// Formulário PCP/PCF 2026 da LIE (P8.2): as 10 abas do formulário da DPPIE
// montadas da prestação (receita e despesa, execução, pagamentos, recursos
// humanos, beneficiados, a executar e bens), com o que falta corrigir ou completar, e o
// arquivo gerado sobre o modelo oficial para juntar à PCP no SEI ou à PCF.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { definida } from "@/lib/prestacao/regimes";
import {
  ABAS_A_MAO,
  etapaSugerida,
  formularioLie,
  nomeDoFormulario,
  type AbaDoFormulario,
  type CriticaDoFormulario,
  type DestinoDoFormulario,
  type EtapaDoFormulario,
  type FormularioLie,
} from "@/lib/prestacao/formulario-lie";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const LINK = "inline-flex items-center gap-1 rounded text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]";

type Prestacao = { titulo: string; identificador_oficial: string | null; proponente: { nome: string } | null };

const ETAPAS: { value: EtapaDoFormulario; label: string }[] = [
  { value: "parcial", label: "Prestação de contas parcial (PCP)" },
  { value: "final", label: "Prestação de contas final (PCF)" },
];

function linkDoDestino(id: string, destino: DestinoDoFormulario | null): { href: string; rotulo: string } | null {
  if (!destino) return null;
  switch (destino.tipo) {
    case "despesa": return { href: `/prestacoes/${id}/comprovantes?despesa=${destino.id}`, rotulo: "Abrir despesa" };
    case "orcamento": return { href: `/prestacoes/${id}/orcamento`, rotulo: "Abrir orçamento" };
    case "comprovantes": return { href: `/prestacoes/${id}/comprovantes`, rotulo: "Abrir despesas" };
    case "conciliacao": return { href: `/prestacoes/${id}/conciliacao`, rotulo: "Abrir conciliação" };
    case "extrato": return { href: `/prestacoes/${id}/extrato`, rotulo: "Abrir extrato" };
    case "bens": return { href: `/prestacoes/${id}/bens`, rotulo: "Abrir bens" };
    case "beneficiarios": return { href: `/prestacoes/${id}/beneficiarios`, rotulo: "Abrir beneficiários" };
    case "dados": return { href: `/prestacoes/${id}`, rotulo: "Abrir dados da prestação" };
  }
}

function ListaDeCriticas({ id, titulo, criticas, aviso }: { id: string; titulo: string; criticas: readonly CriticaDoFormulario[]; aviso?: boolean }) {
  if (!criticas.length) return null;
  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label={titulo}>
      <h3 className="border-b px-5 py-3 text-[0.75rem] font-semibold text-black" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        {titulo} <span className="font-normal text-black/40">({criticas.length})</span>
      </h3>
      <ul className="divide-y divide-black/[.05]">
        {criticas.map((c, i) => {
          const link = linkDoDestino(id, c.destino);
          return (
            <li key={`${c.aba}-${c.linha}-${c.campo}-${i}`} className="flex flex-wrap items-start gap-x-2.5 gap-y-1 px-5 py-3 text-[0.75rem] sm:flex-nowrap">
              {aviso
                ? <Info size={13} className="mt-0.5 shrink-0 text-black/40" aria-label="Aviso" />
                : <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#B23B3B]" aria-label="Corrigir" />}
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] text-black/45">{[c.aba ?? "Todas as abas", c.linha ? `linha ${c.linha}` : null, c.campo].filter(Boolean).join(" · ")}</p>
                <p className="text-black/75">{c.mensagem}</p>
              </div>
              {link && (
                <Link href={link.href} className={`${LINK} shrink-0 pl-6 text-[0.6875rem] sm:pl-0`}>
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

type LinhaDaAba = { aba: AbaDoFormulario; conteudo: string; total: number | null; nota: string | null };

function linhasDasAbas(f: FormularioLie): LinhaDaAba[] {
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const aExecutar = f.acoes.filter(a => a.divisao !== "elaboracao");
  return [
    { aba: "RECEITA E DESPESA", conteudo: `${plural(f.receitas.length, "receita", "receitas")} · ${plural(f.despesas.length, "ação", "ações")}`, total: f.totais.saldo, nota: "saldo" },
    { aba: "EXECUTADO", conteudo: plural(f.itens.length, "ação do plano", "ações do plano"), total: f.itens.reduce((s, i) => s + i.executado, 0), nota: "executado" },
    { aba: "PAGAMENTOS", conteudo: plural(f.pagamentos.length, "pagamento", "pagamentos"), total: f.totais.pagamentos, nota: null },
    { aba: "RECURSOS HUMANOS", conteudo: plural(f.recursosHumanos.length, "pessoa", "pessoas"), total: f.recursosHumanos.reduce((s, r) => s + r.valor, 0), nota: "pago" },
    f.etapa === "parcial"
      ? { aba: "A EXECUTAR", conteudo: `${plural(aExecutar.length, "ação", "ações")} com o orçado; os meses ficam para preencher`, total: f.acoes.reduce((s, a) => s + a.programado, 0), nota: "orçado" }
      : { aba: "A EXECUTAR", conteudo: "Só na PCP: sai vazia", total: null, nota: null },
    {
      aba: "BENEFICIADOS",
      conteudo: f.beneficiados.linhas.length
        ? `${plural(f.beneficiados.linhas.length, "beneficiado", "beneficiados")} · ${f.beneficiados.feminino} F e ${f.beneficiados.masculino} M`
        : "Cabeçalho e marcador; nenhum beneficiado cadastrado",
      total: null,
      nota: null,
    },
    { aba: "BENS ADQUIRIDOS", conteudo: plural(f.bens.length, "bem", "bens"), total: f.bens.reduce((s, b) => s + b.valor, 0), nota: null },
    ...ABAS_A_MAO.map(aba => ({ aba, conteudo: "Cabeçalho e marcador; os dados ficam para preencher", total: null, nota: null })),
  ];
}

export default function FormularioLiePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { dados, erro } = useDadosDoEnvio(id);
  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState("");
  const [etapaEscolhida, setEtapa] = useState<EtapaDoFormulario | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroAoGerar, setErroAoGerar] = useState("");

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    (supabase as any).from("prestacoes_contas").select("titulo, identificador_oficial, proponente:proponente_id(nome)").eq("id", id).maybeSingle()
      .then(({ data, error }: { data: Prestacao | null; error: { message: string } | null }) => {
        if (!ativo) return;
        if (error) { setErroAoCarregar(mensagemErroPrestacao(error, "Não foi possível carregar a prestação")); return; }
        setPrestacao(data);
      });
    return () => { ativo = false; };
  }, [id, supabase]);

  // A etapa vem da aba Envio (?etapa=) ou do fim da vigência; lida só depois dos dados, já no navegador.
  const etapaInicial = useMemo<EtapaDoFormulario | null>(() => {
    if (!dados) return null;
    const daUrl = new URLSearchParams(window.location.search).get("etapa");
    return daUrl === "parcial" || daUrl === "final" ? daUrl : etapaSugerida(dados.estado, new Date());
  }, [dados]);
  const etapa: EtapaDoFormulario = etapaEscolhida ?? etapaInicial ?? "parcial";

  const modelo = dados?.regime ? definida(dados.regime.envio)?.modelos.find(m => m.codigo === "formulario_pcp_pcf") ?? null : null;
  const formulario: FormularioLie | null = useMemo(() => {
    if (!dados || !prestacao) return null;
    return formularioLie({
      estado: dados.estado,
      etapa,
      prestacao: { titulo: prestacao.titulo, sli: prestacao.identificador_oficial, proponente: prestacao.proponente?.nome ?? null },
      contas: dados.contas,
    });
  }, [dados, prestacao, etapa]);

  const corrigir = formulario?.criticas.filter(c => c.tipo === "corrigir") ?? [];
  const avisos = formulario?.criticas.filter(c => c.tipo === "aviso") ?? [];
  const abas = formulario ? linhasDasAbas(formulario) : [];
  const carregando = !formulario && !erro && !erroAoCarregar;

  async function baixarFormulario() {
    if (!formulario || !modelo?.arquivo) return;
    const caminho = `/modelos/${modelo.arquivo.replace(/\.xls$/i, ".xlsx")}`;
    setGerando(true);
    setErroAoGerar("");
    try {
      const { gravarFormularioLie } = await import("@/lib/prestacao/formulario-lie-xlsx");
      const resposta = await fetch(caminho);
      if (!resposta.ok) throw new Error("Não foi possível abrir o modelo do formulário.");
      const arquivo = await gravarFormularioLie(new Uint8Array(await resposta.arrayBuffer()), formulario);
      baixar(new Blob([arquivo as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nomeDoFormulario(formulario));
    } catch (e) {
      setErroAoGerar(e instanceof Error ? e.message : "Não foi possível gerar o formulário.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Formulário PCP/PCF</h2>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
            As 10 abas do formulário da DPPIE, montadas com o extrato, o orçamento, as despesas, os beneficiados e os bens.
            Corrija aqui o que sai errado, complete no Excel o que o Jards não sabe e junte o arquivo à PCP no SEI ou à PCF.
          </p>
        </div>
        {formulario && modelo && (
          <button
            type="button"
            onClick={baixarFormulario}
            disabled={gerando}
            className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none"
          >
            {gerando
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />
              : <Download size={13} aria-hidden />}
            Baixar formulário
          </button>
        )}
      </div>

      {(erro || erroAoCarregar || erroAoGerar) && (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro || erroAoCarregar || erroAoGerar}</p>
      )}
      {dados && !modelo && (
        <p className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-black/60" style={BORDA}>
          O formulário PCP/PCF é da Lei de Incentivo ao Esporte. {dados.regime ? "O regime desta prestação não usa esse formulário." : "Esta prestação ainda não tem regime."}
        </p>
      )}

      {carregando && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {formulario && modelo && (
        <>
          <div className="grid gap-3 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div className="rounded border bg-white px-5 py-4" style={BORDA}>
              <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Etapa</span>
              <Dropdown value={etapa} onChange={v => setEtapa(v as EtapaDoFormulario)} ariaLabel="Etapa do formulário" options={ETAPAS} />
              <p className="mt-1.5 text-[0.625rem] text-black/45">
                Marca PARCIAL ou FINAL em todas as abas que têm o marcador. A aba A EXECUTAR só vai na PCP.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 text-[0.6875rem] md:grid-cols-4" style={BORDA}>
              <div>
                <dt className="text-black/40">Receitas</dt>
                <dd className="text-[0.875rem] tabular-nums text-black/80">{reais(formulario.totais.receitas)}</dd>
                <dd className="tabular-nums text-black/40">captado {reais(formulario.cabecalho.captado)} + rendimentos {reais(formulario.cabecalho.rendimentos)}</dd>
              </div>
              <div>
                <dt className="text-black/40">Despesas</dt>
                <dd className="text-[0.875rem] tabular-nums text-black/80">{reais(formulario.totais.despesas)}</dd>
                <dd className="tabular-nums text-black/40">de {reais(formulario.totais.programado)} programados</dd>
              </div>
              <div>
                <dt className="text-black/40">Saldo</dt>
                <dd className="text-[0.875rem] tabular-nums text-black/80">{reais(formulario.totais.saldo)}</dd>
                <dd className="tabular-nums text-black/40">
                  {formulario.totais.saldoDasContas === null ? "sem saldo de extrato" : `contas: ${reais(formulario.totais.saldoDasContas)}`}
                </dd>
              </div>
              <div>
                <dt className="text-black/40">Pagamentos</dt>
                <dd className="text-[0.875rem] tabular-nums text-black/80">{reais(formulario.totais.pagamentos)}</dd>
                <dd className="tabular-nums text-black/40">
                  {formulario.totais.semPagamento.quantidade ? `${formulario.totais.semPagamento.quantidade} sem pagamento` : "todas as despesas pagas"}
                </dd>
              </div>
            </dl>
          </div>

          {corrigir.length === 0 ? (
            <p className="flex items-center gap-2 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>
              <CheckCircle2 size={14} aria-hidden /> Nada a corrigir nos dados que vão para o formulário.
            </p>
          ) : (
            <ListaDeCriticas id={id} titulo="Corrigir antes de gerar" criticas={corrigir} />
          )}
          <ListaDeCriticas id={id} titulo="Conferir e completar no Excel" criticas={avisos} aviso />

          <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label="Abas do formulário">
            <h3 className="border-b px-5 py-3 text-[0.75rem] font-semibold text-black" style={{ borderColor: "rgba(13,13,13,.07)" }}>Abas</h3>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[0.75rem]">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <th className={CABECALHO}>Aba</th>
                    <th className={CABECALHO}>Conteúdo</th>
                    <th className={`${CABECALHO} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {abas.map(a => (
                    <tr key={a.aba} className="border-b align-top last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="whitespace-nowrap px-4 py-3 text-black/80">{a.aba}</td>
                      <td className={`px-4 py-3 ${a.total === null ? "text-black/45" : "text-black/65"}`}>{a.conteudo}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-black/80">
                        {a.total === null ? "—" : reais(a.total)}
                        {a.nota && <span className="block text-[0.625rem] text-black/40">{a.nota}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-black/[.05] md:hidden">
              {abas.map(a => (
                <li key={a.aba} className="flex items-start justify-between gap-3 px-5 py-3 text-[0.75rem]">
                  <div className="min-w-0">
                    <p className="text-black/80">{a.aba}</p>
                    <p className="text-[0.625rem] text-black/45">{a.conteudo}</p>
                  </div>
                  {a.total !== null && (
                    <span className="shrink-0 text-right tabular-nums text-black/80">
                      {reais(a.total)}
                      {a.nota && <span className="block text-[0.625rem] text-black/40">{a.nota}</span>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <p className="text-[0.625rem] text-black/40">
            O arquivo sai do modelo oficial da DPPIE convertido para Excel (.xlsx), com as mesmas abas, o logotipo, as bordas e as fórmulas; os totais já vêm calculados.
            Confira no Excel, complete o que ficou para preencher e assine antes de enviar.
          </p>
        </>
      )}
    </div>
  );
}
