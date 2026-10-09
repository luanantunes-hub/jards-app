"use client";

// Pacote do envio (P4.5): os documentos do checklist e os comprovantes,
// renomeados no padrão do sistema de destino, com o manifesto (tamanho e
// SHA-256 de cada arquivo) e o relatório da prestação em PDF, num .zip
// montado no navegador. O que está fora da regra do regime aparece antes de
// gerar; o pré-pacote sai a qualquer momento e diz o que falta. Depois do
// pacote, quem decide registra o envio (P4.6), com o manifesto dele.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileArchive, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { useEnviosRegistrados } from "@/hooks/useEnviosRegistrados";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { RegistrarEnvio } from "@/components/prestacao/envio/RegistrarEnvio";
import { envioVigente, exerciciosEnviados } from "@/lib/prestacao/envios";
import { exercicioInicial, exerciciosDaAnual } from "@/lib/prestacao/exercicios";
import { EtapaDoEnvio } from "@/components/prestacao/envio/EtapaDoEnvio";
import { checklistDeEnvio, etapasDoRegime, nomeDaConta, type EtapaEnvio } from "@/lib/prestacao/envio";
import {
  manifestoCsv,
  nomeDoPacote,
  planoDoPacote,
  sha256,
  textoDasFaltas,
  type ArquivoDaDespesa,
  type DadosDoPacote,
  type DevolucaoDoPacote,
  type ExtratoDoPacote,
  type LinhaDoManifesto,
  type Manifesto,
  type MetadadosDoArquivo,
  type PadraoDosNomes,
  type TipoDoPacote,
} from "@/lib/prestacao/pacote";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { partesDoZip, type ArquivoDoZip } from "@/lib/zip";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const ROTULO = "flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40";
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";
const PADRAO: Record<PadraoDosNomes, string> = {
  salic: "Na ordem do espelho do Salic",
  str: "Pela linha da RP (00012_P.pdf)",
  geral: "Por data do documento",
};

const tamanho = (bytes: number | null) =>
  bytes === null ? "—" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const quando = (d: Date) => d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Extras = {
  prestacao: { titulo: string; identificador_oficial: string | null; proponente: { nome: string; cnpj: string | null } | null } | null;
  despesas: ArquivoDaDespesa[];
  devolucoes: DevolucaoDoPacote[];
  extratos: Omit<ExtratoDoPacote, "conta">[];
  metadados: Map<string, MetadadosDoArquivo>;
};

/** Tamanho e tipo de cada arquivo, pela listagem das pastas no armazenamento. */
async function listarMetadados(supabase: ReturnType<typeof createClient>, caminhos: string[]): Promise<Map<string, MetadadosDoArquivo>> {
  const pastas = [...new Set(caminhos.map(c => c.slice(0, c.lastIndexOf("/"))).filter(Boolean))];
  const mapa = new Map<string, MetadadosDoArquivo>();
  await Promise.all(pastas.map(async pasta => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from("documentos").list(pasta, { limit: 1000, offset });
      if (error) throw new Error(`Não foi possível listar os arquivos: ${error.message}`);
      for (const o of data ?? []) {
        if (!o.id) continue;
        const meta = o.metadata as { size?: number; mimetype?: string } | null;
        mapa.set(`${pasta}/${o.name}`, { tamanho: typeof meta?.size === "number" ? meta.size : null, mime: meta?.mimetype ?? null });
      }
      if (!data || data.length < 1000) break;
    }
  }));
  return mapa;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function PacotePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const { dados, erro: erroDoEnvio, recarregar: recarregarEnvio } = useDadosDoEnvio(id);
  const permissoes = usePermissoesPrestacao(id);
  const { envios, recarregar: recarregarEnvios } = useEnviosRegistrados(id);
  const [ultimoPacote, setUltimoPacote] = useState<{ etapa: EtapaEnvio; exercicio: number; manifesto: Manifesto } | null>(null);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [erro, setErro] = useState("");
  const [etapaEscolhida, setEtapa] = useState<EtapaEnvio>("final");
  const [exercicioEscolhido, setExercicio] = useState<number | null>(null);
  const [progresso, setProgresso] = useState<{ texto: string; feito: number; total: number } | null>(null);
  const [gerado, setGerado] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<{ extras: Extras | null; erro: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas da prestação ainda não estão no tipo Database
    const db = supabase as any;
    try {
      const [p, d, g, e] = await Promise.all([
        db.from("prestacoes_contas").select("titulo, identificador_oficial, proponente:proponente_id(nome, cnpj)").eq("id", id).maybeSingle(),
        db.from("prestacao_comprovantes").select("id, storage_path, nome_arquivo").eq("prestacao_id", id),
        db.from("prestacao_devolucoes").select("id, motivo, situacao, storage_path, nome_arquivo, mime_type, valor_principal, valor_atualizado, valor_pago").eq("prestacao_id", id).order("ordem").order("created_at"),
        db.from("prestacao_extrato_importacoes").select("id, conta_id, nome_arquivo, storage_path, periodo_inicio, periodo_fim").eq("prestacao_id", id).order("periodo_inicio"),
      ]);
      const falha = p.error ?? d.error ?? g.error ?? e.error;
      if (falha) return { extras: null, erro: mensagemErroPrestacao(falha, "Não foi possível carregar o pacote") };
      const caminhos = [
        ...(d.data ?? []).map((x: ArquivoDaDespesa) => x.storage_path),
        ...(g.data ?? []).map((x: DevolucaoDoPacote) => x.storage_path),
        ...(e.data ?? []).map((x: ExtratoDoPacote) => x.storage_path),
      ].filter((c): c is string => Boolean(c));
      return {
        erro: "",
        extras: { prestacao: p.data ?? null, despesas: d.data ?? [], devolucoes: g.data ?? [], extratos: e.data ?? [], metadados: await listarMetadados(supabase, caminhos) },
      };
    } catch (x) {
      return { extras: null, erro: x instanceof Error ? x.message : "Não foi possível carregar o pacote." };
    }
  }, [id, supabase]);

  // Os arquivos do checklist entram na listagem quando o envio carrega.
  const caminhosDoEnvio = useMemo(() => (dados?.arquivos ?? []).map(a => a.storage_path).join("|"), [dados]);
  useEffect(() => {
    let ativo = true;
    carregar().then(async lido => {
      if (!ativo) return;
      if (lido.extras && caminhosDoEnvio) {
        try {
          const doEnvio = await listarMetadados(supabase, caminhosDoEnvio.split("|"));
          for (const [k, v] of doEnvio) lido.extras.metadados.set(k, v);
        } catch (x) {
          lido.erro = x instanceof Error ? x.message : String(x);
        }
      }
      if (!ativo) return;
      setExtras(lido.extras);
      setErro(lido.erro);
    });
    return () => { ativo = false; };
  }, [carregar, caminhosDoEnvio, supabase]);

  const etapas = useMemo(() => etapasDoRegime(dados?.regime), [dados]);
  const etapa = etapas.includes(etapaEscolhida) ? etapaEscolhida : "final";
  // P9.2: na saúde, a parcial é a prestação anual de um exercício.
  const exercicios = useMemo(() => (dados ? exerciciosDaAnual(dados.regime, dados.estado.prestacao ?? {}) : []), [dados]);
  const enviados = useMemo(() => (envios ? exerciciosEnviados(envios) : []), [envios]);
  const exercicio = etapa === "parcial" && exercicios.length ? exercicioEscolhido ?? exercicioInicial(exercicios, enviados) : 0;

  const dadosDoPacote = useMemo<DadosDoPacote | null>(() => {
    if (!dados || !extras?.prestacao) return null;
    const contas = new Map(dados.contas.map(c => [c.id, nomeDaConta(c)]));
    return {
      regime: dados.regime,
      etapa,
      checklist: checklistDeEnvio({ ...dados, etapa, exercicio }),
      estado: dados.estado,
      prestacao: { titulo: extras.prestacao.titulo, identificador_oficial: extras.prestacao.identificador_oficial },
      arquivosDasDespesas: extras.despesas,
      arquivosDoEnvio: dados.arquivos,
      devolucoes: extras.devolucoes,
      extratos: extras.extratos.map(e => ({ ...e, conta: contas.get(e.conta_id) ?? "Conta" })),
      metadados: extras.metadados,
    };
  }, [dados, extras, etapa, exercicio]);
  const plano = useMemo(() => (dadosDoPacote ? planoDoPacote(dadosDoPacote) : null), [dadosDoPacote]);

  async function gerar(tipo: TipoDoPacote) {
    if (!plano || !dadosDoPacote || !extras?.prestacao) return;
    setErro("");
    setGerado(null);
    const geradoEm = new Date();
    try {
      // Cada arquivo guardado baixa uma vez, mesmo que vá para mais de uma linha.
      const caminhos = [...new Set(plano.itens.map(i => i.storagePath))].filter(c => extras.metadados.has(c));
      const baixados = new Map<string, { bytes: Uint8Array; hash: string }>();
      for (const [n, caminho] of caminhos.entries()) {
        setProgresso({ texto: `Baixando ${n + 1} de ${caminhos.length}`, feito: n, total: caminhos.length });
        const { data, error } = await supabase.storage.from("documentos").download(caminho);
        if (error || !data) throw new Error(`Não foi possível baixar um arquivo (${plano.itens.find(i => i.storagePath === caminho)?.caminho}): ${error?.message ?? "sem conteúdo"}.`);
        const bytes = new Uint8Array(await data.arrayBuffer());
        baixados.set(caminho, { bytes, hash: await sha256(bytes) });
      }
      setProgresso({ texto: "Montando o pacote", feito: caminhos.length, total: caminhos.length });

      const linhas: LinhaDoManifesto[] = [];
      const arquivos: ArquivoDoZip[] = [];
      for (const item of plano.itens) {
        const b = baixados.get(item.storagePath);
        if (!b) continue;
        linhas.push({ arquivo: item.caminho, origem: item.origem, tamanho: b.bytes.length, sha256: b.hash, observacao: item.problemas.join(" ") });
        arquivos.push({ nome: item.caminho, dados: b.bytes, data: geradoEm });
      }

      const { conteudoDoRelatorio, relatorioEmPdf } = await import("@/lib/prestacao/relatorio-pdf");
      const proponente = extras.prestacao.proponente ? { nome: extras.prestacao.proponente.nome, documento: extras.prestacao.proponente.cnpj } : null;
      const pdf = await relatorioEmPdf(
        conteudoDoRelatorio({ tipo, dados: dadosDoPacote, plano, manifesto: linhas, geradoEm, proponente }),
        `${extras.prestacao.titulo} · ${tipo === "pacote" ? "pacote" : "pré-pacote"} gerado em ${quando(geradoEm)}`,
      );
      const relatorio: LinhaDoManifesto = { arquivo: "relatorio-da-prestacao.pdf", origem: "Relatório da prestação, gerado pelo Jards", tamanho: pdf.length, sha256: await sha256(pdf), observacao: "" };
      const todas = [relatorio, ...linhas];
      const manifesto: Manifesto = {
        tipo,
        geradoEm: geradoEm.toISOString(),
        prestacao: { titulo: extras.prestacao.titulo, identificadorOficial: extras.prestacao.identificador_oficial },
        regime: dadosDoPacote.regime ? { codigo: dadosDoPacote.regime.codigo, versao: dadosDoPacote.regime.versao, sistema: dadosDoPacote.regime.sistemaOficial } : null,
        etapa,
        exercicio: exercicio || null,
        padrao: plano.padrao,
        arquivos: todas.map(l => {
          const item = plano.itens.find(i => i.caminho === l.arquivo);
          return { ...l, vinculo: item?.vinculo ?? null, storagePath: item?.storagePath ?? null };
        }),
        faltas: plano.faltas.map(f => f.texto),
      };
      const texto = new TextEncoder();
      const zip = partesDoZip([
        { nome: "relatorio-da-prestacao.pdf", dados: pdf, data: geradoEm },
        { nome: "manifesto.csv", dados: texto.encode("\uFEFF" + manifestoCsv(todas)), data: geradoEm },
        { nome: "manifesto.json", dados: texto.encode(JSON.stringify(manifesto, null, 2)), data: geradoEm },
        ...(tipo === "pre-pacote" ? [{ nome: "o-que-falta.txt", dados: texto.encode(textoDasFaltas(plano, etapa, exercicio)), data: geradoEm }] : []),
        ...arquivos,
      ]);
      const nome = nomeDoPacote(tipo, dadosDoPacote.prestacao, etapa, geradoEm, exercicio);
      baixar(new Blob(zip as BlobPart[], { type: "application/zip" }), nome);
      setGerado(`${nome}: ${linhas.length + 1} ${linhas.length ? "arquivos" : "arquivo"}, com o manifesto${tipo === "pre-pacote" ? " e o que falta" : ""}.`);
      if (tipo === "pacote") setUltimoPacote({ etapa, exercicio, manifesto });
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não foi possível gerar o pacote.");
    }
    setProgresso(null);
  }

  const erroGeral = erro || erroDoEnvio;
  const ocupado = progresso !== null;
  const sistema = dadosDoPacote?.checklist.sistema;
  const vigente = envios ? envioVigente(envios, etapa, exercicio) : null;
  const pacoteDaEtapa = ultimoPacote?.etapa === etapa && ultimoPacote.exercicio === exercicio ? ultimoPacote.manifesto : null;

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
        <ArrowLeft size={12} aria-hidden /> Envio
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Pacote do envio</h2>
          <p className="max-w-[46rem] text-[0.6875rem] text-black/45">
            Os documentos do checklist e os comprovantes num arquivo .zip, renomeados no padrão {sistema ? `do ${sistema}` : "do sistema de destino"}, com o manifesto (tamanho e SHA-256 de cada arquivo) e o relatório da prestação em PDF. O pré-pacote sai a qualquer momento e mostra o que falta.
          </p>
        </div>
        <EtapaDoEnvio
          etapas={etapas}
          etapa={etapa}
          onEtapa={setEtapa}
          regime={dados?.regime ?? null}
          exercicios={exercicios}
          exercicio={exercicio}
          onExercicio={setExercicio}
          enviados={enviados}
        />
      </div>

      {erroGeral && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erroGeral}</p>}
      {!plano && !erroGeral && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {plano && (
        <>
          <div className="space-y-3 rounded border bg-white px-5 py-4" style={BORDA}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[0.6875rem] md:grid-cols-4">
              <div>
                <dt className={ROTULO}>Arquivos</dt>
                <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${plano.itens.length ? "text-[#0D0D0D]" : "text-black/30"}`}>{plano.itens.length} <span className="text-[0.6875rem] font-normal text-black/40">+ relatório e manifesto</span></dd>
              </div>
              <div>
                <dt className={ROTULO}>Tamanho</dt>
                <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${plano.tamanhoTotal ? "text-[#0D0D0D]" : "text-black/30"}`}>{tamanho(plano.tamanhoTotal)}</dd>
              </div>
              <div>
                <dt className={ROTULO}>
                  {plano.comProblema > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                  Fora da regra
                </dt>
                <dd className={`mt-0.5 text-[0.875rem] font-semibold tabular-nums ${plano.comProblema ? "text-[#0D0D0D]" : "text-black/30"}`}>{plano.comProblema}</dd>
              </div>
              <div>
                <dt className={ROTULO}>Nomes</dt>
                <dd className="mt-0.5 text-[0.75rem] text-black/70">{PADRAO[plano.padrao]}</dd>
              </div>
            </dl>
            {plano.regra && <p className="text-[0.6875rem] text-black/50">Regra do regime: {plano.regra.descricao} <span className="text-black/35">({[plano.regra.fonte.documento, plano.regra.fonte.dispositivo].filter(Boolean).join(", ")})</span></p>}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <button
                type="button"
                onClick={() => gerar("pacote")}
                disabled={!plano.podeGerarPacote || ocupado}
                className="flex h-9 items-center gap-1.5 rounded bg-[#0D0D0D] px-4 text-[0.75rem] font-medium text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Package size={13} aria-hidden /> Gerar pacote
              </button>
              <button type="button" onClick={() => gerar("pre-pacote")} disabled={ocupado} className={BOTAO} style={BORDA}>
                <FileArchive size={12} aria-hidden /> Gerar pré-pacote
              </button>
              {progresso && (
                <span role="status" className="flex items-center gap-2 text-[0.6875rem] text-black/55">
                  <span className="h-1.5 w-[6rem] overflow-hidden rounded-full bg-black/[.06]">
                    <span className="block h-full bg-[#684DB0] transition-[width] motion-reduce:transition-none" style={{ width: `${progresso.total ? Math.round((progresso.feito / progresso.total) * 100) : 100}%` }} />
                  </span>
                  {progresso.texto}…
                </span>
              )}
              {!progresso && plano.motivo && (
                <p className="flex items-start gap-1 text-[0.6875rem] text-black/55">
                  <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />
                  <span>Pacote ainda não: {plano.motivo} O pré-pacote sai agora, com o que falta.</span>
                </p>
              )}
              {!progresso && gerado && (
                <p role="status" className="flex items-center gap-1 text-[0.6875rem] text-black/55">
                  <CheckCircle2 size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-black/40" />
                  Gerado: {gerado}
                </p>
              )}
            </div>
          </div>

          {(vigente || pacoteDaEtapa) && (
            <RegistrarEnvio
              prestacaoId={id}
              etapa={etapa}
              exercicio={exercicio}
              sistema={sistema ?? null}
              manifesto={pacoteDaEtapa}
              podeRegistrar={permissoes.decidir}
              vigente={vigente}
              onRegistrado={() => { recarregarEnvios(); recarregarEnvio(); }}
            />
          )}

          {plano.faltas.length > 0 && (
            <section className="rounded border bg-white px-5 py-4" style={BORDA} aria-labelledby="faltas">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="faltas" className="text-[0.75rem] font-semibold text-black">O que falta</h3>
                <Link href={`/prestacoes/${id}/envio`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Resolver no checklist <ArrowRight size={11} aria-hidden />
                </Link>
              </div>
              <ul className="mt-2 space-y-1 text-[0.6875rem]">
                {plano.faltas.map(f => (
                  <li key={f.texto} className="flex items-start gap-1 text-black/60">
                    {f.obrigatorio && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-[#B07A14]" />}
                    <span>{f.obrigatorio && <span className="font-medium text-black/75">Obrigatório · </span>}{f.texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plano.itens.length === 0 ? (
            <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
              <Package size={22} className="mx-auto text-black/20" aria-hidden />
              <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">Nenhum arquivo ainda. Anexe os documentos no checklist e os comprovantes das despesas; o pré-pacote já sai com o relatório e o que falta.</p>
            </div>
          ) : (
            <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-label="Arquivos do pacote">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed text-[0.75rem]">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <th className={`${CABECALHO} w-[34%]`}>No pacote</th>
                      <th className={`${CABECALHO} w-[46%]`}>Origem</th>
                      <th className={`${CABECALHO} w-[10%] text-right`}>Tamanho</th>
                      <th className={`${CABECALHO} w-[10%]`}><span className="sr-only">Situação</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plano.itens.map(i => (
                      <tr key={i.caminho} className="border-b align-top last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="break-all px-4 py-2.5 tabular-nums text-black/80">{i.caminho}</td>
                        <td className="px-4 py-2.5 text-black/60">
                          {i.origem}
                          {i.problemas.length > 0 && <p className="mt-0.5 flex items-start gap-1 text-[0.6875rem] text-black/55"><AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden />{i.problemas.join(" ")}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-black/60">{tamanho(i.tamanho)}</td>
                        <td className="px-4 py-2.5 text-[0.6875rem]">{i.problemas.length ? <span className="inline-flex items-center gap-1 text-black/60"><AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />Revisar</span> : <span className="text-black/35">Ok</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-black/[.05] md:hidden">
                {plano.itens.map(i => (
                  <li key={i.caminho} className="space-y-1 px-5 py-3 text-[0.75rem]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 break-all tabular-nums text-black/80">{i.caminho}</p>
                      <span className="shrink-0 tabular-nums text-black/50">{tamanho(i.tamanho)}</span>
                    </div>
                    <p className="text-[0.6875rem] text-black/55">{i.origem}</p>
                    {i.problemas.length > 0 && <p className="flex items-start gap-1 text-[0.6875rem] text-black/55"><AlertTriangle size={12} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B07A14]" aria-hidden />{i.problemas.join(" ")}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
