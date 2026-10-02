import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";

const SEAT_PRICE_ID = process.env.STRIPE_PRICE_SEAT ?? "";
const UNIT_PRICE = 19.9;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function authenticatedUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function requireAdmin(organizationId: string, userId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("organization_members")
    .select("papel")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.papel === "admin";
}

async function seatSummary(organizationId: string) {
  const admin = adminClient();
  const [
    { data: seats, error: seatError },
    { count, error: countError },
    { count: pendingCount, error: pendingError },
  ] = await Promise.all([
    admin.from("organization_seats").select("purchased_seats, billing_user_id, stripe_subscription_item_id").eq("organization_id", organizationId).maybeSingle(),
    // Mesma exclusão usada pelos RPCs que de fato validam capacidade
    // (add_organization_member_with_seat / reserve_organization_invitation):
    // captador e proponente não consomem assento.
    admin.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).not("papel", "in", "(captador,proponente)"),
    admin.from("organization_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending").not("role", "in", "(captador,proponente)"),
  ]);
  if (seatError) throw seatError;
  if (countError) throw countError;
  if (pendingError) throw pendingError;
  const purchased = seats?.purchased_seats ?? 0;
  const occupied = count ?? 0;
  const pending = pendingCount ?? 0;
  return {
    included: 1,
    purchased,
    total: 1 + purchased,
    occupied,
    pending,
    available: Math.max(0, 1 + purchased - occupied - pending),
    unit_price: UNIT_PRICE,
    billing_user_id: seats?.billing_user_id ?? null,
    stripe_subscription_item_id: seats?.stripe_subscription_item_id ?? null,
  };
}

export async function GET(req: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organization_id");
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });
  if (!await requireAdmin(organizationId, user.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  try {
    return NextResponse.json(await seatSummary(organizationId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar usuários extras" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    organization_id?: string;
    quantity?: number;
    request_id?: string;
  } | null;
  const organizationId = body?.organization_id ?? "";
  const quantity = Number(body?.quantity);
  const requestId = body?.request_id ?? "";
  if (!organizationId || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || !requestId) {
    return NextResponse.json({ error: "Compra de usuários extras inválida" }, { status: 400 });
  }
  if (!await requireAdmin(organizationId, user.id)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!SEAT_PRICE_ID || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Preço de usuário extra ainda não configurado" }, { status: 503 });
  }

  const admin = adminClient();
  const { data: previousPurchase } = await admin
    .from("organization_seat_purchases")
    .select("status, resulting_quantity")
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .eq("billing_user_id", user.id)
    .maybeSingle();
  if (previousPurchase?.status === "completed") {
    return NextResponse.json({ ok: true, ...(await seatSummary(organizationId)), reused: true });
  }
  if (previousPurchase?.status === "pending") {
    return NextResponse.json({ error: "Esta compra ainda está sendo processada" }, { status: 409 });
  }

  const summary = await seatSummary(organizationId);
  if (summary.billing_user_id && summary.billing_user_id !== user.id) {
    return NextResponse.json({ error: "Somente o administrador responsável pela assinatura pode comprar usuários extras" }, { status: 403 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("plano, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile?.stripe_subscription_id || profile.plano === "gratuito") {
    return NextResponse.json({ error: "É necessário ter um plano pago ativo para comprar usuários extras" }, { status: 402 });
  }

  const resultingQuantity = summary.purchased + quantity;
  const { error: purchaseError } = await admin.from("organization_seat_purchases").upsert({
    id: requestId,
    organization_id: organizationId,
    billing_user_id: user.id,
    quantity,
    previous_quantity: summary.purchased,
    resulting_quantity: resultingQuantity,
    status: "pending",
    error: null,
    completed_at: null,
  }, { onConflict: "id" });
  if (purchaseError) {
    if (purchaseError.code === "23505") {
      return NextResponse.json({ error: "Já existe uma compra de usuários extras em processamento" }, { status: 409 });
    }
    return NextResponse.json({ error: purchaseError.message }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let itemId = summary.stripe_subscription_item_id;
  let createdItem = false;
  try {
    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, { expand: ["items"] });
    const currentItem = subscription.items.data.find(item => item.id === itemId || item.price.id === SEAT_PRICE_ID);
    itemId = currentItem?.id ?? null;

    if (itemId) {
      await stripe.subscriptionItems.update(itemId, {
        quantity: resultingQuantity,
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      }, { idempotencyKey: `seat-purchase:${requestId}` });
    } else {
      const created = await stripe.subscriptionItems.create({
        subscription: profile.stripe_subscription_id,
        price: SEAT_PRICE_ID,
        quantity: resultingQuantity,
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      }, { idempotencyKey: `seat-purchase:${requestId}` });
      itemId = created.id;
      createdItem = true;
    }

    const { error: seatError } = await admin.from("organization_seats").upsert({
      organization_id: organizationId,
      billing_user_id: user.id,
      purchased_seats: resultingQuantity,
      stripe_subscription_item_id: itemId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    if (seatError) throw seatError;

    const { error: completeError } = await admin.from("organization_seat_purchases").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", requestId);
    if (completeError) throw completeError;

    return NextResponse.json({ ok: true, ...(await seatSummary(organizationId)) });
  } catch (error) {
    try {
      if (itemId && createdItem) {
        await stripe.subscriptionItems.del(itemId, { proration_behavior: "none" });
      } else if (itemId) {
        await stripe.subscriptionItems.update(itemId, {
          quantity: summary.purchased,
          proration_behavior: "none",
        });
      }
    } catch (rollbackError) {
      console.error("Falha ao reverter compra de usuários extras", rollbackError);
    }
    const message = error instanceof Error ? error.message : "Falha ao comprar usuários extras";
    await admin.from("organization_seat_purchases").update({ status: "failed", error: message.slice(0, 1000) }).eq("id", requestId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
