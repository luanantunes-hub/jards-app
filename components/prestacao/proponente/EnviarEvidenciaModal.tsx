"use client";

// O proponente envia uma evidência da própria prestação (P5.4): foto, vídeo,
// lista de presença ou link, de preferência ligada a uma atividade. Da foto, a
// data e o lugar saem do próprio arquivo, como na equipe.

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { lerFotoNoNavegador } from "@/lib/prestacao/evidencias";
import { erroDaEvidencia, EVIDENCIAS_DO_PROPONENTE } from "@/lib/prestacao/proponente";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";

export function EnviarEvidenciaModal({ prestacaoId, organizationId, atividades, onClose, onEnviada }: {
  prestacaoId: string;
  organizationId: string;
  atividades: { id: string; titulo: string; data_realizacao: string | null }[];
  onClose: () => void;
  onEnviada: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tipo, setTipo] = useState("foto");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const [atividadeId, setAtividadeId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const link = tipo === "link";

  async function enviar() {
    const problema = erroDaEvidencia({ tipo, arquivo, url, descricao });
    if (problema) { setErro(problema); return; }
    setEnviando(true);
    setErro("");
    let caminho: string | null = null;
    let foto = { capturadaEm: null as string | null, latitude: null as number | null, longitude: null as number | null };
    if (!link && arquivo) {
      if (arquivo.type.startsWith("image/")) foto = await lerFotoNoNavegador(arquivo);
      caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "evidencias" }, nomeOriginal: arquivo.name });
      const subida = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined });
      if (subida.error) {
        setErro(`Não foi possível enviar o arquivo: ${subida.error.message}`);
        setEnviando(false);
        return;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_proponente_enviar_evidencia", {
      p_prestacao_id: prestacaoId,
      p_tipo: tipo,
      p_descricao: descricao.trim(),
      p_storage_path: caminho,
      p_nome_arquivo: link ? null : arquivo?.name ?? null,
      p_mime_type: link ? null : arquivo?.type || null,
      p_tamanho_bytes: link ? null : arquivo?.size ?? null,
      p_url: link ? url.trim() : null,
      p_atividade_id: atividadeId || null,
      p_capturada_em: foto.capturadaEm,
      p_latitude: foto.latitude,
      p_longitude: foto.longitude,
    });
    if (error) {
      if (caminho) await supabase.storage.from("documentos").remove([caminho]);
      setErro(mensagemErroPrestacao(error, "Não foi possível registrar a evidência"));
      setEnviando(false);
      return;
    }
    onEnviada();
    onClose();
  }

  const rodape = (
    <>
      <span />
      <div className="flex items-center gap-4">
        <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
        <button type="button" onClick={enviar} disabled={enviando}
          className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
          {enviando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
          Enviar evidência
        </button>
      </div>
    </>
  );

  return (
    <ModalPrestacao titulo="Enviar evidência" subtitulo="Fotos, vídeos, listas de presença e matérias que mostram o projeto acontecendo" onClose={onClose} rodape={rodape} largura="max-w-[34rem]">
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown value={tipo} ariaLabel="Tipo de evidência" onChange={setTipo}
            options={EVIDENCIAS_DO_PROPONENTE.map(e => ({ value: e.id, label: e.rotulo }))} />
        </div>
        {atividades.length > 0 && (
          <div>
            <span className={ROTULO}>Atividade (opcional)</span>
            <Dropdown value={atividadeId} ariaLabel="Atividade da evidência" onChange={setAtividadeId} placeholder="Nenhuma"
              options={[{ value: "", label: "Nenhuma" }, ...atividades.map(a => ({ value: a.id, label: a.titulo }))]} />
          </div>
        )}
        {link ? (
          <label className="sm:col-span-2">
            <span className={ROTULO}>Endereço</span>
            <input value={url} onChange={e => setUrl(e.target.value)} inputMode="url" placeholder="https://" className={CAMPO} />
          </label>
        ) : (
          <div className="sm:col-span-2">
            <span className={ROTULO}>Arquivo (até 15 MB)</span>
            <input type="file" className="sr-only" id="arquivo-evidencia" accept="image/*,video/*,.pdf"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            <label htmlFor="arquivo-evidencia"
              className="flex h-10 cursor-pointer items-center gap-2 rounded border border-dashed border-black/[.18] bg-white px-3 text-[0.75rem] text-black/60 transition hover:bg-black/[.03] focus-within:outline-2 focus-within:outline-[#7259B5]">
              <Paperclip size={14} aria-hidden /> <span className="truncate">{arquivo ? arquivo.name : "Escolher arquivo"}</span>
            </label>
          </div>
        )}
        <label className="sm:col-span-2">
          <span className={ROTULO}>O que mostra</span>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={1000}
            placeholder="Ex.: público na oficina de sábado"
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
