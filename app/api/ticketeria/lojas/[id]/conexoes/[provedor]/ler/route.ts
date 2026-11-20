// POST /api/ticketeria/lojas/{id}/conexoes/{provedor}/ler: lê agora o gasto da plataforma (o botão "Ler agora"). Quem pede precisa EDITAR a Ticketeria da organização.

import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { provedorDaUrl } from "@/lib/ticketeria/midia/provedores";
import { adaptadorConfigurado, lerConexaoAgora } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string; provedor: string }> }) {
  const provedor = provedorDaUrl((await rota.params).provedor);
  if (!provedor) return resposta({ error: "provedor_invalido" }, 404);
  const a = await autorizarLoja(rota, { chave: `conexao-${provedor}-ler`, max: 6 });
  if (a.erro) return a.erro;
  if (!adaptadorConfigurado(provedor)) return resposta({ error: "conector_indisponivel" }, 503);
  const admin = createAdminClient();
  const { data: c } = await clienteDaTicketeria(admin).from("ticketeria_conexoes_midia").select("id").eq("loja_id", a.loja.id).eq("provedor", provedor).maybeSingle();
  if (!c) return resposta({ error: "sem_conexao" }, 404);
  const leitura = await lerConexaoAgora(admin, c.id);
  if (!leitura) return resposta({ error: "conexao_inativa" }, 409);
  return resposta(leitura, leitura.ok ? 200 : 502);
}
