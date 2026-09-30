"use client";

import { useRouter } from "next/navigation";
import { AcessoContatosModal } from "@/components/modals/AcessoContatosModal";

/** Bloqueia a autorização OAuth para organizações sem plano pago. */
export function OAuthPaywall() {
  const router = useRouter();
  return (
    <AcessoContatosModal
      variant="mcp_gpt"
      onClose={() => router.push("/dashboard")}
      onPrimary={() => router.push("/meu-plano?acao=assinar")}
    />
  );
}
