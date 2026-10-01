"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Mail, RefreshCw, Unplug } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type ConnectionPublic = {
  provider: "google";
  provider_account_email: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
};

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

function fmtDate(d: string | null): string {
  if (!d) return "nunca";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmailConnections() {
  const router = useRouter();
  const organizationId = useOrganizationId();
  const { confirmDelete } = useDeleteConfirm();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [connection, setConnection] = useState<ConnectionPublic | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/email/connections");
    const json = (await res.json()) as {
      googleConfigured?: boolean;
      connections?: ConnectionPublic[];
      error?: string;
    };
    if (!res.ok) {
      setErro(json.error ?? "Não foi possível carregar conexões de email");
      setLoading(false);
      return;
    }
    setGoogleConfigured(Boolean(json.googleConfigured));
    setConnection(json.connections?.[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("email");
    const error = params.get("email_error");
    if (connected === "google") setSucesso("Gmail conectado com sucesso");
    if (error) setErro(decodeURIComponent(error));
    if (connected || error) router.replace("/configuracoes");
    load();
  }, [load, router]);

  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(null), 4000);
    return () => clearTimeout(t);
  }, [sucesso]);

  function startOAuth() {
    const q = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
    window.location.href = `/api/email/google/start${q}`;
  }

  function disconnect() {
    confirmDelete({
      title: "Desconectar o Gmail?",
      description: "Os e-mails já sincronizados serão mantidos.",
      confirmLabel: "Desconectar",
      pendingLabel: "Desconectando…",
      illustration: false,
      onConfirm: async () => {
        setBusy(true);
        setErro(null);
        try {
          const res = await fetch("/api/email/disconnect", { method: "POST" });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Falha ao desconectar");
          setSucesso("Gmail desconectado");
          await load();
        } finally {
          setBusy(false);
        }
      },
    });
  }

  async function sync() {
    setSyncing(true);
    setErro(null);
    const res = await fetch("/api/email/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const json = (await res.json()) as { synced?: number; scanned?: number; ignored?: number; error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao sincronizar");
    else {
      const synced = json.synced ?? 0;
      const ignored = json.ignored ?? 0;
      setSucesso(`${synced} ${synced === 1 ? "email vinculado" : "emails vinculados"} ao CRM${ignored ? ` · ${ignored} não adicionados` : ""}`);
      await load();
    }
    setSyncing(false);
  }

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
      <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <Mail size={14} className="text-black/30" />
        <span className="text-[12px] font-bold text-black">E-mail</span>
        <span className="ml-auto text-[11px] text-black/35">Gmail · conta pessoal</span>
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
          <div className="h-20 rounded bg-black/[0.03] animate-pulse" />
        ) : (
          <div className="p-4 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(13,13,13,.04)" }}>
                <GoogleMark />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-black">Gmail</p>
                {connection ? (
                  <p className="text-[11px] text-black/40 truncate mt-0.5">
                    {connection.provider_account_email ?? "Conta conectada"} · última sync {fmtDate(connection.last_sync_at)}
                  </p>
                ) : (
                  <p className="text-[11px] text-black/40 mt-0.5">
                    {googleConfigured
                      ? "Sincronize e-mails com negociações e contatos"
                      : "Credenciais do servidor ainda não configuradas"}
                  </p>
                )}
              </div>

              {connection ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={sync}
                    disabled={syncing || busy}
                    className="flex items-center gap-1 text-[11px] font-semibold text-black/40 hover:text-[#7259B5] transition disabled:opacity-40"
                  >
                    <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Sincronizando…" : "Sincronizar"}
                  </button>
                  <button
                    onClick={disconnect}
                    disabled={busy || syncing}
                    className="flex items-center gap-1 text-[11px] font-semibold text-black/40 hover:text-[#D94E4E] transition disabled:opacity-40"
                  >
                    <Unplug size={12} /> Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={startOAuth}
                  disabled={!googleConfigured || busy}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded transition disabled:opacity-40"
                  style={{ background: "#7259B5", color: "white" }}
                >
                  Conectar
                </button>
              )}
            </div>

            {connection?.last_error && (
              <p className="mt-3 text-[11px] text-[#D94E4E]">{connection.last_error}</p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
