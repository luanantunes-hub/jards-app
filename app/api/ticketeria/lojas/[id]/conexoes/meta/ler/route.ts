// POST /api/ticketeria/lojas/{id}/conexoes/meta/ler: lê agora o gasto do Meta (o botão "Ler agora"). Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerConexaoAgora, metaConfigurada } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexao-meta-ler", max: 6 });
  if (a.erro) return a.erro;
  const config = metaConfigurada();
  if (!config) return resposta({ error: "meta_indisponivel" }, 503);
  const admin = createAdminClient();
  const { data: c } = await clienteDaTicketeria(admin).from("ticketeria_conexoes_midia").select("id").eq("loja_id", a.loja.id).eq("provedor", "meta").maybeSingle();
  if (!c) return resposta({ error: "sem_conexao" }, 404);
  const leitura = await lerConexaoAgora(admin, config, c.id);
  if (!leitura) return resposta({ error: "conexao_inativa" }, 409);
  return resposta(leitura, leitura.ok ? 200 : 502);
}
