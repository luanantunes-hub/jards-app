"use client";

// Uma linha das listas do convidado (P5.3): o item, o arquivo, a marca de
// verificado e os comentários dele.

import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, FileText, MessageSquare } from "lucide-react";
import type { EstadoDoItem, ItemDoConvidado } from "@/lib/prestacao/convidados";

const quando = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
const ACAO = "inline-flex h-8 items-center gap-1.5 rounded border bg-white px-2.5 text-[0.6875rem] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:opacity-50";

export function LinhaDoConvidado({ item, estado, onMarcar, onComentar, onAbrirArquivo }: {
  item: ItemDoConvidado;
  estado: EstadoDoItem | undefined;
  onMarcar: (item: ItemDoConvidado, verificado: boolean) => Promise<string | null>;
  onComentar: (item: ItemDoConvidado, texto: string) => Promise<string | null>;
  onAbrirArquivo: (path: string) => void;
}) {
  const [comentando, setComentando] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const verificado = Boolean(estado?.verificadoEm);
  const comentarios = estado?.comentarios ?? [];

  async function marcar() {
    setEnviando(true);
    setErro("");
    setErro((await onMarcar(item, !verificado)) ?? "");
    setEnviando(false);
  }

  async function comentar() {
    if (!texto.trim()) { setErro("Escreva o comentário."); return; }
    setEnviando(true);
    setErro("");
    const problema = await onComentar(item, texto.trim());
    setEnviando(false);
    if (problema) { setErro(problema); return; }
    setTexto("");
    setComentando(false);
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-black/85">{item.titulo}</p>
          {item.detalhes.length > 0 && <p className="mt-0.5 text-[0.6875rem] text-black/50">{item.detalhes.join(" · ")}</p>}
          {(item.arquivo || item.link) && (
            <div className="mt-1 flex flex-wrap gap-3">
              {item.arquivo && (
                <button type="button" onClick={() => onAbrirArquivo(item.arquivo!.path)}
                  className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  <FileText size={11} aria-hidden /> {item.arquivo.nome}
                </button>
              )}
              {item.link && (
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-black/60 underline decoration-black/20 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-[#7259B5]">
                  Abrir link <ExternalLink size={11} aria-hidden />
                </a>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          {item.valor && <p className="text-[0.8125rem] tabular-nums text-black/75">{item.valor}</p>}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={marcar} disabled={enviando} aria-pressed={verificado}
              className={`${ACAO} ${verificado ? "text-[#2E8932]" : "text-black/60"}`}
              style={{ borderColor: verificado ? "#2E893247" : "rgba(13,13,13,.12)" }}>
              {verificado ? <CheckCircle2 size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
              {verificado ? "Verificado" : "Marcar verificado"}
            </button>
            <button type="button" onClick={() => setComentando(v => !v)} aria-expanded={comentando}
              className={`${ACAO} text-black/60`} style={{ borderColor: "rgba(13,13,13,.12)" }}>
              <MessageSquare size={13} aria-hidden /> Comentar{comentarios.length ? ` (${comentarios.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      {verificado && estado?.verificadoEm && <p className="mt-1 text-[0.625rem] text-black/40">Verificado por você em {quando(estado.verificadoEm)}</p>}

      {comentarios.length > 0 && (
        <ul className="mt-2 space-y-1.5 border-l-2 border-black/[.08] pl-3" aria-label="Seus comentários">
          {comentarios.map(c => (
            <li key={c.id} className="text-[0.75rem] text-black/65">
              <span className="whitespace-pre-line">{c.texto}</span>
              <span className="ml-1.5 text-[0.625rem] text-black/35">{quando(c.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {comentando && (
        <div className="mt-2">
          <label className="block">
            <span className="sr-only">Comentário sobre {item.titulo}</span>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={2000} autoFocus
              placeholder="O que a equipe precisa ver neste item?"
              className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-black outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10" />
          </label>
          <div className="mt-1.5 flex justify-end gap-3">
            <button type="button" onClick={() => { setComentando(false); setTexto(""); setErro(""); }}
              className="rounded px-2 py-1.5 text-[0.75rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
            <button type="button" onClick={comentar} disabled={enviando}
              className="rounded bg-[#2E8932] px-4 py-1.5 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-50">
              Enviar comentário
            </button>
          </div>
        </div>
      )}
      {erro && <p role="alert" className="mt-1.5 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
    </li>
  );
}
