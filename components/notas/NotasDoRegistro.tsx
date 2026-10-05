"use client";

import { useId, useMemo, useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { atualizarNota, criarNota, normalizarNota, type EscopoNota, type NotaRegistro } from "@/lib/notas";

function quando(iso: string) {
  const data = new Date(iso);
  const minutos = Math.floor((Date.now() - data.getTime()) / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: data.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/**
 * Seção "Notas" das páginas de negociação e de inscrição. A página carrega as
 * notas (elas também entram no histórico) e recarrega após cada mudança.
 */
export function NotasDoRegistro({ escopo, organizationId, notas, onChanged, contexto }: {
  escopo: EscopoNota;
  organizationId: string | null;
  notas: NotaRegistro[];
  onChanged: () => Promise<void> | void;
  /** Nome do registro, exibido no cabeçalho do painel (ex.: a empresa da negociação). */
  contexto?: string;
}) {
  const [editando, setEditando] = useState<NotaRegistro | "nova" | null>(null);
  const tituloId = useId();

  return (
    <section aria-labelledby={tituloId}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={tituloId} className="text-[0.75rem] font-bold uppercase tracking-[.12em] text-black/40">
          Notas{notas.length > 0 && <span className="ml-1.5 font-medium tabular-nums text-black/25">{notas.length}</span>}
        </h2>
        <button
          type="button"
          onClick={() => setEditando("nova")}
          className="inline-flex min-h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.75rem] font-medium text-black/70 transition hover:bg-black/[.03] hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]"
          style={{ borderColor: "rgba(13,13,13,.12)" }}
        >
          <Plus size={13} aria-hidden="true" /> Nova nota
        </button>
      </div>

      {notas.length === 0 ? (
        <button
          type="button"
          onClick={() => setEditando("nova")}
          className="flex w-full flex-col items-center rounded border border-dashed bg-white px-6 py-8 text-center transition hover:bg-black/[.015] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          style={{ borderColor: "rgba(13,13,13,.14)" }}
        >
          <StickyNote size={20} className="mb-2 text-black/20" aria-hidden="true" />
          <span className="text-[0.8125rem] font-medium text-black/55">Nenhuma nota ainda</span>
          <span className="mt-1 text-[0.75rem] text-black/35">Guarde combinados, impressões e detalhes que não cabem nos campos.</span>
        </button>
      ) : (
        <ul className="space-y-2">
          {notas.map(nota => (
            <li key={nota.id}>
              <button
                type="button"
                onClick={() => setEditando(nota)}
                className="block w-full rounded border bg-white px-4 py-3 text-left transition hover:border-black/15 hover:bg-black/[.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
                style={{ borderColor: "rgba(13,13,13,.08)" }}
                aria-label={`Editar nota${nota.titulo ? ` ${nota.titulo}` : ""}`}
              >
                {nota.titulo && <p className="mb-1 text-[0.8125rem] font-semibold text-[#0D0D0D]">{nota.titulo}</p>}
                <p className="line-clamp-4 whitespace-pre-line text-[0.8125rem] leading-relaxed text-black/70">{nota.conteudo}</p>
                <p className="mt-1.5 text-[0.6875rem] text-black/30">{quando(nota.created_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <NotaSheet
          nota={editando === "nova" ? null : editando}
          escopo={escopo}
          organizationId={organizationId}
          contexto={contexto}
          onClose={() => setEditando(null)}
          onChanged={onChanged}
        />
      )}
    </section>
  );
}

function NotaSheet({ nota, escopo, organizationId, contexto, onClose, onChanged }: {
  nota: NotaRegistro | null;
  escopo: EscopoNota;
  organizationId: string | null;
  contexto?: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { confirmDelete } = useDeleteConfirm();
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [conteudo, setConteudo] = useState(nota?.conteudo ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tituloCampo = useId();
  const conteudoCampo = useId();
  const pronta = normalizarNota({ titulo, conteudo }) !== null;
  const semMudanca = nota !== null && titulo.trim() === (nota.titulo ?? "") && conteudo.trim() === nota.conteudo;

  async function salvar(close: () => void) {
    setSalvando(true);
    setErro(null);
    try {
      if (nota) await atualizarNota(supabase, nota.id, { titulo, conteudo });
      else await criarNota(supabase, escopo, organizationId, { titulo, conteudo });
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível salvar a nota. Tente novamente.");
      setSalvando(false);
      return;
    }
    await onChanged();
    close();
  }

  function excluir(close: () => void) {
    if (!nota) return;
    confirmDelete({
      title: "Excluir esta nota?",
      description: "A nota sai da página e do histórico. Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "notas", nota.id);
        await onChanged();
        close();
      },
    });
  }

  return (
    <BottomSheet
      titulo={nota ? "Editar nota" : "Nova nota"}
      subtitulo={contexto}
      onClose={onClose}
      footer={close => (
        <>
          {nota && (
            <button
              type="button"
              onClick={() => excluir(close)}
              disabled={salvando}
              className="mr-auto rounded px-2 py-2 text-[0.75rem] font-medium text-[#B23A3A] transition hover:bg-[#D94E4E]/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D94E4E] disabled:opacity-50"
            >
              Excluir
            </button>
          )}
          <button
            type="button"
            onClick={close}
            disabled={salvando}
            className="rounded px-2 py-2 text-[0.75rem] font-medium text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar(close)}
            disabled={!pronta || semMudanca || salvando}
            className="min-h-10 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:opacity-40"
          >
            {salvando ? "Salvando…" : "Salvar nota"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={tituloCampo} className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">Título <span className="font-normal text-black/30">(opcional)</span></label>
          <input
            id={tituloCampo}
            value={titulo}
            onChange={event => setTitulo(event.target.value)}
            maxLength={120}
            placeholder="Ex.: Reunião com o marketing"
            className="h-10 w-full rounded border bg-white px-3 text-[0.8125rem] text-[#0D0D0D] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/15"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
        </div>
        <div>
          <label htmlFor={conteudoCampo} className="mb-1.5 block text-[0.6875rem] font-medium text-black/45">Nota</label>
          <textarea
            id={conteudoCampo}
            value={conteudo}
            onChange={event => { setConteudo(event.target.value); setErro(null); }}
            autoFocus
            rows={7}
            placeholder="O que foi combinado, o que ficou de fora, próximos detalhes…"
            className="w-full resize-y rounded border bg-white px-3 py-2.5 text-[0.8125rem] leading-relaxed text-[#0D0D0D] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/45 focus:ring-2 focus:ring-[#7259B5]/15"
            style={{ borderColor: "rgba(13,13,13,.12)", minHeight: "9rem" }}
          />
        </div>
        {erro && <p role="alert" className="rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.05] px-3 py-2 text-[0.75rem] text-[#B23A3A]">{erro}</p>}
      </div>
    </BottomSheet>
  );
}
