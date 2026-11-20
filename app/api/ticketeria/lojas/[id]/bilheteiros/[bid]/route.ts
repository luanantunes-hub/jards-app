// /api/ticketeria/lojas/{id}/bilheteiros/{bid}: muda uma pessoa da bilheteria. Quem pede precisa EDITAR a Ticketeria da organização da loja.
//
//   PATCH { nome?, ativo? } → { bilheteiro: { id, nome, ativo } }; desligar tira o acesso na próxima tela que a pessoa abrir. 404 se a pessoa não é desta loja.

import { type NextRequest } from "next/server";
import { lerAlteracaoDeBilheteiro } from "@/lib/ticketeria/bilheteria";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, rota: { params: Promise<{ id: string; bid: string }> }) {
  const { bid } = await rota.params;
  const a = await autorizarLoja(rota, { chave: "bilheteiros-muda", max: 40 });
  if (a.erro) return a.erro;
  if (!UUID.test(bid)) return resposta({ error: "bilheteiro_invalido" }, 400);
  let bruto: unknown;
  try { bruto = await req.json(); } catch { return resposta({ error: "dados_invalidos" }, 400); }
  const leitura = lerAlteracaoDeBilheteiro(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", mensagem: leitura.erro }, 400);
  const { data, error } = await a.admin.from("ticketeria_bilheteiros").update(leitura.valor).eq("id", bid).eq("loja_id", a.loja.id).select("id, nome, ativo").maybeSingle();
  if (error) { console.error("[ticketeria] mudar bilheteiro:", error.message); return resposta({ error: "falha_ao_gravar" }, 500); }
  if (!data) return resposta({ error: "nao_encontrado" }, 404);
  return resposta({ bilheteiro: data });
}
