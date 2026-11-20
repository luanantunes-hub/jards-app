// GET /api/ticketeria/lojas/{id}/conexoes/{provedor}/iniciar: abre o login da plataforma (o navegador do produtor vai para o Meta ou para o Google). Guarda um cookie de 10 minutos que liga a
// ida e a volta. Sem as credenciais da plataforma no servidor responde 503 (o botão Conectar nem aparece). `provedor` é `meta` ou `google`.

import { NextResponse, type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { provedorDaUrl } from "@/lib/ticketeria/midia/provedores";
import { abrirSessaoDoLogin, adaptadorConfigurado } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string; provedor: string }> }) {
  const provedor = provedorDaUrl((await rota.params).provedor);
  if (!provedor) return resposta({ error: "provedor_invalido" }, 404);
  const a = await autorizarLoja(rota, { chave: `conexao-${provedor}-iniciar`, max: 20 });
  if (a.erro) return a.erro;
  const adaptador = adaptadorConfigurado(provedor);
  if (!adaptador) return resposta({ error: "conector_indisponivel" }, 503);
  const nonce = await abrirSessaoDoLogin(a.loja.id, a.user.id, provedor);
  return NextResponse.redirect(adaptador.urlDeLogin(nonce));
}
