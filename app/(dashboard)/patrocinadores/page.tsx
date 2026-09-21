"use client";
import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  MagnifyingGlass,
  Image as ImageIcon,
  Buildings,
  Crosshair,
  Tag,
  MapPin,
  House,
  ChartBar,
  CaretUp,
  CaretDown,
  X,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { FilterButton, SegmentedControl } from "@/components/ui/FilterControls";
import type { Empresa } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { PesquisaEmpresaModal } from "@/components/modals/PesquisaEmpresaModal";
import { BoasVindasPlanoModal } from "@/components/modals/BoasVindasPlanoModal";
import { useCreditos } from "@/contexts/CreditosContext";

type Lei = "esporte" | "ancine";

type EmpresaLei = {
  empresa_id: string;
  valor: number;
  empresas: {
    nome: string;
    logo_url: string | null;
    site: string | null;
    setor: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
};

function LeiTabContent({ lei }: { lei: Lei }) {
  const router = useRouter();
  const supabase = createClient();
  const [linhas, setLinhas] = useState<EmpresaLei[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [setor, setSetor] = useState("");
  const [setores, setSetores] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    supabase.from("empresas").select("setor").not("setor", "is", null).then(({ data }) => {
      if (data) setSetores([...new Set((data as { setor: string | null }[]).map((r) => r.setor).filter((s): s is string => !!s))].sort());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPage(0); }, [lei, dSearch, estado, setor]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let q = supabase
        .from("investimentos_por_lei")
        .select("empresa_id, valor, empresas!inner(nome, logo_url, site, setor, cidade, estado)", { count: "exact" })
        .eq("lei", lei)
        .eq("ano", 2025);

      const s = dSearch.trim();
      if (s) q = q.or(`nome.ilike.%${s}%,setor.ilike.%${s}%,cidade.ilike.%${s}%`, { foreignTable: "empresas" });
      if (estado) q = q.eq("empresas.estado", estado);
      if (setor) q = q.eq("empresas.setor", setor);

      const { data, count } = await q
        .order("valor", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (cancelled) return;
      setLinhas((data ?? []) as any);
      setTotal(count ?? 0);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [lei, page, dSearch, estado, setor]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(search || estado || setor);

  return (
    <div className="px-8 pb-8">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, setor, cidade…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
        </div>
        <CustomDropdown
          value={estado}
          onChange={setEstado}
          options={ESTADOS_BR.map((uf) => ({ value: uf, label: uf }))}
          placeholder="Estado"
          icon={<MapPin size={13} />}
          compact
          emphasized={false}
        />
        <CustomDropdown
          value={setor}
          onChange={setSetor}
          options={setores.map((s) => ({ value: s, label: s }))}
          placeholder="Setor"
          icon={<Buildings size={13} />}
          compact
          emphasized={false}
        />
        {hasFilters && (
          <FilterButton onClick={() => { setSearch(""); setEstado(""); setSetor(""); }}>
            <X size={12} />
            Limpar
          </FilterButton>
        )}
      </div>

      <div className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F9F9F8" }}>
                {[
                  { label: "Logo", icon: <ImageIcon size={11} weight="bold" /> },
                  { label: "Empresa", icon: <Buildings size={11} weight="bold" /> },
                  { label: "Ver", icon: <Crosshair size={11} weight="bold" /> },
                  { label: "Setor", icon: <Tag size={11} weight="bold" /> },
                  { label: "Estado", icon: <MapPin size={11} weight="bold" /> },
                  { label: "Cidade", icon: <House size={11} weight="bold" /> },
                  { label: "Investimento", icon: <ChartBar size={11} weight="bold" /> },
                ].map(({ label, icon }) => (
                  <th key={label} className="px-4 py-3 text-left">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-black/35 uppercase tracking-wider whitespace-nowrap">
                      <span className="text-black/30">{icon}</span>
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={7}><div className="h-6 bg-black/8 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : linhas.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-20 text-center text-sm text-black/35">Nenhuma empresa encontrada.</td></tr>
              ) : (
                linhas.map((l) => (
                  <tr
                    key={l.empresa_id}
                    className="hover:bg-black/[0.025] transition-colors cursor-pointer group"
                    onClick={() => router.push(`/patrocinadores/${l.empresa_id}?lei=${lei}`)}
                  >
                    <td className="px-4 py-3">
                      <CompanyLogo nome={l.empresas?.nome ?? ""} site={l.empresas?.site} logo_url={l.empresas?.logo_url} size={32} className="rounded border border-black/8" />
                    </td>
                    <td className="px-4 py-3"><span className="font-semibold text-[#0D0D0D] text-[13px]">{l.empresas?.nome}</span></td>
                    <td className="px-4 py-3">
                      <button
                        className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150
                          text-black/25 bg-transparent
                          group-hover:bg-[#F2F2F2] group-hover:text-[#684DB0]"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          router.push(`/patrocinadores/${l.empresa_id}?lei=${lei}`);
                        }}
                        title="Ver perfil"
                      >
                        <Crosshair size={14} weight="bold" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-black/50 text-[12.5px]">{l.empresas?.setor ?? "—"}</td>
                    <td className="px-4 py-3 text-black/50 text-[12.5px] font-medium">{l.empresas?.estado ?? "—"}</td>
                    <td className="px-4 py-3 text-black/50 text-[12.5px]">{l.empresas?.cidade ?? "—"}</td>
                    <td className="px-4 py-3"><span className="font-bold text-[#0D0D0D] text-[13px] tabular-nums">{fmt(l.valor)}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
      </div>
    </div>
  );
}

const PAGE_SIZE = 25;

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

type SortCol = "nome" | "aporte_estimado";
type Trimestre = "T1" | "T2" | "T3" | "T4";
type PaidPlan = "basico" | "profissional";

const fmt = (v: number | null) => {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000) return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v}`;
};

function colorFrom(nome: string) {
  const palette = [
    "#22763F","#8B5CF6","#F59E0B","#0EA5E9","#1D4ED8",
    "#F97316","#92400E","#3B82F6","#047857","#E11D48","#6B7280",
  ];
  let h = 0;
  for (const c of nome) h = c.charCodeAt(0) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const getPages = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const out: (number | "…")[] = [0];
    if (page > 2) out.push("…");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) out.push(i);
    if (page < totalPages - 3) out.push("…");
    out.push(totalPages - 1);
    return out;
  };

  const btn = "w-8 h-8 rounded text-xs font-semibold transition flex items-center justify-center";

  return (
    <div className="flex items-center justify-center gap-1 px-4 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <button
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={`${btn} text-black/40 hover:bg-black/6 disabled:opacity-25 disabled:cursor-not-allowed`}
      >
        <CaretLeft size={14} />
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-black/30">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`${btn} ${p === page ? "bg-[#684DB0] text-white" : "text-black/50 hover:bg-black/6"}`}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
        className={`${btn} text-black/40 hover:bg-black/6 disabled:opacity-25 disabled:cursor-not-allowed`}
      >
        <CaretRight size={14} />
      </button>
    </div>
  );
}

function PatrocinadoresContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { solicitarPesquisaEmpresa } = useCreditos();
  const topRef = useRef<HTMLDivElement>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => Number(searchParams.get("p") ?? 0));

  // Filters — inicializa da URL
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [dSearch, setDSearch] = useState(() => searchParams.get("q") ?? "");
  const [estado, setEstado] = useState(() => searchParams.get("uf") ?? "");
  const [setor, setSetor] = useState(() => searchParams.get("setor") ?? "");
  const [trimestre, setTrimestre] = useState<Trimestre | null>(() => (searchParams.get("tri") as Trimestre) ?? null);
  const [sortCol, setSortCol] = useState<SortCol>(() => (searchParams.get("sort") as SortCol) ?? "aporte_estimado");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (searchParams.get("dir") as "asc" | "desc") ?? "desc");
  const [setores, setSetores] = useState<string[]>([]);
  const [empresaPesquisa, setEmpresaPesquisa] = useState<Empresa | null>(null);
  const [usuarioNome, setUsuarioNome] = useState("Olá");
  const [priorizandoPesquisa, setPriorizandoPesquisa] = useState(false);
  const [pesquisaConcluida, setPesquisaConcluida] = useState(false);
  const [pesquisaJaSolicitada, setPesquisaJaSolicitada] = useState(false);
  const [pesquisaErro, setPesquisaErro] = useState<string | null>(null);
  const [welcomePlan, setWelcomePlan] = useState<PaidPlan | null>(() => {
    if (searchParams.get("welcome") !== "paid") return null;
    const plan = searchParams.get("plan");
    return plan === "basico" || plan === "profissional" ? plan : null;
  });

  useEffect(() => {
    let active = true;

    async function loadUserName() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      const fullName = profile?.full_name
        || user.user_metadata?.full_name
        || user.user_metadata?.name
        || "";
      const firstName = String(fullName).trim().split(/\s+/)[0];
      if (firstName) setUsuarioNome(firstName);
    }

    void loadUserName();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza filtros na URL — pula o primeiro render (estado já vem da URL)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const params = new URLSearchParams();
    if (dSearch)   params.set("q", dSearch);
    if (estado)    params.set("uf", estado);
    if (setor)     params.set("setor", setor);
    if (trimestre) params.set("tri", trimestre);
    if (sortCol !== "aporte_estimado") params.set("sort", sortCol);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page > 0)  params.set("p", String(page));
    const qs = params.toString();
    router.replace(`/patrocinadores${qs ? `?${qs}` : ""}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch, estado, setor, trimestre, sortCol, sortDir, page]);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load distinct setores for dropdown
  useEffect(() => {
    supabase
      .from("empresas")
      .select("setor")
      .not("setor", "is", null)
      .then(({ data }) => {
        if (data) {
          const rows = data as Array<{ setor: string | null }>;
          const unique = [
            ...new Set(rows.map((r) => r.setor).filter((s): s is string => !!s)),
          ].sort();
          setSetores(unique);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildQuery(pageIndex: number) {
    let q = supabase
      .from("empresas")
      .select(
        "id, nome, setor, cidade, estado, site, logo_url, aporte_estimado, trimestre_1, trimestre_2, trimestre_3, trimestre_4, tem_detalhe",
        { count: "exact" }
      );

    const s = dSearch.trim();
    if (s) q = q.or(`nome.ilike.%${s}%,setor.ilike.%${s}%,cidade.ilike.%${s}%`);
    if (estado) q = q.eq("estado", estado);
    if (setor) q = q.eq("setor", setor);
    if (trimestre === "T1") q = q.eq("trimestre_1", true);
    if (trimestre === "T2") q = q.eq("trimestre_2", true);
    if (trimestre === "T3") q = q.eq("trimestre_3", true);
    if (trimestre === "T4") q = q.eq("trimestre_4", true);

    q = q.order(sortCol, { ascending: sortDir === "asc", nullsFirst: false });
    q = q.range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

    return q;
  }

  // Reload on filter/sort change
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      const { data, count, error } = await buildQuery(0);
      if (cancelled) return;
      if (!error && data) {
        setEmpresas(data as Empresa[]);
        setTotal(count ?? 0);
        setPage(0);
      }
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch, estado, setor, trimestre, sortCol, sortDir]);

  async function goToPage(n: number) {
    setLoading(true);
    const { data, count, error } = await buildQuery(n);
    if (!error && data) {
      setEmpresas(data as Empresa[]);
      setTotal(count ?? 0);
      setPage(n);
    }
    setLoading(false);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  function clearFilters() {
    setSearch("");
    setEstado("");
    setSetor("");
    setTrimestre(null);
  }

  const closeWelcome = useCallback(() => {
    setWelcomePlan(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("welcome");
    params.delete("plan");
    const query = params.toString();
    router.replace(`/patrocinadores${query ? `?${query}` : ""}`, { scroll: false });
  }, [router]);

  function abrirEmpresa(empresa: Empresa) {
    if (empresa.tem_detalhe) {
      router.push(`/patrocinadores/${empresa.id}`);
      return;
    }

    setEmpresaPesquisa(empresa);
    setPesquisaConcluida(false);
    setPesquisaJaSolicitada(false);
    setPesquisaErro(null);
  }

  function fecharPesquisa() {
    if (priorizandoPesquisa) return;
    setEmpresaPesquisa(null);
    setPesquisaConcluida(false);
    setPesquisaJaSolicitada(false);
    setPesquisaErro(null);
  }

  async function iniciarPesquisa() {
    if (!empresaPesquisa || priorizandoPesquisa) return;

    setPriorizandoPesquisa(true);
    setPesquisaErro(null);
    const resultado = await solicitarPesquisaEmpresa(empresaPesquisa.id);
    setPriorizandoPesquisa(false);

    if (!resultado.sucesso) {
      setPesquisaErro(resultado.erro ?? "Não foi possível priorizar esta busca. Tente novamente.");
      return;
    }

    setPesquisaJaSolicitada(resultado.jaSolicitada);
    setPesquisaConcluida(true);
  }

  const hasFilters = !!(search || estado || setor || trimestre);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? (
      sortDir === "asc" ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />
    ) : (
      <CaretDown size={11} className="opacity-20" />
    );

  const columns: { label: string; icon: React.ReactNode; col?: SortCol }[] = [
    { label: "Logo",         icon: <ImageIcon size={11} weight="bold" /> },
    { label: "Empresa",      icon: <Buildings size={11} weight="bold" />, col: "nome" },
    { label: "Ver",          icon: <Crosshair size={11} weight="bold" /> },
    { label: "Setor",        icon: <Tag       size={11} weight="bold" /> },
    { label: "Estado",       icon: <MapPin    size={11} weight="bold" /> },
    { label: "Cidade",       icon: <House     size={11} weight="bold" /> },
    { label: "Investimento", icon: <ChartBar  size={11} weight="bold" />, col: "aporte_estimado" },
  ];

  return (
    <div className="px-8 pb-8" ref={topRef}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, setor, cidade…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
        </div>

        {/* Estado */}
        <CustomDropdown
          value={estado}
          onChange={setEstado}
          options={ESTADOS_BR.map(uf => ({ value: uf, label: uf }))}
          placeholder="Estado"
          icon={<MapPin size={13} />}
          compact
          emphasized={false}
        />

        {/* Setor */}
        <CustomDropdown
          value={setor}
          onChange={setSetor}
          options={setores.map(s => ({ value: s, label: s }))}
          placeholder="Setor"
          icon={<Buildings size={13} />}
          compact
          emphasized={false}
        />

        {/* Botões de controle: trimestre de investimento */}
        <SegmentedControl
          value={trimestre}
          onChange={(value) => setTrimestre(value === trimestre ? null : value)}
          ariaLabel="Filtrar patrocinadores por trimestre"
          options={(["T1", "T2", "T3", "T4"] as Trimestre[]).map((value) => ({ value, label: value }))}
        />

        {/* Botão de controle auxiliar: limpar filtros */}
        {hasFilters && (
          <FilterButton onClick={clearFilters}>
            <X size={12} />
            Limpar
          </FilterButton>
        )}
      </div>

      {/* Table */}
      <div className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F9F9F8" }}>
                {columns.map(({ label, icon, col }) => (
                  <th
                    key={label}
                    onClick={() => col && toggleSort(col)}
                    className={`px-4 py-3 text-left select-none ${col ? "cursor-pointer hover:bg-black/[0.02]" : ""}`}
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-black/35 uppercase tracking-wider whitespace-nowrap">
                      <span className="text-black/30">{icon}</span>
                      {label}
                      {col && <SortIcon col={col} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="w-8 h-8 rounded bg-black/8 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 w-44 bg-black/8 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="w-7 h-7 rounded-full bg-black/8 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-24 bg-black/8 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-8 bg-black/8 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-28 bg-black/8 rounded animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-3.5 w-16 bg-black/8 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : empresas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center text-sm text-black/35">
                    Nenhuma empresa encontrada com os filtros selecionados
                  </td>
                </tr>
              ) : (
                empresas.map((e, i) => {
                  const color = colorFrom(e.nome);
                  const initials = e.nome.slice(0, 2).toUpperCase();
                  return (
                    <tr
                      key={e.id}
                      className="hover:bg-black/[0.025] transition-colors cursor-pointer group"
                      onClick={() => abrirEmpresa(e)}
                    >
                      {/* Logo */}
                      <td className="px-4 py-3">
                        <CompanyLogo
                          nome={e.nome}
                          site={e.site}
                          logo_url={e.logo_url}
                          size={32}
                          className="rounded border border-black/8"
                        />
                      </td>

                      {/* Empresa */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#0D0D0D] text-[13px]">{e.nome}</span>
                      </td>

                      {/* Ver */}
                      <td className="px-4 py-3">
                        <button
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150
                            text-black/25 bg-transparent
                            group-hover:bg-[#F2F2F2] group-hover:text-[#684DB0]"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            abrirEmpresa(e);
                          }}
                          title={e.tem_detalhe ? "Ver perfil" : "Solicitar pesquisa"}
                        >
                          <Crosshair size={14} weight="bold" />
                        </button>
                      </td>

                      {/* Setor */}
                      <td className="px-4 py-3 text-black/50 text-[12.5px]">{e.setor ?? "—"}</td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-black/50 text-[12.5px] font-medium">{e.estado ?? "—"}</td>

                      {/* Cidade */}
                      <td className="px-4 py-3 text-black/50 text-[12.5px]">{e.cidade ?? "—"}</td>

                      {/* Investimento */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-[#0D0D0D] text-[13px]">
                          {fmt(e.aporte_estimado)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && <Pagination page={page} totalPages={totalPages} onChange={goToPage} />}
      </div>

      {empresaPesquisa && (
        <PesquisaEmpresaModal
          empresaNome={empresaPesquisa.nome}
          usuarioNome={usuarioNome}
          loading={priorizandoPesquisa}
          concluida={pesquisaConcluida}
          jaSolicitada={pesquisaJaSolicitada}
          erro={pesquisaErro}
          onClose={fecharPesquisa}
          onStart={iniciarPesquisa}
        />
      )}

      <BoasVindasPlanoModal plano={welcomePlan} onClose={closeWelcome} />
    </div>
  );
}

function AbaBotao({ active, onClick, icon, label, position }: { active: boolean; onClick: () => void; icon: string; label: string; position: "left" | "middle" | "right" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-1.5 px-3.5 text-[12px] font-medium transition active:scale-[.98] ${
        active ? "bg-[#0D0D0D] text-white" : "bg-white text-black/45 hover:bg-black/[.04] hover:text-black/65"
      } ${position !== "right" ? "border-r border-black/10" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={active ? `/aba-${icon}-white.svg` : `/aba-${icon}-color.svg`} alt="" className="h-5 w-5" />
      {label}
    </button>
  );
}

export default function PatrocinadoresPage() {
  const [aba, setAba] = useState("cultura");

  return (
    <div className="min-h-full" style={{ background: "#F2F2F2" }}>
      <div className="px-8 pt-8 pb-6 flex items-end justify-between">
        <h1 className="font-bold text-[#0D0D0D] text-[28px]">Encontrar patrocinadores</h1>
        <div className="flex overflow-hidden rounded border border-black/10">
          <AbaBotao active={aba === "cultura"} position="left" onClick={() => setAba("cultura")} icon="cultura" label="Cultura" />
          <AbaBotao active={aba === "esporte"} position="middle" onClick={() => setAba("esporte")} icon="esporte" label="Esporte" />
          <AbaBotao active={aba === "cinema"} position="right" onClick={() => setAba("cinema")} icon="audiovisual" label="Audiovisual" />
        </div>
      </div>
      {aba === "cultura" && (
        <Suspense fallback={<div className="min-h-[360px] animate-pulse bg-black/[.015]" />}>
          <PatrocinadoresContent />
        </Suspense>
      )}
      {aba === "esporte" && <LeiTabContent lei="esporte" />}
      {aba === "cinema" && <LeiTabContent lei="ancine" />}
    </div>
  );
}
