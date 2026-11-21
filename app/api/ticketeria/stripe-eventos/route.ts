// POST /api/ticketeria/stripe-eventos: os avisos (webhook) do Stripe sobre a assinatura do e-mail da Ticketeria: pagamento concluído, mudança de situação (atraso, cancelamento, renovação).
// Sem login: a assinatura do aviso, feita com o segredo deste endereço (STRIPE_WEBHOOK_SECRET_TICKETERIA_EMAIL), é a prova. É um endereço próprio, separado do webhook do plano e da prestação,
// e só mexe em assinaturas marcadas com o produto "ticketeria_email". O aviso só diz QUAL assinatura mudou: o estado vem do Stripe, na hora, então aviso fora de ordem não estraga nada.
//
//   → 200 { ok: true | "ignorado" }   → 400 assinatura inválida   → 503 sem segredo (falha fechada)   → 500 erro nosso (o Stripe tenta de novo)

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { novoStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarAssinaturaDoEmail } from "@/lib/ticketeria/assinatura-email-servidor";

export const dynamic = "force-dynamic";
const TAMANHO_MAXIMO = 512 * 1024;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

/** O id da assinatura que o aviso cita, ou null se o aviso não é de assinatura. */
function assinaturaDoAviso(evento: Stripe.Event): string | null {
  const o = evento.data.object as unknown as Record<string, unknown>;
  switch (evento.type) {
    case "checkout.session.completed":
      return typeof o.subscription === "string" ? o.subscription : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return typeof o.id === "string" ? o.id : null;
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET_TICKETERIA_EMAIL;
  const stripe = novoStripe();
  if (!segredo || !stripe) return resposta({ error: "nao_configurado" }, 503);
  const corpo = await req.text();
  if (new TextEncoder().encode(corpo).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  const assinatura = req.headers.get("stripe-signature");
  let evento: Stripe.Event;
  try {
    if (!assinatura) throw new Error("sem assinatura");
    evento = stripe.webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return resposta({ error: "assinatura_invalida" }, 400);
  }
  const assinaturaId = assinaturaDoAviso(evento);
  if (!assinaturaId) return resposta({ ok: "ignorado" }, 200);
  try {
    const situacao = await aplicarAssinaturaDoEmail(createAdminClient(), stripe, assinaturaId);
    return resposta({ ok: situacao ? true : "ignorado" }, 200);
  } catch (erro) {
    console.error("[ticketeria] aviso do Stripe (e-mail):", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha" }, 500);
  }
}
