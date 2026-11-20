// GET /api/ticketeria/lojas/{id}/webhooks/{webhook}/entregas: os últimos avisos do endereço (tipo, estado, tentativas, resposta do outro lado). Só quem edita a Ticketeria.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { UUID } from "@/lib/ticketeria/integracao";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string; webhook: string }> }) {
  const a = await autorizarLoja(rota, { chave: "webhooks", max: 30 });
  if (a.erro) return a.erro;
  const { webhook } = await rota.params;
  if (!UUID.test(webhook)) return resposta({ error: "webhook_invalido" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_entregas", { p_loja: a.loja.id, p_id: webhook.toLowerCase(), p_limite: 20 });
  if (error) { console.error("[ticketeria] webhooks:", error.message); return resposta({ error: "falha_ao_ler" }, 500); }
  return resposta({ entregas: data ?? [] });
}
