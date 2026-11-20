// POST /api/ticketeria/lojas/{id}/webhooks/{webhook}/teste: põe um aviso de teste na fila do endereço (sai na próxima rodada, em até um minuto). Só quem edita a Ticketeria.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { UUID } from "@/lib/ticketeria/integracao";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string; webhook: string }> }) {
  const a = await autorizarLoja(rota, { chave: "webhooks-teste", max: 10 });
  if (a.erro) return a.erro;
  const { webhook } = await rota.params;
  if (!UUID.test(webhook)) return resposta({ error: "webhook_invalido" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_teste", { p_loja: a.loja.id, p_id: webhook.toLowerCase() });
  if (error) { console.error("[ticketeria] webhooks:", error.message); return resposta({ error: "falha_ao_testar" }, 500); }
  return data ? resposta({ entrega: data }, 202) : resposta({ error: "nao_encontrado" }, 404);
}
