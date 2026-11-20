"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, UserPlus, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ContatoSugestao } from "@/lib/supabase/types";

type Props = { empresaId: string };

export function SugestaoContatoList({ empresaId }: Props) {
  const supabase = createClient();
  const [sugestoes, setSugestoes] = useState<ContatoSugestao[]>([]);
  const [meusVotos, setMeusVotos] = useState<Record<string, number>>({});
  const [showForm, setShowForm] = useState(false);

  const fetchSugestoes = useCallback(async () => {
    const { data } = await supabase
      .from("contatos_sugestoes")
      .select("*")
      .eq("empresa_id", empresaId)
      .in("status", ["pendente", "aprovado"])
      .order("votos_positivos", { ascending: false });

    setSugestoes((data as ContatoSugestao[]) ?? []);

    const ids = (data as ContatoSugestao[])?.map(s => s.id) ?? [];
    if (ids.length > 0) {
      const { data: votos } = await supabase
        .from("contato_sugestao_votos")
        .select("sugestao_id, valor")
        .in("sugestao_id", ids);
      const map: Record<string, number> = {};
      votos?.forEach(v => { map[(v as any).sugestao_id] = (v as any).valor; });
      setMeusVotos(map);
    }
  }, [empresaId, supabase]);

  useEffect(() => { fetchSugestoes(); }, [fetchSugestoes]);

  async function handleVoto(sugestaoId: string, valor: 1 | -1) {
    await (supabase as any).rpc("fn_votar_sugestao_contato", {
      p_sugestao_id: sugestaoId,
      p_valor: valor,
    });
    fetchSugestoes();
  }

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div>
          <p className="text-sm font-semibold text-[#282525]">
            Contatos sugeridos{sugestoes.length > 0 && <span className="text-black/30 font-normal text-xs ml-1.5">({sugestoes.length})</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-[0.75rem] font-medium bg-white rounded hover:bg-black/[.04] transition"
          style={{ color: "rgba(13,13,13,.65)", borderWidth: 1, borderStyle: "solid", borderColor: "rgba(13,13,13,.15)" }}
        >
          <UserPlus size={11} /> Sugerir
        </button>
      </div>

      <div className="p-5">
        {showForm && (
          <FormSugestaoContato
            empresaId={empresaId}
            onSaved={() => { setShowForm(false); fetchSugestoes(); }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {sugestoes.length === 0 && !showForm ? (
          <div className="text-center py-8">
            <UserPlus size={20} className="mx-auto text-black/10 mb-2" />
            <p className="text-[0.6875rem] text-black/30">Nenhum contato sugerido ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sugestoes.map(s => {
              const meuVoto = meusVotos[s.id] ?? 0;
              const saldo = s.votos_positivos - s.votos_negativos;
              const isPromovido = s.status === "promovido";
              return (
                <div
                  key={s.id}
                  className="flex gap-3 p-3 rounded border transition"
                  style={{
                    borderColor: isPromovido ? "#2E8932" : "rgba(13,13,13,.06)",
                    background: isPromovido ? "#fff" : "white",
                  }}
                >
                  {/* Votos */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                    <button
                      onClick={() => handleVoto(s.id, 1)}
                      className="p-0.5 rounded transition hover:bg-black/5"
                    >
                      <ChevronUp size={14} className={meuVoto === 1 ? "text-[#2E8932]" : "text-black/20"} />
                    </button>
                    <span className={`text-[0.75rem] font-semibold tabular-nums ${saldo === 0 ? "text-black/30" : "text-[#282525]"}`}>
                      {saldo}
                    </span>
                    <button
                      onClick={() => handleVoto(s.id, -1)}
                      className="p-0.5 rounded transition hover:bg-black/5"
                    >
                      <ChevronDown size={14} className={meuVoto === -1 ? "text-[#D94E4E]" : "text-black/20"} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[0.75rem] font-semibold text-[#282525]">{s.nome}</p>
                      {isPromovido && (
                        <span className="text-[0.5625rem] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5" style={{ background: "#fff", border: "1px solid #2E893247", color: "#2E8932" }}>
                          <Check size={9} /> Adicionado
                        </span>
                      )}
                    </div>
                    {s.cargo && <p className="text-[0.6875rem] text-black/45">{s.cargo}</p>}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="text-[0.625rem] text-black/60 hover:text-[#282525] transition">
                        {s.email}
                      </a>
                    )}
                    {s.justificativa && (
                      <p className="text-[0.625rem] text-black/35 mt-1 italic">"{s.justificativa}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FormSugestaoContato({
  empresaId,
  onSaved,
  onCancel,
}: {
  empresaId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const supabase = createClient();
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await (supabase as any).from("contatos_sugestoes").insert({
      empresa_id: empresaId,
      autor_id: user.id,
      nome: nome.trim(),
      cargo: cargo.trim() || null,
      email: email.trim() || null,
      linkedin_url: linkedin.trim() || null,
      justificativa: justificativa.trim() || null,
    });

    setSaving(false);
    if (!error) onSaved();
  }

  return (
    <div className="p-4 rounded border mb-4" style={{ borderColor: "rgba(13,13,13,.08)", background: "#FAFAFA" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[0.6875rem] font-bold text-black/50 uppercase tracking-wide">Sugerir contato</p>
        <button onClick={onCancel} className="text-black/35 hover:text-black/55 transition">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2">
        <input
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Nome completo *"
          className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
          style={{ borderColor: "rgba(13,13,13,.10)" }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            placeholder="Cargo"
            className="px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
            style={{ borderColor: "rgba(13,13,13,.10)" }}
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="E-mail"
            className="px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
            style={{ borderColor: "rgba(13,13,13,.10)" }}
          />
        </div>
        <input
          value={linkedin}
          onChange={e => setLinkedin(e.target.value)}
          placeholder="LinkedIn (url)"
          className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
          style={{ borderColor: "rgba(13,13,13,.10)" }}
        />
        <textarea
          value={justificativa}
          onChange={e => setJustificativa(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="Por que esse contato é relevante?"
          className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20 resize-none"
          style={{ borderColor: "rgba(13,13,13,.10)" }}
        />
      </div>
      <div className="flex justify-end gap-3 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 text-[0.6875rem] font-medium text-black/35 hover:text-black/55 transition">
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !nome.trim()}
          className="flex items-center gap-1 px-4 py-1.5 text-[0.75rem] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
        >
          {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
          Sugerir
        </button>
      </div>
    </div>
  );
}
