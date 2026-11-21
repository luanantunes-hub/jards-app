// POST /api/ticketeria/lojas/{id}/remetente/assinar: abre o checkout do Stripe da assinatura do e-mail (R$ 32,90 por mês, no cartão). Só quem ADMINISTRA a organização assina (é cobrança).
//   → 200 { url }   o endereço do checkout; ao pagar, o Stripe volta para a aba E-mail com ?assinatura=ok&session_id=… e o aviso do Stripe (ou a confirmação) ativa a assinatura
//   → 403 so_administrador | 409 ja_assinado | 503 cobranca_nao_configurada | 502 falha_ao_abrir_o_pagamento
// A assinatura é da loja, mas o cliente no Stripe é o da pessoa que paga (o mesmo do plano e do portal), então o portal de cobrança mostra tudo junto.

import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { novoStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUTO_DO_EMAIL } from "@/lib/ticketeria/assinatura-email";
import { remetenteDaLoja } from "@/lib/ticketeria/remetente-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { MARCA_DO_CHECKOUT } from "@/supabase/functions/_shared/marca-checkout";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente-assinar", max: 6 });
  if (a.erro) return a.erro;
  const preco = process.env.STRIPE_PRICE_TICKETERIA_EMAIL;
  const stripe = novoStripe();
  if (!stripe || !preco) return resposta({ error: "cobranca_nao_configurada" }, 503);
  try {
    const admin = createAdminClient();
    const { data: membro } = await admin.from("organization_members").select("papel").eq("organization_id", a.loja.organization_id).eq("user_id", a.user.id).maybeSingle();
    if (membro?.papel !== "admin") return resposta({ error: "so_administrador" }, 403);
    const atual = await remetenteDaLoja(admin, a.loja.id);
    if (atual && (atual.assinatura === "ativa" || atual.assinatura === "inadimplente")) return resposta({ error: "ja_assinado" }, 409);

    const { data: perfil } = await admin.from("profiles").select("full_name, stripe_customer_id").eq("id", a.user.id).maybeSingle();
    let clienteId = (perfil?.stripe_customer_id as string | null) ?? null;
    if (!clienteId) {
      const cliente = await stripe.customers.create({ email: a.user.email, name: perfil?.full_name ?? a.user.email, metadata: { user_id: a.user.id } });
      clienteId = cliente.id;
      const { error } = await admin.from("profiles").update({ stripe_customer_id: clienteId }).eq("id", a.user.id);
      if (error) throw new Error(error.message);
    }

    const origem = req.headers.get("origin") ?? req.nextUrl.origin;
    const volta = `${origem}/ingressos/publico?aba=email`;
    const metadata = { produto: PRODUTO_DO_EMAIL, ticketeria_loja_id: a.loja.id, organization_id: a.loja.organization_id, user_id: a.user.id };
    const parametros = {
      customer: clienteId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: preco, quantity: 1 }],
      success_url: `${volta}&assinatura=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${volta}&assinatura=cancelada`,
      locale: "pt-BR",
      client_reference_id: a.loja.id,
      subscription_data: { metadata },
      metadata,
    } satisfies Stripe.Checkout.SessionCreateParams;
    // Se o Stripe recusar o pedido com a aparência da marca, o pagamento abre com a padrão; outros erros seguem adiante (repetir só abriria outra sessão).
    const sessao = await stripe.checkout.sessions.create({ ...parametros, branding_settings: MARCA_DO_CHECKOUT })
      .catch((erroDaMarca: unknown) => {
        if ((erroDaMarca as { type?: string } | null)?.type !== "StripeInvalidRequestError") throw erroDaMarca;
        console.error("[ticketeria] checkout do e-mail sem a aparência da marca", erroDaMarca);
        return stripe.checkout.sessions.create(parametros);
      });
    if (!sessao.url) throw new Error("Checkout sem endereço");
    return resposta({ url: sessao.url });
  } catch (erro) {
    console.error("[ticketeria] checkout do e-mail:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_abrir_o_pagamento" }, 502);
  }
}
