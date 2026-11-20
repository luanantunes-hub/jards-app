// GET /api/ticketeria/compra/{pedido_id}/ingressos: os ingressos de um pedido PAGO, para a página de quem comprou (sem login). O id do pedido é um UUID
// sorteado: quem tem o link vê. Não traz o e-mail do comprador nem nada de dinheiro do produtor. Pedido que não existe ou ainda não foi pago: 404.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function GET(_req: NextRequest, rota: { params: Promise<{ pedido: string }> }) {
  const { pedido } = await rota.params;
  if (!UUID.test(pedido)) return resposta({ error: "nao_encontrado" }, 404);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_ingressos_do_pedido", { p_pedido: pedido.toLowerCase() });
  if (error) {
    console.error("[ticketeria] ingressos do pedido:", error.message);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
  if (!data) return resposta({ error: "nao_encontrado" }, 404);
  return resposta(data as object);
}
