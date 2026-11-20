"use client";

// Carimbo e atesto das notas (P8.8): o texto do carimbo da frente e do atesto
// do verso como no modelo da DPPIE, com a lei escolhida na prestação; a data
// do atesto de cada nota, conferida contra a emissão e a vigência; e a folha
// de carimbos em PDF para imprimir.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Download, Stamp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { useRegimesPublicados } from "@/hooks/useRegimesPublicados";
import {
  frenteDoCarimbo, LEI_DO_MODELO, leiDoCarimbo, nomeDosCarimbos, notasDoCarimbo, OPCOES_DE_LEI, problemaDoAtesto,
  regimePedeCarimbo, TEXTO_DO_PROBLEMA, versoDoCarimbo,
} from "@/lib/prestacao/carimbo";
import { tituloDeCredito } from "@/lib/prestacao/formulario-lie";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { pedirVerificacao } from "@/lib/prestacao/verificar-cliente";
import type { PrestacaoComprovante, PrestacaoFornecedor } from "@/lib/supabase/types";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const VALOR = (n: number) => `font-semibold tabular-nums ${n ? "text-[#282525]" : "text-black/30"}`;
const CAMPO = "h-9 rounded border border-black/[.12] bg-white px-2 text-[0.75rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:bg-black/[.02] disabled:text-black/45";
const reais = (v: number | null) => (v === null ? "" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

type Prestacao = {
  titulo: string; identificador_oficial: string | null; carimbo_lei: string | null; regime_id: string | null; organization_id: string;
  data_termo: string | null; data_inicio_execucao: string | null; data_fim_execucao: string | null;
};
type Nota = Pick<PrestacaoComprovante, "id" | "tipo" | "status" | "nome_arquivo" | "numero_documento" | "serie" | "data_doc" | "valor_extraido" | "fornecedor_id" | "atestado_em">;
type Fornecedor = Pick<PrestacaoFornecedor, "id" | "nome" | "razao_social">;

function Quadro({ titulo, linhas }: { titulo: string; linhas: readonly string[] }) {
  return (
    <div className="flex min-h-[8.5rem] flex-col rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.18)" }}>
      <span className="text-[0.5625rem] font-medium uppercase tracking-[.08em] text-black/40">{titulo}</span>
      <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-[0.75rem] text-[#282525]">
        {linhas.map((l, i) => <p key={i} className={i === 0 || l === "ASSINATURA" ? "font-semibold" : ""}>{l}</p>)}
      </div>
    </div>
  );
}

export default function CarimbosPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const podeEditar = usePermissoesPrestacao(id).editar;
  const regimes = useRegimesPublicados();

  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [dataEmLote, setDataEmLote] = useState("");
  const [gerando, setGerando] = useState(false);

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    const [p, d] = await Promise.all([
      db.from("prestacoes_contas").select("titulo, identificador_oficial, carimbo_lei, regime_id, organization_id, data_termo, data_inicio_execucao, data_fim_execucao").eq("id", id).maybeSingle(),
      db.from("prestacao_comprovantes").select("id, tipo, status, nome_arquivo, numero_documento, serie, data_doc, valor_extraido, fornecedor_id, atestado_em").eq("prestacao_id", id).order("data_doc").order("id"),
    ]);
    const ids = [...new Set(((d.data ?? []) as Nota[]).map(n => n.fornecedor_id).filter(Boolean))];
    const f = ids.length && p.data?.organization_id
      ? await db.from("prestacao_fornecedores").select("id, nome, razao_social").eq("organization_id", p.data.organization_id).in("id", ids)
      : { data: [], error: null };
    const falha = p.error ?? d.error ?? f.error;
    return {
      erro: falha ? mensagemErroPrestacao(falha, "Não foi possível carregar as notas") : "",
      prestacao: (p.data ?? null) as Prestacao | null,
      notas: notasDoCarimbo((d.data ?? []) as Nota[]),
      fornecedores: (f.data ?? []) as Fornecedor[],
    };
  }, [id, supabase]);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscar>>) => {
    setErro(dados.erro);
    setPrestacao(dados.prestacao);
    setNotas(dados.notas);
    setFornecedores(dados.fornecedores);
    setCarregando(false);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(dados => { if (ativo) aplicar(dados); });
    return () => { ativo = false; };
  }, [aplicar, buscar]);

  const regime = regimes.find(r => r.id === prestacao?.regime_id)?.regime ?? null;
  const pede = regimePedeCarimbo(regime);
  const nomeDe = useMemo(() => new Map(fornecedores.map(f => [f.id, f.nome?.trim() || f.razao_social?.trim() || ""])), [fornecedores]);
  const vigencia = { inicio: prestacao?.data_termo ?? prestacao?.data_inicio_execucao ?? null, fim: prestacao?.data_fim_execucao ?? null };
  const semAtesto = notas.filter(n => !n.atestado_em);
  const atestadas = notas.length - semAtesto.length;
  const comProblema = notas.filter(n => problemaDoAtesto(n, vigencia)).length;

  async function gravarLei(valor: string) {
    if (!prestacao) return;
    const nova = valor === LEI_DO_MODELO ? null : valor;
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela fora do tipo Database
    const { error } = await (supabase as any).from("prestacoes_contas").update({ carimbo_lei: nova }).eq("id", id);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível gravar a lei do carimbo")); return; }
    setPrestacao({ ...prestacao, carimbo_lei: nova });
  }

  async function gravarAtesto(ids: string[], data: string | null) {
    if (!ids.length) return;
    setSalvando(ids.length === 1 ? ids[0] : "lote");
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela fora do tipo Database
    const { error } = await (supabase as any).from("prestacao_comprovantes").update({ atestado_em: data }).in("id", ids);
    setSalvando(null);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível gravar a data do atesto")); return; }
    setNotas(atual => atual.map(n => (ids.includes(n.id) ? { ...n, atestado_em: data } : n)));
    pedirVerificacao(id);
  }

  async function baixarFolha() {
    if (!prestacao) return;
    setGerando(true);
    setErro("");
    try {
      const { gerarFolhaDeCarimbos } = await import("@/lib/prestacao/carimbo-pdf");
      const bytes = await gerarFolhaDeCarimbos({
        projeto: prestacao.titulo,
        sli: prestacao.identificador_oficial,
        lei: prestacao.carimbo_lei,
        notas: notas.map(n => ({
          documento: tituloDeCredito(n) || n.nome_arquivo || "Nota",
          fornecedor: n.fornecedor_id ? nomeDe.get(n.fornecedor_id) ?? "" : "",
          emissao: n.data_doc,
          valor: n.valor_extraido === null ? null : reais(Number(n.valor_extraido)),
          atestadoEm: n.atestado_em ?? null,
        })),
      });
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDosCarimbos(prestacao.identificador_oficial);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar a folha de carimbos.");
    } finally {
      setGerando(false);
    }
  }

  const aviso = (n: Nota) => {
    const problema = problemaDoAtesto(n, vigencia);
    return problema ? (
      <span className="mt-0.5 flex items-start gap-1 text-[0.625rem] text-black/50">
        <AlertTriangle size={12} strokeWidth={1.75} aria-label="Alerta" className="mt-px shrink-0 text-[#B07A14]" />
        {TEXTO_DO_PROBLEMA[problema].replace(/^./, c => c.toUpperCase())}.
      </span>
    ) : null;
  };
  const campoDoAtesto = (n: Nota) => (
    <input
      type="date"
      value={n.atestado_em ?? ""}
      disabled={!podeEditar || salvando === n.id || salvando === "lote"}
      onChange={e => gravarAtesto([n.id], e.target.value || null)}
      aria-label={`Data do atesto de ${tituloDeCredito(n) || n.nome_arquivo || "nota"}`}
      className={`${CAMPO} w-[9.5rem]`}
    />
  );

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Carimbo e atesto das notas</h2>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
            Cada nota original leva na frente o carimbo com o número do projeto no SLI e, no verso, o atesto de recebimento com a data e a assinatura.
            Registre aqui a data do atesto de cada nota; a folha em PDF traz o texto do modelo para conferir ou imprimir em etiqueta.
          </p>
        </div>
        {prestacao && notas.length > 0 && (
          <button
            type="button"
            onClick={baixarFolha}
            disabled={gerando}
            className="flex h-9 items-center gap-1.5 rounded bg-[#1C0E33] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#2D1A53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {gerando
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />
              : <Download size={13} aria-hidden />}
            Baixar folha de carimbos
          </button>
        )}
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "rgba(178,59,59,.35)" }}>{erro}</p>}
      {!carregando && prestacao && regime && !pede && (
        <p className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-black/60" style={BORDA}>
          O carimbo e o atesto são da Lei de Incentivo ao Esporte; o regime desta prestação não pede. As datas ficam registradas mesmo assim.
        </p>
      )}

      {carregando ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      ) : prestacao && (
        <>
          <section className="grid gap-4 rounded border bg-white px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,16rem)]" style={BORDA} aria-label="Texto do carimbo">
            <Quadro titulo="Frente da nota" linhas={frenteDoCarimbo(prestacao.identificador_oficial, prestacao.carimbo_lei)} />
            <Quadro titulo="Verso da nota" linhas={versoDoCarimbo(null)} />
            <div className="space-y-1.5">
              <span className="block text-[0.625rem] font-medium text-black/45">Lei no carimbo</span>
              {podeEditar ? (
                <Dropdown
                  value={leiDoCarimbo(prestacao.carimbo_lei)}
                  onChange={gravarLei}
                  ariaLabel="Lei no carimbo"
                  options={OPCOES_DE_LEI.map(o => ({ value: o.valor, label: `${o.rotulo} (${o.descricao})` }))}
                />
              ) : (
                <p className="text-[0.75rem] text-black/70">{leiDoCarimbo(prestacao.carimbo_lei)}</p>
              )}
              <p className="text-[0.625rem] leading-4 text-black/40">
                O modelo publicado pela DPPIE ainda cita a Lei 11.438/2006, revogada pela Lei Complementar 222/2025. Use a do modelo até a DPPIE publicar outro.
              </p>
              {!prestacao.identificador_oficial && (
                <span className="flex items-start gap-1 text-[0.625rem] text-black/50">
                  <AlertTriangle size={12} strokeWidth={1.75} aria-label="Alerta" className="mt-px shrink-0 text-[#B07A14]" />
                  <span>Informe o número do SLI nos <Link href={`/prestacoes/${id}#dados-oficiais`} className="underline decoration-black/20 underline-offset-2 hover:text-[#282525]">dados oficiais</Link>.</span>
                </span>
              )}
            </div>
          </section>

          <dl className="flex flex-wrap gap-x-6 gap-y-1 rounded border bg-white px-5 py-3 text-[0.6875rem]" style={BORDA}>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Notas</dt><dd className={VALOR(notas.length)}>{notas.length}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className={ROTULO}>Atestadas</dt><dd className={VALOR(atestadas)}>{atestadas}</dd></div>
            {semAtesto.length > 0 && (
              <div className="flex items-center gap-1.5">
                <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                  Sem atesto
                </dt>
                <dd className={VALOR(semAtesto.length)}>{semAtesto.length}</dd>
              </div>
            )}
            {comProblema > 0 && (
              <div className="flex items-center gap-1.5">
                <dt className={`${ROTULO} inline-flex items-center gap-1`}>
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />
                  Fora da data
                </dt>
                <dd className={VALOR(comProblema)}>{comProblema}</dd>
              </div>
            )}
          </dl>

          <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="notas-titulo">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <h3 id="notas-titulo" className="text-[0.75rem] font-semibold text-[#282525]">Notas <span className="font-normal tabular-nums text-black/35">({notas.length})</span></h3>
              {podeEditar && semAtesto.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={dataEmLote} onChange={e => setDataEmLote(e.target.value)} aria-label="Data do atesto para as notas sem data" className={CAMPO} />
                  <button
                    type="button"
                    disabled={!dataEmLote || salvando === "lote"}
                    onClick={() => gravarAtesto(semAtesto.map(n => n.id), dataEmLote)}
                    className="flex h-9 items-center rounded border bg-white px-3 text-[0.75rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: "rgba(13,13,13,.14)" }}
                  >
                    Atestar as {semAtesto.length} sem data
                  </button>
                </div>
              )}
            </div>
            {notas.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Stamp size={22} className="mx-auto text-black/20" aria-hidden />
                <p className="mt-2 text-[0.75rem] text-black/55">Nenhuma nota para carimbar.</p>
                <p className="mx-auto max-w-[30rem] text-[0.6875rem] text-black/35">Notas, faturas, cupons e recibos lançados em Comprovantes aparecem aqui.</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-[0.75rem]">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                        <th className={`${CABECALHO} w-full`}>Documento</th>
                        <th className={CABECALHO}>Fornecedor</th>
                        <th className={CABECALHO}>Emissão</th>
                        <th className={`${CABECALHO} text-right`}>Valor</th>
                        <th className={CABECALHO}>Atesto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notas.map(n => (
                        <tr key={n.id} className="border-b align-top transition last:border-0 hover:bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <td className="px-4 py-2.5">
                            <Link href={`/prestacoes/${id}/comprovantes?despesa=${n.id}`} className="text-black/80 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{tituloDeCredito(n) || n.nome_arquivo}</Link>
                            {tituloDeCredito(n) && n.nome_arquivo && <p className="text-[0.625rem] text-black/40">{n.nome_arquivo}</p>}
                            {aviso(n)}
                          </td>
                          <td className="min-w-[10rem] px-4 py-2.5 text-[0.6875rem] text-black/60">{n.fornecedor_id ? nomeDe.get(n.fornecedor_id) : "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[0.6875rem] tabular-nums text-black/60">{dataBr(n.data_doc) || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-black/70">{n.valor_extraido === null ? "—" : reais(Number(n.valor_extraido))}</td>
                          <td className="px-4 py-1.5">{campoDoAtesto(n)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-black/[.05] md:hidden">
                  {notas.map(n => (
                    <li key={n.id} className="space-y-1.5 px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link href={`/prestacoes/${id}/comprovantes?despesa=${n.id}`} className="text-[0.75rem] text-black/80 hover:underline">{tituloDeCredito(n) || n.nome_arquivo}</Link>
                          <p className="text-[0.625rem] text-black/45">
                            {[n.fornecedor_id ? nomeDe.get(n.fornecedor_id) : null, dataBr(n.data_doc), n.valor_extraido === null ? null : reais(Number(n.valor_extraido))].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-[0.625rem] text-black/45">Atesto {campoDoAtesto(n)}</label>
                      {aviso(n)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
