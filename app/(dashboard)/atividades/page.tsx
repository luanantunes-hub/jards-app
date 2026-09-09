"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, Mail, Phone, Users, Calendar, MoreHorizontal, CheckSquare,
  CheckCircle2, Circle, AlertCircle, Clock, X, CheckCheck,
  ChevronLeft, ChevronRight, CalendarDays, List, BarChart2, Gauge, Settings2, ArrowUpDown, Pencil,
} from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { EditarAtividadeModal } from "@/components/modals/EditarAtividadeModal";
import { ConcluirAtividadeModal } from "@/components/modals/ConcluirAtividadeModal";
import PrioBadge from "@/components/ui/PrioBadge";
import type { TipoAtividade, Prioridade } from "@/lib/supabase/types";
import { FilterButton, SegmentedControl } from "@/components/ui/FilterControls";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";

const ATIVIDADES_COLUMNS = [
  { id: "concluida", label: "Concluída", width: "105px" }, { id: "atividade", label: "Atividade", width: "280px", hideable: false }, { id: "negociacao", label: "Negociação", width: "190px" }, { id: "empresa", label: "Empresa / contato", width: "220px" }, { id: "prazo", label: "Prazo", width: "120px" }, { id: "duracao", label: "Duração", width: "105px" }, { id: "prioridade", label: "Prioridade", width: "115px" }, { id: "responsavel", label: "Responsável", width: "170px" }, { id: "resultado", label: "Resultado", width: "150px" }, { id: "projeto", label: "Projeto", width: "180px" }, { id: "observacao", label: "Observação", width: "230px" },
] as const satisfies readonly ColumnDefinition[];

/* ─── Types ─────────────────────────────────────────────────────────────── */

type AtividadeRow = {
  id: string;
  nome: string;
  tipo: TipoAtividade | null;
  prioridade: Prioridade | null;
  data_inicio: string | null;
  data_prevista: string | null;
  data_realizada: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  resultado: string | null;
  feita: boolean;
  nota: string | null;
  tipo_custom: { nome: string; icone: TipoAtividade; cor: string } | null;
  empresa_crm: { nome: string } | null;
  empresa_crm_id: string | null;
  captacao_id: string | null;
  projeto: { nome: string } | null;
  captador: { nome: string; agencia: string | null } | null;
  proponente: { nome: string } | null;
  captacao: {
    titulo: string | null;
    projeto: { nome: string } | null;
    empresa_crm: { nome: string } | null;
    empresa: { nome: string } | null;
  } | null;
  contato: { nome: string | null; email: string | null; telefone: string | null } | null;
  responsavel_id: string | null;
  responsavel: { id: string; full_name: string | null; avatar_url: string | null } | null;
  source_kind?: "atividade" | "followup";
  source_id?: string;
  source_link?: string;
};

type Tab        = "pendentes" | "historico";
type TipoFilter = TipoAtividade | "todos";
type ViewMode   = "lista" | "calendario" | "gantt" | "carga";
type CalendarScale = "dia" | "semana" | "mes";

/* ─── Constants ─────────────────────────────────────────────────────────── */

const TIPO_CONFIG: Record<TipoAtividade, { label: string; Icon: React.ElementType; color: string }> = {
  email:    { label: "E-mail",   Icon: Mail,           color: "#2D72B0" },
  telefone: { label: "Telefone", Icon: Phone,          color: "#1A8B7A" },
  linkedin: { label: "LinkedIn", Icon: LinkedinIcon,   color: "#2D72B0" },
  reuniao:  { label: "Reunião",  Icon: Users,          color: "rgba(13,13,13,.45)" },
  evento:   { label: "Evento",   Icon: Calendar,       color: "#B07A14" },
  tarefa:   { label: "Tarefa",   Icon: CheckSquare,    color: "#7259B5" },
  outro:    { label: "Outro",    Icon: MoreHorizontal, color: "rgba(13,13,13,.40)" },
};

const TIPO_PILL: Record<TipoAtividade, { bg: string; text: string; bar: string }> = {
  email:    { bg: "#7259B5", text: "white", bar: "#7259B5" },
  telefone: { bg: "#1A8B7A", text: "white", bar: "#1A8B7A" },
  linkedin: { bg: "#2D72B0", text: "white", bar: "#2D72B0" },
  reuniao:  { bg: "#B07A14", text: "white", bar: "#B07A14" },
  evento:   { bg: "#2D72B0", text: "white", bar: "#2D72B0" },
  tarefa:   { bg: "#7259B5", text: "white", bar: "#7259B5" },
  outro:    { bg: "rgba(13,13,13,.40)", text: "white", bar: "rgba(13,13,13,.35)" },
};


type GroupKey = "atrasadas" | "hoje" | "semana" | "depois" | "sem_data";

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAY_NAMES_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const GANTT_DAY_W  = 52;
const GANTT_LEFT_W = 220;
const GANTT_DAYS   = 14;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function LinkedinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function normDate(d: string): string {
  return d.split("T")[0];
}

function scheduledDate(a: AtividadeRow): string | null {
  return a.data_prevista ?? a.data_inicio;
}

function followupsToActivities(rows: any[]): AtividadeRow[] {
  return rows.map(row => ({
    id: `followup:${row.id}`,
    nome: row.titulo,
    tipo: "tarefa" as TipoAtividade,
    prioridade: null,
    data_inicio: null,
    data_prevista: row.previsto_para,
    data_realizada: row.concluido_em,
    hora_inicio: row.previsto_para?.slice(11, 16) ?? null,
    hora_fim: null,
    resultado: row.resultado,
    feita: row.status !== "pendente",
    nota: row.motivo,
    tipo_custom: { nome: "Follow-up", icone: "tarefa" as TipoAtividade, cor: "#7259B5" },
    empresa_crm: row.empresa_crm,
    empresa_crm_id: row.empresa_crm_id,
    captacao_id: row.captacao_id,
    projeto: null,
    captador: null,
    proponente: null,
    captacao: row.captacao,
    contato: row.contato ? { ...row.contato, email: null, telefone: null } : null,
    responsavel_id: row.responsavel_id,
    responsavel: row.responsavel_id ? {
      id: row.responsavel_id,
      full_name: row.responsavel?.full_name ?? null,
      avatar_url: row.responsavel?.avatar_url ?? null,
    } : null,
    source_kind: "followup" as const,
    source_id: row.id,
    source_link: row.captacao_id
      ? `/captacoes/${row.captacao_id}?tab=relacionamento`
      : row.conta_patrocinio_id
        ? `/contas-patrocinio/${row.conta_patrocinio_id}?tab=relationship`
        : row.empresa_crm_id
          ? `/empresas-crm/${row.empresa_crm_id}?tab=relationship`
          : "/atividades",
  }));
}

function typePillFor(a: AtividadeRow) {
  if (a.tipo_custom) return { bg: a.tipo_custom.cor, text: "white", bar: a.tipo_custom.cor };
  return a.tipo ? TIPO_PILL[a.tipo] : TIPO_PILL.outro;
}

function typeConfigFor(a: AtividadeRow) {
  if (a.tipo_custom) {
    return {
      label: a.tipo_custom.nome,
      color: a.tipo_custom.cor,
      Icon: TIPO_CONFIG[a.tipo_custom.icone]?.Icon ?? MoreHorizontal,
    };
  }
  return a.tipo ? TIPO_CONFIG[a.tipo] : TIPO_CONFIG.outro;
}

function nearestScheduledDate(atividades: AtividadeRow[]): Date | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dated = atividades
    .filter(a => !a.feita && scheduledDate(a))
    .map(a => new Date(`${normDate(scheduledDate(a)!)}T00:00:00`));
  if (!dated.length) return null;
  return dated.reduce((closest, date) =>
    Math.abs(date.getTime() - today.getTime()) < Math.abs(closest.getTime() - today.getTime()) ? date : closest,
  );
}

function getGroup(data_prevista: string | null): GroupKey {
  if (!data_prevista) return "sem_data";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d    = new Date(data_prevista + "T00:00:00");
  const diff = Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0)   return "atrasadas";
  if (diff === 0) return "hoje";
  if (diff <= 7)  return "semana";
  return "depois";
}

function captacaoLabel(a: AtividadeRow): string {
  const c = a.captacao;
  return c?.titulo ?? c?.projeto?.nome ?? c?.empresa_crm?.nome ?? c?.empresa?.nome ?? "—";
}

function entityLabel(a: AtividadeRow): string {
  if (a.contato?.nome)     return a.contato.nome;
  if (a.captacao?.titulo)  return a.captacao.titulo ?? "—";
  if (a.projeto?.nome)     return a.projeto.nome;
  if (a.captador?.agencia) return a.captador.agencia;
  if (a.captador?.nome)    return a.captador.nome;
  if (a.proponente?.nome)  return a.proponente.nome;
  if (a.empresa_crm?.nome) return a.empresa_crm.nome;
  return "—";
}

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/* ─── Calendar View ─────────────────────────────────────────────────────── */

function CalendarioView({ atividades, tipoFilter, onEdit, onNew }: { atividades: AtividadeRow[]; tipoFilter: TipoFilter; onEdit: (id: string) => void; onNew: (dateStr: string) => void }) {
  const [scale, setScale] = useState<CalendarScale>("mes");
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [hasNavigated, setHasNavigated] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    if (hasNavigated || atividades.length === 0) return;
    const date = nearestScheduledDate(atividades);
    if (date) setCursor(date);
  }, [atividades, hasNavigated]);

  const year        = cursor.getFullYear();
  const monthIdx    = cursor.getMonth();
  const firstDay    = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const startPad    = (firstDay + 6) % 7;
  const totalCells  = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const todayStr    = new Date().toISOString().split("T")[0];

  const filtered = tipoFilter === "todos" ? atividades : atividades.filter(a => a.tipo === tipoFilter);

  const byDate = new Map<string, AtividadeRow[]>();
  filtered.forEach(a => {
    const date = scheduledDate(a);
    if (!date) return;
    const key = normDate(date);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(a);
  });

  const weekStart = mondayOf(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const cursorStr = cursor.toISOString().split("T")[0];

  const move = (direction: -1 | 1) => {
    setHasNavigated(true);
    setCursor(current => {
      const next = new Date(current);
      if (scale === "dia") next.setDate(next.getDate() + direction);
      if (scale === "semana") next.setDate(next.getDate() + 7 * direction);
      if (scale === "mes") next.setMonth(next.getMonth() + direction);
      return next;
    });
  };
  const goToday = () => {
    setHasNavigated(true);
    const today = new Date(); today.setHours(0, 0, 0, 0); setCursor(today);
  };
  const navLabel = scale === "dia"
    ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : scale === "semana"
      ? `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : `${MONTH_NAMES[monthIdx]} ${year}`;

  const ActivityCard = ({ atividade, compact = false }: { atividade: AtividadeRow; compact?: boolean }) => {
    const pill = typePillFor(atividade);
    const config = typeConfigFor(atividade);
    const Icon = config.Icon;
    const entity = entityLabel(atividade);
    return (
      <button
        type="button"
        onClick={() => onEdit(atividade.id)}
        className={`w-full rounded-[2px] border text-left transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 ${compact ? "p-2" : "p-3"}`}
        style={{
          borderColor: atividade.feita ? "rgba(13,13,13,.08)" : pill.bar,
          background: atividade.feita ? "rgba(13,13,13,.04)" : pill.bg,
          color: atividade.feita ? "rgba(13,13,13,.25)" : "#FFFFFF",
        }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`${compact ? "w-6 h-6" : "w-8 h-8"} rounded flex items-center justify-center flex-shrink-0`}
            style={{
              background: atividade.feita ? "rgba(13,13,13,.05)" : "rgba(255,255,255,.16)",
              color: atividade.feita ? "rgba(13,13,13,.25)" : "#FFFFFF",
            }}
          >
            <Icon size={compact ? 12 : 14} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`block font-semibold leading-snug ${compact ? "text-[10px]" : "text-[12px]"} ${atividade.feita ? "line-through" : ""}`}
              style={{ color: atividade.feita ? "rgba(13,13,13,.25)" : "#FFFFFF" }}
            >
              {atividade.nome}
            </span>
            {!compact && entity !== "—" && (
              <span
                className="block mt-1 text-[10px] truncate"
                style={{ color: atividade.feita ? "rgba(13,13,13,.25)" : "rgba(255,255,255,.72)" }}
              >
                {entity}
              </span>
            )}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {/* Botões de controle da escala do calendário */}
      <div className="flex flex-col gap-3 px-4 py-3.5 border-b sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} aria-label="Período anterior" className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:bg-black/[.04] transition text-black/40 hover:text-black/70">
            <ChevronLeft size={14} />
          </button>
          <h2 className="text-[13px] font-semibold text-black/75 min-w-0 flex-1 text-center capitalize sm:min-w-[220px] sm:flex-none">
            {navLabel}
          </h2>
          <button type="button" onClick={() => move(1)} aria-label="Próximo período" className="w-8 h-8 flex items-center justify-center rounded border border-transparent hover:bg-black/[.04] transition text-black/40 hover:text-black/70">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="inline-flex h-9 flex-shrink-0 rounded border bg-white p-0.5" style={{ borderColor: "rgba(13,13,13,.09)" }}>
            {(["dia", "semana", "mes"] as CalendarScale[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setScale(option)}
                className={`h-8 px-3 rounded border text-[11px] font-medium capitalize transition ${scale === option ? "border-[#7259B5]/35 text-[#7259B5] bg-white" : "border-transparent text-black/35 hover:bg-black/[.04] hover:text-black/55"}`}
              >
                {option === "mes" ? "Mês" : option === "dia" ? "Dia" : "Semana"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {scale === "dia" && (
        <div className="min-h-[360px] p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between border-b pb-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.12em] text-black/30">Agenda do dia</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums text-black/80">{cursor.getDate()}</p>
            </div>
            <span className="text-[11px] text-black/30">{(byDate.get(cursorStr) ?? []).length} atividades</span>
          </div>
          {(byDate.get(cursorStr) ?? []).length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(byDate.get(cursorStr) ?? []).map(atividade => <ActivityCard key={atividade.id} atividade={atividade} />)}
            </div>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center text-center">
              <CalendarDays size={24} className="mb-2 text-black/15" />
              <p className="text-xs font-medium text-black/30">Nenhuma atividade neste dia</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => onNew(cursorStr)}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-black/30 hover:text-[#7259B5] transition"
          >
            <Plus size={12} /> Nova atividade
          </button>
        </div>
      )}

      {scale === "semana" && (
        <div className="overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7">
            {weekDays.map((date, index) => {
              const dateStr = date.toISOString().split("T")[0];
              const items = byDate.get(dateStr) ?? [];
              const isToday = dateStr === todayStr;
              return (
                <section key={dateStr}
                  className="min-h-[390px] border-l first:border-l-0 flex flex-col"
                  style={{ borderColor: "rgba(13,13,13,.06)", background: isToday ? "rgba(114,89,181,.035)" : "white" }}
                  onMouseEnter={() => setHoveredDate(dateStr)}
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  <header className="border-b px-3 py-3 text-center" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                    <p className={`text-[9px] font-medium uppercase tracking-[.12em] ${isToday ? "text-[#7259B5]" : "text-black/30"}`}>{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index]}</p>
                    <p className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded text-[12px] font-semibold tabular-nums ${isToday ? "bg-[#7259B5] text-white" : "text-black/60"}`}>{date.getDate()}</p>
                  </header>
                  <div className="space-y-2 p-2 flex-1">
                    {items.map(atividade => <ActivityCard key={atividade.id} atividade={atividade} compact />)}
                    {items.length === 0 && <p className="pt-5 text-center text-[10px] text-black/20">Livre</p>}
                  </div>
                  <div className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => onNew(dateStr)}
                      className="w-full flex items-center justify-center gap-1 py-1 rounded text-[9.5px] font-medium text-black/20 hover:text-[#7259B5] hover:bg-[#7259B5]/5 transition"
                      style={{ opacity: hoveredDate === dateStr ? 1 : 0, pointerEvents: hoveredDate === dateStr ? "auto" : "none" }}
                    >
                      <Plus size={10} /> Nova
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {scale === "mes" && <>
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-medium tracking-wider text-black/30" style={{ borderLeft: "1px solid rgba(13,13,13,.05)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - startPad + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const dateStr = isCurrentMonth
            ? `${year}-${String(monthIdx + 1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`
            : null;
          const isToday   = dateStr === todayStr;
          const isWeekend = (i % 7) >= 5;
          const dayItems  = dateStr ? (byDate.get(dateStr) ?? []) : [];
          const shown     = dayItems.slice(0, 3);
          const overflow  = dayItems.length - 3;

          return (
            <div key={i}
              className="min-h-[92px] p-1.5 sm:min-h-[104px] flex flex-col"
              style={{
                borderTop: "1px solid rgba(13,13,13,.06)",
                borderLeft: i % 7 !== 0 ? "1px solid rgba(13,13,13,.05)" : "none",
                background: isToday
                  ? "rgba(114,89,181,.06)"
                  : !isCurrentMonth ? "rgba(13,13,13,.012)"
                  : isWeekend ? "rgba(13,13,13,.008)"
                  : "transparent",
              }}
              onMouseEnter={() => isCurrentMonth && dateStr && setHoveredDate(dateStr)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              <div className="mb-1">
                <span className={`text-[11px] font-bold inline-flex items-center justify-center w-5 h-5 rounded-full ${
                  isToday ? "bg-[#7259B5] text-white" : !isCurrentMonth ? "text-black/20" : "text-black/40"
                }`}>
                  {isCurrentMonth ? dayNum : ""}
                </span>
              </div>
              <div className="flex-1">
                        {shown.map(a => {
                          const pill = typePillFor(a);
                          return (
                    <button type="button" key={a.id}
                      onClick={() => onEdit(a.id)}
                      className="mb-[2px] block w-full cursor-pointer truncate rounded-[2px] px-1.5 py-[3px] text-left text-[9.5px] font-medium leading-tight transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25"
                              style={{
                                background: a.feita ? "rgba(0,0,0,.04)" : pill.bg,
                                color: a.feita ? "rgba(13,13,13,.25)" : "#FFFFFF",
                                textDecoration: a.feita ? "line-through" : "none",
                              }}
                      title={a.nome}
                    >
                      {a.nome}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <div className="text-[9px] font-bold text-black/25 mt-0.5">+{overflow} mais</div>
                )}
              </div>
              {isCurrentMonth && dateStr && (
                <button
                  type="button"
                  onClick={() => onNew(dateStr)}
                  className="w-full flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium text-black/20 hover:text-[#7259B5] hover:bg-[#7259B5]/5 transition"
                  style={{ opacity: hoveredDate === dateStr ? 1 : 0, pointerEvents: hoveredDate === dateStr ? "auto" : "none" }}
                >
                  <Plus size={9} /> Nova
                </button>
              )}
            </div>
          );
        })}
        </div>

        {filtered.filter(a => {
        const scheduled = scheduledDate(a);
        if (!scheduled) return false;
        const d = new Date(`${normDate(scheduled)}T00:00:00`);
        return d.getFullYear() === year && d.getMonth() === monthIdx;
      }).length === 0 && (
        <div className="py-14 text-center border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <CalendarDays size={24} className="text-black/15 mx-auto mb-2" />
          <p className="text-xs font-semibold text-black/25">Nenhuma atividade em {MONTH_NAMES[monthIdx]}</p>
        </div>
        )}
      </>}
    </div>
  );
}

/* ─── Team workload View ────────────────────────────────────────────────── */

function MemberAvatar({ name, avatarUrl, unassigned = false }: {
  name: string;
  avatarUrl: string | null;
  unassigned?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => { setImageFailed(false); }, [avatarUrl]);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${name}`}
        className="h-8 w-8 shrink-0 rounded object-cover"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[11px] font-semibold"
      style={{
        background: unassigned ? "rgba(176,122,20,.10)" : "rgba(114,89,181,.08)",
        color: unassigned ? "#B07A14" : "#7259B5",
      }}
      aria-label={unassigned ? "Sem responsável" : name}
    >
      {unassigned ? "—" : name.charAt(0).toUpperCase()}
    </span>
  );
}

function CargaEquipeView({ atividades, tipoFilter, onEdit, onReassign }: {
  atividades: AtividadeRow[];
  tipoFilter: TipoFilter;
  onEdit: (id: string) => void;
  onReassign: (id: string, responsavelId: string | null, responsavelName: string | null, avatarUrl: string | null) => Promise<boolean>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const DEFAULT_THRESHOLDS = { balancedMax: 5, attentionMax: 8 };
  const organizationId = useOrganizationId();
  const supabase = useMemo(() => createClient(), []);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [draftThresholds, setDraftThresholds] = useState(DEFAULT_THRESHOLDS);
  const [showThresholds, setShowThresholds] = useState(false);
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const todayStr = new Date().toISOString().split("T")[0];
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return { date, key: date.toISOString().split("T")[0] };
  });
  const weekEnd = days[6].key;
  const base = (tipoFilter === "todos" ? atividades : atividades.filter(a => a.tipo === tipoFilter))
    .filter(a => !a.feita);

  const memberMap = new Map<string, { id: string; name: string; avatarUrl: string | null; items: AtividadeRow[] }>();
  base.forEach(atividade => {
    const id = atividade.responsavel_id ?? "__unassigned";
    const name = atividade.responsavel?.full_name?.trim() || "Sem responsável";
    const avatarUrl = atividade.responsavel?.avatar_url ?? null;
    if (!memberMap.has(id)) memberMap.set(id, { id, name, avatarUrl, items: [] });
    const member = memberMap.get(id)!;
    if (!member.avatarUrl && avatarUrl) member.avatarUrl = avatarUrl;
    member.items.push(atividade);
  });
  const members = [...memberMap.values()].sort((a, b) => {
    if (a.id === "__unassigned") return 1;
    if (b.id === "__unassigned") return -1;
    return a.name.localeCompare(b.name);
  });

  const [activeItem, setActiveItem] = useState<AtividadeRow | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const atividadeId = String(event.active.id);
    setActiveItem(base.find(item => item.id === atividadeId) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;
    const atividadeId = String(active.id);
    const targetMemberId = String(over.id);
    const atividade = base.find(item => item.id === atividadeId);
    if (!atividade) return;
    const currentMemberId = atividade.responsavel_id ?? "__unassigned";
    if (currentMemberId === targetMemberId) return;
    const responsavelId = targetMemberId === "__unassigned" ? null : targetMemberId;
    const targetMember = members.find(member => member.id === targetMemberId);
    const responsavelName = targetMemberId === "__unassigned" ? null : (targetMember?.name ?? null);
    const avatarUrl = targetMemberId === "__unassigned" ? null : (targetMember?.avatarUrl ?? null);
    void onReassign(atividadeId, responsavelId, responsavelName, avatarUrl);
  }

  const itemsInWeek = (items: AtividadeRow[]) => items.filter(item => {
    const date = scheduledDate(item);
    if (!date) return false;
    const key = normDate(date);
    return key >= days[0].key && key <= weekEnd;
  });
  const unassignedInWeek = itemsInWeek(memberMap.get("__unassigned")?.items ?? []).length;
  const overloaded = members.filter(member => member.id !== "__unassigned" && itemsInWeek(member.items).length > thresholds.attentionMax).length;

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await (supabase as any)
        .from("user_preferences")
        .select("settings")
        .eq("user_id", user.id)
        .eq("organization_id", organizationId)
        .eq("preference_key", "atividades.workload")
        .maybeSingle();
      if (!active || !data?.settings) return;
      const settings = data.settings as { balancedMax?: number; attentionMax?: number };
      if (Number.isInteger(settings.balancedMax) && Number.isInteger(settings.attentionMax) && settings.balancedMax! >= 1 && settings.attentionMax! > settings.balancedMax!) {
        const saved = { balancedMax: settings.balancedMax!, attentionMax: settings.attentionMax! };
        setThresholds(saved);
        setDraftThresholds(saved);
      }
    });
    return () => { active = false; };
  }, [organizationId, supabase]);

  async function saveThresholds(next: { balancedMax: number; attentionMax: number }) {
    if (next.balancedMax < 1 || next.attentionMax <= next.balancedMax) {
      setThresholdError("O limite de atenção deve ser maior que o limite equilibrado.");
      return;
    }
    if (!organizationId) {
      setThresholdError("Não foi possível identificar a organização.");
      return;
    }
    setSavingThresholds(true);
    setThresholdError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setThresholdError("Sessão não encontrada.");
      setSavingThresholds(false);
      return;
    }
    const { error } = await (supabase as any).from("user_preferences").upsert({
      user_id: user.id,
      organization_id: organizationId,
      preference_key: "atividades.workload",
      settings: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,organization_id,preference_key" });
    if (error) {
      setThresholdError(`Não foi possível salvar. ${error.message}`);
      setSavingThresholds(false);
      return;
    }
    setThresholds(next);
    setDraftThresholds(next);
    setSavingThresholds(false);
    setShowThresholds(false);
  }

  const loadStyle = (count: number) => {
    if (count > thresholds.attentionMax) return { color: "#D94E4E", label: "Sobrecarga" };
    if (count > thresholds.balancedMax) return { color: "#B07A14", label: "Atenção" };
    return { color: "#2E8932", label: count === 0 ? "Livre" : "Equilibrada" };
  };

  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="text-[10px] font-medium uppercase tracking-[.12em] text-black/30">Carga da equipe</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekStart(current => new Date(current.getTime() - 7 * 86400000))} aria-label="Semana anterior" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.09] bg-white text-black/40 transition hover:bg-black/[.04]"><ChevronLeft size={14} /></button>
          <span className="min-w-[170px] text-center text-[11px] font-medium tabular-nums text-black/55">{fmtDate(days[0].key)} — {fmtDate(weekEnd)}</span>
          <button type="button" onClick={() => setWeekStart(current => new Date(current.getTime() + 7 * 86400000))} aria-label="Próxima semana" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.09] bg-white text-black/40 transition hover:bg-black/[.04]"><ChevronRight size={14} /></button>
          <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))} className="h-9 rounded border border-black/[.09] bg-white px-3 text-[11px] font-medium text-black/45 transition hover:bg-black/[.04]">Hoje</button>
          <button type="button" onClick={() => { setDraftThresholds(thresholds); setThresholdError(null); setShowThresholds(current => !current); }} aria-expanded={showThresholds} className={`flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[11px] font-medium transition hover:bg-black/[.04] ${showThresholds ? "border-[#7259B5] text-[#7259B5]" : "border-black/[.09] text-black/45"}`}><Settings2 size={13} /> Limites</button>
        </div>
      </div>

      {showThresholds && (
        <div className="border-b bg-black/[.012] px-4 py-4 sm:px-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-[12px] font-semibold text-black/70">Classificação da carga semanal</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[9px] font-medium uppercase tracking-[.1em] text-[#2E8932]">Equilibrada até</span>
                <input type="number" min={1} max={99} value={draftThresholds.balancedMax} onChange={event => setDraftThresholds(current => ({ ...current, balancedMax: Math.max(1, Number(event.target.value) || 1) }))} className="h-9 w-24 rounded border border-black/10 bg-white px-3 text-[12px] font-medium tabular-nums text-black/70 outline-none focus:border-[#7259B5]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[9px] font-medium uppercase tracking-[.1em] text-[#B07A14]">Atenção até</span>
                <input type="number" min={2} max={99} value={draftThresholds.attentionMax} onChange={event => setDraftThresholds(current => ({ ...current, attentionMax: Math.max(2, Number(event.target.value) || 2) }))} className="h-9 w-24 rounded border border-black/10 bg-white px-3 text-[12px] font-medium tabular-nums text-black/70 outline-none focus:border-[#7259B5]" />
              </label>
              <div className="pb-0.5 text-[10px] text-[#D94E4E]">Acima de {draftThresholds.attentionMax}: sobrecarga</div>
              <button type="button" onClick={() => { setDraftThresholds(DEFAULT_THRESHOLDS); setThresholdError(null); }} className="h-9 rounded border border-black/10 bg-white px-3 text-[11px] font-medium text-black/40 transition hover:bg-black/[.04]">Restaurar padrão</button>
              <button type="button" disabled={savingThresholds} onClick={() => void saveThresholds(draftThresholds)} className="h-9 rounded border border-[#7259B5]/35 bg-white px-3 text-[11px] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40">{savingThresholds ? "Salvando..." : "Salvar limites"}</button>
            </div>
          </div>
          {thresholdError && <p role="alert" className="mt-3 text-[10px] text-[#D94E4E]">{thresholdError}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="px-5 py-3">
          <p className="text-[18px] font-semibold tabular-nums text-black/75">{members.filter(member => member.id !== "__unassigned").length}</p>
          <p className="text-[10px] text-black/30">membros com atividades</p>
        </div>
        <div className="border-l px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <p className={`text-[18px] font-semibold tabular-nums ${overloaded > 0 ? "text-[#D94E4E]" : "text-black/75"}`}>{overloaded}</p>
          <p className="text-[10px] text-black/30">em sobrecarga</p>
        </div>
        <div className="border-l px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <p className={`text-[18px] font-semibold tabular-nums ${unassignedInWeek > 0 ? "text-[#B07A14]" : "text-black/75"}`}>{unassignedInWeek}</p>
          <p className="text-[10px] text-black/30">sem responsável</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
          <Gauge size={24} className="mb-2 text-black/15" />
          <p className="text-xs font-medium text-black/30">Nenhuma atividade pendente para distribuir</p>
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[220px_repeat(7,minmax(96px,1fr))_110px] border-b bg-black/[.012]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <div className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-[.1em] text-black/30">Responsável</div>
              {days.map(({ date, key }) => <div key={key} className={`border-l px-2 py-2.5 text-center ${key === todayStr ? "bg-[#7259B5]/[.05]" : ""}`} style={{ borderColor: "rgba(13,13,13,.05)" }}><p className={`text-[9px] font-medium uppercase ${key === todayStr ? "text-[#7259B5]" : "text-black/30"}`}>{DAY_NAMES_SHORT[date.getDay()]}</p><p className={`mt-0.5 text-[11px] font-semibold tabular-nums ${key === todayStr ? "text-[#7259B5]" : "text-black/55"}`}>{date.getDate()}</p></div>)}
              <div className="border-l px-3 py-2.5 text-center text-[10px] font-medium uppercase tracking-[.1em] text-black/30" style={{ borderColor: "rgba(13,13,13,.05)" }}>Semana</div>
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {members.map(member => {
                const weeklyItems = itemsInWeek(member.items);
                const status = loadStyle(weeklyItems.length);
                return (
                  <MemberDropRow key={member.id} memberId={member.id}>
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} unassigned={member.id === "__unassigned"} />
                      <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-black/70">{member.name}</p><p className="mt-0.5 text-[9px] text-black/30">{member.items.length} pendentes no total</p></div>
                    </div>
                    {days.map(({ key }) => {
                      const dayItems = weeklyItems.filter(item => normDate(scheduledDate(item)!) === key);
                      return <div key={key} className={`space-y-1 border-l p-1.5 ${key === todayStr ? "bg-[#7259B5]/[.025]" : ""}`} style={{ borderColor: "rgba(13,13,13,.05)" }}>{dayItems.map(item => <DraggablePill key={item.id} item={item} onEdit={onEdit} />)}</div>;
                    })}
                    <div className="flex flex-col items-center justify-center border-l px-3 py-2" style={{ borderColor: "rgba(13,13,13,.05)" }}><span className="text-[18px] font-semibold tabular-nums" style={{ color: status.color }}>{weeklyItems.length}</span><span className="text-[9px] font-medium" style={{ color: status.color }}>{status.label}</span></div>
                  </MemberDropRow>
                );
              })}
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="rounded px-1.5 py-1 text-left text-[9px] font-medium shadow-lg" style={{ background: typePillFor(activeItem).bar, color: "white", width: 96 }}>
                    {activeItem.nome}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberDropRow({ memberId, children }: { memberId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: memberId });
  return (
    <div
      ref={setNodeRef}
      className={`grid min-h-[70px] grid-cols-[220px_repeat(7,minmax(96px,1fr))_110px] border-b last:border-b-0 transition-colors ${isOver ? "bg-[#7259B5]/[.06]" : ""}`}
      style={{ borderColor: "rgba(13,13,13,.05)" }}
    >
      {children}
    </div>
  );
}

function DraggablePill({ item, onEdit }: { item: AtividadeRow; onEdit: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  const pill = typePillFor(item);
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={() => onEdit(item.id)}
      title={item.nome}
      className={`block w-full cursor-grab truncate rounded px-1.5 py-1 text-left text-[9px] font-medium transition-opacity hover:opacity-75 active:cursor-grabbing ${item.feita ? "opacity-45" : ""}`}
      style={{ background: pill.bar, color: "white", opacity: isDragging ? 0 : undefined, touchAction: "none" }}
    >
      {item.nome}
    </button>
  );
}

/* ─── Gantt View ─────────────────────────────────────────────────────────── */

function GanttView({ atividades, tipoFilter, onEdit, onDatesChange }: {
  atividades: AtividadeRow[];
  tipoFilter: TipoFilter;
  onEdit: (id: string) => void;
  onDatesChange: (id: string, dates: { data_inicio: string; data_prevista: string }) => Promise<boolean>;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [hasNavigated, setHasNavigated] = useState(false);
  const [draftDates, setDraftDates] = useState<Record<string, { data_inicio: string; data_prevista: string }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (hasNavigated || atividades.length === 0) return;
    const date = nearestScheduledDate(atividades);
    if (date) setWeekStart(mondayOf(date));
  }, [atividades, hasNavigated]);

  const todayMs      = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const rangeStartMs = weekStart.getTime();
  const rangeEndMs   = rangeStartMs + GANTT_DAYS * 86400000;

  const prevWeek = () => { setHasNavigated(true); setWeekStart(w => new Date(w.getTime() - 7 * 86400000)); };
  const nextWeek = () => { setHasNavigated(true); setWeekStart(w => new Date(w.getTime() + 7 * 86400000)); };
  const goToday  = () => { setHasNavigated(true); setWeekStart(mondayOf(new Date())); };

  const days = Array.from({ length: GANTT_DAYS }, (_, i) => {
    const d = new Date(rangeStartMs + i * 86400000);
    return { d, str: d.toISOString().split("T")[0] };
  });

  const filtered = (tipoFilter === "todos" ? atividades : atividades.filter(a => a.tipo === tipoFilter))
    .filter(a => {
      const scheduled = scheduledDate(a);
      if (!scheduled) return false;
      const endMs   = new Date(`${normDate(scheduled)}T00:00:00`).getTime() + 86400000;
      const startMs = a.data_inicio
        ? new Date(normDate(a.data_inicio) + "T00:00:00").getTime()
        : endMs - 86400000;
      return endMs > rangeStartMs && startMs < rangeEndMs;
    });

  const groupMap = new Map<string, { label: string; items: AtividadeRow[] }>();
  filtered.forEach(a => {
    const key   = a.captacao?.titulo ?? "__none";
    const label = a.captacao?.titulo ?? "Sem captação";
    if (!groupMap.has(key)) groupMap.set(key, { label, items: [] });
    groupMap.get(key)!.items.push(a);
  });
  const groups = [...groupMap.entries()]
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => a.key === "__none" ? 1 : b.key === "__none" ? -1 : a.label.localeCompare(b.label));
  const todayOffset = todayMs >= rangeStartMs && todayMs < rangeEndMs
    ? ((todayMs - rangeStartMs) / 86400000) * GANTT_DAY_W + GANTT_DAY_W / 2
    : null;

  function barProps(a: AtividadeRow): { left: number; width: number } | null {
    const scheduled = scheduledDate(a);
    if (!scheduled) return null;
    const endMs = new Date(`${normDate(scheduled)}T00:00:00`).getTime();
    const startMs = a.data_inicio
      ? new Date(normDate(a.data_inicio) + "T00:00:00").getTime()
      : endMs;
    const s = Math.max(startMs, rangeStartMs);
    const e = Math.min(endMs + 86400000, rangeEndMs);
    if (s >= e) return null;
    return {
      left: ((s - rangeStartMs) / 86400000) * GANTT_DAY_W,
      width: Math.max(((e - s) / 86400000) * GANTT_DAY_W, GANTT_DAY_W),
    };
  }

  function shiftDate(date: string, days: number): string {
    const next = new Date(`${normDate(date)}T00:00:00`);
    next.setDate(next.getDate() + days);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, "0");
    const day = String(next.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>, atividade: AtividadeRow, edge: "start" | "end") {
    if (atividade.feita) return;
    event.preventDefault();
    event.stopPropagation();

    const initialEnd = normDate(atividade.data_prevista ?? atividade.data_inicio!);
    const initialStart = normDate(atividade.data_inicio ?? initialEnd);
    const originX = event.clientX;
    let latest = { data_inicio: initialStart, data_prevista: initialEnd };
    setDraggingId(atividade.id);
    setDraftDates(current => ({ ...current, [atividade.id]: latest }));

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaDays = Math.round((moveEvent.clientX - originX) / GANTT_DAY_W);
      if (edge === "start") {
        const candidate = shiftDate(initialStart, deltaDays);
        latest = { data_inicio: candidate > initialEnd ? initialEnd : candidate, data_prevista: initialEnd };
      } else {
        const candidate = shiftDate(initialEnd, deltaDays);
        latest = { data_inicio: initialStart, data_prevista: candidate < initialStart ? initialStart : candidate };
      }
      setDraftDates(current => ({ ...current, [atividade.id]: latest }));
    };

    const handleUp = async () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      const changed = latest.data_inicio !== initialStart || latest.data_prevista !== initialEnd;
      if (changed) await onDatesChange(atividade.id, latest);
      setDraftDates(current => {
        const next = { ...current };
        delete next[atividade.id];
        return next;
      });
      setDraggingId(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  return (
    <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {/* Nav */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition text-black/40">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[12px] font-bold text-black/70 min-w-[200px] text-center">
            {fmtDate(days[0].str)} — {fmtDate(days[GANTT_DAYS - 1].str)}
          </span>
          <button onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition text-black/40">
            <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={goToday} className="text-[11px] font-semibold text-black/40 hover:text-black/70 px-2.5 py-1.5 rounded hover:bg-black/5 transition">
          Hoje
        </button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: GANTT_LEFT_W + GANTT_DAY_W * GANTT_DAYS, minWidth: "100%" }}>

          {/* Day header */}
          <div className="flex border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div style={{ width: GANTT_LEFT_W, flexShrink: 0 }}
              className="px-4 py-2 text-[10px] font-bold text-black/25 tracking-wider uppercase">
              Atividade
            </div>
            {days.map(({ d, str }) => {
              const isToday   = str === new Date().toISOString().split("T")[0];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={str} style={{ width: GANTT_DAY_W, flexShrink: 0, borderLeft: "1px solid rgba(13,13,13,.05)" }}
                  className={`py-2 text-center ${isToday ? "bg-[#7259B514]" : isWeekend ? "bg-black/[.015]" : ""}`}>
                  <div className={`text-[10px] font-bold ${isToday ? "text-[#7259B5]" : "text-black/35"}`}>
                    {d.getDate()}
                  </div>
                  <div className={`text-[9px] uppercase tracking-wide ${isToday ? "text-[#7259B5]" : "text-black/20"}`}>
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {groups.length === 0 ? (
            <div className="py-16 text-center">
              <BarChart2 size={24} className="text-black/15 mx-auto mb-2" />
              <p className="text-xs font-semibold text-black/25">Nenhuma atividade com data neste período</p>
            </div>
          ) : groups.map(({ key, label, items }) => (
            <div key={key}>
              {/* Group header */}
              <div className="flex items-center border-b" style={{ borderColor: "rgba(13,13,13,.06)", background: "rgba(13,13,13,.022)" }}>
                <div style={{ width: GANTT_LEFT_W, flexShrink: 0 }}
                  className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/35 truncate">
                  {label}
                </div>
                <div style={{ flex: 1 }} />
              </div>

              {items.map(a => {
                const pill   = typePillFor(a);
                const typeConfig = typeConfigFor(a);
                const TypeIcon = typeConfig.Icon;
                const dates  = draftDates[a.id];
                const effectiveActivity = dates ? { ...a, ...dates } : a;
                const bar    = barProps(effectiveActivity);
                const entity = entityLabel(a);

                return (
                  <div key={a.id} className="flex items-center border-b transition"
                    style={{ borderColor: "rgba(13,13,13,.045)", height: 36 }}>

                    <button type="button" onClick={() => onEdit(a.id)}
                      aria-label={`Editar atividade ${a.nome}`}
                      style={{ width: GANTT_LEFT_W, flexShrink: 0 }}
                      className="h-full px-4 flex items-center gap-2 min-w-0 text-left cursor-pointer hover:bg-black/[.025] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7259B5]/25">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: pill.bar }}>
                        <TypeIcon size={12} strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[12.5px] font-semibold truncate leading-none ${a.feita ? "line-through text-black/25" : "text-black/80"}`}>
                          {a.nome}
                        </p>
                        {entity !== "—" && (
                          <p className="text-[9.5px] text-black/30 truncate mt-0.5 leading-none">{entity}</p>
                        )}
                      </div>
                    </button>

                    {/* Timeline */}
                    <div style={{ position: "relative", flex: 1, height: "100%" }}>
                      {/* Weekend shading */}
                      {days.map(({ d, str }, i) => {
                        if (d.getDay() !== 0 && d.getDay() !== 6) return null;
                        return (
                          <div key={str} style={{
                            position: "absolute", top: 0, bottom: 0,
                            left: i * GANTT_DAY_W, width: GANTT_DAY_W,
                            background: "rgba(13,13,13,.015)",
                          }} />
                        );
                      })}
                      {/* Column separators */}
                      {days.map((_, i) => (
                        <div key={i} style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: i * GANTT_DAY_W, width: 1,
                          background: "rgba(13,13,13,.04)",
                        }} />
                      ))}
                      {/* Today line */}
                      {todayOffset !== null && (
                        <div style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: todayOffset, width: 1.5,
                          background: "#7259B5", opacity: 0.35,
                        }} />
                      )}
                      {/* Editable date range */}
                      {bar && (
                        <div className="group" style={{
                          position: "absolute",
                          left: bar.left + 2, width: Math.max(bar.width - 4, 4),
                          top: "50%", transform: "translateY(-50%)",
                          height: 16, borderRadius: 2,
                          background: a.feita ? "rgba(13,13,13,.12)" : pill.bar,
                          opacity: a.feita ? 0.5 : draggingId === a.id ? 0.85 : 1,
                          boxShadow: draggingId === a.id ? "0 0 0 2px rgba(114,89,181,.18)" : "none",
                        }} onClick={event => event.stopPropagation()}>
                          {!a.feita && (
                            <>
                              <button
                                type="button"
                                aria-label={`Alterar início de ${a.nome}`}
                                onPointerDown={event => startResize(event, effectiveActivity, "start")}
                                className="absolute -left-1 top-0 h-full w-3 cursor-col-resize rounded border border-black/15 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
                                style={{ touchAction: "none" }}
                              />
                              <button
                                type="button"
                                aria-label={`Alterar fim de ${a.nome}`}
                                onPointerDown={event => startResize(event, effectiveActivity, "end")}
                                className="absolute -right-1 top-0 h-full w-3 cursor-col-resize rounded border border-black/15 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
                                style={{ touchAction: "none" }}
                              />
                              {draggingId === a.id && dates && (
                                <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-black/[.08] bg-white px-2 py-1 text-[9px] font-medium text-black/60 shadow-sm">
                                  {fmtDate(dates.data_inicio)} — {fmtDate(dates.data_prevista)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const SELECT_FIELDS = `
  id, nome, tipo, prioridade, data_inicio, data_prevista, data_realizada, hora_inicio, hora_fim, resultado, feita, nota, responsavel_id, captacao_id,
  responsavel:profiles!responsavel_id(id, full_name, avatar_url),
  tipo_custom:atividade_tipos!tipo_custom_id(nome, icone, cor),
  empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_crm_id,
  projeto:projetos_crm!projeto_id(nome),
  captador:captadores!captador_id(nome, agencia),
  proponente:proponentes!proponente_id(nome),
  captacao:captacoes!captacao_id(titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)),
  contato:contatos!contato_id(nome, email, telefone)
`;

const FOLLOWUP_SELECT_FIELDS = `
  id, titulo, motivo, canal, previsto_para, concluido_em, resultado, status,
  responsavel_id, captacao_id, empresa_crm_id, conta_patrocinio_id,
  responsavel:profiles!responsavel_id(id, full_name, avatar_url),
  empresa_crm:empresas_crm!empresa_crm_id(nome),
  captacao:captacoes!captacao_id(titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)),
  contato:contatos!contato_id(nome)
`;

export default function AtividadesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [atividades,    setAtividades]       = useState<AtividadeRow[]>([]);
  const [allAtividades, setAllAtividades]    = useState<AtividadeRow[]>([]);
  const [loading,       setLoading]          = useState(true);
  const [loadingAll,    setLoadingAll]       = useState(false);
  const [tab,           setTab]              = useState<Tab>("pendentes");
  const [tipoFilter,    setTipoFilter]       = useState<TipoFilter>("todos");
  // A primeira renderização precisa ser idêntica no servidor e no navegador.
  // A preferência local é restaurada depois da hidratação.
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [showNovaAtividade, setShowNovaAtividade] = useState(false);
  const [novaPrefillDate,   setNovaPrefillDate]   = useState<string | undefined>(undefined);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [completingActivity, setCompletingActivity] = useState<AtividadeRow | null>(null);

  /* ── Lista fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = (supabase as any).from("atividades").select(SELECT_FIELDS);
    const followupQuery = (supabase as any).from("crm_followups").select(FOLLOWUP_SELECT_FIELDS);
    const [activityResult, followupResult] = await Promise.all([
      tab === "pendentes"
        ? q.eq("feita", false).order("data_prevista", { ascending: true, nullsFirst: false })
        : q.eq("feita", true).order("data_realizada", { ascending: false, nullsFirst: false }).limit(100),
      tab === "pendentes"
        ? followupQuery.eq("status", "pendente").order("previsto_para", { ascending: true })
        : followupQuery.in("status", ["concluido", "cancelado"]).order("concluido_em", { ascending: false, nullsFirst: false }).limit(100),
    ]);
    if (!activityResult.error && !followupResult.error) {
      setAtividades([...(activityResult.data as AtividadeRow[] ?? []), ...followupsToActivities(followupResult.data ?? [])]
        .sort((a, b) => String(scheduledDate(a) ?? "9999").localeCompare(String(scheduledDate(b) ?? "9999"))));
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ── Calendar / Gantt fetch ── */
  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    const [activityResult, followupResult] = await Promise.all([
      (supabase as any).from("atividades").select(SELECT_FIELDS).order("data_prevista", { ascending: true, nullsFirst: false }),
      (supabase as any).from("crm_followups").select(FOLLOWUP_SELECT_FIELDS).order("previsto_para", { ascending: true }),
    ]);
    if (!activityResult.error && !followupResult.error) {
      setAllAtividades([...(activityResult.data as AtividadeRow[] ?? []), ...followupsToActivities(followupResult.data ?? [])]);
    }
    setLoadingAll(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (viewMode !== "lista") fetchAll(); }, [viewMode, fetchAll]);
  useEffect(() => {
    const savedView = localStorage.getItem("jards-atividades-view");
    if (savedView === "calendario" || savedView === "gantt" || savedView === "carga" || savedView === "lista") {
      setViewMode(savedView);
    }
  }, []);

  async function toggleFeita(id: string, current: boolean) {
    if (savingActivityId) return;
    const agendaItem = [...atividades, ...allAtividades].find(item => item.id === id);
    if (agendaItem?.source_kind === "followup") {
      if (agendaItem.source_link) router.push(agendaItem.source_link);
      return;
    }
    if (!current) {
      const atividade = agendaItem;
      if (atividade) { setCompletingActivity(atividade); return; }
    }
    const now = new Date().toISOString().split("T")[0];
    setSavingActivityId(id);
    setToggleError(null);

    // O schema manual do cliente ainda não infere corretamente RPCs recém-adicionadas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("fn_set_atividade_concluida", {
      p_atividade_id: id,
      p_feita: !current,
      p_data_realizada: !current ? now : null,
    });
    const persisted = data as { id: string; feita: boolean; data_realizada: string | null } | null;

    if (error || !persisted || persisted.feita !== !current) {
      const diagnostic = error ? [error.code, error.message, error.details].filter(Boolean).join(" · ") : "Resposta inválida do servidor";
      console.warn(`Não foi possível atualizar a atividade: ${diagnostic}`);
      setToggleError(`A atividade não foi atualizada. ${diagnostic}`);
      setSavingActivityId(null);
      return;
    }

    // Só remove da lista atual depois que o Supabase confirma a persistência.
    setAtividades(prev => prev.filter(a => a.id !== id));
    setAllAtividades(prev => prev.map(a => a.id === id ? { ...a, feita: persisted.feita, data_realizada: persisted.data_realizada } : a));
    setSavingActivityId(null);
  }

  async function updateActivityDates(id: string, dates: { data_inicio: string; data_prevista: string }): Promise<boolean> {
    setToggleError(null);
    const agendaItem = allAtividades.find(item => item.id === id);
    if (agendaItem?.source_kind === "followup" && agendaItem.source_id) {
      const previous = allAtividades;
      setAllAtividades(items => items.map(item => item.id === id ? { ...item, data_prevista: dates.data_prevista } : item));
      const { error } = await (supabase as any).from("crm_followups").update({
        previsto_para: new Date(`${dates.data_prevista}T12:00:00`).toISOString(),
      }).eq("id", agendaItem.source_id);
      if (error) {
        setAllAtividades(previous);
        setToggleError(`O follow-up não foi reagendado. ${error.message}`);
        return false;
      }
      return true;
    }
    const { data, error } = await (supabase as any)
      .from("atividades")
      .update(dates)
      .eq("id", id)
      .select("id, data_inicio, data_prevista")
      .single();

    if (error || !data) {
      const diagnostic = error ? [error.code, error.message, error.details].filter(Boolean).join(" · ") : "Resposta inválida do servidor";
      console.warn(`Não foi possível atualizar as datas da atividade: ${diagnostic}`);
      setToggleError(`As datas da atividade não foram atualizadas. ${diagnostic}`);
      return false;
    }

    setAllAtividades(current => current.map(atividade => atividade.id === id
      ? { ...atividade, data_inicio: data.data_inicio, data_prevista: data.data_prevista }
      : atividade));
    setAtividades(current => current.map(atividade => atividade.id === id
      ? { ...atividade, data_inicio: data.data_inicio, data_prevista: data.data_prevista }
      : atividade));
    return true;
  }

  async function updateActivityResponsible(id: string, responsavelId: string | null, responsavelName: string | null, avatarUrl: string | null): Promise<boolean> {
    setToggleError(null);
    const previous = allAtividades;
    const agendaItem = previous.find(item => item.id === id);
    if (!agendaItem) return false;

    const nextResponsavel = responsavelId ? { id: responsavelId, full_name: responsavelName, avatar_url: avatarUrl } : null;
    setAllAtividades(current => current.map(item => item.id === id ? { ...item, responsavel_id: responsavelId, responsavel: nextResponsavel } : item));
    setAtividades(current => current.map(item => item.id === id ? { ...item, responsavel_id: responsavelId, responsavel: nextResponsavel } : item));

    const table = agendaItem.source_kind === "followup" ? "crm_followups" : "atividades";
    const targetId = agendaItem.source_kind === "followup" ? agendaItem.source_id : id;
    if (!targetId) {
      setAllAtividades(previous); setAtividades(previous);
      setToggleError("Não foi possível identificar o registro original.");
      return false;
    }

    const { error } = await (supabase as any).from(table).update({ responsavel_id: responsavelId }).eq("id", targetId);
    if (error) {
      setAllAtividades(previous); setAtividades(previous);
      setToggleError(`Não foi possível reatribuir a atividade. ${error.message}`);
      return false;
    }
    return true;
  }

  function openAgendaItem(id: string) {
    const item = [...atividades, ...allAtividades].find(candidate => candidate.id === id);
    if (item?.source_kind === "followup") {
      if (item.source_link) router.push(item.source_link);
      return;
    }
    setEditingId(id);
  }

  function changeView(v: ViewMode) {
    setViewMode(v);
    localStorage.setItem("jards-atividades-view", v);
  }

  const filtered = tipoFilter === "todos" ? atividades : atividades.filter(a => a.tipo === tipoFilter);
  const atrasadas = atividades.filter(a => !a.feita && getGroup(a.data_prevista) === "atrasadas").length;
  const hoje      = atividades.filter(a => !a.feita && getGroup(a.data_prevista) === "hoje").length;

  const TIPOS_FILTER: { value: TipoFilter; label: string }[] = [
    { value: "todos",    label: "Todos"    },
    { value: "email",    label: "E-mail"   },
    { value: "telefone", label: "Telefone" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "reuniao",  label: "Reunião"  },
    { value: "evento",   label: "Evento"   },
    { value: "tarefa",   label: "Tarefa"   },
    { value: "outro",    label: "Outro"    },
  ];

  return (
    <div className="px-8 py-8">
      {showNovaAtividade && (
        <NovaAtividadeModal
          onClose={() => { setShowNovaAtividade(false); setNovaPrefillDate(undefined); }}
          onSaved={() => { fetchData(); if (viewMode !== "lista") fetchAll(); }}
          prefill={novaPrefillDate ? { date: novaPrefillDate } : undefined}
        />
      )}
      {editingId && (
        <EditarAtividadeModal
          atividadeId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => { fetchData(); if (viewMode !== "lista") fetchAll(); }}
          onDeleted={() => { fetchData(); if (viewMode !== "lista") fetchAll(); }}
        />
      )}
      {completingActivity && (
        <ConcluirAtividadeModal
          atividade={completingActivity}
          onClose={() => setCompletingActivity(null)}
          onCompleted={(persisted) => {
            setAtividades(previous => previous.filter(item => item.id !== completingActivity.id));
            setAllAtividades(previous => previous.map(item => item.id === completingActivity.id ? { ...item, ...persisted } : item));
            setCompletingActivity(null);
            void fetchData();
            if (viewMode !== "lista") void fetchAll();
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <h1 className="font-bold text-[#0D0D0D] text-[28px]">Atividades</h1>
        <button
          onClick={() => setShowNovaAtividade(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium bg-white border border-black/12 text-black rounded hover:bg-black/5 transition"
        >
          <Plus size={13} /> Nova atividade
        </button>
      </div>

      {/* Stats (only lista + pendentes) */}
      {viewMode === "lista" && !loading && tab === "pendentes" && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border text-sm" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <span className="font-bold text-[15px]">{filtered.length}</span>
            <span className="text-black/40 text-xs">pendentes</span>
          </div>
          {atrasadas > 0 && (
            <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <AlertCircle size={13} className="text-[#D94E4E] flex-shrink-0" />
              <span className="font-bold text-[#D94E4E] text-[15px]">{atrasadas}</span>
              <span className="text-black/40 text-xs">atrasadas</span>
            </div>
          )}
          {hoje > 0 && (
            <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <Clock size={13} className="text-[#B07A14] flex-shrink-0" />
              <span className="font-bold text-[#B07A14] text-[15px]">{hoje}</span>
              <span className="text-black/40 text-xs">para hoje</span>
            </div>
          )}
        </div>
      )}

      {/* Botões de controle: visualização, estado e tipo das atividades */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Botões de controle de visualização */}
        <SegmentedControl
          value={viewMode}
          onChange={changeView}
          ariaLabel="Visualização das atividades"
          options={[
            { value: "lista", label: "Lista", icon: List },
            { value: "calendario", label: "Calendário", icon: CalendarDays },
            { value: "gantt", label: "Gantt", icon: BarChart2 },
            { value: "carga", label: "Carga da equipe", icon: Gauge },
          ]}
        />

        {/* Botões de controle de estado: A fazer / Histórico */}
        {viewMode === "lista" && (
          <SegmentedControl
            value={tab}
            onChange={(value) => { setTab(value); setTipoFilter("todos"); }}
            ariaLabel="Estado das atividades"
            options={[
              { value: "pendentes", label: "A fazer" },
              { value: "historico", label: "Histórico" },
            ]}
          />
        )}

        {/* Botões de controle de tipo */}
        <SegmentedControl
          value={tipoFilter}
          onChange={setTipoFilter}
          ariaLabel="Filtrar atividades por tipo"
          options={TIPOS_FILTER}
        />

        {tipoFilter !== "todos" && (
          <FilterButton onClick={() => setTipoFilter("todos")}>
            <X size={12} /> Limpar
          </FilterButton>
        )}
      </div>

      {toggleError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded border border-[#D94E4E]/25 bg-white px-4 py-3 text-[11px] text-[#D94E4E]">
          <span>{toggleError}</span>
          <button type="button" onClick={() => setToggleError(null)} className="font-medium hover:opacity-70">Fechar</button>
        </div>
      )}

      {/* Etiqueta estrutural: Lista CRM — atividades em lista, calendário ou Gantt */}

      {viewMode === "calendario" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando...</p>
            </div>
          : <CalendarioView atividades={allAtividades} tipoFilter={tipoFilter} onEdit={openAgendaItem} onNew={(d) => { setNovaPrefillDate(d); setShowNovaAtividade(true); }} />
      )}

      {viewMode === "gantt" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando...</p>
            </div>
          : <GanttView
              atividades={allAtividades}
              tipoFilter={tipoFilter}
              onEdit={openAgendaItem}
              onDatesChange={updateActivityDates}
            />
      )}

      {viewMode === "carga" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando...</p>
            </div>
          : <CargaEquipeView atividades={allAtividades} tipoFilter={tipoFilter} onEdit={openAgendaItem} onReassign={updateActivityResponsible} />
      )}

      {viewMode === "lista" && (
        <AtividadesTable atividades={filtered} loading={loading} tab={tab}
          savingActivityId={savingActivityId} onToggle={toggleFeita} onEdit={openAgendaItem} />
      )}
    </div>
  );
}

/* ─── Etiqueta estrutural: Tabela CRM — lista operacional de atividades ─── */

type ActivitySortKey = "nome" | "prazo" | "prioridade" | "responsavel" | "resultado";

function AtividadesTable({ atividades, loading, tab, savingActivityId, onToggle, onEdit }: {
  atividades: AtividadeRow[]; loading: boolean; tab: Tab; savingActivityId: string | null;
  onToggle: (id: string, current: boolean) => Promise<void>; onEdit: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<ActivitySortKey>("prazo");
  const [sortAsc, setSortAsc] = useState(true);
  const priorityOrder: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const sorted = [...atividades].sort((a, b) => {
    const pair: Record<ActivitySortKey, [string | number, string | number]> = {
      nome: [a.nome, b.nome], prazo: [a.data_prevista ?? "9999-12-31", b.data_prevista ?? "9999-12-31"],
      prioridade: [priorityOrder[a.prioridade ?? ""] ?? 9, priorityOrder[b.prioridade ?? ""] ?? 9],
      responsavel: [a.responsavel?.full_name ?? "", b.responsavel?.full_name ?? ""], resultado: [a.resultado ?? "", b.resultado ?? ""],
    };
    const [left, right] = pair[sortKey];
    const value = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR");
    return sortAsc ? value : -value;
  });
  const changeSort = (key: ActivitySortKey) => { if (key === sortKey) setSortAsc(value => !value); else { setSortKey(key); setSortAsc(true); } };
  const duration = (a: AtividadeRow) => {
    if (a.hora_inicio && a.hora_fim) {
      const [sh, sm] = a.hora_inicio.split(":").map(Number); const [eh, em] = a.hora_fim.split(":").map(Number);
      const minutes = Math.max(0, eh * 60 + em - sh * 60 - sm);
      if (minutes > 0) return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;
    }
    if (a.data_inicio) {
      const fim = a.data_prevista ?? a.data_realizada;
      if (fim) {
        const inicio = new Date(normDate(a.data_inicio) + "T00:00:00");
        const fimDate = new Date(normDate(fim) + "T00:00:00");
        const dias = Math.max(1, Math.round((fimDate.getTime() - inicio.getTime()) / 86400000) + 1);
        return dias === 1 ? "1 dia" : `${dias} dias`;
      }
    }
    return "—";
  };
  const due = (a: AtividadeRow) => {
    if (a.feita) return { color: "rgba(13,13,13,.35)", label: fmtDate(a.data_realizada) };
    if (!a.data_prevista) return { color: "rgba(13,13,13,.25)", label: "Sem data" };
    const group = getGroup(a.data_prevista);
    return { color: group === "atrasadas" ? "#D94E4E" : group === "hoje" ? "#B07A14" : "rgba(13,13,13,.50)", label: fmtDate(a.data_prevista) };
  };
  const Header = ({ label, column }: { label: string; column?: ActivitySortKey }) => <button type="button" disabled={!column} onClick={() => column && changeSort(column)} className="flex items-center gap-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-[.08em] text-black/35 disabled:cursor-default">{label}{column && <ArrowUpDown size={10} className={sortKey === column ? "text-[#7259B5]" : "text-black/20"} />}</button>;

  return <div className="-mr-8 rounded rounded-r-none border border-r-0 bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}><ManagedTable storageKey="atividades" definitions={ATIVIDADES_COLUMNS} className="w-full border-collapse text-sm">
    <thead className="sticky top-0 z-20 bg-[#F9F9F8]"><tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <th className="bg-[#F9F9F8] px-4 py-3 text-left"><Header label="Concluída" /></th>
      <th className="bg-[#F9F9F8] px-4 py-3 text-left"><Header label="Atividade" column="nome" /></th>
      <th className="w-[190px] px-4 py-3 text-left"><Header label="Negociação" /></th><th className="w-[220px] px-4 py-3 text-left"><Header label="Empresa / contato" /></th>
      <th className="w-[120px] px-4 py-3 text-left"><Header label="Prazo" column="prazo" /></th><th className="w-[105px] px-4 py-3 text-left"><Header label="Duração" /></th>
      <th className="w-[110px] px-4 py-3 text-left"><Header label="Prioridade" column="prioridade" /></th><th className="w-[160px] px-4 py-3 text-left"><Header label="Responsável" column="responsavel" /></th>
      <th className="w-[150px] px-4 py-3 text-left"><Header label="Resultado" column="resultado" /></th><th className="w-[170px] px-4 py-3 text-left"><Header label="Projeto" /></th>
      <th className="w-[220px] px-4 py-3 text-left"><Header label="Observação" /></th>
    </tr></thead>
    <tbody>{loading ? Array.from({ length: 7 }).map((_, i) => <tr key={i} className="border-b" style={{ borderColor: "rgba(13,13,13,.045)" }}><td colSpan={12} className="px-4 py-4"><div className="h-3.5 w-2/3 animate-pulse rounded bg-black/[.06]" /></td></tr>) : sorted.length === 0 ? <tr><td colSpan={12} className="px-5 py-20 text-center"><CheckCheck size={28} className="mx-auto mb-2 text-black/15" /><p className="text-sm font-medium text-black/30">{tab === "pendentes" ? "Nenhuma atividade pendente" : "Nenhuma atividade concluída"}</p></td></tr> : sorted.map(a => {
      const tc = typeConfigFor(a); const Icon = tc.Icon; const deadline = due(a);
      return <tr key={a.id} className="group border-b last:border-b-0 hover:bg-black/[.018] cursor-pointer" style={{ borderColor: "rgba(13,13,13,.045)" }} onClick={() => onEdit(a.id)}>
        <td className="cursor-default bg-white px-4 py-3 text-left group-hover:bg-[#FBFBFA]" onClick={e => e.stopPropagation()}><button type="button" onClick={() => void onToggle(a.id, a.feita)} disabled={savingActivityId === a.id} className="inline-flex cursor-pointer text-black/20 transition hover:text-black/55 disabled:opacity-40 disabled:cursor-not-allowed">{savingActivityId === a.id ? <Clock size={17} className="animate-pulse text-[#7259B5]" /> : a.feita ? <CheckCircle2 size={17} className="text-[#2E8932]" /> : <Circle size={17} />}</button></td>
        <td className="bg-white px-4 py-3 group-hover:bg-[#FBFBFA]"><div className="flex w-full items-center gap-2.5 text-left"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded" style={{ color: tc.color }}><Icon size={13} /></span><span className="min-w-0"><span className={`block truncate text-[12.5px] font-semibold ${a.feita ? "text-black/30 line-through" : "text-black/75"}`}>{a.nome}</span><span className="mt-0.5 block text-[10px] text-black/30">{tc.label}</span></span></div></td>
        <td className="px-4 py-3"><span className="block max-w-[170px] truncate text-[11px] font-medium text-black/55">{captacaoLabel(a)}</span></td>
        <td className="px-4 py-3"><div className="max-w-[200px]"><span className="block truncate text-[11px] font-medium text-black/60">{a.contato?.nome ?? a.empresa_crm?.nome ?? "—"}</span>{a.contato?.email && <span className="mt-0.5 block truncate text-[9.5px] text-black/30">{a.contato.email}</span>}{a.contato?.telefone && <span className="block text-[9.5px] text-black/25">{a.contato.telefone}</span>}</div></td>
        <td className="px-4 py-3"><span className="whitespace-nowrap text-[11px] font-medium tabular-nums" style={{ color: deadline.color }}>{deadline.label}</span>{a.hora_inicio && <span className="mt-0.5 block text-[9.5px] text-black/25">{a.hora_inicio.slice(0,5)}{a.hora_fim ? ` — ${a.hora_fim.slice(0,5)}` : ""}</span>}</td>
        <td className="px-4 py-3 text-[11px] tabular-nums text-black/40">{duration(a)}</td><td className="px-4 py-3"><PrioBadge prio={a.prioridade} size="sm" /></td>
        <td className="px-4 py-3"><span className={`text-[11px] font-medium ${a.responsavel?.full_name ? "text-black/55" : "text-[#B07A14]"}`}>{a.responsavel?.full_name ?? "Sem responsável"}</span></td>
        <td className="px-4 py-3"><span className="block max-w-[135px] truncate text-[11px] text-black/45">{a.resultado || "—"}</span></td><td className="px-4 py-3"><span className="block max-w-[155px] truncate text-[11px] text-black/45">{a.projeto?.nome ?? a.captacao?.projeto?.nome ?? "—"}</span></td>
        <td className="px-4 py-3"><span className="block max-w-[205px] truncate text-[10.5px] text-black/35" title={a.nota ?? undefined}>{a.nota || "—"}</span></td>
      </tr>;
    })}</tbody>
  </ManagedTable></div>;
}
