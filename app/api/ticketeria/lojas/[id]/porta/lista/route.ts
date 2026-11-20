// GET /api/ticketeria/lojas/{id}/porta/lista?sessao={id}: a lista de todos os ingressos da sessão em CSV (comprador, ingresso, lugar, situação, hora de entrada), para baixar.
// Tem dado pessoal: só quem EDITA a Ticketeria da organização da loja, com limite baixo por pessoa. Nunca fica em cache.

import { NextResponse, type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { csvDaLista } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-lista", max: 10 });
  if (a.erro) return a.erro;
  const sessao = req.nextUrl.searchParams.get("sessao") ?? "";
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_lista", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase() });
  if (error) {
    if (error.message?.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
    console.error("[ticketeria] lista da porta:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const csv = csvDaLista(data);
  if (!csv) return resposta({ error: "resposta_inesperada" }, 500);
  return new NextResponse(csv, { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="porta-${sessao.slice(0, 8)}.csv"`, "cache-control": "no-store" } });
}
