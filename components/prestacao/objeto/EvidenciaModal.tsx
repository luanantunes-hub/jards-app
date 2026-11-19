"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Link2, MapPin, ShieldAlert, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { checarEvidencias } from "@/lib/prestacao/checagens/checar-evidencias";
import type { AtividadeDoEstado, LocalDoEstado } from "@/lib/prestacao/checagens";
import {
  lerFotoNoNavegador,
  linkDoMapa,
  quandoFoiTirada,
  REQUISITOS_EVIDENCIA,
  TIPOS_EVIDENCIA,
  tipoPeloArquivo,
  type RequisitoEvidencia,
  type TipoEvidencia,
} from "@/lib/prestacao/evidencias";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { descreverPistas, pistasDosTextos, textosDaEvidencia } from "@/lib/prestacao/dados-sensiveis";
import { rotuloDoLocal } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoAtividade, PrestacaoEvidencia, PrestacaoMeta } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

export type AtividadeParaEvidencia = AtividadeDoEstado & Pick<PrestacaoAtividade, "meta_id">;

/**
 * Cria ou edita uma evidência: o arquivo (ou um link), o tipo, a que meta,
 * atividade e local ela serve e os requisitos que atende. Da foto, a data e a
 * posição são lidas na hora e conferidas com a execução, a atividade e o local.
 */
export function EvidenciaModal({ prestacaoId, organizationId, evidencia, inicial, atividades, metas, locais, execucao, saude = false, onClose, onSaved }: {
  prestacaoId: string;
  organizationId: string | null;
  evidencia: PrestacaoEvidencia | null;
  /** Vínculos já escolhidos quando a evidência nasce de uma atividade. */
  inicial?: Partial<Pick<PrestacaoEvidencia, "atividade_id" | "meta_id" | "local_id">>;
  atividades: readonly AtividadeParaEvidencia[];
  metas: readonly Pick<PrestacaoMeta, "id" | "descricao">[];
  locais: readonly LocalDoEstado[];
  execucao: { data_inicio_execucao: string | null; data_fim_execucao: string | null };
  /** Saúde (P9.5): dado de paciente é sensível; o modal avisa e confere o documento clínico. */
  saude?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<"arquivo" | "link">(evidencia?.url && !evidencia.storage_path ? "link" : "arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [url, setUrl] = useState(evidencia?.url ?? "");
  const [tipo, setTipo] = useState<TipoEvidencia>(evidencia?.tipo ?? "foto");
  const [atividadeId, setAtividadeId] = useState(evidencia?.atividade_id ?? inicial?.atividade_id ?? "");
  const [metaId, setMetaId] = useState(evidencia?.meta_id ?? inicial?.meta_id ?? "");
  const [localId, setLocalId] = useState(evidencia?.local_id ?? inicial?.local_id ?? "");
  const [requisitos, setRequisitos] = useState<Set<RequisitoEvidencia>>(new Set(evidencia?.requisitos ?? ["alcance_objeto"]));
  const [descricao, setDescricao] = useState(evidencia?.descricao ?? "");
  const [capturadaEm, setCapturadaEm] = useState(evidencia?.capturada_em?.slice(0, 16) ?? "");
  const [posicao, setPosicao] = useState<{ latitude: number; longitude: number } | null>(
    evidencia?.latitude !== null && evidencia?.latitude !== undefined && evidencia.longitude !== null
      ? { latitude: Number(evidencia.latitude), longitude: Number(evidencia.longitude) } : null);
  const [origem, setOrigem] = useState<PrestacaoEvidencia["origem_dados"]>(evidencia?.origem_dados ?? null);
  const [justificativa, setJustificativa] = useState(evidencia?.justificativa ?? "");
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function escolherArquivo(f: File) {
    setArquivo(f);
    setErro("");
    const sugerido = tipoPeloArquivo(f.type, f.name);
    setTipo(sugerido);
    if (sugerido !== "foto") return;
    setLendo(true);
    const lido = await lerFotoNoNavegador(f);
    setLendo(false);
    setCapturadaEm(lido.capturadaEm?.slice(0, 16) ?? "");
    setPosicao(lido.latitude !== null && lido.longitude !== null ? { latitude: lido.latitude, longitude: lido.longitude } : null);
    setOrigem(lido.capturadaEm || lido.latitude !== null ? "arquivo" : null);
  }

  function escolherAtividade(valor: string) {
    setAtividadeId(valor);
    // A meta e o local da atividade entram quando a evidência ainda não tem os seus.
    const a = atividades.find(x => x.id === valor);
    if (a?.meta_id && !metaId) setMetaId(a.meta_id);
    if (a?.local_id && !localId) setLocalId(a.local_id);
  }

  // A mesma conferência do motor, só com esta evidência.
  const alertas = useMemo(() => checarEvidencias({
    regime: null, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    prestacao: execucao, atividades, locais,
    evidencias: [{
      id: evidencia?.id ?? "nova", tipo, nome_arquivo: arquivo?.name ?? evidencia?.nome_arquivo ?? null, url: url || null,
      atividade_id: atividadeId || null, meta_id: metaId || null, local_id: localId || null,
      capturada_em: capturadaEm ? `${capturadaEm}:00`.slice(0, 19) : null,
      latitude: posicao?.latitude ?? null, longitude: posicao?.longitude ?? null, justificativa: null,
    }],
  }), [execucao, atividades, locais, evidencia, tipo, arquivo, url, atividadeId, metaId, localId, capturadaEm, posicao]);

  async function salvar() {
    setErro("");
    const novoArquivo = modo === "arquivo" && !evidencia?.storage_path;
    if (novoArquivo && !arquivo) { setErro("Escolha o arquivo da evidência."); return; }
    if (modo === "link" && !/^https?:\/\/\S+$/i.test(url.trim())) { setErro("Informe um link que comece com http:// ou https://."); return; }
    if (novoArquivo && !organizationId) { setErro("Aguarde: a prestação ainda está carregando."); return; }
    setSalvando(true);
    const campos = {
      tipo,
      requisitos: [...requisitos],
      atividade_id: atividadeId || null,
      meta_id: metaId || null,
      local_id: localId || null,
      descricao: descricao.trim() || null,
      capturada_em: capturadaEm ? `${capturadaEm}:00`.slice(0, 19) : null,
      latitude: posicao?.latitude ?? null,
      longitude: posicao?.longitude ?? null,
      origem_dados: capturadaEm || posicao ? origem ?? "informado" : null,
      justificativa: justificativa.trim() || null,
      ...(modo === "link" ? { url: url.trim() } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas do objeto ainda não estão no tipo Database
    const tabela = (supabase as any).from("prestacao_evidencias");
    if (evidencia) {
      const { error } = await tabela.update(campos).eq("id", evidencia.id);
      setSalvando(false);
      if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível salvar a evidência")); return; }
      onSaved();
      return;
    }
    let caminho: string | null = null;
    if (novoArquivo && arquivo && organizationId) {
      caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "evidencias" }, nomeOriginal: arquivo.name });
      const { error } = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (error) { setSalvando(false); setErro(mensagemErroPrestacao(error, "Não foi possível enviar o arquivo")); return; }
    }
    const { error } = await tabela.insert({
      ...campos,
      prestacao_id: prestacaoId,
      ...(caminho && arquivo ? { storage_path: caminho, nome_arquivo: arquivo.name, mime_type: arquivo.type || null, tamanho_bytes: arquivo.size } : {}),
    });
    setSalvando(false);
    if (error) {
      if (caminho) await supabase.storage.from("documentos").remove([caminho]);
      setErro(mensagemErroPrestacao(error, "Não foi possível registrar a evidência"));
      return;
    }
    onSaved();
  }

  // Saúde (P9.5): o nome do arquivo ou a descrição com cara de prontuário, laudo ou CID.
  const pistas = saude ? pistasDosTextos(textosDaEvidencia({ nome_arquivo: arquivo?.name ?? evidencia?.nome_arquivo ?? null, descricao }), { estrito: true }) : [];
  const mostrarJustificativa = alertas.some(a => a.codigo !== "EVIDENCIA_SEM_VINCULO") || pistas.length > 0 || justificativa.trim().length > 0;
  const opcoesAtividade = [{ value: "", label: "Sem atividade" }, ...atividades.map(a => ({ value: a.id, label: a.titulo }))];
  const opcoesMeta = [{ value: "", label: "Sem meta" }, ...metas.map(m => ({ value: m.id, label: m.descricao }))];
  const opcoesLocal = [{ value: "", label: "Sem local" }, ...locais.map(l => ({ value: l.id, label: rotuloDoLocal(l) }))];

  return (
    <ModalPrestacao
      titulo={evidencia ? "Editar evidência" : "Nova evidência"}
      subtitulo="O que comprova a realização do objeto"
      onClose={onClose}
      largura="max-w-[38rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || lendo}
            className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {evidencia ? "Salvar" : "Adicionar evidência"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        {!evidencia && (
          <div className="sm:col-span-2">
            <div role="group" aria-label="Arquivo ou link" className="mb-2 flex gap-1">
              {([["arquivo", "Arquivo", Upload], ["link", "Link", Link2]] as const).map(([valor, rotulo, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={modo === valor}
                  onClick={() => { setModo(valor); if (valor === "link") setTipo("link"); }}
                  className={`flex h-9 items-center gap-1.5 rounded border px-3 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${modo === valor ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.08] text-black/45 hover:bg-black/[.03]"}`}
                >
                  <Icone size={13} aria-hidden /> {rotulo}
                </button>
              ))}
            </div>
            {modo === "arquivo" ? (
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                className="flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded border border-dashed border-black/[.16] bg-white px-4 py-3 text-[0.75rem] text-black/55 transition hover:bg-black/[.02] focus-visible:outline-2 focus-visible:outline-[#7259B5]"
              >
                {arquivo ? <span className="font-medium text-black/75">{arquivo.name}</span> : <span>Escolher foto, vídeo ou PDF</span>}
                <span className="text-[0.625rem] text-black/35">{lendo ? "Lendo a data e o local da foto…" : "No celular, a câmera abre aqui"}</span>
              </button>
            ) : (
              <label className="block">
                <span className="sr-only">Link</span>
                <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" placeholder="https://… (vídeo, matéria, post)" className={CAMPO} />
              </label>
            )}
            <input
              ref={arquivoRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,application/pdf"
              aria-label="Arquivo da evidência"
              onChange={e => { const f = e.target.files?.[0]; if (f) escolherArquivo(f); e.target.value = ""; }}
            />
          </div>
        )}
        <label>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={v => setTipo(v as TipoEvidencia)} ariaLabel="Tipo de evidência" options={TIPOS_EVIDENCIA.map(t => ({ value: t.id, label: t.rotulo }))} />
        </label>
        <label>
          <span className={ROTULO}>Atividade</span>
          <Dropdown value={atividadeId} onChange={escolherAtividade} ariaLabel="Atividade da evidência" options={opcoesAtividade} />
        </label>
        <label>
          <span className={ROTULO}>Meta</span>
          <Dropdown value={metaId} onChange={setMetaId} ariaLabel="Meta da evidência" options={opcoesMeta} />
        </label>
        <label>
          <span className={ROTULO}>Local</span>
          <Dropdown value={localId} onChange={setLocalId} ariaLabel="Local da evidência" options={opcoesLocal} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={ROTULO}>Comprova</legend>
          <div className="flex flex-wrap gap-1.5">
            {REQUISITOS_EVIDENCIA.map(r => {
              const ativo = requisitos.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setRequisitos(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                  className={`h-8 rounded border px-2.5 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${ativo ? "border-[#7259B5]/40 text-[#7259B5]" : "border-black/[.08] text-black/45 hover:bg-black/[.03]"}`}
                >
                  {r.rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label>
          <span className={ROTULO}>Data e hora {origem === "arquivo" && capturadaEm ? "(lidas da foto)" : ""}</span>
          <input
            type="datetime-local"
            value={capturadaEm}
            onChange={e => { setCapturadaEm(e.target.value); setOrigem("informado"); }}
            className={CAMPO}
          />
        </label>
        <div>
          <span className={ROTULO}>Posição</span>
          {posicao ? (
            <a href={linkDoMapa(posicao.latitude, posicao.longitude)} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1.5 text-[0.75rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
              <MapPin size={13} aria-hidden /> <span className="tabular-nums">{posicao.latitude.toFixed(4)}, {posicao.longitude.toFixed(4)}</span>
            </a>
          ) : (
            <p className="flex h-10 items-center text-[0.75rem] text-black/35">{tipo === "foto" ? "A foto não trouxe posição" : "—"}</p>
          )}
        </div>
        <label className="sm:col-span-2">
          <span className={ROTULO}>Descrição (opcional)</span>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={1000} placeholder="O que aparece e por que comprova" className={AREA} />
        </label>
        {saude && (
          <p className="flex items-start gap-2 text-[0.6875rem] leading-relaxed text-black/50 sm:col-span-2">
            <ShieldAlert size={13} aria-hidden className="mt-0.5 shrink-0 text-black/40" />
            Dado de paciente é sensível: prontuário, laudo e exame não entram aqui. Foto e lista de presença só com a autorização de quem aparece; depois da guarda, elas saem no descarte dos dados pessoais.
          </p>
        )}
        {pistas.length > 0 && (
          <p role="status" className="flex items-start gap-2 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B07A14] sm:col-span-2" style={{ borderColor: "#B07A1447" }}>
            <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden /> Parece documento clínico ({descreverPistas(pistas)}): não envie documento de paciente, ou justifique se não é.
          </p>
        )}
        {alertas.length > 0 && (
          <ul className="space-y-1.5 sm:col-span-2" aria-label="Conferência da evidência">
            {alertas.map(a => (
              <li key={a.chave} className="flex items-start gap-2 rounded border bg-white px-3 py-2 text-[0.6875rem] text-[#B07A14]" style={{ borderColor: "#B07A1447" }}>
                <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden /> {a.mensagem}
              </li>
            ))}
          </ul>
        )}
        {mostrarJustificativa && (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Justificativa (para seguir com o alerta)</span>
            <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2} maxLength={2000} placeholder="Ex.: ensaio aberto dois dias antes, no mesmo espaço" className={AREA} />
          </label>
        )}
        {evidencia && capturadaEm && <p className="text-[0.625rem] text-black/35 sm:col-span-2">Tirada em {quandoFoiTirada(`${capturadaEm}:00`)}.</p>}
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
