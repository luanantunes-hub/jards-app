import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import type { ProvedorDeMidia } from "@/lib/ticketeria/midia/provedores";
import { adaptadorConfigurado, fecharSessaoDoLogin, lerSessaoDoLogin, origemDoApp } from "@/lib/ticketeria/midia/servidor";

/**
 * A volta do login (Meta ou Google; cada plataforma tem o seu endereço de retorno cadastrado, e o do Google serve ao Google Ads e ao GA4). Confere o cookie e o `state`, confere de novo que a pessoa edita a Ticketeria da
 * loja, troca o código pelo token (que vai para o Vault) e leva o produtor à escolha da conta de anúncios. Qualquer falha volta para a tela com um aviso (`?aba=conexoes&{provedor}=…`).
 */
export async function concluirLogin(req: NextRequest, aceitos: ProvedorDeMidia | readonly ProvedorDeMidia[]): Promise<NextResponse> {
  const lista = Array.isArray(aceitos) ? (aceitos as readonly ProvedorDeMidia[]) : [aceitos as ProvedorDeMidia];
  const { searchParams } = req.nextUrl;
  const sessao = await lerSessaoDoLogin();
  await fecharSessaoDoLogin();
  // O mesmo endereço de retorno serve a mais de um provedor (Google Ads e GA4): o cookie de 10 minutos diz qual abriu o login.
  const provedor: ProvedorDeMidia = sessao && lista.includes(sessao.provedor) ? sessao.provedor : lista[0];
  const volta = (resultado: string) => NextResponse.redirect(new URL(`/ingressos/divulgacao?aba=conexoes&conexao=${provedor}&resultado=${resultado}`, origemDoApp()));
  const adaptador = adaptadorConfigurado(provedor);
  if (!adaptador) return volta("indisponivel");
  // O produtor fechou a janela da plataforma ou não deixou a permissão.
  if (searchParams.get("error")) return volta("negado");
  const codigo = searchParams.get("code");
  const state = searchParams.get("state");
  if (!codigo || !state || !sessao || sessao.nonce !== state || sessao.provedor !== provedor) return volta("invalido");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== sessao.usuario) return volta("invalido");
  const { data: loja } = await clienteDaTicketeria(supabase).from("ticketeria_lojas").select("id, organization_id").eq("id", sessao.loja).maybeSingle();
  if (!loja) return volta("invalido");
  const { data: pode } = await clienteDaTicketeria(supabase).rpc("auth_ticketeria_pode", { p_org: loja.organization_id, p_acao: "editar" });
  if (pode !== true) return volta("invalido");
  try {
    const t = await adaptador.trocarCodigo(codigo);
    const { error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_midia_guardar_conexao", { p_loja: loja.id, p_provedor: provedor, p_token: t.token, p_expira_em: t.expira_em });
    if (error) throw new Error(error.message);
    return volta("escolher");
  } catch (erro) {
    console.error(`[ticketeria] retorno do login (${provedor}):`, erro instanceof Error ? erro.message : erro);
    return volta("falhou");
  }
}
