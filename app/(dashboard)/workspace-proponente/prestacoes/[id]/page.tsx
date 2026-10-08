"use client";

// A prestação de contas vista pelo proponente (P5.4): a situação e o prazo,
// as despesas e evidências com o que a equipe já conferiu, o envio de novos
// documentos e o restante da prestação só para ler. O banco só deixa o
// proponente enviar pelas funções dele; o resto é leitura.

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { DetailNotFound, DetailPageSkeleton } from "@/components/ui/DetailPagePrimitives";
import { EnviarDespesaModal } from "@/components/prestacao/proponente/EnviarDespesaModal";
import { EnviarEvidenciaModal } from "@/components/prestacao/proponente/EnviarEvidenciaModal";
import { AcompanharPrestacao } from "@/components/prestacao/proponente/AcompanharPrestacao";
import {
  podeRetirar,
  resumoDasDespesas,
  rotuloDoDocumento,
  situacaoDaDespesa,
  situacaoDaPrestacao,
  textoDoPrazo,
  type PrestacaoDoProponente,
} from "@/lib/prestacao/proponente";
import { rotuloDoTipo as rotuloDaEvidencia } from "@/lib/prestacao/evidencias";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

type Despesa = {
  id: string; tipo: string; nome_arquivo: string; storage_path: string; valor_extraido: number | null; data_doc: string | null;
  status: string; observacao: string | null; descricao_servico: string | null; numero_documento: string | null;
  canal: string | null; enviado_por: string | null; created_at: string;
};
type Evidencia = {
  id: string; tipo: string; descricao: string | null; nome_arquivo: string | null; storage_path: string | null; url: string | null;
  capturada_em: string | null; canal: string | null; criado_por: string | null; created_at: string;
};
type Atividade = { id: string; titulo: string; data_realizacao: string | null };

const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const reais = (v: number | string | null | undefined) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const LINK = "inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]";

export default function PrestacaoDoProponentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [contexto, setContexto] = useState<PrestacaoDoProponente | null | undefined>(undefined);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [modal, setModal] = useState<"despesa" | "evidencia" | null>(null);
  const [erro, setErro] = useState("");

  const buscar = useCallback(async () => {
    const [ctx, d, e, a, u] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções e colunas novas, ainda fora do tipo Database
      (supabase as any).rpc("fn_proponente_prestacao", { p_prestacao_id: id }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções e colunas novas, ainda fora do tipo Database
      (supabase as any).from("prestacao_comprovantes")
        .select("id, tipo, nome_arquivo, storage_path, valor_extraido, data_doc, status, observacao, descricao_servico, numero_documento, canal, enviado_por, created_at")
        .eq("prestacao_id", id).order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções e colunas novas, ainda fora do tipo Database
      (supabase as any).from("prestacao_evidencias")
        .select("id, tipo, descricao, nome_arquivo, storage_path, url, capturada_em, canal, criado_por, created_at")
        .eq("prestacao_id", id).order("created_at", { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- funções e colunas novas, ainda fora do tipo Database
      (supabase as any).from("prestacao_atividades").select("id, titulo, data_realizacao").eq("prestacao_id", id).order("data_realizacao"),
      supabase.auth.getUser(),
    ]);
    return {
      contexto: (ctx.data ?? null) as PrestacaoDoProponente | null,
      despesas: (d.data ?? []) as Despesa[],
      evidencias: (e.data ?? []) as Evidencia[],
      atividades: (a.data ?? []) as Atividade[],
      usuarioId: u.data.user?.id ?? null,
      erro: ctx.error || d.error || e.error ? "Não foi possível carregar tudo. Atualize a página." : "",
    };
  }, [id, supabase]);

  const aplicar = useCallback((r: Awaited<ReturnType<typeof buscar>>) => {
    setContexto(r.contexto);
    setDespesas(r.despesas);
    setEvidencias(r.evidencias);
    setAtividades(r.atividades);
    setUsuarioId(r.usuarioId);
    setErro(r.erro);
  }, []);

  useEffect(() => {
    let ativo = true;
    buscar().then(r => { if (ativo) aplicar(r); });
    return () => { ativo = false; };
  }, [buscar, aplicar]);

  const recarregar = useCallback(async () => aplicar(await buscar()), [aplicar, buscar]);

  async function abrirArquivo(path: string) {
    setErro("");
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  function retirar(tipo: "despesa" | "evidencia", itemId: string, nome: string) {
    confirmDelete({
      title: tipo === "despesa" ? "Retirar a despesa?" : "Retirar a evidência?",
      description: `"${nome}" sai da prestação e o arquivo é apagado.`,
      confirmLabel: "Retirar",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
        const { data, error } = await (supabase as any).rpc("fn_proponente_retirar", { p_tipo: tipo, p_id: itemId });
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível retirar"));
        if (data) await supabase.storage.from("documentos").remove([data as string]);
        await recarregar();
      },
    });
  }

  if (contexto === undefined) return <DetailPageSkeleton sidebar={false} />;
  if (!contexto) {
    return <DetailNotFound title="Prestação não encontrada" description="Ela não está ligada ao seu cadastro de proponente, ou a organização está sem o módulo de prestação de contas." backHref="/workspace-proponente" backLabel="Meus projetos" />;
  }

  const hoje = hojeIso();
  const situacao = situacaoDaPrestacao(contexto.status);
  const prazo = textoDoPrazo(contexto.prazo, hoje);
  const resumo = resumoDasDespesas(despesas);

  return (
    <div className="min-h-full">
      <div className="border-b" style={BORDA}>
        <div className="mx-auto max-w-pagina px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <Link href="/workspace-proponente" className="inline-flex items-center gap-1 rounded text-[0.75rem] text-black/50 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <ArrowLeft size={13} aria-hidden /> Meus projetos
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/40">{contexto.organizacao?.nome} · Prestação de contas</p>
              <h1 className="mt-1 text-balance text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] text-[#0D0D0D] sm:text-[1.75rem]">{contexto.titulo}</h1>
              <p className="mt-1 text-[0.75rem] text-black/50">
                {[contexto.regime, contexto.identificador_oficial, contexto.proponente,
                  contexto.data_inicio_execucao ? `Execução ${dataBr(contexto.data_inicio_execucao)}${contexto.data_fim_execucao ? ` a ${dataBr(contexto.data_fim_execucao)}` : ""}` : ""]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 rounded border bg-white px-2 py-1 text-[0.6875rem] font-medium" style={{ borderColor: situacao.cor + "47", color: situacao.cor }}>{situacao.rotulo}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem]">
            {prazo && <span className={prazo.atrasado ? "text-[#B23B3B]" : "text-black/60"}>{prazo.texto}</span>}
            {contexto.responsavel && <span className="text-black/50">Quem cuida: {contexto.responsavel}</span>}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-pagina space-y-8 px-4 py-6 sm:px-6 lg:px-10">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

        <section aria-labelledby="despesas-titulo" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="despesas-titulo" className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Despesas</h2>
              <p className="mt-0.5 text-[0.75rem] text-black/50">
                {resumo.total === 0 ? "Envie as notas e recibos do projeto; a equipe confere cada um."
                  : `${resumo.aceitas} ${resumo.aceitas === 1 ? "aceita" : "aceitas"} (${reais(resumo.valorAceito)}) · ${resumo.emAnalise} em análise (${reais(resumo.valorEmAnalise)})${resumo.recusadas ? ` · ${resumo.recusadas} ${resumo.recusadas === 1 ? "recusada" : "recusadas"}` : ""}`}
              </p>
            </div>
            <button type="button" onClick={() => setModal("despesa")}
              className="flex items-center gap-1.5 rounded bg-[#0D0D0D] px-4 py-2.5 text-[0.8125rem] font-semibold text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D0D0D] active:scale-[.98]">
              <Upload size={14} aria-hidden /> Enviar despesa
            </button>
          </div>
          {despesas.length > 0 && (
            <ul className="divide-y divide-black/[.05] rounded-lg border bg-white" style={BORDA} aria-label="Despesas da prestação">
              {despesas.map(d => {
                const s = situacaoDaDespesa(d.status);
                const minha = d.canal === "proponente" && d.enviado_por === usuarioId;
                return (
                  <li key={d.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[0.8125rem] font-medium text-black/85">{d.descricao_servico?.trim() || d.nome_arquivo}</p>
                      <p className="mt-0.5 text-[0.6875rem] text-black/50">
                        {[rotuloDoDocumento(d.tipo), d.numero_documento ? `nº ${d.numero_documento}` : "", dataBr(d.data_doc), minha ? "Enviada por você" : d.canal === "proponente" ? "Enviada pelo proponente" : "Lançada pela equipe"]
                          .filter(Boolean).join(" · ")}
                      </p>
                      {d.status === "rejeitado" && d.observacao && <p className="mt-1 text-[0.6875rem] text-[#B23B3B]">Motivo: {d.observacao}</p>}
                      <div className="mt-1 flex flex-wrap gap-3">
                        <button type="button" onClick={() => abrirArquivo(d.storage_path)} className={LINK}><FileText size={11} aria-hidden /> {d.nome_arquivo}</button>
                        {podeRetirar(d, usuarioId) && (
                          <button type="button" onClick={() => retirar("despesa", d.id, d.descricao_servico?.trim() || d.nome_arquivo)} className={`${LINK} hover:text-[#B23B3B]`}>Retirar</button>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                      {d.valor_extraido !== null && <p className="text-[0.8125rem] tabular-nums text-black/75">{reais(d.valor_extraido)}</p>}
                      <span className="rounded border bg-white px-2 py-0.5 text-[0.625rem] font-medium" style={{ borderColor: s.cor + "47", color: s.cor }} title={s.explicacao}>{s.rotulo}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="evidencias-titulo" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="evidencias-titulo" className="text-[0.9375rem] font-semibold text-[#0D0D0D]">Evidências</h2>
              <p className="mt-0.5 text-[0.75rem] text-black/50">Fotos, vídeos, listas de presença e matérias que mostram o projeto acontecendo.</p>
            </div>
            <button type="button" onClick={() => setModal("evidencia")}
              className="flex items-center gap-1.5 rounded border bg-white px-4 py-2.5 text-[0.8125rem] text-black/75 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
              style={{ borderColor: "rgba(13,13,13,.14)" }}>
              <Plus size={14} aria-hidden /> Enviar evidência
            </button>
          </div>
          {evidencias.length === 0 ? (
            <p className="rounded-lg border bg-white px-4 py-3 text-[0.75rem] text-black/45" style={BORDA}>Nenhuma evidência ainda.</p>
          ) : (
            <ul className="divide-y divide-black/[.05] rounded-lg border bg-white" style={BORDA} aria-label="Evidências da prestação">
              {evidencias.map(e => {
                const minha = e.canal === "proponente" && e.criado_por === usuarioId;
                const nome = e.descricao?.trim() || e.nome_arquivo || rotuloDaEvidencia(e.tipo);
                return (
                  <li key={e.id} className="px-4 py-3">
                    <p className="text-[0.8125rem] font-medium text-black/85">{nome}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-black/50">
                      {[rotuloDaEvidencia(e.tipo), e.capturada_em ? `Captada em ${dataBr(e.capturada_em)}` : "", minha ? "Enviada por você" : e.canal === "proponente" ? "Enviada pelo proponente" : "Lançada pela equipe"]
                        .filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {e.storage_path && <button type="button" onClick={() => abrirArquivo(e.storage_path!)} className={LINK}><FileText size={11} aria-hidden /> {e.nome_arquivo ?? "Arquivo"}</button>}
                      {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className={LINK}>Abrir link <ExternalLink size={11} aria-hidden /></a>}
                      {minha && <button type="button" onClick={() => retirar("evidencia", e.id, nome)} className={`${LINK} hover:text-[#B23B3B]`}>Retirar</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <AcompanharPrestacao prestacaoId={id} onAbrirArquivo={abrirArquivo} />
      </main>

      {modal === "despesa" && (
        <EnviarDespesaModal prestacaoId={id} organizationId={contexto.organization_id} onClose={() => setModal(null)} onEnviada={() => void recarregar()} />
      )}
      {modal === "evidencia" && (
        <EnviarEvidenciaModal prestacaoId={id} organizationId={contexto.organization_id} atividades={atividades} onClose={() => setModal(null)} onEnviada={() => void recarregar()} />
      )}
    </div>
  );
}
