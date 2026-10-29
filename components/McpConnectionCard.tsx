"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useCreditos } from "@/contexts/CreditosContext";
import { useOrganizationRole } from "@/contexts/OrganizationContext";
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
  const papel = useOrganizationRole();
  const [ativas, setAtivas] = useState<number | null>(null);
  // Quantos módulos a pessoa pode conectar, como o servidor confere; null até ele responder. A prestação de contas conta
  // mesmo sem a assinatura da captação e para a equipe toda, não só para quem administra.
  const [modulosPossiveis, setModulosPossiveis] = useState<number | null>(null);
  // A assinatura é a da organização aberta; a captação pelo conector é de quem a administra
  // (PAPEL_COM_ACESSO_AO_CRM em lib/mcp/enums.ts), como o servidor confere. Quem usa a prestação conecta sem ser admin.
  const semPapel = !!assinatura?.ativa && papel !== "admin" && !modulosPossiveis;
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const res = await fetch("/api/mcp/keys");
      if (cancelado || !res.ok) return;
      const data = await res.json();
      const chaves: ChaveMcp[] = data.chaves ?? [];
      setAtivas(chaves.filter((c) => !c.revoked_at).length);
      setModulosPossiveis(Array.isArray(data.modulos_disponiveis) ? data.modulos_disponiveis.length : 0);
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  function handleClick() {
    if (semPapel) return;
    if (!assinatura?.ativa && !modulosPossiveis) {
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
        disabled={semPapel}
        className="w-full p-4 rounded border text-left transition hover:border-black/20 disabled:cursor-default disabled:hover:border-black/10"
        style={{ borderColor: "rgba(13,13,13,.10)" }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <div className="absolute left-0 top-0 w-6 h-6 rounded border border-black/20 bg-white flex items-center justify-center">
              <ClaudeMark size={13} />
            </div>
            <div className="absolute right-0 bottom-0 w-6 h-6 rounded border border-black/20 bg-white flex items-center justify-center text-[#282525]">
              <OpenAIMark size={12} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[0.8125rem] font-semibold text-[#282525]">Claude e ChatGPT (MCP)</p>
            <p className="text-[0.6875rem] text-black/40 mt-0.5">
              {semPapel
                ? "Para quem administra a organização"
                : ativas === null
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
