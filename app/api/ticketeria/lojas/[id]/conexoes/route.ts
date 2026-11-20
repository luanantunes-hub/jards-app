// GET /api/ticketeria/lojas/{id}/conexoes: o estado das conexões de mídia da loja (hoje só o Meta Ads): se o conector está disponível (as credenciais do app da Meta estão no
// servidor) e a conexão da loja, sem nenhum segredo. Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { conexaoMetaDaLoja, metaConfigurada } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexoes", max: 60 });
  if (a.erro) return a.erro;
  try {
    return resposta({ meta: { disponivel: metaConfigurada() !== null, conexao: await conexaoMetaDaLoja(createAdminClient(), a.loja.id) } });
  } catch (erro) {
    console.error("[ticketeria] conexões da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
