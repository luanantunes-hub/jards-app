// GET /api/ticketeria/porta-equipe/{token}/buscar?q={nome}: a equipe da porta (sem login) acha os ingressos DESTA sessão pelo nome de quem comprou (até 15). O segredo do link é a prova.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { TOKEN_DO_LINK, resultadoDaBusca } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: NextRequest, rota: { params: Promise<{ token: string }> }) {
  const { token } = await rota.params;
  if (!TOKEN_DO_LINK.test(token)) return resposta({ error: "link_invalido" }, 404);
  const termo = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_porta_equipe_buscar", { p_token: token, p_termo: termo });
  if (error) {
    if (error.message?.includes("link_invalido")) return resposta({ error: "link_invalido" }, 404);
    console.error("[ticketeria] busca da equipe:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = resultadoDaBusca(data);
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}
