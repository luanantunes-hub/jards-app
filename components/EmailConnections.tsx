"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Mail, RefreshCw, Unplug } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type Provedor = "google" | "microsoft";

type ConnectionPublic = {
  provider: Provedor;
  provider_account_email: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
};

const PROVEDORES: Array<{ id: Provedor; nome: string; quem: string }> = [
  { id: "google", nome: "Gmail", quem: "Gmail e Google Workspace" },
  { id: "microsoft", nome: "Outlook", quem: "Outlook, Hotmail e Microsoft 365" },
];

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
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
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
  const [sincronizando, setSincronizando] = useState<Provedor | null>(null);
  const [ocupado, setOcupado] = useState<Provedor | null>(null);
  const [configurados, setConfigurados] = useState<Record<Provedor, boolean>>({ google: false, microsoft: false });
  const [beta, setBeta] = useState(false);
  const [connections, setConnections] = useState<ConnectionPublic[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/email/connections");
    const json = (await res.json().catch(() => ({}))) as {
      googleConfigured?: boolean;
      microsoftConfigured?: boolean;
      beta?: boolean;
      connections?: ConnectionPublic[];
      error?: string;
    };
    if (!res.ok) {
      setErro(json.error ?? "Não foi possível carregar conexões de email");
      setLoading(false);
      return;
    }
    setConfigurados({ google: Boolean(json.googleConfigured), microsoft: Boolean(json.microsoftConfigured) });
    setBeta(Boolean(json.beta));
    setConnections(json.connections ?? []);
    setLoading(false);
  }, []);

  const sincronizar = useCallback(async (provedor: Provedor) => {
    setSincronizando(provedor);
    setErro(null);
    const res = await fetch("/api/email/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provedor, force: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { synced?: number; ignored?: number; error?: string };
    if (!res.ok) setErro(json.error ?? "Falha ao sincronizar");
    else {
      const synced = json.synced ?? 0;
      setSucesso(`${synced} ${synced === 1 ? "e-mail vinculado" : "e-mails vinculados"} ao CRM`);
    }
    await load();
    setSincronizando(null);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conectado = params.get("email");
    const error = params.get("email_error");
    if (conectado === "google") setSucesso("Gmail conectado");
    if (conectado === "microsoft") setSucesso("Outlook conectado");
    if (error) setErro(decodeURIComponent(error));
    if (conectado || error) router.replace("/configuracoes");
    void load().then(() => {
      // Recém-conectado: já traz o histórico dos contatos, sem esperar o próximo ciclo.
      if (conectado === "google" || conectado === "microsoft") void sincronizar(conectado);
    });
  }, [load, router, sincronizar]);

  useEffect(() => {
    if (!sucesso) return;
    const t = setTimeout(() => setSucesso(null), 4000);
    return () => clearTimeout(t);
  }, [sucesso]);

  function conectar(provedor: Provedor) {
    const q = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
    // Navegação completa: a rota responde com o redirecionamento para a tela de autorização do provedor.
    window.location.assign(new URL(`/api/email/${provedor}/start${q}`, window.location.origin).toString());
  }

  function desconectar(provedor: Provedor, nome: string) {
    confirmDelete({
      title: `Desconectar o ${nome}?`,
      description: "Os e-mails já sincronizados serão mantidos.",
      confirmLabel: "Desconectar",
      pendingLabel: "Desconectando…",
      illustration: false,
      onConfirm: async () => {
        setOcupado(provedor);
        setErro(null);
        try {
          const res = await fetch("/api/email/disconnect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: provedor }),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Falha ao desconectar");
          setSucesso(`${nome} desconectado`);
          await load();
        } finally {
          setOcupado(null);
        }
      },
    });
  }

  // Em beta fechado o cartão só aparece para quem está na lista ou já conectou.
  if (loading || (!beta && connections.length === 0)) return null;

  return (
    <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
      <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
        <Mail size={14} className="text-black/30" />
        <span className="text-[0.75rem] font-bold text-[#282525]">E-mail</span>
        <span className="ml-auto text-[0.6875rem] text-black/35">Gmail e Outlook</span>
      </div>

      <div className="p-6 space-y-4">
        {erro && (
          <div className="flex items-center gap-2 px-3 py-2 rounded text-[0.75rem] font-medium" style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
            <AlertCircle size={14} className="flex-shrink-0" />
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 px-3 py-2 rounded text-[0.75rem] font-medium" style={{ background: "#fff", border: "1px solid #2E893247", color: "#2E8932" }}>
            <Check size={14} />
            {sucesso}
          </div>
        )}

        {PROVEDORES.map((provedor) => {
          const connection = connections.find((c) => c.provider === provedor.id) ?? null;
          const configurado = configurados[provedor.id];
          const parado = ocupado === provedor.id || sincronizando === provedor.id;
          return (
            <div key={provedor.id} className="p-4 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(13,13,13,.04)" }}>
                  {provedor.id === "google" ? <GoogleMark /> : <MicrosoftMark />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-semibold text-[#282525]">{provedor.nome}</p>
                  {connection ? (
                    <p className="text-[0.6875rem] text-black/40 truncate mt-0.5">
                      {connection.provider_account_email ?? "Conta conectada"} · última sincronização {fmtDate(connection.last_sync_at)}
                    </p>
                  ) : (
                    <p className="text-[0.6875rem] text-black/40 mt-0.5">
                      {configurado ? provedor.quem : "Ainda não configurado no servidor"}
                    </p>
                  )}
                </div>

                {connection ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => void sincronizar(provedor.id)}
                      disabled={parado}
                      className="flex items-center gap-1 text-[0.6875rem] font-medium text-black/45 hover:text-[#282525] transition disabled:opacity-40"
                    >
                      <RefreshCw size={12} className={sincronizando === provedor.id ? "animate-spin" : ""} />
                      {sincronizando === provedor.id ? "Sincronizando…" : "Sincronizar"}
                    </button>
                    <button
                      onClick={() => desconectar(provedor.id, provedor.nome)}
                      disabled={parado}
                      className="flex items-center gap-1 text-[0.6875rem] font-medium text-black/45 hover:text-[#D94E4E] transition disabled:opacity-40"
                    >
                      <Unplug size={12} /> Desconectar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => conectar(provedor.id)}
                    disabled={!configurado || parado}
                    className="rounded border bg-white px-3 py-1.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] disabled:opacity-40"
                    style={{ borderColor: "rgba(13,13,13,.16)" }}
                  >
                    Conectar
                  </button>
                )}
              </div>

              {connection?.last_error && (
                <p className="mt-3 text-[0.6875rem] text-[#D94E4E]">{connection.last_error}</p>
              )}
            </div>
          );
        })}

        <p className="text-[0.6875rem] text-black/40">Só entram e-mails de pessoas que estão nos seus contatos. A equipe vê essas conversas, a menos que você marque “Só eu vejo”.</p>
      </div>
    </div>
  );
}
