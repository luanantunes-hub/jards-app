// DELETE /api/ticketeria/lojas/{id}/conexoes/meta: desconecta o Meta (o token sai do Vault; o gasto já lido fica). Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexao-meta-desconectar", max: 10 });
  if (a.erro) return a.erro;
  const t = clienteDaTicketeria(createAdminClient());
  const { data: c } = await t.from("ticketeria_conexoes_midia").select("id").eq("loja_id", a.loja.id).eq("provedor", "meta").maybeSingle();
  if (!c) return resposta({ error: "sem_conexao" }, 404);
  const { error } = await t.rpc("fn_ticketeria_midia_desconectar", { p_conexao: c.id });
  if (error) {
    console.error("[ticketeria] desconectar o Meta:", error.message);
    return resposta({ error: "falha_ao_desconectar" }, 500);
  }
  return resposta({ ok: true });
}
