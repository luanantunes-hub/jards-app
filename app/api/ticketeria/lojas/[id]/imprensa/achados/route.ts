// GET /api/ticketeria/lojas/{id}/imprensa/achados: o que a leitura da imprensa achou: os casos dúbios que esperam confirmação e os claros registrados sozinhos (30 dias).
// Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { achadosDaLoja } from "@/lib/ticketeria/imprensa-monitor-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-achados", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await achadosDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] achados da imprensa:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
