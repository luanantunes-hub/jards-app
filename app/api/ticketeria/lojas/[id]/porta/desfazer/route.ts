// POST /api/ticketeria/lojas/{id}/porta/desfazer { sessao_id, codigo }: desfaz uma entrada marcada por engano (o ingresso volta a valer) e deixa o registro de quem desfez.
//   → 200 { tipo: "desfeita", ingresso, comprador, restantes } | { tipo: "nao_usado" | "cancelado" | "outra_sessao" | "nao_encontrado" }
// Quem pede precisa EDITAR a Ticketeria da organização da loja.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { normalizarCodigo, resultadoDoDesfazer } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-desfazer", max: 60 });
  if (a.erro) return a.erro;
  let corpo: { sessao_id?: unknown; codigo?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const sessao = typeof corpo.sessao_id === "string" ? corpo.sessao_id : "";
  const codigo = typeof corpo.codigo === "string" ? normalizarCodigo(corpo.codigo.slice(0, 500)) : "";
  if (!UUID.test(sessao) || codigo === "") return resposta({ error: "dados_invalidos" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_desfazer", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase(), p_codigo: codigo, p_usuario: a.user.id });
  if (error) {
    if (error.message?.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
    console.error("[ticketeria] desfazer entrada:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = resultadoDoDesfazer(data);
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}
