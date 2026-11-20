// DELETE /api/ticketeria/lojas/{id}/porta/links/{link}: desliga um link da equipe da porta (quem tem o link deixa de conferir na hora). Quem pede precisa EDITAR a Ticketeria.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: NextRequest, rota: { params: Promise<{ id: string; link: string }> }) {
  const a = await autorizarLoja({ params: rota.params.then(p => ({ id: p.id })) }, { chave: "porta-links-desligar", max: 60 });
  if (a.erro) return a.erro;
  const { link } = await rota.params;
  if (!UUID.test(link)) return resposta({ error: "link_invalido" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_link_revogar", { p_loja: a.loja.id, p_link: link.toLowerCase() });
  if (error) {
    console.error("[ticketeria] desligar link da porta:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  return data === true ? resposta({ desligado: true }) : resposta({ error: "link_nao_encontrado" }, 404);
}
