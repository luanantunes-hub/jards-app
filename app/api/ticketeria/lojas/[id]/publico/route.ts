// GET /api/ticketeria/lojas/{id}/publico: as pessoas que compraram ou entraram na lista de espera da loja, uma linha por e-mail, com o aceite de novidades. Quem pede precisa EDITAR a
// Ticketeria da organização (a mesma regra das vendas: tem nome, e-mail e telefone). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicoDaLoja } from "@/lib/ticketeria/publico-servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "publico", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await publicoDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] público da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
