"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
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

const PAGE_SIZE = 50;

function escapeOrTerm(value: string) {
  return value.replace(/[%,()]/g, "");
}

export default function AdminPatrocinadoresPage() {
  const router   = useRouter();
  const supabase = createClient();
  const [empresas, setEmpresas]   = useState<Empresa[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => {
      async function load() {
        setLoading(true);
        let query = (supabase as any)
          .from("empresas")
          .select("id, nome, setor, cidade, estado, email_geral, telefone, logo_url, tem_detalhe, aporte_estimado", { count: "exact" })
          .order("nome")
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
        const term = escapeOrTerm(search.trim());
        if (term) query = query.or(`nome.ilike.%${term}%,setor.ilike.%${term}%`);
        const { data, count } = await query;
        setEmpresas(data ?? []);
        setTotal(count ?? 0);
        setLoading(false);
      }
      load();
    }, 250);
    return () => clearTimeout(handle);
  }, [page, search]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(0);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(total, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#0D0D0D]">Patrocinadores</h1>
          <p className="text-sm text-black/40 mt-0.5">
            {total} {search.trim() ? "empresas encontradas" : "empresas cadastradas"}
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            className="pl-9 pr-4 py-2 rounded text-sm outline-none"
            style={{ border: "1px solid rgba(13,13,13,.10)", width: 220 }}
            placeholder="Buscar empresa…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
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
            {empresas.map((e, i) => (
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
        {!loading && empresas.length === 0 && (
          <div className="py-16 text-center text-sm text-black/35">Nenhum resultado</div>
        )}
        {loading && (
          <div className="py-16 text-center">
            <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin mx-auto" />
          </div>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-black/40">
            {rangeStart}–{rangeEnd} de {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-sm transition disabled:opacity-30"
              style={{ border: "1px solid rgba(13,13,13,.10)" }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-xs text-black/45 px-2">Página {page + 1} de {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-sm transition disabled:opacity-30"
              style={{ border: "1px solid rgba(13,13,13,.10)" }}
            >
              Próxima <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
