"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, FileText, MapPin, Pencil, Trash2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Achado } from "@/lib/prestacao/checagens";
import { linkDoMapa, nomeDaEvidencia, quandoFoiTirada, REQUISITOS_EVIDENCIA, rotuloDoTipo } from "@/lib/prestacao/evidencias";
import type { PrestacaoEvidencia } from "@/lib/supabase/types";

const ehImagem = (e: Pick<PrestacaoEvidencia, "mime_type" | "tipo" | "storage_path">) =>
  Boolean(e.storage_path) && ((e.mime_type ?? "").startsWith("image/") || (!e.mime_type && e.tipo === "foto"));

/**
 * Evidências com miniatura, vínculos, quando e onde a foto foi tirada e os
 * alertas da conferência. Abrir gera um link temporário do arquivo.
 */
export function ListaEvidencias({ evidencias, vinculos, alertas, podeEditar, onEditar, onExcluir, vazio }: {
  evidencias: readonly PrestacaoEvidencia[];
  /** Texto dos vínculos de cada evidência ("Oficina na escola · São Paulo/SP"). */
  vinculos: (e: PrestacaoEvidencia) => string;
  alertas: ReadonlyMap<string, readonly Achado[]>;
  podeEditar: boolean;
  onEditar: (e: PrestacaoEvidencia) => void;
  onExcluir: (e: PrestacaoEvidencia) => void;
  vazio: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState("");

  const caminhos = useMemo(() => evidencias.filter(ehImagem).map(e => e.storage_path as string), [evidencias]);
  useEffect(() => {
    if (caminhos.length === 0) return;
    let ativo = true;
    supabase.storage.from("documentos").createSignedUrls(caminhos, 600).then(({ data }) => {
      if (!ativo || !data) return;
      setMiniaturas(Object.fromEntries(data.flatMap(d => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : []))));
    });
    return () => { ativo = false; };
  }, [caminhos, supabase]);

  async function abrir(e: PrestacaoEvidencia) {
    setErro("");
    if (e.url && !e.storage_path) { window.open(e.url, "_blank", "noopener,noreferrer"); return; }
    if (!e.storage_path) return;
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(e.storage_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
  }

  if (evidencias.length === 0) return <>{vazio}</>;
  return (
    <>
      {erro && <p role="alert" className="px-5 pt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
      <ul className="divide-y divide-black/[.05]">
        {evidencias.map(e => {
          const miniatura = e.storage_path ? miniaturas[e.storage_path] : undefined;
          const doItem = alertas.get(e.id) ?? [];
          const requisitos = REQUISITOS_EVIDENCIA.filter(r => e.requisitos?.includes(r.id)).map(r => r.rotulo);
          const nome = nomeDaEvidencia(e);
          return (
            <li key={e.id} className="flex items-start gap-3 px-5 py-3 transition hover:bg-black/[.02]">
              <button
                type="button"
                onClick={() => abrir(e)}
                aria-label={`Abrir ${nome}`}
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-black/[.03] text-black/30 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                style={{ borderColor: "rgba(13,13,13,.08)" }}
              >
                {miniatura
                  // eslint-disable-next-line @next/next/no-img-element -- link temporário do Storage, sem otimização
                  ? <img src={miniatura} alt={e.descricao || nome} className="h-full w-full object-cover" />
                  : e.tipo === "video" ? <Video size={18} aria-hidden /> : e.url && !e.storage_path ? <ExternalLink size={18} aria-hidden /> : <FileText size={18} aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[0.75rem] font-medium text-black/80">{nome}</p>
                  <span className="rounded border bg-white px-1.5 py-px text-[0.5625rem] font-medium text-black/55" style={{ borderColor: "rgba(13,13,13,.14)" }}>{rotuloDoTipo(e.tipo)}</span>
                  {e.canal === "proponente" && (
                    <span className="rounded border bg-white px-1.5 py-px text-[0.5625rem] font-medium" style={{ borderColor: "#2D72B047", color: "#2D72B0" }}>Enviada pelo cliente</span>
                  )}
                </div>
                <p className="mt-0.5 text-[0.625rem] text-black/45">{vinculos(e) || "Sem vínculo"}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.625rem] text-black/40">
                  {e.capturada_em && <span className="tabular-nums">{quandoFoiTirada(e.capturada_em)}{e.origem_dados === "informado" ? " (informada)" : ""}</span>}
                  {e.latitude !== null && e.longitude !== null && (
                    <a href={linkDoMapa(Number(e.latitude), Number(e.longitude))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline decoration-black/20 underline-offset-2 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                      <MapPin size={10} aria-hidden /> ver no mapa
                    </a>
                  )}
                  {requisitos.length > 0 && <span>Comprova: {requisitos.join(", ")}</span>}
                </p>
                {doItem.map(a => (
                  <p key={a.chave} className="mt-1 flex items-start gap-1 text-[0.6875rem] text-[#B07A14]">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden /> {a.mensagem}
                  </p>
                ))}
                {e.justificativa && <p className="mt-1 text-[0.6875rem] text-black/50">Justificativa: {e.justificativa}</p>}
              </div>
              {podeEditar && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => onEditar(e)} aria-label={`Editar ${nome}`} className="rounded p-2 text-black/35 transition hover:bg-black/5 hover:text-black/65 focus-visible:outline-2 focus-visible:outline-[#7259B5]"><Pencil size={13} /></button>
                  <button type="button" onClick={() => onExcluir(e)} aria-label={`Excluir ${nome}`} className="rounded p-2 text-black/25 transition hover:bg-black/[.04] hover:text-[#D94A4A] focus-visible:outline-2 focus-visible:outline-[#D94A4A]"><Trash2 size={13} /></button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
