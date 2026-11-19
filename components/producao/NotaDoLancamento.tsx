"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { BUCKET_DOS_ARQUIVOS, extensaoAceita, extensaoDoArquivo, montarCaminhoProducao } from "@/lib/producao/armazenamento";

type Nota = { id: string; nome: string; tamanho: number; storage_path: string };

const LIMITE = 15 * 1024 * 1024;
const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50";

async function sha256(arquivo: File): Promise<string> {
  const resumo = await crypto.subtle.digest("SHA-256", await arquivo.arrayBuffer());
  return Array.from(new Uint8Array(resumo)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

const emKb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/**
 * A nota fiscal de um pagamento lançado (PD5.3, segundo corte): fica na pasta "documentos" da temporada. É o arquivo
 * que a ponte com a prestação de contas (PD10.2) leva para lá, onde o comprovante exige um documento.
 */
export function NotaDoLancamento({ organizationId, temporadaId, lancamentoId, podeEditar }: {
  organizationId: string; temporadaId: string; lancamentoId: string; podeEditar: boolean;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const entrada = useRef<HTMLInputElement>(null);
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const { data, error } = await clienteDaProducao(createClient()).from("producao_arquivos")
        .select("id, nome, tamanho, storage_path").eq("lancamento_id", lancamentoId).order("created_at", { ascending: false });
      if (!ativo) return;
      setNotas((data ?? []) as Nota[]);
      setErro(error ? "Não foi possível carregar a nota." : null);
    })();
    return () => { ativo = false; };
  }, [lancamentoId, versao]);

  async function enviar(arquivo: File) {
    setErro(null);
    if (arquivo.size > LIMITE) { setErro("O arquivo passa de 15 MB."); return; }
    if (!extensaoAceita(extensaoDoArquivo(arquivo.name))) { setErro("Esse tipo de arquivo não é aceito. Use PDF ou imagem."); return; }
    setEnviando(true);
    const supabase = createClient();
    const caminho = montarCaminhoProducao({ organizationId, temporadaId, pasta: "documentos", nomeOriginal: arquivo.name });
    const subida = await supabase.storage.from(BUCKET_DOS_ARQUIVOS).upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false });
    if (subida.error) { setEnviando(false); setErro("Não foi possível enviar o arquivo. Tente de novo."); return; }
    const { error } = await clienteDaProducao(supabase).from("producao_arquivos").insert({
      organization_id: organizationId, temporada_id: temporadaId, lancamento_id: lancamentoId, pasta: "documentos", storage_path: caminho,
      nome: arquivo.name, tipo: arquivo.type || "application/octet-stream", tamanho: arquivo.size, sha256: await sha256(arquivo),
    });
    if (error) {
      await supabase.storage.from(BUCKET_DOS_ARQUIVOS).remove([caminho]);
      setErro(error.code === "23505" ? "Esse arquivo já foi enviado." : "Não foi possível guardar o arquivo. Tente de novo.");
    }
    setEnviando(false);
    setVersao(atual => atual + 1);
  }

  async function abrir(nota: Nota) {
    setErro(null);
    const { data, error } = await createClient().storage.from(BUCKET_DOS_ARQUIVOS).createSignedUrl(nota.storage_path, 60);
    if (error || !data) { setErro("Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function apagar(nota: Nota) {
    confirmDelete({
      title: "Apagar a nota?",
      description: `${nota.nome} sai do lançamento e do armazenamento.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const supabase = createClient();
        const { error } = await clienteDaProducao(supabase).from("producao_arquivos").delete().eq("id", nota.id);
        if (error) throw new Error("Não foi possível apagar a nota.");
        await supabase.storage.from(BUCKET_DOS_ARQUIVOS).remove([nota.storage_path]);
        setVersao(atual => atual + 1);
      },
    });
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium text-black/55">Nota fiscal ou recibo</span>
        {podeEditar && (
          <>
            <input ref={entrada} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={event => { const escolhido = event.target.files?.[0]; event.target.value = ""; if (escolhido) void enviar(escolhido); }} />
            <button type="button" className={BOTAO_PEQUENO} disabled={enviando} onClick={() => entrada.current?.click()}>
              <Paperclip size={11} aria-hidden="true" className="mr-1 inline" />{enviando ? "Enviando…" : "Anexar"}
            </button>
          </>
        )}
      </div>
      {erro && <p role="alert" className="mb-2 rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      {notas === null ? (
        <div className="h-10 rounded border bg-black/[.02] motion-safe:animate-pulse" style={{ borderColor: "rgba(13,13,13,.06)" }} />
      ) : notas.length === 0 ? (
        <p className="rounded border bg-white px-3 py-2 text-[0.75rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.1)" }}>Sem nota anexada. A prestação de contas só aceita comprovante com documento.</p>
      ) : (
        <ul className="divide-y divide-black/[.06] overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.1)" }}>
          {notas.map(nota => (
            <li key={nota.id} className="flex items-center gap-2 px-3 py-2">
              <FileText size={13} aria-hidden="true" className="shrink-0 text-black/35" />
              <button type="button" onClick={() => void abrir(nota)} className="min-w-0 flex-1 truncate text-left text-[0.75rem] text-[#7259B5] underline-offset-2 hover:underline">{nota.nome}</button>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/40">{emKb(nota.tamanho)}</span>
              {podeEditar && (
                <button type="button" onClick={() => apagar(nota)} aria-label={`Apagar ${nota.nome}`} title="Apagar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-black/35 transition hover:bg-black/[.05] hover:text-[#B23B3B] focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Trash2 size={13} aria-hidden="true" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
