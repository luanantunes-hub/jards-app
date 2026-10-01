"use client";
import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Pencil, X, Send, ChevronDown, Check,
  ArrowUp, ArrowDown, Minus,
  Clock, ExternalLink, FileCheck,
  Calendar, Users, Mail, Phone, MoreHorizontal, Globe, Star,
  ClipboardList, LayoutDashboard, BriefcaseBusiness, RotateCw, Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StatusEdital } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ProjectIdentity } from "@/components/ui/ProjectIdentity";
import StatusBadge from "@/components/ui/StatusBadge";
import { StatusDropdown } from "@/components/ui/StatusDropdown";
import { NovaInscricaoModal, type EditDataInscricao } from "@/components/modals/NovaInscricaoModal";
import { RenovarCicloModal } from "@/components/modals/RenovarCicloModal";
import { RegistrosPanel } from "@/components/modals/RegistrosPanel";
import { DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { PropostaValuePanel } from "@/components/PropostaValuePanel";
import { CotasReferenceTab } from "@/components/CotasReferenceTab";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useLeiOptions } from "@/hooks/useLeiOptions";
import { CommercialCycleHistory, type CommercialCycle } from "@/components/commercial/CommercialCycleHistory";

const RESULTADO_NEGATIVO = new Set(["reprovado", "cancelado"]);

const PRIO_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  alta:  { label: "Alta",  color: "#D94E4E", Icon: ArrowUp },
  media: { label: "Média", color: "#B07A14", Icon: Minus },
  baixa: { label: "Baixa", color: "#888888", Icon: ArrowDown },
};

/* ─── Types ──────────────────────────────────────────────────────────────── */

type InscricaoDetalhe = {
  id: string;
  titulo: string | null;
  lei: string | null;
  valor: number | null;
  data_abertura: string | null;
  data_fechamento: string | null;
  data_resultado: string | null;
  status: StatusEdital;
  prioridade: string | null;
  potencial_fechamento: string | null;
  created_at: string;
  site: string | null;
  empresa_crm_id: string | null;
  projeto_id: string | null;
  cota_id: string | null;
  responsavel_tipo: "agencia" | "membro" | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  ciclo_ano: number | null;
  ciclo_anterior_id: string | null;
  retomada_programada_em: string | null;
  ciclo_programado: number | null;
  retomada_atividade_id: string | null;
  editais: { titulo: string | null } | null;
  empresas: { nome: string; logo_url: string | null; site: string | null } | null;
  empresas_crm: { nome: string; domain_key: string | null; site: string | null } | null;
  projetos_crm: { nome: string; descricao: string | null; identidade_tipo: "padrao" | "icone" | "emoji" | "logo" | null; identidade_valor: string | null; identidade_logo_url: string | null; identidade_cor: string | null } | null;
};

type Atividade = {
  id: string;
  nome: string;
  tipo: string | null;
  data_prevista: string | null;
  data_realizada: string | null;
  feita: boolean;
  nota: string | null;
  created_at: string;
};

type Nota = {
  id: string;
  conteudo: string;
  created_at: string;
  user: { full_name: string } | null;
};

type PropostaInterna = {
  id: string;
  titulo: string;
  valor_proposto: number | null;
  contrapartidas: string[];
  observacoes_comerciais: string | null;
  status: string;
  cota_id: string | null;
  created_at: string;
};

type DocumentoProjeto = {
  id: string;
  nome: string;
  arquivo_nome: string | null;
  categoria: string | null;
  tipo: string | null;
  tamanho: number | null;
  url: string;
  edital_user_id: string | null;
  created_at: string;
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const TIPO_ICONS: Record<string, React.ElementType> = {
  email:    Mail,
  telefone: Phone,
  reuniao:  Users,
  linkedin: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  evento:   Calendar,
  outro:    MoreHorizontal,
};

const TIPO_COLOR: Record<string, string> = {
  email:    "#7259B5",
  telefone: "#1A8B7A",
  reuniao:  "rgba(13,13,13,.45)",
  linkedin: "#2D72B0",
  evento:   "#B07A14",
  outro:    "rgba(13,13,13,.40)",
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function fmtValor(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d.split("T")[0]).getTime() - Date.now()) / 86_400_000);
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days}d atrás`;
  return fmtDate(d);
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function InscricaoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { etiquetasInscricao } = useEtiquetas();
  const { options: leiOptions, create: createLei } = useLeiOptions();
  const statusOptions = etiquetasInscricao.map((etiqueta) => ({
    status: etiqueta.key,
    label: etiqueta.label,
    bg: etiqueta.cor,
    iconName: etiqueta.icone,
  }));
  const getStatusEtiqueta = (status: string) => etiquetasInscricao.find((etiqueta) => etiqueta.key === status);

  const [inscricao, setInscricao]   = useState<InscricaoDetalhe | null>(null);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [notas, setNotas]           = useState<Nota[]>([]);
  const [propostas, setPropostas]   = useState<PropostaInterna[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoProjeto[]>([]);
  const [proximoCiclo, setProximoCiclo] = useState<{ id: string; ciclo_ano: number } | null>(null);
  const [ciclos, setCiclos] = useState<CommercialCycle[]>([]);
  const [showRenovarModal, setShowRenovarModal] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);

  const [showEditModal, setShowEditModal]   = useState(false);
  const [activeTab, setActiveTab] = useState<"visao-geral" | "cotas" | "conteudo">("visao-geral");

  const [showNewAtividade, setShowNewAtividade] = useState(false);
  const [newNome, setNewNome]     = useState("");
  const [newTipo, setNewTipo]     = useState("reuniao");
  const [newData, setNewData]     = useState("");
  const [newNota, setNewNota]     = useState("");
  const [salvando, setSalvando]   = useState(false);

  const [sidebarStatusMenu, setSidebarStatusMenu] = useState<{ top: number; left: number } | null>(null);
  const [leiMenuPos, setLeiMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [prioMenuPos, setPrioMenuPos] = useState<{ top: number; left: number } | null>(null);

  const [novaNotaTexto, setNovaNotaTexto]   = useState("");
  const [salvandoNota, setSalvandoNota]     = useState(false);

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: row, error } = await (supabase as any)
      .from("editais_user")
      .select(`
        id, titulo, lei, valor, data_abertura, data_fechamento, data_resultado,
        status, prioridade, potencial_fechamento, created_at, site, empresa_crm_id, projeto_id, cota_id,
        responsavel_tipo, responsavel_id, responsavel_nome, ciclo_ano, ciclo_anterior_id,
        retomada_programada_em, ciclo_programado, retomada_atividade_id,
        editais!edital_pub_id(titulo),
        empresas!empresa_pub_id(nome, logo_url, site),
        empresas_crm!empresa_crm_id(nome, domain_key, site),
        projetos_crm!projeto_id(nome, descricao, identidade_tipo, identidade_valor, identidade_logo_url, identidade_cor)
      `)
      .eq("id", id)
      .single();

    if (error || !row) { setLoading(false); return; }
    setInscricao(row as InscricaoDetalhe);

    const documentosQuery = (supabase as any)
      .from("documentos")
      .select("id,nome,arquivo_nome,categoria,tipo,tamanho,url,edital_user_id,created_at")
      .order("created_at", { ascending: false });
    if (row.projeto_id) documentosQuery.or(`edital_user_id.eq.${id},projeto_id.eq.${row.projeto_id}`);
    else documentosQuery.eq("edital_user_id", id);

    const [atvRes, notRes, propostasRes, documentosRes, proximoCicloRes, ciclosRes] = await Promise.all([
      supabase
        .from("atividades")
        .select("id, nome, tipo, data_prevista, data_realizada, feita, nota, created_at")
        .eq("edital_user_id", id)
        .order("data_prevista", { ascending: true }),
      (supabase as any)
        .from("notas")
        .select("id, conteudo, created_at, user:profiles!user_id(full_name)")
        .eq("edital_user_id", id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("propostas")
        .select("id,titulo,valor_proposto,contrapartidas,observacoes_comerciais,status,cota_id,created_at")
        .eq("edital_user_id", id)
        .order("created_at", { ascending: false }),
      documentosQuery,
      (supabase as any).from("editais_user").select("id, ciclo_ano").eq("ciclo_anterior_id", id).maybeSingle(),
      (supabase as any)
        .from("ciclos_comerciais")
        .select("id,ciclo_ano,proximo_ciclo_ano,status_final,resultado,nota,valor_solicitado,valor_aprovado,potencial_fechamento,encerrado_em,retomada_programada_em,reaberto_em,cancelado_em,estado")
        .eq("edital_user_id", id)
        .order("encerrado_em", { ascending: false }),
    ]);

    setAtividades((atvRes.data ?? []) as Atividade[]);
    setNotas((notRes.data ?? []) as Nota[]);
    setPropostas((propostasRes.data ?? []) as PropostaInterna[]);
    setDocumentos((documentosRes.data ?? []) as DocumentoProjeto[]);
    setProximoCiclo((proximoCicloRes.data as { id: string; ciclo_ano: number } | null) ?? null);
    setCiclos((ciclosRes.data as CommercialCycle[] | null) ?? []);

    if (row.projeto_id) {
      const { data: orgIds } = await supabase.rpc("auth_org_ids");
      setOrganizationId((orgIds as unknown as string[] | null)?.[0] ?? null);
    }

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Actions ── */
  async function handleStatusChange(newStatus: StatusEdital) {
    if (!inscricao || inscricao.status === newStatus) { setSidebarStatusMenu(null); return; }
    await (supabase as any).from("editais_user").update({ status: newStatus }).eq("id", id);
    setSidebarStatusMenu(null);
    await fetchData();
  }

  async function handleLeiChange(novaLei: string | null) {
    if (!inscricao) return;
    setLeiMenuPos(null);
    await (supabase.from("editais_user") as any)
      .update({ lei: novaLei })
      .eq("id", inscricao.id);
    await fetchData();
  }

  async function handleResolverProposta({ status, valorFinal }: { status: string; valorFinal: number | null }) {
    const payload: { status: string; valor?: number | null } = { status };
    if (status === "aprovado") payload.valor = valorFinal;
    await (supabase as any).from("editais_user").update(payload).eq("id", id);
    await fetchData();
  }

  async function handlePrioridadeChange(novaPrioridade: string | null) {
    if (!inscricao) return;
    setPrioMenuPos(null);
    await (supabase.from("editais_user") as any)
      .update({ prioridade: novaPrioridade })
      .eq("id", inscricao.id);
    await fetchData();
  }

  async function handleSalvarAtividade() {
    if (!newNome.trim()) return;
    setSalvando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(false); return; }
    const { data: orgData } = await (supabase as any)
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    await (supabase as any).from("atividades").insert({
      account_id:      user.id,
      organization_id: orgData?.organization_id ?? null,
      nome:            newNome.trim(),
      tipo:            newTipo,
      data_prevista:   newData || null,
      nota:            newNota.trim() || null,
      edital_user_id:  id,
      empresa_crm_id:  inscricao?.empresa_crm_id ?? null,
    });
    setNewNome(""); setNewTipo("reuniao"); setNewData(""); setNewNota("");
    setShowNewAtividade(false);
    setSalvando(false);
    await fetchData();
  }

  async function handleToggleAtividade(atvId: string, feita: boolean) {
    const now = new Date().toISOString().split("T")[0];
    await (supabase as any)
      .from("atividades")
      .update({ feita: !feita, data_realizada: !feita ? now : null })
      .eq("id", atvId);
    await fetchData();
  }

  async function handleSalvarNota() {
    if (!novaNotaTexto.trim()) return;
    setSalvandoNota(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvandoNota(false); return; }
    const { data: orgData } = await (supabase as any)
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    await (supabase as any).from("notas").insert({
      user_id:         user.id,
      organization_id: orgData?.organization_id ?? null,
      conteudo:        novaNotaTexto.trim(),
      edital_user_id:  id,
    });
    setNovaNotaTexto("");
    setSalvandoNota(false);
    await fetchData();
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-28 bg-black/5 rounded" />
          <div className="h-8 w-72 bg-black/5 rounded" />
          <div className="h-4 w-44 bg-black/5 rounded" />
          <div className="flex gap-8 mt-8">
            {[1,2,3,4].map(i => <div key={i} className="h-14 w-32 bg-black/5 rounded" />)}
          </div>
          <div className="flex gap-6 mt-6">
            <div className="flex-1 space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-black/5 rounded" />)}
            </div>
            <div className="w-[260px] space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-32 bg-black/5 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="px-8 py-8">
        <Link href="/editais-inscritos" className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/35 hover:text-black transition mb-6">
          <ArrowLeft size={13} /> Inscrições
        </Link>
        <div className="text-center py-20">
          <p className="text-[15px] font-semibold text-black/40 mb-1">Inscrição não encontrada</p>
          <p className="text-sm text-black/25">Esta inscrição pode ter sido removida.</p>
        </div>
      </div>
    );
  }

  const titulo  = inscricao.titulo ?? inscricao.editais?.titulo ?? "Sem título";
  const empresa = inscricao.empresas_crm?.nome ?? inscricao.empresas?.nome ?? "—";
  const diasFechamento = daysUntil(inscricao.data_fechamento);

  const pendentes = atividades.filter(a => !a.feita);
  const concluidas = atividades.filter(a => a.feita);

  const timeline: { tipo: "atividade" | "nota"; id: string; titulo: string; descricao: string | null; data: string; feita?: boolean; tipo_atv?: string | null }[] = [
    ...atividades.map(a => ({
      tipo: "atividade" as const,
      id: a.id,
      titulo: a.nome,
      descricao: a.nota,
      data: a.data_realizada || a.data_prevista || a.created_at,
      feita: a.feita,
      tipo_atv: a.tipo,
    })),
    ...notas.map(n => ({
      tipo: "nota" as const,
      id: n.id,
      titulo: n.conteudo.length > 120 ? n.conteudo.slice(0, 120) + "…" : n.conteudo,
      descricao: n.user?.full_name ?? null,
      data: n.created_at,
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="min-h-full">

      {/* Modals */}
      {showEditModal && (
        <NovaInscricaoModal
          editData={{
            id:               inscricao.id,
            empresa_crm_id:   inscricao.empresa_crm_id,
            empresa_crm_nome: inscricao.empresas_crm?.nome ?? null,
            projeto_id:       inscricao.projeto_id,
            projeto_nome:     inscricao.projetos_crm?.nome ?? null,
            cota_id:          inscricao.cota_id,
            responsavel_tipo: inscricao.responsavel_tipo,
            responsavel_id:   inscricao.responsavel_id,
            responsavel_nome: inscricao.responsavel_nome,
            titulo:           inscricao.titulo,
            lei:              inscricao.lei,
            valor:            inscricao.valor,
            status:           inscricao.status,
            data_abertura:    inscricao.data_abertura,
            data_fechamento:  inscricao.data_fechamento,
            data_resultado:   inscricao.data_resultado,
            potencial_fechamento: (inscricao.potencial_fechamento as any) ?? "medio",
          } as EditDataInscricao}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); fetchData(); }}
        />
      )}
      {showRenovarModal && (
        <RenovarCicloModal
          tipo="inscricao"
          id={id}
          anoNovo={(inscricao.ciclo_ano ?? new Date(inscricao.created_at).getFullYear()) + 1}
          resultadoNegativo={RESULTADO_NEGATIVO.has(inscricao.status)}
          dataRetomadaInicial={inscricao.retomada_programada_em}
          notaInicial={ciclos.find(ciclo => ciclo.estado === "programado")?.nota}
          resultadoLabel={inscricao.status === "cancelado" ? "Cancelado" : "Reprovado"}
          onClose={() => setShowRenovarModal(false)}
          onRenovado={() => { setShowRenovarModal(false); void fetchData(); }}
        />
      )}
      {sidebarStatusMenu && (
        <StatusDropdown
          options={statusOptions}
          current={inscricao.status}
          position={sidebarStatusMenu}
          onSelect={s => handleStatusChange(s as StatusEdital)}
          onClose={() => setSidebarStatusMenu(null)}
        />
      )}
      {leiMenuPos && (
        <StatusDropdown
          title="Tipo de patrocínio"
          options={leiOptions}
          current={inscricao.lei ?? ""}
          position={leiMenuPos}
          onSelect={s => handleLeiChange(s || null)}
          onCreate={createLei}
          onClose={() => setLeiMenuPos(null)}
        />
      )}
      {prioMenuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPrioMenuPos(null)} />
          <div
            className="fixed z-50 overflow-hidden rounded-lg border bg-white shadow-xl"
            style={{ top: prioMenuPos.top, left: prioMenuPos.left, borderColor: "rgba(13,13,13,.10)", minWidth: 180 }}
          >
            {(["sem", "alta", "media", "baixa"] as const).map(p => {
              const isActive = (p === "sem" ? null : p) === inscricao.prioridade;
              const it = p === "sem" ? null : PRIO_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePrioridadeChange(p === "sem" ? null : p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] transition hover:bg-black/[.03]"
                >
                  <span className="inline-flex items-center gap-1.5 text-black">
                    {it ? (
                      <span className="flex h-3 w-3 items-center justify-center rounded text-white" style={{ background: it.color }}>
                        <it.Icon size={8} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <span className="h-3 w-3 flex-shrink-0 rounded-full border" style={{ borderColor: "rgba(13,13,13,.25)" }} />
                    )}
                    <span className={it ? "" : "text-black/60"}>{it?.label ?? "Sem prioridade"}</span>
                  </span>
                  {isActive && <Check size={12} className="text-[#7259B5] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Header */}
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}><div className="mx-auto max-w-[1280px] px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
        <Link
          href="/editais-inscritos"
          className="mb-7 inline-flex items-center gap-2 text-[12px] font-medium text-black/40 transition hover:text-black/65"
        >
          <ArrowLeft size={13} /> Inscrições
        </Link>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo
              nome={inscricao.empresas_crm?.nome ?? inscricao.empresas?.nome ?? "?"}
              domain={inscricao.empresas_crm?.domain_key}
              site={inscricao.empresas?.site ?? inscricao.empresas_crm?.site}
              logo_url={inscricao.empresas?.logo_url ?? null}
              size={56}
            />
            <div className="min-w-0">
              <h1 className="max-w-4xl text-[32px] font-semibold leading-[1.04] tracking-[-.045em] text-[#0D0D0D] sm:text-[38px]">{titulo}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-black/45">
                {inscricao.empresas_crm?.nome && !inscricao.empresas?.nome ? (
                  <Link href={`/empresas-crm/${inscricao.empresa_crm_id}`} className="text-sm text-black/45 hover:text-[#7259B5] transition">
                    {empresa}
                  </Link>
                ) : (
                  <span className="text-sm text-black/45">{empresa}</span>
                )}
                {inscricao.ciclo_ano && (
                  <>
                    <span className="text-black/20">·</span>
                    <span className="rounded border bg-white px-2 py-0.5 text-[10px] font-medium text-black/40" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                      Ciclo {inscricao.ciclo_ano}
                    </span>
                  </>
                )}
                {inscricao.ciclo_anterior_id && (
                  <Link href={`/editais-inscritos/${inscricao.ciclo_anterior_id}`} className="text-[10px] font-medium text-black/35 transition hover:text-[#7259B5]">
                    Ver ciclo anterior
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {inscricao.projeto_id && (
              <PropostaValuePanel
                parentField="edital_user_id"
                parentId={inscricao.id}
                projetoId={inscricao.projeto_id}
                projetoNome={inscricao.projetos_crm?.nome || "Projeto"}
                organizationId={organizationId}
                empresaNome={empresa}
                status={inscricao.status}
                statusRecusado="reprovado"
                statusOcultar={["cancelado"]}
                valorAtual={inscricao.valor}
                valorFinal={inscricao.valor}
                propostas={propostas}
                onCreated={() => void fetchData()}
                onResolved={handleResolverProposta}
              />
            )}
            {proximoCiclo ? (
              <button
                onClick={() => router.push(`/editais-inscritos/${proximoCiclo.id}`)}
                className="flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[12px] font-medium text-black/55 transition hover:bg-black/[.04]"
              >
                <RotateCw size={12} /> Ver ciclo {proximoCiclo.ciclo_ano}
              </button>
            ) : RESULTADO_NEGATIVO.has(inscricao.status) ? (
              <button
                onClick={() => setShowRenovarModal(true)}
                className="flex h-11 items-center gap-2 rounded border border-black/[.15] bg-white px-4 text-[12px] font-medium text-black transition hover:bg-black/[.04]"
              >
                <RotateCw size={12} />
                {inscricao.retomada_programada_em
                  ? `Retomada em ${fmtDate(inscricao.retomada_programada_em)}`
                  : `Abrir novo ciclo em ${(inscricao.ciclo_ano ?? new Date(inscricao.created_at).getFullYear()) + 1}`}
              </button>
            ) : null}
            <button
              onClick={() => setShowEditModal(true)}
              className="flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[12px] font-medium text-black/55 transition hover:bg-black/[.04]"
            >
              <Pencil size={12} /> Editar
            </button>

            <button
              onClick={() => setShowNewAtividade(v => !v)}
              className={`flex h-11 items-center gap-2 rounded border px-4 text-[12px] font-medium transition ${
                showNewAtividade
                  ? "bg-white border-[#7259B5]/25 text-[#7259B5]"
                  : "bg-white border-black/[.12] text-black/55 hover:bg-black/[.04]"
              }`}
            >
              {showNewAtividade ? <X size={12} /> : <Plus size={12} />}
              {showNewAtividade ? "Cancelar" : "Atividade"}
            </button>

          </div>
        </div>
      </div></header>

      {/* Stats bar */}
      <div className="border-b bg-white" style={{ borderColor: "rgba(13,13,13,.06)" }}><div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-5 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-10 xl:grid-cols-6">
          {!inscricao.projeto_id && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-black/30 mb-0.5">Valor</p>
              <p className="text-[15px] font-bold text-[#0D0D0D]">{fmtValor(inscricao.valor)}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35 mb-0.5">Tipo de patrocínio</p>
            <button
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setLeiMenuPos(leiMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
              }}
              className="rounded border bg-white px-2 py-0.5 text-[11px] font-semibold capitalize transition hover:opacity-80"
              style={{
                borderColor: (leiOptions.find(l => l.status === inscricao.lei)?.bg ?? "rgba(13,13,13,.4)") + "47",
                color: leiOptions.find(l => l.status === inscricao.lei)?.bg ?? "rgba(13,13,13,.6)",
              }}
            >
              {leiOptions.find(l => l.status === inscricao.lei)?.label ?? inscricao.lei ?? "—"}
            </button>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/30 mb-0.5">Fechamento</p>
            {diasFechamento !== null && diasFechamento >= 0 && diasFechamento < 7 ? (
              <p className="text-[15px] font-bold" style={{ color: "#D94E4E" }}>{diasFechamento === 0 ? "Hoje" : `${diasFechamento}d`}</p>
            ) : (
              <p className="text-[15px] font-bold text-[#0D0D0D]">{fmtDate(inscricao.data_fechamento)}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/30 mb-0.5">Resultado</p>
            <p className="text-[15px] font-bold text-[#0D0D0D]">{fmtDate(inscricao.data_resultado)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/35 mb-0.5">Prioridade</p>
            <button
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setPrioMenuPos(prioMenuPos ? null : { top: rect.bottom + 4, left: rect.left });
              }}
              className="inline-flex items-center gap-1.5 rounded border bg-white px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-80"
              style={{
                borderColor: (PRIO_META[inscricao.prioridade ?? ""]?.color ?? "rgba(13,13,13,.25)") + "47",
                color: PRIO_META[inscricao.prioridade ?? ""]?.color ?? "rgba(13,13,13,.25)",
              }}
            >
              {inscricao.prioridade ? (
                (() => { const It = PRIO_META[inscricao.prioridade]; return <><It.Icon size={11} strokeWidth={2.5} />{It.label}</>; })()
              ) : (
                <><Minus size={11} className="rotate-90" />Sem prioridade</>
              )}
              <ChevronDown size={10} />
            </button>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-black/30 mb-0.5">Atividades</p>
            <p className="text-[15px] font-bold text-[#0D0D0D]">
              {concluidas.length}<span className="text-black/25 font-medium text-[13px]">/{atividades.length}</span>
            </p>
          </div>
        </div></div>

      {/* Abas da inscrição */}
      <DetailTabs
        ariaLabel="Seções da inscrição"
        activeTab={activeTab}
        onChange={value => setActiveTab(value as "visao-geral" | "cotas" | "conteudo")}
        tabs={[
          { id: "visao-geral", label: "Visão geral", icon: LayoutDashboard },
          ...(inscricao.projeto_id ? [{ id: "cotas", label: "Cotas", icon: Layers }] : []),
          { id: "conteudo", label: "Conteúdo preenchido", icon: ClipboardList },
        ]}
      />

      {/* Content */}
      <DetailPageContent>
        {activeTab === "cotas" ? (
          <CotasReferenceTab
            projetoId={inscricao.projeto_id}
            projetoNome={inscricao.projetos_crm?.nome ?? undefined}
            empresaNome={empresa}
            organizationId={organizationId}
            parentField="edital_user_id"
            parentId={inscricao.id}
            onPropostaCriada={() => void fetchData()}
          />
        ) : activeTab === "conteudo" ? (
          <RegistrosPanel
            embedded
            inscricao={{
              id: inscricao.id,
              projeto_id: inscricao.projeto_id,
              empresa_crm_id: inscricao.empresa_crm_id,
              empresa_nome: empresa,
              empresa_logo: inscricao.empresas?.logo_url ?? null,
              empresa_domain: inscricao.empresas_crm?.domain_key ?? null,
              empresa_site: inscricao.empresas?.site ?? inscricao.empresas_crm?.site ?? null,
              projeto_nome: inscricao.projetos_crm?.nome ?? null,
              valor: inscricao.valor,
              status: inscricao.status,
            }}
          />
        ) : (
        <div className="flex w-full flex-col gap-6 xl:flex-row">

          {/* ── Main column ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {inscricao.projetos_crm && (
              <section>
                <div className="mb-3"><h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35">Projeto</h2></div>
                <Link
                  href={inscricao.projeto_id ? `/projetos/${inscricao.projeto_id}` : "#"}
                  className={`block rounded border bg-white p-5 transition ${inscricao.projeto_id ? "hover:border-[#7259B5]/30 hover:bg-[#7259B5]/[.03]" : "pointer-events-none"}`}
                  style={{ borderColor: "rgba(13,13,13,.08)" }}
                >
                  <div className="flex items-center gap-3">
                    <ProjectIdentity
                      nome={inscricao.projetos_crm.nome}
                      tipo={inscricao.projetos_crm.identidade_tipo}
                      valor={inscricao.projetos_crm.identidade_valor}
                      logoUrl={inscricao.projetos_crm.identidade_logo_url}
                      cor={inscricao.projetos_crm.identidade_cor}
                      size="md"
                    />
                    <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#0D0D0D]">{inscricao.projetos_crm.nome}</p>
                  </div>
                  {inscricao.projetos_crm.descricao && (
                    <p className="mt-3 text-[12px] leading-relaxed text-black/45">{inscricao.projetos_crm.descricao}</p>
                  )}
                </Link>
              </section>
            )}

            <CommercialCycleHistory cycles={ciclos} />

            {documentos.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35">Documentos do projeto</h2><span className="text-[10px] text-black/25">{documentos.length}</span></div>
                <div className="overflow-hidden rounded border border-black/[.08] bg-white">
                  {documentos.map(documento => (
                    <div key={documento.id} className="flex items-center gap-3 border-b border-black/[.06] px-4 py-3 last:border-b-0"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black/[.045] text-black/35"><FileCheck size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-black/70">{documento.nome}</p><p className="mt-0.5 text-[10px] text-black/25">{documento.categoria || "Outro"} · {documento.edital_user_id === id ? "Desta inscrição" : "Compartilhado pelo projeto"}</p></div><button onClick={async () => { const { data } = await supabase.storage.from("documentos").createSignedUrl(documento.url, 3600); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }} className="rounded p-2 text-black/25 hover:bg-[#7259B5]/10 hover:text-[#7259B5]" title="Abrir documento"><ExternalLink size={12} /></button></div>
                  ))}
                </div>
              </section>
            )}

            {propostas.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35">Adaptação comercial</h2>{inscricao.projeto_id && <Link href={`/projetos/${inscricao.projeto_id}`} className="text-[10px] font-semibold text-[#7259B5] hover:underline">Abrir no projeto</Link>}</div>
                <div className="space-y-2">
                  {propostas.map(proposta => (
                    <div key={proposta.id} className="rounded border border-black/[.08] bg-white p-4">
                      <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-black/[.045] text-black/40"><BriefcaseBusiness size={14} /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-4"><div><p className="text-[13px] font-semibold text-black/75">{proposta.titulo}</p><p className="mt-1 text-[10px] text-black/30">{proposta.contrapartidas.length} contrapartida{proposta.contrapartidas.length === 1 ? "" : "s"}</p></div><span className="shrink-0 text-[13px] font-semibold text-black/65">{fmtValor(proposta.valor_proposto)}</span></div>{proposta.observacoes_comerciais && <p className="mt-3 border-t border-black/[.06] pt-3 text-[11px] leading-5 text-black/40">{proposta.observacoes_comerciais}</p>}</div></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Nova atividade inline */}
            {showNewAtividade && (
              <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[12px] font-medium text-black/50 uppercase tracking-wide mb-3">Nova atividade</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newNome}
                    onChange={e => setNewNome(e.target.value)}
                    placeholder="Nome da atividade..."
                    autoFocus
                    className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 focus:border-[#7259B5] transition"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: "reuniao",  label: "Reunião",  Icon: Users   },
                      { value: "email",    label: "E-mail",   Icon: Mail    },
                      { value: "telefone", label: "Telefone", Icon: Phone   },
                      { value: "outro",    label: "Outro",    Icon: MoreHorizontal },
                    ].map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setNewTipo(value)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded border transition ${
                          newTipo === value
                            ? "bg-white text-[#7259B5] border-[#7259B5]/25"
                            : "bg-white text-black/50 border-black/10 hover:border-black/20"
                        }`}
                      >
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newData}
                      onChange={e => setNewData(e.target.value)}
                      className="flex-1 px-3 py-2 text-[12px] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                    />
                    <input
                      type="text"
                      value={newNota}
                      onChange={e => setNewNota(e.target.value)}
                      placeholder="Nota"
                      className="flex-1 px-3 py-2 text-[12px] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 transition"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowNewAtividade(false)} className="px-3 py-1.5 text-[11px] font-medium text-black/40 hover:text-black/60 transition">
                      Cancelar
                    </button>
                    <button
                      onClick={handleSalvarAtividade}
                      disabled={!newNome.trim() || salvando}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
                    >
                      {salvando ? <span className="w-3 h-3 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin" /> : <Send size={11} />}
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Atividades pendentes */}
            {pendentes.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35">Próximas atividades</h2>
                  <span className="text-[11px] text-black/25 font-medium">{pendentes.length}</span>
                </div>
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {pendentes.map((atv, i) => {
                    const Icon = TIPO_ICONS[atv.tipo || "outro"] ?? MoreHorizontal;
                    const color = TIPO_COLOR[atv.tipo || "outro"] ?? "rgba(13,13,13,.40)";
                    return (
                      <div
                        key={atv.id}
                        className="flex items-center gap-3 px-4 py-3 group hover:bg-black/[0.015] transition"
                        style={{ borderBottom: i < pendentes.length - 1 ? "1px solid rgba(13,13,13,.045)" : "none" }}
                      >
                        <button
                          onClick={() => handleToggleAtividade(atv.id, atv.feita)}
                          className="w-5 h-5 rounded border-2 border-black/15 hover:border-[#7259B5] hover:bg-[#7259B5]/5 flex-shrink-0 transition flex items-center justify-center"
                          title="Marcar como feita"
                        />
                        <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
                          <Icon size={12} style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#0D0D0D] truncate">{atv.nome}</p>
                          {atv.nota && <p className="text-[11px] text-black/30 truncate">{atv.nota}</p>}
                        </div>
                        {atv.data_prevista && (
                          <span className="text-[11px] text-black/35 flex-shrink-0 whitespace-nowrap">{fmtDate(atv.data_prevista)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Timeline */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35">Histórico</h2>
                <span className="text-[11px] text-black/25 font-medium">{timeline.length} eventos</span>
              </div>

              {timeline.length === 0 && !showNewAtividade ? (
                <div className="bg-white rounded border p-10 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <Clock size={22} className="mx-auto text-black/12 mb-3" />
                  <p className="text-sm text-black/30 font-medium">Nenhum evento ainda</p>
                  <p className="text-xs text-black/20 mt-1">Adicione uma atividade para começar o acompanhamento</p>
                </div>
              ) : (
                <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  {timeline.map((evt, i) => {
                    const isLast = i === timeline.length - 1;
                    const Icon = evt.tipo === "nota"
                      ? Star
                      : (TIPO_ICONS[evt.tipo_atv || "outro"] ?? MoreHorizontal);
                    const color = evt.tipo === "nota"
                      ? "#B07A14"
                      : (TIPO_COLOR[evt.tipo_atv || "outro"] ?? "rgba(13,13,13,.40)");
                    return (
                      <div key={evt.id} className="flex gap-3 relative">
                        {/* Line */}
                        {!isLast && (
                          <div className="absolute left-[13px] top-7 bottom-0 w-px bg-black/6" />
                        )}
                        {/* Icon */}
                        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5 z-10"
                          style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                          <Icon size={12} style={{ color }} />
                        </div>
                        {/* Content */}
                        <div className={`flex-1 min-w-0 ${!isLast ? "pb-5" : ""}`}>
                          <p className={`text-[13px] font-medium leading-snug ${evt.feita === false ? "text-black/40 line-through" : "text-[#0D0D0D]"}`}>
                            {evt.titulo}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {evt.descricao && (
                              <span className="text-[11px] text-black/35">{evt.descricao}</span>
                            )}
                            {evt.descricao && <span className="text-black/15 text-[11px]">·</span>}
                            <span className="text-[11px] text-black/25">{timeAgo(evt.data)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Notas rápidas */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-black/35 mb-3">Notas</h2>
              <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <textarea
                  value={novaNotaTexto}
                  onChange={e => setNovaNotaTexto(e.target.value)}
                  placeholder="Adicione uma nota sobre esta inscrição..."
                  rows={3}
                  className="w-full px-3 py-2.5 text-[13px] border rounded resize-none focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.10)" }}
                />
                {novaNotaTexto.trim() && (
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setNovaNotaTexto("")} className="px-3 py-1.5 text-[11px] font-medium text-black/40 hover:text-black/60 transition">
                      Limpar
                    </button>
                    <button
                      onClick={handleSalvarNota}
                      disabled={salvandoNota}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
                    >
                      {salvandoNota ? <span className="w-3 h-3 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin" /> : <Send size={11} />}
                      Salvar
                    </button>
                  </div>
                )}
              </div>

              {notas.length > 0 && (
                <div className="mt-3 space-y-2">
                  {notas.map(n => (
                    <div key={n.id} className="bg-white rounded border px-4 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <p className="text-[13px] text-[#0D0D0D] leading-relaxed">{n.conteudo}</p>
                      <p className="text-[10px] text-black/25 mt-1.5">
                        {n.user?.full_name && <span>{n.user.full_name} · </span>}{timeAgo(n.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <div className="w-full shrink-0 space-y-4 xl:w-[320px]">

            {/* Status */}
            <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-black/35 mb-3">Status</h3>
              <button
                onClick={ev => {
                  const rect = ev.currentTarget.getBoundingClientRect();
                  setSidebarStatusMenu(sidebarStatusMenu ? null : { top: rect.bottom + 4, left: rect.left });
                }}
              >
                <StatusBadge status={inscricao.status} label={getStatusEtiqueta(inscricao.status)?.label} bg={getStatusEtiqueta(inscricao.status)?.cor} iconName={getStatusEtiqueta(inscricao.status)?.icone} withChevron />
              </button>
            </div>

            {/* Datas */}
            <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-black/35 mb-3">Datas</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Abertura",    value: inscricao.data_abertura },
                  { label: "Fechamento",  value: inscricao.data_fechamento, urgent: diasFechamento !== null && diasFechamento >= 0 && diasFechamento < 7 },
                  { label: "Resultado",   value: inscricao.data_resultado },
                  { label: "Inscrito em", value: inscricao.created_at },
                ].map(({ label, value, urgent }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] text-black/35">{label}</span>
                    <span className="text-[12px] font-medium" style={{ color: urgent ? "#D94E4E" : "rgba(13,13,13,.70)" }}>
                      {fmtDate(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edital / Site */}
            {(inscricao.editais?.titulo || inscricao.site) && (
              <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-black/35 mb-3">Edital</h3>
                <div className="space-y-2.5">
                  {inscricao.editais?.titulo && (
                    <div className="flex items-start gap-2">
                      <FileCheck size={12} className="text-black/25 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-black/60 leading-snug">{inscricao.editais.titulo}</p>
                    </div>
                  )}
                  {inscricao.site && (
                    <a
                      href={inscricao.site.startsWith("http") ? inscricao.site : `https://${inscricao.site}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] text-[#7259B5] hover:underline"
                    >
                      <Globe size={11} />
                      <span className="truncate">{inscricao.site.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink size={9} className="flex-shrink-0" />
                    </a>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
        )}
      </DetailPageContent>
    </div>
  );
}
