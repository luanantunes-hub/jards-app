// GET /api/ticketeria/publico/{chave}/sessoes/{sessao}: uma sessão com os ingressos à venda (preço da vez, se há e se são poucos; nunca quantos restam). A sessão tem de ser da loja da
// chave: de outra loja, de uma sessão que não existe ou de uma chave que não vale, a resposta é a mesma (404). Leitura aberta (CORS); o limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email/config";
import { CABECALHOS_PUBLICOS, UUID, sessaoDetalhada } from "@/lib/ticketeria/integracao";
import { lojaDaChavePublica, lojaDaSessao } from "@/lib/ticketeria/integracao-servidor";
import { vitrineDaSessao } from "@/lib/ticketeria/vitrine-servidor";

export const dynamic = "force-dynamic";
const SEM_CACHE = { ...CABECALHOS_PUBLICOS, "cache-control": "no-store" };
const nao = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CABECALHOS_PUBLICOS });
}

export async function GET(_req: NextRequest, rota: { params: Promise<{ chave: string; sessao: string }> }) {
  const { chave, sessao } = await rota.params;
  if (!UUID.test(sessao)) return nao();
  const admin = createAdminClient();
  try {
    const loja = await lojaDaChavePublica(admin, chave);
    if (!loja || (await lojaDaSessao(admin, sessao.toLowerCase())) !== loja.loja_id) return nao();
    const vitrine = await vitrineDaSessao(admin, sessao.toLowerCase());
    if (!vitrine) return nao();
    return NextResponse.json(sessaoDetalhada(vitrine, appUrl()), { headers: CABECALHOS_PUBLICOS });
  } catch (erro) {
    console.error("[ticketeria] API pública (sessão):", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "falha_na_api" }, { status: 500, headers: SEM_CACHE });
  }
}
