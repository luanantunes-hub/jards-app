// POST /api/ticketeria/novidades/sair: quem recebeu um e-mail de divulgação do produtor sai da lista pelo link (o token do link é a prova).
//
//   { token }                       → 200 { saiu: true | false }   (false: o link não vale)
//   ?token=…  (corpo "List-Unsubscribe=One-Click")                  → o mesmo; é o clique único do próprio programa de e-mail (RFC 8058)
//
// É POST de propósito: o link do e-mail abre uma página com um botão, e só o botão grava a saída (programas que leem os e-mails abrem links sem querer). A saída vale para a loja
// do envio, para sempre.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const texto = await req.text();
  if (texto.length > 512) return resposta({ error: "corpo_grande_demais" }, 413);
  let token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    try { const bruto = JSON.parse(texto) as { token?: unknown }; token = typeof bruto?.token === "string" ? bruto.token.trim() : ""; } catch { /* corpo que não é JSON: sem token */ }
  }
  if (!UUID.test(token)) return resposta({ saiu: false }, 200);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_novidades_sair", { p_token: token.toLowerCase() });
  if (error) {
    console.error("[ticketeria] sair das novidades:", error.message);
    return resposta({ error: "falha" }, 500);
  }
  return resposta({ saiu: data === true }, 200);
}
