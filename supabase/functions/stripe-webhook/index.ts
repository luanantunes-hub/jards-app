import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_BASICO = Deno.env.get("STRIPE_PRICE_BASICO")!;
const PRICE_PROFISSIONAL = Deno.env.get("STRIPE_PRICE_PROFISSIONAL")!;

function planoFromPrice(priceId: string): "basico" | "profissional" | null {
  if (priceId === PRICE_PROFISSIONAL) return "profissional";
  if (priceId === PRICE_BASICO) return "basico";
  return null;
}

function planFromSubscription(subscription: Stripe.Subscription) {
  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    const plano = planoFromPrice(priceId);
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

function normalizedStatus(status: Stripe.Subscription.Status): SupportedStatus {
  return status === "active" || status === "trialing" || status === "past_due"
    || status === "unpaid" || status === "paused" || status === "canceled"
    || status === "incomplete" || status === "incomplete_expired"
    ? status
    : "inactive";
}

async function processBillingEvent(
  supabase: ReturnType<typeof createClient>,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  options: { invoiceId?: string | null; paid?: boolean; forcedStatus?: SupportedStatus } = {},
) {
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const plan = planFromSubscription(subscription);
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
    p_period_start: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null,
    p_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    p_paid: options.paid === true,
  });
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret!);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) throw new Error("Fatura sem assinatura");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (!planFromSubscription(subscription)) throw new Error(`Assinatura sem preço de plano conhecido: ${subscriptionId}`);
      await processBillingEvent(supabase, event, subscription, {
        invoiceId: invoice.id,
        paid: true,
        forcedStatus: "active",
      });
      console.log(`Pagamento processado — invoice ${invoice.id}`);
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (!subscriptionId) throw new Error("Fatura sem assinatura");
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await processBillingEvent(supabase, event, subscription, {
        invoiceId: invoice.id,
        forcedStatus: "past_due",
      });
      console.log(`Assinatura suspensa por falha de pagamento — invoice ${invoice.id}`);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      await processBillingEvent(supabase, event, subscription, { forcedStatus: "canceled" });
      console.log(`Assinatura cancelada — subscription ${subscription.id}`);
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      const plan = planFromSubscription(subscription);
      if (!plan && ["active", "trialing"].includes(subscription.status)) {
        throw new Error(`Assinatura sem preço de plano conhecido: ${subscription.id}`);
      }
      await processBillingEvent(supabase, event, subscription);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
