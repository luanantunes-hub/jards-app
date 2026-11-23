// DELETE /api/ticketeria/lojas/{id}/imprensa/veiculos/{vid}: "Parar de acompanhar" (a linha fica marcada como parada, para a grande imprensa padrão não voltar sozinha).
// Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(_req: NextRequest, rota: { params: Promise<{ id: string; vid: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-parar", max: 30 });
  if (a.erro) return a.erro;
  const { vid } = await rota.params;
  if (!UUID.test(vid)) return resposta({ error: "veiculo_invalido" }, 400);
  const { error } = await a.admin.from("ticketeria_veiculos_acompanhados").update({ parado: true }).eq("id", vid.toLowerCase()).eq("loja_id", a.loja.id);
  if (error) { console.error("[ticketeria] parar de acompanhar:", error.message); return resposta({ error: "falha_ao_gravar" }, 500); }
  return resposta({ ok: true });
}
