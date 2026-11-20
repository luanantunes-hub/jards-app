// POST /api/ticketeria/lojas/{id}/webhooks/{webhook}/girar: sorteia outro segredo para o endereço (o antigo deixa de assinar) e o devolve, uma vez só. Só quem edita a Ticketeria.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { UUID } from "@/lib/ticketeria/integracao";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string; webhook: string }> }) {
  const a = await autorizarLoja(rota, { chave: "webhooks-muda", max: 20 });
  if (a.erro) return a.erro;
  const { webhook } = await rota.params;
  if (!UUID.test(webhook)) return resposta({ error: "webhook_invalido" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_girar", { p_loja: a.loja.id, p_id: webhook.toLowerCase() });
  if (error) { console.error("[ticketeria] webhooks:", error.message); return resposta({ error: "falha_ao_girar" }, 500); }
  return data ? resposta(data as object) : resposta({ error: "nao_encontrado" }, 404);
}
