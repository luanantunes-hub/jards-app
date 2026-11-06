"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type TextoProjeto = {
  campo_id: string;
  campo_nome: string;
  modelo_texto: string;
  tem_modelo: boolean;
  ordem: number;
};

type LegacyTexto = {
  pergunta?: string;
  resposta?: string;
  ordem?: number;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function TextosManager({ projetoId }: { projetoId: string }) {
  const storageKey = `jards_textos_${projetoId}`;
  const supabase = createClient();
  const db = supabase as unknown as RpcClient;
  const { confirmDelete } = useDeleteConfirm();

  const [items, setItems] = useState<TextoProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragOverId = useRef<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [editingItem, setEditingItem] = useState<TextoProjeto | null>(null);
  const [creating, setCreating] = useState(false);
  const perguntaRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const { data, error: loadError } = await db.rpc("get_respostas_projeto", {
      p_projeto_id: projetoId,
    });
    if (loadError) {
      setError(loadError.message);
      setItems([]);
    } else {
      const rows = (data ?? []) as TextoProjeto[];
      setItems(rows);
      setError(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const migrarTextosLocais = useCallback(async () => {
    let antigos: LegacyTexto[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) antigos = JSON.parse(stored) as LegacyTexto[];
    } catch {
      antigos = [];
    }

    if (antigos.length > 0) {
      const ordenados = [...antigos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      for (const item of ordenados) {
        if (!item.pergunta?.trim()) continue;
        const { error: migrationError } = await db.rpc("criar_texto_projeto", {
          p_projeto_id: projetoId,
          p_nome: item.pergunta.trim(),
          p_conteudo: item.resposta?.trim() ?? "",
        });
        if (migrationError) {
          setError(migrationError.message);
          return;
        }
      }
      localStorage.removeItem(storageKey);
    }

    await carregar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar, projetoId, storageKey]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void migrarTextosLocais(); }, [migrarTextosLocais]);

  function showSheet() {
    setSheetOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setSheetVisible(true);
      setTimeout(() => perguntaRef.current?.focus(), 50);
    }));
  }

  function openCreateSheet() {
    setEditingItem(null);
    setNovaPergunta("");
    setNovaResposta("");
    showSheet();
  }

  function openEditSheet(item: TextoProjeto) {
    setEditingItem(item);
    setNovaPergunta(item.campo_nome);
    setNovaResposta(item.modelo_texto ?? "");
    showSheet();
  }

  function closeSheet() {
    setSheetVisible(false);
    setTimeout(() => {
      setSheetOpen(false);
      setEditingItem(null);
      setNovaPergunta("");
      setNovaResposta("");
    }, 260);
  }

  async function saveSheet() {
    if (!novaPergunta.trim() || creating) return;
    setCreating(true);
    setError(null);
    const { error: saveError } = editingItem
      ? await db.rpc("atualizar_texto_projeto", {
          p_projeto_id: projetoId,
          p_campo_id: editingItem.campo_id,
          p_nome: novaPergunta.trim(),
          p_conteudo: novaResposta.trim(),
        })
      : await db.rpc("criar_texto_projeto", {
          p_projeto_id: projetoId,
          p_nome: novaPergunta.trim(),
          p_conteudo: novaResposta.trim(),
        });
    setCreating(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    closeSheet();
    await carregar();
  }

  function removeItem(item: TextoProjeto) {
    confirmDelete({
      title: `Excluir "${item.campo_nome.length > 40 ? item.campo_nome.slice(0, 40) + "…" : item.campo_nome}"?`,
      description: "O texto deixará de fazer parte do banco deste projeto. Respostas já preenchidas nas inscrições serão preservadas.",
      onConfirm: async () => {
        const { error: deleteError } = await db.rpc("remover_texto_projeto", {
          p_projeto_id: projetoId,
          p_campo_id: item.campo_id,
        });
        if (deleteError) {
          setError(deleteError.message);
          return;
        }
        setItems(current => current.filter(currentItem => currentItem.campo_id !== item.campo_id));
      },
    });
  }

  function handleDragOver(event: React.DragEvent, id: string) {
    event.preventDefault();
    dragOverId.current = id;
  }

  async function handleDrop() {
    if (!dragId || !dragOverId.current || dragId === dragOverId.current) {
      setDragId(null);
      return;
    }
    const from = items.findIndex(item => item.campo_id === dragId);
    const to = items.findIndex(item => item.campo_id === dragOverId.current);
    if (from === -1 || to === -1) {
      setDragId(null);
      return;
    }
    const previous = items;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ordered = next.map((item, index) => ({ ...item, ordem: index }));
    setItems(ordered);
    setDragId(null);
    const { error: reorderError } = await db.rpc("reordenar_textos_projeto", {
      p_projeto_id: projetoId,
      p_campos: ordered.map(item => item.campo_id),
    });
    if (reorderError) {
      setItems(previous);
      setError(reorderError.message);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-black/30"><Loader2 size={18} className="animate-spin" /></div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[0.75rem] text-black/35">
            {items.length > 0 ? `${items.length} texto${items.length !== 1 ? "s" : ""}` : "Nenhum texto"}
          </span>
          <button onClick={openCreateSheet} className="flex items-center gap-1.5 rounded border border-black/[.15] bg-white px-3.5 py-2 text-[0.75rem] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98]">
            <Plus size={13} /> Nova resposta
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded border border-[#D94E4E]/20 px-3 py-2.5 text-[0.6875rem] text-[#D94E4E]">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />{error}
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded border border-dashed border-black/[.12] px-6 py-14 text-center">
            <p className="text-[0.75rem] font-medium text-black/40">Nenhum texto cadastrado</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-black/[.08] bg-white">
            {items.map((item, index) => (
                <div
                  key={item.campo_id}
                  draggable
                  onDragStart={() => setDragId(item.campo_id)}
                  onDragOver={event => handleDragOver(event, item.campo_id)}
                  onDrop={() => void handleDrop()}
                  onDragEnd={() => setDragId(null)}
                  className={`transition ${dragId === item.campo_id ? "opacity-45" : ""}`}
                  style={{ borderBottom: index < items.length - 1 ? "1px solid rgba(13,13,13,.07)" : undefined }}
                >
                  <div className="flex items-start gap-2 px-4 py-3">
                    <span className="mt-1 cursor-grab shrink-0 text-black/20 active:cursor-grabbing"><GripVertical size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-semibold text-black/75">{item.campo_nome}</p>
                      <p className={`mt-1 line-clamp-2 text-[0.75rem] leading-5 ${item.modelo_texto ? "text-black/40" : "text-black/25"}`}>
                        {item.modelo_texto || "Sem resposta padrão"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.tem_modelo && <span className="mr-1 text-[0.5625rem] font-bold text-[#7259B5]/65">Padrão</span>}
                      <button onClick={() => openEditSheet(item)} className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05]" aria-label={`Editar ${item.campo_nome}`}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => removeItem(item)} className="group flex h-7 w-7 items-center justify-center rounded transition hover:bg-black/[.04]">
                        <Trash2 size={13} className="text-black/25 transition-colors group-hover:text-[#D94E4E]" />
                      </button>
                    </div>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50" style={{ background: sheetVisible ? "rgba(0,0,0,.38)" : "rgba(0,0,0,0)", transition: "background 260ms ease" }} onClick={closeSheet}>
          <div
            className="absolute left-1/2 top-0 overflow-hidden rounded-b bg-white border-x border-b elevacao-2"
            style={{ width: "70%", transform: sheetVisible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-100%)", transition: "transform 260ms cubic-bezier(.32,.72,0,1)", maxHeight: "67vh" }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-6 pb-4 pt-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <h3 className="text-[0.9375rem] font-semibold text-black/80">{editingItem ? "Editar resposta" : "Nova resposta"}</h3>
              <button onClick={closeSheet} className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.05]"><X size={15} className="text-black/40" /></button>
            </div>
            <div className="space-y-4 overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(67vh - 120px)" }}>
              <div>
                <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[.08em] text-black/40">Pergunta ou título</label>
                <input
                  ref={perguntaRef}
                  value={novaPergunta}
                  onChange={event => setNovaPergunta(event.target.value)}
                  onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveSheet(); } }}
                  placeholder="Ex: Qual o impacto social do projeto?"
                  className="w-full rounded border border-black/[.1] px-3 py-2.5 text-[0.8125rem] outline-none transition focus:border-black/25"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[.08em] text-black/40">Resposta padrão</label>
                <textarea value={novaResposta} onChange={event => setNovaResposta(event.target.value)} placeholder="Escreva a resposta…" rows={6} className="w-full resize-none rounded border border-black/[.1] px-3 py-2.5 text-[0.8125rem] leading-relaxed outline-none transition focus:border-black/25" />
              </div>
              {error && <div className="flex items-start gap-2 text-[0.6875rem] text-[#D94E4E]"><AlertCircle size={12} className="mt-0.5 shrink-0" />{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
              <button onClick={closeSheet} className="text-[0.75rem] font-medium text-black/35 transition hover:text-black/55">Cancelar</button>
              <button onClick={() => void saveSheet()} disabled={!novaPergunta.trim() || creating} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[0.75rem] font-semibold text-white transition hover:bg-[#26752A] active:scale-[.98] disabled:opacity-35">
                {creating && <Loader2 size={12} className="animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
