"use client";
import { useState, useEffect, useCallback } from "react";
import { Check, ChevronUp, ChevronDown, MessageCircle, Pencil, ClipboardCheck, UserCheck, Sparkles, Layers, TrendingUp, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Comentario, ComentarioTopico } from "@/lib/supabase/types";
import { TOPICO_META } from "@/lib/supabase/types";

const TOPICO_ICON: Record<ComentarioTopico, LucideIcon> = {
  processo_selecao:      ClipboardCheck,
  tomador_decisao:       UserCheck,
  experiencia_patrocinio: Sparkles,
  tipo_projetos:         Layers,
  valor_empresa:         TrendingUp,
};

type Props = {
  empresaId: string;
  embedded?: boolean;
  composerOpen?: boolean;
  onComposerOpenChange?: (open: boolean) => void;
};

export function ComentarioFeed({ empresaId, embedded = false, composerOpen, onComposerOpenChange }: Props) {
  const supabase = createClient();
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [filtro, setFiltro] = useState<ComentarioTopico | "todos">("todos");
  const [meusVotos, setMeusVotos] = useState<Record<string, number>>({});
  const [showNovo, setShowNovo] = useState(false);
  const isComposerOpen = composerOpen ?? showNovo;
  const setComposerOpen = (open: boolean) => {
    setShowNovo(open);
    onComposerOpenChange?.(open);
  };

  const fetchComentarios = useCallback(async () => {
    const query = supabase
      .from("comentarios")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("status", "aprovado")
      .order("votos", { ascending: false })
      .order("created_at", { ascending: false });

    if (filtro !== "todos") query.eq("topico", filtro);

    const { data } = await query;
    setComentarios((data as Comentario[]) ?? []);

    const ids = (data as Comentario[])?.map(c => c.id) ?? [];
    if (ids.length > 0) {
      const { data: votos } = await supabase
        .from("comentario_votos")
        .select("comentario_id, valor")
        .in("comentario_id", ids);
      const map: Record<string, number> = {};
      votos?.forEach((v: any) => { map[v.comentario_id] = v.valor; });
      setMeusVotos(map);
    }
  }, [empresaId, filtro, supabase]);

  useEffect(() => { fetchComentarios(); }, [fetchComentarios]);

  async function handleVoto(comentarioId: string, valor: 1 | -1) {
    const { data } = await (supabase as any).rpc("fn_toggle_voto", {
      p_comentario_id: comentarioId,
      p_valor: valor,
    });
    setMeusVotos(prev => {
      const atual = prev[comentarioId];
      return { ...prev, [comentarioId]: atual === valor ? 0 : valor };
    });
    setComentarios(prev =>
      prev.map(c => c.id === comentarioId ? { ...c, votos: data ?? c.votos } : c)
    );
  }

  const topicos = Object.entries(TOPICO_META) as [ComentarioTopico, typeof TOPICO_META[ComentarioTopico]][];

  return (
    <div>
      {/* Header */}
      {!embedded && <div className="px-5 py-4 justify-between border-b flex items-center" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        {!embedded && <div>
          <p className="text-sm font-semibold text-black">
            Experiências{comentarios.length > 0 && <span className="text-black/30 font-normal text-xs ml-1.5">({comentarios.length})</span>}
          </p>
        </div>}
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-[0.75rem] font-medium bg-white rounded hover:bg-black/[.04] transition"
          style={{ color: "rgba(13,13,13,.65)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(13,13,13,.15)" }}
        >
          <Pencil size={12} /> Experiência
        </button>
      </div>}

      <div className="p-5">
        {/* Filtros */}
        <div className="flex gap-1.5 mb-5 flex-wrap">
          <button
            onClick={() => setFiltro("todos")}
            className={`px-2.5 py-1 rounded text-[0.625rem] font-bold transition border ${
              filtro === "todos"
                ? "bg-white border-black/20 text-black"
                : "bg-white border-black/[.08] text-black/40 hover:bg-black/[.04]"
            }`}
          >
            Todos
          </button>
          {topicos.map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setFiltro(key)}
              className="px-2.5 py-1 rounded text-[0.625rem] font-bold transition border bg-white"
              style={{
                borderColor: filtro === key ? meta.color : "rgba(13,13,13,.08)",
                color: filtro === key ? meta.color : "rgba(0,0,0,.4)",
              }}
            >
              {meta.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {comentarios.length === 0 ? (
          <div className="text-center py-10">
            <MessageCircle size={22} className="mx-auto text-black/10 mb-2" />
            <p className="text-[0.75rem] text-black/30">
              {filtro === "todos"
                ? "Nenhum relato ainda. Seja o primeiro a contar."
                : "Nenhum relato neste tópico."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {comentarios.map(c => {
              const meta = TOPICO_META[c.topico];
              const meuVoto = meusVotos[c.id] ?? 0;
              return (
                <div
                  key={c.id}
                  className="flex gap-3 p-3 rounded border transition hover:border-black/12"
                  style={{ borderColor: "rgba(13,13,13,.06)" }}
                >
                  {/* Votos */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                    <button
                      onClick={() => handleVoto(c.id, 1)}
                      className="p-0.5 rounded transition hover:bg-black/5"
                      title="Útil"
                    >
                      <ChevronUp size={14} className={meuVoto === 1 ? "text-[#2E8932]" : "text-black/20"} />
                    </button>
                    <span className={`text-[0.6875rem] font-bold ${c.votos > 0 ? "text-[#2E8932]" : "text-black/25"}`}>
                      {c.votos}
                    </span>
                    <button
                      onClick={() => handleVoto(c.id, -1)}
                      className="p-0.5 rounded transition hover:bg-black/5"
                      title="Não útil"
                    >
                      <ChevronDown size={14} className={meuVoto === -1 ? "text-[#D94E4E]" : "text-black/20"} />
                    </button>
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="rounded border bg-white px-1.5 py-0.5 text-[0.5625rem] font-medium uppercase tracking-wide"
                        style={{ borderColor: `${meta.color}47`, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[0.75rem] text-black/70 leading-relaxed">{c.conteudo}</p>
                    <p className="text-[0.5625rem] text-black/20 mt-2">
                      {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isComposerOpen && (
        <NovoComentarioModal
          empresaId={empresaId}
          onClose={() => setComposerOpen(false)}
          onSaved={() => { setComposerOpen(false); fetchComentarios(); }}
        />
      )}
    </div>
  );
}

function NovoComentarioModal({
  empresaId,
  onClose,
  onSaved,
}: {
  empresaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [topico, setTopico] = useState<ComentarioTopico>("experiencia_patrocinio");
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const topicos = Object.entries(TOPICO_META) as [ComentarioTopico, typeof TOPICO_META[ComentarioTopico]][];

  async function handleSubmit() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await (supabase as any).from("comentarios").insert({
      empresa_id: empresaId,
      autor_id: user.id,
      topico,
      conteudo: conteudo.trim(),
    });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(onSaved, 1000);
    }
  }

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white rounded shadow-2xl w-full max-w-md p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-10 h-10 rounded flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(13,13,13,.04)" }}>
            <MessageCircle size={18} className="text-[#2E8932]" />
          </div>
          <h2 className="text-[0.9375rem] font-bold text-[#0D0D0D] mb-1">Obrigado por compartilhar!</h2>
          <p className="text-[0.8125rem] text-black/45">Sua experiência ajuda toda a comunidade.</p>
        </div>
      </div>
    );
  }

  const meta = TOPICO_META[topico];
  const ActiveIcon = TOPICO_ICON[topico];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <h2 className="text-[0.875rem] font-semibold text-[#0D0D0D]">Contar experiência</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 transition text-black/35 hover:text-black/55">
            <X size={15} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-[0.625rem] font-bold text-black/35 uppercase tracking-wide mb-2">Tópico</p>
          <div className="flex flex-col gap-1 mb-5">
            {topicos.map(([key, m]) => {
              const Icon = TOPICO_ICON[key];
              const isSelected = topico === key;
              return (
                <button
                  key={key}
                  onClick={() => setTopico(key)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-all ${
                    isSelected ? "" : "hover:bg-black/[.025] hover:border-black/[.12]"
                  }`}
                  style={isSelected
                    ? { borderColor: m.color, background: "rgba(13,13,13,.04)" }
                    : { borderColor: "rgba(13,13,13,.08)" }
                  }
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(13,13,13,.05)" }}
                  >
                    <Icon size={12} style={{ color: isSelected ? m.color : "rgba(0,0,0,.30)" }} />
                  </div>
                  <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <p className="text-[0.75rem] font-medium leading-tight text-[#0D0D0D]">
                      {m.label}
                    </p>
                    <p className="text-[0.625rem] text-black/30 truncate">{m.desc}</p>
                  </div>
                  {/* Indicador de seleção */}
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    {isSelected && <Check size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#0D0D0D]" />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dica contextual */}
          <div className="flex items-center gap-2 px-3 py-2 rounded mb-4 bg-black/[.04]">
            <ActiveIcon size={12} style={{ color: meta.color, flexShrink: 0 }} />
            <p className="text-[0.625rem] font-medium text-black/55">
              {topico === "processo_selecao"      && "Como é o processo? É transparente? Costuma dar certo?"}
              {topico === "tomador_decisao"       && "Quem decide? É acessível? Costuma responder?"}
              {topico === "experiencia_patrocinio" && "Como foi a experiência de ser patrocinado por eles?"}
              {topico === "tipo_projetos"         && "Que tipo de projeto eles patrocinam? Tem perfil?"}
              {topico === "valor_empresa"         && "O que gera valor para eles? O que chama atenção?"}
            </p>
          </div>

          <textarea
            value={conteudo}
            onChange={e => setConteudo(e.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Compartilhe sua experiência..."
            className="w-full px-3 py-2.5 text-[0.8125rem] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition resize-none"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
          <div className="flex justify-between items-center mt-1 mb-5">
            <span className="text-[0.5625rem] text-black/25">Anônimo para outros usuários</span>
            <span className="text-[0.5625rem] text-black/25">{conteudo.length}/1200</span>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[0.8125rem] font-medium text-black/35 hover:text-black/55 transition">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || conteudo.trim().length < 10}
              className="flex items-center gap-1.5 px-5 py-2 text-[0.8125rem] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
            >
              {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
              Publicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
