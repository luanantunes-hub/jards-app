// POST /api/ticketeria/compra/espera/sair: quem recebeu o e-mail de aviso sai da lista de espera pelo link (o token do link é a prova).
//
//   { token }  → 200 { saiu: true | false }   (false: já tinha saído ou o link não vale)
//
// É POST de propósito: o link do e-mail abre uma página com um botão, e só o botão apaga (programas que leem os e-mails abrem links sem querer).

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const texto = await req.text();
  if (texto.length > 512) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const token = typeof (bruto as { token?: unknown })?.token === "string" ? (bruto as { token: string }).token.trim() : "";
  if (!UUID.test(token)) return resposta({ saiu: false }, 200);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_espera_sair", { p_token: token.toLowerCase() });
  if (error) {
    console.error("[ticketeria] sair da espera:", error.message);
    return resposta({ error: "falha" }, 500);
  }
  return resposta({ saiu: data === true }, 200);
}
