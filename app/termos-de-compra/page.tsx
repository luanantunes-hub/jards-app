// Os Termos de compra de ingressos (sem login): o texto está em lib/ticketeria/termos-de-compra.ts, com a versão que o pedido guarda ao ser aceito.

import type { Metadata } from "next";
import { TelaTermosDeCompra } from "@/components/ticketeria/CompraView";
import { ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA, SECOES_DOS_TERMOS_DE_COMPRA } from "@/lib/ticketeria/termos-de-compra";

export const metadata: Metadata = { title: "Termos de compra de ingressos — Jards", description: "O que vale quando você compra um ingresso pela plataforma Jards." };

export default function TermosDeCompra() {
  return <TelaTermosDeCompra secoes={SECOES_DOS_TERMOS_DE_COMPRA} atualizadoEm={ATUALIZADO_EM_DOS_TERMOS_DE_COMPRA} email={process.env.TICKETERIA_EMAIL_DE_REEMBOLSO || "luan.antunes@jards.com.br"} />;
}
