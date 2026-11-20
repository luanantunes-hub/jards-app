// GET /api/ticketeria/lojas/{id}/inicio: os números da página inicial da Ticketeria (hoje e ontem, saldos, visão geral por período e listas curtas).
// Quem pede precisa EDITAR a Ticketeria da organização (a mesma regra das vendas: tem dado pessoal e dinheiro). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { inicioDaLoja } from "@/lib/ticketeria/vendas-servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "inicio", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await inicioDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] início da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
