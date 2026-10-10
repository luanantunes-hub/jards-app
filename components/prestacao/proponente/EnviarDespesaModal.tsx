"use client";

// O proponente envia uma despesa da própria prestação (P5.4): o arquivo vai
// para a pasta de comprovantes e a função do banco registra a despesa, que
// entra em análise e avisa quem responde pela prestação.

import { useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";
import { InputValor } from "@/components/ui/CampoValor";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { DOCUMENTOS_DO_PROPONENTE, erroDaDespesa } from "@/lib/prestacao/proponente";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { lerValorBRL } from "@/lib/valor";

const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const hojeIso = () => new Date().toLocaleDateString("sv-SE");

export function EnviarDespesaModal({ prestacaoId, organizationId, onClose, onEnviada }: {
  prestacaoId: string;
  organizationId: string;
  onClose: () => void;
  onEnviada: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const hoje = hojeIso();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [tipo, setTipo] = useState("nfse");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [numero, setNumero] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar() {
    const problema = erroDaDespesa({ arquivo, tipo, valor, data, descricao, numero }, hoje);
    if (problema || !arquivo) { setErro(problema ?? "Escolha o arquivo do documento."); return; }
    setEnviando(true);
    setErro("");
    const caminho = montarCaminhoPrestacao({ organizationId, prestacaoId, pasta: { tipo: "comprovantes" }, nomeOriginal: arquivo.name });
    const subida = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || undefined });
    if (subida.error) {
      setErro(`Não foi possível enviar o arquivo: ${subida.error.message}`);
      setEnviando(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função nova, ainda fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_proponente_enviar_despesa", {
      p_prestacao_id: prestacaoId,
      p_storage_path: caminho,
      p_nome_arquivo: arquivo.name,
      p_tipo: tipo,
      p_valor: lerValorBRL(valor).valor,
      p_data_doc: data,
      p_descricao: descricao.trim(),
      p_numero_documento: numero.trim() || null,
    });
    if (error) {
      await supabase.storage.from("documentos").remove([caminho]);
      setErro(mensagemErroPrestacao(error, "Não foi possível registrar a despesa"));
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
          Enviar despesa
        </button>
      </div>
    </>
  );

  return (
    <ModalPrestacao titulo="Enviar despesa" subtitulo="A equipe confere antes de entrar na prestação" onClose={onClose} rodape={rodape} largura="max-w-[34rem]">
      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className={ROTULO}>Arquivo (PDF, XML ou imagem, até 15 MB)</span>
          <input type="file" accept=".pdf,.xml,image/*" className="sr-only" id="arquivo-despesa"
            onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
          <label htmlFor="arquivo-despesa"
            className="flex h-10 cursor-pointer items-center gap-2 rounded border border-dashed border-black/[.18] bg-white px-3 text-[0.75rem] text-black/60 transition hover:bg-black/[.03] focus-within:outline-2 focus-within:outline-[#7259B5]">
            <Paperclip size={14} aria-hidden /> <span className="truncate">{arquivo ? arquivo.name : "Escolher arquivo"}</span>
          </label>
        </div>
        <div>
          <span className={ROTULO}>Tipo de documento</span>
          <Dropdown value={tipo} ariaLabel="Tipo de documento" onChange={setTipo}
            options={DOCUMENTOS_DO_PROPONENTE.map(d => ({ value: d.id, label: d.rotulo }))} />
        </div>
        <label>
          <span className={ROTULO}>Número (opcional)</span>
          <input value={numero} onChange={e => setNumero(e.target.value)} maxLength={60} className={CAMPO} />
        </label>
        <label>
          <span className={ROTULO}>Valor (R$)</span>
          <InputValor value={valor} onChange={setValor} placeholder="1.500,00" className={`${CAMPO} tabular-nums`} />
        </label>
        <label>
          <span className={ROTULO}>Data do documento</span>
          <input type="date" value={data} max={hoje} onChange={e => setData(e.target.value)} className={`${CAMPO} tabular-nums`} />
        </label>
        <label className="sm:col-span-2">
          <span className={ROTULO}>O que foi pago</span>
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} maxLength={500}
            placeholder="Ex.: sonorização do show de abertura"
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B] sm:col-span-2">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}
