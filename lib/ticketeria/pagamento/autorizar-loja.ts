import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { isRateLimited } from "@/lib/mcp/rateLimit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

/** Quem pede precisa estar logado e poder EDITAR a Ticketeria da organização da loja. Devolve a loja, o usuário e os clientes (do usuário e de serviço), ou a resposta de erro. */
export async function autorizarLoja(rota: { params: Promise<{ id: string }> }, limite: { chave: string; max: number } = { chave: "conta-asaas", max: 10 }) {
  const { id } = await rota.params;
  if (!UUID.test(id)) return { erro: resposta({ error: "loja_invalida" }, 400) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: resposta({ error: "nao_autenticado" }, 401) };
  if (isRateLimited(`${limite.chave}:${user.id}`, limite.max)) return { erro: resposta({ error: "muitas_tentativas" }, 429) };
  const ticketeria = clienteDaTicketeria(supabase);
  const { data: loja } = await ticketeria.from("ticketeria_lojas").select("id, organization_id").eq("id", id).maybeSingle();
  if (!loja) return { erro: resposta({ error: "loja_nao_encontrada" }, 404) };
  const { data: pode } = await ticketeria.rpc("auth_ticketeria_pode", { p_org: loja.organization_id, p_acao: "editar" });
  if (pode !== true) return { erro: resposta({ error: "sem_permissao" }, 403) };
  return { loja, user, ticketeria, admin: clienteDaTicketeria(createAdminClient()) };
}
