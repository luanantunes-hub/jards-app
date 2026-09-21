"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Compass } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  indicacao: "Indicação de alguém",
  google: "Busca no Google",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  evento: "Evento ou encontro",
  outro: "Outro lugar",
  _null: "Não respondeu",
};

const SOURCE_ORDER = ["indicacao", "google", "instagram", "linkedin", "evento", "outro", "_null"];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [primeiro, setPrimeiro] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("onde_conheceu, created_at")
        .order("created_at", { ascending: true });

      const rows = (data ?? []) as { onde_conheceu: string | null; created_at: string }[];
      const map: Record<string, number> = {};
      for (const r of rows) {
        const key = r.onde_conheceu ?? "_null";
        map[key] = (map[key] ?? 0) + 1;
      }
      setCounts(map);
      setTotal(rows.length);
      setPrimeiro(rows[0]?.created_at ?? null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin" />
      </div>
    );
  }

  const respondidos = total - (counts["_null"] ?? 0);
  const maxCount = Math.max(...SOURCE_ORDER.map((k) => counts[k] ?? 0), 1);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0D0D0D]">Dashboard</h1>
        <p className="text-sm text-black/40 mt-0.5">
          {total} usuários cadastrados{primeiro ? ` desde ${fmtDate(primeiro)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded p-5" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
          <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide">Cadastros</p>
          <p className="text-2xl font-bold text-[#0D0D0D] mt-1 tabular-nums">{total}</p>
        </div>
        <div className="rounded p-5" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
          <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide">Responderam a origem</p>
          <p className="text-2xl font-bold text-[#0D0D0D] mt-1 tabular-nums">{respondidos}</p>
        </div>
        <div className="rounded p-5" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
          <p className="text-[11px] font-semibold text-black/40 uppercase tracking-wide">Taxa de resposta</p>
          <p className="text-2xl font-bold text-[#0D0D0D] mt-1 tabular-nums">
            {total > 0 ? Math.round((respondidos / total) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="rounded p-6" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
        <div className="flex items-center gap-2 mb-5">
          <Compass size={15} className="text-black/40" />
          <h2 className="text-sm font-bold text-[#0D0D0D]">Onde conheceu a Jards?</h2>
        </div>

        {respondidos === 0 ? (
          <p className="text-sm text-black/35 text-center py-8">Ainda não há respostas.</p>
        ) : (
          <div className="space-y-3">
            {SOURCE_ORDER.map((key) => {
              const count = counts[key] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const isNull = key === "_null";
              return (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className={`text-[12.5px] w-40 flex-shrink-0 ${isNull ? "text-black/35 italic" : "text-black/60 font-medium"}`}
                  >
                    {SOURCE_LABELS[key]}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-black/6 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        background: isNull ? "rgba(13,13,13,.15)" : "#7259B5",
                      }}
                    />
                  </div>
                  <span className="text-[12px] font-bold text-black/50 w-16 text-right tabular-nums">
                    {count} <span className="font-normal text-black/30">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
