import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { MARCA_DO_CHECKOUT, VERSAO_DA_API_COM_MARCA } from "../_shared/marca-checkout.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const ALLOWED_PRICE_IDS = new Set([
  Deno.env.get("STRIPE_PRICE_BASICO"),
  Deno.env.get("STRIPE_PRICE_PROFISSIONAL"),
].filter((value): value is string => Boolean(value)));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verifica JWT do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Sem autorização" }), { status: 401, headers: corsHeaders });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Usuário inválido" }), { status: 401, headers: corsHeaders });

    const { price_id, success_url, cancel_url } = await req.json() as {
      price_id: string;
      success_url: string;
      cancel_url: string;
    };

    if (!ALLOWED_PRICE_IDS.has(price_id)) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assinatura e plano pertencem ao perfil do usuário.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    let customerId = profile?.stripe_customer_id as string | undefined;

    // Cria customer no Stripe se não existir
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (updateError) throw updateError;
    }

    const parametros: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      locale: "pt-BR",
      subscription_data: {
        metadata: { user_id: user.id },
      },
      metadata: { user_id: user.id },
    };

    // A aparência da marca só existe nas versões novas da API (esta função usa a
    // 2024-06-20). Nelas a assinatura nasceria em cobrança "flexible": fica a
    // "classic" de sempre, para mudar só a aparência. Se o Stripe recusar o
    // pedido com a marca, o pagamento abre com a aparência padrão.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          ...parametros,
          subscription_data: { ...parametros.subscription_data, billing_mode: { type: "classic" } },
          branding_settings: MARCA_DO_CHECKOUT,
        } as Stripe.Checkout.SessionCreateParams,
        { apiVersion: VERSAO_DA_API_COM_MARCA },
      );
    } catch (erroDaMarca) {
      // Erros de rede ou de limite não têm a ver com a marca: repetir só abriria outra sessão.
      if ((erroDaMarca as { type?: string } | null)?.type !== "StripeInvalidRequestError") throw erroDaMarca;
      console.error("Checkout sem a aparência da marca", erroDaMarca);
      session = await stripe.checkout.sessions.create(parametros);
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
