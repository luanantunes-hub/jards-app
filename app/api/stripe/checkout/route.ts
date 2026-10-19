import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PRICE_IDS: Record<string, string> = {
  basico: process.env.STRIPE_PRICE_BASICO!,
  profissional: process.env.STRIPE_PRICE_PROFISSIONAL!,
};

// Status em que a assinatura ainda existe no Stripe (cobrando ou aguardando pagamento).
const ASSINATURA_VIGENTE = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

export async function HEAD() {
  const configured = !!process.env.STRIPE_SECRET_KEY;
  return new NextResponse(null, { status: configured ? 200 : 503 });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll() },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

  // Quem já tem assinatura troca de plano pelo portal: um checkout novo criaria
  // uma segunda assinatura, cobrada junto com a primeira.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("stripe_subscription_id, stripe_subscription_status")
    .eq("id", user.id)
    .maybeSingle();
  if (perfil?.stripe_subscription_id && ASSINATURA_VIGENTE.includes(perfil.stripe_subscription_status)) {
    return NextResponse.json({ error: "Você já tem uma assinatura. Para trocar de plano, use Gerenciar assinatura." }, { status: 409 });
  }

  const { plano, organization_id } = await req.json() as { plano: string; organization_id?: string };
  const price_id = PRICE_IDS[plano];
  if (!price_id) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

  // A assinatura é da organização. O webhook (fn_process_stripe_billing_event) cobra a
  // organização da linha de créditos de quem paga ou, sem ela, a primeira em que a pessoa
  // é admin: assinar pela organização aberta só vale se a pessoa a administra, se ninguém
  // já paga por ela e se é essa a organização que o webhook vai cobrar.
  if (organization_id) {
    const { data: vinculo } = await supabase
      .from("organization_members")
      .select("papel")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (vinculo?.papel !== "admin") {
      return NextResponse.json({ error: "Quem administra a organização assina o plano." }, { status: 403 });
    }
    const { data: ativa } = await supabase.rpc("fn_org_assinatura_ativa", { p_organization_id: organization_id });
    if (ativa === true) {
      return NextResponse.json({ error: "A organização já tem uma assinatura ativa." }, { status: 409 });
    }
    const { data: linhaPropria } = await supabase
      .from("creditos")
      .select("organization_id")
      .eq("account_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    const { data: primeiraAdmin } = linhaPropria
      ? { data: null }
      : await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("papel", "admin")
          .order("created_at")
          .limit(1)
          .maybeSingle();
    const cobrada = linhaPropria?.organization_id ?? primeiraAdmin?.organization_id ?? null;
    if (cobrada !== organization_id) {
      return NextResponse.json({ error: "Esta assinatura seria cobrada em outra organização sua. Fale com o suporte para assinar esta." }, { status: 409 });
    }
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";
  // A volta do pagamento passa pela tela que confere a compra e a avisa ao
  // Google Ads (com o aceite dos cookies); o Stripe preenche {CHECKOUT_SESSION_ID}.
  const destino = `/patrocinadores?welcome=paid&plan=${encodeURIComponent(plano)}`;
  const success_url = `${origin}/assinatura/concluida?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(destino)}`;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      price_id,
      success_url,
      cancel_url: `${origin}/meu-plano?canceled=1`,
    }),
  });

  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
