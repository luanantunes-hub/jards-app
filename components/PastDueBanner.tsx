"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useCreditos } from "@/contexts/CreditosContext";

export function PastDueBanner() {
  const { assinatura } = useCreditos();
  const [loading, setLoading] = useState(false);

  if (!assinatura || assinatura.status !== "past_due") return null;

  const dentroDaCarencia = assinatura.diasRestantesCarencia !== null;

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-[12px] font-semibold text-white"
      style={{ background: "#B07A14" }}
    >
      <AlertTriangle size={13} className="shrink-0" />
      <span>
        {dentroDaCarencia
          ? <>Notamos que seu último pagamento não passou. Seu acesso continua por mais {assinatura.diasRestantesCarencia} {assinatura.diasRestantesCarencia === 1 ? "dia" : "dias"}. Atualize a forma de pagamento quando puder.</>
          : <>Seu pagamento segue pendente e por isso pausamos o acesso ao plano. Atualize a forma de pagamento pra reativar quando quiser.</>}
      </span>
      <button
        onClick={handlePortal}
        disabled={loading}
        className="rounded px-3 py-1 text-[11px] font-semibold text-white transition disabled:opacity-60"
        style={{ background: "rgba(0,0,0,.22)" }}
      >
        {loading ? "Abrindo…" : "Atualizar pagamento"}
      </button>
    </div>
  );
}
