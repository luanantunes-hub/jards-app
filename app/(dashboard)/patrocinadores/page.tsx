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
  WarningCircle,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { FilterButton, SegmentedControl } from "@/components/ui/FilterControls";
import type { Empresa } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { carregarSetores } from "@/lib/setores";
import { FiltroMesorregiao } from "@/components/patrocinadores/FiltroMesorregiao";
import { lerSelecaoDaUrl } from "@/lib/filtro-mesorregiao";
import { BoasVindasPlanoModal } from "@/components/modals/BoasVindasPlanoModal";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

type Lei = "esporte" | "ancine" | "saude";

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

function LeiTabContent({ lei, isSuperAdmin }: { lei: Lei; isSuperAdmin: boolean }) {
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
  const [incompletas, setIncompletas] = useState(false);
  const [mesorregioes, setMesorregioes] = useState<number[]>([]);
  const chaveMesorregioes = mesorregioes.join(",");

  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    carregarSetores(supabase).then(setSetores);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setPage(0); }, [lei, dSearch, estado, setor, incompletas, chaveMesorregioes]);

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
      if (mesorregioes.length > 0) q = q.in("empresas.mesorregiao_id", mesorregioes);
      if (setor) q = q.ilike("empresas.setor", setor);
      if (incompletas) q = q.or("setor.is.null,cidade.is.null,estado.is.null,site.is.null", { foreignTable: "empresas" });

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
  }, [lei, page, dSearch, estado, setor, incompletas, chaveMesorregioes]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(search || estado || setor || incompletas || mesorregioes.length > 0);

  return (
    <div className="px-4 pb-8 md:px-8">
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-[12.5rem] max-w-[17.5rem]">
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, setor, cidade…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-[#282525] placeholder-black/30 focus:border-[#7259B5]/45 focus:outline-none focus:ring-2 focus:ring-[#7259B5]/10 transition"
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
        <FiltroMesorregiao lei={lei} estado={estado} selecionadas={mesorregioes} onChange={setMesorregioes} />
        <CustomDropdown
          value={setor}
          onChange={setSetor}
          options={setores.map((s) => ({ value: s, label: s }))}
          placeholder="Setor"
          icon={<Buildings size={13} />}
          compact
          emphasized={false}
        />
        {isSuperAdmin && (
          <FilterButton active={incompletas} onClick={() => setIncompletas((v) => !v)}>
            <WarningCircle size={12} />
            Perfil incompleto
          </FilterButton>
        )}
        {hasFilters && (
          <FilterButton onClick={() => { setSearch(""); setEstado(""); setMesorregioes([]); setSetor(""); setIncompletas(false); }}>
            <X size={12} />
            Limpar
          </FilterButton>
        )}
      </div>

      <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
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
                    <span className="flex items-center gap-1.5 text-[0.625rem] font-bold text-black/35 uppercase tracking-wider whitespace-nowrap">
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
                    <td className="px-4 py-3"><span className="font-semibold text-[#282525] text-[0.8125rem]">{l.empresas?.nome}</span></td>
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
                    <td className="px-4 py-3 text-black/50 text-[0.78125rem]">{l.empresas?.setor ?? "—"}</td>
                    <td className="px-4 py-3 text-black/50 text-[0.78125rem] font-medium">{l.empresas?.estado ?? "—"}</td>
                    <td className="px-4 py-3 text-black/50 text-[0.78125rem]">{l.empresas?.cidade ?? "—"}</td>
                    <td className="px-4 py-3"><span className="font-semibold text-[#282525] text-[0.8125rem] tabular-nums" title={l.valor ? formatarValorCompleto(l.valor) : undefined}>{l.valor ? formatarValorCurto(l.valor) : "—"}</span></td>
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
        type="button"
        aria-label="Página anterior"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={`${btn} text-black/40 hover:bg-black/6 disabled:opacity-25 disabled:cursor-not-allowed`}
      >
        <CaretLeft size={14} aria-hidden="true" />
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-black/30">…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Página ${(p as number) + 1}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p as number)}
            className={`${btn} ${p === page ? "bg-[#684DB0] text-white" : "text-black/50 hover:bg-black/6"}`}
          >
            {(p as number) + 1}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= totalPages - 1}
        onClick={() => onChange(page + 1)}
        className={`${btn} text-black/40 hover:bg-black/6 disabled:opacity-25 disabled:cursor-not-allowed`}
      >
        <CaretRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function PatrocinadoresContent({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const topRef = useRef<HTMLDivElement>(null);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(() => Number(searchParams.get("p") ?? 0));

  // Filters — inicializa da URL
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [dSearch, setDSearch] = useState(() => searchParams.get("q") ?? "");
  const [estado, setEstado] = useState(() => searchParams.get("uf") ?? "");
  const [mesorregioes, setMesorregioes] = useState<number[]>(() => lerSelecaoDaUrl(searchParams.get("meso")));
  const chaveMesorregioes = mesorregioes.join(",");
  const [setor, setSetor] = useState(() => searchParams.get("setor") ?? "");
  const [trimestre, setTrimestre] = useState<Trimestre | null>(() => (searchParams.get("tri") as Trimestre) ?? null);
  const [incompletas, setIncompletas] = useState(() => searchParams.get("inc") === "1");
  const [sortCol, setSortCol] = useState<SortCol>(() => (searchParams.get("sort") as SortCol) ?? "aporte_estimado");
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (searchParams.get("dir") as "asc" | "desc") ?? "desc");
  const [setores, setSetores] = useState<string[]>([]);


  // Sincroniza filtros na URL — pula o primeiro render (estado já vem da URL)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const params = new URLSearchParams();
    if (dSearch)   params.set("q", dSearch);
    if (estado)    params.set("uf", estado);
    if (chaveMesorregioes) params.set("meso", chaveMesorregioes);
    if (setor)     params.set("setor", setor);
    if (trimestre) params.set("tri", trimestre);
    if (incompletas) params.set("inc", "1");
    if (sortCol !== "aporte_estimado") params.set("sort", sortCol);
    if (sortDir !== "desc") params.set("dir", sortDir);
    if (page > 0)  params.set("p", String(page));
    const qs = params.toString();
    router.replace(`/patrocinadores${qs ? `?${qs}` : ""}`, { scroll: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dSearch, estado, chaveMesorregioes, setor, trimestre, incompletas, sortCol, sortDir, page]);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load distinct setores for dropdown
  useEffect(() => {
    carregarSetores(supabase).then(setSetores);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildQuery(pageIndex: number) {
    // !inner só traz empresa que tenha linha em investimentos_por_lei pra lei='cultura' — mesmo
    // padrão de filtro que esporte/ancine/saude (LeiTabContent) já usam, só que aqui partindo
    // de empresas (não de investimentos_por_lei) porque ordenação/exibição ainda usam
    // empresas.aporte_estimado, não o valor da tabela unificada.
    let q = supabase
      .from("empresas")
      .select(
        "id, nome, setor, cidade, estado, site, logo_url, aporte_estimado, trimestre_1, trimestre_2, trimestre_3, trimestre_4, tem_detalhe, investimentos_por_lei!inner(lei, ano)",
        { count: "exact" }
      )
      .eq("investimentos_por_lei.lei", "cultura")
      .eq("investimentos_por_lei.ano", 2025);

    const s = dSearch.trim();
    if (s) q = q.or(`nome.ilike.%${s}%,setor.ilike.%${s}%,cidade.ilike.%${s}%`);
    if (estado) q = q.eq("estado", estado);
    if (mesorregioes.length > 0) q = q.in("mesorregiao_id", mesorregioes);
    if (setor) q = q.ilike("setor", setor);
    if (incompletas) q = q.or("setor.is.null,cidade.is.null,estado.is.null,site.is.null");
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
  }, [dSearch, estado, chaveMesorregioes, setor, trimestre, incompletas, sortCol, sortDir]);

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
    setMesorregioes([]);
    setSetor("");
    setTrimestre(null);
    setIncompletas(false);
  }

  function abrirEmpresa(empresa: Empresa) {
    router.push(`/patrocinadores/${empresa.id}?lei=cultura`);
  }


  const hasFilters = !!(search || estado || mesorregioes.length > 0 || setor || trimestre || incompletas);
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
    <div className="px-4 pb-8 md:px-8" ref={topRef}>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[12.5rem] max-w-[17.5rem]">
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar empresa, setor, cidade…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-[#282525] placeholder-black/30 focus:border-[#7259B5]/45 focus:outline-none focus:ring-2 focus:ring-[#7259B5]/10 transition"
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

        {/* Mesorregião (várias de uma vez): a cidade sede da empresa está num município da mesorregião */}
        <FiltroMesorregiao lei="cultura" estado={estado} selecionadas={mesorregioes} onChange={setMesorregioes} />

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

        {/* Botão de controle: perfil incompleto (sem setor, cidade, estado ou site) — visível só para superadmin */}
        {isSuperAdmin && (
          <FilterButton active={incompletas} onClick={() => setIncompletas((v) => !v)}>
            <WarningCircle size={12} />
            Perfil incompleto
          </FilterButton>
        )}

        {/* Botão de controle auxiliar: limpar filtros */}
        {hasFilters && (
          <FilterButton onClick={clearFilters}>
            <X size={12} />
            Limpar
          </FilterButton>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
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
                    <span className="flex items-center gap-1.5 text-[0.625rem] font-bold text-black/35 uppercase tracking-wider whitespace-nowrap">
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
                        <span className="font-semibold text-[#282525] text-[0.8125rem]">{e.nome}</span>
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
                          title="Ver perfil"
                        >
                          <Crosshair size={14} weight="bold" />
                        </button>
                      </td>

                      {/* Setor */}
                      <td className="px-4 py-3 text-black/50 text-[0.78125rem]">{e.setor ?? "—"}</td>

                      {/* Estado */}
                      <td className="px-4 py-3 text-black/50 text-[0.78125rem] font-medium">{e.estado ?? "—"}</td>

                      {/* Cidade */}
                      <td className="px-4 py-3 text-black/50 text-[0.78125rem]">{e.cidade ?? "—"}</td>

                      {/* Investimento */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-[#282525] text-[0.8125rem] tabular-nums" title={e.aporte_estimado ? formatarValorCompleto(e.aporte_estimado) : undefined}>
                          {e.aporte_estimado ? formatarValorCurto(e.aporte_estimado) : "—"}
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

    </div>
  );
}

// Modal de boas-vindas pós-pagamento (?welcome=paid&plan=...) — independente da aba ativa,
// por isso fica fora dos LeiTabContent/PatrocinadoresContent de cada aba.
function WelcomeModalGate() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [welcomePlan, setWelcomePlan] = useState<PaidPlan | null>(() => {
    if (searchParams.get("welcome") !== "paid") return null;
    const plan = searchParams.get("plan");
    return plan === "basico" || plan === "profissional" ? plan : null;
  });

  const closeWelcome = useCallback(() => {
    setWelcomePlan(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("welcome");
    params.delete("plan");
    const query = params.toString();
    router.replace(`/patrocinadores${query ? `?${query}` : ""}`, { scroll: false });
  }, [router]);

  return <BoasVindasPlanoModal plano={welcomePlan} onClose={closeWelcome} />;
}

export default function PatrocinadoresPage() {
  const [aba, setAba] = useState("cultura");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function loadSuperAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("jards_super_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (active) setIsSuperAdmin(profile?.jards_super_admin === true);
    }
    void loadSuperAdmin();
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-full bg-white">
      <div className="flex flex-col gap-4 px-4 pb-5 pt-6 md:px-8 md:pt-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">Oportunidades</p>
          <h1 className="mt-1 text-[1.75rem] font-bold tracking-[-.025em] text-[#282525] [text-wrap:balance]">Encontrar patrocinadores</h1>
        </div>
        <SegmentedControl
          value={aba}
          onChange={setAba}
          ariaLabel="Área de incentivo"
          options={[
            { value: "cultura", label: "Cultura" },
            { value: "esporte", label: "Esporte" },
            { value: "cinema", label: "Audiovisual" },
            { value: "saude", label: "Saúde" },
          ]}
        />
      </div>
      {/* Cultura usa PatrocinadoresContent, não LeiTabContent: a listagem ainda ordena/exibe por
          empresas.aporte_estimado/descricao (schema original do produto), não por
          carteiras_por_lei como esporte/ancine/saude — só o histórico anual (o gráfico da
          página de detalhe) foi migrado pra investimentos_por_lei (lei='cultura'). */}
      {aba === "cultura" && (
        <Suspense fallback={<div className="min-h-[22.5rem] animate-pulse bg-black/[.015]" />}>
          <PatrocinadoresContent isSuperAdmin={isSuperAdmin} />
        </Suspense>
      )}
      {aba === "esporte" && <LeiTabContent lei="esporte" isSuperAdmin={isSuperAdmin} />}
      {aba === "cinema" && <LeiTabContent lei="ancine" isSuperAdmin={isSuperAdmin} />}
      {aba === "saude" && <LeiTabContent lei="saude" isSuperAdmin={isSuperAdmin} />}
      <Suspense fallback={null}>
        <WelcomeModalGate />
      </Suspense>
    </div>
  );
}
