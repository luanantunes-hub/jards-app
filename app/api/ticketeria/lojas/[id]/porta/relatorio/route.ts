// GET /api/ticketeria/lojas/{id}/porta/relatorio?sessao={id}: o relatório da sessão (válidos, entraram, cancelados, por ingresso e por faixa de meia hora). Quem pede precisa EDITAR a Ticketeria.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { relatorioDaSessao } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-relatorio", max: 60 });
  if (a.erro) return a.erro;
  const sessao = req.nextUrl.searchParams.get("sessao") ?? "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_relatorio", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase() });
  if (error) {
    if (error.message?.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
    console.error("[ticketeria] relatório da porta:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = relatorioDaSessao(data);
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}
