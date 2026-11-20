// GET /api/ticketeria/lojas/{id}/conexoes: o estado das conexões de mídia da loja (Meta Ads e Google Ads): se cada conector está disponível (as credenciais da plataforma estão no
// servidor) e a conexão da loja, sem nenhum segredo. Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { PROVEDORES_DE_MIDIA } from "@/lib/ticketeria/midia/provedores";
import { adaptadorConfigurado, conexaoDaLoja } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexoes", max: 60 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const estado: Record<string, { disponivel: boolean; conexao: Awaited<ReturnType<typeof conexaoDaLoja>> }> = {};
    for (const p of PROVEDORES_DE_MIDIA) estado[p] = { disponivel: adaptadorConfigurado(p) !== null, conexao: await conexaoDaLoja(admin, a.loja.id, p) };
    return resposta(estado);
  } catch (erro) {
    console.error("[ticketeria] conexões da loja:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
