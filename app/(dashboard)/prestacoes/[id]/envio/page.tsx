"use client";

// Aba Envio (P4.1): o checklist do regime para a etapa (final ou parcial), com
// os documentos e as condições do sistema oficial. O que os dados respondem
// leva à aba onde se resolve; o resto a pessoa resolve aqui, com o arquivo,
// "pronto" ou, para o que não é obrigatório, "não se aplica" com o motivo. No
// topo, os envios registrados (P4.6), com o retrato e a reabertura.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Circle, FileSpreadsheet, FileText, MinusCircle, Package, Paperclip, Receipt, RefreshCw, Send, Stamp, Trash2, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { useEnviosRegistrados } from "@/hooks/useEnviosRegistrados";
import { EnviosRegistrados } from "@/components/prestacao/envio/EnviosRegistrados";
import { EtapaDoEnvio } from "@/components/prestacao/envio/EtapaDoEnvio";
import { exercicioInicial, exerciciosDaAnual, rotuloDaEtapa } from "@/lib/prestacao/exercicios";
import { exerciciosEnviados } from "@/lib/prestacao/envios";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import {
  checklistDeEnvio,
  erroDaMarcacao,
  type ArquivoDoChecklist,
  type DestinoDoEnvio,
  type EtapaEnvio,
  type LinhaDoChecklist,
} from "@/lib/prestacao/envio";
import { regimePedeCarimbo } from "@/lib/prestacao/carimbo";
import { definida } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { verificarAgora } from "@/lib/prestacao/verificar-cliente";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
/** Limite do arquivo anexado; o do regime (na Rouanet, 5 MB) aparece nas condições. */
const LIMITE_MB = 50;

const ABAS: Record<DestinoDoEnvio, { rotulo: string; caminho: string }> = {
  visao_geral: { rotulo: "Visão geral", caminho: "" },
  orcamento: { rotulo: "Orçamento", caminho: "/orcamento" },
  comprovantes: { rotulo: "Comprovantes", caminho: "/comprovantes" },
  extrato: { rotulo: "Extrato", caminho: "/extrato" },
  conciliacao: { rotulo: "Conciliação", caminho: "/conciliacao" },
  objeto: { rotulo: "Objeto", caminho: "/objeto" },
  atividades: { rotulo: "Atividades", caminho: "/atividades" },
  distribuicao: { rotulo: "Distribuição", caminho: "/distribuicao" },
  bens: { rotulo: "Bens", caminho: "/bens" },
  divulgacao: { rotulo: "Divulgação", caminho: "/divulgacao" },
  beneficiarios: { rotulo: "Beneficiários", caminho: "/beneficiarios" },
  carimbos: { rotulo: "Carimbo e atesto", caminho: "/envio/carimbos" },
  pendencias: { rotulo: "Pendências", caminho: "/pendencias" },
  devolucoes: { rotulo: "Devoluções", caminho: "/envio/devolucoes" },
  pos_envio: { rotulo: "Após o envio", caminho: "/pos-envio" },
};

const tamanho = (bytes: number | null) =>
  bytes === null ? "" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";

function IconeDaSituacao({ linha }: { linha: LinhaDoChecklist }) {
  if (linha.situacao === "pronto") return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-black/40" aria-label="Pronto" />;
  if (linha.situacao === "nao_se_aplica") return <MinusCircle size={15} className="mt-0.5 shrink-0 text-black/35" aria-label="Não se aplica" />;
  return linha.obrigatorio
    ? <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#B07A14]" aria-label="Pendente, obrigatório" />
    : <Circle size={15} className="mt-0.5 shrink-0 text-black/30" aria-label="Pendente" />;
}

type Acoes = {
  podeEditar: boolean;
  ocupado: boolean;
  prestacaoId: string;
  onMarcar: (linha: LinhaDoChecklist, situacao: "pronto" | "nao_se_aplica", justificativa?: string) => Promise<string | null>;
  onDesmarcar: (linha: LinhaDoChecklist) => void;
  onAnexar: (linha: LinhaDoChecklist, arquivos: File[]) => void;
  onAbrir: (arquivo: ArquivoDoChecklist) => void;
  onRemover: (arquivo: ArquivoDoChecklist) => void;
};

function ItemDoChecklist({ linha, acoes }: { linha: LinhaDoChecklist; acoes: Acoes }) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const entrada = useRef<HTMLInputElement>(null);
  const daPessoa = linha.origem === "pessoa";
  const pendente = linha.situacao === "pendente";
  const fonte = [linha.fonte.documento, linha.fonte.dispositivo].filter(Boolean).join(", ");

  async function salvarMotivo() {
    const problema = erroDaMarcacao(linha, "nao_se_aplica", motivo);
    if (problema) { setErro(problema); return; }
    const falha = await acoes.onMarcar(linha, "nao_se_aplica", motivo!.trim());
    if (falha) setErro(falha);
    else { setMotivo(null); setErro(""); }
  }

  return (
    <li className="flex gap-3 px-5 py-3.5">
      <IconeDaSituacao linha={linha} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-[0.75rem] text-black/85">{linha.descricao}</p>
            <p className="mt-0.5 text-[0.625rem] text-black/40">
              {linha.tipo === "documento" ? (linha.obrigatorio ? "Obrigatório" : "Quando houver") : linha.obrigatorio ? "Bloqueia o envio" : "Alerta"}
              {fonte ? ` · ${fonte}` : ""}
              {linha.origem === "dados" ? " · conferido pelos dados" : ""}
            </p>
            <p className={`mt-1 text-[0.6875rem] ${pendente ? "text-black/60" : "text-black/50"}`}>{linha.detalhe}</p>
            {linha.marcacao && linha.situacao !== "pendente" && (
              <p className="mt-0.5 text-[0.625rem] text-black/35">Marcado em {quando(linha.marcacao.updated_at)}</p>
            )}
            {pendente && linha.destino && (
              <Link
                href={`/prestacoes/${acoes.prestacaoId}${ABAS[linha.destino].caminho}`}
                className="mt-1 inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              >
                Resolver em {ABAS[linha.destino].rotulo} <ArrowRight size={11} aria-hidden />
              </Link>
            )}
          </div>

          {acoes.podeEditar && daPessoa && (
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {linha.aceitaArquivo && linha.situacao !== "nao_se_aplica" && (
                <>
                  <button type="button" disabled={acoes.ocupado} onClick={() => entrada.current?.click()} className={BOTAO} style={BORDA}>
                    <Paperclip size={12} aria-hidden /> {linha.arquivos.length ? "Anexar outro" : "Anexar"}
                  </button>
                  <input
                    ref={entrada}
                    type="file"
                    multiple
                    aria-label={`Arquivo de ${linha.descricao}`}
                    className="sr-only"
                    onChange={e => { const arquivos = [...(e.target.files ?? [])]; e.target.value = ""; if (arquivos.length) acoes.onAnexar(linha, arquivos); }}
                  />
                </>
              )}
              {pendente && (
                <button type="button" disabled={acoes.ocupado} onClick={() => acoes.onMarcar(linha, "pronto")} className={BOTAO} style={BORDA}>
                  <CheckCircle2 size={12} aria-hidden /> {linha.tipo === "condicao" ? "Marcar como conferido" : "Marcar como pronto"}
                </button>
              )}
              {pendente && linha.dispensavel && motivo === null && (
                <button type="button" disabled={acoes.ocupado} onClick={() => setMotivo("")} className={BOTAO} style={BORDA}>
                  <MinusCircle size={12} aria-hidden /> Não se aplica
                </button>
              )}
              {linha.marcacao && linha.situacao !== "pendente" && (
                <button type="button" disabled={acoes.ocupado} onClick={() => acoes.onDesmarcar(linha)} className={BOTAO} style={BORDA}>
                  <Undo2 size={12} aria-hidden /> Desfazer
                </button>
              )}
            </div>
          )}
        </div>

        {linha.arquivos.length > 0 && (
          <ul className="mt-2 space-y-1">
            {linha.arquivos.map(a => (
              <li key={a.id} className="flex items-center gap-1.5 text-[0.6875rem]">
                <FileText size={12} className="shrink-0 text-black/35" aria-hidden />
                <button
                  type="button"
                  onClick={() => acoes.onAbrir(a)}
                  className="min-w-0 truncate rounded text-left text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                >
                  {a.nome_arquivo}
                </button>
                {a.tamanho_bytes !== null && <span className="shrink-0 tabular-nums text-black/35">{tamanho(a.tamanho_bytes)}</span>}
                {acoes.podeEditar && (
                  <button
                    type="button"
                    disabled={acoes.ocupado}
                    onClick={() => acoes.onRemover(a)}
                    aria-label={`Remover ${a.nome_arquivo}`}
                    className="ml-auto shrink-0 rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {motivo !== null && (
          <div className="mt-2 space-y-2">
            <label className="block text-[0.625rem] text-black/45" htmlFor={`motivo-${linha.tipo}-${linha.codigo}`}>Por que não se aplica</label>
            <textarea
              id={`motivo-${linha.tipo}-${linha.codigo}`}
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              maxLength={1000}
              autoFocus
              className="w-full resize-none rounded border px-3 py-2 text-[0.75rem] focus:outline-none focus-visible:border-[#7259B5]"
              style={{ borderColor: "rgba(13,13,13,.14)" }}
            />
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setMotivo(null); setErro(""); }} className="h-9 rounded px-3 text-[0.6875rem] text-black/55 transition hover:text-black/80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                Cancelar
              </button>
              <button
                type="button"
                disabled={acoes.ocupado}
                onClick={salvarMotivo}
                className="h-9 rounded bg-[#2E8932] px-4 text-[0.6875rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] disabled:opacity-60 active:scale-[.98]"
              >
                Salvar
              </button>
            </div>
          </div>
        )}
        {erro && <p role="alert" className="mt-1 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      </div>
    </li>
  );
}

function Secao({ id, titulo, linhas, acoes }: { id: string; titulo: string; linhas: LinhaDoChecklist[]; acoes: Acoes }) {
  if (linhas.length === 0) return null;
  const prontos = linhas.filter(l => l.situacao !== "pendente").length;
  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby={id}>
      <div className="flex items-baseline justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <h3 id={id} className="text-[0.75rem] font-semibold text-[#282525]">{titulo}</h3>
        <span className="text-[0.6875rem] tabular-nums text-black/40">{prontos} de {linhas.length}</span>
      </div>
      <ul className="divide-y divide-black/[.05]">
        {linhas.map(l => <ItemDoChecklist key={`${l.tipo}:${l.codigo}`} linha={l} acoes={acoes} />)}
      </ul>
    </section>
  );
}

export default function EnvioPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const organizationId = usePrestacaoOrganizacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const { dados, erro: erroAoCarregar, recarregar } = useDadosDoEnvio(id);
  const { envios, recarregar: recarregarEnvios } = useEnviosRegistrados(id);
  const [etapaEscolhida, setEtapa] = useState<EtapaEnvio>("final");
  // P9.2: na saúde, a parcial é a prestação anual de um exercício.
  const [exercicioEscolhido, setExercicio] = useState<number | null>(null);
  const exercicios = useMemo(() => (dados ? exerciciosDaAnual(dados.regime, dados.estado.prestacao ?? {}) : []), [dados]);
  const enviados = useMemo(() => (envios ? exerciciosEnviados(envios) : []), [envios]);
  const exercicio = etapaEscolhida === "parcial" && exercicios.length ? exercicioEscolhido ?? exercicioInicial(exercicios, enviados) : 0;
  const [ocupado, setOcupado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState("");

  const checklist = useMemo(() => {
    if (!dados) return null;
    const final = checklistDeEnvio({ ...dados, etapa: "final" });
    return etapaEscolhida === "final" || !final.etapas.includes(etapaEscolhida) ? final : checklistDeEnvio({ ...dados, etapa: etapaEscolhida, exercicio });
  }, [dados, etapaEscolhida, exercicio]);

  async function marcar(linha: LinhaDoChecklist, situacao: "pronto" | "nao_se_aplica", justificativa?: string): Promise<string | null> {
    if (!checklist) return null;
    setOcupado(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envio_checklist ainda não está no tipo Database
    const { error } = await (supabase as any).from("prestacao_envio_checklist").upsert({
      prestacao_id: id, etapa: checklist.etapa, exercicio: checklist.exercicio, tipo: linha.tipo, codigo: linha.codigo, situacao,
      justificativa: situacao === "nao_se_aplica" ? justificativa ?? null : null,
    }, { onConflict: "prestacao_id,etapa,exercicio,tipo,codigo" });
    if (!error) await recarregar();
    setOcupado(false);
    if (!error) return null;
    const mensagem = mensagemErroPrestacao(error, "Não foi possível marcar o item");
    if (situacao === "pronto") setErro(mensagem);
    return mensagem;
  }

  async function desmarcar(linha: LinhaDoChecklist) {
    if (!checklist) return;
    setOcupado(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envio_checklist ainda não está no tipo Database
    const { error } = await (supabase as any).from("prestacao_envio_checklist").delete()
      .eq("prestacao_id", id).eq("etapa", checklist.etapa).eq("exercicio", checklist.exercicio).eq("tipo", linha.tipo).eq("codigo", linha.codigo);
    if (error) setErro(mensagemErroPrestacao(error, "Não foi possível desfazer a marcação"));
    else await recarregar();
    setOcupado(false);
  }

  async function anexar(linha: LinhaDoChecklist, arquivos: File[]) {
    if (!checklist) return;
    if (!organizationId) { setErro("Aguarde: a prestação ainda está carregando."); return; }
    const grande = arquivos.find(f => f.size > LIMITE_MB * 1024 * 1024);
    if (grande) { setErro(`"${grande.name}" passa de ${LIMITE_MB} MB.`); return; }
    setOcupado(true);
    setErro("");
    for (const arquivo of arquivos) {
      const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId: id, pasta: { tipo: "envio" }, nomeOriginal: arquivo.name });
      const envio = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (envio.error) { setErro(`Não foi possível enviar "${arquivo.name}": ${envio.error.message}`); break; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envio_arquivos ainda não está no tipo Database
      const { error } = await (supabase as any).from("prestacao_envio_arquivos").insert({
        prestacao_id: id, etapa: checklist.etapa, exercicio: checklist.exercicio, codigo: linha.codigo, storage_path: caminho,
        nome_arquivo: arquivo.name, mime_type: arquivo.type || null, tamanho_bytes: arquivo.size,
      });
      if (error) {
        await supabase.storage.from("documentos").remove([caminho]);
        setErro(mensagemErroPrestacao(error, `Não foi possível anexar "${arquivo.name}"`));
        break;
      }
    }
    await recarregar();
    setOcupado(false);
  }

  async function abrir(arquivo: ArquivoDoChecklist) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(arquivo.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  function remover(arquivo: ArquivoDoChecklist) {
    confirmDelete({
      title: "Remover arquivo?",
      description: `"${arquivo.nome_arquivo}" sai do checklist de envio.`,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envio_arquivos ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_envio_arquivos").delete().eq("id", arquivo.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível remover o arquivo"));
        await supabase.storage.from("documentos").remove([arquivo.storage_path]);
        await recarregar();
      },
    });
  }

  async function verificar() {
    setVerificando(true);
    setErro("");
    try {
      await verificarAgora(id);
    } catch (e) {
      setErro(mensagemErroPrestacao({ message: e instanceof Error ? e.message : String(e) }, "Não foi possível verificar agora"));
    }
    setVerificando(false);
  }

  const acoes: Acoes = { podeEditar: permissoes.editar, ocupado, prestacaoId: id, onMarcar: marcar, onDesmarcar: desmarcar, onAnexar: anexar, onAbrir: abrir, onRemover: remover };
  const resumo = checklist?.resumo;

  return (
    <div className="mx-auto max-w-pagina space-y-4 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Envio</h2>
        </div>
        {checklist && (
          <EtapaDoEnvio
            etapas={checklist.etapas}
            etapa={checklist.etapa}
            onEtapa={setEtapa}
            regime={dados?.regime ?? null}
            exercicios={exercicios}
            exercicio={exercicio}
            onExercicio={setExercicio}
            enviados={enviados}
          />
        )}
        {dados?.regime && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/prestacoes/${id}/envio/pacote`} className={BOTAO} style={BORDA}>
              <Package size={12} aria-hidden /> Pacote
            </Link>
            <Link href={`/prestacoes/${id}/envio/objeto`} className={BOTAO} style={BORDA}>
              <FileText size={12} aria-hidden /> Relatório do objeto
            </Link>
            {dados.regime.sistemaOficial === "Salic" && (
              <Link href={`/prestacoes/${id}/envio/salic`} className={BOTAO} style={BORDA}>
                <FileSpreadsheet size={12} aria-hidden /> Espelho do Salic
              </Link>
            )}
            {dados.regime.sistemaOficial?.includes("STR") && (
              <Link href={`/prestacoes/${id}/envio/str`} className={BOTAO} style={BORDA}>
                <FileSpreadsheet size={12} aria-hidden /> Planilhas do STR
              </Link>
            )}
            {definida(dados.regime.envio)?.modelos.some(m => m.codigo === "formulario_pcp_pcf") && (
              <Link href={`/prestacoes/${id}/envio/formulario-lie${checklist?.etapa === "parcial" ? "?etapa=parcial" : ""}`} className={BOTAO} style={BORDA}>
                <FileSpreadsheet size={12} aria-hidden /> Formulário PCP/PCF
              </Link>
            )}
            {dados.regime.area === "saude" && (
              <Link href={`/prestacoes/${id}/envio/saude`} className={BOTAO} style={BORDA}>
                <FileSpreadsheet size={12} aria-hidden /> Planilhas da saúde
              </Link>
            )}
            {regimePedeCarimbo(dados.regime) && (
              <Link href={`/prestacoes/${id}/envio/carimbos`} className={BOTAO} style={BORDA}>
                <Stamp size={12} aria-hidden /> Carimbo e atesto
              </Link>
            )}
            <Link href={`/prestacoes/${id}/envio/devolucoes`} className={BOTAO} style={BORDA}>
              <Receipt size={12} aria-hidden /> Devoluções
            </Link>
          </div>
        )}
      </div>

      {(erro || erroAoCarregar) && (
        <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro || erroAoCarregar}</p>
      )}

      {envios && envios.length > 0 && (
        <EnviosRegistrados
          envios={envios}
          podeReabrir={permissoes.decidir}
          identificador={dados?.identificador ?? id}
          onMudou={() => { recarregarEnvios(); recarregar(); }}
        />
      )}

      {!checklist && !erroAoCarregar && (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>
      )}

      {checklist?.semChecklist && (
        <div className="rounded border bg-white px-5 py-10 text-center" style={BORDA}>
          <Send size={22} className="mx-auto text-black/20" aria-hidden />
          <p className="mx-auto mt-2 max-w-[30rem] text-[0.75rem] text-black/55">{checklist.semChecklist}</p>
          <Link href={`/prestacoes/${id}#dados-oficiais`} className="mt-2 inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            Ir para a visão geral <ArrowRight size={11} aria-hidden />
          </Link>
        </div>
      )}

      {checklist && !checklist.semChecklist && resumo && (
        <>
          <div className="space-y-3 rounded border bg-white px-5 py-4" style={BORDA}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[0.8125rem] text-black/80">
                {resumo.pendentes === 0
                  ? <>Tudo pronto para a {rotuloDaEtapa(checklist.etapa, dados?.regime, checklist.exercicio).toLowerCase()}.</>
                  : <><span className="tabular-nums">{resumo.resolvidos} de {resumo.total}</span> itens prontos{resumo.obrigatoriosPendentes ? (
                      <>
                        {" · "}
                        <span className="inline-flex items-center gap-1">
                          <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#B07A14]" />
                          {resumo.obrigatoriosPendentes} {resumo.obrigatoriosPendentes === 1 ? "obrigatório falta" : "obrigatórios faltam"}
                        </span>
                      </>
                    ) : null}</>}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[0.625rem] text-black/40">
                  {dados?.verificadaEm ? `Verificações de ${quando(dados.verificadaEm)}` : "Prestação ainda não verificada"}
                </span>
                <button type="button" onClick={verificar} disabled={verificando} className={BOTAO} style={BORDA}>
                  <RefreshCw size={12} className={verificando ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden /> {verificando ? "Verificando…" : "Verificar agora"}
                </button>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[.07]" role="progressbar" aria-valuemin={0} aria-valuemax={resumo.total} aria-valuenow={resumo.resolvidos} aria-label="Itens prontos">
              <div
                className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
                style={{ width: `${resumo.total ? (resumo.resolvidos / resumo.total) * 100 : 0}%`, background: resumo.pendentes ? "#B07A14" : "#2E8932" }}
              />
            </div>
            {checklist.descricao && (
              <p className="text-[0.6875rem] text-black/50">
                {checklist.descricao}
                {checklist.fonte && <span className="text-black/35"> ({checklist.fonte.documento}, {checklist.fonte.dispositivo})</span>}
              </p>
            )}
          </div>

          <Secao id="envio-documentos" titulo="Documentos" linhas={checklist.documentos} acoes={acoes} />
          <Secao id="envio-condicoes" titulo={`Condições do ${checklist.sistema ?? "sistema oficial"}`} linhas={checklist.condicoes} acoes={acoes} />

          {checklist.orientacoes.length > 0 && (
            <section className="rounded border bg-white px-5 py-4" style={BORDA} aria-labelledby="envio-orientacoes">
              <h3 id="envio-orientacoes" className="text-[0.75rem] font-semibold text-[#282525]">Bom saber</h3>
              <ul className="mt-2 space-y-1.5">
                {checklist.orientacoes.map(o => (
                  <li key={o.codigo} className="text-[0.6875rem] text-black/60">
                    {o.descricao} <span className="text-black/35">({o.fonte.documento}, {o.fonte.dispositivo})</span>
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
