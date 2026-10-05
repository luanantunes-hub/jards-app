"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Mail, Phone, X, ArrowUpDown, Trash2,
  List, UsersRound, ShieldCheck, Radio, Wrench, CalendarX2, ContactRound, Search,
} from "lucide-react";

function LinkedinIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { FilterButton, SegmentedControl } from "@/components/ui/FilterControls";
import type { OrigemContato } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { ListContent, ListEmptyState, ListPageHeader, ListSearch, ListSummary, ListTableSurface, ListToolbar, PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { EntityViewSwitcher, usePersistedViewMode } from "@/components/ui/EntityViewSwitcher";

type ViewMode = "lista" | "stakeholders";
const VIEW_MODES = ["lista", "stakeholders"] as const;
const VIEW_OPTIONS = [
  { value: "lista", label: "Lista", icon: List },
  { value: "stakeholders", label: "Stakeholders", icon: UsersRound },
] as const;

const CONTATOS_COLUMNS = [
  { id: "nome", label: "Nome", width: "13.125rem", grow: true, hideable: false },
  { id: "empresa", label: "Empresa", width: "12.8125rem" },
  { id: "cargo", label: "Cargo", width: "13.125rem" },
  { id: "papel", label: "Papel", width: "10.9375rem" },
  { id: "relacionamento", label: "Relacionamento", width: "13.75rem" },
  { id: "interacao", label: "Última interação", width: "10.9375rem" },
  { id: "contato", label: "Contato", width: "9.6875rem" },
  { id: "origem", label: "Origem", width: "8.4375rem", defaultHidden: true },
  { id: "adicionado_em", label: "Adicionado em", width: "10.3125rem", defaultHidden: true },
  { id: "atualizado_em", label: "Atualizado em", width: "10.3125rem", defaultHidden: true },
  { id: "acoes", label: "Ações", width: "5.3125rem", defaultHidden: true },
] as const satisfies readonly ColumnDefinition[];

type ContatoRow = {
  id: string;
  nome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  score: number;
  origem: OrigemContato | null;
  ultima_interacao: string | null;
  created_at: string;
  updated_at: string;
  responsavel: { nome: string; cargo: string | null } | null;
  empresa_pub: { nome: string; site: string | null; logo_url: string | null } | null;
  empresa_crm: { nome: string; site: string | null; domain_key: string | null } | null;
  empresa_crm_id: string | null;
  papel_decisao: "decision_maker" | "champion" | "influencer" | "gatekeeper" | null;
  influencia: number | null;
  sentimento: "positivo" | "neutro" | "negativo" | "desconhecido" | null;
  forca_relacao: number | null;
  canal_preferido: string | null;
};

type RoleFilter = NonNullable<ContatoRow["papel_decisao"]> | "todos";

const ORIGEM_CONFIG: Record<OrigemContato, { label: string; bg: string }> = {
  jards:     { label: "Jards",     bg: "rgba(13,13,13,.45)" },
  proprio:   { label: "Próprio",   bg: "#2D72B0" },
  indicacao: { label: "Indicação", bg: "#B07A14" },
  linkedin:  { label: "LinkedIn",  bg: "#2D72B0" },
  outro:     { label: "Outro",     bg: "rgba(13,13,13,.35)" },
};

const ORIGENS_FILTER: { value: OrigemContato | "todos"; label: string }[] = [
  { value: "todos",     label: "Todos"     },
  { value: "jards",     label: "Jards"     },
  { value: "proprio",   label: "Próprio"   },
  { value: "indicacao", label: "Indicação" },
  { value: "linkedin",  label: "LinkedIn"  },
  { value: "outro",     label: "Outro"     },
];

type SortOpt =
  | "nome_asc"
  | "nome_desc"
  | "empresa_asc"
  | "empresa_desc"
  | "cargo_asc"
  | "cargo_desc"
  | "interacao_desc";

type AlphabeticalSortKey = "nome" | "empresa" | "cargo";

function SortableContactHeader({
  label,
  sortKey,
  sort,
  onChange,
}: {
  label: string;
  sortKey: AlphabeticalSortKey;
  sort: SortOpt;
  onChange: (sort: SortOpt) => void;
}) {
  const ascending = sort === `${sortKey}_asc`;

  return (
    <button
      type="button"
      onClick={() => onChange(ascending ? `${sortKey}_desc` : `${sortKey}_asc`)}
      className="group inline-flex items-center gap-1.5 font-normal text-black/35 transition hover:text-black/60"
      aria-label={`Ordenar ${label} ${ascending ? "de Z a A" : "de A a Z"}`}
    >
      <span>{label}</span>
      <ArrowUpDown size={11} strokeWidth={1.8} className="opacity-45 group-hover:opacity-80" />
    </button>
  );
}

function interactionLabel(value: string | null): string {
  if (!value) return "Sem registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fmtDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days <= 30) return `Há ${days} dias`;
  return fmtDate(value);
}

function relationshipLabel(value: number | null): string {
  if (!value) return "Não avaliado";
  if (value >= 4) return "Forte";
  if (value === 3) return "Médio";
  return "Fraco";
}

function safeExternalUrl(value: string): string {
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(13,13,13,.045)" }}>
      {[210, 205, 210, 175, 220, 175, 155, 135, 165, 165, 85].map((w, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-3.5 max-w-full rounded bg-black/8 animate-pulse" style={{ width: `${w / 16}rem` }} />
        </td>
      ))}
    </tr>
  );
}

const ROLE_LABEL: Record<NonNullable<ContatoRow["papel_decisao"]>, string> = {
  decision_maker: "Decision maker",
  champion: "Champion",
  influencer: "Influencer",
  gatekeeper: "Gatekeeper",
};

const STAKEHOLDER_LANES = [
  { key: "decisao", label: "Decisão", icon: ShieldCheck, roles: ["decision_maker"] },
  { key: "influencia", label: "Influência", icon: Radio, roles: ["champion", "influencer"] },
  { key: "operacao", label: "Operação", icon: Wrench, roles: ["gatekeeper"] },
] as const;

function LevelMarks({ value, color = "#7259B5" }: { value: number | null; color?: string }) {
  return <span className="inline-flex gap-0.5" aria-label={value ? `${value} de 5` : "Não avaliado"}>{Array.from({ length: 5 }).map((_, index) => <span key={index} className="h-1 w-2 rounded-sm" style={{ background: value && index < value ? color : "rgba(13,13,13,.08)" }}/>)}</span>;
}

function StakeholdersView({ contatos }: { contatos: ContatoRow[] }) {
  const groups = new Map<string, { name: string; domain?: string | null; site?: string | null; items: ContatoRow[] }>();
  for (const contato of contatos) {
    const name = contato.empresa_crm?.nome ?? contato.empresa_pub?.nome ?? "Sem empresa vinculada";
    const key = contato.empresa_crm_id ?? contato.empresa_pub?.nome ?? "sem-empresa";
    const current = groups.get(key) ?? { name, domain: contato.empresa_crm?.domain_key, site: contato.empresa_crm?.site ?? contato.empresa_pub?.site, items: [] };
    current.items.push(contato);
    groups.set(key, current);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([key, group]) => (
        <section key={key} className="overflow-hidden rounded border border-black/[.08] bg-white">
          <header className="flex items-center gap-3 border-b border-black/[.07] px-4 py-3.5">
            <CompanyLogo nome={group.name} domain={group.domain} site={group.site} size={34} className="shrink-0 border border-black/[.06]"/>
            <div className="min-w-0 flex-1"><h2 className="truncate text-[0.8125rem] font-bold text-black">{group.name}</h2><p className="mt-0.5 text-[0.625rem] text-black/35">{group.items.length} {group.items.length === 1 ? "contato" : "contatos"}</p></div>
          </header>
          <div className="grid grid-cols-1 bg-[#F7F7F5] lg:grid-cols-3">
            {STAKEHOLDER_LANES.map((lane, laneIndex) => {
              const laneItems = group.items.filter(item => lane.roles.includes(item.papel_decisao as never) || (lane.key === "operacao" && !item.papel_decisao));
              const Icon = lane.icon;
              return (
                <div key={lane.key} className={`min-h-[11.875rem] p-3 ${laneIndex > 0 ? "border-t border-black/[.07] lg:border-l lg:border-t-0" : ""}`}>
                  <div className="mb-2.5 flex items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[0.625rem] font-bold text-black/45"><Icon size={12}/>{lane.label}</div><span className="text-[0.59375rem] font-semibold tabular-nums text-black/25">{laneItems.length}</span></div>
                  <div className="space-y-2">
                    {laneItems.length === 0 ? <div className="rounded border border-dashed border-black/10 py-8 text-center text-[0.625rem] text-black/20">Nenhum contato</div> : laneItems.map(item => {
                      const name = item.nome ?? item.responsavel?.nome ?? "Contato sem nome";
                      const role = item.papel_decisao ? ROLE_LABEL[item.papel_decisao] : "Papel não definido";
                      const sentimentColor = item.sentimento === "positivo" ? "#2E8932" : item.sentimento === "negativo" ? "#D94E4E" : item.sentimento === "neutro" ? "#B07A14" : "rgba(13,13,13,.22)";
                      return (
                        <article key={item.id} className="rounded border border-black/[.07] bg-white p-2.5 cursor-pointer hover:border-[#7259B5]/30 transition" onClick={() => { window.location.href = `/contatos/${item.id}`; }}>
                          <div className="flex items-start gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-black/[.05] text-[0.625rem] font-bold text-black/35">{name.charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="truncate text-[0.6875rem] font-semibold text-black/75">{name}</p><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sentimentColor }} title={`Sentimento: ${item.sentimento ?? "não avaliado"}`}/></div><p className="mt-0.5 truncate text-[0.59375rem] text-black/35">{item.cargo ?? item.responsavel?.cargo ?? role}</p></div>{item.email && <a href={`mailto:${item.email}`} className="rounded p-1 text-black/25 transition hover:bg-black/[.05] hover:text-black" aria-label={`Enviar e-mail para ${name}`}><Mail size={11}/></a>}</div>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-black/[.05] pt-2"><span className="truncate text-[0.5625rem] font-medium text-black/35">{role}</span><div className="flex items-center gap-1.5"><LevelMarks value={item.influencia}/><LevelMarks value={item.forca_relacao} color="#2E8932"/></div></div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function ContatosPage() {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const router = useRouter();

  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [origem, setOrigem] = useState<OrigemContato | "todos">("todos");
  const [sort, setSort] = useState<SortOpt>("nome_asc");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("todos");
  const [withoutInteraction, setWithoutInteraction] = useState(false);
  const [viewMode, setViewMode] = usePersistedViewMode<ViewMode>("jards:contatos:view", VIEW_MODES, "lista");

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch on mount
  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data, error } = await supabase
        .from("contatos")
        .select(`
          id, nome, cargo, email, telefone, linkedin_url, score, origem, ultima_interacao, created_at, updated_at,
          papel_decisao, influencia, sentimento, forca_relacao, canal_preferido,
          responsavel:responsaveis!responsavel_id(nome, cargo),
          empresa_pub:empresas!empresa_id(nome, site, logo_url),
          empresa_crm:empresas_crm!empresa_crm_id(nome, site, domain_key),
          empresa_crm_id
        `)
        .order("score", { ascending: false });

      if (!error && data) {
        setContatos(data as unknown as ContatoRow[]);
      }
      setLoading(false);
    }

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Client-side filter + sort
  const filtered = contatos
    .filter((c) => {
      if (origem !== "todos" && c.origem !== origem) return false;
      if (roleFilter !== "todos" && c.papel_decisao !== roleFilter) return false;
      if (withoutInteraction && c.ultima_interacao) return false;
      if (!dSearch.trim()) return true;
      const s = dSearch.toLowerCase();
      const nome    = (c.nome ?? c.responsavel?.nome ?? "").toLowerCase();
      const empresa = (c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? "").toLowerCase();
      const cargo   = (c.cargo ?? c.responsavel?.cargo ?? "").toLowerCase();
      return nome.includes(s) || empresa.includes(s) || cargo.includes(s) || (c.email ?? "").toLowerCase().includes(s);
    })
    .sort((a, b) => {
      const direction = sort.endsWith("_desc") ? -1 : 1;
      if (sort.startsWith("nome_"))
        return direction * (a.nome ?? a.responsavel?.nome ?? "").localeCompare(b.nome ?? b.responsavel?.nome ?? "", "pt-BR", { sensitivity: "base" });
      if (sort.startsWith("empresa_"))
        return direction * (a.empresa_pub?.nome ?? a.empresa_crm?.nome ?? "").localeCompare(b.empresa_pub?.nome ?? b.empresa_crm?.nome ?? "", "pt-BR", { sensitivity: "base" });
      if (sort.startsWith("cargo_"))
        return direction * (a.cargo ?? a.responsavel?.cargo ?? "").localeCompare(b.cargo ?? b.responsavel?.cargo ?? "", "pt-BR", { sensitivity: "base" });
      // interacao_desc
      const da = a.ultima_interacao ?? a.created_at;
      const db = b.ultima_interacao ?? b.created_at;
      return db.localeCompare(da);
    });

  const hasFilters = search || origem !== "todos" || roleFilter !== "todos" || withoutInteraction;

  function handleDelete(id: string, nome: string) {
    confirmDelete({
      title: `Excluir o contato “${nome}”?`,
      description: "Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await excluirPorId(supabase, "contatos", id);
        setContatos(prev => prev.filter(c => c.id !== id));
      },
    });
  }

  async function refetch() {
    const { data } = await supabase
      .from("contatos")
      .select(`
        id, nome, cargo, email, telefone, linkedin_url, score, origem, ultima_interacao, created_at, updated_at,
        papel_decisao, influencia, sentimento, forca_relacao, canal_preferido,
        responsavel:responsaveis!responsavel_id(nome, cargo),
        empresa_pub:empresas!empresa_id(nome, site, logo_url),
        empresa_crm:empresas_crm!empresa_crm_id(nome, site, domain_key),
        empresa_crm_id
      `)
      .order("score", { ascending: false });
    if (data) setContatos(data as unknown as ContatoRow[]);
  }

  return (
    <div className="flex h-full flex-col">
      {showModal && (
        <NovoContatoModal
          onClose={() => setShowModal(false)}
          onSaved={refetch}
        />
      )}
      <ListPageHeader eyebrow="Rede de relacionamento" title="Contatos" summary={!loading&&<ListSummary strong={filtered.length}>{filtered.length===1?'contato':'contatos'}</ListSummary>} actions={<><EntityViewSwitcher value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS}/><PrimaryListAction onClick={()=>setShowModal(true)}><Plus size={13}/>Novo contato</PrimaryListAction></>}/>

      {/* Filters */}
      <ListToolbar search={<ListSearch value={search} onChange={setSearch} placeholder="Buscar nome, empresa ou cargo"/>}>
        {/* Botões de controle: origem dos contatos */}
        <SegmentedControl
          value={origem}
          onChange={setOrigem}
          ariaLabel="Filtrar contatos por origem"
          options={ORIGENS_FILTER}
        />

        {/* Sort */}
        <CustomDropdown
          value={sort}
          onChange={(v) => setSort(v as SortOpt)}
          options={[
            { value: "nome_asc", label: "Nome A–Z" },
            { value: "nome_desc", label: "Nome Z–A" },
            { value: "empresa_asc", label: "Empresa A–Z" },
            { value: "empresa_desc", label: "Empresa Z–A" },
            { value: "cargo_asc", label: "Cargo A–Z" },
            { value: "cargo_desc", label: "Cargo Z–A" },
            { value: "interacao_desc", label: "Última interação" },
          ]}
          icon={<ArrowUpDown size={13} />}
          compact
          emphasized={false}
        />

        <CustomDropdown
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as RoleFilter)}
          options={[
            { value: "todos", label: "Todos os papéis" },
            { value: "decision_maker", label: "Decision maker" },
            { value: "champion", label: "Champion" },
            { value: "influencer", label: "Influenciador" },
            { value: "gatekeeper", label: "Gatekeeper" },
          ]}
          icon={<ShieldCheck size={13} />}
          compact
          emphasized={false}
        />

        <FilterButton active={withoutInteraction} onClick={() => setWithoutInteraction(value => !value)}>
          <CalendarX2 size={13} /> Sem interação
        </FilterButton>

        {hasFilters && (
          <FilterButton onClick={() => { setSearch(""); setOrigem("todos"); setRoleFilter("todos"); setWithoutInteraction(false); }}>
            <X size={12} /> Limpar
          </FilterButton>
        )}
      </ListToolbar>

      {/* Etiqueta estrutural: Tabela CRM — diretório de contatos */}
      <ListContent className="overflow-x-hidden">{viewMode === "stakeholders" ? (
        loading ? <div className="grid gap-4 md:grid-cols-2">{Array.from({length:4}).map((_, index)=><div key={index} className="h-64 animate-pulse rounded bg-black/[.05]"/>)}</div> : filtered.length === 0 ? <div className="py-24 text-center text-sm text-black/35">Nenhum contato encontrado</div> : <StakeholdersView contatos={filtered}/>
      ) : <ListTableSurface className="-mr-4 min-w-0 rounded-r-none border-r-0 !overflow-hidden md:-mr-8">
          <ManagedTable storageKey="contatos-v2" definitions={CONTATOS_COLUMNS} className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "#F9F9F8" }}>
                {["Nome", "Empresa", "Cargo", "Papel", "Relacionamento", "Última interação", "Contato", "Origem", "Adicionado em", "Atualizado em", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-[0.625rem] font-medium text-black/35 uppercase tracking-[.08em] whitespace-nowrap"
                  >
                    {h === "Nome" ? <SortableContactHeader label="NOME" sortKey="nome" sort={sort} onChange={setSort} />
                      : h === "Empresa" ? <SortableContactHeader label="EMPRESA" sortKey="empresa" sort={sort} onChange={setSort} />
                      : h === "Cargo" ? <SortableContactHeader label="CARGO" sortKey="cargo" sort={sort} onChange={setSort} />
                      : h.toLocaleUpperCase("pt-BR")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    {contatos.length === 0 ? (
                      <ListEmptyState icon={ContactRound} title="Nenhum contato cadastrado" description="Cadastre as pessoas com quem você negocia para acompanhar influência, interações e próximos passos." action={<PrimaryListAction onClick={() => setShowModal(true)}><Plus size={13} aria-hidden="true" /> Novo contato</PrimaryListAction>} />
                    ) : (
                      <ListEmptyState icon={Search} title="Nenhum contato corresponde aos filtros" filtered onClearFilters={() => { setSearch(""); setOrigem("todos"); setRoleFilter("todos"); setWithoutInteraction(false); }} />
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const nome    = c.nome ?? c.responsavel?.nome ?? "—";
                  const cargo   = c.cargo ?? c.responsavel?.cargo ?? "—";
                  const empresa = c.empresa_pub?.nome ?? c.empresa_crm?.nome ?? "—";
                  const og      = c.origem ? ORIGEM_CONFIG[c.origem] : null;
                  const role    = c.papel_decisao ? ROLE_LABEL[c.papel_decisao] : "Não definido";
                  const sentimentColor = c.sentimento === "positivo" ? "#2E8932" : c.sentimento === "negativo" ? "#D94E4E" : c.sentimento === "neutro" ? "#B07A14" : "rgba(13,13,13,.28)";

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-black/[0.02] transition group cursor-pointer"
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                      onClick={e => { if ((e.target as HTMLElement).closest("button,a")) return; router.push(`/contatos/${c.id}`); }}
                    >
                      {/* Nome */}
                      <td className="px-6 py-3.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded flex items-center justify-center text-[0.625rem] font-semibold flex-shrink-0"
                            style={{ background: "linear-gradient(145deg, #f8f8fb 0%, #d4d4dc 100%)", color: "#9e9ea8", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.06)" }}
                          >
                            {nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate font-semibold text-black text-[0.8125rem]" title={nome}>{nome}</span>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="px-6 py-3.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <CompanyLogo
                            nome={empresa}
                            domain={c.empresa_crm?.domain_key}
                            site={c.empresa_pub?.site ?? c.empresa_crm?.site}
                            logo_url={c.empresa_pub?.logo_url}
                            size={20}
                            className="rounded flex-shrink-0"
                          />
                          <span title={empresa} className="truncate text-black/65 font-medium text-[0.78125rem]">{empresa}</span>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-6 py-3.5 text-black/50 text-[0.78125rem] max-w-[11.25rem]">
                        <span className="line-clamp-1">{cargo}</span>
                      </td>

                      {/* Papel na decisão */}
                      <td className="px-6 py-3.5">
                        <span className={`text-[0.6875rem] font-medium ${c.papel_decisao ? "text-black/65" : "text-black/25"}`}>{role}</span>
                      </td>

                      {/* Relacionamento */}
                      <td className="px-6 py-3.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <LevelMarks value={c.forca_relacao} color="#2E8932" />
                          <span className="truncate text-[0.6875rem] font-medium" style={{ color: sentimentColor }}>
                            {relationshipLabel(c.forca_relacao)}{c.sentimento && c.sentimento !== "desconhecido" ? ` · ${c.sentimento}` : ""}
                          </span>
                        </div>
                      </td>

                      {/* Última interação */}
                      <td className={`px-6 py-3.5 text-[0.6875rem] font-medium whitespace-nowrap ${c.ultima_interacao ? "text-black/50" : "text-[#D94E4E]"}`}>
                        {interactionLabel(c.ultima_interacao)}
                      </td>

                      {/* Canais de contato */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1">
                          {c.email && <a href={`mailto:${c.email}`} title={c.email} aria-label={`Enviar e-mail para ${nome}`} className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black"><Mail size={13}/></a>}
                          {c.telefone && <a href={`tel:${c.telefone}`} title={c.telefone} aria-label={`Ligar para ${nome}`} className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black"><Phone size={13}/></a>}
                          {c.linkedin_url && <a href={safeExternalUrl(c.linkedin_url)} target="_blank" rel="noopener noreferrer" title="LinkedIn" aria-label={`Abrir LinkedIn de ${nome}`} className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black"><LinkedinIcon size={12}/></a>}
                          {!c.email && !c.telefone && !c.linkedin_url && <span className="text-xs text-black/20">—</span>}
                        </div>
                      </td>

                      {/* Origem */}
                      <td className="px-6 py-3.5">
                        {og ? (
                          <span
                            className="text-[0.625rem] font-bold px-2 py-0.5 rounded whitespace-nowrap text-white"
                            style={{ background: og.bg }}
                          >
                            {og.label}
                          </span>
                        ) : (
                          <span className="text-black/20 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-black/40 text-xs tabular-nums whitespace-nowrap">{fmtDate(c.created_at)}</td>
                      <td className="px-6 py-3.5 text-black/40 text-xs tabular-nums whitespace-nowrap">{fmtDate(c.updated_at)}</td>

                      {/* Ações */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition">
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(c.id, c.nome ?? "—"); }}
                            className="p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </ManagedTable>
      </ListTableSurface>}</ListContent>
    </div>
  );
}
