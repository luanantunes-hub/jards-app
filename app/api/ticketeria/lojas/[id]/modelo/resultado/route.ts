// GET /api/ticketeria/lojas/{id}/modelo/resultado: o último resultado bom do modelo de marketing da loja, ao lado do que os links de divulgação mostram ({ resultado: … } ou { resultado: null }).
// Quem pede precisa EDITAR a Ticketeria da organização (a mesma regra das vendas e da divulgação).

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { resultadoDaLoja } from "@/lib/ticketeria/modelo-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "modelo-resultado", max: 20 });
  if (a.erro) return a.erro;
  try {
    return resposta({ resultado: await resultadoDaLoja(createAdminClient(), a.loja.id) });
  } catch (erro) {
    console.error("[ticketeria] resultado do modelo:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
