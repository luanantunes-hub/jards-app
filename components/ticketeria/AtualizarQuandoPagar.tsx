"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Na página de um pedido ainda não pago: pergunta de 5 em 5 segundos e recarrega a página quando o pagamento cai (ou o pedido muda). Não desenha nada. */
export function AtualizarQuandoPagar({ pedido }: { pedido: string }) {
  const router = useRouter();
  useEffect(() => {
    const pergunta = setInterval(async () => {
      try {
        const r = await fetch(`/api/ticketeria/compra/${pedido}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { situacao?: string };
        if (d.situacao === "pago" || d.situacao === "cancelada") router.refresh();
      } catch { /* tenta de novo */ }
    }, 5000);
    return () => clearInterval(pergunta);
  }, [pedido, router]);
  return null;
}
