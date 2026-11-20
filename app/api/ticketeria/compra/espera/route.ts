// POST /api/ticketeria/compra/espera: o comprador (sem login) entra na lista de espera de um ingresso esgotado.
//
//   { sessao_id, ingresso_id, nome, email, quantidade }
//   → 201 { situacao: "entrou" | "ja_na_lista" }
//   → 409 { error, mensagem }   (ainda há lugar, lista cheia, sessão ou ingresso indisponível)
//   → 400 { error: "dados_invalidos", problemas }
//
// Não reserva nada e não cobra nada. O limite por IP está no proxy.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerCorpoDaEspera, mensagemDoErroDaEspera } from "@/lib/ticketeria/espera";

export const dynamic = "force-dynamic";
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const texto = await req.text();
  if (texto.length > 2048) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDaEspera(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problemas: leitura.problemas }, 400);
  const c = leitura.corpo;
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_espera_entrar", { p_sessao: c.sessao_id, p_ingresso: c.ingresso_id, p_nome: c.nome, p_email: c.email, p_quantidade: c.quantidade });
  if (error) {
    const conhecido = /ainda_ha_lugar|lista_cheia|sessao_indisponivel|evento_nao_publicado|ingresso_indisponivel|ingresso_de_outro_local|comprador_invalido|quantidade_invalida/.test(error.message ?? "");
    if (!conhecido) console.error("[ticketeria] entrar na espera:", error.message);
    return resposta({ error: conhecido ? (error.message.match(/[a-z_]{6,}/)?.[0] ?? "recusada") : "falha", mensagem: mensagemDoErroDaEspera(error.message ?? "") }, conhecido ? 409 : 500);
  }
  return resposta({ situacao: data === "ja_na_lista" ? "ja_na_lista" : "entrou" }, 201);
}
