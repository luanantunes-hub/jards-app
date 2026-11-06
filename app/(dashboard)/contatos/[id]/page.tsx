"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, BriefcaseBusiness, Building2, CalendarClock, Check, ChevronDown,
  CircleCheck, CircleDollarSign, CircleHelp, Frown, Mail, Meh, MessageCircle, Phone, Radio, ShieldCheck,
  Smile, Users, CheckSquare, MoreHorizontal, Calendar, MessageSquare, Pencil,
  Handshake, Sparkles, UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { DetailHeaderAction, DetailPageContent, DetailTabs } from "@/components/ui/DetailPagePrimitives";
import { CustomDropdown } from "@/components/ui/CustomDropdown";
import StatusBadge from "@/components/ui/StatusBadge";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { StatusCaptacao } from "@/lib/supabase/types";
import { escalaUi } from "@/lib/escala-ui";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

function LinkedinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
    </svg>
  );
}

/* ─── Types ─────────────────────────────────────────────────────────── */

type Contato = {
  id: string;
  nome: string | null;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  linkedin_url: string | null;
  score: number;
  origem: string | null;
  notas: string | null;
  ultima_interacao: string | null;
  created_at: string;
  updated_at: string;
  papel_decisao: string | null;
  influencia: number | null;
  sentimento: "positivo" | "neutro" | "negativo" | "desconhecido" | null;
  forca_relacao: number | null;
  canal_preferido: string | null;
  telefone_2: string | null;
  ativo_na_empresa: boolean;
  empresa_crm_id: string | null;
  empresa_crm: { id: string; nome: string; domain_key: string | null; site: string | null } | null;
};

type AtividadeItem = {
  id: string;
  nome: string;
  tipo: string | null;
  data_prevista: string | null;
  data_realizada: string | null;
  resultado: string | null;
  feita: boolean;
  responsavel: { full_name: string | null } | null;
  captacao: { id: string; titulo: string | null } | null;
};

type CaptacaoItem = {
  id: string;
  titulo: string | null;
  status: StatusCaptacao;
  valor_solicitado: number | null;
  projeto: { nome: string } | null;
  empresa_crm: { nome: string } | null;
};

/* ─── Config ─────────────────────────────────────────────────────────── */

type SelectOption = { value: string; label: string; icon: React.ElementType; color?: string };

const PAPEL_OPTS: SelectOption[] = [
  { value: "",               label: "Não definido",  icon: CircleHelp,  color: "rgba(13,13,13,.35)" },
  { value: "decision_maker", label: "Decision maker", icon: CircleDollarSign, color: "#282525" },
  { value: "champion",       label: "Champion",       icon: BadgeCheck,  color: "#7259B5" },
  { value: "influencer",     label: "Influencer",     icon: Radio,       color: "#7259B5" },
  { value: "gatekeeper",     label: "Gatekeeper",     icon: ShieldCheck, color: "#7259B5" },
];

const SENTIMENTO_OPTS: SelectOption[] = [
  { value: "",             label: "Não avaliado", icon: CircleHelp, color: "rgba(13,13,13,.35)" },
  { value: "positivo",     label: "Positivo",     icon: Smile,      color: "#1A8B7A" },
  { value: "neutro",       label: "Neutro",       icon: Meh,        color: "#B07A14" },
  { value: "negativo",     label: "Negativo",     icon: Frown,      color: "#D94E4E" },
  { value: "desconhecido", label: "Desconhecido", icon: CircleHelp, color: "#7259B5" },
];

const CANAL_OPTS: SelectOption[] = [
  { value: "",          label: "Não definido", icon: CircleHelp,    color: "rgba(13,13,13,.35)" },
  { value: "mensagem",  label: "WhatsApp",     icon: MessageCircle, color: "#1A8B7A" },
  { value: "email",     label: "E-mail",        icon: Mail,          color: "#2D72B0" },
  { value: "telefone",  label: "Telefone",      icon: Phone,         color: "#1A8B7A" },
  { value: "linkedin",  label: "LinkedIn",      icon: LinkedinIcon,  color: "#2D72B0" },
  { value: "reuniao",   label: "Reunião",       icon: Users,         color: "#7259B5" },
  { value: "outro",     label: "Outro",         icon: MoreHorizontal, color: "rgba(13,13,13,.45)" },
];

const ORIGEM_OPTS: SelectOption[] = [
  { value: "",          label: "Não definida", icon: CircleHelp,   color: "rgba(13,13,13,.35)" },
  { value: "jards",     label: "Jards",        icon: Sparkles,     color: "#7259B5" },
  { value: "proprio",   label: "Base própria", icon: UserRound,    color: "rgba(13,13,13,.65)" },
  { value: "indicacao", label: "Indicação",    icon: Users,        color: "#1A8B7A" },
  { value: "linkedin",  label: "LinkedIn",     icon: LinkedinIcon, color: "#2D72B0" },
  { value: "outro",     label: "Outra origem", icon: MoreHorizontal, color: "rgba(13,13,13,.45)" },
];

const STATUS_CONFIG: Record<StatusCaptacao, { label: string; color: string }> = {
  prospeccao:       { label: "Prospecção",      color: "rgba(13,13,13,.35)" },
  primeiro_contato: { label: "1º Contato",       color: "#2D72B0" },
  proposta_enviada: { label: "Proposta enviada", color: "#B07A14" },
  em_negociacao:    { label: "Em negociação",    color: "#7259B5" },
  aprovado:         { label: "Aprovado",         color: "#1A8B7A" },
  recusado:         { label: "Recusado",         color: "#D94E4E" },
  renovacao:        { label: "Renovação",        color: "#7259B5" },
};

const TIPO_ICON: Record<string, React.ElementType> = {
  email:    Mail,
  telefone: Phone,
  linkedin: LinkedinIcon,
  reuniao:  Users,
  evento:   Calendar,
  tarefa:   CheckSquare,
  outro:    MoreHorizontal,
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

/** Só o atraso pinta o ícone: âmbar depois de 14 dias, vermelho depois de 30. */
function interacaoAlerta(days: number | null): string | undefined {
  if (days === null || days <= 14) return undefined;
  return days <= 30 ? "#B07A14" : "#D94A4A";
}

/* ─── Inline edit components ─────────────────────────────────────────── */

function InlineText({
  value, onSave, placeholder = "—", className = "",
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value ?? "");
  const inputRef              = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    setEditing(false);
    const next = draft.trim() || null;
    if (next === (value ?? null)) return;
    await onSave(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
        className={`w-full bg-transparent outline-none border-b border-[#7259B5] ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className={`cursor-text group/inline flex items-center gap-1 ${className}`}
      title="Clique para editar"
    >
      <span>{value || <span className="opacity-40">{placeholder}</span>}</span>
      <Pencil size={9} className="opacity-0 group-hover/inline:opacity-30 transition flex-shrink-0" />
    </span>
  );
}

function InlineTextarea({
  value, onSave, placeholder = "Adicionar nota",
}: {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(draft.length, draft.length);
    }
  }, [editing, draft.length]);

  async function commit() {
    setEditing(false);
    const next = draft.trim() || null;
    if (next === (value ?? null)) return;
    await onSave(next);
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        rows={2}
        onChange={event => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={event => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void commit();
          if (event.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className="mt-2 min-h-12 w-full resize-none border-b border-[#7259B5] bg-transparent text-[0.75rem] leading-5 text-black/70 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="group/inline mt-2 flex min-h-10 w-full items-start gap-1 text-left text-[0.75rem] leading-5 text-black/60"
      title="Clique para editar"
    >
      <span className="line-clamp-2 flex-1">{value || <span className="text-black/25">{placeholder}</span>}</span>
      <Pencil size={9} className="mt-1 shrink-0 opacity-0 transition group-hover/inline:opacity-30" />
    </button>
  );
}

function InlineSelect({
  value, opts, onSave,
}: {
  value: string | null;
  opts: SelectOption[];
  onSave: (v: string | null) => Promise<void>;
}) {
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = opts.find(o => o.value === (value ?? ""));
  const CurrentIcon = current?.icon ?? CircleHelp;

  function toggle() {
    if (menuPos) { setMenuPos(null); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.max(rect.width, 180 * escalaUi());
      setMenuPos({
        top: rect.bottom + 5,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        width,
      });
    }
  }

  async function handleSelect(v: string) {
    setMenuPos(null);
    await onSave(v || null);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={Boolean(menuPos)}
        className="group inline-flex min-h-9 w-full max-w-full items-center gap-2 rounded border border-transparent bg-transparent px-2.5 py-2 text-[0.8125rem] font-semibold text-[#282525] transition-[background-color,border-color,transform] duration-150 hover:border-black/[.10] hover:bg-black/[.018] active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-black/65"><CurrentIcon size={14} strokeWidth={1.9} /></span>
        <span className="min-w-0 flex-1 truncate text-left">{current?.label ?? "—"}</span>
        <ChevronDown size={12} className={`shrink-0 text-black/25 transition-transform duration-150 ${menuPos ? "rotate-180" : ""}`} />
      </button>
      {menuPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuPos(null)} />
          <div
            className="fixed z-50 min-w-[10rem] overflow-hidden rounded bg-white py-1 border elevacao-1"
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, borderColor: "rgba(13,13,13,.12)" }}
            role="listbox"
          >
            {opts.map(o => {
              const Icon = o.icon;
              const selected = (value ?? "") === o.value;
              return <button
                  key={o.value}
                  type="button"
                  onClick={() => handleSelect(o.value)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.75rem] transition hover:bg-black/[.04]"
                  style={{ fontWeight: selected ? 700 : 500, color: o.value ? "#282525" : "rgba(13,13,13,.4)" }}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-black/60"><Icon size={13}/></span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {selected && <Check size={11} className="shrink-0 text-[#7259B5]" strokeWidth={2.5}/>} 
                </button>;
            })}
          </div>
        </>
      )}
    </>
  );
}

function InlineBars({
  value, max, color, kind, onSave,
}: {
  value: number | null;
  max: number;
  color: string;
  kind: "influencia" | "relacao";
  onSave: (v: number | null) => Promise<void>;
}) {
  const steps = 5;
  const [hoverLevel, setHoverLevel] = useState<number | null>(null);
  const savedLevel = value == null ? 0 : (value / max) * steps;
  const displayLevel = hoverLevel ?? savedLevel;
  const displayValue = hoverLevel == null ? value : Math.round((hoverLevel / steps) * max);
  const heights = [10, 14, 18, 22, 26];
  const opacities = [.48, .6, .72, .86, 1];
  const reading = displayValue == null
    ? "Não definida"
    : kind === "influencia"
      ? displayValue <= 2 ? "Baixa" : displayValue <= 4 ? "Relevante" : "Decisiva"
      : displayValue <= 1 ? "Frágil" : displayValue <= 3 ? "Em construção" : "Forte";

  return (
    <div className="flex min-h-[3rem] flex-col justify-end gap-2" onMouseLeave={() => setHoverLevel(null)}>
      <div className="flex h-[1.625rem] items-end gap-2" role="group" aria-label={kind === "influencia" ? "Definir influência" : "Definir força da relação"}>
        {Array.from({ length: steps }).map((_, i) => {
          const nextValue = Math.round(((i + 1) / steps) * max);
          const fill = Math.max(0, Math.min(1, displayLevel - i));
          return (
          <button
            key={i}
            type="button"
            aria-label={`${nextValue} de ${max}`}
            title={`${nextValue} de ${max}`}
            onClick={() => onSave(nextValue === value ? null : nextValue)}
            onMouseEnter={() => setHoverLevel(i + 1)}
            className="relative w-[0.5rem] origin-bottom overflow-hidden rounded-[1px] bg-black/[.09] transition-transform duration-150 hover:scale-x-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            style={{ height: heights[i] }}
          >
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-150"
              style={{ width: `${fill * 100}%`, background: color, opacity: opacities[i] }}
            />
          </button>
          );
        })}
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <p className={`truncate text-[0.6875rem] font-medium ${displayValue == null ? "text-black/30" : "text-black/55"}`}>{reading}</p>
        <p className={`shrink-0 text-[0.875rem] font-semibold tabular-nums tracking-[-.02em] ${displayValue == null ? "text-black/30" : "text-[#282525]"}`}>{displayValue ?? "—"}<span className="ml-0.5 text-[0.625rem] font-medium text-black/25">/{max}</span></p>
      </div>
    </div>
  );
}

type PageTab = "overview" | "captacoes";

/* ─── Page ──────────────────────────────────────────────────────────── */

export default function ContatoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { etiquetas } = useEtiquetas();
  const etiquetasCaptacao = Object.fromEntries(etiquetas.map(etiqueta => [etiqueta.key, etiqueta]));

  const [contato, setContato]           = useState<Contato | null>(null);
  const [atividades, setAtividades]      = useState<AtividadeItem[]>([]);
  const [captacoes, setCaptacoes]        = useState<CaptacaoItem[]>([]);
  const [empresas, setEmpresas]          = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading]            = useState(true);
  const [pageTab, setPageTab]            = useState<PageTab>("overview");
  const [showActivity, setShowActivity]  = useState(false);
  const [saveError, setSaveError]        = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [cRes, aRes, capRes] = await Promise.all([
      (supabase as any)
        .from("contatos")
        .select("id, nome, cargo, email, telefone, telefone_2, linkedin_url, score, origem, notas, ultima_interacao, created_at, updated_at, papel_decisao, influencia, sentimento, forca_relacao, canal_preferido, ativo_na_empresa, empresa_crm_id, empresa_crm:empresas_crm!empresa_crm_id(id, nome, domain_key, site)")
        .eq("id", id)
        .single(),
      (supabase as any)
        .from("atividades")
        .select("id, nome, tipo, data_prevista, data_realizada, resultado, feita, responsavel:profiles!responsavel_id(full_name), captacao:captacoes!captacao_id(id, titulo)")
        .eq("contato_id", id)
        .order("data_prevista", { ascending: false }),
      (supabase as any)
        .from("captacoes")
        .select("id, titulo, status, valor_solicitado, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome)")
        .eq("contato_empresa_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (cRes.data) setContato(cRes.data as Contato);
    setAtividades((aRes.data ?? []) as AtividadeItem[]);
    setCaptacoes((capRes.data ?? []) as CaptacaoItem[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!organizationId) return;
    (supabase as any).from("empresas_crm").select("id, nome").eq("organization_id", organizationId).order("nome").limit(200)
      .then(({ data }: { data: { id: string; nome: string }[] | null }) => setEmpresas(data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function saveEmpresa(novoEmpresaId: string | null) {
    setSaveError(null);
    const { error } = await (supabase as any).from("contatos").update({ empresa_crm_id: novoEmpresaId }).eq("id", id);
    if (error) { setSaveError("Não foi possível salvar a empresa. Tente novamente."); return; }
    void fetchData();
  }

  async function saveField(field: string, value: unknown) {
    if (!contato) return;
    const previousValue = (contato as Record<string, unknown>)[field];
    setSaveError(null);
    setContato(current => current ? ({ ...current, [field]: value } as Contato) : current);
    const { data, error } = await (supabase as any).from("contatos").update({ [field]: value }).eq("id", id).select("*").single();
    if (error) {
      setContato(current => current ? ({ ...current, [field]: previousValue } as Contato) : current);
      setSaveError("Não foi possível salvar a avaliação. Tente novamente.");
      return;
    }
    if (data) setContato(prev => prev ? { ...prev, ...data } : prev);
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="mx-auto max-w-pagina px-4 pt-16 sm:px-6 lg:px-10 space-y-4">
          <div className="h-4 w-24 rounded bg-black/[.06] animate-pulse" />
          <div className="h-12 w-72 rounded bg-black/[.06] animate-pulse" />
          <div className="h-4 w-48 rounded bg-black/[.06] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!contato) {
    return (
      <div className="min-h-full">
        <div className="mx-auto max-w-pagina px-4 pt-16 text-center sm:px-6 lg:px-10">
          <p className="text-[0.8125rem] text-black/40">Contato não encontrado.</p>
          <Link href="/contatos" className="mt-4 inline-block text-[0.75rem] text-[#7259B5] hover:underline">Voltar</Link>
        </div>
      </div>
    );
  }

  const nome        = contato.nome ?? "Contato";
  const initials    = nome.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const dias        = daysSince(contato.ultima_interacao);
  const interacaoText = dias === null ? "Sem registro" : dias === 0 ? "Hoje" : `${dias} ${dias === 1 ? "dia" : "dias"} atrás`;

  return (
    <div className="min-h-full">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="mx-auto max-w-pagina px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-9">
          <Link href="/contatos" className="mb-7 inline-flex items-center gap-2 text-[0.75rem] font-medium text-black/40 transition hover:text-black/65">
            <ArrowLeft size={14} /> Contatos
          </Link>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded text-[1.25rem] font-semibold text-black/55"
                style={{ background: "linear-gradient(145deg, #F8F8FA 0%, #D6D6DC 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9), 0 1px 2px rgba(13,13,13,.05)" }}
              >
                {initials}
              </div>

              <div className="min-w-0">
                <h1 className="text-[1.75rem] font-semibold leading-[1.06] tracking-[-.04em] text-[#282525] sm:text-[2.125rem]">
                  <InlineText
                    value={contato.nome}
                    onSave={v => saveField("nome", v)}
                    placeholder="Nome do contato"
                    className="text-[1.75rem] sm:text-[2.125rem] font-semibold leading-[1.06] tracking-[-.04em]"
                  />
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-black/45">
                  <InlineText
                    value={contato.cargo}
                    onSave={v => saveField("cargo", v)}
                    placeholder="Cargo"
                    className="text-[0.8125rem]"
                  />
                  {contato.empresa_crm && (
                    <>
                      <span>·</span>
                      <Link href={`/empresas-crm/${contato.empresa_crm.id}`} className="font-medium text-[#7259B5] hover:underline inline-flex items-center gap-1">
                        <CompanyLogo nome={contato.empresa_crm.nome} domain={contato.empresa_crm.domain_key} site={contato.empresa_crm.site} size={14} className="rounded" />
                        {contato.empresa_crm.nome}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
              {contato.email && (
                <a href={`mailto:${contato.email}`} className="inline-flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04]">
                  <Mail size={14} strokeWidth={1.8} /> E-mail
                </a>
              )}
              {contato.telefone && (
                <a href={`tel:${contato.telefone}`} className="inline-flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04]">
                  <Phone size={14} strokeWidth={1.8} /> Ligar
                </a>
              )}
              {contato.linkedin_url && (
                <a
                  href={contato.linkedin_url.startsWith("http") ? contato.linkedin_url : `https://${contato.linkedin_url}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded border border-black/[.12] bg-white px-4 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.04]"
                >
                  <LinkedinIcon size={14} /> LinkedIn
                </a>
              )}
              <DetailHeaderAction label="Nova atividade" icon={CalendarClock} accent onClick={() => setShowActivity(true)} />
            </div>
          </div>

          {/* ── Health strip ──────────────────────────────────── */}
          <div className="mt-7 grid grid-cols-1 gap-px overflow-hidden rounded border bg-black/[.045] sm:grid-cols-2 lg:grid-cols-[1.1fr_1.15fr_1.15fr_1fr_1fr_1fr]" style={{ borderColor: "rgba(13,13,13,.055)" }}>
            {/* Papel */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Papel na decisão</p>
              <InlineSelect value={contato.papel_decisao} opts={PAPEL_OPTS} onSave={v => saveField("papel_decisao", v)} />
            </div>
            {/* Influência */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45"><Radio size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />Influência</p>
              <InlineBars value={contato.influencia} max={5} color="rgba(13,13,13,.7)" kind="influencia" onSave={v => saveField("influencia", v)} />
            </div>
            {/* Força */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45"><Handshake size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />Força da relação</p>
              <InlineBars value={contato.forca_relacao} max={5} color="#1A8B7A" kind="relacao" onSave={v => saveField("forca_relacao", v)} />
            </div>
            {/* Sentimento */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Sentimento</p>
              <InlineSelect value={contato.sentimento} opts={SENTIMENTO_OPTS} onSave={v => saveField("sentimento", v)} />
            </div>
            {/* Última interação */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Última interação</p>
              <div className="group flex min-h-9 items-center gap-2 rounded border border-transparent bg-transparent px-2.5 py-2 transition hover:border-black/[.10] hover:bg-black/[.018]">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${interacaoAlerta(dias) ? "" : "text-black/40"}`} style={interacaoAlerta(dias) ? { color: interacaoAlerta(dias) } : undefined}><CalendarClock size={14} strokeWidth={1.9} aria-hidden="true" /></span>
                <p className={`truncate text-[0.8125rem] font-semibold tabular-nums ${dias === null ? "text-black/30" : "text-[#282525]"}`}>{interacaoText}</p>
              </div>
            </div>
            {/* Canal preferido */}
            <div className="flex min-h-[6.75rem] flex-col justify-between gap-3 bg-white px-4 py-3.5">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Canal preferido</p>
              <InlineSelect value={contato.canal_preferido} opts={CANAL_OPTS} onSave={v => saveField("canal_preferido", v)} />
            </div>
          </div>
          {saveError && <p role="alert" className="mt-2 text-[0.6875rem] font-medium text-[#D94E4E]">{saveError}</p>}
        </div>
      </header>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <DetailTabs
        ariaLabel="Seções do contato"
        activeTab={pageTab}
        onChange={v => setPageTab(v as PageTab)}
        tabs={[
          { id: "overview",  label: "Histórico",     icon: CalendarClock },
          { id: "captacoes", label: "Negociações",    icon: BriefcaseBusiness, count: captacoes.length },
        ]}
      />

      {/* ── Content ─────────────────────────────────────────────── */}
      <DetailPageContent>
        {pageTab === "overview" && (
          <div className="space-y-7">
            {/* Dados de contato */}
            <section className="overflow-hidden rounded border border-black/[.055] bg-black/[.045]">
              <div className="border-b border-black/[.05] bg-white px-5 py-3.5">
                <p className="text-[0.625rem] font-bold uppercase tracking-wide text-black/40">Dados de contato</p>
              </div>
              <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-h-[5.75rem] min-w-0 bg-white px-5 py-4">
                  <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Empresa</p>
                  <div className="mt-2">
                    <CustomDropdown
                      value={contato.empresa_crm_id ?? ""}
                      onChange={v => saveEmpresa(v || null)}
                      options={[{ value: "", label: "Sem empresa" }, ...empresas.map(e => ({ value: e.id, label: e.nome }))]}
                      icon={<Building2 size={13} />}
                      compact
                      emphasized={false}
                      className="w-full [&>button]:w-full [&>button]:!border-transparent [&>button]:!bg-transparent [&>button]:!px-0 [&>button]:hover:!border-transparent"
                    />
                  </div>
                </div>
                {([
                  { label: "E-mail", field: "email", value: contato.email, Icon: Mail, placeholder: "Adicionar e-mail" },
                  { label: "Telefone", field: "telefone", value: contato.telefone, Icon: Phone, placeholder: "Adicionar telefone" },
                  { label: "Telefone alternativo", field: "telefone_2", value: contato.telefone_2, Icon: Phone, placeholder: "Adicionar outro telefone" },
                  { label: "LinkedIn", field: "linkedin_url", value: contato.linkedin_url, Icon: LinkedinIcon, placeholder: "Adicionar LinkedIn" },
                ] as const).map(({ label, field, value, Icon, placeholder }) => (
                  <div key={field} className="flex min-h-[5.75rem] min-w-0 items-start gap-3 bg-white px-5 py-4">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-black/30">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{label}</p>
                      <InlineText
                        value={value}
                        onSave={nextValue => saveField(field, nextValue)}
                        placeholder={placeholder}
                        className="mt-2 w-full min-w-0 truncate text-[0.8125rem] font-semibold text-black/70"
                      />
                    </div>
                  </div>
                ))}
                <div className="min-h-[6.75rem] min-w-0 bg-white px-5 py-4">
                  <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Origem</p>
                  <div className="mt-2">
                    <InlineSelect value={contato.origem} opts={ORIGEM_OPTS} onSave={value => saveField("origem", value)} />
                  </div>
                </div>
                <div className="min-h-[6.75rem] min-w-0 bg-white px-5 py-4">
                  <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Notas de contato</p>
                  <InlineTextarea value={contato.notas} onSave={value => saveField("notas", value)} />
                </div>
                <div className="flex min-h-[6.75rem] min-w-0 items-start gap-3 bg-white px-5 py-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center text-black/30">
                    <CalendarClock size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Registro</p>
                    <div className="mt-2 space-y-1.5 text-[0.6875rem] text-black/40">
                      <p className="flex items-center justify-between gap-2"><span>Adicionado</span><strong className="font-semibold tabular-nums text-black/65">{fmtDate(contato.created_at)}</strong></p>
                      <p className="flex items-center justify-between gap-2"><span>Atualizado</span><strong className="font-semibold tabular-nums text-black/65">{fmtDate(contato.updated_at)}</strong></p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
              {/* Timeline */}
              <section>
              <p className="mb-4 text-[0.625rem] font-bold uppercase tracking-wide text-black/35">Atividades</p>
              {atividades.length === 0 ? (
                <div className="rounded border border-dashed py-12 text-center text-[0.75rem] text-black/30" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                  Nenhuma atividade registrada
                </div>
              ) : (
                <div className="relative border-l ml-3 space-y-0" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                  {atividades.map(a => {
                    const TipoIcon  = (a.tipo ? TIPO_ICON[a.tipo] : null) ?? MessageSquare;
                    const dataStr   = a.data_realizada ?? a.data_prevista;
                    return (
                      <div key={a.id} className="relative flex gap-4 pb-5 pl-6">
                        <div className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-sm" style={{ background: "#fff" }}>
                          <TipoIcon size={12} strokeWidth={1.75} aria-hidden="true" className="text-black/40" />
                        </div>
                        <div className="min-w-0 flex-1 rounded border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="text-[0.8125rem] font-semibold text-[#282525]">{a.nome}</p>
                            <span className="shrink-0 text-[0.6875rem] text-black/35">{fmtDate(dataStr)}</span>
                          </div>
                          {a.resultado && <p className="mt-1 text-[0.75rem] text-black/55 line-clamp-2">{a.resultado}</p>}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.625rem] text-black/35">
                            {a.feita && <span className="inline-flex items-center gap-1 font-medium text-black/55"><CircleCheck size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />Concluída</span>}
                            {a.responsavel?.full_name && <span>{a.responsavel.full_name}</span>}
                            {a.captacao?.titulo && (
                              <Link href={`/captacoes/${a.captacao.id}`} className="text-[#7259B5] hover:underline">{a.captacao.titulo}</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </section>

              {/* Negociações relacionadas */}
              <aside>
                <p className="mb-3 text-[0.625rem] font-bold uppercase tracking-wide text-black/35">Negociações vinculadas</p>
                {captacoes.length === 0 ? (
                  <div className="rounded border border-dashed py-8 text-center text-[0.75rem] text-black/30" style={{ borderColor: "rgba(13,13,13,.12)" }}>Nenhuma negociação</div>
                ) : (
                  <div className="space-y-2">
                    {captacoes.slice(0, 5).map(c => {
                      const cfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: "rgba(13,13,13,.4)" };
                      const etiqueta = etiquetasCaptacao[c.status];
                      return (
                        <Link key={c.id} href={`/captacoes/${c.id}`}
                          className="block rounded border px-3 py-2.5 transition hover:border-[#7259B5]/30 hover:bg-black/[.04]"
                          style={{ borderColor: "rgba(13,13,13,.09)" }}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[0.75rem] font-semibold text-[#282525] leading-snug">{c.titulo ?? c.projeto?.nome}</p>
                            <StatusBadge
                              status={c.status}
                              label={etiqueta?.label ?? cfg.label}
                              bg={etiqueta?.cor ?? cfg.color}
                              iconName={etiqueta?.icone}
                              size="sm"
                            />
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[0.625rem] text-black/35">
                            {c.empresa_crm?.nome && <span>{c.empresa_crm.nome}</span>}
                            {c.valor_solicitado && <span className="tabular-nums" title={formatarValorCompleto(c.valor_solicitado)}>· {formatarValorCurto(c.valor_solicitado)}</span>}
                          </div>
                        </Link>
                      );
                    })}
                    {captacoes.length > 5 && (
                      <button type="button" onClick={() => setPageTab("captacoes")}
                        className="w-full rounded border border-dashed py-2 text-[0.6875rem] text-[#7259B5] transition hover:bg-black/[.04]"
                        style={{ borderColor: "rgba(114,89,181,.2)" }}>
                        Ver todas ({captacoes.length})
                      </button>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}

        {pageTab === "captacoes" && (
          <div>
            <p className="mb-4 text-[0.625rem] font-bold uppercase tracking-wide text-black/35">Negociações vinculadas</p>
            {captacoes.length === 0 ? (
              <div className="rounded border border-dashed py-16 text-center text-[0.75rem] text-black/30" style={{ borderColor: "rgba(13,13,13,.12)" }}>
                Nenhuma negociação vinculada a este contato
              </div>
            ) : (
              <div className="overflow-hidden rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(13,13,13,.07)", background: "rgba(13,13,13,.02)" }}>
                      {["Negociação", "Empresa", "Valor", "Status"].map(h => (
                        <th key={h} className="px-5 py-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {captacoes.map(c => {
                      const cfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: "rgba(13,13,13,.4)" };
                      const etiqueta = etiquetasCaptacao[c.status];
                      const nome = c.titulo ?? c.projeto?.nome;
                      return (
                        <tr
                          key={c.id}
                          role="link"
                          tabIndex={0}
                          aria-label={nome ? `Abrir negociação ${nome}` : "Abrir negociação"}
                          onClick={() => router.push(`/captacoes/${c.id}`)}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(`/captacoes/${c.id}`);
                            }
                          }}
                          style={{ borderBottom: "1px solid rgba(13,13,13,.05)" }}
                          className="group cursor-pointer transition hover:bg-black/[.025] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
                        >
                          <td className="px-5 py-3.5">
                            <span className="text-[0.8125rem] font-semibold text-[#282525]">{nome}</span>
                          </td>
                          <td className="px-5 py-3.5 text-[0.78125rem] text-black/55">{c.empresa_crm?.nome ?? "—"}</td>
                          <td className="px-5 py-3.5 text-[0.78125rem] text-black/55 tabular-nums" title={c.valor_solicitado ? formatarValorCompleto(c.valor_solicitado) : undefined}>{c.valor_solicitado ? formatarValorCurto(c.valor_solicitado) : "—"}</td>
                          <td className="px-5 py-3.5">
                            <StatusBadge
                              status={c.status}
                              label={etiqueta?.label ?? cfg.label}
                              bg={etiqueta?.cor ?? cfg.color}
                              iconName={etiqueta?.icone}
                              size="sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DetailPageContent>

      {showActivity && (
        <NovaAtividadeModal
          prefill={{ contato_id: id, empresa_crm_id: contato.empresa_crm_id ?? undefined }}
          onClose={() => setShowActivity(false)}
          onSaved={() => { setShowActivity(false); void fetchData(); }}
        />
      )}
    </div>
  );
}
