// GET /api/ticketeria/lojas/{id}/modelo: a prontidão do modelo de marketing (MMM) da loja: se já há vendas, gasto e variação de gasto para o modelo rodar, e o que falta. Só leitura.
// Quem pede precisa EDITAR a Ticketeria da organização (a mesma regra das vendas e da divulgação).

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { prontidaoDaLoja } from "@/lib/ticketeria/modelo-servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "modelo", max: 20 });
  if (a.erro) return a.erro;
  try {
    return resposta(await prontidaoDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] prontidão do modelo:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
