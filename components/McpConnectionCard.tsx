"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useCreditos } from "@/contexts/CreditosContext";
import { AcessoContatosModal } from "@/components/modals/AcessoContatosModal";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";

interface ChaveMcp {
  id: string;
  revoked_at: string | null;
  expirada?: boolean;
}

/** Card de "Minhas ferramentas" que leva para /configuracoes/mcp — conectar Claude/ChatGPT aos dados do Jards. */
export function McpConnectionCard() {
  const router = useRouter();
  const { assinatura } = useCreditos();
  const [ativas, setAtivas] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const res = await fetch("/api/mcp/keys");
      if (cancelado || !res.ok) return;
      const data = await res.json();
      const chaves: ChaveMcp[] = data.chaves ?? [];
      setAtivas(chaves.filter((c) => !c.revoked_at).length);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function handleClick() {
    if (!assinatura?.ativa) {
      setShowPaywall(true);
      return;
    }
    router.push("/configuracoes/mcp");
  }

  return (
    <>
      {showPaywall && (
        <AcessoContatosModal
          variant="mcp_gpt"
          onClose={() => setShowPaywall(false)}
          onPrimary={() => {
            setShowPaywall(false);
            router.push("/meu-plano?acao=assinar");
          }}
        />
      )}
      <button
        onClick={handleClick}
        className="w-full p-4 rounded border text-left transition hover:border-black/20"
        style={{ borderColor: "rgba(13,13,13,.10)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="absolute left-0 top-0 w-6 h-6 rounded border border-black/20 bg-white flex items-center justify-center">
              <ClaudeMark size={13} />
            </div>
            <div className="absolute right-0 bottom-0 w-6 h-6 rounded border border-black/20 bg-white flex items-center justify-center text-black">
              <OpenAIMark size={12} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.8125rem] font-semibold text-black">Claude e ChatGPT (MCP)</p>
            <p className="text-[0.6875rem] text-black/40 mt-0.5">
              {ativas === null
                ? "Conecte assistentes de IA aos dados do Jards"
                : ativas > 0
                  ? `${ativas} chave${ativas === 1 ? "" : "s"} ativa${ativas === 1 ? "" : "s"}`
                  : "Conecte assistentes de IA aos dados do Jards"}
            </p>
          </div>
          <ChevronRight size={16} className="text-black/30 flex-shrink-0" />
        </div>
      </button>
    </>
  );
}
