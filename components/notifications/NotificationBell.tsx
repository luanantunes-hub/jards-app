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
import { notificacaoDoModulo, type ModuloDeNotificacao } from "@/lib/notificacoes-modulo";

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

type UrgentEditalRow = {
  id: string;
  data_fechamento: string | null;
  empresas: { nome: string } | null;
};

const DISMISSED_EDITAIS_KEY = "jards:notificacoes:editais-prazo-lidos";

function readDismissedEditalIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_EDITAIS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissedEditalIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_EDITAIS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage indisponível (modo privado, quota) — degrade silenciosamente
  }
}

function isEditalPrazoId(id: string) {
  return id.startsWith("edital-prazo:");
}

function diasRestantesEdital(fechamento: string | null): number {
  if (!fechamento) return 9999;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(fechamento + "T00:00:00");
  return Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDateShort(fechamento: string | null): string {
  if (!fechamento) return "—";
  const [, m, d] = fechamento.split("-");
  return `${d}/${m}`;
}

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

/** Com `modulo`, o sino mostra só as notificações desse módulo (sem os editais com prazo perto, que são da captação). */
export function NotificationBell({ userId, modulo }: { userId: string; modulo?: ModuloDeNotificacao }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationPreview[]>([]);
  const dismissedEditalIdsRef = useRef<Set<string>>(readDismissedEditalIds());
  const naoLidasDoModuloRef = useRef<string[]>([]);

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
      .limit(modulo ? 100 : 6);

    // A interface continua funcional enquanto a migration v2 não foi aplicada.
    if (result.error) {
      result = await supabase
        .from("notificacoes")
        .select(LEGACY_FIELDS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(modulo ? 100 : 6);
    }

    const todasAsReais = (result.data ?? []).map((row: Record<string, unknown>) => normalizeNotification(row));
    const realItems = modulo ? todasAsReais.filter(n => notificacaoDoModulo(n, modulo)) : todasAsReais;
    naoLidasDoModuloRef.current = realItems.filter(n => !n.lida).map(n => n.id);

    // Editais com prazo de fechamento perto (<=14 dias) entram na mesma lista,
    // como itens sintéticos — não existe linha em `notificacoes` para eles.
    const { data: editaisData } = modulo ? { data: [] } : await supabase
      .from("editais")
      .select("id, data_fechamento, empresas(nome)")
      .eq("ativo", true)
      .limit(500);

    const urgentEditais = ((editaisData ?? []) as unknown as UrgentEditalRow[])
      .filter((e) => {
        const dias = diasRestantesEdital(e.data_fechamento);
        return dias > 0 && dias <= 14;
      })
      .sort((a, b) => diasRestantesEdital(a.data_fechamento) - diasRestantesEdital(b.data_fechamento));

    // Some da lista de dispensados qualquer edital que já não esteja mais urgente.
    const currentIds = new Set(urgentEditais.map((e) => `edital-prazo:${e.id}`));
    Array.from(dismissedEditalIdsRef.current).forEach((id) => {
      if (!currentIds.has(id)) dismissedEditalIdsRef.current.delete(id);
    });
    persistDismissedEditalIds(dismissedEditalIdsRef.current);

    const nowIso = new Date().toISOString();
    const syntheticItems: NotificationPreview[] = urgentEditais.map((e) => {
      const dias = diasRestantesEdital(e.data_fechamento);
      const id = `edital-prazo:${e.id}`;
      return {
        id,
        tipo: "edital",
        event_key: "edital_prazo",
        categoria: "prazo",
        prioridade: "critica",
        titulo: e.empresas?.nome ?? "Edital",
        mensagem: `Fecha em ${dias} ${dias === 1 ? "dia" : "dias"} (${fmtDateShort(e.data_fechamento)})`,
        link: "/editais-abertos",
        lida: dismissedEditalIdsRef.current.has(id),
        arquivada_em: null,
        adiada_ate: null,
        created_at: nowIso,
      };
    });

    const combined = [...syntheticItems, ...realItems].sort((a, b) => {
      if (a.lida !== b.lida) return a.lida ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(combined.slice(0, 6));

    if (modulo) {
      setUnreadCount(naoLidasDoModuloRef.current.length);
      setLoading(false);
      return;
    }
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
    const unreadEditais = syntheticItems.filter((item) => !item.lida).length;
    setUnreadCount((countResult.count ?? 0) + unreadEditais);
    setLoading(false);
  }, [userId, modulo]);

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
    if (isEditalPrazoId(notification.id)) {
      dismissedEditalIdsRef.current.add(notification.id);
      persistDismissedEditalIds(dismissedEditalIdsRef.current);
      setItems(current => current.map(item => item.id === notification.id ? { ...item, lida: true } : item));
      setUnreadCount(current => Math.max(0, current - 1));
      return;
    }
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
    await (modulo
      ? (supabase.from("notificacoes") as any).update({ lida: true }).in("id", naoLidasDoModuloRef.current)
      : (supabase.from("notificacoes") as any).update({ lida: true }).eq("user_id", userId).eq("lida", false));
    items.forEach(item => {
      if (isEditalPrazoId(item.id)) dismissedEditalIdsRef.current.add(item.id);
    });
    persistDismissedEditalIds(dismissedEditalIdsRef.current);
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
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1C0E33] px-1 text-[0.5625rem] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-[22.5rem] overflow-hidden rounded bg-white border elevacao-1">
          <div className="flex items-center justify-between border-b border-black/[.07] px-4 py-3">
            <div>
              <p className="text-[0.8125rem] font-bold text-[#282525]">Notificações</p>
              <p className="mt-0.5 text-[0.625rem] text-black/35">
                {unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
              </p>
            </div>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="flex items-center gap-1.5 text-[0.625rem] font-semibold text-[#7259B5] hover:text-[#5E469B]">
                <CheckCheck size={12} /> Marcar como lidas
              </button>
            )}
          </div>

          <div className="max-h-[24.375rem] overflow-y-auto">
            {loading ? (
              <div className="flex h-28 items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/10 border-t-black/50" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <CheckCheck size={22} className="mb-2 text-black/15" />
                <p className="text-[0.75rem] font-semibold text-black/45">Nenhuma pendência nova</p>
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
                  style={{ background: notification.lida ? "#FFFFFF" : "rgba(13,13,13,.025)" }}
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded"
                    style={{ background: "rgba(13,13,13,.04)" }}
                  >
                    <Icon size={14} className={critical ? "text-[#D94A4A]" : "text-black/45"} {...(critical ? { role: "img", "aria-label": "Crítica" } : { "aria-hidden": true })} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-[0.75rem] ${notification.lida ? "font-normal text-black/60" : "font-semibold text-[#282525]"}`}>{notification.titulo}</span>
                      {!notification.lida && <span className="sr-only">Não lida</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[0.6875rem] leading-4 text-black/45">{notification.mensagem}</span>
                    <span className="mt-1 block text-[0.5625rem] text-black/28">{relativeTime(notification.created_at)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); router.push(modulo ? `/notificacoes?modulo=${modulo}` : "/notificacoes"); }}
            className="w-full border-t border-black/[.07] bg-white px-4 py-3 text-center text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-black/[.025]"
          >
            Ver todas as notificações
          </button>
        </div>
      )}
    </div>
  );
}
