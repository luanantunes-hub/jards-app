"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileText,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/FilterControls";

type NotificationItem = {
  id: string;
  tipo: string;
  event_key: string | null;
  categoria: string;
  prioridade: "baixa" | "normal" | "alta" | "critica";
  titulo: string;
  mensagem: string;
  lida: boolean;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  dados: Record<string, unknown>;
  lida_em: string | null;
  arquivada_em: string | null;
  adiada_ate: string | null;
  created_at: string;
};

type Filter = "todas" | "nao_lidas";
type DateGroup = "Hoje" | "Esta semana" | "Anteriores";

const V2_FIELDS = "id, tipo, event_key, categoria, prioridade, titulo, mensagem, lida, link, entity_type, entity_id, dados, lida_em, arquivada_em, adiada_ate, created_at";
const LEGACY_FIELDS = "id, tipo, titulo, mensagem, lida, link, created_at";

const CATEGORY_LABELS: Record<string, string> = {
  atividades: "Atividades",
  editais: "Editais",
  propostas: "Propostas",
  patrocinadores: "Patrocinadores",
  integracoes: "Integrações",
  sistema: "Sistema",
};

function normalize(value: Record<string, unknown>): NotificationItem {
  const priority = value.prioridade;
  return {
    id: String(value.id),
    tipo: String(value.tipo ?? "sistema"),
    event_key: typeof value.event_key === "string" ? value.event_key : null,
    categoria: typeof value.categoria === "string" ? value.categoria : "sistema",
    prioridade: priority === "baixa" || priority === "alta" || priority === "critica" ? priority : "normal",
    titulo: String(value.titulo ?? "Nova notificação"),
    mensagem: String(value.mensagem ?? ""),
    lida: Boolean(value.lida),
    link: typeof value.link === "string" ? value.link : null,
    entity_type: typeof value.entity_type === "string" ? value.entity_type : null,
    entity_id: typeof value.entity_id === "string" ? value.entity_id : null,
    dados: value.dados && typeof value.dados === "object" ? value.dados as Record<string, unknown> : {},
    lida_em: typeof value.lida_em === "string" ? value.lida_em : null,
    arquivada_em: typeof value.arquivada_em === "string" ? value.arquivada_em : null,
    adiada_ate: typeof value.adiada_ate === "string" ? value.adiada_ate : null,
    created_at: String(value.created_at ?? new Date().toISOString()),
  };
}

function iconFor(notification: NotificationItem) {
  const key = notification.event_key ?? notification.tipo;
  if (key.includes("calendario")) return AlertTriangle;
  if (key.includes("followup")) return CalendarClock;
  if (key.includes("atividade") || key.includes("prazo")) return CalendarClock;
  if (key.includes("proposta") || key.includes("edital")) return FileText;
  if (key.includes("pesquisa")) return Search;
  if (key.includes("concluida")) return Check;
  return Bell;
}

function dateGroup(date: string): DateGroup {
  const current = new Date();
  const today = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  const value = new Date(date);
  const itemDay = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const diff = Math.floor((today.getTime() - itemDay.getTime()) / 86400000);
  if (diff <= 0) return "Hoje";
  if (diff <= 7) return "Esta semana";
  return "Anteriores";
}

function formatTime(date: string) {
  const value = new Date(date);
  if (dateGroup(date) === "Hoje") {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(value);
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(value);
}

export default function NotificacoesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<Filter>("todas");
  const [category, setCategory] = useState("todas");
  const [migrationReady, setMigrationReady] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (knownUserId?: string) => {
    const supabase = createClient();
    let id = knownUserId ?? userId;
    if (!id) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      id = user.id;
      setUserId(id);
    }

    const now = new Date().toISOString();
    let result = await supabase
      .from("notificacoes")
      .select(V2_FIELDS)
      .eq("user_id", id)
      .is("arquivada_em", null)
      .or(`adiada_ate.is.null,adiada_ate.lte.${now}`)
      .order("created_at", { ascending: false })
      .limit(150);

    if (result.error) {
      setMigrationReady(false);
      result = await supabase
        .from("notificacoes")
        .select(LEGACY_FIELDS)
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(150);
    } else {
      setMigrationReady(true);
    }

    if (result.error) setError("Não foi possível carregar as notificações.");
    else {
      setItems((result.data ?? []).map((row: Record<string, unknown>) => normalize(row)));
      setError(null);
    }
    setLoading(false);
  }, [router, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`notification-center:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => load(userId),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, userId]);

  const unread = items.filter(item => !item.lida).length;
  const categories = useMemo(() => Array.from(new Set(items.map(item => item.categoria))), [items]);
  const filtered = useMemo(() => items.filter(item => {
    if (filter === "nao_lidas" && item.lida) return false;
    return category === "todas" || item.categoria === category;
  }), [items, filter, category]);

  const grouped = useMemo(() => {
    const result: Record<DateGroup, NotificationItem[]> = { Hoje: [], "Esta semana": [], Anteriores: [] };
    filtered.forEach(item => result[dateGroup(item.created_at)].push(item));
    return result;
  }, [filtered]);

  async function updateNotification(id: string, patch: Record<string, unknown>) {
    const supabase = createClient();
    // O schema manual do cliente ainda não infere updates desta migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("notificacoes") as any).update(patch).eq("id", id);
    if (updateError) {
      setError("A alteração não foi salva. Confirme se a migration de notificações foi aplicada.");
      return false;
    }
    return true;
  }

  async function markRead(item: NotificationItem) {
    if (item.lida) return true;
    const ok = await updateNotification(item.id, { lida: true });
    if (ok) setItems(current => current.map(value => value.id === item.id ? { ...value, lida: true, lida_em: new Date().toISOString() } : value));
    return ok;
  }

  async function markAllRead() {
    if (!userId) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("notificacoes") as any)
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
    if (updateError) setError("Não foi possível marcar todas como lidas.");
    else setItems(current => current.map(item => ({ ...item, lida: true, lida_em: new Date().toISOString() })));
  }

  async function archive(item: NotificationItem) {
    const ok = await updateNotification(item.id, { arquivada_em: new Date().toISOString(), lida: true });
    if (ok) setItems(current => current.filter(value => value.id !== item.id));
  }

  async function snooze(item: NotificationItem) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    const ok = await updateNotification(item.id, { adiada_ate: tomorrow.toISOString(), lida: true });
    if (ok) setItems(current => current.filter(value => value.id !== item.id));
  }

  async function openNotification(item: NotificationItem) {
    const ok = await markRead(item);
    if (ok && item.link) router.push(item.link);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse px-4 py-6 md:px-8 md:py-8" aria-busy="true" aria-label="Carregando notificações">
        <div className="h-3 w-24 rounded bg-black/[.06]" />
        <div className="mt-2 h-7 w-48 rounded bg-black/[.06]" />
        <div className="mt-8 space-y-2">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[76px] rounded border border-black/[.06] bg-black/[.02]" />)}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between sm:gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/30">Central</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-[-.025em] text-[#0D0D0D]">Notificações</h1>
          <p className="mt-1 text-[13px] text-black/40">
            {unread > 0 ? `${unread} não lida${unread === 1 ? "" : "s"}` : "Tudo em dia"}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-2 rounded border border-[#7259B5] bg-white px-3 py-2 text-[12px] font-semibold text-[#7259B5] transition hover:bg-black/[.04]"
          >
            <CheckCheck size={13} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {!migrationReady && (
        <div className="mt-6 rounded border border-[#B07A14]/20 bg-[#B07A14]/[.05] px-4 py-3 text-[11px] text-[#805A12]">
          A central está em modo compatível. Aplique a migration Notification Inbox v2 para ativar prioridade, arquivo, adiamento e novos eventos.
        </div>
      )}
      {error && <div className="mt-6 rounded border border-[#D94E4E]/20 bg-[#D94E4E]/[.05] px-4 py-3 text-[11px] text-[#A33A3A]">{error}</div>}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] pb-3">
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          ariaLabel="Filtrar notificações"
          options={[{ value: "todas", label: "Todas" }, { value: "nao_lidas", label: "Não lidas" }] as { value: Filter; label: string }[]}
        />
        {categories.length > 1 && (
          <Select
            block={false}
            aria-label="Filtrar por módulo"
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="rounded border border-black/[.12] bg-white px-2.5 py-1.5 text-[11px] font-medium text-black/55 outline-none focus:border-[#7259B5]/50"
          >
            <option value="todas">Todos os módulos</option>
            {categories.map(value => <option key={value} value={value}>{CATEGORY_LABELS[value] ?? value}</option>)}
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/[.035]"><Bell size={22} className="text-black/18" /></span>
          <p className="text-[14px] font-semibold text-black/45">Nenhuma notificação</p>
        </div>
      ) : (
        <div className="mt-7 space-y-8">
          {(["Hoje", "Esta semana", "Anteriores"] as DateGroup[]).map(group => grouped[group].length > 0 && (
            <section key={group}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[.08em] text-black/35">{group}</h2>
                <span className="text-[10px] text-black/25">{grouped[group].length}</span>
              </div>
              <div className="overflow-hidden rounded border border-black/[.08] bg-white">
                {grouped[group].map((item, index) => {
                  const Icon = iconFor(item);
                  const critical = item.prioridade === "critica";
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openNotification(item)}
                      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") openNotification(item); }}
                      className="group flex cursor-pointer items-start gap-3 px-4 py-4 outline-none transition hover:bg-black/[.02] focus-visible:bg-black/[.03]"
                      style={{
                        borderBottom: index < grouped[group].length - 1 ? "1px solid rgba(13,13,13,.055)" : undefined,
                        background: item.lida ? "#FFFFFF" : critical ? "rgba(217,78,78,.025)" : "rgba(114,89,181,.02)",
                      }}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded" style={{ background: critical ? "rgba(217,78,78,.09)" : "rgba(114,89,181,.08)" }}>
                        <Icon size={15} style={{ color: critical ? "#B83E3E" : "#7259B5" }} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-black/80">{item.titulo}</p>
                          {!item.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7259B5]" />}
                          {critical && <span className="rounded bg-[#D94E4E]/[.09] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#A33A3A]">Crítica</span>}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-5 text-black/48">{item.mensagem}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-black/28">
                          <span>{CATEGORY_LABELS[item.categoria] ?? item.categoria}</span><span>·</span><span>{formatTime(item.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                        {migrationReady && (
                          <>
                            <button
                              type="button"
                              title="Lembrar amanhã às 8h"
                              aria-label="Lembrar amanhã às 8h"
                              onClick={event => { event.stopPropagation(); snooze(item); }}
                              className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60"
                            ><Clock3 size={13} /></button>
                            <button
                              type="button"
                              title="Arquivar"
                              aria-label="Arquivar"
                              onClick={event => { event.stopPropagation(); archive(item); }}
                              className="flex h-7 w-7 items-center justify-center rounded text-black/30 transition hover:bg-black/[.05] hover:text-black/60"
                            ><Archive size={13} /></button>
                          </>
                        )}
                        {item.link && <ChevronRight size={14} className="ml-1 text-black/20" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
