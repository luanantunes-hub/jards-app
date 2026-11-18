"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Mail, Phone, Users, Calendar, MoreHorizontal, CheckSquare,
  CheckCircle2, Circle, AlertCircle, AlertTriangle, Clock, X, CheckCheck, UserX,
  ChevronLeft, ChevronRight, CalendarDays, List, BarChart2, Gauge, Settings2, ArrowUpDown, Pencil,
} from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { NovaAtividadeModal } from "@/components/modals/NovaAtividadeModal";
import { EditarAtividadeModal } from "@/components/modals/EditarAtividadeModal";
import { ConcluirAtividadeModal } from "@/components/modals/ConcluirAtividadeModal";
import { GerenciarFollowupModal } from "@/components/modals/GerenciarFollowupModal";
import PrioBadge from "@/components/ui/PrioBadge";
import type { TipoAtividade, Prioridade } from "@/lib/supabase/types";
import { FilterButton, SegmentedControl } from "@/components/ui/FilterControls";
import { PrimaryListAction } from "@/components/list/ListPagePrimitives";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useFiltroResponsavel } from "@/hooks/useFiltroResponsavel";
import { FiltroResponsavel } from "@/components/list/FiltroResponsavel";
import { ManagedTable, type ColumnDefinition } from "@/components/ui/ColumnManager";
import { followupSourceLink } from "@/lib/activities/followupSourceLink";
import { escalaUi } from "@/lib/escala-ui";
import { MINUTOS_NO_DIA, diasEntreIso, horaDe, intervaloDoItem, isoLocal, metricasDoMes, novoIntervalo, posicionarNoDia, somarDiasIso, type ItemDoMes, type ModoArrasto, type Posicionado } from "@/lib/activities/agenda-grade";

const ATIVIDADES_COLUMNS = [
  { id: "concluida", label: "Concluída", width: "6.5625rem" }, { id: "atividade", label: "Atividade", width: "17.5rem", grow: true, hideable: false }, { id: "negociacao", label: "Negociação", width: "11.875rem" }, { id: "empresa", label: "Empresa / contato", width: "13.75rem" }, { id: "prazo", label: "Prazo", width: "7.5rem" }, { id: "duracao", label: "Duração", width: "6.5625rem" }, { id: "prioridade", label: "Prioridade", width: "7.1875rem" }, { id: "responsavel", label: "Responsável", width: "10.625rem" }, { id: "resultado", label: "Resultado", width: "9.375rem" }, { id: "projeto", label: "Projeto", width: "11.25rem" }, { id: "observacao", label: "Observação", width: "14.375rem" },
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
  proponente_id?: string | null;
  conta_patrocinio_id?: string | null;
  captacao: {
    titulo: string | null;
    projeto: { nome: string } | null;
    empresa_crm: { nome: string } | null;
    empresa: { nome: string } | null;
  } | null;
  contato: { nome: string | null; email: string | null; telefone: string | null } | null;
  responsavel_id: string | null;
  responsavel: { id: string; full_name: string | null; avatar_url: string | null } | null;
  sync_origin?: string | null;
  source_kind?: "atividade" | "followup" | "workspace";
  source_id?: string;
  source_link?: string;
  source_status?: "pendente" | "concluido" | "cancelado";
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
// A geometria do Gantt é calculada em px na base de 16px e desenhada em rem,
// para crescer junto com a fonte base em telas grandes.
const remDe = (px: number) => `${px / 16}rem`;

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
    proponente: row.proponente,
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
    source_status: row.status,
    source_link: followupSourceLink(row),
  }));
}

function workspaceRequestsToActivities(rows: any[]): AtividadeRow[] {
  return rows.map(row => ({
    id: `workspace:${row.id}`,
    nome: row.descricao,
    tipo: "tarefa" as TipoAtividade,
    prioridade: null,
    data_inicio: null,
    data_prevista: row.prazo,
    data_realizada: row.resolvido_em,
    hora_inicio: null,
    hora_fim: null,
    resultado: null,
    feita: row.status === "resolvida",
    nota: null,
    tipo_custom: { nome: "Pedido do captador", icone: "tarefa" as TipoAtividade, cor: "#5F4AA8" },
    empresa_crm: row.atribuicao?.empresa_crm ?? null,
    empresa_crm_id: row.atribuicao?.empresa_crm_id ?? null,
    captacao_id: null,
    projeto: null,
    captador: null,
    proponente: null,
    captacao: null,
    contato: null,
    responsavel_id: null,
    responsavel: null,
    source_kind: "workspace" as const,
    source_id: row.id,
    source_link: row.atribuicao?.captador_user_id
      ? `/captadores/${row.atribuicao.captador_user_id}?workspace=${row.atribuicao_id}`
      : "/captadores",
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

// Semana e dia mostram a grade de horários; o mês vira um painel com os números do período.
const HORA_REM = 3; // altura de uma hora na grade
const DIAS_DA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Follow-ups e pedidos do captador têm só o dia: ficam na faixa "Sem horário".
function intervaloNaGrade(a: AtividadeRow) {
  if (a.source_kind === "followup" || a.source_kind === "workspace") return null;
  return intervaloDoItem(a.hora_inicio, a.hora_fim);
}

function corComAlfa(cor: string, alfa: string): string {
  return /^#[0-9a-f]{6}$/i.test(cor) ? cor + alfa : "rgba(13,13,13,.18)";
}

function formatarDuracao(minutos: number): string {
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60);
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return agora;
}

function CalendarioView({ atividades, tipoFilter, onEdit, onNew, onReagendar }: { atividades: AtividadeRow[]; tipoFilter: TipoFilter; onEdit: (id: string) => void; onNew: (dateStr: string, hora?: string) => void; onReagendar: (id: string, mudanca: Reagendamento) => void }) {
  const [scale, setScale] = useState<CalendarScale>("semana");
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const agora = useAgora();
  const hoje = isoLocal(agora);

  const mudarEscala = (escala: CalendarScale) => setScale(escala);

  const filtered = useMemo(() => tipoFilter === "todos" ? atividades : atividades.filter(a => a.tipo === tipoFilter), [atividades, tipoFilter]);
  const byDate = useMemo(() => {
    const mapa = new Map<string, AtividadeRow[]>();
    filtered.forEach(a => {
      const date = scheduledDate(a);
      if (!date) return;
      const key = normDate(date);
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key)!.push(a);
    });
    return mapa;
  }, [filtered]);

  const year = cursor.getFullYear();
  const monthIdx = cursor.getMonth();
  const weekStart = mondayOf(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  const move = (direction: -1 | 1) => {
    setCursor(current => {
      const next = new Date(current);
      if (scale === "dia") next.setDate(next.getDate() + direction);
      if (scale === "semana") next.setDate(next.getDate() + 7 * direction);
      if (scale === "mes") { next.setDate(1); next.setMonth(next.getMonth() + direction); }
      return next;
    });
  };
  const goToday = () => { const today = new Date(); today.setHours(0, 0, 0, 0); setCursor(today); };
  const abrirDia = (date: Date) => { setCursor(date); mudarEscala("dia"); };
  const abrirSemana = (date: Date) => { setCursor(date); mudarEscala("semana"); };

  const mesmoMes = weekDays[0].getMonth() === weekDays[6].getMonth();
  const navLabel = scale === "dia"
    ? cursor.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : scale === "semana"
      ? `${weekDays[0].getDate()}${mesmoMes ? "" : ` de ${weekDays[0].toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`} – ${weekDays[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(".", "")}`
      : `${MONTH_NAMES[monthIdx]} ${year}`;
  const noPeriodoAtual = scale === "dia" ? isoLocal(cursor) === hoje
    : scale === "semana" ? weekDays.some(d => isoLocal(d) === hoje)
    : year === agora.getFullYear() && monthIdx === agora.getMonth();

  const toolbar = (
    <div className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${scale === "mes" ? "rounded border bg-white" : "border-b"}`} style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => move(-1)} aria-label="Período anterior" className="flex h-9 w-9 items-center justify-center rounded text-black/40 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25">
          <ChevronLeft size={15} />
        </button>
        <button type="button" onClick={() => move(1)} aria-label="Próximo período" className="flex h-9 w-9 items-center justify-center rounded text-black/40 transition hover:bg-black/[.04] hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25">
          <ChevronRight size={15} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold tracking-[-.01em] text-[#282525] first-letter:uppercase sm:flex-none">{navLabel}</h2>
        <button type="button" onClick={goToday} disabled={noPeriodoAtual} className="ml-1 h-8 flex-shrink-0 rounded border border-black/[.09] bg-white px-3 text-[0.6875rem] font-medium text-black/60 transition hover:bg-black/[.04] disabled:cursor-default disabled:text-black/30 disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25">
          Hoje
        </button>
      </div>
      <SegmentedControl
        value={scale}
        onChange={mudarEscala}
        ariaLabel="Escala do calendário"
        options={[
          { value: "dia", label: "Dia" },
          { value: "semana", label: "Semana" },
          { value: "mes", label: "Mês" },
        ]}
      />
    </div>
  );

  if (scale === "mes") {
    return (
      <div className="isolate space-y-4">
        {toolbar}
        <PainelDoMes itens={filtered} ano={year} mes={monthIdx} hoje={hoje} onAbrirDia={abrirDia} onAbrirSemana={abrirSemana} onEdit={onEdit} onNew={date => onNew(date)} />
      </div>
    );
  }

  return (
    <div className="isolate overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {toolbar}
      <GradeDeHorarios
        dias={scale === "dia" ? [cursor] : weekDays}
        byDate={byDate}
        hoje={hoje}
        agora={agora}
        detalhado={scale === "dia"}
        onEdit={onEdit}
        onNew={onNew}
        onAbrirDia={abrirDia}
        onReagendar={onReagendar}
      />
    </div>
  );
}

// inicio/fim nulos: a atividade fica sem hora (só o dia muda)
type Reagendamento = { data: string; inicio: number | null; fim: number | null };
type Arrasto = {
  id: string;
  modo: ModoArrasto;
  original: { inicio: number; fim: number };
  diaOrigem: string;
  pegada: number;
  x: number;
  y: number;
  ativo: boolean;
  semHoraOrigem: boolean;
  previa: Reagendamento;
};

// Atividade que veio do Google Agenda ou do Outlook: mudar o horário dela muda o evento lá também.
function veioDeFora(a: AtividadeRow): boolean {
  return a.sync_origin === "google" || a.sync_origin === "microsoft";
}

// Follow-ups e pedidos do captador têm fluxo próprio: não arrastam.
function arrastavel(a: AtividadeRow): boolean {
  return !a.source_kind || a.source_kind === "atividade";
}

function GradeDeHorarios({ dias, byDate, hoje, agora, detalhado, onEdit, onNew, onAbrirDia, onReagendar }: {
  dias: Date[];
  byDate: Map<string, AtividadeRow[]>;
  hoje: string;
  agora: Date;
  detalhado: boolean;
  onEdit: (id: string) => void;
  onNew: (dateStr: string, hora?: string) => void;
  onAbrirDia: (date: Date) => void;
  onReagendar: (id: string, mudanca: Reagendamento) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const corpoRef = useRef<HTMLDivElement>(null);
  const cabecalhoRef = useRef<HTMLDivElement>(null);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const arrastoRef = useRef<Arrasto | null>(null);
  const acabouDeArrastar = useRef(false);
  const colunas = `3.75rem repeat(${dias.length}, minmax(0, 1fr))`;
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  const emArrasto = arrasto?.ativo ? arrasto : null;
  const porDia = dias.map(date => {
    const dateStr = isoLocal(date);
    const itens = (byDate.get(dateStr) ?? []).filter(item => item.id !== emArrasto?.id);
    const comHora: { item: AtividadeRow; inicio: number; fim: number }[] = [];
    const semHora: AtividadeRow[] = [];
    for (const item of itens) {
      const intervalo = intervaloNaGrade(item);
      if (intervalo) comHora.push({ item, ...intervalo }); else semHora.push(item);
    }
    // o compromisso arrastado aparece onde vai cair
    if (emArrasto && emArrasto.previa.data === dateStr) {
      const item = [...byDate.values()].flat().find(a => a.id === emArrasto.id);
      if (item && emArrasto.previa.inicio !== null && emArrasto.previa.fim !== null) comHora.push({ item, inicio: emArrasto.previa.inicio, fim: emArrasto.previa.fim });
      else if (item) semHora.push(item);
    }
    return { date, dateStr, posicionados: posicionarNoDia(comHora), semHora };
  });
  const temSemHorario = porDia.some(d => d.semHora.length > 0);
  const chaveDosDias = porDia.map(d => d.dateStr).join(",");
  const hojeVisivel = chaveDosDias.includes(hoje);
  const primeiroInicio = Math.min(...porDia.flatMap(d => d.posicionados.map(p => p.inicio)));

  // Ao abrir ou trocar de período, rola até o primeiro compromisso (ou o começo do expediente).
  useEffect(() => {
    const scroll = scrollRef.current, corpo = corpoRef.current;
    if (!scroll || !corpo) return;
    const alvo = Number.isFinite(primeiroInicio) ? primeiroInicio - 30 : hojeVisivel ? agoraMin - 120 : 7 * 60;
    scroll.scrollTop = Math.max(0, alvo) / MINUTOS_NO_DIA * corpo.offsetHeight;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDosDias]);

  const minutoNoPonto = (clientY: number) => {
    const r = corpoRef.current!.getBoundingClientRect();
    return (clientY - r.top) / r.height * MINUTOS_NO_DIA;
  };
  const diaNoPonto = (clientX: number): string | null => {
    const colunasDosDias = [...(corpoRef.current?.querySelectorAll<HTMLElement>("[data-dia]") ?? [])];
    if (!colunasDosDias.length) return null;
    for (const coluna of colunasDosDias) {
      const r = coluna.getBoundingClientRect();
      if (clientX >= r.left && clientX < r.right) return coluna.dataset.dia ?? null;
    }
    return clientX < colunasDosDias[0].getBoundingClientRect().left ? colunasDosDias[0].dataset.dia ?? null : colunasDosDias.at(-1)!.dataset.dia ?? null;
  };

  // Os ouvintes entram no mesmo instante em que o compromisso é pego: movimentos rápidos não se perdem.
  const reagendarRef = useRef(onReagendar);
  useEffect(() => { reagendarRef.current = onReagendar; }, [onReagendar]);
  const soltarOuvintes = useRef<(() => void) | null>(null);
  useEffect(() => () => soltarOuvintes.current?.(), []);

  const pegar = (evento: React.PointerEvent, item: AtividadeRow, modo: ModoArrasto, intervalo: { inicio: number; fim: number } | null, dia: string) => {
    if (evento.button !== 0 || !arrastavel(item)) return;
    const semHora = intervalo === null;
    // sem hora: ao entrar na grade vira um compromisso de uma hora, com o topo um pouco acima do ponteiro
    const base = intervalo ?? { inicio: 0, fim: 60 };
    // no toque, arrastar o bloco rolaria a agenda: lá só as bordas mudam o horário
    if (modo === "mover" && evento.pointerType === "touch") return;
    evento.stopPropagation();
    if (modo !== "mover") evento.preventDefault();
    soltarOuvintes.current?.();
    const novo: Arrasto = {
      id: item.id, modo, original: base, diaOrigem: dia,
      pegada: semHora ? 15 : minutoNoPonto(evento.clientY) - base.inicio,
      x: evento.clientX, y: evento.clientY,
      ativo: modo !== "mover",
      semHoraOrigem: semHora,
      previa: semHora ? { data: dia, inicio: null, fim: null } : { data: dia, ...base },
    };
    arrastoRef.current = novo;
    setArrasto(novo);

    const mover = (e: PointerEvent) => {
      const atual = arrastoRef.current;
      if (!atual) return;
      if (!atual.ativo && Math.hypot(e.clientX - atual.x, e.clientY - atual.y) < 5) return;
      e.preventDefault();
      // perto da beirada visível da grade, a agenda rola devagar (mais rápido quanto mais perto)
      const scroll = scrollRef.current;
      if (scroll) {
        const r = scroll.getBoundingClientRect();
        const topoVisivel = r.top + (cabecalhoRef.current?.offsetHeight ?? 0);
        const zona = 24 * escalaUi();
        if (e.clientY < topoVisivel + zona) scroll.scrollTop -= Math.ceil((topoVisivel + zona - e.clientY) / zona * 6);
        else if (e.clientY > r.bottom - zona) scroll.scrollTop += Math.ceil((e.clientY - (r.bottom - zona)) / zona * 6);
      }
      const data = atual.modo === "mover" ? diaNoPonto(e.clientX) ?? atual.previa.data : atual.diaOrigem;
      // item sem hora: em cima da grade ganha horário; na faixa de cima continua sem hora
      const naGrade = !atual.semHoraOrigem || e.clientY >= (scroll?.getBoundingClientRect().top ?? 0) + (cabecalhoRef.current?.offsetHeight ?? 0);
      const novoTrecho = naGrade ? novoIntervalo(atual.modo, atual.original, minutoNoPonto(e.clientY), atual.pegada) : { inicio: null, fim: null };
      const proximo = { ...atual, ativo: true, previa: { data, ...novoTrecho } };
      arrastoRef.current = proximo;
      setArrasto(proximo);
    };
    const soltar = () => {
      limpar();
      const atual = arrastoRef.current;
      arrastoRef.current = null;
      setArrasto(null);
      if (!atual?.ativo) return; // foi um clique: o botão abre a atividade
      acabouDeArrastar.current = true;
      setTimeout(() => { acabouDeArrastar.current = false; }, 0);
      const { data, inicio, fim } = atual.previa;
      const mudou = atual.semHoraOrigem
        ? data !== atual.diaOrigem || inicio !== null
        : data !== atual.diaOrigem || inicio !== atual.original.inicio || fim !== atual.original.fim;
      if (mudou) reagendarRef.current(atual.id, atual.previa);
    };
    const cancelar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      limpar();
      arrastoRef.current = null;
      setArrasto(null);
    };
    const limpar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("keydown", cancelar);
      soltarOuvintes.current = null;
    };
    window.addEventListener("pointermove", mover, { passive: false });
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    window.addEventListener("keydown", cancelar);
    soltarOuvintes.current = limpar;
  };

  const abrir = (id: string) => { if (!acabouDeArrastar.current) onEdit(id); };
  const limiteSemHora = detalhado ? 20 : 3;

  return (
    <div
      ref={scrollRef}
      className={`relative max-h-[max(28rem,calc(100dvh-17rem))] overflow-auto overscroll-contain ${emArrasto ? (emArrasto.modo === "mover" ? "cursor-grabbing select-none" : "cursor-ns-resize select-none") : ""}`}
    >
      <div style={{ minWidth: dias.length > 1 ? "52rem" : undefined }}>
        {/* Cabeçalho dos dias e faixa das atividades sem horário */}
        <div ref={cabecalhoRef} className="sticky top-0 z-40 grid border-b bg-white/95 backdrop-blur-sm" style={{ gridTemplateColumns: colunas, borderColor: "rgba(40,37,37,.08)" }}>
          <div className="flex items-end justify-end px-2 pb-2 text-[0.5625rem] uppercase tracking-[.06em] text-black/30" style={MONO}>gmt-3</div>
          {porDia.map(({ date, dateStr }, index) => {
            const isToday = dateStr === hoje;
            const rotulo = DIAS_DA_SEMANA[(date.getDay() + 6) % 7];
            return (
              <button
                key={dateStr}
                type="button"
                disabled={detalhado}
                onClick={() => onAbrirDia(date)}
                aria-label={`Abrir ${date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}`}
                className={`group flex flex-col items-center gap-1 px-2 pb-2.5 pt-3 transition enabled:hover:bg-[rgba(40,37,37,.025)] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#684DB0]/30 ${index > 0 ? "border-l" : ""}`}
                style={{ borderColor: "rgba(40,37,37,.06)" }}
              >
                <span className={`text-[0.5625rem] font-medium uppercase tracking-[.1em] ${isToday ? "text-[#684DB0]" : "text-black/40"}`} style={MONO}>{rotulo}</span>
                <span className={`font-display flex h-9 min-w-9 items-center justify-center rounded-full px-1.5 text-[1.125rem] font-bold leading-none tracking-[-.04em] tabular-nums transition ${isToday ? "bg-[#684DB0] text-white shadow-[0_8px_20px_-6px_rgba(104,77,176,.55)]" : "text-[#282525] group-enabled:group-hover:bg-white group-enabled:group-hover:shadow-[0_0_0_1px_rgba(40,37,37,.08)]"}`}>{date.getDate()}</span>
              </button>
            );
          })}
          {temSemHorario && <>
            <div className="flex items-start justify-end border-t px-2 pt-2 text-right text-[0.5rem] font-medium uppercase leading-tight tracking-[.08em] text-black/35" style={{ ...MONO, borderColor: "rgba(40,37,37,.06)" }}>sem<br />hora</div>
            {porDia.map(({ date, dateStr, semHora }) => (
              <div key={dateStr} className="flex min-w-0 flex-col gap-1 border-l border-t p-1.5" style={{ borderColor: "rgba(40,37,37,.06)" }}>
                {semHora.slice(0, limiteSemHora).map(item => (
                  <ChipSemHorario
                    key={item.id}
                    atividade={item}
                    arrastando={emArrasto?.id === item.id}
                    onAbrir={abrir}
                    onPegar={evento => pegar(evento, item, "mover", null, dateStr)}
                  />
                ))}
                {semHora.length > limiteSemHora && (
                  <button type="button" onClick={() => onAbrirDia(date)} className="rounded px-1.5 py-0.5 text-left text-[0.625rem] text-[#684DB0] hover:bg-black/[.03]">
                    +{semHora.length - limiteSemHora} mais
                  </button>
                )}
              </div>
            ))}
          </>}
        </div>

        {/* Grade de horários: papel com linhas de hora e meia hora */}
        <div ref={corpoRef} className="relative grid" style={{ gridTemplateColumns: colunas, height: `${24 * HORA_REM}rem` }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, i) => i + 1).map(h => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[0.5625rem] tabular-nums text-black/35" style={{ ...MONO, top: `${h * HORA_REM}rem` }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
            {hojeVisivel && (
              <span className="absolute right-1 z-30 -translate-y-1/2 rounded-[3px] bg-[#684DB0] px-1 py-px text-[0.5625rem] font-medium tabular-nums text-white shadow-[0_4px_10px_-4px_rgba(104,77,176,.6)]" style={{ ...MONO, top: `${agoraMin / 60 * HORA_REM}rem` }}>
                {horaDe(agoraMin)}
              </span>
            )}
          </div>
          {porDia.map(({ date, dateStr, posicionados }) => {
            const fimDeSemana = date.getDay() === 0 || date.getDay() === 6;
            return (
              <div
                key={dateStr}
                data-dia={dateStr}
                className="relative border-l"
                style={{
                  borderColor: "rgba(40,37,37,.06)",
                  backgroundColor: dateStr === hoje && !detalhado ? "rgba(40,37,37,.022)" : fimDeSemana ? "rgba(40,37,37,.012)" : undefined,
                  backgroundImage: "linear-gradient(to bottom, rgba(40,37,37,.075) 1px, transparent 1px), linear-gradient(to bottom, transparent calc(50% - .5px), rgba(40,37,37,.03) calc(50% - .5px), rgba(40,37,37,.03) calc(50% + .5px), transparent calc(50% + .5px))",
                  backgroundSize: `100% ${HORA_REM}rem, 100% ${HORA_REM}rem`,
                }}
              >
                {/* Meia hora livre: clique cria a atividade já com o dia e a hora */}
                {Array.from({ length: 48 }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    onClick={() => { if (!acabouDeArrastar.current) onNew(dateStr, horaDe(i * 30)); }}
                    className={`group absolute inset-x-0 cursor-pointer ${emArrasto ? "" : "hover:bg-[rgba(104,77,176,.045)]"}`}
                    style={{ top: `${i * HORA_REM / 2}rem`, height: `${HORA_REM / 2}rem` }}
                  >
                    {!emArrasto && (
                      <span className="pointer-events-none hidden items-center gap-1 px-1.5 pt-0.5 text-[0.5625rem] font-medium tabular-nums text-[#684DB0] group-hover:flex" style={MONO}>
                        <Plus size={10} /> {horaDe(i * 30)}
                      </span>
                    )}
                  </div>
                ))}

                {/* onde o compromisso estava, enquanto ele é arrastado */}
                {emArrasto && emArrasto.diaOrigem === dateStr && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-[2px] z-[5] rounded border border-dashed border-[#684DB0]/45"
                    style={{ top: `${emArrasto.original.inicio / 60 * HORA_REM}rem`, height: `${Math.max(emArrasto.original.fim - emArrasto.original.inicio, 30) / 60 * HORA_REM}rem` }}
                  />
                )}

                {posicionados.map(p => (
                  <BlocoNaGrade
                    key={p.item.id}
                    posicionado={p}
                    detalhado={detalhado}
                    arrastando={emArrasto?.id === p.item.id}
                    onAbrir={abrir}
                    onPegar={(evento, modo) => pegar(evento, p.item, modo, emArrasto?.id === p.item.id ? emArrasto.original : { inicio: p.inicio, fim: p.fim }, dateStr)}
                  />
                ))}

                {dateStr === hoje && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 h-px" style={{ top: `${agoraMin / 60 * HORA_REM}rem`, background: LIGACAO_ROXA }}>
                    <span className="absolute -left-[4px] -top-[3.5px] h-2 w-2 rounded-full border-2 border-white bg-[#684DB0] shadow-[0_0_0_1px_rgba(104,77,176,.35)]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlocoNaGrade({ posicionado, detalhado, arrastando, onAbrir, onPegar }: {
  posicionado: Posicionado<AtividadeRow>;
  detalhado: boolean;
  arrastando: boolean;
  onAbrir: (id: string) => void;
  onPegar: (evento: React.PointerEvent, modo: ModoArrasto) => void;
}) {
  const { item: atividade, inicio, fim, coluna, colunas } = posicionado;
  const config = typeConfigFor(atividade);
  const Icon = config.Icon;
  const duracao = fim - inicio;
  const curto = duracao < 45;
  const entity = entityLabel(atividade);
  const horario = `${horaDe(inicio)}–${horaDe(fim)}`;
  const deFora = veioDeFora(atividade);
  const origem = atividade.sync_origin === "google" ? "Google Agenda" : "Outlook";
  const iconeDoTipo = (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(40,37,37,.08)]" style={{ color: atividade.feita ? "rgba(13,13,13,.30)" : config.color }}>
      <Icon size={11} aria-hidden="true" />
    </span>
  );
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onAbrir(atividade.id); }}
      onPointerDown={(event) => onPegar(event, "mover")}
      title={`${atividade.nome} · ${horario}${entity !== "—" ? ` · ${entity}` : ""}${deFora ? ` · do ${origem}: arrastar muda lá também` : " · arraste para mudar o dia ou o horário"}`}
      className={`group absolute flex overflow-hidden rounded border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#684DB0]/40 ${curto ? "items-center gap-1.5 px-1.5" : "flex-col gap-1 px-2 py-1.5"} ${arrastando ? "z-30 cursor-grabbing" : `z-10 transition-[box-shadow,transform] duration-200 hover:z-20 hover:-translate-y-px hover:shadow-[0_10px_28px_rgba(40,37,37,.10)] motion-reduce:transition-none cursor-grab`} ${atividade.feita ? "opacity-70" : ""}`}
      style={{
        top: `calc(${inicio / 60 * HORA_REM}rem + 1px)`,
        height: `calc(${Math.max(duracao, 30) / 60 * HORA_REM}rem - 2px)`,
        left: `calc(${coluna / colunas * 100}% + 2px)`,
        width: `calc(${100 / colunas}% - 4px)`,
        ...CARTAO_LANDING,
        borderColor: arrastando ? "#684DB0" : "rgba(40,37,37,.10)",
        boxShadow: arrastando ? "0 16px 34px -12px rgba(28,14,51,.45), 0 0 0 1px #684DB0" : "0 1px 2px rgba(40,37,37,.04)",
        touchAction: "manipulation",
      }}
    >
      {curto ? <>
        {iconeDoTipo}
        <span className="flex-shrink-0 text-[0.5625rem] tabular-nums text-black/45" style={MONO}>{horaDe(inicio)}</span>
        <span className={`min-w-0 truncate text-[0.6875rem] font-medium ${atividade.feita ? "text-black/40 line-through" : "text-[#282525]"}`}>{atividade.nome}</span>
      </> : <>
        <span className="flex min-w-0 items-start gap-1.5">
          {iconeDoTipo}
          <span className={`min-w-0 text-[0.6875rem] font-medium leading-snug ${duracao >= 90 ? "line-clamp-2" : "truncate"} ${atividade.feita ? "text-black/40 line-through" : "text-[#282525]"}`}>{atividade.nome}</span>
        </span>
        <span className={`truncate text-[0.5625rem] tabular-nums ${arrastando ? "font-medium text-[#684DB0]" : "text-black/45"}`} style={MONO}>{horario}</span>
        {duracao >= (detalhado ? 60 : 90) && entity !== "—" && (
          <span className="truncate text-[0.625rem] text-black/45">{entity}</span>
        )}
        {detalhado && duracao >= 90 && atividade.responsavel?.full_name && (
          <span className="truncate text-[0.625rem] text-black/40">{atividade.responsavel.full_name}</span>
        )}
      </>}
      {arrastando && curto && <span className="ml-auto flex-shrink-0 text-[0.5625rem] font-medium tabular-nums text-[#684DB0]" style={MONO}>{horario}</span>}

      {/* bordas: puxar muda o início ou o fim */}
      <>
        <span
          aria-hidden="true"
          onPointerDown={(event) => onPegar(event, "inicio")}
          className="absolute inset-x-0 top-0 flex h-2 cursor-ns-resize touch-none justify-center"
        >
          <span className="mt-[2px] h-[3px] w-6 rounded-full bg-[#684DB0]/0 transition group-hover:bg-[#684DB0]/45" />
        </span>
        <span
          aria-hidden="true"
          onPointerDown={(event) => onPegar(event, "fim")}
          className="absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize touch-none items-end justify-center"
        >
          <span className="mb-[2px] h-[3px] w-6 rounded-full bg-[#684DB0]/0 transition group-hover:bg-[#684DB0]/45" />
        </span>
      </>
    </button>
  );
}

function ChipSemHorario({ atividade, arrastando, onAbrir, onPegar }: { atividade: AtividadeRow; arrastando: boolean; onAbrir: (id: string) => void; onPegar: (evento: React.PointerEvent) => void }) {
  const config = typeConfigFor(atividade);
  const Icon = config.Icon;
  const podeArrastar = arrastavel(atividade);
  return (
    <button
      type="button"
      onClick={() => onAbrir(atividade.id)}
      onPointerDown={podeArrastar ? onPegar : undefined}
      title={`${atividade.nome}${podeArrastar ? " · arraste para um horário ou outro dia" : ""}`}
      className={`flex min-w-0 items-center gap-1.5 rounded border px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#684DB0]/30 ${arrastando ? "cursor-grabbing" : `transition duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(40,37,37,.08)] motion-reduce:transition-none ${podeArrastar ? "cursor-grab" : ""}`}`}
      style={{ ...CARTAO_LANDING, borderColor: arrastando ? "#684DB0" : "rgba(40,37,37,.09)", boxShadow: arrastando ? "0 10px 24px -10px rgba(28,14,51,.45), 0 0 0 1px #684DB0" : undefined }}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(40,37,37,.08)]" style={{ color: atividade.feita ? "rgba(13,13,13,.30)" : config.color }}>
        <Icon size={10} aria-hidden="true" />
      </span>
      <span className={`truncate text-[0.625rem] font-medium ${atividade.feita ? "text-black/35 line-through" : "text-[#282525]"}`}>{atividade.nome}</span>
    </button>
  );
}

/* ─── Painel do mês ─────────────────────────────────────────────────────── */

// O mês como linha do tempo: números no topo, uma estação por semana (tipos, ritmo dos dias e destaques)
// e, embaixo, a régua com os dias do mês. Clicar num dia abre a grade de horários dele.
const VERDE = "#2E8932";
const INICIAIS_DO_DIA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// Detalhes da landing page: Geist Mono nos rótulos técnicos, cartões em papel e conexões tracejadas em roxo.
const MONO: React.CSSProperties = { fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace" };
const CARTAO_LANDING: React.CSSProperties = { background: "linear-gradient(145deg, #FFFFFF 0%, #F7F7F5 100%)" };
const LIGACAO_ROXA = "repeating-linear-gradient(90deg, #684DB0 0 3px, transparent 3px 7px)";
const LIGACAO_ROXA_V = "repeating-linear-gradient(180deg, #684DB0 0 3px, transparent 3px 7px)";
const LIGACAO_FEITA = "rgba(40,37,37,.22)";
const LIGACAO_FEITA_V = "rgba(40,37,37,.16)";

function diasEntre(inicio: string, fim: string): string[] {
  const [y, m, d] = inicio.split("-").map(Number);
  const data = new Date(y, m - 1, d);
  const dias: string[] = [];
  while (isoLocal(data) <= fim) { dias.push(isoLocal(data)); data.setDate(data.getDate() + 1); }
  return dias;
}

function dataDoIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Meio círculo de barrinhas: verde = concluídas, coral = atrasadas, cinza = o que falta.
const BARRAS_DO_ARCO = 31;

function ArcoDeConclusao({ taxa, concluidas, atrasadas, total }: { taxa: number; concluidas: number; atrasadas: number; total: number }) {
  const verdes = total ? Math.round(concluidas / total * BARRAS_DO_ARCO) : 0;
  const corais = total ? Math.min(BARRAS_DO_ARCO - verdes, Math.round(atrasadas / total * BARRAS_DO_ARCO)) : 0;
  const cx = 80, cy = 78, dentro = 54, fora = 72;
  return (
    <div className="w-[8.5rem] flex-shrink-0 sm:w-[10rem]" role="img" aria-label={`${taxa}% concluído: ${concluidas} de ${total}${atrasadas ? `, ${atrasadas} atrasadas` : ""}`}>
      <div className="relative">
      <svg viewBox="0 0 160 84" className="block w-full">
        {Array.from({ length: BARRAS_DO_ARCO }, (_, i) => {
          const angulo = Math.PI - (i / (BARRAS_DO_ARCO - 1)) * Math.PI;
          const cos = Math.cos(angulo), sen = Math.sin(angulo);
          const cor = i < verdes ? VERDE : i < verdes + corais ? "#D94A4A" : "rgba(13,13,13,.10)";
          return (
            <line
              key={i}
              x1={cx + dentro * cos} y1={cy - dentro * sen}
              x2={cx + fora * cos} y2={cy - fora * sen}
              stroke={cor} strokeWidth="3.4" strokeLinecap="round"
            />
          );
        })}
      </svg>
      <span className={`absolute inset-x-0 bottom-0 text-center text-[1.375rem] font-semibold leading-none tracking-[-.02em] tabular-nums sm:text-[1.625rem] ${taxa ? "text-[#282525]" : "text-black/30"}`}>{taxa}<span className="text-[0.75rem] text-black/45 sm:text-[0.875rem]">%</span></span>
      </div>
      {/* legenda abaixo do arco: quebra em duas linhas quando falta largura */}
      <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1 text-center text-[0.5625rem] font-medium uppercase leading-tight tracking-[.08em] text-black/45">
        <span className="whitespace-nowrap">concluído</span>
        <span aria-hidden="true" className="text-black/25">·</span>
        <span className="whitespace-nowrap tabular-nums">{concluidas} de {total}</span>
      </p>
    </div>
  );
}

function PainelDoMes({ itens, ano, mes, hoje, onAbrirDia, onAbrirSemana, onEdit, onNew }: {
  itens: AtividadeRow[]; ano: number; mes: number; hoje: string;
  onAbrirDia: (date: Date) => void; onAbrirSemana: (date: Date) => void; onEdit: (id: string) => void; onNew: (dateStr: string) => void;
}) {
  const [tipoAtivo, setTipoAtivo] = useState<string | null>(null);
  const trilhaRef = useRef<HTMLDivElement>(null);
  const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}-`;
  const dataDe = (a: AtividadeRow) => { const d = scheduledDate(a); return d ? normDate(d) : null; };

  const tiposDoMes = useMemo(() => {
    const mapa = new Map<string, { config: ReturnType<typeof typeConfigFor>; total: number }>();
    for (const a of itens) {
      if (!dataDe(a)?.startsWith(prefixo)) continue;
      const config = typeConfigFor(a);
      const atual = mapa.get(config.label) ?? { config, total: 0 };
      atual.total++;
      mapa.set(config.label, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [itens, prefixo]);

  const { visiveis, metricas, anterior } = useMemo(() => {
    const lista = tipoAtivo ? itens.filter(a => typeConfigFor(a).label === tipoAtivo) : itens;
    const paraMetricas: ItemDoMes[] = lista.map(a => {
      const intervalo = intervaloNaGrade(a);
      return { data: dataDe(a), feita: a.feita, tipo: typeConfigFor(a).label, responsavel: a.responsavel_id, minutos: intervalo ? intervalo.fim - intervalo.inicio : null };
    });
    const mesAnterior = new Date(ano, mes - 1, 1);
    return {
      visiveis: lista,
      metricas: metricasDoMes(paraMetricas, ano, mes, hoje),
      anterior: metricasDoMes(paraMetricas, mesAnterior.getFullYear(), mesAnterior.getMonth(), hoje),
    };
  }, [itens, tipoAtivo, ano, mes, hoje]);

  // Abre a linha do tempo na semana de hoje.
  useEffect(() => {
    const trilha = trilhaRef.current;
    const atual = trilha?.querySelector<HTMLElement>("[data-semana-atual]");
    if (trilha && atual) trilha.scrollLeft = Math.max(0, atual.offsetLeft - 24);
  }, [ano, mes]);

  const nomeMes = MONTH_NAMES[mes].toLowerCase();
  const nomeAnterior = MONTH_NAMES[(mes + 11) % 12].toLowerCase();

  if (tiposDoMes.length === 0) {
    return (
      <div className="rounded border bg-white px-6 py-16 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <CalendarDays size={24} className="mx-auto mb-3 text-black/20" aria-hidden="true" />
        <p className="text-[0.8125rem] font-medium text-[#282525]">Nenhuma atividade em {nomeMes}</p>
        <p className="mt-1 text-[0.75rem] text-black/45">A linha do tempo do mês aparece aqui conforme a agenda se enche.</p>
        <button type="button" onClick={() => onNew(hoje.startsWith(prefixo) ? hoje : `${prefixo}01`)} className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#282525] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#3A3535] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30">
          <Plus size={13} aria-hidden="true" /> Nova atividade
        </button>
      </div>
    );
  }

  const variacao = metricas.total - anterior.total;
  const taxa = metricas.total ? Math.round(metricas.concluidas / metricas.total * 100) : 0;
  const mesPassou = `${prefixo}31` < hoje;
  const pendentes = metricas.total - metricas.concluidas;
  const situacao = metricas.atrasadas > 0
    ? { palavras: ["Com", "atrasos"], destaque: "#D94A4A", frase: `${metricas.atrasadas} ${metricas.atrasadas === 1 ? "atividade vencida pede" : "atividades vencidas pedem"} atenção. ${pendentes} ainda a fazer no mês.` }
    : metricas.total > 0 && metricas.concluidas === metricas.total ? { palavras: ["Tudo", "concluído"], destaque: VERDE, frase: "Cada atividade do mês já foi feita." }
    : mesPassou ? { palavras: ["Mês", "encerrado"], destaque: "#282525", frase: `${metricas.concluidas} de ${metricas.total} atividades concluídas.` }
    : { palavras: ["Em", "dia"], destaque: VERDE, frase: `Nada vencido. ${pendentes} ${pendentes === 1 ? "atividade" : "atividades"} pela frente.` };
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const maxDoMes = Math.max(...[...metricas.porDia.values()].map(d => d.total), 1);
  const reunioes = visiveis.filter(a => a.tipo === "reuniao" && dataDe(a)?.startsWith(prefixo)).length;

  const semanas = metricas.porSemana.map((s, indice) => {
    const daSemana = visiveis
      .filter(a => { const d = dataDe(a); return d !== null && d >= s.inicio && d <= s.fim; })
      .sort((a, b) => `${dataDe(a)} ${a.hora_inicio ?? "99"}`.localeCompare(`${dataDe(b)} ${b.hora_inicio ?? "99"}`));
    const tipos = new Map<string, { config: ReturnType<typeof typeConfigFor>; total: number }>();
    for (const a of daSemana) {
      const config = typeConfigFor(a);
      const atual = tipos.get(config.label) ?? { config, total: 0 };
      atual.total++;
      tipos.set(config.label, atual);
    }
    const atrasada = (a: AtividadeRow) => !a.feita && (dataDe(a) ?? "") < hoje;
    const destaques = [...daSemana.filter(atrasada), ...daSemana.filter(a => !a.feita && !atrasada(a)), ...daSemana.filter(a => a.feita)];
    const estado = s.fim < hoje ? "passada" : s.inicio <= hoje ? "atual" : "futura";
    return { ...s, indice, itens: daSemana, tipos: [...tipos.values()].sort((a, b) => b.total - a.total), destaques, estado, anterior: indice > 0 ? metricas.porSemana[indice - 1].total : null };
  });
  const intervaloCurto = (inicio: string, fim: string) => inicio === fim ? `${Number(inicio.slice(8))} ${MESES_CURTOS[mes]}` : `${Number(inicio.slice(8))}–${Number(fim.slice(8))} ${MESES_CURTOS[mes]}`;

  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      {/* Topo do mês: situação, anel de conclusão, números, pulso dos dias e tipos */}
      <div className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div className="grid gap-6 px-5 pb-5 pt-6 sm:px-6 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center xl:gap-10">
          <div className="flex items-center gap-5">
            <ArcoDeConclusao taxa={taxa} concluidas={metricas.concluidas} atrasadas={metricas.atrasadas} total={metricas.total} />
            <div className="min-w-0">
              <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-[rgba(40,37,37,.35)]">Situação de {nomeMes}</p>
              <p className="mt-1 text-[2.5rem] font-normal italic leading-[1] tracking-[-.03em] text-[#282525] [text-wrap:balance]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
                {situacao.palavras[0]} <span style={{ color: situacao.destaque }}>{situacao.palavras[1]}</span>
              </p>
              <p className="mt-1.5 max-w-[19rem] text-[0.75rem] leading-snug text-black/50">{situacao.frase}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border bg-black/[.06] sm:grid-cols-4" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            {[
              { rotulo: "Atividades", valor: String(metricas.total), zero: !metricas.total, extra: variacao ? `${variacao > 0 ? "+" : "−"}${Math.abs(variacao)} vs ${nomeAnterior.slice(0, 3)}` : `igual a ${nomeAnterior.slice(0, 3)}`, Icone: CalendarDays },
              { rotulo: "Atrasadas", valor: String(metricas.atrasadas), zero: !metricas.atrasadas, extra: metricas.atrasadas ? "vencidas" : "nada vencido", Icone: AlertCircle, alerta: metricas.atrasadas > 0 },
              { rotulo: "Reuniões", valor: String(reunioes), zero: !reunioes, extra: reunioes ? `${Math.round(reunioes / Math.max(metricas.total, 1) * 100)}% da agenda` : "nenhuma no mês", Icone: Users },
              { rotulo: "Horas agendadas", valor: metricas.minutosAgendados ? formatarDuracao(metricas.minutosAgendados) : "0h", zero: !metricas.minutosAgendados, extra: `${metricas.comHorario} com horário`, Icone: Clock },
            ].map(n => (
              <div key={n.rotulo} className="min-w-0 px-4 py-3.5" style={CARTAO_LANDING}>
                <dt className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                  <n.Icone size={12} aria-hidden="true" className={n.alerta ? "text-[#D94A4A]" : "text-black/40"} />{n.rotulo}
                </dt>
                <dd className={`mt-2 text-[1.5rem] font-semibold leading-none tracking-[-.02em] tabular-nums ${n.zero ? "text-black/30" : "text-[#282525]"}`}>{n.valor}</dd>
                <dd className="mt-1.5 truncate text-[0.625rem] tabular-nums text-black/45" style={MONO}>{n.extra}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Pulso do mês: uma barra por dia; clique abre o dia */}
        <div className="px-5 sm:px-6">
          <div className="flex h-12 items-end gap-[3px]">
            {Array.from({ length: diasNoMes }, (_, i) => {
              const iso = `${prefixo}${String(i + 1).padStart(2, "0")}`;
              const info = metricas.porDia.get(iso);
              const total = info?.total ?? 0;
              const aFazer = total - (info?.concluidas ?? 0) - (info?.atrasadas ?? 0);
              const ehHoje = iso === hoje;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onAbrirDia(dataDoIso(iso))}
                  title={`${i + 1}/${String(mes + 1).padStart(2, "0")}: ${total ? `${total} ${total === 1 ? "atividade" : "atividades"}, ${info!.concluidas} concluídas${info!.atrasadas ? `, ${info!.atrasadas} atrasadas` : ""}` : "livre"}`}
                  className={`group flex h-full min-w-0 flex-1 flex-col justify-end rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30 ${ehHoje ? "bg-black/[.04]" : "hover:bg-black/[.03]"}`}
                >
                  {total ? (
                    <span className="flex w-full flex-col-reverse gap-[2px] group-hover:opacity-80" style={{ height: `${Math.max(total / maxDoMes * 100, 14)}%` }}>
                      {info!.concluidas > 0 && <span className="rounded-[2px]" style={{ flexGrow: info!.concluidas, background: VERDE }} />}
                      {info!.atrasadas > 0 && <span className="rounded-[2px] bg-[#D94A4A]" style={{ flexGrow: info!.atrasadas }} />}
                      {aFazer > 0 && <span className="rounded-[2px] bg-black/[.16]" style={{ flexGrow: aFazer }} />}
                    </span>
                  ) : <span className="h-[2px] w-full rounded-[2px] bg-black/[.07]" />}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-[3px]" style={MONO}>
            {Array.from({ length: diasNoMes }, (_, i) => {
              const iso = `${prefixo}${String(i + 1).padStart(2, "0")}`;
              // os números de referência somem perto de "hoje" para não encostar nele
              const pertoDeHoje = hoje.startsWith(prefixo) && Math.abs(Number(hoje.slice(8)) - (i + 1)) <= 2;
              const mostra = iso === hoje || (!pertoDeHoje && (i === 0 || (i + 1) % 5 === 0));
              return <span key={iso} className={`min-w-0 flex-1 text-center text-[0.5625rem] tabular-nums ${iso === hoje ? "font-semibold text-[#282525]" : "text-black/35"}`}>{mostra ? (iso === hoje ? "hoje" : i + 1) : ""}</span>;
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.625rem] text-black/45">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px]" style={{ background: VERDE }} />Concluídas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] bg-[#D94A4A]" />Atrasadas</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] bg-black/[.16]" />A fazer</span>
          </div>
        </div>

        {/* Tipos do mês: filtram o painel */}
        <div className="flex gap-1.5 overflow-x-auto px-5 pb-5 pt-4 sm:px-6" role="group" aria-label="Filtrar o mês por tipo">
          {[{ label: null as string | null, total: tiposDoMes.reduce((s, x) => s + x.total, 0), Icon: null as React.ElementType | null, cor: "" }, ...tiposDoMes.map(t => ({ label: t.config.label as string | null, total: t.total, Icon: t.config.Icon as React.ElementType | null, cor: t.config.color }))].map(t => {
            const ativo = tipoAtivo === t.label;
            const Icon = t.Icon;
            return (
              <button
                key={t.label ?? "todos"}
                type="button"
                aria-pressed={ativo}
                onClick={() => setTipoAtivo(t.label)}
                className={`inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25 ${ativo ? "border-[#7259B5]/35 text-[#7259B5]" : "border-black/[.09] text-black/55 hover:bg-black/[.04] hover:text-black/75"}`}
              >
                {Icon && <span className="flex" style={{ color: t.cor }}><Icon size={12} aria-hidden="true" /></span>}
                {t.label ?? "Todos"}
                <span className="tabular-nums text-black/35">{t.total}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Linha do tempo: uma estação por semana (prancheta da landing: papel com linhas finas e conexões tracejadas em roxo) */}
      <div
        ref={trilhaRef}
        className="relative overflow-x-auto border-y bg-[#F7F7F5]"
        style={{ borderColor: "rgba(40,37,37,.07)", backgroundImage: "repeating-linear-gradient(0deg, rgba(40,37,37,.035) 0, rgba(40,37,37,.035) 1px, transparent 1px, transparent 4px)" }}
      >
        <div className="flex min-w-max px-5 pb-7 pt-6">
          {semanas.map(s => {
            const atual = s.estado === "atual";
            const delta = s.anterior === null ? null : s.total - s.anterior;
            const dias = diasEntre(s.inicio, s.fim);
            const maxSemana = Math.max(...dias.map(d => metricas.porDia.get(d)?.total ?? 0), 1);
            // conexões: o que já passou é traço contínuo; o que vem pela frente, tracejado roxo
            const ligacao = s.estado === "passada" ? LIGACAO_FEITA : LIGACAO_ROXA;
            const ligacaoVertical = s.estado === "passada" ? LIGACAO_FEITA_V : LIGACAO_ROXA_V;
            return (
              <section key={s.inicio} data-semana-atual={atual ? "" : undefined} className="relative w-[19.5rem] flex-shrink-0 pr-6" aria-label={`Semana de ${intervaloCurto(s.inicio, s.fim)}`}>
                {/* trilho e estação */}
                <div className="relative flex h-10 items-center">
                  <span className="absolute left-10 right-0 top-1/2 h-px" style={{ background: ligacao }} />
                  <button
                    type="button"
                    onClick={() => onAbrirSemana(dataDoIso(s.inicio))}
                    aria-label={`Abrir a semana de ${intervaloCurto(s.inicio, s.fim)} com horários`}
                    className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#684DB0]/35 motion-reduce:transition-none ${atual ? "border-[#684DB0] bg-[#684DB0] text-white shadow-[0_8px_20px_-6px_rgba(104,77,176,.55)]" : "border-[rgba(40,37,37,.12)] bg-white text-black/55 shadow-[0_1px_2px_rgba(40,37,37,.04)] hover:border-[rgba(40,37,37,.22)]"}`}
                  >
                    <CalendarDays size={15} aria-hidden="true" />
                  </button>
                </div>
                <div className="relative ml-5 pl-5 pt-3">
                  <span className="absolute bottom-0 left-0 top-0 w-px" style={{ background: ligacaoVertical }} />
                  <div className="relative mb-3.5">
                    <span className="absolute -left-5 top-3 h-px w-4" style={{ background: ligacao }} />
                    <p className="text-[0.625rem] font-medium uppercase tracking-[.06em] text-black/40" style={MONO}>{atual ? "Esta semana" : `Semana ${String(s.indice + 1).padStart(2, "0")}`}</p>
                    <p className="font-display mt-0.5 text-[1.25rem] font-bold leading-tight tracking-[-.04em] text-[#282525]">{intervaloCurto(s.inicio, s.fim)}</p>
                  </div>

                  {s.itens.length === 0 ? (
                    <button type="button" onClick={() => onNew(s.inicio < hoje && s.fim >= hoje ? hoje : s.inicio)} className="flex items-center gap-1.5 rounded border border-dashed border-[#684DB0]/35 bg-white/70 px-3 py-2 text-[0.6875rem] text-[#684DB0] transition hover:bg-white">
                      <Plus size={12} aria-hidden="true" /> Semana livre
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {/* tipos da semana */}
                      <div className="relative flex flex-wrap gap-1.5">
                        <span className="absolute -left-5 top-4 h-px w-4" style={{ background: ligacao }} />
                        {s.tipos.slice(0, 4).map(t => {
                          const Icon = t.config.Icon;
                          return (
                            <span key={t.config.label} className="inline-flex h-8 items-center gap-1.5 rounded border pl-1 pr-2.5 text-[0.6875rem] text-black/70 shadow-[0_1px_2px_rgba(40,37,37,.025)]" style={{ ...CARTAO_LANDING, borderColor: "rgba(40,37,37,.08)" }}>
                              <span className="flex h-6 w-6 items-center justify-center rounded bg-white shadow-[0_0_0_1px_rgba(40,37,37,.06)]" style={{ color: t.config.color }}><Icon size={12} aria-hidden="true" /></span>
                              {t.config.label}<span className="tabular-nums text-black/40" style={MONO}>×{t.total}</span>
                            </span>
                          );
                        })}
                      </div>

                      {/* ritmo dos dias: na semana de hoje, o cartão de destaque da landing (roxo profundo) */}
                      <div
                        className={`relative rounded border p-3.5 transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none ${atual ? "text-white" : "hover:shadow-[0_10px_28px_rgba(40,37,37,.08)]"}`}
                        style={atual
                          ? { background: "#1C0E33", borderColor: "rgba(199,182,238,.22)", boxShadow: "0 16px 34px -12px rgba(28,14,51,.55)" }
                          : { ...CARTAO_LANDING, borderColor: "rgba(40,37,37,.08)", boxShadow: "0 1px 2px rgba(40,37,37,.025)" }}
                      >
                        <span className="absolute -left-5 top-6 h-px w-5" style={{ background: ligacao }} />
                        <div className="flex items-start justify-between">
                          <p className={`text-[0.75rem] font-semibold ${atual ? "text-white" : "text-[#282525]"}`}>Ritmo da semana</p>
                          <span className={`text-[0.625rem] uppercase tracking-[.06em] tabular-nums ${atual ? "text-[#C7B6EE]" : "text-black/40"}`} style={MONO}>{s.total} ativ.</span>
                        </div>
                        <div className="mt-3 flex h-14 items-end gap-1.5">
                          {dias.map(d => {
                            const info = metricas.porDia.get(d);
                            const total = info?.total ?? 0;
                            const feitas = total ? (info!.concluidas / total) * 100 : 0;
                            return (
                              <button key={d} type="button" onClick={() => onAbrirDia(dataDoIso(d))} title={`${Number(d.slice(8))}/${d.slice(5, 7)}: ${total} ${total === 1 ? "atividade" : "atividades"}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#684DB0]/40">
                                {total > 0 ? (
                                  <span className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${Math.max(total / maxSemana * 100, 12)}%` }}>
                                    <span style={{ height: `${feitas}%`, background: atual ? "#4CB860" : VERDE }} />
                                    <span className={`flex-1 ${atual ? "bg-[#C7B6EE]/35" : "bg-black/[.16]"}`} style={{ marginBottom: info!.concluidas && info!.concluidas < total ? 2 : 0 }} />
                                  </span>
                                ) : <span className={`h-[2px] w-full rounded-[1px] ${atual ? "bg-white/15" : "bg-black/[.07]"}`} />}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1 flex gap-1.5" style={MONO}>
                          {dias.map(d => (
                            <span key={d} className={`min-w-0 flex-1 text-center text-[0.5625rem] tabular-nums ${d === hoje ? (atual ? "font-semibold text-white" : "font-semibold text-[#282525]") : atual ? "text-white/40" : "text-black/35"}`}>{INICIAIS_DO_DIA[dataDoIso(d).getDay()]}</span>
                          ))}
                        </div>
                        <div className="mt-3 flex items-baseline justify-between border-t pt-2.5" style={{ borderColor: atual ? "rgba(199,182,238,.18)" : "rgba(40,37,37,.07)" }}>
                          <span className={`text-[0.6875rem] ${atual ? "text-white/55" : "text-black/45"}`}>Concluídas <span className={`font-semibold tabular-nums ${atual ? "text-white" : "text-[#282525]"}`}>{s.concluidas}</span><span className="tabular-nums"> / {s.total}</span></span>
                          {delta !== null && (
                            <span className={`text-[0.625rem] tabular-nums ${atual ? "text-white/55" : "text-black/45"}`} style={MONO} title="Em relação à semana anterior">
                              <span className={`font-medium ${atual ? "text-white" : "text-[#282525]"}`}>{delta > 0 ? "+" : delta < 0 ? "−" : "±"}{Math.abs(delta)}</span> vs anterior
                            </span>
                          )}
                        </div>
                      </div>

                      {/* em destaque */}
                      <div className="relative rounded border p-1.5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(40,37,37,.08)] motion-reduce:transition-none" style={{ ...CARTAO_LANDING, borderColor: "rgba(40,37,37,.08)", boxShadow: "0 1px 2px rgba(40,37,37,.025)" }}>
                        <span className="absolute -left-5 top-6 h-px w-5" style={{ background: ligacao }} />
                        <p className="px-2 pb-1 pt-2 text-[0.625rem] font-bold uppercase tracking-[.14em] text-[rgba(40,37,37,.35)]">Em destaque</p>
                        <ul>
                          {s.destaques.slice(0, 3).map(a => {
                            const config = typeConfigFor(a);
                            const atrasada = !a.feita && (dataDe(a) ?? "") < hoje;
                            const Icon = atrasada ? AlertCircle : config.Icon;
                            const d = dataDe(a)!;
                            return (
                              <li key={a.id}>
                                <button type="button" onClick={() => onEdit(a.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#684DB0]/30">
                                  <span className="flex flex-shrink-0" style={{ color: atrasada ? "#D94A4A" : a.feita ? "rgba(13,13,13,.30)" : config.color }}><Icon size={12} aria-hidden="true" /></span>
                                  <span className={`min-w-0 flex-1 truncate text-[0.6875rem] ${a.feita ? "text-black/35 line-through" : "text-[#282525]"}`}>{a.nome}</span>
                                  <span className="flex-shrink-0 text-[0.5625rem] uppercase tabular-nums text-black/40" style={MONO}>{DIAS_DA_SEMANA[(dataDoIso(d).getDay() + 6) % 7]}{a.hora_inicio && intervaloNaGrade(a) ? ` ${a.hora_inicio.slice(0, 5)}` : ""}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        {s.destaques.length > 3 && (
                          <button type="button" onClick={() => onAbrirSemana(dataDoIso(s.inicio))} className="w-full rounded px-2 py-1.5 text-left text-[0.6875rem] text-[#684DB0] transition hover:bg-white">
                            +{s.destaques.length - 3} na semana →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Régua do mês: cada dia com a quantidade; a semana de hoje fica destacada */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-2">
        <span className="flex h-11 flex-shrink-0 items-center gap-2 rounded border border-black/[.08] bg-white pl-3 pr-3.5 text-[#282525]">
          <CalendarDays size={14} aria-hidden="true" />
          <span className="text-[0.625rem] leading-tight text-black/55">{MESES_CURTOS[mes]}<br />{ano}</span>
        </span>
        {semanas.map((s, i) => (
          <div key={s.inicio} className="flex flex-shrink-0 items-center gap-1.5">
            {i > 0 && <span className="h-1 w-1 rounded-full bg-black/15" aria-hidden="true" />}
            <div className={`flex items-center gap-0.5 rounded px-1 py-1 ${s.estado === "atual" ? "bg-black/[.05]" : ""}`}>
              {diasEntre(s.inicio, s.fim).map(d => {
                const info = metricas.porDia.get(d);
                const escuro = false;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onAbrirDia(dataDoIso(d))}
                    title={info ? `${Number(d.slice(8))}/${d.slice(5, 7)}: ${info.total} ${info.total === 1 ? "atividade" : "atividades"}${info.atrasadas ? `, ${info.atrasadas} atrasadas` : ""}` : `${Number(d.slice(8))}/${d.slice(5, 7)}: livre`}
                    className={`relative flex h-9 w-8 flex-col items-center justify-center rounded text-[0.6875rem] tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/30 ${escuro ? "text-white hover:bg-white/10" : "text-black/60 hover:bg-black/[.05]"} ${d === hoje ? "font-semibold underline decoration-2 underline-offset-4" : ""}`}
                  >
                    <span className={`text-[0.5rem] uppercase ${escuro ? "text-white/50" : "text-black/30"}`}>{INICIAIS_DO_DIA[dataDoIso(d).getDay()]}</span>
                    {Number(d.slice(8))}
                    {info && (
                      <span className={`absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.5625rem] font-semibold no-underline ${info.atrasadas ? "bg-[#D94A4A] text-white" : escuro ? "bg-white text-[#282525]" : "bg-[#282525] text-white"}`}>
                        {info.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[0.6875rem] font-semibold"
      style={{
        background: "rgba(13,13,13,.05)",
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

  // A leitura fica neutra; só Atenção e Sobrecarga colorem o ícone de alerta.
  const loadStyle = (count: number): { alerta: string | null; label: string } => {
    if (count > thresholds.attentionMax) return { alerta: "#D94A4A", label: "Sobrecarga" };
    if (count > thresholds.balancedMax) return { alerta: "#B07A14", label: "Atenção" };
    return { alerta: null, label: count === 0 ? "Livre" : "Equilibrada" };
  };

  return (
    <div className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <div className="flex flex-col gap-3 border-b px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <p className="text-[0.625rem] font-medium uppercase tracking-[.12em] text-black/30">Carga da equipe</p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeekStart(current => new Date(current.getTime() - 7 * 86400000))} aria-label="Semana anterior" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.09] bg-white text-black/40 transition hover:bg-black/[.04]"><ChevronLeft size={14} /></button>
          <span className="min-w-[10.625rem] text-center text-[0.6875rem] font-medium tabular-nums text-black/55">{fmtDate(days[0].key)} — {fmtDate(weekEnd)}</span>
          <button type="button" onClick={() => setWeekStart(current => new Date(current.getTime() + 7 * 86400000))} aria-label="Próxima semana" className="flex h-9 w-9 items-center justify-center rounded border border-black/[.09] bg-white text-black/40 transition hover:bg-black/[.04]"><ChevronRight size={14} /></button>
          <button type="button" onClick={() => setWeekStart(mondayOf(new Date()))} className="h-9 rounded border border-black/[.09] bg-white px-3 text-[0.6875rem] font-medium text-black/45 transition hover:bg-black/[.04]">Hoje</button>
          <button type="button" onClick={() => { setDraftThresholds(thresholds); setThresholdError(null); setShowThresholds(current => !current); }} aria-expanded={showThresholds} className={`flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] font-medium transition hover:bg-black/[.04] ${showThresholds ? "border-[#7259B5] text-[#7259B5]" : "border-black/[.09] text-black/45"}`}><Settings2 size={13} /> Limites</button>
        </div>
      </div>

      {showThresholds && (
        <div className="border-b bg-black/[.012] px-4 py-4 sm:px-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <p className="text-[0.75rem] font-semibold text-black/70">Classificação da carga semanal</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Equilibrada até</span>
                <input type="number" min={1} max={99} value={draftThresholds.balancedMax} onChange={event => setDraftThresholds(current => ({ ...current, balancedMax: Math.max(1, Number(event.target.value) || 1) }))} className="h-9 w-24 rounded border border-black/10 bg-white px-3 text-[0.75rem] font-medium tabular-nums text-black/70 outline-none focus:border-[#7259B5]" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Atenção até</span>
                <input type="number" min={2} max={99} value={draftThresholds.attentionMax} onChange={event => setDraftThresholds(current => ({ ...current, attentionMax: Math.max(2, Number(event.target.value) || 2) }))} className="h-9 w-24 rounded border border-black/10 bg-white px-3 text-[0.75rem] font-medium tabular-nums text-black/70 outline-none focus:border-[#7259B5]" />
              </label>
              <div className="pb-0.5 text-[0.625rem] text-black/55">Acima de {draftThresholds.attentionMax}: sobrecarga</div>
              <button type="button" onClick={() => { setDraftThresholds(DEFAULT_THRESHOLDS); setThresholdError(null); }} className="h-9 rounded border border-black/10 bg-white px-3 text-[0.6875rem] font-medium text-black/40 transition hover:bg-black/[.04]">Restaurar padrão</button>
              <button type="button" disabled={savingThresholds} onClick={() => void saveThresholds(draftThresholds)} className="h-9 rounded border border-[#7259B5]/35 bg-white px-3 text-[0.6875rem] font-medium text-[#7259B5] transition hover:bg-black/[.04] disabled:opacity-40">{savingThresholds ? "Salvando…" : "Salvar limites"}</button>
            </div>
          </div>
          {thresholdError && <p role="alert" className="mt-3 text-[0.625rem] text-[#D94E4E]">{thresholdError}</p>}
        </div>
      )}

      <div className="grid grid-cols-3 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <div className="px-5 py-3">
          <p className={`text-[1.125rem] font-semibold tabular-nums ${members.some(member => member.id !== "__unassigned") ? "text-[#282525]" : "text-black/30"}`}>{members.filter(member => member.id !== "__unassigned").length}</p>
          <p className="flex items-center gap-1.5 text-[0.625rem] font-medium text-black/45"><Users size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />membros com atividades</p>
        </div>
        <div className="border-l px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <p className={`text-[1.125rem] font-semibold tabular-nums ${overloaded > 0 ? "text-[#282525]" : "text-black/30"}`}>{overloaded}</p>
          <p className="flex items-center gap-1.5 text-[0.625rem] font-medium text-black/45"><AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 ${overloaded > 0 ? "text-[#D94A4A]" : "text-black/40"}`} />em sobrecarga</p>
        </div>
        <div className="border-l px-5 py-3" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <p className={`text-[1.125rem] font-semibold tabular-nums ${unassignedInWeek > 0 ? "text-[#282525]" : "text-black/30"}`}>{unassignedInWeek}</p>
          <p className="flex items-center gap-1.5 text-[0.625rem] font-medium text-black/45"><UserX size={12} strokeWidth={1.75} aria-hidden="true" className={`shrink-0 ${unassignedInWeek > 0 ? "text-[#B07A14]" : "text-black/40"}`} />sem responsável</p>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="flex min-h-[18.75rem] flex-col items-center justify-center text-center">
          <Gauge size={24} className="mb-2 text-black/15" />
          <p className="text-xs font-medium text-black/30">Nenhuma atividade pendente para distribuir</p>
        </div>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
          <div className="min-w-[61.25rem]">
            <div className="grid grid-cols-[13.75rem_repeat(7,minmax(6rem,1fr))_6.875rem] border-b bg-black/[.012]" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <div className="px-4 py-2.5 text-[0.625rem] font-medium uppercase tracking-[.1em] text-black/30">Responsável</div>
              {days.map(({ date, key }) => <div key={key} className={`border-l px-2 py-2.5 text-center ${key === todayStr ? "bg-black/[.03]" : ""}`} style={{ borderColor: "rgba(13,13,13,.05)" }}><p className={`text-[0.5625rem] font-medium uppercase ${key === todayStr ? "text-[#7259B5]" : "text-black/30"}`}>{DAY_NAMES_SHORT[date.getDay()]}</p><p className={`mt-0.5 text-[0.6875rem] font-semibold tabular-nums ${key === todayStr ? "text-[#7259B5]" : "text-black/55"}`}>{date.getDate()}</p></div>)}
              <div className="border-l px-3 py-2.5 text-center text-[0.625rem] font-medium uppercase tracking-[.1em] text-black/30" style={{ borderColor: "rgba(13,13,13,.05)" }}>Semana</div>
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {members.map(member => {
                const weeklyItems = itemsInWeek(member.items);
                const status = loadStyle(weeklyItems.length);
                return (
                  <MemberDropRow key={member.id} memberId={member.id}>
                    <div className="flex items-center gap-2.5 px-4 py-3">
                      <MemberAvatar name={member.name} avatarUrl={member.avatarUrl} unassigned={member.id === "__unassigned"} />
                      <div className="min-w-0"><p className="truncate text-[0.75rem] font-semibold text-black/70">{member.name}</p><p className="mt-0.5 text-[0.5625rem] text-black/30">{member.items.length} pendentes no total</p></div>
                    </div>
                    {days.map(({ key }) => {
                      const dayItems = weeklyItems.filter(item => normDate(scheduledDate(item)!) === key);
                      return <div key={key} className={`space-y-1 border-l p-1.5 ${key === todayStr ? "bg-black/[.015]" : ""}`} style={{ borderColor: "rgba(13,13,13,.05)" }}>{dayItems.map(item => <DraggablePill key={item.id} item={item} onEdit={onEdit} />)}</div>;
                    })}
                    <div className="flex flex-col items-center justify-center border-l px-3 py-2" style={{ borderColor: "rgba(13,13,13,.05)" }}><span className={`text-[1.125rem] font-semibold tabular-nums ${weeklyItems.length ? "text-[#282525]" : "text-black/30"}`}>{weeklyItems.length}</span><span className="flex items-center gap-1 text-[0.625rem] font-medium text-black/55">{status.alerta && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: status.alerta }} />}{status.label}</span></div>
                  </MemberDropRow>
                );
              })}
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="rounded px-1.5 py-1 text-left text-[0.5625rem] font-medium shadow-lg" style={{ background: typePillFor(activeItem).bar, color: "white", width: "6rem" }}>
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
      className={`grid min-h-[4.375rem] grid-cols-[13.75rem_repeat(7,minmax(6rem,1fr))_6.875rem] border-b last:border-b-0 transition-colors ${isOver ? "bg-black/[.04]" : ""}`}
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
      className={`block w-full cursor-grab truncate rounded px-1.5 py-1 text-left text-[0.5625rem] font-medium transition-opacity hover:opacity-75 active:cursor-grabbing ${item.feita ? "opacity-45" : ""}`}
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
    const label = a.captacao?.titulo ?? "Sem negociação";
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
      const deltaDays = Math.round((moveEvent.clientX - originX) / (GANTT_DAY_W * escalaUi()));
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
          <button type="button" aria-label="Semana anterior" onClick={prevWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition text-black/40">
            <ChevronLeft size={14} />
          </button>
          <span className="text-[0.75rem] font-bold text-black/70 min-w-[12.5rem] text-center">
            {fmtDate(days[0].str)} — {fmtDate(days[GANTT_DAYS - 1].str)}
          </span>
          <button type="button" aria-label="Próxima semana" onClick={nextWeek} className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition text-black/40">
            <ChevronRight size={14} />
          </button>
        </div>
        <button onClick={goToday} className="text-[0.6875rem] font-semibold text-black/40 hover:text-black/70 px-2.5 py-1.5 rounded hover:bg-black/5 transition">
          Hoje
        </button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ width: remDe(GANTT_LEFT_W + GANTT_DAY_W * GANTT_DAYS), minWidth: "100%" }}>

          {/* Day header */}
          <div className="flex border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div style={{ width: remDe(GANTT_LEFT_W), flexShrink: 0 }}
              className="px-4 py-2 text-[0.625rem] font-bold text-black/25 tracking-wider uppercase">
              Atividade
            </div>
            {days.map(({ d, str }) => {
              const isToday   = str === new Date().toISOString().split("T")[0];
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={str} style={{ width: remDe(GANTT_DAY_W), flexShrink: 0, borderLeft: "1px solid rgba(13,13,13,.05)" }}
                  className={`py-2 text-center ${isToday ? "bg-black/[.03]" : isWeekend ? "bg-black/[.015]" : ""}`}>
                  <div className={`text-[0.625rem] font-bold ${isToday ? "text-[#7259B5]" : "text-black/35"}`}>
                    {d.getDate()}
                  </div>
                  <div className={`text-[0.5625rem] uppercase tracking-wide ${isToday ? "text-[#7259B5]" : "text-black/20"}`}>
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
                <div style={{ width: remDe(GANTT_LEFT_W), flexShrink: 0 }}
                  className="px-4 py-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-black/35 truncate">
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
                  <div key={a.id} className="flex items-stretch border-b transition"
                    style={{ borderColor: "rgba(13,13,13,.045)", minHeight: remDe(36) }}>

                    <button type="button" onClick={() => onEdit(a.id)}
                      aria-label={`Editar atividade ${a.nome}`}
                      style={{ width: remDe(GANTT_LEFT_W), flexShrink: 0 }}
                      className="px-4 py-1.5 flex items-center gap-2 min-w-0 text-left cursor-pointer hover:bg-black/[.025] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7259B5]/25">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: pill.bar }}>
                        <TypeIcon size={12} strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className={`text-[0.78125rem] font-semibold break-words leading-snug ${a.feita ? "line-through text-black/25" : "text-black/80"}`}>
                          {a.nome}
                        </p>
                        {entity !== "—" && (
                          <p className="text-[0.59375rem] text-black/30 truncate mt-0.5 leading-none">{entity}</p>
                        )}
                      </div>
                    </button>

                    {/* Timeline */}
                    <div style={{ position: "relative", flex: 1, alignSelf: "stretch" }}>
                      {/* Weekend shading */}
                      {days.map(({ d, str }, i) => {
                        if (d.getDay() !== 0 && d.getDay() !== 6) return null;
                        return (
                          <div key={str} style={{
                            position: "absolute", top: 0, bottom: 0,
                            left: remDe(i * GANTT_DAY_W), width: remDe(GANTT_DAY_W),
                            background: "rgba(13,13,13,.015)",
                          }} />
                        );
                      })}
                      {/* Column separators */}
                      {days.map((_, i) => (
                        <div key={i} style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: remDe(i * GANTT_DAY_W), width: 1,
                          background: "rgba(13,13,13,.04)",
                        }} />
                      ))}
                      {/* Today line */}
                      {todayOffset !== null && (
                        <div style={{
                          position: "absolute", top: 0, bottom: 0,
                          left: remDe(todayOffset), width: 1.5,
                          background: "rgba(13,13,13,.35)",
                        }} />
                      )}
                      {/* Editable date range */}
                      {bar && (
                        <div className="group" style={{
                          position: "absolute",
                          left: remDe(bar.left + 2), width: remDe(Math.max(bar.width - 4, 4)),
                          top: "50%", transform: "translateY(-50%)",
                          height: remDe(16), borderRadius: 2,
                          background: a.feita ? "rgba(13,13,13,.12)" : pill.bar,
                          opacity: a.feita ? 0.5 : draggingId === a.id ? 0.85 : 1,
                          boxShadow: draggingId === a.id ? "0 0 0 2px rgba(13,13,13,.18)" : "none",
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
                                <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded border border-black/[.08] bg-white px-2 py-1 text-[0.5625rem] font-medium text-black/60 shadow-sm">
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
  id, nome, tipo, prioridade, data_inicio, data_prevista, data_realizada, hora_inicio, hora_fim, resultado, feita, nota, responsavel_id, captacao_id, conta_patrocinio_id, sync_origin,
  responsavel:profiles!responsavel_id(id, full_name, avatar_url),
  tipo_custom:atividade_tipos!tipo_custom_id(nome, icone, cor),
  empresa_crm:empresas_crm!empresa_crm_id(nome), empresa_crm_id,
  projeto:projetos_crm!projeto_id(nome),
  captador:captadores!captador_id(nome, agencia),
  proponente:proponentes!proponente_id(nome), proponente_id,
  captacao:captacoes!captacao_id(titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)),
  contato:contatos!contato_id(nome, email, telefone)
`;

const FOLLOWUP_SELECT_FIELDS = `
  id, titulo, motivo, canal, previsto_para, concluido_em, resultado, status,
  responsavel_id, captacao_id, empresa_crm_id, conta_patrocinio_id, proponente_id,
  responsavel:profiles!responsavel_id(id, full_name, avatar_url),
  empresa_crm:empresas_crm!empresa_crm_id(nome),
  conta_patrocinio:contas_patrocinio!conta_patrocinio_id(nome),
  proponente:proponentes!proponente_id(nome),
  captacao:captacoes!captacao_id(titulo, projeto:projetos_crm!projeto_id(nome), empresa_crm:empresas_crm!empresa_crm_id(nome), empresa:empresas!empresa_id(nome)),
  contato:contatos!contato_id(nome)
`;

const WORKSPACE_SELECT_FIELDS = `
  id, atribuicao_id, descricao, prazo, status, resolvido_em,
  atribuicao:atribuicoes!atribuicao_id(captador_user_id, empresa_crm_id, empresa_crm:empresas_crm!empresa_crm_id(nome))
`;

export default function AtividadesPage() {
  const router = useRouter();
  const supabase = createClient();
  const responsavel = useFiltroResponsavel(useOrganizationId());

  const [atividades,    setAtividades]       = useState<AtividadeRow[]>([]);
  const [allAtividades, setAllAtividades]    = useState<AtividadeRow[]>([]);
  const [loading,       setLoading]          = useState(true);
  const [loadingAll,    setLoadingAll]       = useState(false);
  const [tab,           setTab]              = useState<Tab>("pendentes");
  const [tipoFilter,    setTipoFilter]       = useState<TipoFilter>("todos");
  // A página sempre abre no calendário, na semana; trocar de visualização vale só enquanto ela está aberta.
  const [viewMode, setViewMode] = useState<ViewMode>("calendario");
  const [showNovaAtividade, setShowNovaAtividade] = useState(false);
  const [novaPrefill,       setNovaPrefill]       = useState<{ date: string; hora?: string } | undefined>(undefined);
  const [editingId,         setEditingId]         = useState<string | null>(null);
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [completingActivity, setCompletingActivity] = useState<AtividadeRow | null>(null);
  const [managingFollowup, setManagingFollowup] = useState<AtividadeRow | null>(null);

  /* ── Lista fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = (supabase as any).from("atividades").select(SELECT_FIELDS);
    const followupQuery = (supabase as any).from("crm_followups").select(FOLLOWUP_SELECT_FIELDS);
    const workspaceQuery = (supabase as any).from("workspace_acoes").select(WORKSPACE_SELECT_FIELDS).eq("destinatario", "organizacao");
    const [activityResult, followupResult, workspaceResult] = await Promise.all([
      tab === "pendentes"
        ? q.eq("feita", false).order("data_prevista", { ascending: true, nullsFirst: false })
        : q.eq("feita", true).order("data_realizada", { ascending: false, nullsFirst: false }).limit(100),
      tab === "pendentes"
        ? followupQuery.eq("status", "pendente").order("previsto_para", { ascending: true })
        : followupQuery.in("status", ["concluido", "cancelado"]).order("concluido_em", { ascending: false, nullsFirst: false }).limit(100),
      tab === "pendentes" ? workspaceQuery.neq("status", "resolvida") : workspaceQuery.eq("status", "resolvida").limit(100),
    ]);
    if (!activityResult.error && !followupResult.error) {
      setAtividades([...(activityResult.data as AtividadeRow[] ?? []), ...followupsToActivities(followupResult.data ?? []), ...workspaceRequestsToActivities(workspaceResult.error ? [] : workspaceResult.data ?? [])]
        .sort((a, b) => String(scheduledDate(a) ?? "9999").localeCompare(String(scheduledDate(b) ?? "9999"))));
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ── Calendar / Gantt fetch ── */
  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    const [activityResult, followupResult, workspaceResult] = await Promise.all([
      (supabase as any).from("atividades").select(SELECT_FIELDS).order("data_prevista", { ascending: true, nullsFirst: false }),
      (supabase as any).from("crm_followups").select(FOLLOWUP_SELECT_FIELDS).order("previsto_para", { ascending: true }),
      (supabase as any).from("workspace_acoes").select(WORKSPACE_SELECT_FIELDS).eq("destinatario", "organizacao"),
    ]);
    if (!activityResult.error && !followupResult.error) {
      setAllAtividades([...(activityResult.data as AtividadeRow[] ?? []), ...followupsToActivities(followupResult.data ?? []), ...workspaceRequestsToActivities(workspaceResult.error ? [] : workspaceResult.data ?? [])]);
    }
    setLoadingAll(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // /atividades?novo=1 (vindo dos primeiros passos) abre o cadastro direto.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") !== "1") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowNovaAtividade(true);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (viewMode !== "lista") fetchAll(); }, [viewMode, fetchAll]);

  async function toggleFeita(id: string, current: boolean) {
    if (savingActivityId) return;
    const agendaItem = [...atividades, ...allAtividades].find(item => item.id === id);
    if (agendaItem?.source_kind === "workspace") {
      if (agendaItem.source_link) router.push(agendaItem.source_link);
      return;
    }
    if (agendaItem?.source_kind === "followup") {
      setManagingFollowup(agendaItem);
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
    if (agendaItem?.source_kind === "workspace") {
      if (agendaItem.source_link) router.push(agendaItem.source_link);
      return false;
    }
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

  // Arrastar ou puxar as bordas no calendário: muda o dia (o início anda junto) e o horário.
  // Sem hora (inicio nulo): só o dia muda. Atividade vinda do Google Agenda/Outlook muda o evento lá também.
  async function reagendarAtividade(id: string, { data, inicio, fim }: { data: string; inicio: number | null; fim: number | null }) {
    setToggleError(null);
    const item = allAtividades.find(atividade => atividade.id === id);
    if (!item || (item.source_kind && item.source_kind !== "atividade")) return;
    const diaAnterior = scheduledDate(item) ? normDate(scheduledDate(item)!) : data;
    const deslocamento = diasEntreIso(diaAnterior, data);
    const mudanca = {
      data_prevista: data,
      data_inicio: item.data_inicio ? somarDiasIso(normDate(item.data_inicio), deslocamento) : null,
      hora_inicio: inicio === null ? null : horaDe(inicio),
      hora_fim: fim === null ? null : horaDe(fim),
    };
    const anteriores = allAtividades;
    setAllAtividades(atuais => atuais.map(atividade => atividade.id === id ? { ...atividade, ...mudanca } : atividade));
    let falha: string | null = null;
    if (item.sync_origin === "google" || item.sync_origin === "microsoft") {
      const resposta = await fetch("/api/calendar/mover-evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atividadeId: id, ...mudanca }),
      }).catch(() => null);
      if (!resposta?.ok) falha = (await resposta?.json().catch(() => null) as { error?: string } | null)?.error ?? "Não foi possível falar com a agenda agora.";
    } else {
      const { error } = await (supabase as any).from("atividades").update(mudanca).eq("id", id);
      if (error) falha = error.message;
    }
    if (falha) {
      setAllAtividades(anteriores);
      setToggleError(`A atividade não foi reagendada. ${falha}`);
      return;
    }
    setAtividades(atuais => atuais.map(atividade => atividade.id === id ? { ...atividade, ...mudanca } : atividade));
  }

  async function updateActivityResponsible(id: string, responsavelId: string | null, responsavelName: string | null, avatarUrl: string | null): Promise<boolean> {
    setToggleError(null);
    const previous = allAtividades;
    const agendaItem = previous.find(item => item.id === id);
    if (!agendaItem) return false;
    if (agendaItem.source_kind === "workspace") {
      if (agendaItem.source_link) router.push(agendaItem.source_link);
      return false;
    }

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
    if (item?.source_kind === "workspace") {
      if (item.source_link) router.push(item.source_link);
      return;
    }
    if (item?.source_kind === "followup") {
      setManagingFollowup(item);
      return;
    }
    setEditingId(id);
  }

  function changeView(v: ViewMode) {
    setViewMode(v);
  }

  // O filtro por responsável vale para a lista, o calendário, o Gantt e a carga da equipe.
  const doResponsavel = atividades.filter(a => responsavel.casa([a.responsavel_id]));
  const todasDoResponsavel = allAtividades.filter(a => responsavel.casa([a.responsavel_id]));
  const filtered = tipoFilter === "todos" ? doResponsavel : doResponsavel.filter(a => a.tipo === tipoFilter);
  const atrasadas = doResponsavel.filter(a => !a.feita && getGroup(a.data_prevista) === "atrasadas").length;
  const hoje      = doResponsavel.filter(a => !a.feita && getGroup(a.data_prevista) === "hoje").length;

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
    <div className="px-4 py-6 md:px-8 md:py-8">
      {showNovaAtividade && (
        <NovaAtividadeModal
          onClose={() => { setShowNovaAtividade(false); setNovaPrefill(undefined); }}
          onSaved={() => { fetchData(); if (viewMode !== "lista") fetchAll(); }}
          prefill={novaPrefill}
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
      {managingFollowup?.source_id && (
        <GerenciarFollowupModal
          followup={{
            id: managingFollowup.source_id,
            titulo: managingFollowup.nome,
            status: managingFollowup.source_status ?? "pendente",
            previstoPara: managingFollowup.data_prevista,
            sourceLink: managingFollowup.source_link,
          }}
          onClose={() => setManagingFollowup(null)}
          onChanged={() => {
            setManagingFollowup(null);
            void fetchData();
            if (viewMode !== "lista") void fetchAll();
          }}
        />
      )}

      {/* Header — mesma tipografia do ListPageHeader; a página rola inteira */}
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[.14em] text-black/30">Rotina comercial</p>
          <h1 className="mt-1 text-[1.75rem] font-bold tracking-[-.025em] text-[#282525]">Atividades</h1>
        </div>
        <PrimaryListAction onClick={() => setShowNovaAtividade(true)}><Plus size={13} aria-hidden="true" /> Nova atividade</PrimaryListAction>
      </div>

      {/* Stats (only lista + pendentes) */}
      {viewMode === "lista" && !loading && tab === "pendentes" && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border text-sm" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <span className={`font-semibold tabular-nums text-[0.9375rem] ${filtered.length ? "text-[#282525]" : "text-black/30"}`}>{filtered.length}</span>
            <span className="text-black/40 text-xs">pendentes</span>
          </div>
          {atrasadas > 0 && (
            <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <AlertCircle size={13} aria-hidden="true" className="text-[#D94E4E] flex-shrink-0" />
              <span className="font-semibold tabular-nums text-[#282525] text-[0.9375rem]">{atrasadas}</span>
              <span className="text-black/40 text-xs">atrasadas</span>
            </div>
          )}
          {hoje > 0 && (
            <div className="flex items-center gap-2 bg-white rounded px-4 py-2.5 border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <Clock size={13} aria-hidden="true" className="text-[#B07A14] flex-shrink-0" />
              <span className="font-semibold tabular-nums text-[#282525] text-[0.9375rem]">{hoje}</span>
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

        <FiltroResponsavel membros={responsavel.membros} meuId={responsavel.meuId} value={responsavel.filtro} onChange={responsavel.setFiltro} />

        {tipoFilter !== "todos" && (
          <FilterButton onClick={() => setTipoFilter("todos")}>
            <X size={12} /> Limpar
          </FilterButton>
        )}
      </div>

      {toggleError && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded border border-[#D94E4E]/25 bg-white px-4 py-3 text-[0.6875rem] text-[#D94E4E]">
          <span>{toggleError}</span>
          <button type="button" onClick={() => setToggleError(null)} className="font-medium hover:opacity-70">Fechar</button>
        </div>
      )}

      {/* Etiqueta estrutural: Lista CRM — atividades em lista, calendário ou Gantt */}

      {viewMode === "calendario" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando…</p>
            </div>
          : <CalendarioView atividades={todasDoResponsavel} tipoFilter={tipoFilter} onEdit={openAgendaItem} onNew={(date, hora) => { setNovaPrefill({ date, hora }); setShowNovaAtividade(true); }} onReagendar={reagendarAtividade} />
      )}

      {viewMode === "gantt" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando…</p>
            </div>
          : <GanttView
              atividades={todasDoResponsavel}
              tipoFilter={tipoFilter}
              onEdit={openAgendaItem}
              onDatesChange={updateActivityDates}
            />
      )}

      {viewMode === "carga" && (
        loadingAll
          ? <div className="bg-white rounded border py-20 text-center" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-xs text-black/30">Carregando…</p>
            </div>
          : <CargaEquipeView atividades={todasDoResponsavel} tipoFilter={tipoFilter} onEdit={openAgendaItem} onReassign={updateActivityResponsible} />
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
  // A data fica neutra; atrasada e hoje só colorem o ícone de alerta.
  const due = (a: AtividadeRow): { tom: string; label: string; alerta: { cor: string; rotulo: string } | null } => {
    if (a.feita) return { tom: "text-black/35", label: fmtDate(a.data_realizada), alerta: null };
    if (!a.data_prevista) return { tom: "text-black/25", label: "Sem data", alerta: null };
    const group = getGroup(a.data_prevista);
    const alerta = group === "atrasadas" ? { cor: "#D94A4A", rotulo: "Atrasada" } : group === "hoje" ? { cor: "#B07A14", rotulo: "Vence hoje" } : null;
    return { tom: "text-black/50", label: fmtDate(a.data_prevista), alerta };
  };
  const Header = ({ label, column }: { label: string; column?: ActivitySortKey }) => <button type="button" disabled={!column} onClick={() => column && changeSort(column)} className="flex items-center gap-1 whitespace-nowrap text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/35 disabled:cursor-default">{label}{column && <ArrowUpDown size={10} className={sortKey === column ? "text-[#7259B5]" : "text-black/20"} />}</button>;

  return <div className="-mr-4 rounded rounded-r-none border border-r-0 bg-white md:-mr-8" style={{ borderColor: "rgba(13,13,13,.08)" }}><ManagedTable storageKey="atividades" definitions={ATIVIDADES_COLUMNS} className="w-full border-collapse text-sm">
    <thead className="sticky top-0 z-20 bg-[#F9F9F8]"><tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <th className="bg-[#F9F9F8] px-4 py-3 text-left"><Header label="Concluída" /></th>
      <th className="bg-[#F9F9F8] px-4 py-3 text-left"><Header label="Atividade" column="nome" /></th>
      <th className="w-[11.875rem] px-4 py-3 text-left"><Header label="Negociação" /></th><th className="w-[13.75rem] px-4 py-3 text-left"><Header label="Empresa / contato" /></th>
      <th className="w-[7.5rem] px-4 py-3 text-left"><Header label="Prazo" column="prazo" /></th><th className="w-[6.5625rem] px-4 py-3 text-left"><Header label="Duração" /></th>
      <th className="w-[6.875rem] px-4 py-3 text-left"><Header label="Prioridade" column="prioridade" /></th><th className="w-[10rem] px-4 py-3 text-left"><Header label="Responsável" column="responsavel" /></th>
      <th className="w-[9.375rem] px-4 py-3 text-left"><Header label="Resultado" column="resultado" /></th><th className="w-[10.625rem] px-4 py-3 text-left"><Header label="Projeto" /></th>
      <th className="w-[13.75rem] px-4 py-3 text-left"><Header label="Observação" /></th>
    </tr></thead>
    <tbody>{loading ? Array.from({ length: 7 }).map((_, i) => <tr key={i} className="border-b" style={{ borderColor: "rgba(13,13,13,.045)" }}><td colSpan={12} className="px-4 py-4"><div className="h-3.5 w-2/3 animate-pulse rounded bg-black/[.06]" /></td></tr>) : sorted.length === 0 ? <tr><td colSpan={12} className="px-5 py-20 text-center"><CheckCheck size={28} className="mx-auto mb-2 text-black/15" /><p className="text-sm font-medium text-black/30">{tab === "pendentes" ? "Nenhuma atividade pendente" : "Nenhuma atividade concluída"}</p></td></tr> : sorted.map(a => {
      const tc = typeConfigFor(a); const Icon = tc.Icon; const deadline = due(a);
      return <tr key={a.id} className="group border-b last:border-b-0 hover:bg-black/[.018] cursor-pointer" style={{ borderColor: "rgba(13,13,13,.045)" }} onClick={() => onEdit(a.id)}>
        <td className="cursor-default bg-white px-4 py-3 text-left group-hover:bg-[#FBFBFA]" onClick={e => e.stopPropagation()}><button type="button" aria-label={a.feita ? `Reabrir “${a.nome}”` : `Concluir “${a.nome}”`} aria-pressed={a.feita} onClick={() => void onToggle(a.id, a.feita)} disabled={savingActivityId === a.id} className="inline-flex cursor-pointer text-black/20 transition hover:text-black/55 disabled:opacity-40 disabled:cursor-not-allowed">{savingActivityId === a.id ? <Clock size={17} className="animate-pulse text-[#7259B5]" /> : a.feita ? <CheckCircle2 size={17} className="text-[#2E8932]" /> : <Circle size={17} />}</button></td>
        <td className="bg-white px-4 py-3 group-hover:bg-[#FBFBFA]"><div className="flex w-full items-center gap-2.5 text-left"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded" style={{ color: tc.color }}><Icon size={13} /></span><span className="min-w-0"><span className={`block break-words text-[0.78125rem] font-semibold leading-snug ${a.feita ? "text-black/30 line-through" : "text-black/75"}`}>{a.nome}</span><span className="mt-0.5 block text-[0.625rem] text-black/30">{tc.label}</span></span></div></td>
        <td className="px-4 py-3"><span className="block min-w-0 break-words text-[0.6875rem] font-medium text-black/55">{captacaoLabel(a)}</span></td>
        <td className="px-4 py-3"><div><span className="block min-w-0 break-words text-[0.6875rem] font-medium text-black/60">{a.contato?.nome ?? a.empresa_crm?.nome ?? "—"}</span>{a.contato?.email && <span className="mt-0.5 block min-w-0 break-words text-[0.59375rem] text-black/30">{a.contato.email}</span>}{a.contato?.telefone && <span className="block text-[0.59375rem] text-black/25">{a.contato.telefone}</span>}</div></td>
        <td className="px-4 py-3"><span className={`flex items-center gap-1 whitespace-nowrap text-[0.6875rem] font-medium tabular-nums ${deadline.tom}`}>{deadline.alerta && <Clock size={12} strokeWidth={1.75} role="img" aria-label={deadline.alerta.rotulo} className="shrink-0" style={{ color: deadline.alerta.cor }} />}{deadline.label}</span>{a.hora_inicio && <span className="mt-0.5 block text-[0.59375rem] text-black/25">{a.hora_inicio.slice(0,5)}{a.hora_fim ? ` — ${a.hora_fim.slice(0,5)}` : ""}</span>}</td>
        <td className="px-4 py-3 text-[0.6875rem] tabular-nums text-black/40">{duration(a)}</td><td className="px-4 py-3"><PrioBadge prio={a.prioridade} size="sm" /></td>
        <td className="px-4 py-3">{a.responsavel?.full_name ? <span className="text-[0.6875rem] font-medium text-black/55">{a.responsavel.full_name}</span> : <span className="flex items-center gap-1 whitespace-nowrap text-[0.6875rem] font-medium text-black/35"><UserX size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#B07A14]" />Sem responsável</span>}</td>
        <td className="px-4 py-3"><span className="block max-w-[8.4375rem] truncate text-[0.6875rem] text-black/45">{a.resultado || "—"}</span></td><td className="px-4 py-3"><span className="block min-w-0 break-words text-[0.6875rem] text-black/45">{a.projeto?.nome ?? a.captacao?.projeto?.nome ?? "—"}</span></td>
        <td className="px-4 py-3"><span className="block max-w-[12.8125rem] truncate text-[0.65625rem] text-black/35" title={a.nota ?? undefined}>{a.nota || "—"}</span></td>
      </tr>;
    })}</tbody>
  </ManagedTable></div>;
}
