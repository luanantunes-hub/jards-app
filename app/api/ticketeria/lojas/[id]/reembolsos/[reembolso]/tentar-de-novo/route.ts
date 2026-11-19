// POST /api/ticketeria/lojas/{id}/reembolsos/{reembolso}/tentar-de-novo: refaz um reembolso por e-mail que falhou (o Asaas recusou o estorno, por exemplo). Só quem edita a
// Ticketeria da organização; só reabre o que está `falhou` e é de um pedido da loja. A decisão é a mesma de antes (o prazo de 7 dias conta da hora em que o e-mail chegou).

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { tentarDeNovoOReembolso } from "@/lib/ticketeria/pagamento/reembolso-entrada";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string; reembolso: string }> }) {
  const a = await autorizarLoja(rota, { chave: "reembolso-de-novo", max: 10 });
  if (a.erro) return a.erro;
  const { reembolso } = await rota.params;
  if (!UUID.test(reembolso)) return resposta({ error: "reembolso_invalido" }, 400);
  const r = await tentarDeNovoOReembolso(reembolso.toLowerCase(), a.loja.id);
  return resposta(r.corpo, r.status);
}
