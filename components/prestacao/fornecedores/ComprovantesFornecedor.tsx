"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FileText, Paperclip, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  ANEXO_FORNECEDOR_ACEITO,
  caminhoDocumentoFornecedor,
  extensaoDoAnexo,
  faltaCartaoCnpj,
  problemaDoAnexo,
  ROTULOS_DOCUMENTO_FORNECEDOR,
  TIPOS_ANEXO_FORNECEDOR,
  URL_CARTAO_CNPJ_RECEITA,
  type TipoDocumentoFornecedor,
} from "@/lib/prestacao/fornecedores";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import type { PrestacaoFornecedor, PrestacaoFornecedorDocumento } from "@/lib/supabase/types";

const dataHora = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const BOTAO_ICONE = "rounded p-2 text-black/35 transition hover:bg-black/[.04] hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-wait disabled:text-black/20";

async function sha256(arquivo: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Arquivos que provam a situação do fornecedor: a certidão do TCU e o
 * comprovante que cada consulta guarda (ficam como histórico) e os anexos de
 * quem edita, como o cartão CNPJ emitido no site da Receita.
 */
export function ComprovantesFornecedor({ fornecedor, podeEditar }: { fornecedor: PrestacaoFornecedor; podeEditar: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [documentos, setDocumentos] = useState<PrestacaoFornecedorDocumento[] | null>(null);
  const [erro, setErro] = useState("");
  const [anexando, setAnexando] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumentoFornecedor>("cartao_cnpj");
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState("");

  const buscar = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
    const { data, error } = await (supabase as any)
      .from("prestacao_fornecedor_documentos")
      .select("*")
      .eq("fornecedor_id", fornecedor.id)
      .order("created_at", { ascending: false });
    return { documentos: (data ?? []) as PrestacaoFornecedorDocumento[], erro: error ? mensagemErroPrestacao(error, "Não foi possível carregar os comprovantes") : "" };
  }, [fornecedor.id, supabase]);

  // Cada consulta grava sancoes_consultadas_em e guarda comprovantes novos: recarrega junto.
  useEffect(() => {
    let ativo = true;
    buscar().then(r => {
      if (!ativo) return;
      setDocumentos(r.documentos);
      setErro(r.erro);
    });
    return () => { ativo = false; };
  }, [buscar, fornecedor.sancoes_consultadas_em]);

  async function recarregar() {
    const r = await buscar();
    setDocumentos(r.documentos);
    if (r.erro) setErro(r.erro);
  }

  async function abrir(documento: PrestacaoFornecedorDocumento) {
    setErro("");
    setAbrindo(documento.id);
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(documento.storage_path, 300);
    setAbrindo("");
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  async function enviar(arquivo: File) {
    const problema = problemaDoAnexo(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    setEnviando(true);
    const caminho = caminhoDocumentoFornecedor(fornecedor.organization_id, fornecedor.id, extensaoDoAnexo(arquivo));
    const { error: erroEnvio } = await supabase.storage.from("documentos").upload(caminho, arquivo, { upsert: false, contentType: arquivo.type || "application/pdf" });
    if (erroEnvio) {
      setEnviando(false);
      setErro(`Não foi possível enviar o arquivo: ${erroEnvio.message}`);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
    const { error } = await (supabase as any).from("prestacao_fornecedor_documentos").insert({
      fornecedor_id: fornecedor.id,
      tipo,
      nome_arquivo: arquivo.name,
      storage_path: caminho,
      hash_sha256: await sha256(arquivo),
    });
    if (error) {
      // Sem registro, o arquivo não serve de comprovante: não deixa ele solto na pasta.
      await supabase.storage.from("documentos").remove([caminho]);
      setErro(mensagemErroPrestacao(error, "Não foi possível registrar o comprovante"));
    } else {
      setAnexando(false);
      await recarregar();
    }
    setEnviando(false);
  }

  function excluir(documento: PrestacaoFornecedorDocumento) {
    confirmDelete({
      title: "Excluir comprovante?",
      description: `"${documento.nome_arquivo}" sai dos comprovantes deste fornecedor.`,
      onConfirm: async () => {
        // A linha antes do arquivo: enquanto o registro existe, o bucket não deixa apagar o arquivo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela ainda não está no tipo Database
        const { error } = await (supabase as any).from("prestacao_fornecedor_documentos").delete().eq("id", documento.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir o comprovante"));
        await supabase.storage.from("documentos").remove([documento.storage_path]);
        await recarregar();
      },
    });
  }

  const semCartao = documentos !== null && faltaCartaoCnpj(fornecedor, documentos);

  return (
    <section aria-labelledby="comprovantes-titulo">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="comprovantes-titulo" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">
          Comprovantes{documentos && documentos.length > 0 ? ` (${documentos.length})` : ""}
        </h3>
        {podeEditar && !anexando && (
          <button type="button" onClick={() => { setErro(""); setAnexando(true); }} className="flex h-8 items-center gap-1.5 rounded px-2 text-[0.75rem] text-[#684DB0] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            <Paperclip size={13} aria-hidden /> Anexar
          </button>
        )}
      </div>

      {anexando && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border bg-black/[.02] p-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="w-full sm:w-[12rem]">
            <Dropdown
              value={tipo}
              onChange={v => setTipo(v as TipoDocumentoFornecedor)}
              options={TIPOS_ANEXO_FORNECEDOR.map(t => ({ value: t, label: ROTULOS_DOCUMENTO_FORNECEDOR[t] }))}
              ariaLabel="Tipo do comprovante"
              disabled={enviando}
            />
          </div>
          <input
            ref={arquivoRef}
            type="file"
            accept={ANEXO_FORNECEDOR_ACEITO}
            className="hidden"
            onChange={e => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) enviar(arquivo);
            }}
          />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setAnexando(false)} disabled={enviando} className="rounded px-2 py-2 text-[0.75rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:text-black/25">
              Cancelar
            </button>
            <button type="button" onClick={() => arquivoRef.current?.click()} disabled={enviando} className="h-9 rounded bg-[#2E8932] px-3 text-[0.75rem] text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-wait disabled:bg-[#2E8932]/60 motion-reduce:transform-none">
              {enviando ? "Enviando…" : "Escolher arquivo"}
            </button>
          </div>
          <p className="w-full text-[0.625rem] text-black/40">PDF ou imagem, até 10 MB.</p>
        </div>
      )}

      {erro && <p role="alert" className="mb-2 text-[0.75rem] text-[#B23B3B]">{erro}</p>}

      {documentos === null ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
          <div className="h-10 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />
        </div>
      ) : documentos.length === 0 ? (
        <p className="text-[0.75rem] text-black/45">
          Nenhum comprovante ainda. Cada consulta guarda a certidão do TCU e o registro do que a Receita devolveu.
        </p>
      ) : (
        <ul className="divide-y divide-black/[.05] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {documentos.map(d => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <FileText size={14} className="shrink-0 text-black/30" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.75rem] text-black/75" title={d.nome_arquivo}>{ROTULOS_DOCUMENTO_FORNECEDOR[d.tipo]}</p>
                <p className="truncate text-[0.625rem] text-black/40">
                  {d.origem === "consulta" ? "Guardado pela consulta" : "Anexado"} · {dataHora(d.created_at)} · {d.nome_arquivo}
                </p>
              </div>
              <button type="button" onClick={() => abrir(d)} disabled={abrindo === d.id} aria-label={`Abrir ${ROTULOS_DOCUMENTO_FORNECEDOR[d.tipo]} de ${dataHora(d.created_at)}`} title="Abrir" className={BOTAO_ICONE}>
                <ExternalLink size={13} aria-hidden />
              </button>
              {/* Os da consulta não saem (histórico); o espaço fica para alinhar o "Abrir". */}
              {podeEditar && (d.origem === "pessoa" ? (
                <button type="button" onClick={() => excluir(d)} aria-label={`Excluir ${d.nome_arquivo}`} title="Excluir" className="rounded p-2 text-black/30 transition hover:bg-black/[.04] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#D94A4A]">
                  <Trash2 size={13} aria-hidden />
                </button>
              ) : <span aria-hidden className="w-[1.8125rem] shrink-0" />)}
            </li>
          ))}
        </ul>
      )}

      {semCartao && (
        <p className="mt-2 text-[0.6875rem] text-black/50">
          Falta o cartão CNPJ. A consulta pública não substitui o comprovante emitido pela Receita:{" "}
          <a href={URL_CARTAO_CNPJ_RECEITA} target="_blank" rel="noopener noreferrer" className="rounded text-[#684DB0] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
            emita no site da Receita
          </a>
          {podeEditar ? " e anexe aqui." : "."}
        </p>
      )}
    </section>
  );
}
