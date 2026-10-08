"use client";

// Aviso nas telas da prestação quando a assinatura do módulo pede atenção
// (P5.6): pagamento em atraso, ou o módulo só para leitura depois que a
// assinatura ou a cortesia terminou. Sem assinatura nada é apagado; o banco só
// não deixa escrever.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";

export function AvisoAssinaturaPrestacao() {
  const organizationId = useOrganizationId();
  const { assinatura } = useAssinaturaPrestacao(organizationId);
  if (!assinatura || assinatura.descricao.tom !== "atencao") return null;
  const { descricao } = assinatura;

  return (
    <div role="status" className="border-b bg-white px-4 py-2.5 sm:px-8" style={{ borderColor: "rgba(176,122,20,.28)" }}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-[#B07A14]">
        <AlertTriangle size={13} className="shrink-0" aria-hidden />
        <span className="font-medium">
          {descricao.somenteLeitura ? "Prestação de contas em somente leitura." : "Pagamento da prestação de contas em atraso."}
        </span>
        <span>{descricao.detalhe}</span>
        <Link href="/meu-plano?assinar=prestacao"
          className="rounded underline decoration-[#B07A14]/40 underline-offset-2 transition hover:decoration-[#B07A14] focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          {assinatura.admin ? "Ver em Meu plano" : "Ver a assinatura"}
        </Link>
      </p>
    </div>
  );
}
