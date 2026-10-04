"use client";
import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Loader2, StickyNote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Nota = {
  id:         string;
  conteudo:   string;
  created_at: string;
  updated_at: string;
};

type Props = {
  empresaCrmId: string;
  empresaNome:  string;
  onClose:      () => void;
};

function fmtTs(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
    " · " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function NotaItem({
  nota, onDelete,
}: { nota: Nota; onDelete: (id: string) => void }) {
  const supabase   = createClient();
  const [text,   setText]   = useState(nota.conteudo);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutoSave(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      await (supabase as any).from("anotacoes_empresa")
        .update({ conteudo: value, updated_at: new Date().toISOString() })
        .eq("id", nota.id);
      setSaving(false);
    }, 800);
  }

  async function handleDelete() {
    await (supabase as any).from("anotacoes_empresa").delete().eq("id", nota.id);
    onDelete(nota.id);
  }

  return (
    <div className="border rounded overflow-hidden" style={{ borderColor: "rgba(13,13,13,.1)" }}>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); scheduleAutoSave(e.target.value); }}
        rows={3}
        className="w-full px-3 py-2.5 text-[0.8125rem] text-black/75 resize-none bg-white focus:outline-none placeholder-black/20"
        placeholder="Anotação sobre a empresa…"
      />
      <div className="flex items-center justify-between px-3 py-1.5 border-t"
        style={{ borderColor: "rgba(13,13,13,.07)", background: "rgba(13,13,13,.015)" }}>
        <span className="text-[0.625rem] text-black/30">
          {fmtTs(nota.updated_at > nota.created_at ? nota.updated_at : nota.created_at)}
          {saving && <span className="ml-1.5 text-black/20">· salvando…</span>}
        </span>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 text-[0.625rem] font-semibold text-black/25 hover:text-[#D94E4E] transition"
        >
          <Trash2 size={10} /> Deletar
        </button>
      </div>
    </div>
  );
}

export function AnotacoesEmpresa({ empresaCrmId, empresaNome, onClose }: Props) {
  const supabase  = createClient();
  const [notas,    setNotas]    = useState<Nota[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [newText,  setNewText]  = useState("");
  const newRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("anotacoes_empresa")
        .select("*")
        .eq("empresa_crm_id", empresaCrmId)
        .order("created_at", { ascending: false });
      setNotas((data ?? []) as Nota[]);
      setLoading(false);
    }
    fetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaCrmId]);

  async function addNota() {
    if (!newText.trim()) return;
    setAdding(true);
    const { data } = await (supabase as any)
      .from("anotacoes_empresa")
      .insert({ empresa_crm_id: empresaCrmId, conteudo: newText.trim() })
      .select("*")
      .single();
    if (data) setNotas(prev => [data as Nota, ...prev]);
    setNewText("");
    setAdding(false);
  }

  function removeNota(id: string) {
    setNotas(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded border shadow-2xl w-[30rem] max-h-[80vh] flex flex-col"
        style={{ borderColor: "rgba(13,13,13,.10)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-2">
            <StickyNote size={14} className="text-black/35" />
            <div>
              <p className="text-[0.75rem] font-bold text-black">Anotações</p>
              <p className="text-[0.65625rem] text-black/35">{empresaNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/6 text-black/30 hover:text-black/60 transition">
            <X size={14} />
          </button>
        </div>

        {/* Nova nota */}
        <div className="flex-shrink-0 px-4 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)", background: "#FAFAFA" }}>
          <textarea
            ref={newRef}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            rows={2}
            placeholder="Escreva uma nova anotação…"
            className="w-full px-3 py-2 text-[0.8125rem] text-black/75 resize-none bg-white border rounded placeholder-black/25 focus:outline-none focus:ring-2 focus:ring-black/15"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNota(); }}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[0.625rem] text-black/25">Ctrl+Enter para salvar</span>
            <button
              onClick={addNota}
              disabled={adding || !newText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold text-white transition"
              style={{ background: adding || !newText.trim() ? "rgba(13,13,13,.2)" : "#7259B5" }}
            >
              {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="py-8 text-center text-xs text-black/30">Carregando…</div>
          ) : notas.length === 0 ? (
            <div className="py-14 text-center">
              <StickyNote size={22} className="text-black/12 mx-auto mb-2" />
              <p className="text-xs text-black/25 font-semibold">Sem anotações ainda</p>
            </div>
          ) : (
            notas.map(n => (
              <NotaItem key={n.id} nota={n} onDelete={removeNota} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
