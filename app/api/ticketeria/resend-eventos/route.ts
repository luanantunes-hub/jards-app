// POST /api/ticketeria/resend-eventos: os avisos (webhook) do Resend sobre os e-mails de divulgação: entregue, aberto, clicado, devolvido e reclamação de spam. Sem login: a assinatura Svix do aviso,
// feita com o segredo deste endereço (TICKETERIA_RESEND_WEBHOOK_SECRET, diferente do segredo do webhook de e-mails recebidos), é a prova.
//
//   → 200 { ok: true | "ignorado" | "nao_encontrado" | "ja_registrado" }   (sempre 200 para o que é válido, para o Resend não tentar de novo)
//   → 401 assinatura inválida; 503 sem o segredo configurado (falha fechada); 400 corpo ilegível; 500 erro do banco (o Resend tenta de novo)
//
// Cada pessoa conta uma vez por evento. Devolução permanente e reclamação de spam também põem o e-mail na lista de saídas da loja: não se manda mais para ele.

import { NextResponse, type NextRequest } from "next/server";
import { webhookDoResendValido } from "@/lib/email/webhook-resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerEventoDoEmail } from "@/lib/ticketeria/eventos-de-email";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 64 * 1024;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const segredo = process.env.TICKETERIA_RESEND_WEBHOOK_SECRET;
  if (!segredo) return resposta({ error: "nao_configurado" }, 503);
  const corpo = await req.text();
  if (new TextEncoder().encode(corpo).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  if (!webhookDoResendValido(req.headers, corpo, segredo)) return resposta({ error: "assinatura_invalida" }, 401);
  let bruto: unknown;
  try { bruto = JSON.parse(corpo); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const evento = lerEventoDoEmail(bruto);
  if (!evento) return resposta({ ok: "ignorado" }, 200);
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_registrar_evento_envio", { p_provedor_id: evento.provedorId, p_tipo: evento.tipo, p_quando: evento.quando, p_permanente: evento.permanente });
  if (error) {
    console.error("[ticketeria] evento do e-mail:", error.message);
    return resposta({ error: "falha" }, 500);
  }
  return resposta({ ok: data === "ok" ? true : String(data) }, 200);
}
