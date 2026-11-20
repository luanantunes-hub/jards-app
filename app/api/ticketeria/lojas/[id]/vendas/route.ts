// GET /api/ticketeria/lojas/{id}/vendas: as vendas da loja para a tela do produtor (resumo, sessões e compras). Quem pede precisa EDITAR a Ticketeria da organização
// (a mesma regra do banco para ler pedidos: tem dado pessoal e dinheiro). Só leitura.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { vendasDaLoja } from "@/lib/ticketeria/vendas-servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "vendas", max: 30 });
  if (a.erro) return a.erro;
  try {
    return resposta(await vendasDaLoja(createAdminClient(), a.loja.id));
  } catch (erro) {
    console.error("[ticketeria] vendas da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
