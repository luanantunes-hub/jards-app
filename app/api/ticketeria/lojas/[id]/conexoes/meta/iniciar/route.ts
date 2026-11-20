// GET /api/ticketeria/lojas/{id}/conexoes/meta/iniciar: abre o login da Meta (o navegador do produtor vai para o Facebook). Guarda um cookie de 10 minutos que liga a ida e a volta.
// Sem as credenciais do app da Meta no servidor responde 503 (o botão Conectar nem aparece).

import { NextResponse, type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { urlDeLoginDaMeta } from "@/lib/ticketeria/midia/meta";
import { abrirSessaoDoLogin, metaConfigurada } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "conexao-meta-iniciar", max: 20 });
  if (a.erro) return a.erro;
  const config = metaConfigurada();
  if (!config) return resposta({ error: "meta_indisponivel" }, 503);
  const nonce = await abrirSessaoDoLogin(a.loja.id, a.user.id);
  return NextResponse.redirect(urlDeLoginDaMeta(config, nonce));
}
