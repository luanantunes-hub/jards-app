import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { novoStripe } from "@/lib/stripe";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  const stripe = novoStripe() ?? new Stripe(stripeSecret);

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll() },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Busca o customer no perfil, a fonte canônica dos dados de assinatura.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile, error } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const customerId = profile?.stripe_customer_id as string | null;
  if (!customerId) return NextResponse.json({ error: "Sem assinatura ativa" }, { status: 400 });

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/meu-plano`,
  });

  return NextResponse.json({ url: portalSession.url });
}
