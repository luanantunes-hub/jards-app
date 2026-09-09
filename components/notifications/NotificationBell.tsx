"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  FileText,
  Search,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NotificationPreview = {
  id: string;
  tipo: string;
  event_key: string | null;
  categoria: string | null;
  prioridade: string | null;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  arquivada_em: string | null;
  adiada_ate: string | null;
  created_at: string;
};

const V2_FIELDS = "id, tipo, event_key, categoria, prioridade, titulo, mensagem, link, lida, arquivada_em, adiada_ate, created_at";
const LEGACY_FIELDS = "id, tipo, titulo, mensagem, link, lida, created_at";

function normalizeNotification(value: Record<string, unknown>): NotificationPreview {
  return {
    id: String(value.id),
    tipo: String(value.tipo ?? "sistema"),
    event_key: typeof value.event_key === "string" ? value.event_key : null,
    categoria: typeof value.categoria === "string" ? value.categoria : "sistema",
    prioridade: typeof value.prioridade === "string" ? value.prioridade : "normal",
    titulo: String(value.titulo ?? "Nova notificação"),
    mensagem: String(value.mensagem ?? ""),
    link: typeof value.link === "string" ? value.link : null,
    lida: Boolean(value.lida),
    arquivada_em: typeof value.arquivada_em === "string" ? value.arquivada_em : null,
    adiada_ate: typeof value.adiada_ate === "string" ? value.adiada_ate : null,
    created_at: String(value.created_at ?? new Date().toISOString()),
  };
}

function iconFor(notification: NotificationPreview) {
  const key = notification.event_key ?? notification.tipo;
  if (key.includes("calendario")) return AlertTriangle;
  if (key.includes("followup")) return CalendarClock;
  if (key.includes("prazo") || key.includes("atividade")) return CalendarClock;
  if (key.includes("proposta") || key.includes("edital")) return FileText;
  if (key.includes("pesquisa")) return Search;
  if (key.includes("concluida")) return Check;
  return Bell;
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationPreview[]>([]);

  const load = useCallback(async () => {
    const supabase = createClient();
    const now = new Date().toISOString();
    let result = await supabase
      .from("notificacoes")
      .select(V2_FIELDS)
      .eq("user_id", userId)
      .is("arquivada_em", null)
      .or(`adiada_ate.is.null,adiada_ate.lte.${now}`)
      .order("created_at", { ascending: false })
      .limit(6);

    // A interface continua funcional enquanto a migration v2 não foi aplicada.
    if (result.error) {
      result = await supabase
        .from("notificacoes")
        .select(LEGACY_FIELDS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
    }

    const next = (result.data ?? []).map((row: Record<string, unknown>) => normalizeNotification(row));
    setItems(next);

    let countResult = await supabase
      .from("notificacoes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lida", false)
      .is("arquivada_em", null)
      .or(`adiada_ate.is.null,adiada_ate.lte.${now}`);
    if (countResult.error) {
      countResult = await supabase
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("lida", false);
    }
    setUnreadCount(countResult.count ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, userId]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function markRead(notification: NotificationPreview) {
    if (notification.lida) return;
    const supabase = createClient();
    // O schema manual do cliente ainda não infere updates desta migration.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notificacoes") as any).update({ lida: true }).eq("id", notification.id);
    setItems(current => current.map(item => item.id === notification.id ? { ...item, lida: true } : item));
    setUnreadCount(current => Math.max(0, current - 1));
  }

  async function markAllRead() {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("notificacoes") as any)
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
    setItems(current => current.map(item => ({ ...item, lida: true })));
    setUnreadCount(0);
  }

  async function openNotification(notification: NotificationPreview) {
    await markRead(notification);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/35"
      >
        <Bell size={16} className="text-black/45" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D94E4E] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[360px] overflow-hidden rounded border border-black/[.10] bg-white shadow-[0_16px_40px_rgba(13,13,13,.12)]">
          <div className="flex items-center justify-between border-b border-black/[.07] px-4 py-3">
            <div>
              <p className="text-[13px] font-bold text-black">Notificações</p>
              <p className="mt-0.5 text-[10px] text-black/35">
                {unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1.5 text-[10px] font-semibold text-[#7259B5] hover:text-[#5E469B]">
                <CheckCheck size={12} /> Marcar como lidas
              </button>
            )}
          </div>

          <div className="max-h-[390px] overflow-y-auto">
            {loading ? (
              <div className="flex h-28 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-black/50" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCheck size={22} className="mb-2 text-black/15" />
                <p className="text-[12px] font-semibold text-black/45">Nenhuma pendência nova</p>
              </div>
            ) : items.map(notification => {
              const Icon = iconFor(notification);
              const critical = notification.prioridade === "critica";
              return (
                <button
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className="flex w-full items-start gap-3 border-b border-black/[.055] px-4 py-3 text-left transition last:border-0 hover:bg-black/[.025]"
                  style={{ background: notification.lida ? "#FFFFFF" : critical ? "rgba(217,78,78,.035)" : "rgba(114,89,181,.028)" }}
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded"
                    style={{ background: critical ? "rgba(217,78,78,.09)" : "rgba(114,89,181,.08)" }}
                  >
                    <Icon size={14} style={{ color: critical ? "#B83E3E" : "#7259B5" }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-semibold text-black/80">{notification.titulo}</span>
                      {!notification.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7259B5]" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-black/45">{notification.mensagem}</span>
                    <span className="mt-1 block text-[9px] text-black/28">{relativeTime(notification.created_at)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); router.push("/notificacoes"); }}
            className="w-full border-t border-black/[.07] bg-white px-4 py-3 text-center text-[11px] font-semibold text-[#7259B5] transition hover:bg-black/[.025]"
          >
            Ver todas as notificações
          </button>
        </div>
      )}
    </div>
  );
}
