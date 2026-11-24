// GET /api/ticketeria/lojas/{id}/imprensa: as críticas e matérias marcadas, com o que as vendas mostraram em cada uma, o resumo por veículo, os veículos já marcados e o pico de venda sem
// explicação ("saiu algo na imprensa?"). Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { imprensaDaLoja } from "@/lib/ticketeria/imprensa-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await imprensaDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] imprensa:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
