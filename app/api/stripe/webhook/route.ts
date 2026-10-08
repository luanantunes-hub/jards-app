// Este endpoint recebe webhooks do Stripe diretamente.
// A lógica principal roda na Edge Function stripe-webhook no Supabase.
// Esta rota é um fallback local para desenvolvimento.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { novoStripe, PRECOS_MODULO } from "@/lib/stripe";
import {
  dadosDoContrato,
  ehAssinaturaDoModulo,
  parametrosDaCobranca,
  type AssinaturaStripe,
} from "@/supabase/functions/_shared/cobranca-modulo";

const PRICE_TO_PLAN: Record<string, "basico" | "profissional"> = {
  [process.env.STRIPE_PRICE_BASICO ?? ""]:        "basico",
  [process.env.STRIPE_PRICE_PROFISSIONAL ?? ""]:  "profissional",
};

function planFromSubscription(subscription: Stripe.Subscription) {
  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    const plano = PRICE_TO_PLAN[priceId];
    if (plano) return { priceId, plano };
  }
  return null;
}

function subscriptionUserId(subscription: Stripe.Subscription): string | null {
  return subscription.metadata?.user_id
    ?? subscription.metadata?.supabase_uid
    ?? subscription.metadata?.account_id
    ?? null;
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const raw = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    start: raw.current_period_start ? new Date(raw.current_period_start * 1000).toISOString() : null,
    end: raw.current_period_end ? new Date(raw.current_period_end * 1000).toISOString() : null,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: {
      type?: string;
      subscription_details?: { subscription?: string | { id?: string } | null } | null;
    } | null;
  };
  const value = raw.subscription ?? raw.parent?.subscription_details?.subscription ?? null;
  return typeof value === "string" ? value : value?.id ?? null;
}

type SupportedStatus =
  | "inactive" | "trialing" | "active" | "past_due" | "unpaid"
  | "paused" | "canceled" | "incomplete" | "incomplete_expired";

function normalizedStatus(status: Stripe.Subscription.Status | "inactive"): SupportedStatus {
  return status === "active" || status === "trialing" || status === "past_due"
    || status === "unpaid" || status === "paused" || status === "canceled"
    || status === "incomplete" || status === "incomplete_expired"
    ? status
    : "inactive";
}

async function processBillingEvent(
  supabase: ReturnType<typeof adminClient>,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  options: { invoiceId?: string | null; paid?: boolean; forcedStatus?: SupportedStatus } = {},
) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const plan = planFromSubscription(subscription);
  const period = subscriptionPeriod(subscription);
  const { data, error } = await supabase.rpc("fn_process_stripe_billing_event", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_user_id: subscriptionUserId(subscription),
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_invoice_id: options.invoiceId ?? null,
    p_price_id: plan?.priceId ?? null,
    p_plan: plan?.plano ?? null,
    p_subscription_status: options.forcedStatus ?? normalizedStatus(subscription.status),
    p_period_start: period.start,
    p_period_end: period.end,
    p_paid: options.paid === true,
  });
  if (error) throw error;
  return data;
}

// Assinatura do módulo de prestação de contas (P5.6): é da organização e vai
// para o contrato do módulo, nunca para o plano do perfil. O estado vem do
// Stripe na hora, para eventos fora de ordem aplicarem sempre o mais novo.
async function processModuleEvent(
  stripe: Stripe,
  supabase: ReturnType<typeof adminClient>,
  event: Stripe.Event,
  subscriptionId: string,
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as AssinaturaStripe;
  const lido = dadosDoContrato(subscription, PRECOS_MODULO);
  if (!lido.ok) throw new Error(lido.erro);
  const { error } = await supabase.rpc("fn_processar_cobranca_modulo" as never, parametrosDaCobranca(event, lido.dados) as never);
  if (error) throw error;
}

const isModuleSubscription = (subscription: Stripe.Subscription) =>
  ehAssinaturaDoModulo(subscription as unknown as AssinaturaStripe, PRECOS_MODULO);

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });

  const stripe = novoStripe() ?? new Stripe(secretKey);

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
  }

  const supabase = adminClient();

  try {
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) throw new Error("Fatura sem assinatura");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (isModuleSubscription(subscription)) {
        await processModuleEvent(stripe, supabase, event, subscriptionId);
      } else {
        if (!planFromSubscription(subscription)) throw new Error(`Assinatura Stripe sem preço de plano conhecido: ${subscriptionId}`);
        await processBillingEvent(supabase, event, subscription, {
          invoiceId: invoice.id,
          paid: true,
          forcedStatus: "active",
        });
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) throw new Error("Fatura sem assinatura");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (isModuleSubscription(subscription)) {
        await processModuleEvent(stripe, supabase, event, subscriptionId);
      } else {
        await processBillingEvent(supabase, event, subscription, {
          invoiceId: invoice.id,
          forcedStatus: "past_due",
        });
      }
    }

    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      if (isModuleSubscription(subscription)) await processModuleEvent(stripe, supabase, event, subscription.id);
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      if (isModuleSubscription(subscription)) {
        await processModuleEvent(stripe, supabase, event, subscription.id);
      } else {
        if (!planFromSubscription(subscription) && ["active", "trialing"].includes(subscription.status)) {
          throw new Error(`Assinatura Stripe sem preço de plano conhecido: ${subscription.id}`);
        }
        await processBillingEvent(supabase, event, subscription);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      if (isModuleSubscription(subscription)) {
        await processModuleEvent(stripe, supabase, event, subscription.id);
      } else {
        await processBillingEvent(supabase, event, subscription, { forcedStatus: "canceled" });
      }
    }
  } catch (error) {
    console.error("Stripe webhook handler error", error);
    return NextResponse.json({ error: "Falha ao persistir evento Stripe" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
