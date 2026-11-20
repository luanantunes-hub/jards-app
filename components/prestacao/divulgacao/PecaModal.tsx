"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Paperclip, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import {
  defesosDaPeca,
  erroDaPeca,
  MARCA_FORA_DO_DEFESO,
  situacaoDaAprovacao,
  STATUS_APROVACAO,
  TIPOS_PECA,
  type DefesoEleitoral,
  type StatusAprovacao,
  type TipoPeca,
} from "@/lib/prestacao/pecas";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import type { DivulgacaoRegime } from "@/lib/prestacao/regimes/tipos";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoPeca } from "@/lib/supabase/types";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const AREA = "w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Cria ou edita uma peça: o que é, onde e quando circulou, as marcas, a aprovação e a amostra. */
export function PecaModal({ prestacaoId, organizationId, peca, regime, divulgacao, defesos, onClose, onSaved }: {
  prestacaoId: string;
  organizationId: string | null;
  peca: PrestacaoPeca | null;
  regime: RegimeNormativo | null;
  divulgacao: DivulgacaoRegime | null;
  defesos: readonly DefesoEleitoral[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const entrada = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState(peca?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoPeca>(peca?.tipo ?? "cartaz");
  const [meio, setMeio] = useState(peca?.meio ?? "");
  const [inicio, setInicio] = useState(peca?.veiculacao_inicio ?? "");
  const [fim, setFim] = useState(peca?.veiculacao_fim ?? "");
  const [marcas, setMarcas] = useState<string[]>(peca?.marcas ?? []);
  const [status, setStatus] = useState<StatusAprovacao>(peca?.aprovacao_status ?? "nao_enviada");
  const [protocolo, setProtocolo] = useState(peca?.aprovacao_protocolo ?? "");
  const [enviadaEm, setEnviadaEm] = useState(peca?.aprovacao_enviada_em ?? "");
  const [decididaEm, setDecididaEm] = useState(peca?.aprovacao_decidida_em ?? "");
  const [url, setUrl] = useState(peca?.url ?? "");
  const [arquivo, setArquivo] = useState<{ path: string | null; nome: string | null; novo: File | null }>({ path: peca?.storage_path ?? null, nome: peca?.nome_arquivo ?? null, novo: null });
  const [justificativa, setJustificativa] = useState(peca?.justificativa ?? "");
  const [observacoes, setObservacoes] = useState(peca?.observacoes ?? "");
  const [maisDetalhes, setMaisDetalhes] = useState(Boolean(peca?.observacoes || peca?.justificativa));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Marcas do regime e as que a peça já tinha fora dele.
  const opcoesDeMarca = useMemo(() => [...(divulgacao?.marcas ?? []), ...marcas.filter(m => !(divulgacao?.marcas ?? []).includes(m))], [divulgacao, marcas]);
  const noDefeso = divulgacao?.defeso ? defesosDaPeca({ veiculacao_inicio: inicio || null, veiculacao_fim: fim || null }, defesos)[0] ?? null : null;
  const situacao = situacaoDaAprovacao(
    { aprovacao_status: status, aprovacao_enviada_em: enviadaEm || null, aprovacao_decidida_em: decididaEm || null },
    regime,
    new Date().toISOString().slice(0, 10),
  );

  function alternarMarca(m: string) {
    setMarcas(atual => atual.includes(m) ? atual.filter(x => x !== m) : [...atual, m]);
  }

  async function abrirArquivo() {
    if (!arquivo.path) return;
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(arquivo.path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  async function salvar() {
    const campos = {
      tipo,
      titulo: titulo.trim(),
      meio: meio.trim() || null,
      veiculacao_inicio: inicio || null,
      veiculacao_fim: fim || null,
      marcas,
      aprovacao_status: status,
      aprovacao_protocolo: status === "nao_enviada" ? null : protocolo.trim() || null,
      aprovacao_enviada_em: status === "nao_enviada" ? null : enviadaEm || null,
      aprovacao_decidida_em: status === "aprovada" || status === "reprovada" ? decididaEm || null : null,
      url: url.trim() || null,
      justificativa: justificativa.trim() || null,
      observacoes: observacoes.trim() || null,
    };
    const problema = erroDaPeca(campos);
    if (problema) { setErro(problema); return; }
    if (arquivo.novo && !organizationId) { setErro("Aguarde: a prestação ainda está carregando."); return; }
    setSalvando(true);
    setErro("");

    let caminho = arquivo.path;
    let enviado: string | null = null;
    if (arquivo.novo) {
      caminho = montarCaminhoPrestacao({ organizationId: organizationId!, prestacaoId, pasta: { tipo: "pecas" }, nomeOriginal: arquivo.novo.name });
      const { error } = await supabase.storage.from("documentos").upload(caminho, arquivo.novo, { upsert: false, contentType: arquivo.novo.type || undefined });
      if (error) { setSalvando(false); setErro(`Não foi possível enviar "${arquivo.novo.name}": ${error.message}`); return; }
      enviado = caminho;
    }
    const linha = {
      ...campos,
      storage_path: caminho,
      nome_arquivo: arquivo.novo?.name ?? (caminho ? arquivo.nome : null),
      mime_type: arquivo.novo ? arquivo.novo.type || null : caminho ? peca?.mime_type ?? null : null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_pecas ainda não está no tipo Database
    const tabela = (supabase as any).from("prestacao_pecas");
    const { error } = peca
      ? await tabela.update(linha).eq("id", peca.id)
      : await tabela.insert({ ...linha, prestacao_id: prestacaoId });
    if (error) {
      if (enviado) await supabase.storage.from("documentos").remove([enviado]);
      setSalvando(false);
      setErro(mensagemErroPrestacao(error, "Não foi possível salvar a peça"));
      return;
    }
    // A amostra trocada ou tirada deixa o bucket.
    if (peca?.storage_path && peca.storage_path !== caminho) await supabase.storage.from("documentos").remove([peca.storage_path]);
    setSalvando(false);
    onSaved();
  }

  return (
    <ModalPrestacao
      titulo={peca ? "Editar peça" : "Nova peça"}
      subtitulo="Peça de divulgação: marcas, aprovação prévia e amostra"
      onClose={onClose}
      largura="max-w-[36rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded acao-salvar px-5 py-2 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            {peca ? "Salvar" : "Adicionar peça"}
          </button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ROTULO}>Peça</span>
          <input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={200} placeholder="Ex.: Cartaz da estreia" className={CAMPO} autoFocus={!peca} />
        </label>
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} onChange={v => setTipo(v as TipoPeca)} ariaLabel="Tipo da peça" options={TIPOS_PECA.map(t => ({ value: t.id, label: t.rotulo }))} />
        </div>
        <label>
          <span className={ROTULO}>Onde circulou</span>
          <input value={meio} onChange={e => setMeio(e.target.value)} maxLength={300} placeholder="Ex.: Instagram @projeto, metrô" className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Início da veiculação</span>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Fim da veiculação</span>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>

        <fieldset className="rounded border p-3 sm:col-span-2" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <legend className="px-1 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">Marcas na peça</legend>
          {opcoesDeMarca.length === 0 ? (
            <p className="text-[0.6875rem] text-black/45">O regime desta prestação não lista marcas obrigatórias.</p>
          ) : (
            <div className="space-y-1.5">
              {opcoesDeMarca.map(m => {
                const sai = Boolean(noDefeso) && MARCA_FORA_DO_DEFESO.test(m);
                return (
                  <label key={m} className="flex cursor-pointer items-center gap-2 text-[0.75rem] text-black/75">
                    <input type="checkbox" checked={marcas.includes(m)} onChange={() => alternarMarca(m)} className="h-4 w-4 accent-[#7259B5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" />
                    {m}{sai && <span className="text-[0.625rem] text-[#B07A14]">sai no defeso</span>}
                  </label>
                );
              })}
            </div>
          )}
          {noDefeso && (
            <p className="mt-2 text-[0.6875rem] text-[#B07A14]">
              A peça circula no defeso eleitoral ({dataBr(noDefeso.inicio)} a {dataBr(noDefeso.fim)}): use a versão de defeso das marcas. {divulgacao?.defeso?.descricao}
            </p>
          )}
        </fieldset>

        <div className="sm:col-span-2">
          <span className={ROTULO}>Aprovação prévia</span>
          <Dropdown value={status} onChange={v => setStatus(v as StatusAprovacao)} ariaLabel="Aprovação prévia da peça" options={STATUS_APROVACAO.map(s => ({ value: s.id, label: s.rotulo }))} />
          <p className="mt-1 text-[0.625rem] text-black/40">
            {divulgacao?.aprovacaoPrevia.exigida ? divulgacao.aprovacaoPrevia.descricao : "O regime desta prestação não pede aprovação prévia das peças."}
            {status !== "nao_enviada" && ` ${situacao.texto}.`}
          </p>
        </div>
        {status !== "nao_enviada" && (
          <>
            <label>
              <span className={ROTULO}>Enviada em</span>
              <input type="date" value={enviadaEm} onChange={e => setEnviadaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
            </label>
            <label>
              <span className={ROTULO}>Protocolo</span>
              <input value={protocolo} onChange={e => setProtocolo(e.target.value)} maxLength={100} placeholder="Nº no sistema do órgão" className={CAMPO} />
            </label>
          </>
        )}
        {(status === "aprovada" || status === "reprovada") && (
          <label>
            <span className={ROTULO}>{status === "aprovada" ? "Aprovada em" : "Recusada em"}</span>
            <input type="date" value={decididaEm} onChange={e => setDecididaEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
          </label>
        )}

        <div className="sm:col-span-2">
          <span className={ROTULO}>Amostra</span>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={entrada} type="file" accept="image/*,application/pdf,video/*,audio/*" aria-label="Arquivo da peça" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setArquivo(a => ({ ...a, novo: f })); e.target.value = ""; }} />
            {arquivo.novo || arquivo.path ? (
              <span className="flex min-w-0 items-center gap-1.5">
                {arquivo.path && !arquivo.novo
                  ? <button type="button" onClick={abrirArquivo} className="truncate text-[0.6875rem] text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]">{arquivo.nome || "Arquivo"}</button>
                  : <span className="truncate text-[0.6875rem] text-black/65">{arquivo.novo?.name}</span>}
                <button type="button" onClick={() => setArquivo({ path: null, nome: null, novo: null })} aria-label="Tirar o arquivo da peça" className="rounded p-1 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><X size={12} /></button>
              </span>
            ) : (
              <button type="button" onClick={() => entrada.current?.click()} className="flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5]" style={{ borderColor: "rgba(13,13,13,.14)" }}>
                <Paperclip size={12} aria-hidden /> Anexar arquivo
              </button>
            )}
            <span className="text-[0.625rem] text-black/35">ou</span>
            <input value={url} onChange={e => setUrl(e.target.value)} aria-label="Link da publicação" placeholder="https://… (link da publicação)" className={`${CAMPO} min-w-[12rem] flex-1`} />
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={() => setMaisDetalhes(v => !v)}
            aria-expanded={maisDetalhes}
            className="flex items-center gap-1 rounded py-1 text-[0.6875rem] text-black/50 transition hover:text-black/75 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
          >
            <ChevronDown size={12} aria-hidden className={`transition-transform motion-reduce:transition-none ${maisDetalhes ? "rotate-180" : ""}`} />
            Mais detalhes
          </button>
          {maisDetalhes && (
            <div className="mt-2 space-y-3">
              <label className="block">
                <span className={ROTULO}>Justificativa</span>
                <textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} rows={2} maxLength={2000} placeholder="Para um aviso da conferência: por que a peça circulou assim" className={AREA} />
              </label>
              <label className="block">
                <span className={ROTULO}>Observações</span>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} maxLength={1000} className={AREA} />
              </label>
            </div>
          )}
        </div>
        {erro && <p role="alert" className="text-[0.75rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
