// GET /api/ticketeria/publico/{chave}/eventos: os eventos publicados da loja, com as sessões que ainda vão acontecer, o estado de cada uma e o preço "a partir de". Leitura aberta (CORS),
// sem login: a chave pública só diz de qual loja é o pedido. Chave errada, desligada ou de formato estranho responde sempre igual (404). O limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email/config";
import { CABECALHOS_PUBLICOS } from "@/lib/ticketeria/integracao";
import { eventosDaLoja, lojaDaChavePublica } from "@/lib/ticketeria/integracao-servidor";

export const dynamic = "force-dynamic";
const SEM_CACHE = { ...CABECALHOS_PUBLICOS, "cache-control": "no-store" };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CABECALHOS_PUBLICOS });
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ chave: string }> }) {
  const { chave } = await rota.params;
  const admin = createAdminClient();
  try {
    const loja = await lojaDaChavePublica(admin, chave);
    if (!loja) return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
    return NextResponse.json(await eventosDaLoja(admin, loja.loja_id, appUrl()), { headers: CABECALHOS_PUBLICOS });
  } catch (erro) {
    console.error("[ticketeria] API pública (eventos):", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "falha_na_api" }, { status: 500, headers: SEM_CACHE });
  }
}
