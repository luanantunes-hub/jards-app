// DELETE /api/ticketeria/lojas/{id}/historico/{importacao}: desfaz uma importação (apaga o que ela trouxe). Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: NextRequest, rota: { params: Promise<{ id: string; importacao: string }> }) {
  const importacao = (await rota.params).importacao;
  if (!UUID.test(importacao)) return resposta({ error: "importacao_invalida" }, 400);
  const a = await autorizarLoja(rota, { chave: "historico-desfazer", max: 20 });
  if (a.erro) return a.erro;
  const { error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_historico_desfazer", { p_importacao: importacao.toLowerCase(), p_loja: a.loja.id });
  if (error) return error.message.includes("importacao_inexistente") ? resposta({ error: "importacao_inexistente" }, 404) : (console.error("[ticketeria] desfazer importação:", error.message), resposta({ error: "falha_ao_desfazer" }, 500));
  return resposta({ ok: true });
}
