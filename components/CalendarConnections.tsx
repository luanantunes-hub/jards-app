"use client";

import { useCallback, useEffect, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check, Unplug } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { CalendarProvider } from "@/lib/supabase/types";
import { Select } from "@/components/ui/Select";

type ConnectionPublic = {
  provider: CalendarProvider;
  provider_account_email: string | null;
  calendar_id: string;
  calendar_name: string | null;
  sync_enabled: boolean;
  last_error: string | null;
  last_sync_at: string | null;
};

type CalendarItem = { id: string; name: string; primary: boolean; canWrite: boolean };

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5H11.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  );
}

export function CalendarConnections() {
  const router = useRouter();
  const organizationId = useOrganizationId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<CalendarProvider | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [microsoftConfigured, setMicrosoftConfigured] = useState(false);
  const [connections, setConnections] = useState<ConnectionPublic[]>([]);
  const [calendars, setCalendars] = useState<Record<CalendarProvider, CalendarItem[]>>({
    google: [],
    microsoft: [],
  });
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/calendar/connections");
    const json = await res.json() as {
      googleConfigured?: boolean;
      microsoftConfigured?: boolean;
      connections?: ConnectionPublic[];
      error?: string;
    };
    if (!res.ok) {
      setErro(json.error ?? "Não foi possível carregar as conexões de calendário");
      setLoading(false);
      return;
    }
    setGoogleConfigured(Boolean(json.googleConfigured));
    setMicrosoftConfigured(Boolean(json.microsoftConfigured));
    setConnections(json.connections ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("calendar");
    const error = params.get("calendar_error");
    if (connected === "google") setSucesso("Google Calendar conectado");
    if (connected === "microsoft") setSucesso("Microsoft Calendar conectado");
    if (error) setErro(decodeURIComponent(error));
    if (connected || error) {
      router.replace("/configuracoes");
    }
    load();
  }, [load, router]);

  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(null), 4000);
    return () => clearTimeout(t);
  }, [sucesso]);

  function conn(provider: CalendarProvider) {
    return connections.find((c) => c.provider === provider);
  }

  function startOAuth(provider: CalendarProvider) {
    const q = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
    window.location.href = `/api/calendar/${provider}/start${q}`;
  }

  async function disconnect(provider: CalendarProvider) {
    if (!confirm("Desconectar esta conta de calendário?")) return;
    setBusy(provider);
    setErro(null);
    const res = await fetch("/api/calendar/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao desconectar");
    else {
      setSucesso(provider === "google" ? "Google desconectado" : "Microsoft desconectada");
      await load();
    }
    setBusy(null);
  }

  async function loadCalendars(provider: CalendarProvider) {
    if (calendars[provider].length > 0) return;
    setBusy(provider);
    const res = await fetch(`/api/calendar/calendars?provider=${provider}`);
    const json = await res.json() as { calendars?: CalendarItem[]; error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao listar calendários");
    else setCalendars((prev) => ({ ...prev, [provider]: json.calendars ?? [] }));
    setBusy(null);
  }

  async function selectCalendar(provider: CalendarProvider, calendarId: string, calendarName: string) {
    setBusy(provider);
    setErro(null);
    const res = await fetch("/api/calendar/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, calendar_id: calendarId, calendar_name: calendarName }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao salvar calendário");
    else {
      setSucesso("Calendário-alvo atualizado");
      await load();
    }
    setBusy(null);
  }

  async function toggleSync(provider: CalendarProvider, enabled: boolean) {
    setBusy(provider);
    const res = await fetch("/api/calendar/connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, sync_enabled: enabled }),
    });
    const json = await res.json() as { error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao atualizar sincronização");
    else await load();
    setBusy(null);
  }

  function card(opts: {
    provider: CalendarProvider;
    title: string;
    configured: boolean;
    Icon: () => JSX.Element;
  }) {
    const c = conn(opts.provider);
    const list = calendars[opts.provider];
    const connecting = busy === opts.provider;

    return (
      <div className="p-4 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded border border-black/20 bg-transparent flex items-center justify-center flex-shrink-0">
            <opts.Icon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-black">{opts.title}</p>
            {c ? (
              <p className="text-[11px] text-black/40 truncate mt-0.5">
                {c.provider_account_email ?? "Conta conectada"}
              </p>
            ) : (
              <p className="text-[11px] text-black/40 mt-0.5">
                {opts.configured
                  ? "Sincronize atividades com sua agenda"
                  : "Credenciais do servidor ainda não configuradas"}
              </p>
            )}
          </div>
          {c ? (
            <button
              onClick={() => disconnect(opts.provider)}
              disabled={connecting}
              className="flex items-center gap-1 text-[11px] font-semibold text-black/40 hover:text-[#D94E4E] transition disabled:opacity-40"
            >
              <Unplug size={12} /> Desconectar
            </button>
          ) : (
            <button
              onClick={() => startOAuth(opts.provider)}
              disabled={!opts.configured || connecting}
              className="px-3 py-1.5 text-[11px] font-semibold rounded transition disabled:opacity-40"
              style={{ background: "#7259B5", color: "white" }}
            >
              Conectar
            </button>
          )}
        </div>

        {c && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">Calendário-alvo</span>
              <Select
                value={c.calendar_id}
                disabled={connecting}
                onFocus={() => loadCalendars(opts.provider)}
                onChange={(e) => {
                  const item = list.find((x) => x.id === e.target.value);
                  selectCalendar(opts.provider, e.target.value, item?.name ?? e.target.value);
                }}
                className="mt-1.5 w-full px-3 py-2 text-[12px] rounded border appearance-none bg-white"
                style={{ borderColor: "rgba(13,13,13,.12)" }}
              >
                {!list.find((x) => x.id === c.calendar_id) && (
                  <option value={c.calendar_id}>{c.calendar_name || c.calendar_id}</option>
                )}
                {(list.length > 0 ? list : []).filter((x) => x.canWrite).map((cal) => (
                  <option key={cal.id} value={cal.id}>
                    {cal.name}{cal.primary ? " (principal)" : ""}
                  </option>
                ))}
              </Select>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={c.sync_enabled}
                disabled={connecting}
                onChange={(e) => toggleSync(opts.provider, e.target.checked)}
                className="rounded border-black/20"
              />
              <span className="text-[12px] text-black/60">Sincronização ativa</span>
            </label>

            {c.last_error && (
              <p className="text-[11px] text-[#D94E4E]">{c.last_error}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
      <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <CalendarDays size={14} className="text-black/30" />
        <span className="text-[12px] font-bold text-black">Calendários</span>
      </div>

      <div className="p-6 space-y-4">
        {erro && (
          <div className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-medium" style={{ background: "#D94E4E14", color: "#D94E4E" }}>
            <AlertCircle size={14} className="flex-shrink-0" />
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 px-3 py-2 rounded text-[12px] font-medium" style={{ background: "#2E893214", color: "#2E8932" }}>
            <Check size={14} />
            {sucesso}
          </div>
        )}

        {loading ? (
          <div className="h-24 rounded bg-black/[0.03] animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {card({ provider: "google", title: "Google Calendar", configured: googleConfigured, Icon: GoogleMark })}
            {card({ provider: "microsoft", title: "Microsoft 365 / Outlook", configured: microsoftConfigured, Icon: MicrosoftMark })}
          </div>
        )}

      </div>
    </div>
  );
}
