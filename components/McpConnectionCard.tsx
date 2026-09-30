"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ChevronRight } from "lucide-react";

interface ChaveMcp {
  id: string;
  revoked_at: string | null;
  expirada?: boolean;
}

/** Card de "Minhas ferramentas" que leva para /configuracoes/mcp — conectar Claude/ChatGPT aos dados do Jards. */
export function McpConnectionCard() {
  const router = useRouter();
  const [ativas, setAtivas] = useState<number | null>(null);

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

  return (
    <button
      onClick={() => router.push("/configuracoes/mcp")}
      className="w-full p-4 rounded border text-left transition hover:border-black/20"
      style={{ borderColor: "rgba(13,13,13,.10)" }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded border border-black/20 bg-transparent flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-[#684DB0]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-black">Claude e ChatGPT (MCP)</p>
          <p className="text-[11px] text-black/40 mt-0.5">
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
  );
}
