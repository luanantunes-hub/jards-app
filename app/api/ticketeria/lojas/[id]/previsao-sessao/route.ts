// GET /api/ticketeria/lojas/{id}/previsao-sessao[?evento={id}]: como cada dia e horário vende na casa e, com o evento, a procura sobrando (sessões esgotadas e lista de espera) e as
// opções do "e se eu acrescentar uma sessão?". Quem pede precisa EDITAR a Ticketeria da organização. → { hoje, dias, frase, evento }

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previsaoDaLoja } from "@/lib/ticketeria/previsao-sessao-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "previsao-sessao", max: 30 });
  if (a.erro) return a.erro;
  const evento = req.nextUrl.searchParams.get("evento");
  if (evento !== null && !UUID.test(evento)) return resposta({ error: "evento_invalido" }, 400);
  try {
    return resposta(await previsaoDaLoja(createAdminClient(), a.loja.id, evento?.toLowerCase() ?? null));
  } catch (erro) {
    console.error("[ticketeria] previsão por sessão:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
