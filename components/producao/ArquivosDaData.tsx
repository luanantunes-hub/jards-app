"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { BUCKET_DOS_ARQUIVOS, extensaoAceita, extensaoDoArquivo, montarCaminhoProducao } from "@/lib/producao/armazenamento";

type Arquivo = { id: string; nome: string; tamanho: number; storage_path: string; created_at: string };

const LIMITE = 15 * 1024 * 1024;

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

async function sha256(arquivo: File): Promise<string> {
  const resumo = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(resumo)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Os arquivos da data (PD1.6): contrato, rider, mapa de palco, voucher… Ficam na pasta "datas" da temporada. */
export function ArquivosDaData({ organizationId, temporadaId, dataId, podeEditar }: { organizationId: string; temporadaId: string; dataId: string; podeEditar: boolean }) {
  const { confirmDelete } = useDeleteConfirm();
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_arquivos")
        .select("id, nome, tamanho, storage_path, created_at").eq("data_id", dataId).order("created_at", { ascending: false });
      if (!ativo) return;
      setArquivos((data ?? []) as Arquivo[]);
      setErro(error ? "Não foi possível carregar os arquivos. Recarregue a página." : null);
    })();
    return () => { ativo = false; };
  }, [dataId, versao]);

  async function enviar(arquivo: File) {
    setErro(null);
    if (arquivo.size > LIMITE) { setErro("O arquivo passa de 15 MB."); return; }
    if (!extensaoAceita(extensaoDoArquivo(arquivo.name))) { setErro("Esse tipo de arquivo não é aceito. Use PDF, documento, planilha, apresentação ou imagem."); return; }
    setEnviando(true);
    const supabase = createClient();
    const caminho = montarCaminhoProducao({ organizationId, temporadaId, pasta: "datas", nomeOriginal: arquivo.name });
    const subida = await supabase.storage.from(BUCKET_DOS_ARQUIVOS).upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
    if (subida.error) { setEnviando(false); setErro("Não foi possível enviar o arquivo. Tente de novo."); return; }
    const { error } = await clienteDaProducao(supabase).from("producao_arquivos").insert({
      organization_id: organizationId, temporada_id: temporadaId, data_id: dataId, pasta: "datas", storage_path: caminho,
      nome: arquivo.name, tipo: arquivo.type || "application/octet-stream", tamanho: arquivo.size, sha256: await sha256(arquivo),
    });
    if (error) {
      await supabase.storage.from(BUCKET_DOS_ARQUIVOS).remove([caminho]);
      setErro(error.code === "23505" ? "Esse arquivo já foi enviado." : "Não foi possível guardar o arquivo. Tente de novo.");
    }
    setEnviando(false);
    setVersao(atual => atual + 1);
  }

  async function abrir(arquivo: Arquivo) {
    setErro(null);
    const { data, error } = await createClient().storage.from(BUCKET_DOS_ARQUIVOS).createSignedUrl(arquivo.storage_path, 60);
    if (error || !data) { setErro("Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function apagar(arquivo: Arquivo) {
    confirmDelete({
      title: "Apagar arquivo?",
      description: `"${arquivo.nome}" sai desta data.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await clienteDaProducao(supabase).from("producao_arquivos").delete().eq("id", arquivo.id);
        if (error) throw new Error("Não foi possível apagar o arquivo.");
        await supabase.storage.from(BUCKET_DOS_ARQUIVOS).remove([arquivo.storage_path]);
        setVersao(atual => atual + 1);
      },
    });
  }

  return (
    <section aria-labelledby="arquivos-da-data" className="mt-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="arquivos-da-data" className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Arquivos</h2>
        {podeEditar && (
          <>
            <input ref={entrada} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={event => { const escolhido = event.target.files?.[0]; event.target.value = ""; if (escolhido) void enviar(escolhido); }} />
            <PrimaryListAction onClick={() => entrada.current?.click()} disabled={enviando}><Paperclip size={13} aria-hidden="true" /> {enviando ? "Enviando…" : "Enviar arquivo"}</PrimaryListAction>
          </>
        )}
      </div>
      {erro && <p role="alert" className="mb-3 rounded border bg-white px-4 py-2.5 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {arquivos === null ? (
        <div className="h-16 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : arquivos.length === 0 ? (
        <div className="rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem] font-medium text-black/55">Nenhum arquivo nesta data</p>
          <p className="mx-auto mt-1 max-w-sm text-[0.75rem] text-black/45">Guarde aqui o contrato, o rider, o mapa de palco e os vouchers de viagem. Até 15 MB cada.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <ul className="divide-y divide-black/[.06]">
            {arquivos.map(arquivo => (
              <li key={arquivo.id} className="flex items-center gap-3 px-4 py-2.5">
                <FileText size={14} aria-hidden="true" className="shrink-0 text-black/40" />
                <button type="button" onClick={() => void abrir(arquivo)} className="min-w-0 flex-1 truncate text-left text-[0.8125rem] font-medium text-[#282525] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">{arquivo.nome}</button>
                <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/45">{tamanhoLegivel(arquivo.tamanho)}</span>
                {podeEditar && (
                  <button type="button" onClick={() => apagar(arquivo)} aria-label={`Apagar: ${arquivo.nome}`} title="Apagar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={14} aria-hidden="true" /></button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
