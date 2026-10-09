"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, LogIn } from "lucide-react";

type Usuario = {
  id: string;
  full_name: string | null;
  email: string | null;
  cargo_funcao: string | null;
  tipo_organizacao: string | null;
  plano: string | null;
  onboarding_completed: boolean | null;
  created_at: string;
  papel: string | null;
};

const PAPEL_COLOR: Record<string, { bg: string; text: string }> = {
  admin:       { bg: "#fff", text: "#7259B5" },
  colaborador: { bg: "#fff",  text: "#2E8932" },
  leitor:      { bg: "rgba(13,13,13,.06)",  text: "rgba(13,13,13,.50)" },
  captador:    { bg: "#fff", text: "#2D72B0" },
  visualizador:{ bg: "rgba(13,13,13,.06)",  text: "rgba(13,13,13,.50)" },
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  colaborador: "Colaborador",
  leitor: "Leitor",
  captador: "Captador externo",
  visualizador: "Colaborador",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsuariosPage() {
  const supabase = createClient();
  const [users, setUsers]         = useState<Usuario[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [entering, setEntering]   = useState<string | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, cargo_funcao, tipo_organizacao, plano, onboarding_completed, created_at")
        .order("created_at", { ascending: false });

      const { data: members } = await (supabase as any)
        .from("organization_members")
        .select("user_id, papel");

      const memberMap: Record<string, string> = {};
      (members ?? []).forEach((m: any) => { memberMap[m.user_id] = m.papel; });

      const list = (profiles ?? []).map((p: any) => ({
        ...p,
        papel: memberMap[p.id] ?? null,
      }));
      setUsers(list);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = users.filter((u) =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleEnterAs(userId: string) {
    setEntering(userId);
    setEntryError(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok) { setEntryError(data.error ?? "Erro ao gerar link"); setEntering(null); return; }
      const completeUrl = `/admin/impersonate/complete?token_hash=${encodeURIComponent(data.tokenHash)}&email=${encodeURIComponent(data.email)}`;
      window.open(completeUrl, "_blank", "noopener");
    } catch (e) {
      setEntryError("Erro de rede. Tente novamente.");
    }
    setEntering(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#282525]">Usuários</h1>
          <p className="text-sm text-black/40 mt-0.5">{users.length} usuários cadastrados</p>
        </div>
        <input
          className="px-4 py-2 rounded text-sm outline-none"
          style={{ border: "1px solid rgba(13,13,13,.10)", width: "13.75rem" }}
          placeholder="Buscar usuário…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {entryError && (
        <div className="mb-4 rounded border border-[#D94E4E]/20 bg-white px-4 py-2.5 text-[0.75rem] text-[#991B1B]">
          {entryError}
        </div>
      )}

      <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid rgba(13,13,13,.06)" }}>
              <th className="text-left px-4 py-3 text-[0.6875rem] font-semibold text-black/40">Nome</th>
              <th className="text-left px-4 py-3 text-[0.6875rem] font-semibold text-black/40">Cargo / Tipo</th>
              <th className="text-left px-4 py-3 text-[0.6875rem] font-semibold text-black/40">Plano</th>
              <th className="text-left px-4 py-3 text-[0.6875rem] font-semibold text-black/40">Papel</th>
              <th className="text-left px-4 py-3 text-[0.6875rem] font-semibold text-black/40">Cadastrado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => {
              const papelStyle = u.papel ? (PAPEL_COLOR[u.papel] ?? PAPEL_COLOR.leitor) : null;
              const isEntering = entering === u.id;
              return (
                <tr
                  key={u.id}
                  style={{ borderTop: i > 0 ? "1px solid rgba(13,13,13,.05)" : undefined, background: "white" }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[0.8125rem] text-[#282525]">{u.full_name ?? "—"}</p>
                    <p className="text-[0.6875rem] text-black/40">{u.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] text-black/55">
                    <p>{u.cargo_funcao ?? "—"}</p>
                    {u.tipo_organizacao && <p className="text-[0.6875rem] text-black/35">{u.tipo_organizacao}</p>}
                  </td>
                  <td className="px-4 py-3 text-[0.8125rem] text-black/55">{u.plano ?? "—"}</td>
                  <td className="px-4 py-3">
                    {papelStyle ? (
                      <span
                        className="text-[0.625rem] font-semibold px-2 py-0.5 rounded"
                        style={{ background: papelStyle.bg, color: papelStyle.text, border: `1px solid ${papelStyle.text.startsWith("#") ? papelStyle.text + "47" : "rgba(13,13,13,.12)"}` }}
                      >
                        {PAPEL_LABEL[u.papel ?? ""] ?? u.papel}
                      </span>
                    ) : (
                      <span className="text-[0.8125rem] text-black/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[0.75rem] text-black/40">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void handleEnterAs(u.id)}
                      disabled={!!entering}
                      title="Entrar como este usuário"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[0.6875rem] font-semibold transition disabled:opacity-40"
                      style={{ border: "1px solid rgba(13,13,13,.10)", color: "rgba(13,13,13,.45)" }}
                    >
                      {isEntering
                        ? <span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                        : <LogIn size={11} />}
                      {isEntering ? "Gerando…" : "Entrar como"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <Users size={28} className="text-black/20 mx-auto mb-2" />
            <p className="text-sm text-black/35">Nenhum resultado</p>
          </div>
        )}
      </div>
    </div>
  );
}
