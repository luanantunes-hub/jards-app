// GET /api/ticketeria/lojas/{id}/divulgacao: de onde vieram as vendas da loja (por sessão e canal) e as sessões para criar link de divulgação. Quem pede precisa EDITAR a
// Ticketeria da organização (a mesma regra das vendas: o pedido tem dado pessoal e dinheiro). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { divulgacaoDaLoja } from "@/lib/ticketeria/divulgacao-servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "divulgacao", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await divulgacaoDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] divulgação da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
