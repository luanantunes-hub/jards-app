// GET /api/ticketeria/conexoes/meta/retorno: a volta do login da Meta (este é o endereço cadastrado no app da Meta). Confere o cookie e o `state`, confere de novo que a pessoa
// edita a Ticketeria da loja, troca o código pelo token (que vai para o Vault) e leva o produtor à escolha da conta de anúncios. Qualquer falha volta para a tela com um aviso.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { trocarCodigoPeloToken } from "@/lib/ticketeria/midia/meta";
import { buscarNaMeta, fecharSessaoDoLogin, lerSessaoDoLogin, metaConfigurada, origemDoApp } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";

const volta = (meta: string) => NextResponse.redirect(new URL(`/ingressos/divulgacao?aba=conexoes&meta=${meta}`, origemDoApp()));

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessao = await lerSessaoDoLogin();
  await fecharSessaoDoLogin();
  const config = metaConfigurada();
  if (!config) return volta("indisponivel");
  // O produtor fechou a janela da Meta ou não deixou a permissão.
  if (searchParams.get("error")) return volta("negado");
  const codigo = searchParams.get("code");
  const state = searchParams.get("state");
  if (!codigo || !state || !sessao || sessao.nonce !== state) return volta("invalido");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== sessao.usuario) return volta("invalido");
  const { data: loja } = await clienteDaTicketeria(supabase).from("ticketeria_lojas").select("id, organization_id").eq("id", sessao.loja).maybeSingle();
  if (!loja) return volta("invalido");
  const { data: pode } = await clienteDaTicketeria(supabase).rpc("auth_ticketeria_pode", { p_org: loja.organization_id, p_acao: "editar" });
  if (pode !== true) return volta("invalido");
  try {
    const t = await trocarCodigoPeloToken(config, codigo, buscarNaMeta);
    const { error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_midia_guardar_conexao", { p_loja: loja.id, p_provedor: "meta", p_token: t.token, p_expira_em: t.expira_em });
    if (error) throw new Error(error.message);
    return volta("escolher");
  } catch (erro) {
    console.error("[ticketeria] retorno do login da Meta:", erro instanceof Error ? erro.message : erro);
    return volta("falhou");
  }
}
