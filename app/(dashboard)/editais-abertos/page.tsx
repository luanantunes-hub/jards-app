"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, AlertCircle, ArrowUpDown, X, ChevronLeft, ChevronRight, ChevronsRight, Download, UserPlus, ChevronUp, ChevronDown, ThumbsUp, ThumbsDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { CustomDropdown } from "@/components/ui/CustomDropdown";

const CARDS_PER_PAGE = 12;

type SugestaoEdital = {
  id: string;
  autor_id: string;
  empresa_nome: string;
  titulo: string | null;
  url_acesso: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  justificativa: string | null;
  votos_positivos: number;
  votos_negativos: number;
  status: "pendente" | "aprovado" | "rejeitado";
  created_at: string;
  updated_at?: string | null;
};

type EditalAberto = {
  id: string;
  titulo: string | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  url_acesso: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string | null;
  empresas: {
    id: string;
    nome: string;
    estado: string | null;
    logo_url: string | null;
    site: string | null;
    aporte_estimado: number | null;
  } | null;
};

function diasRestantes(fechamento: string | null): number {
  if (!fechamento) return 9999;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(fechamento + "T00:00:00");
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function temPeriodoCompleto(item: { data_abertura: string | null; data_fechamento: string | null }): boolean {
  return Boolean(item.data_abertura && item.data_fechamento);
}

function urgency(dias: number) {
  if (dias <= 0)  return { bg: "rgba(13,13,13,.40)14", text: "rgba(13,13,13,.40)", label: "Encerrado" };
  if (dias <= 14) return { bg: "#D94E4E14", text: "#D94E4E",  label: "Urgente"   };
  if (dias <= 30) return { bg: "#B07A1414", text: "#B07A14",  label: "Próximo"   };
  return           { bg: "#2E893214", text: "#2E8932",  label: "Aberto"    };
}

type SortOpt = "prazo_asc" | "prazo_desc" | "nome_asc" | "aporte_desc";

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
    <div className="flex items-center justify-center gap-1 pt-6">
      <button
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={`${btn} text-black/40 hover:bg-black/6 disabled:opacity-25 disabled:cursor-not-allowed`}
      >
        <ChevronLeft size={14} />
      </button>
      {getPages().map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-black/30">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={`${btn} ${p === page ? "bg-white border border-[#7259B5]/25 text-[#7259B5]" : "text-black/50 hover:bg-black/[.04]"}`}
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
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export default function EditaisAbertosPage() {
  const supabase = createClient();
  const topRef = useRef<HTMLDivElement>(null);

  const [editais, setEditais] = useState<EditalAberto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dSearch, setDSearch] = useState("");
  const [sort, setSort] = useState<SortOpt>("prazo_asc");
  const [currentPage, setCurrentPage] = useState(0);
  const [showInscricaoModal, setShowInscricaoModal] = useState(false);
  const [selectedEdital, setSelectedEdital] = useState<EditalAberto | null>(null);
  const [empresaCrmIdExport, setEmpresaCrmIdExport] = useState<string | null>(null);

  async function handleExportarEdital(edital: EditalAberto) {
    const empresaPubId = edital.empresas?.id;
    let empresaCrmId: string | null = null;
    if (empresaPubId) {
      // mesma heurística usada em patrocinadores/[id]: sem vínculo direto entre
      // empresas (Base) e empresas_crm, inferimos pelo empresa_crm_id de uma
      // negociação já existente para essa empresa, se houver.
      const { data } = await (supabase as any)
        .from("captacoes")
        .select("empresa_crm_id")
        .eq("empresa_id", empresaPubId)
        .not("empresa_crm_id", "is", null)
        .limit(1)
        .maybeSingle();
      empresaCrmId = (data as { empresa_crm_id: string } | null)?.empresa_crm_id ?? null;
    }
    // resolve antes de montar o modal: empresaPreId só é lido no estado inicial dele.
    setEmpresaCrmIdExport(empresaCrmId);
    setSelectedEdital(edital);
    setShowInscricaoModal(true);
  }
  const [statusFilter, setStatusFilter] = useState<"abertos" | "fechados" | "recentes">("abertos");

  // Votos nos editais ADM
  type VotoEdital = { funciona: number; nao_funciona: number; meu: boolean | null };
  const [votosMap, setVotosMap] = useState<Record<string, VotoEdital>>({});

  const fetchVotosEditais = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: todos } = await (supabase as any)
      .from("edital_votos")
      .select("edital_id, funciona")
      .in("edital_id", ids);
    const map: Record<string, VotoEdital> = {};
    (todos ?? []).forEach((v: any) => {
      if (!map[v.edital_id]) map[v.edital_id] = { funciona: 0, nao_funciona: 0, meu: null };
      if (v.funciona === true)  map[v.edital_id].funciona++;
      if (v.funciona === false) map[v.edital_id].nao_funciona++;
    });
    if (user) {
      const { data: meu } = await (supabase as any)
        .from("edital_votos")
        .select("edital_id, funciona")
        .in("edital_id", ids)
        .eq("user_id", user.id);
      (meu ?? []).forEach((v: any) => {
        if (map[v.edital_id]) map[v.edital_id].meu = v.funciona;
      });
    }
    setVotosMap(map);
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVotoEdital = useCallback(async (editalId: string, valor: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const atual = votosMap[editalId]?.meu;
    if (atual === valor) {
      await (supabase as any).from("edital_votos").delete().eq("edital_id", editalId).eq("user_id", user.id);
    } else {
      await (supabase as any).from("edital_votos").upsert(
        { edital_id: editalId, user_id: user.id, funciona: valor },
        { onConflict: "edital_id,user_id" }
      );
    }
    fetchVotosEditais(editais.map(e => e.id));
  }, [votosMap, editais, supabase, fetchVotosEditais]);

  // Sugestões da comunidade
  const [sugestoes, setSugestoes]         = useState<SugestaoEdital[]>([]);
  const [meusVotos, setMeusVotos]         = useState<Record<string, number>>({});
  const [showSugerirForm, setShowSugerirForm] = useState(false);
  const [sugerirForm, setSugerirForm]     = useState({ empresa: "", titulo: "", url: "", abertura: "", fechamento: "" });
  const [sugerirSaving, setSugerirSaving] = useState(false);

  const fetchSugestoes = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("sugestoes_editais")
      .select("*")
      .neq("status", "rejeitado")
      .order("votos_positivos", { ascending: false });
    setSugestoes((data as SugestaoEdital[]) ?? []);
    const ids = ((data as SugestaoEdital[]) ?? []).map(s => s.id);
    if (ids.length > 0) {
      const { data: votos } = await (supabase as any)
        .from("sugestao_edital_votos")
        .select("sugestao_id, valor")
        .in("sugestao_id", ids);
      const map: Record<string, number> = {};
      (votos ?? []).forEach((v: any) => { map[v.sugestao_id] = v.valor; });
      setMeusVotos(map);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVotar(sugestaoId: string, valor: 1 | -1) {
    await (supabase as any).rpc("fn_votar_sugestao_edital", {
      p_sugestao_id: sugestaoId,
      p_valor: valor,
    });
    fetchSugestoes();
  }

  async function handleSugerir() {
    const { empresa, titulo, url, abertura, fechamento } = sugerirForm;
    if (!empresa.trim() || !titulo.trim() || !url.trim() || !abertura || !fechamento) return;
    setSugerirSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSugerirSaving(false); return; }
    await (supabase as any).from("sugestoes_editais").insert({
      autor_id: user.id,
      empresa_nome: empresa.trim(),
      titulo: titulo.trim(),
      url_acesso: url.trim(),
      data_abertura: abertura,
      data_fechamento: fechamento,
    });
    setSugerirSaving(false);
    setSugerirForm({ empresa: "", titulo: "", url: "", abertura: "", fechamento: "" });
    setShowSugerirForm(false);
    fetchSugestoes();
  }

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 0 when filter/sort changes
  useEffect(() => {
    setCurrentPage(0);
  }, [dSearch, sort, statusFilter]);

  // Fetch on mount
  useEffect(() => {
    async function fetchEditais() {
      setLoading(true);
      const { data, error } = await supabase
        .from("editais")
        .select("id, titulo, data_abertura, data_fechamento, url_acesso, ativo, created_at, updated_at, empresas(id, nome, estado, logo_url, site, aporte_estimado)")
        .eq("ativo", true)
        .order("data_fechamento", { ascending: true })
        .limit(500);

      if (!error && data) {
        const list = data as unknown as EditalAberto[];
        setEditais(list);
        fetchVotosEditais(list.map(e => e.id));
      }
      setLoading(false);
    }
    fetchEditais();
    fetchSugestoes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

  type CardItem = { source: "adm"; data: EditalAberto } | { source: "comunidade"; data: SugestaoEdital };

  const sugestoesCompletas = sugestoes.filter(
    s => s.titulo && s.data_abertura && s.data_fechamento && s.url_acesso
  );
  const sugestoesIncompletas = sugestoes.filter(
    s => !(s.titulo && s.data_abertura && s.data_fechamento && s.url_acesso)
  );

  const allItems: CardItem[] = [
    ...editais.map(e => ({ source: "adm" as const, data: e })),
    ...sugestoesCompletas.map(s => ({ source: "comunidade" as const, data: s })),
  ];

  const filtered = allItems
    .filter((item) => {
      // O catálogo só considera editais com um período utilizável. Sem as duas
      // datas, o registro não deve interferir em prazo, ordem alfabética ou paginação.
      if (!temPeriodoCompleto(item.data)) return false;

      const dias = diasRestantes(item.data.data_fechamento);
      if (statusFilter === "abertos" && dias <= 0) return false;
      if (statusFilter === "fechados" && dias > 0) return false;
      const modificadoEm = item.data.updated_at ?? item.data.created_at;
      if (statusFilter === "recentes" && (Date.now() - new Date(modificadoEm).getTime()) > TRINTA_DIAS) return false;
      if (!dSearch.trim()) return true;
      const sq = dSearch.toLowerCase();
      const nome = item.source === "adm" ? item.data.empresas?.nome : item.data.empresa_nome;
      const estado = item.source === "adm" ? item.data.empresas?.estado : null;
      return (
        item.data.titulo?.toLowerCase().includes(sq) ||
        nome?.toLowerCase().includes(sq) ||
        estado?.toLowerCase().includes(sq)
      );
    })
    .sort((a, b) => {
      if (statusFilter === "recentes") {
        const modificadoA = new Date(a.data.updated_at ?? a.data.created_at).getTime();
        const modificadoB = new Date(b.data.updated_at ?? b.data.created_at).getTime();
        return modificadoB - modificadoA;
      }
      if (sort === "prazo_asc")  return diasRestantes(a.data.data_fechamento) - diasRestantes(b.data.data_fechamento);
      if (sort === "prazo_desc") return diasRestantes(b.data.data_fechamento) - diasRestantes(a.data.data_fechamento);
      const empresaA = a.source === "adm" ? (a.data.empresas?.nome ?? "") : a.data.empresa_nome;
      const empresaB = b.source === "adm" ? (b.data.empresas?.nome ?? "") : b.data.empresa_nome;
      if (sort === "aporte_desc") {
        const aporteA = a.source === "adm" ? Number(a.data.empresas?.aporte_estimado ?? -1) : -1;
        const aporteB = b.source === "adm" ? Number(b.data.empresas?.aporte_estimado ?? -1) : -1;
        const porAporte = aporteB - aporteA;
        if (porAporte !== 0) return porAporte;
      }
      const porEmpresa = empresaA.localeCompare(empresaB, "pt-BR", { sensitivity: "base" });
      if (porEmpresa !== 0) return porEmpresa;
      return (a.data.titulo ?? "").localeCompare(b.data.titulo ?? "", "pt-BR", { sensitivity: "base" });
    });

  const totalPages = Math.ceil(filtered.length / CARDS_PER_PAGE);
  const paginated  = filtered.slice(currentPage * CARDS_PER_PAGE, (currentPage + 1) * CARDS_PER_PAGE);
  const urgentes   = editais.filter((e) => { const d = diasRestantes(e.data_fechamento); return d > 0 && d <= 14; });

  function handlePageChange(p: number) {
    setCurrentPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const SkeletonCard = () => (
    <div className="bg-white rounded border p-5 animate-pulse" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded bg-black/8" />
        <div className="space-y-1">
          <div className="h-2.5 w-20 bg-black/8 rounded" />
          <div className="h-2 w-14 bg-black/8 rounded" />
        </div>
      </div>
      <div className="h-4 w-3/4 bg-black/8 rounded mb-2" />
      <div className="h-3 w-full bg-black/8 rounded mb-1" />
      <div className="h-3 w-2/3 bg-black/8 rounded mb-4" />
      <div className="grid grid-cols-2 gap-2">
        {[1,2,3,4].map(i => <div key={i} className="h-6 bg-black/8 rounded" />)}
      </div>
    </div>
  );

  return (
    <div className="px-8 py-8" ref={topRef}>
      {showInscricaoModal && selectedEdital && (
        <NovaInscricaoModal
          tituloPre={selectedEdital.titulo ?? ""}
          dataAberturaPre={selectedEdital.data_abertura ?? ""}
          dataFechamentoPre={selectedEdital.data_fechamento ?? ""}
          nomePreEmpresa={selectedEdital.empresas?.nome}
          empresaPubId={selectedEdital.empresas?.id}
          empresaPreId={empresaCrmIdExport ?? undefined}
          onClose={() => { setShowInscricaoModal(false); setSelectedEdital(null); setEmpresaCrmIdExport(null); }}
          onSaved={() => { setShowInscricaoModal(false); setSelectedEdital(null); setEmpresaCrmIdExport(null); }}
        />
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-[#0D0D0D] text-[28px]">Editais</h1>
        <button
          onClick={() => setShowSugerirForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white border rounded hover:bg-black/[.04] transition"
          style={{ borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.65)" }}
        >
          <UserPlus size={13} /> Sugerir edital
        </button>
      </div>

      {/* Right-side floating panel */}
      {showSugerirForm && (
        <div
          className="fixed inset-0 z-50 flex"
          onClick={() => setShowSugerirForm(false)}
        >
          <div className="flex-1" style={{ background: "rgba(0,0,0,.18)" }} />
          <div
            className="bg-white h-full overflow-y-auto flex flex-col"
            style={{ width: 360, borderLeft: "1px solid rgba(13,13,13,.08)", boxShadow: "-8px 0 32px rgba(0,0,0,.10)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "rgba(114,89,181,0.08)" }}>
                  <UserPlus size={14} style={{ color: "#7259B5" }} />
                </div>
                <h2 className="text-[14px] font-bold text-black">Sugerir edital</h2>
              </div>
              <button
                onClick={() => setShowSugerirForm(false)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition text-black/35"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Empresa / Patrocinador *</label>
                <input
                  required
                  value={sugerirForm.empresa}
                  onChange={e => setSugerirForm(f => ({ ...f, empresa: e.target.value }))}
                  placeholder="Ex: Petrobras"
                  className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Título do edital *</label>
                <input
                  required
                  value={sugerirForm.titulo}
                  onChange={e => setSugerirForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Programa Cultural 2026"
                  className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Link do edital *</label>
                <input
                  required
                  value={sugerirForm.url}
                  onChange={e => setSugerirForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Abertura *</label>
                  <input
                    required
                    type="date"
                    value={sugerirForm.abertura}
                    onChange={e => setSugerirForm(f => ({ ...f, abertura: e.target.value }))}
                    className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Fechamento *</label>
                  <input
                    required
                    type="date"
                    value={sugerirForm.fechamento}
                    onChange={e => setSugerirForm(f => ({ ...f, fechamento: e.target.value }))}
                    className="w-full px-3 py-2.5 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/20"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <button
                onClick={() => setShowSugerirForm(false)}
                className="px-4 py-2 text-[12px] font-medium text-black/35 hover:text-black/55 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSugerir}
                disabled={sugerirSaving || !sugerirForm.empresa.trim() || !sugerirForm.titulo.trim() || !sugerirForm.url.trim() || !sugerirForm.abertura || !sugerirForm.fechamento}
                className="flex items-center gap-1.5 px-5 py-2 text-[12px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
              >
                {sugerirSaving ? <span className="w-3 h-3 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin" /> : null}
                Sugerir edital
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urgency alert */}
      {!loading && urgentes.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-4 py-3 text-xs font-semibold text-amber-800 mb-6">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>
            <strong>{urgentes.length} {urgentes.length === 1 ? "edital" : "editais"}</strong> com prazo inferior a 14 dias —{" "}
            {urgentes.map((e) => e.empresas?.nome ?? "—").join(", ")}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[280px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar edital, empresa, estado…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border rounded text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-black/15 transition"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          />
        </div>

        <CustomDropdown
          value={sort}
          onChange={(v) => setSort(v as SortOpt)}
          options={[
            { value: "prazo_asc", label: "Prazo: mais urgente" },
            { value: "prazo_desc", label: "Prazo: mais distante" },
            { value: "nome_asc", label: "Nome A–Z" },
            { value: "aporte_desc", label: "Aporte: maior valor" },
          ]}
          icon={<ArrowUpDown size={13} />}
          compact
          emphasized={false}
        />

        {!loading && (
          <span className="text-sm text-black/40">
            <span className="font-bold text-black">{filtered.length}</span> edita{filtered.length === 1 ? "l" : "is"}
          </span>
        )}

        {search && (
          <button
            onClick={() => setSearch("")}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-black/50 bg-white border rounded hover:bg-black/5 transition"
            style={{ borderColor: "rgba(13,13,13,.12)" }}
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex items-center justify-between mb-5">
        {/* Abertos + Fechados grudados */}
        <div className="flex items-center rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.12)" }}>
          {(["abertos", "fechados"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className="px-3.5 py-1.5 text-[12px] font-semibold transition"
              style={{
                background: statusFilter === f ? "#0D0D0D" : "#fff",
                color: statusFilter === f ? "#fff" : "rgba(13,13,13,.45)",
                borderRight: i === 0 ? "1px solid rgba(13,13,13,.12)" : undefined,
              }}
            >
              {f === "abertos" ? "Abertos" : "Fechados"}
            </button>
          ))}
        </div>

        {/* Recentes isolado à direita */}
        <button
          onClick={() => setStatusFilter(statusFilter === "recentes" ? "abertos" : "recentes")}
          className="px-3.5 py-1.5 text-[12px] font-semibold rounded border transition"
          style={{
            borderColor: "rgba(13,13,13,.12)",
            background: statusFilter === "recentes" ? "#0D0D0D" : "#fff",
            color: statusFilter === "recentes" ? "#fff" : "rgba(13,13,13,.45)",
          }}
        >
          Recentes
        </button>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: CARDS_PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-20 text-center text-sm text-black/35">
            Nenhum edital encontrado
          </div>
        ) : (
          paginated.map((item) => {
            const isADM = item.source === "adm";
            const adm   = isADM ? (item.data as EditalAberto) : null;
            const com   = !isADM ? (item.data as SugestaoEdital) : null;
            const dias  = diasRestantes(item.data.data_fechamento);
            const urg   = urgency(dias);
            const nome  = isADM ? (adm!.empresas?.nome ?? "Empresa") : com!.empresa_nome;

            return (
              <div
                key={item.data.id}
                className="rounded border p-5 hover:shadow-md transition cursor-default group"
                style={{
                  borderColor: "rgba(13,13,13,.08)",
                  background: "linear-gradient(145deg, #ffffff 0%, #f7f7f6 100%)",
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {isADM ? (
                      <CompanyLogo
                        nome={nome}
                        site={adm!.empresas?.site}
                        logo_url={adm!.empresas?.logo_url}
                        size={44}
                        className="rounded border border-black/8 flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-11 h-11 rounded border border-black/8 flex-shrink-0 flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(45,114,176,.06)", color: "#2D72B0" }}
                      >
                        {nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-[15px] font-bold text-[#0D0D0D] leading-tight">{nome}</p>
                      {isADM && adm!.empresas?.estado && (
                        <p className="text-[11px] text-black/35 mt-0.5">{adm!.empresas!.estado}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                      style={isADM
                        ? { background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.50)" }
                        : { background: "rgba(45,114,176,.10)", color: "#2D72B0" }}
                    >
                      {isADM ? "ADM" : "COMUNIDADE"}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded"
                      style={dias > 0
                        ? { background: "rgba(46,137,50,.10)", color: "#2E8932" }
                        : { background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.40)" }}
                    >
                      {dias > 0 ? "Aberto" : "Fechado"}
                    </span>
                  </div>
                </div>

                {/* Título */}
                <h3 className="text-xs text-black/50 leading-snug mb-3 line-clamp-2">
                  {item.data.titulo ?? "Sem título"}
                </h3>

                {/* Meta grid */}
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-3">
                  <div>
                    <p className="text-black/35 font-semibold uppercase tracking-wide mb-0.5">Abertura</p>
                    <p className="font-medium text-black/60">{fmtDate(item.data.data_abertura)}</p>
                  </div>
                  <div>
                    <p className="text-black/35 font-semibold uppercase tracking-wide mb-0.5">Fechamento</p>
                    <p className="font-bold" style={{ color: urg.text }}>{fmtDate(item.data.data_fechamento)}</p>
                  </div>
                </div>

                {/* Footer: votos + ações */}
                {isADM ? (() => {
                  const v = votosMap[adm!.id] ?? { funciona: 0, nao_funciona: 0, meu: null };
                  const saldo = v.nao_funciona - v.funciona;
                  return (
                    <div className="border-t pt-3 flex items-center justify-between gap-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <div className="flex items-center gap-1.5">
                        <button onClick={ev => { ev.stopPropagation(); handleVotoEdital(adm!.id, true); }}
                          className="flex items-center gap-1 px-2 py-1 rounded border transition text-[10px] font-semibold"
                          style={{ borderColor: v.meu === true ? "#2E8932" : "rgba(13,13,13,.12)", color: v.meu === true ? "#2E8932" : "rgba(13,13,13,.35)", background: v.meu === true ? "rgba(46,137,50,.06)" : "transparent" }}>
                          <ThumbsUp size={10} />
                          {v.funciona > 0 && <span className="tabular-nums">{v.funciona}</span>}
                        </button>
                        <button onClick={ev => { ev.stopPropagation(); handleVotoEdital(adm!.id, false); }}
                          className="flex items-center gap-1 px-2 py-1 rounded border transition text-[10px] font-semibold"
                          style={{ borderColor: v.meu === false ? "#D94E4E" : "rgba(13,13,13,.12)", color: v.meu === false ? "#D94E4E" : "rgba(13,13,13,.35)", background: v.meu === false ? "rgba(217,78,78,.06)" : "transparent" }}>
                          <ThumbsDown size={10} />
                          {v.nao_funciona > 0 && <span className="tabular-nums">{v.nao_funciona}</span>}
                        </button>
                        {saldo >= 3 && <span className="text-[9px] text-black/25">{saldo >= 5 ? "removido em breve" : `${saldo}/5`}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-1.5 text-black/40 hover:text-black/70 text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap border opacity-0 group-hover:opacity-100 transition-all duration-150"
                          style={{ borderColor: "rgba(13,13,13,.15)" }}
                          onClick={(ev) => { ev.stopPropagation(); handleExportarEdital(adm!); }}>
                          <Download size={11} /> Exportar
                        </button>
                        {adm!.url_acesso && (
                          <a href={adm!.url_acesso} target="_blank" rel="noopener noreferrer"
                            className="group/btn inline-flex items-center gap-1.5 bg-[#7259B5] text-white text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150"
                            onClick={(ev) => ev.stopPropagation()}>
                            Acessar
                            <ChevronRight size={11} className="group-hover/btn:hidden" />
                            <ChevronsRight size={11} className="hidden group-hover/btn:block" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })() : (() => {
                  const meuVoto = meusVotos[com!.id] ?? 0;
                  const url = com!.url_acesso!.startsWith("http") ? com!.url_acesso! : `https://${com!.url_acesso}`;
                  return (
                    <div className="border-t pt-3 flex items-center justify-between gap-2" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleVotar(com!.id, 1)}
                          className="flex items-center gap-1 px-2 py-1 rounded border transition text-[10px] font-semibold"
                          style={{ borderColor: meuVoto === 1 ? "#2E8932" : "rgba(13,13,13,.12)", color: meuVoto === 1 ? "#2E8932" : "rgba(13,13,13,.35)", background: meuVoto === 1 ? "rgba(46,137,50,.06)" : "transparent" }}>
                          <ChevronUp size={12} />
                          {com!.votos_positivos > 0 && <span className="tabular-nums">{com!.votos_positivos}</span>}
                        </button>
                        <button onClick={() => handleVotar(com!.id, -1)}
                          className="flex items-center gap-1 px-2 py-1 rounded border transition text-[10px] font-semibold"
                          style={{ borderColor: meuVoto === -1 ? "#D94E4E" : "rgba(13,13,13,.12)", color: meuVoto === -1 ? "#D94E4E" : "rgba(13,13,13,.35)", background: meuVoto === -1 ? "rgba(217,78,78,.06)" : "transparent" }}>
                          <ChevronDown size={12} />
                          {com!.votos_negativos > 0 && <span className="tabular-nums">{com!.votos_negativos}</span>}
                        </button>
                        {com!.votos_negativos >= 3 && <span className="text-[9px] text-black/25">{com!.votos_negativos >= 5 ? "removido em breve" : `${com!.votos_negativos}/5`}</span>}
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="group/btn inline-flex items-center gap-1.5 bg-[#7259B5] text-white text-[10px] font-bold px-2.5 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150"
                        onClick={(ev) => ev.stopPropagation()}>
                        Acessar
                        <ChevronRight size={11} className="group-hover/btn:hidden" />
                        <ChevronsRight size={11} className="hidden group-hover/btn:block" />
                      </a>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && (
        <Pagination page={currentPage} totalPages={totalPages} onChange={handlePageChange} />
      )}

      {/* Sugestões incompletas da comunidade */}
      {sugestoesIncompletas.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[11px] font-bold text-black/35 uppercase tracking-wide">Sugestões incompletas</p>
            <span className="text-[10px] font-bold text-black/25">{sugestoesIncompletas.length}</span>
            <div className="flex-1 h-px" style={{ background: "rgba(13,13,13,.08)" }} />
            <p className="text-[10px] text-black/30">Aguardando dados completos</p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sugestoesIncompletas.map(s => {
              const meuVoto = meusVotos[s.id] ?? 0;
              const saldo   = s.votos_positivos - s.votos_negativos;
              const dias    = s.data_fechamento ? diasRestantes(s.data_fechamento) : null;
              const urg     = dias !== null ? urgency(dias) : null;
              return (
                <div
                  key={s.id}
                  className="rounded border p-4 flex gap-3"
                  style={{ borderColor: "rgba(13,13,13,.08)", background: "rgba(13,13,13,.015)" }}
                >
                  {/* Votos */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                    <button onClick={() => handleVotar(s.id, 1)} className="p-0.5 rounded hover:bg-black/5 transition">
                      <ChevronUp size={14} className={meuVoto === 1 ? "text-[#2E8932]" : "text-black/20"} />
                    </button>
                    <span className={`text-[11px] font-bold tabular-nums ${saldo > 0 ? "text-[#2E8932]" : saldo < 0 ? "text-[#D94E4E]" : "text-black/25"}`}>
                      {saldo}
                    </span>
                    <button onClick={() => handleVotar(s.id, -1)} className="p-0.5 rounded hover:bg-black/5 transition">
                      <ChevronDown size={14} className={meuVoto === -1 ? "text-[#D94E4E]" : "text-black/20"} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className="text-[13px] font-bold text-black leading-tight truncate">{s.empresa_nome}</p>
                      {dias !== null && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={dias > 0
                            ? { background: "rgba(46,137,50,.10)", color: "#2E8932" }
                            : { background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.40)" }}
                        >
                          {dias > 0 ? "Aberto" : "Fechado"}
                        </span>
                      )}
                    </div>
                    {s.titulo && <p className="text-[11px] text-black/50 leading-snug mb-1 line-clamp-2">{s.titulo}</p>}
                    {(s.data_abertura || s.data_fechamento) && (
                      <p className="text-[10px] text-black/35 mb-1">
                        {s.data_abertura && <span>{fmtDate(s.data_abertura)}</span>}
                        {s.data_abertura && s.data_fechamento && <span className="mx-1">→</span>}
                        {s.data_fechamento && <span className="font-semibold">{fmtDate(s.data_fechamento)}</span>}
                      </p>
                    )}
                    {s.justificativa && (
                      <p className="text-[10px] text-black/30 italic mb-1.5 line-clamp-2">"{s.justificativa}"</p>
                    )}
                    {s.url_acesso && (
                      <a
                        href={s.url_acesso.startsWith("http") ? s.url_acesso : `https://${s.url_acesso}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7259B5] hover:underline"
                      >
                        <ChevronsRight size={11} /> Acessar edital
                      </a>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide" style={{ background: "rgba(45,114,176,.10)", color: "#2D72B0" }}>COMUNIDADE</span>
                      {s.votos_negativos > 0 && (
                        <span className="text-[9px] text-black/25">{s.votos_negativos}/5 reportados</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
