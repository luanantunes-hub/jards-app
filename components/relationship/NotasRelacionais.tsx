"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { autorDaNota, notaEditavel } from "@/lib/notas";
import { useAutoriaDasNotas } from "@/hooks/useAutoriaDasNotas";

type NotaRow = { id: string; titulo: string | null; conteudo: string; account_id: string };

export function NotasRelacionais({ empresaCrmId, proponenteId = null, showNew, setShowNew }: { empresaCrmId: string | null; proponenteId?: string | null; showNew: boolean; setShowNew: (value: boolean) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [creating, setCreating] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const scopeColumn = proponenteId ? "proponente_id" : "empresa_crm_id";
  const scopeId = proponenteId ?? empresaCrmId;
  const { usuarioId, nomes } = useAutoriaDasNotas(notas);

  const fetchNotas = useCallback(async () => {
    if (!scopeId) { setLoading(false); return; }
    setLoading(true);
    const result = await (supabase as any).from("notas").select("id,titulo,conteudo,account_id").eq(scopeColumn, scopeId).order("created_at", { ascending: true });
    let rows = (result.data as NotaRow[] | null) ?? [];
    if (rows.length === 0 && empresaCrmId && !proponenteId) {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).rpc("fn_seed_notas_modelo", { p_empresa_crm_id: empresaCrmId, p_account_id: user?.id });
      const refetch = await (supabase as any).from("notas").select("id,titulo,conteudo,account_id").eq("empresa_crm_id", empresaCrmId).order("created_at", { ascending: true });
      rows = (refetch.data as NotaRow[] | null) ?? [];
    }
    setNotas(rows);
    setLoading(false);
  }, [empresaCrmId, proponenteId, scopeColumn, scopeId, supabase]);

  useEffect(() => { void fetchNotas(); }, [fetchNotas]);

  async function criarNota() {
    if (!scopeId) return;
    const t = novoTitulo.trim();
    if (!t) return;
    if (notas.some(n => (n.titulo ?? "").trim().toLowerCase() === t.toLowerCase())) {
      setErro("Já existe uma nota com esse título.");
      return;
    }
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("notas").insert({ titulo: t, conteudo: "", [scopeColumn]: scopeId, account_id: user?.id });
    setCreating(false);
    if (error) { setErro("Já existe uma nota com esse título."); return; }
    setErro(null);
    setNovoTitulo("");
    setShowNew(false);
    void fetchNotas();
  }

  async function excluirNota(notaId: string) {
    await (supabase as any).from("notas").delete().eq("id", notaId);
    void fetchNotas();
  }

  if (!scopeId) {
    return <div className="px-5 py-14 text-center"><p className="text-sm font-medium text-black/30">Nenhum vínculo disponível</p></div>;
  }

  return (
    <div className="p-5">
      {showNew && (
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              value={novoTitulo}
              onChange={e => { setNovoTitulo(e.target.value); setErro(null); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void criarNota(); } }}
              placeholder="Título da nota"
              autoFocus
              className="h-8 flex-1 rounded border px-2.5 text-[0.75rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-1 focus:ring-[#7259B5]/10"
              style={{borderColor: erro ? "#D94E4E" : "rgba(13,13,13,.12)"}}
            />
            <button type="button" onClick={() => { setShowNew(false); setErro(null); setNovoTitulo(""); }} className="px-2 text-[0.6875rem] font-medium text-black/35 transition hover:text-black/55">
              Cancelar
            </button>
            <button type="button" onClick={() => void criarNota()} disabled={!novoTitulo.trim() || creating}
              className="rounded acao-salvar px-3 text-[0.6875rem] font-bold text-white transition disabled:opacity-40">
              Criar
            </button>
          </div>
          {erro && <p className="mt-1.5 text-[0.625rem] text-[#D94E4E]">{erro}</p>}
        </div>
      )}
      {loading ? (
        <p className="py-12 text-center text-xs text-black/30">Carregando…</p>
      ) : notas.length === 0 ? (
        <div className="py-14 text-center"><p className="text-sm font-medium text-black/30">Nada registrado aqui ainda</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notas.map(nota => (
            <NotaItem
              key={nota.id}
              nota={nota}
              editavel={notaEditavel(nota, usuarioId)}
              autor={autorDaNota(nota, usuarioId, nomes)}
              outrosTitulos={notas.filter(n => n.id !== nota.id).map(n => n.titulo)}
              onChanged={fetchNotas}
              onDelete={() => void excluirNota(nota.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotaItem({ nota, editavel, autor, outrosTitulos, onChanged, onDelete }: { nota: NotaRow; editavel: boolean; autor: string | null; outrosTitulos: (string | null)[]; onChanged: () => void; onDelete: () => void }) {
  const supabase = createClient();
  const [titulo, setTitulo] = useState(nota.titulo ?? "");
  const [conteudo, setConteudo] = useState(nota.conteudo);
  const [tituloErro, setTituloErro] = useState(false);
  const isEmpty = !conteudo.trim();

  async function salvar(patch: Record<string, unknown>) {
    await (supabase as any).from("notas").update(patch).eq("id", nota.id);
    onChanged();
  }

  function handleTituloBlur() {
    const t = titulo.trim();
    const duplicado = t.length > 0 && outrosTitulos.some(o => (o ?? "").trim().toLowerCase() === t.toLowerCase());
    setTituloErro(duplicado);
    if (duplicado) return;
    if (t !== (nota.titulo ?? "")) void salvar({ titulo: t || null });
  }

  if (!editavel) {
    return (
      <div className="rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.08)", background: "rgba(13,13,13,.015)" }}>
        {nota.titulo && <p className="text-[0.8125rem] font-semibold text-black/75">{nota.titulo}</p>}
        {nota.conteudo.trim() && <p className="mt-1.5 whitespace-pre-line text-[0.75rem] text-black/65">{nota.conteudo}</p>}
        <p className="mt-2 text-[0.625rem] text-black/35">{autor}</p>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded border p-3.5 transition focus-within:border-[#7259B5]/30 focus-within:bg-white ${isEmpty ? "border-dashed" : ""}`}
      style={{ borderColor: isEmpty ? "rgba(13,13,13,.16)" : "rgba(13,13,13,.08)", background: isEmpty ? "transparent" : "rgba(13,13,13,.015)" }}
    >
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-2.5 top-2.5 text-black/20 opacity-0 transition hover:text-[#D94E4E] group-hover:opacity-100"
        aria-label="Excluir nota"
      >
        <Trash2 size={12}/>
      </button>
      <input
        value={titulo}
        onChange={e => { setTitulo(e.target.value); setTituloErro(false); }}
        onBlur={handleTituloBlur}
        placeholder="Título (opcional)"
        className={`w-full bg-transparent pr-5 text-[0.8125rem] font-semibold outline-none ${tituloErro ? "text-[#D94E4E]" : "text-black/75"}`}
      />
      {tituloErro && <p className="mt-0.5 text-[0.625rem] text-[#D94E4E]">Já existe uma nota com esse título.</p>}
      <textarea
        value={conteudo}
        onChange={e => setConteudo(e.target.value)}
        onBlur={() => { if (conteudo !== nota.conteudo) void salvar({ conteudo }); }}
        placeholder="Escreva aqui…"
        rows={3}
        className="mt-1.5 w-full resize-none bg-transparent text-[0.75rem] text-black/65 outline-none placeholder:text-black/25"
      />
    </div>
  );
}
