"use client";

import { useEffect } from "react";

const INTERVALO_MS = 15 * 60_000;

/**
 * Mantém o e-mail em dia enquanto o Jards está aberto: a cada 15 minutos, se a pessoa conectou o Gmail ou o
 * Outlook, pede a sincronização. O servidor respeita o intervalo mínimo por conexão, então abrir várias abas
 * não multiplica as leituras. Quem não conectou não gera nenhuma sincronização.
 */
export function EmailAutoSync() {
  useEffect(() => {
    let parou = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    async function rodar() {
      try {
        if (document.visibilityState === "visible") {
          const res = await fetch("/api/email/connections");
          const json = (await res.json().catch(() => ({}))) as { connections?: unknown[] };
          if (res.ok && (json.connections?.length ?? 0) > 0) {
            await fetch("/api/email/sync", { method: "POST" });
          }
        }
      } catch {
        // Sem rede agora: tenta de novo no próximo ciclo.
      }
      if (!parou) temporizador = setTimeout(rodar, INTERVALO_MS);
    }

    void rodar();
    return () => {
      parou = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, []);

  return null;
}
