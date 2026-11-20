// POST /api/ticketeria/pedido/{id}/reembolso: o botão "Pedir reembolso" da página do pedido (sem login). NÃO estorna: manda um link de confirmação ao e-mail da compra.
//
//   (sem corpo)
//   → 200 { enviado: true, email: "ri***@gmail.com", valido_ate }    o link foi para o e-mail da compra
//   → 404 { error: "nao_encontrado" }                                 não há pedido com esse id (como a página do pedido)
//   → 409 { error, mensagem }   fora do prazo de 7 dias, ingresso já usado, já reembolsado, não pago ou em andamento
//   → 429 { error, mensagem }   um link a cada 10 minutos e no máximo 5 por dia por pedido (e o limite por IP, em proxy.ts)
//
// A pessoa não informa e-mail nenhum: o link só vai ao endereço do pedido. O estorno acontece em /confirmar, quando ela abre o link.

import { NextResponse, type NextRequest } from "next/server";
import { ehIdDePedido } from "@/lib/ticketeria/pagamento/reembolso-pagina";
import { pedirReembolsoPelaPagina } from "@/lib/ticketeria/pagamento/reembolso-pagina-servidor";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehIdDePedido(id)) return NextResponse.json({ error: "nao_encontrado", mensagem: "Pedido não encontrado." }, { status: 404, headers: { "cache-control": "no-store" } });
  const r = await pedirReembolsoPelaPagina(id.toLowerCase());
  return NextResponse.json(r.corpo, { status: r.status, headers: { "cache-control": "no-store" } });
}
