// GET /api/ticketeria/lojas/{id}/esgotamento: os eventos esgotados com anúncio ainda gastando (pelas campanhas marcadas com o evento) e os quase esgotados. Quem pede precisa EDITAR a
// Ticketeria da organização. → { esgotados: [...], quase: [...] }

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esgotamentoDaLoja } from "@/lib/ticketeria/esgotamento-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "esgotamento", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await esgotamentoDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] esgotamento:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
