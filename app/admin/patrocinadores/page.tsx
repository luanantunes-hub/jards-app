"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";

type Empresa = {
  id: string;
  nome: string;
  setor: string | null;
  cidade: string | null;
  estado: string | null;
  email_geral: string | null;
  telefone: string | null;
  logo_url: string | null;
  tem_detalhe: boolean | null;
  aporte_estimado: number | null;
};

export default function AdminPatrocinadoresPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("id, nome, setor, cidade, estado, email_geral, telefone, logo_url, tem_detalhe, aporte_estimado")
        .order("nome");
      setEmpresas(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = empresas.filter((e) =>
    !search || e.nome?.toLowerCase().includes(search.toLowerCase()) ||
    e.setor?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-xl font-bold text-[#0D0D0D]">Patrocinadores</h1>
          <p className="text-sm text-black/40 mt-0.5">{empresas.length} empresas cadastradas</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            className="pl-9 pr-4 py-2 rounded text-sm outline-none"
            style={{ border: "1px solid rgba(13,13,13,.10)", width: 220 }}
            placeholder="Buscar empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(13,13,13,.08)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#FAFAFA", borderBottom: "1px solid rgba(13,13,13,.06)" }}>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-black/40">Empresa</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-black/40">Setor</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-black/40">Localização</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-black/40">Aporte estimado</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-black/40">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={e.id}
                onClick={() => router.push(`/admin/patrocinadores/${e.id}`)}
                className="cursor-pointer transition hover:bg-black/[.02]"
                style={{ borderTop: i > 0 ? "1px solid rgba(13,13,13,.05)" : undefined, background: "white" }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <CompanyLogo nome={e.nome} logo_url={e.logo_url} size={28} />
                    <span className="font-medium text-[#0D0D0D] text-[13px]">{e.nome}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-black/55">{e.setor ?? "—"}</td>
                <td className="px-4 py-3 text-[13px] text-black/55">
                  {[e.cidade, e.estado].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-[13px] text-black/55">
                  {e.aporte_estimado ? `R$ ${Number(e.aporte_estimado).toLocaleString("pt-BR")}` : "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  {e.tem_detalhe
                    ? <Check size={14} className="inline text-[#2E8932]" />
                    : <X size={14} className="inline text-black/25" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-black/35">Nenhum resultado</div>
        )}
      </div>
    </div>
  );
}
