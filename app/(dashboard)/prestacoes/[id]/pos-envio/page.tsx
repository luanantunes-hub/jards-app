"use client";

// Após o envio (P4.7): diligências, decisões, glosas e recursos. O banco
// calcula cada prazo pelo regime e cria a atividade de quem cuida da
// prestação (com os avisos da P1.8); a decisão fecha a guarda dos envios que
// contam dela. A glosa mantida vira devolução, com o índice e a guia do regime.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Clock, FileText, MessageSquareWarning, Pencil, Plus, Reply, Trash2, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { usePermissoesPrestacao } from "@/hooks/usePermissoesPrestacao";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useDadosDoEnvio } from "@/hooks/useDadosDoEnvio";
import { useEnviosRegistrados } from "@/hooks/useEnviosRegistrados";
import { DecisaoModal, DiligenciaModal, GlosaModal, RecursoModal, type DespesaParaGlosa } from "@/components/prestacao/pos-envio/Formularios";
import { abrirArquivo, BORDA, BOTAO, dataBr, Etiqueta, hojeIso, ICONE, reais } from "@/components/prestacao/pos-envio/comum";
import { situacaoDaDevolucao } from "@/lib/prestacao/devolucoes";
import { envioVigente, tituloDoEnvio } from "@/lib/prestacao/envios";
import { nomeDoFornecedor } from "@/lib/prestacao/fornecedores";
import {
  devolucaoDaGlosa,
  guardaContaDaDecisao,
  prazoDeAnalise,
  recursoNoPrazo,
  resumoDasGlosas,
  ROTULO_DO_RECURSO,
  ROTULO_DO_RESULTADO,
  situacaoDaDiligencia,
  sugestaoDaAnalisePreditiva,
  textoDoPrazo,
  type EstadoDoRegistro,
} from "@/lib/prestacao/pos-envio";
import { rotuloDoApontamento } from "@/lib/prestacao/piloto";
import { definida } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoDecisao, PrestacaoDevolucao, PrestacaoDiligencia, PrestacaoGlosa, PrestacaoRecurso, ResultadoDaDecisao } from "@/lib/supabase/types";

const ROTULO = "flex items-center gap-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";
const NEUTRO = "#6B6B6B";
const COR_DA_DILIGENCIA: Record<EstadoDoRegistro, string> = { aberta: "#B07A14", vencida: "#D94A4A", respondida: "#2E8932", encerrada: NEUTRO };
const COR_DO_RESULTADO: Record<ResultadoDaDecisao, string> = { aprovada: "#2E8932", aprovada_ressalvas: "#B07A14", aprovada_parcialmente: "#B07A14", reprovada: "#D94A4A" };
const COR_DO_RECURSO: Record<PrestacaoRecurso["situacao"], string> = { em_analise: "#2D72B0", deferido: "#2E8932", parcialmente_deferido: "#B07A14", indeferido: "#D94A4A" };

type DevolucaoDaLista = Pick<PrestacaoDevolucao, "id" | "situacao" | "valor_principal" | "valor_atualizado" | "vencimento" | "pago_em" | "valor_pago">;
type Lidos = {
  diligencias: PrestacaoDiligencia[];
  decisoes: PrestacaoDecisao[];
  glosas: PrestacaoGlosa[];
  recursos: PrestacaoRecurso[];
  devolucoes: DevolucaoDaLista[];
  identificadorOficial: string | null;
  numeroProcesso: string | null;
};
type Editando =
  | { tipo: "diligencia"; linha: PrestacaoDiligencia | null; inicio?: { recebidaEm?: string; descricao?: string; responder?: boolean; preditiva?: boolean } }
  | { tipo: "decisao"; linha: PrestacaoDecisao | null }
  | { tipo: "glosa"; linha: PrestacaoGlosa | null }
  | { tipo: "recurso"; linha: PrestacaoRecurso | null };

const rotuloDaDecisao = (d: Pick<PrestacaoDecisao, "resultado" | "registrada_em">) => `${ROTULO_DO_RESULTADO[d.resultado]} em ${dataBr(d.registrada_em)}`;
const decisaoDe = (d: Pick<PrestacaoDecisao, "resultado" | "registrada_em">) => `Decisão de ${dataBr(d.registrada_em)} (${ROTULO_DO_RESULTADO[d.resultado].toLowerCase()})`;

function Secao({ titulo, descricao, acao, children }: { titulo: string; descricao: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[0.8125rem] font-semibold text-[#282525]">{titulo}</h3>
          <p className="max-w-[44rem] text-[0.6875rem] text-black/45">{descricao}</p>
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded border bg-white px-5 py-4 text-[0.75rem] text-black/45" style={BORDA}>{children}</p>;
}

function Arquivo({ path, nome, padrao, onAbrir }: { path: string | null; nome: string | null; padrao: string; onAbrir: (path: string) => void }) {
  if (!path) return null;
  return (
    <button type="button" onClick={() => onAbrir(path)} className={`${BOTAO} max-w-full`} style={BORDA}>
      <FileText size={12} className="shrink-0" aria-hidden /> <span className="truncate">{nome || padrao}</span>
    </button>
  );
}

function Acoes({ rotulo, onEditar, onExcluir }: { rotulo: string; onEditar: () => void; onExcluir: () => void }) {
  return (
    <span className="ml-auto flex items-center">
      <button type="button" onClick={onEditar} aria-label={`Editar ${rotulo}`} title="Editar" className={ICONE}><Pencil size={13} aria-hidden /></button>
      <button type="button" onClick={onExcluir} aria-label={`Excluir ${rotulo}`} title="Excluir" className={ICONE}><Trash2 size={13} aria-hidden /></button>
    </span>
  );
}

function BotaoNovo({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={BOTAO} style={BORDA}>
      <Plus size={12} aria-hidden /> {children}
    </button>
  );
}

export default function PosEnvioPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const permissoes = usePermissoesPrestacao(id);
  const organizationId = usePrestacaoOrganizacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const { dados, recarregar: recarregarEnvio } = useDadosDoEnvio(id);
  const { envios } = useEnviosRegistrados(id);
  const [lidos, setLidos] = useState<Lidos | null>(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState<Editando | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const hoje = hojeIso();
  const podeEditar = permissoes.editar;

  const carregar = useCallback(async (): Promise<{ lidos: Lidos | null; erro: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do pós-envio ainda não estão no tipo Database
    const db = supabase as any;
    const [dil, dec, glo, rec, dev, p] = await Promise.all([
      db.from("prestacao_diligencias").select("*").eq("prestacao_id", id).order("recebida_em", { ascending: false }).order("numero", { ascending: false }),
      db.from("prestacao_decisoes").select("*").eq("prestacao_id", id).order("registrada_em", { ascending: false }).order("created_at", { ascending: false }),
      db.from("prestacao_glosas").select("*").eq("prestacao_id", id).order("created_at"),
      db.from("prestacao_recursos").select("*").eq("prestacao_id", id).order("protocolado_em", { ascending: false }),
      db.from("prestacao_devolucoes").select("id, situacao, valor_principal, valor_atualizado, vencimento, pago_em, valor_pago").eq("prestacao_id", id),
      db.from("prestacoes_contas").select("identificador_oficial, numero_processo").eq("id", id).maybeSingle(),
    ]);
    const falha = dil.error ?? dec.error ?? glo.error ?? rec.error ?? dev.error ?? p.error;
    if (falha) return { lidos: null, erro: mensagemErroPrestacao(falha, "Não foi possível carregar o que veio depois do envio") };
    return {
      erro: "",
      lidos: {
        diligencias: dil.data ?? [],
        decisoes: dec.data ?? [],
        glosas: glo.data ?? [],
        recursos: rec.data ?? [],
        devolucoes: dev.data ?? [],
        identificadorOficial: p.data?.identificador_oficial ?? null,
        numeroProcesso: p.data?.numero_processo ?? null,
      },
    };
  }, [id, supabase]);

  const recarregar = useCallback(async () => {
    const r = await carregar();
    if (r.lidos) setLidos(r.lidos);
    setErro(r.erro);
    await recarregarEnvio();
  }, [carregar, recarregarEnvio]);

  useEffect(() => {
    let ativo = true;
    carregar().then(r => {
      if (!ativo) return;
      setLidos(r.lidos);
      setErro(r.erro);
    });
    return () => { ativo = false; };
  }, [carregar]);

  const regime = dados?.regime ?? null;
  const final = envios ? envioVigente(envios, "final") : null;
  const envioAtual = final ?? (envios ? envioVigente(envios, "parcial") : null);
  const analise = prazoDeAnalise(regime, final?.enviado_em);
  // A análise preditiva vem depois do primeiro envio; reenvio e decisão já registrada dispensam a sugestão.
  const sugestao = lidos && final?.versao === 1 && lidos.decisoes.length === 0 ? sugestaoDaAnalisePreditiva(regime, final.enviado_em, lidos.diligencias) : null;
  const carregado = lidos !== null && dados !== null;
  const guardaPelaDecisao = guardaContaDaDecisao(regime);
  const temAnalisePreditiva = Boolean(regime && definida(regime.posEnvio)?.regras.some(r => r.codigo === "analise_preditiva"));

  const despesas = useMemo<DespesaParaGlosa[]>(() => {
    const fornecedores = new Map((dados?.estado.fornecedores ?? []).map(f => [f.id, f]));
    return (dados?.estado.despesas ?? []).map(d => {
      const f = d.fornecedor_id ? fornecedores.get(d.fornecedor_id) : null;
      const valor = d.valor_extraido === null || d.valor_extraido === undefined ? null : Number(d.valor_extraido);
      const texto = [
        (f ? nomeDoFornecedor(f) : "") || d.nome_arquivo || "Despesa",
        d.numero_documento ? `nº ${d.numero_documento}` : null,
        d.data_doc ? dataBr(d.data_doc) : null,
        valor !== null ? reais(valor) : null,
      ].filter(Boolean).join(" · ");
      return { id: d.id, texto, valor };
    });
  }, [dados]);

  const contas = useMemo(() => {
    const l = lidos;
    if (!l) return null;
    const situacoes = l.diligencias.map(d => situacaoDaDiligencia(d, hoje).estado);
    return {
      abertas: situacoes.filter(s => s === "aberta" || s === "vencida").length,
      vencidas: situacoes.filter(s => s === "vencida").length,
      glosas: resumoDasGlosas(l.glosas, l.devolucoes),
    };
  }, [lidos, hoje]);

  const decisaoPorId = useMemo(() => new Map((lidos?.decisoes ?? []).map(d => [d.id, d])), [lidos]);
  const devolucaoPorId = useMemo(() => new Map((lidos?.devolucoes ?? []).map(d => [d.id, d])), [lidos]);
  const despesaPorId = useMemo(() => new Map(despesas.map(d => [d.id, d])), [despesas]);
  const recorriveis = (lidos?.decisoes ?? []).filter(d => d.instancia === "analise" && d.resultado !== "aprovada");

  async function abrir(path: string) {
    const problema = await abrirArquivo(supabase, path);
    if (problema) setErro(problema);
  }

  function excluir(tabela: string, linhaId: string, titulo: string, descricao: string, arquivos: (string | null | undefined)[]) {
    confirmDelete({
      title: titulo,
      description: descricao,
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do pós-envio ainda não estão no tipo Database
        const { error } = await (supabase as any).from(tabela).delete().eq("id", linhaId);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir"));
        const sobras = arquivos.filter((x): x is string => Boolean(x));
        if (sobras.length) await supabase.storage.from("documentos").remove(sobras);
        await recarregar();
      },
    });
  }

  async function gerarDevolucao(g: PrestacaoGlosa) {
    const decisao = g.decisao_id ? decisaoPorId.get(g.decisao_id) : null;
    const { campos, erro: problema } = devolucaoDaGlosa(g, regime, decisao, { identificador_oficial: lidos?.identificadorOficial, numero_processo: lidos?.numeroProcesso }, hoje);
    if (problema) { setErro(problema); return; }
    setGerando(g.id);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do pós-envio ainda não estão no tipo Database
    const db = supabase as any;
    const { data, error } = await db.from("prestacao_devolucoes").insert({ ...campos, prestacao_id: id }).select("id").single();
    if (error || !data) {
      setErro(mensagemErroPrestacao(error, "Não foi possível gerar a devolução"));
    } else {
      const ligada = await db.from("prestacao_glosas").update({ devolucao_id: data.id }).eq("id", g.id);
      if (ligada.error) {
        await db.from("prestacao_devolucoes").delete().eq("id", data.id);
        setErro(mensagemErroPrestacao(ligada.error, "Não foi possível ligar a devolução à glosa"));
      }
    }
    setGerando(null);
    await recarregar();
  }

  return (
    <div className="mx-auto max-w-pagina space-y-6 px-4 py-6 md:px-8">
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-[#282525]">Após o envio</h2>
        <p className="max-w-[44rem] text-[0.6875rem] text-black/45">
          Diligências, decisões, glosas e recursos. O prazo de cada um vem do regime e vira atividade, com aviso, para quem cuida da prestação.{guardaPelaDecisao ? " A decisão sobre as contas marca o início da guarda do que foi enviado." : ""}
        </p>
      </div>

      {erro && <p role="alert" className="rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#D94A4A40" }}>{erro}</p>}

      {!carregado && !erro && <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />)}</div>}

      {carregado && lidos && contas && (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border bg-white px-5 py-4 text-[0.6875rem] md:grid-cols-4" style={BORDA}>
            <div className="min-w-0">
              <dt className={ROTULO}>Envio que vale</dt>
              <dd className="mt-0.5 text-[0.8125rem] text-black/70">
                {envioAtual ? <>{tituloDoEnvio(envioAtual)} <span className="tabular-nums text-black/50">em {dataBr(envioAtual.enviado_em)}</span></> : <span className="text-black/45">Nenhum registrado</span>}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className={ROTULO}>Análise do órgão</dt>
              <dd className="mt-0.5 text-[0.8125rem] tabular-nums">{analise ? <span className="font-semibold text-[#282525]">Até {dataBr(analise.data)}</span> : <span className="text-black/45">Sem prazo no regime</span>}</dd>
            </div>
            <div>
              <dt className={ROTULO}>
                {contas.vencidas > 0
                  ? <Clock size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#D94A4A]" />
                  : contas.abertas > 0 && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden className="shrink-0 text-[#B07A14]" />}
                Diligências abertas
              </dt>
              <dd className={`mt-0.5 text-[0.8125rem] font-semibold tabular-nums ${contas.abertas ? "text-[#282525]" : "text-black/30"}`}>
                {contas.abertas}{contas.vencidas ? `, ${contas.vencidas} vencida${contas.vencidas === 1 ? "" : "s"}` : ""}
              </dd>
            </div>
            <div>
              <dt className={ROTULO}>Glosado</dt>
              <dd className={`mt-0.5 text-[0.8125rem] font-semibold tabular-nums ${contas.glosas.mantido ? "text-[#282525]" : "text-black/30"}`}>
                {reais(contas.glosas.mantido / 100)}
                {contas.glosas.mantido > 0 && <span className="font-normal text-black/45"> · recolhido {reais(contas.glosas.recolhido / 100)}</span>}
              </dd>
            </div>
          </dl>

          {!envioAtual && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-black/50">
              O registro do envio guarda o que foi enviado e dá o marco dos prazos.
              <Link href={`/prestacoes/${id}/envio/pacote`} className="inline-flex items-center gap-1 rounded text-black/70 underline decoration-black/20 underline-offset-2 hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                Registrar no pacote <ArrowRight size={11} aria-hidden />
              </Link>
            </p>
          )}

          {sugestao && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white px-5 py-3 text-[0.75rem]" style={{ borderColor: "#2D72B040" }}>
              <p className="flex min-w-0 items-start gap-1.5 text-[#2D72B0]">
                <MessageSquareWarning size={13} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  {sugestao.descricao} {sugestao.recebidaEm > hoje ? "Espere a diligência em" : "Ela era esperada em"} {dataBr(sugestao.recebidaEm)}{sugestao.dias ? `, com ${sugestao.dias} dias para responder` : ""}.
                </span>
              </p>
              {podeEditar && (
                <button type="button" onClick={() => setEditando({ tipo: "diligencia", linha: null, inicio: { recebidaEm: sugestao.recebidaEm, descricao: "Diligência da análise preditiva", preditiva: true } })} className={BOTAO} style={BORDA}>
                  Registrar a diligência
                </button>
              )}
            </div>
          )}

          <Secao
            titulo="Diligências"
            descricao="O que o órgão pede depois do envio. Diligência aberta impede registrar um novo envio."
            acao={podeEditar && <BotaoNovo onClick={() => setEditando({ tipo: "diligencia", linha: null })}>Nova diligência</BotaoNovo>}
          >
            {lidos.diligencias.length === 0 ? (
              <Vazio>Nenhuma diligência registrada. Quando o órgão pedir algo, registre aqui: o prazo do regime vira atividade com aviso.</Vazio>
            ) : (
              <ul className="divide-y divide-black/[.05] overflow-hidden rounded border bg-white" style={BORDA} aria-label="Diligências">
                {lidos.diligencias.map(d => {
                  const s = situacaoDaDiligencia(d, hoje);
                  return (
                    <li key={d.id} className="space-y-2 px-5 py-4 text-[0.75rem]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-black/85">Diligência nº {d.numero}</p>
                          <p className="whitespace-pre-line text-[0.6875rem] text-black/60">{d.descricao}</p>
                          <p className="mt-0.5 text-[0.6875rem] tabular-nums text-black/40">
                            Recebida em {dataBr(d.recebida_em)}
                            {d.preditiva ? " · análise preditiva" : ""}
                            {d.prazo && d.prazo_regime && d.prazo !== d.prazo_regime ? ` · prazo ajustado; pelo regime, ${dataBr(d.prazo_regime)}` : ""}
                          </p>
                          {d.apontamentos.length > 0 && (
                            <p className="mt-0.5 text-[0.6875rem] text-black/55">Apontado: {d.apontamentos.map(rotuloDoApontamento).join("; ")}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Etiqueta cor={COR_DA_DILIGENCIA[s.estado]}>{s.estado === "aberta" ? "Aberta" : s.estado === "vencida" ? "Vencida" : s.estado === "respondida" ? "Respondida" : "Encerrada"}</Etiqueta>
                          <span className="text-right text-[0.625rem] tabular-nums text-black/45">{s.texto}</span>
                        </div>
                      </div>
                      {d.resposta && <p className="whitespace-pre-line border-l-2 pl-3 text-[0.6875rem] text-black/55" style={BORDA}>{d.resposta}</p>}
                      <div className="flex flex-wrap items-center gap-2">
                        {podeEditar && d.situacao === "aberta" && (
                          <button type="button" onClick={() => setEditando({ tipo: "diligencia", linha: d, inicio: { responder: true } })} className={BOTAO} style={BORDA}>
                            <Reply size={12} aria-hidden /> Registrar resposta
                          </button>
                        )}
                        <Arquivo path={d.documento_path} nome={d.documento_nome} padrao="Ofício" onAbrir={abrir} />
                        <Arquivo path={d.resposta_path} nome={d.resposta_nome} padrao="Resposta" onAbrir={abrir} />
                        {podeEditar && (
                          <Acoes
                            rotulo={`diligência nº ${d.numero}`}
                            onEditar={() => setEditando({ tipo: "diligencia", linha: d })}
                            onExcluir={() => excluir("prestacao_diligencias", d.id, "Excluir diligência?", `Diligência nº ${d.numero}, com os arquivos e a atividade do prazo.`, [d.documento_path, d.resposta_path])}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          <Secao
            titulo="Decisões"
            descricao="O resultado da análise das contas e do recurso, sempre com o documento. Os prazos de recurso e de devolução contam da ciência."
            acao={podeEditar && <BotaoNovo onClick={() => setEditando({ tipo: "decisao", linha: null })}>Registrar decisão</BotaoNovo>}
          >
            {lidos.decisoes.length === 0 ? (
              <Vazio>Nenhuma decisão registrada. Quando o órgão decidir sobre as contas, registre com o documento{guardaPelaDecisao ? ": a guarda do que foi enviado passa a contar daí" : ""}.</Vazio>
            ) : (
              <ul className="divide-y divide-black/[.05] overflow-hidden rounded border bg-white" style={BORDA} aria-label="Decisões">
                {lidos.decisoes.map(d => {
                  const recursosDela = lidos.recursos.filter(r => r.decisao_id === d.id);
                  return (
                    <li key={d.id} className="space-y-2 px-5 py-4 text-[0.75rem]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-black/85">{d.instancia === "recurso" ? "Decisão do recurso" : "Análise das contas"}</p>
                          <p className="text-[0.6875rem] tabular-nums text-black/40">
                            {[`Decidida em ${dataBr(d.registrada_em)}`, d.ciencia_em ? `ciência em ${dataBr(d.ciencia_em)}` : "sem a data da ciência"].join(" · ")}
                          </p>
                          {d.resumo && <p className="mt-1 whitespace-pre-line text-[0.6875rem] text-black/60">{d.resumo}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Etiqueta cor={COR_DO_RESULTADO[d.resultado]}>{ROTULO_DO_RESULTADO[d.resultado]}</Etiqueta>
                          {d.valor_glosado ? <span className="text-[0.75rem] tabular-nums text-black/80">{reais(d.valor_glosado)} glosados</span> : null}
                        </div>
                      </div>
                      {(d.prazo_recurso || d.prazo_devolucao) && (
                        <p className="text-[0.6875rem] tabular-nums text-black/55">
                          {[
                            d.prazo_recurso && d.instancia === "analise" && d.resultado !== "aprovada"
                              ? (recursosDela.length ? `Recurso protocolado em ${dataBr(recursosDela[0].protocolado_em)}` : `Recurso: ${textoDoPrazo(d.prazo_recurso, hoje).replace(/^Até/, "até")}`)
                              : null,
                            d.prazo_devolucao ? `Devolução até ${dataBr(d.prazo_devolucao)}` : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Arquivo path={d.documento_path} nome={d.documento_nome} padrao="Documento da decisão" onAbrir={abrir} />
                        {podeEditar && (
                          <Acoes
                            rotulo={`decisão ${rotuloDaDecisao(d).toLowerCase()}`}
                            onEditar={() => setEditando({ tipo: "decisao", linha: d })}
                            onExcluir={() => excluir("prestacao_decisoes", d.id, "Excluir decisão?",
                              `${rotuloDaDecisao(d)}, com o documento${recursosDela.length ? ` e ${recursosDela.length === 1 ? "o recurso" : `os ${recursosDela.length} recursos`} contra ela` : ""}. As glosas ficam, sem a decisão.`,
                              [d.documento_path, ...recursosDela.flatMap(r => [r.documento_path, r.decisao_path])])}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>

          <Secao
            titulo="Glosas"
            descricao="O valor que o órgão não aceitou. A glosa mantida vira devolução, atualizada pelo índice do regime a partir da data-base."
            acao={podeEditar && <BotaoNovo onClick={() => setEditando({ tipo: "glosa", linha: null })}>Nova glosa</BotaoNovo>}
          >
            {lidos.glosas.length === 0 ? (
              <Vazio>Nenhuma glosa registrada.</Vazio>
            ) : (
              <>
                {contas.glosas.semDevolucao > 0 && (
                  <p className="rounded border bg-white px-4 py-2 text-[0.6875rem] text-[#B07A14]" style={{ borderColor: "#B07A1440" }}>
                    {contas.glosas.semDevolucao === 1 ? "1 glosa mantida ainda não tem devolução." : `${contas.glosas.semDevolucao} glosas mantidas ainda não têm devolução.`}
                  </p>
                )}
                <ul className="divide-y divide-black/[.05] overflow-hidden rounded border bg-white" style={BORDA} aria-label="Glosas">
                  {lidos.glosas.map(g => {
                    const decisao = g.decisao_id ? decisaoPorId.get(g.decisao_id) : null;
                    const despesa = g.despesa_id ? despesaPorId.get(g.despesa_id) : null;
                    const devolucao = g.devolucao_id ? devolucaoPorId.get(g.devolucao_id) : null;
                    return (
                      <li key={g.id} className="space-y-2 px-5 py-4 text-[0.75rem]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-black/85">{g.descricao}</p>
                            <p className="text-[0.6875rem] text-black/45">
                              {[decisao ? decisaoDe(decisao) : "Sem decisão", despesa?.texto, g.data_base ? `data-base ${dataBr(g.data_base)}` : null].filter(Boolean).join(" · ")}
                            </p>
                            {g.observacoes && <p className="mt-1 text-[0.6875rem] text-black/55">{g.observacoes}</p>}
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-[0.875rem] tabular-nums text-black/85">{reais(g.valor)}</span>
                            <Etiqueta cor={g.situacao === "mantida" ? "#B07A14" : "#2E8932"}>{g.situacao === "mantida" ? "Mantida" : "Revertida"}</Etiqueta>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {devolucao ? (
                            <Link href={`/prestacoes/${id}/envio/devolucoes`} className={BOTAO} style={BORDA}>
                              <Undo2 size={12} aria-hidden />
                              {devolucao.situacao === "paga"
                                ? `Devolução paga em ${dataBr(devolucao.pago_em)}`
                                : `Devolução ${situacaoDaDevolucao(devolucao, hoje).texto.replace(/^\p{Lu}/u, l => l.toLowerCase())} · ${reais(devolucao.valor_atualizado ?? devolucao.valor_principal)}`}
                            </Link>
                          ) : g.situacao === "mantida" && podeEditar ? (
                            <button type="button" onClick={() => gerarDevolucao(g)} disabled={gerando !== null} className={BOTAO} style={BORDA}>
                              <Undo2 size={12} aria-hidden /> {gerando === g.id ? "Gerando…" : "Gerar devolução"}
                            </button>
                          ) : null}
                          {podeEditar && (
                            <Acoes
                              rotulo={`glosa ${g.descricao}`}
                              onEditar={() => setEditando({ tipo: "glosa", linha: g })}
                              onExcluir={() => excluir("prestacao_glosas", g.id, "Excluir glosa?", `${g.descricao}, ${reais(g.valor)}.${g.devolucao_id ? " A devolução gerada continua em Devoluções." : ""}`, [])}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Secao>

          <Secao
            titulo="Recursos"
            descricao="Contra a decisão que não aprovou as contas por inteiro, dentro do prazo do regime."
            acao={podeEditar && (
              <BotaoNovo onClick={() => setEditando({ tipo: "recurso", linha: null })} disabled={recorriveis.length === 0} title={recorriveis.length === 0 ? "Registre antes a decisão que será recorrida" : undefined}>
                Registrar recurso
              </BotaoNovo>
            )}
          >
            {lidos.recursos.length === 0 ? (
              <Vazio>Nenhum recurso registrado.</Vazio>
            ) : (
              <ul className="divide-y divide-black/[.05] overflow-hidden rounded border bg-white" style={BORDA} aria-label="Recursos">
                {lidos.recursos.map(r => {
                  const decisao = decisaoPorId.get(r.decisao_id);
                  const noPrazo = recursoNoPrazo(r, decisao);
                  return (
                    <li key={r.id} className="space-y-2 px-5 py-4 text-[0.75rem]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-black/85">Recurso contra a {decisao ? decisaoDe(decisao).replace(/^D/, "d") : "decisão"}</p>
                          <p className="text-[0.6875rem] tabular-nums text-black/40">
                            Protocolado em {dataBr(r.protocolado_em)}
                            {noPrazo === false && <> · <Clock size={12} strokeWidth={1.75} aria-hidden className="mr-0.5 inline-block align-[-0.125rem] text-[#D94A4A]" />depois do prazo ({dataBr(decisao?.prazo_recurso)})</>}
                            {r.decidido_em ? ` · decidido em ${dataBr(r.decidido_em)}` : ""}
                          </p>
                          {r.pedido && <p className="mt-1 whitespace-pre-line text-[0.6875rem] text-black/60">{r.pedido}</p>}
                          {r.resultado_resumo && <p className="mt-1 whitespace-pre-line border-l-2 pl-3 text-[0.6875rem] text-black/55" style={BORDA}>{r.resultado_resumo}</p>}
                        </div>
                        <Etiqueta cor={COR_DO_RECURSO[r.situacao]}>{ROTULO_DO_RECURSO[r.situacao]}</Etiqueta>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Arquivo path={r.documento_path} nome={r.documento_nome} padrao="Recurso" onAbrir={abrir} />
                        <Arquivo path={r.decisao_path} nome={r.decisao_nome} padrao="Decisão do recurso" onAbrir={abrir} />
                        {podeEditar && (
                          <Acoes
                            rotulo={`recurso de ${dataBr(r.protocolado_em)}`}
                            onEditar={() => setEditando({ tipo: "recurso", linha: r })}
                            onExcluir={() => excluir("prestacao_recursos", r.id, "Excluir recurso?", `Protocolado em ${dataBr(r.protocolado_em)}, com os arquivos.`, [r.documento_path, r.decisao_path])}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>
        </>
      )}

      {editando?.tipo === "diligencia" && (
        <DiligenciaModal
          prestacaoId={id}
          organizationId={organizationId}
          diligencia={editando.linha}
          inicio={editando.inicio}
          envioId={envioAtual?.id ?? null}
          analisePreditiva={temAnalisePreditiva}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
      {editando?.tipo === "decisao" && (
        <DecisaoModal
          prestacaoId={id}
          organizationId={organizationId}
          decisao={editando.linha}
          regime={regime}
          envioId={final?.id ?? envioAtual?.id ?? null}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
      {editando?.tipo === "glosa" && lidos && (
        <GlosaModal
          prestacaoId={id}
          organizationId={organizationId}
          glosa={editando.linha}
          decisoes={lidos.decisoes}
          despesas={despesas}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
      {editando?.tipo === "recurso" && lidos && (
        <RecursoModal
          prestacaoId={id}
          organizationId={organizationId}
          recurso={editando.linha}
          decisoes={lidos.decisoes}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recarregar(); }}
        />
      )}
    </div>
  );
}
