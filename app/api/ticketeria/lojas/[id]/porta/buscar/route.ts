// GET /api/ticketeria/lojas/{id}/porta/buscar?sessao={id}&q={nome}: acha os ingressos de uma sessão pelo nome de quem comprou (até 15), para quem perdeu o celular ou não achou o QR Code.
// Quem pede precisa EDITAR a Ticketeria da organização da loja. Termo de menos de 2 letras não busca.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { resultadoDaBusca } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "porta-buscar", max: 240 });
  if (a.erro) return a.erro;
  const sessao = req.nextUrl.searchParams.get("sessao") ?? "";
  const termo = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  if (!UUID.test(sessao)) return resposta({ error: "sessao_invalida" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_porta_buscar", { p_loja: a.loja.id, p_sessao: sessao.toLowerCase(), p_termo: termo });
  if (error) {
    if (error.message?.includes("sessao_inexistente")) return resposta({ error: "sessao_inexistente" }, 404);
    console.error("[ticketeria] busca na porta:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = resultadoDaBusca(data);
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}
