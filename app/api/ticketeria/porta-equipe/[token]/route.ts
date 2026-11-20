// /api/ticketeria/porta-equipe/{token}: a equipe da porta (sem login). O segredo do link é a prova; o banco confere se ele está valendo (ligado, dentro da validade, sessão não cancelada).
//
//   GET                   o evento, o dia da sessão, o nome do link e o resumo (válidos, entraram, últimas entradas)
//   POST { codigo }       confere o código só nesta sessão e, se vale, marca como usado (uma vez só): pode_entrar, ja_usado, outra_sessao, cancelado ou nao_encontrado
// Link que não vale (errado, desligado, vencido) responde 404, sempre igual: não diz o que houve. O limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { TOKEN_DO_LINK, normalizarCodigo, resultadoDaConferencia, resumoDaEquipe } from "@/lib/ticketeria/porta";

export const dynamic = "force-dynamic";
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });
const link404 = () => resposta({ error: "link_invalido" }, 404);

export async function GET(_req: NextRequest, rota: { params: Promise<{ token: string }> }) {
  const { token } = await rota.params;
  if (!TOKEN_DO_LINK.test(token)) return link404();
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_porta_equipe_resumo", { p_token: token });
  if (error) {
    if (error.message?.includes("link_invalido")) return link404();
    console.error("[ticketeria] porta da equipe:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = resumoDaEquipe(data);
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}

export async function POST(req: NextRequest, rota: { params: Promise<{ token: string }> }) {
  const { token } = await rota.params;
  if (!TOKEN_DO_LINK.test(token)) return link404();
  let corpo: { codigo?: unknown };
  try { corpo = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const codigo = typeof corpo.codigo === "string" ? normalizarCodigo(corpo.codigo.slice(0, 500)) : "";
  if (codigo === "") return resposta({ error: "dados_invalidos" }, 400);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_porta_equipe_conferir", { p_token: token, p_codigo: codigo });
  if (error) {
    if (error.message?.includes("link_invalido")) return link404();
    console.error("[ticketeria] conferência da equipe:", error.message);
    return resposta({ error: "falha_na_porta" }, 500);
  }
  const r = resultadoDaConferencia(data, "America/Sao_Paulo");
  return r ? resposta(r) : resposta({ error: "resposta_inesperada" }, 500);
}
