"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { InputValor } from "@/components/ui/CampoValor";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { numeroDigitado } from "@/lib/prestacao/objeto";
import {
  erroDaDecisao,
  erroDaDiligencia,
  erroDaGlosa,
  erroDoRecurso,
  resultadosDoRegime,
  ROTULO_DO_RECURSO,
  ROTULO_DO_RESULTADO,
} from "@/lib/prestacao/pos-envio";
import { APONTAMENTOS, rotuloDoApontamento } from "@/lib/prestacao/piloto";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoDecisao, PrestacaoDiligencia, PrestacaoGlosa, PrestacaoRecurso, ResultadoDaDecisao } from "@/lib/supabase/types";
import {
  abrirArquivo,
  AREA,
  arquivoDe,
  CAMPO,
  CampoArquivo,
  dataBr,
  enviarArquivo,
  Opcoes,
  reais,
  RodapeDoModal,
  ROTULO,
  textoDoValor,
  type ArquivoDoForm,
} from "./comum";

type Base = { prestacaoId: string; organizationId: string | null; onClose: () => void; onSaved: () => void };

/** Grava a linha; sobe os arquivos novos antes e apaga os trocados depois. Se falhar, desfaz o que subiu. */
function useGravar(tabela: string) {
  const supabase = useMemo(() => createClient(), []);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function gravar(p: {
    prestacaoId: string;
    organizationId: string | null;
    id: string | null;
    arquivos: Record<string, ArquivoDoForm>;
    antigos: (string | null | undefined)[];
    linha: Record<string, unknown>;
    padrao: string;
  }): Promise<boolean> {
    if (Object.values(p.arquivos).some(a => a.novo) && !p.organizationId) { setErro("Aguarde: a prestação ainda está carregando."); return false; }
    setSalvando(true);
    setErro("");
    const enviados: string[] = [];
    try {
      const gravados: Record<string, unknown> = {};
      for (const [chave, a] of Object.entries(p.arquivos)) {
        const r = await enviarArquivo(supabase, p.organizationId!, p.prestacaoId, a, enviados);
        gravados[`${chave}_path`] = r.path;
        gravados[`${chave}_nome`] = r.nome;
      }
      const linha = { ...p.linha, ...gravados };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do pós-envio ainda não estão no tipo Database
      const t = (supabase as any).from(tabela);
      const { error } = p.id ? await t.update(linha).eq("id", p.id) : await t.insert({ ...linha, prestacao_id: p.prestacaoId });
      if (error) throw new Error(mensagemErroPrestacao(error, p.padrao));
      const agora = new Set(Object.keys(gravados).filter(k => k.endsWith("_path")).map(k => gravados[k]));
      const sobras = p.antigos.filter((x): x is string => Boolean(x) && !agora.has(x));
      if (sobras.length) await supabase.storage.from("documentos").remove(sobras);
      setSalvando(false);
      return true;
    } catch (e) {
      if (enviados.length) await supabase.storage.from("documentos").remove(enviados);
      setSalvando(false);
      setErro(e instanceof Error ? e.message : p.padrao);
      return false;
    }
  }

  async function abrir(path: string) {
    const problema = await abrirArquivo(supabase, path);
    if (problema) setErro(problema);
  }

  return { gravar, abrir, salvando, erro, setErro };
}

// ─── Diligência ─────────────────────────────────────────────────────────────

export function DiligenciaModal({ prestacaoId, organizationId, diligencia, inicio, envioId, analisePreditiva = false, onClose, onSaved }: Base & {
  diligencia: PrestacaoDiligencia | null;
  inicio?: { recebidaEm?: string; descricao?: string; responder?: boolean; preditiva?: boolean };
  envioId: string | null;
  /** O regime tem análise preditiva (Rouanet): a diligência pode vir dela. */
  analisePreditiva?: boolean;
}) {
  const { gravar, abrir, salvando, erro, setErro } = useGravar("prestacao_diligencias");
  const [recebidaEm, setRecebidaEm] = useState(diligencia?.recebida_em ?? inicio?.recebidaEm ?? "");
  const [prazo, setPrazo] = useState(diligencia?.prazo ?? "");
  const [descricao, setDescricao] = useState(diligencia?.descricao ?? inicio?.descricao ?? "");
  const [situacao, setSituacao] = useState<PrestacaoDiligencia["situacao"]>(inicio?.responder ? "respondida" : diligencia?.situacao ?? "aberta");
  const [respondidaEm, setRespondidaEm] = useState(diligencia?.respondida_em ?? (inicio?.responder ? new Date().toLocaleDateString("sv-SE") : ""));
  const [resposta, setResposta] = useState(diligencia?.resposta ?? "");
  const [documento, setDocumento] = useState(arquivoDe(diligencia?.documento_path, diligencia?.documento_nome));
  const [respostaArquivo, setRespostaArquivo] = useState(arquivoDe(diligencia?.resposta_path, diligencia?.resposta_nome));
  const [preditiva, setPreditiva] = useState(diligencia?.preditiva ?? inicio?.preditiva ?? false);
  const [apontamentos, setApontamentos] = useState<string[]>(diligencia?.apontamentos ?? []);

  async function salvar() {
    const problema = erroDaDiligencia({ recebidaEm, descricao, prazo, situacao, respondidaEm, resposta });
    if (problema) { setErro(problema); return; }
    const respondida = situacao === "respondida";
    const ok = await gravar({
      prestacaoId, organizationId, id: diligencia?.id ?? null,
      arquivos: { documento, resposta: respondida ? respostaArquivo : { path: null, nome: null, novo: null } },
      antigos: [diligencia?.documento_path, diligencia?.resposta_path],
      linha: {
        recebida_em: recebidaEm,
        // Vazio na criação: o banco põe o prazo do regime.
        prazo: prazo || (diligencia ? null : undefined),
        descricao: descricao.trim(),
        situacao,
        respondida_em: respondida || situacao === "encerrada" ? respondidaEm || null : null,
        resposta: resposta.trim() || null,
        preditiva,
        apontamentos,
        ...(diligencia ? {} : { envio_id: envioId }),
      },
      padrao: "Não foi possível salvar a diligência",
    });
    if (ok) onSaved();
  }

  return (
    <ModalPrestacao
      titulo={diligencia ? `Diligência nº ${diligencia.numero}` : "Nova diligência"}
      subtitulo="O que o órgão pede, o prazo e a resposta"
      onClose={onClose}
      rodape={<RodapeDoModal salvando={salvando} rotulo={diligencia ? "Salvar" : "Registrar diligência"} onCancelar={onClose} onSalvar={salvar} />}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label>
          <span className={ROTULO}>Recebida em (ciência)</span>
          <input type="date" value={recebidaEm} onChange={e => setRecebidaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Prazo para responder</span>
          <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className={`${CAMPO} tabular-nums`} />
          <span className="mt-1 block text-[0.625rem] text-black/40">
            {diligencia?.prazo_regime ? `Pelo regime: ${dataBr(diligencia.prazo_regime)}.` : "Vazio: o prazo do regime, contado do recebimento."}
          </span>
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>O que o órgão pede</span>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} maxLength={4000} className={AREA} autoFocus={!diligencia && !inicio?.descricao} />
        </label>
        <div className="sm:col-span-2">
          <CampoArquivo rotulo="Ofício ou mensagem do órgão" arquivo={documento} onChange={setDocumento} onAbrir={abrir} />
        </div>
        {(analisePreditiva || preditiva) && (
          <div className="sm:col-span-2">
            <Opcoes rotulo="Origem" valor={preditiva ? "preditiva" : "orgao"} onChange={v => setPreditiva(v === "preditiva")}
              opcoes={[{ id: "orgao", rotulo: "Análise do órgão" }, { id: "preditiva", rotulo: "Análise preditiva" }]} />
          </div>
        )}
        <div className="sm:col-span-2">
          <span className={ROTULO}>O que o órgão apontou e o sistema confere</span>
          {apontamentos.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Apontamentos">
              {apontamentos.map(c => (
                <li key={c} className="inline-flex items-center gap-1 rounded border bg-white py-1 pl-2 pr-1 text-[0.6875rem] text-black/70" style={{ borderColor: "rgba(13,13,13,.14)" }}>
                  {rotuloDoApontamento(c)}
                  <button type="button" onClick={() => setApontamentos(apontamentos.filter(x => x !== c))} aria-label={`Tirar ${rotuloDoApontamento(c)}`}
                    className="rounded p-0.5 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                    <X size={11} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Dropdown value="" onChange={v => { if (v && !apontamentos.includes(v)) setApontamentos([...apontamentos, v]); }}
            ariaLabel="Adicionar apontamento" placeholder={apontamentos.length ? "Adicionar outro" : "Nenhum; adicionar"}
            options={APONTAMENTOS.filter(a => !apontamentos.includes(a.codigo)).map(a => ({ value: a.codigo, label: rotuloDoApontamento(a.codigo) }))} />
          <span className="mt-1 block text-[0.625rem] text-black/40">O piloto mede as diligências por erro que o sistema já confere antes do envio.</span>
        </div>
        <div className="sm:col-span-2">
          <Opcoes rotulo="Situação" valor={situacao} onChange={setSituacao}
            opcoes={[{ id: "aberta", rotulo: "Aberta" }, { id: "respondida", rotulo: "Respondida" }, { id: "encerrada", rotulo: "Encerrada" }]} />
        </div>
        {situacao !== "aberta" && (
          <>
            <label>
              <span className={ROTULO}>{situacao === "respondida" ? "Respondida em" : "Encerrada em"}</span>
              <input type="date" value={respondidaEm} onChange={e => setRespondidaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
            </label>
            {situacao === "respondida" && <CampoArquivo rotulo="Documento da resposta" arquivo={respostaArquivo} onChange={setRespostaArquivo} onAbrir={abrir} />}
            <label className="sm:col-span-2">
              <span className={ROTULO}>{situacao === "respondida" ? "Resposta" : "Observação"}</span>
              <textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={3} maxLength={4000} className={AREA} />
            </label>
          </>
        )}
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

// ─── Decisão ────────────────────────────────────────────────────────────────

export function DecisaoModal({ prestacaoId, organizationId, decisao, regime, envioId, onClose, onSaved }: Base & {
  decisao: PrestacaoDecisao | null;
  regime: RegimeNormativo | null;
  envioId: string | null;
}) {
  const { gravar, abrir, salvando, erro, setErro } = useGravar("prestacao_decisoes");
  const resultados = resultadosDoRegime(regime);
  const [resultado, setResultado] = useState<ResultadoDaDecisao>(decisao?.resultado ?? resultados[0].id);
  const [instancia, setInstancia] = useState<PrestacaoDecisao["instancia"]>(decisao?.instancia ?? "analise");
  const [registradaEm, setRegistradaEm] = useState(decisao?.registrada_em ?? "");
  const [cienciaEm, setCienciaEm] = useState(decisao?.ciencia_em ?? "");
  const [valorGlosado, setValorGlosado] = useState(textoDoValor(decisao?.valor_glosado));
  const [resumo, setResumo] = useState(decisao?.resumo ?? "");
  const [documento, setDocumento] = useState(arquivoDe(decisao?.documento_path, decisao?.documento_nome));
  const descricao = resultados.find(r => r.id === resultado)?.descricao;

  async function salvar() {
    const valor = valorGlosado.trim() ? numeroDigitado(valorGlosado) : null;
    const problema = erroDaDecisao({ registradaEm, cienciaEm, valorGlosado: valor, temDocumento: Boolean(documento.novo || documento.path) });
    if (problema) { setErro(problema); return; }
    const ok = await gravar({
      prestacaoId, organizationId, id: decisao?.id ?? null,
      arquivos: { documento },
      antigos: [decisao?.documento_path],
      linha: {
        resultado, instancia, registrada_em: registradaEm, ciencia_em: cienciaEm || null, valor_glosado: valor, resumo: resumo.trim() || null,
        ...(decisao ? {} : { envio_id: envioId }),
      },
      padrao: "Não foi possível salvar a decisão",
    });
    if (ok) onSaved();
  }

  return (
    <ModalPrestacao
      titulo={decisao ? "Editar decisão" : "Registrar decisão"}
      subtitulo="O resultado da análise das contas, com o documento"
      onClose={onClose}
      rodape={<RodapeDoModal salvando={salvando} rotulo={decisao ? "Salvar" : "Registrar decisão"} onCancelar={onClose} onSalvar={salvar} />}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={ROTULO}>Resultado</span>
          <Dropdown value={resultado} onChange={v => setResultado(v as ResultadoDaDecisao)} ariaLabel="Resultado" options={resultados.map(r => ({ value: r.id, label: r.rotulo }))} />
          {descricao && <p className="mt-1 text-[0.625rem] text-black/45">{descricao}</p>}
        </div>
        <div className="sm:col-span-2">
          <Opcoes rotulo="Instância" valor={instancia} onChange={setInstancia} opcoes={[{ id: "analise", rotulo: "Análise das contas" }, { id: "recurso", rotulo: "Decisão do recurso" }]} />
        </div>
        <label>
          <span className={ROTULO}>Data da decisão (registro)</span>
          <input type="date" value={registradaEm} onChange={e => setRegistradaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Ciência</span>
          <input type="date" value={cienciaEm} onChange={e => setCienciaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
          <span className="mt-1 block text-[0.625rem] text-black/40">O prazo de recurso conta daqui.</span>
        </label>
        <label>
          <span className={ROTULO}>Valor glosado (R$)</span>
          <InputValor value={valorGlosado} onChange={setValorGlosado} placeholder="0,00" className={`${CAMPO} tabular-nums`} />
        </label>
        <CampoArquivo rotulo="Documento da decisão" arquivo={documento} onChange={setDocumento} onAbrir={abrir} />
        <label className="sm:col-span-2">
          <span className={ROTULO}>Resumo</span>
          <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={3} maxLength={4000} className={AREA} />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

// ─── Glosa ──────────────────────────────────────────────────────────────────

export type DespesaParaGlosa = { id: string; texto: string; valor: number | null };

export function GlosaModal({ prestacaoId, organizationId, glosa, decisoes, despesas, onClose, onSaved }: Base & {
  glosa: PrestacaoGlosa | null;
  decisoes: readonly PrestacaoDecisao[];
  despesas: readonly DespesaParaGlosa[];
}) {
  const { gravar, salvando, erro, setErro } = useGravar("prestacao_glosas");
  const [decisaoId, setDecisaoId] = useState(glosa?.decisao_id ?? decisoes[0]?.id ?? "");
  const [despesaId, setDespesaId] = useState(glosa?.despesa_id ?? "");
  const [descricao, setDescricao] = useState(glosa?.descricao ?? "");
  const [valor, setValor] = useState(textoDoValor(glosa?.valor));
  const [dataBase, setDataBase] = useState(glosa?.data_base ?? "");
  const [situacao, setSituacao] = useState<PrestacaoGlosa["situacao"]>(glosa?.situacao ?? "mantida");
  const [observacoes, setObservacoes] = useState(glosa?.observacoes ?? "");

  function escolherDespesa(id: string) {
    setDespesaId(id);
    const d = despesas.find(x => x.id === id);
    if (d && !valor.trim() && d.valor !== null) setValor(textoDoValor(d.valor));
  }

  async function salvar() {
    const numero = numeroDigitado(valor);
    const problema = erroDaGlosa({ descricao, valor: numero });
    if (problema) { setErro(problema); return; }
    const ok = await gravar({
      prestacaoId, organizationId, id: glosa?.id ?? null, arquivos: {}, antigos: [],
      linha: { decisao_id: decisaoId || null, despesa_id: despesaId || null, descricao: descricao.trim(), valor: numero, data_base: dataBase || null, situacao, observacoes: observacoes.trim() || null },
      padrao: "Não foi possível salvar a glosa",
    });
    if (ok) onSaved();
  }

  return (
    <ModalPrestacao
      titulo={glosa ? "Editar glosa" : "Nova glosa"}
      subtitulo="O valor que o órgão não aceitou e de onde conta a atualização"
      onClose={onClose}
      rodape={<RodapeDoModal salvando={salvando} rotulo={glosa ? "Salvar" : "Registrar glosa"} onCancelar={onClose} onSalvar={salvar} />}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div>
          <span className={ROTULO}>Decisão</span>
          <Dropdown value={decisaoId} onChange={setDecisaoId} ariaLabel="Decisão" placeholder="Sem decisão"
            options={[{ value: "", label: "Sem decisão" }, ...decisoes.map(d => ({ value: d.id, label: `${ROTULO_DO_RESULTADO[d.resultado]} · ${dataBr(d.registrada_em)}` }))]} />
        </div>
        <div>
          <span className={ROTULO}>Despesa</span>
          <Dropdown value={despesaId} onChange={escolherDespesa} ariaLabel="Despesa" placeholder="Sem despesa"
            options={[{ value: "", label: "Sem despesa" }, ...despesas.map(d => ({ value: d.id, label: d.texto }))]} />
        </div>
        <label className="sm:col-span-2">
          <span className={ROTULO}>O que foi glosado</span>
          <input value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={1000} placeholder="Ex.: nota fiscal sem a identificação do projeto" className={CAMPO} autoFocus={!glosa} />
        </label>
        <label>
          <span className={ROTULO}>Valor (R$)</span>
          <InputValor value={valor} onChange={setValor} placeholder="0,00" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Data-base da atualização</span>
          <input type="date" value={dataBase} onChange={e => setDataBase(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <div className="sm:col-span-2">
          <Opcoes rotulo="Situação" valor={situacao} onChange={setSituacao} opcoes={[{ id: "mantida", rotulo: "Mantida" }, { id: "revertida", rotulo: "Revertida" }]} />
        </div>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Observações</span>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={1000} className={AREA} />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

// ─── Recurso ────────────────────────────────────────────────────────────────

export function RecursoModal({ prestacaoId, organizationId, recurso, decisoes, onClose, onSaved }: Base & {
  recurso: PrestacaoRecurso | null;
  decisoes: readonly PrestacaoDecisao[];
}) {
  const { gravar, abrir, salvando, erro, setErro } = useGravar("prestacao_recursos");
  const recorriveis = decisoes.filter(d => d.instancia === "analise" && d.resultado !== "aprovada");
  const [decisaoId, setDecisaoId] = useState(recurso?.decisao_id ?? recorriveis[0]?.id ?? "");
  const [protocoladoEm, setProtocoladoEm] = useState(recurso?.protocolado_em ?? "");
  const [pedido, setPedido] = useState(recurso?.pedido ?? "");
  const [situacao, setSituacao] = useState<PrestacaoRecurso["situacao"]>(recurso?.situacao ?? "em_analise");
  const [decididoEm, setDecididoEm] = useState(recurso?.decidido_em ?? "");
  const [resumo, setResumo] = useState(recurso?.resultado_resumo ?? "");
  const [documento, setDocumento] = useState(arquivoDe(recurso?.documento_path, recurso?.documento_nome));
  const [decisaoArquivo, setDecisaoArquivo] = useState(arquivoDe(recurso?.decisao_path, recurso?.decisao_nome));
  const decisao = decisoes.find(d => d.id === decisaoId);

  async function salvar() {
    const problema = erroDoRecurso({ decisaoId, protocoladoEm, situacao, decididoEm });
    if (problema) { setErro(problema); return; }
    const decidido = situacao !== "em_analise";
    const ok = await gravar({
      prestacaoId, organizationId, id: recurso?.id ?? null,
      arquivos: { documento, decisao: decidido ? decisaoArquivo : { path: null, nome: null, novo: null } },
      antigos: [recurso?.documento_path, recurso?.decisao_path],
      linha: {
        decisao_id: decisaoId, protocolado_em: protocoladoEm, pedido: pedido.trim() || null, situacao,
        decidido_em: decidido ? decididoEm || null : null, resultado_resumo: decidido ? resumo.trim() || null : null,
      },
      padrao: "Não foi possível salvar o recurso",
    });
    if (ok) onSaved();
  }

  return (
    <ModalPrestacao
      titulo={recurso ? "Editar recurso" : "Registrar recurso"}
      subtitulo="Contra a decisão, dentro do prazo do regime"
      onClose={onClose}
      rodape={<RodapeDoModal salvando={salvando} rotulo={recurso ? "Salvar" : "Registrar recurso"} onCancelar={onClose} onSalvar={salvar} />}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={ROTULO}>Decisão recorrida</span>
          <Dropdown value={decisaoId} onChange={setDecisaoId} ariaLabel="Decisão recorrida" placeholder="Escolha a decisão"
            options={recorriveis.map(d => ({ value: d.id, label: `${ROTULO_DO_RESULTADO[d.resultado]} · ${dataBr(d.registrada_em)}${d.valor_glosado ? ` · ${reais(d.valor_glosado)} glosados` : ""}` }))} />
          {decisao?.prazo_recurso && <p className="mt-1 text-[0.625rem] text-black/45">Prazo do regime: até {dataBr(decisao.prazo_recurso)}.</p>}
        </div>
        <label>
          <span className={ROTULO}>Protocolado em</span>
          <input type="date" value={protocoladoEm} onChange={e => setProtocoladoEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <CampoArquivo rotulo="Documento do recurso" arquivo={documento} onChange={setDocumento} onAbrir={abrir} />
        <label className="sm:col-span-2">
          <span className={ROTULO}>Pedido</span>
          <textarea value={pedido} onChange={e => setPedido(e.target.value)} rows={3} maxLength={4000} className={AREA} />
        </label>
        <div className="sm:col-span-2">
          <Opcoes rotulo="Resultado" valor={situacao} onChange={setSituacao}
            opcoes={(Object.keys(ROTULO_DO_RECURSO) as PrestacaoRecurso["situacao"][]).map(id => ({ id, rotulo: ROTULO_DO_RECURSO[id] }))} />
        </div>
        {situacao !== "em_analise" && (
          <>
            <label>
              <span className={ROTULO}>Decidido em</span>
              <input type="date" value={decididoEm} onChange={e => setDecididoEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
            </label>
            <CampoArquivo rotulo="Documento da decisão do recurso" arquivo={decisaoArquivo} onChange={setDecisaoArquivo} onAbrir={abrir} />
            <label className="sm:col-span-2">
              <span className={ROTULO}>Resumo da decisão</span>
              <textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={2} maxLength={4000} className={AREA} />
            </label>
          </>
        )}
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
