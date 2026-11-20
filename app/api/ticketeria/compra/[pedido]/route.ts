// GET /api/ticketeria/compra/{pedido_id}: o comprador (sem login) pergunta se o Pix já foi pago. O id do pedido é um UUID sorteado (não dá para adivinhar)
// e a resposta não traz nada pessoal: só a situação, o código e o prazo da reserva.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { situacaoParaOComprador } from "@/lib/ticketeria/pagamento/compra";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function GET(_req: NextRequest, rota: { params: Promise<{ pedido: string }> }) {
  const { pedido } = await rota.params;
  if (!UUID.test(pedido)) return resposta({ error: "nao_encontrado" }, 404);
  const { data } = await clienteDaTicketeria(createAdminClient()).from("ticketeria_pedidos").select("codigo, situacao, reservado_ate, total_centavos").eq("id", pedido.toLowerCase()).maybeSingle();
  if (!data) return resposta({ error: "nao_encontrado" }, 404);
  return resposta({ codigo: data.codigo, situacao: situacaoParaOComprador(data.situacao, data.reservado_ate), reservado_ate: data.reservado_ate, total_centavos: data.total_centavos });
}
