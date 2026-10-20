// Assinatura do módulo de prestação de contas (P5.6).
//
// GET: a situação da assinatura da organização, para Meu plano e para o aviso
// nas telas da prestação. Quem é da organização vê; o contrato só é lido pelo
// servidor (organization_modulos não é lida pelo navegador).
// POST: abre o checkout do Stripe para o admin assinar o módulo, com usuários
// extras opcionais. A assinatura é da organização e própria, separada do
// plano de captação; o webhook ativa o contrato quando o Stripe confirma.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type Stripe from "stripe";
import { novoStripe, PRECOS_MODULO } from "@/lib/stripe";
import { descricaoDaAssinatura, type AssinaturaDoModulo } from "@/lib/modulos-contrato";
import {
  itensDoCheckout,
  MODULO_PRESTACAO,
  PRECO_MODULO_MENSAL,
  PRECO_VAGA_MENSAL,
  vagasExtrasValidas,
} from "@/supabase/functions/_shared/cobranca-modulo";
import { MARCA_DO_CHECKOUT } from "@/supabase/functions/_shared/marca-checkout";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function usuarioLogado() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

const cobrancaConfigurada = () => !!novoStripe() && !!PRECOS_MODULO.modulo && !!PRECOS_MODULO.vaga;

async function situacao(organizationId: string, userId: string) {
  const admin = adminClient();
  const [membro, contrato, limite, emUso] = await Promise.all([
    admin.from("organization_members").select("papel").eq("organization_id", organizationId).eq("user_id", userId).maybeSingle(),
    admin.from("organization_modulos")
      .select("status, cortesia_ate, past_due_since, vagas_cortesia, vagas_compradas, periodo_fim, encerrado_em, stripe_subscription_id, billing_user_id, teste_gratis")
      .eq("organization_id", organizationId).eq("modulo", MODULO_PRESTACAO).maybeSingle(),
    admin.rpc("modulo_vagas_limite", { p_org: organizationId, p_modulo: MODULO_PRESTACAO }),
    admin.rpc("modulo_vagas_em_uso", { p_org: organizationId, p_modulo: MODULO_PRESTACAO }),
  ]);
  const erro = membro.error ?? contrato.error ?? limite.error ?? emUso.error;
  if (erro) throw erro;
  if (!membro.data) return null;
  const dados = contrato.data as (AssinaturaDoModulo & { billing_user_id: string | null }) | null;
  const descricao = descricaoDaAssinatura(dados);
  const admin_ = membro.data.papel === "admin";
  return {
    descricao,
    status: dados?.status ?? null,
    admin: admin_,
    responsavelCobranca: !!dados?.billing_user_id && dados.billing_user_id === userId,
    vagas: {
      total: Number(limite.data ?? 0),
      emUso: Number(emUso.data ?? 0),
      compradas: dados?.status === "cortesia" ? 0 : dados?.vagas_compradas ?? 0,
    },
    precos: { modulo: PRECO_MODULO_MENSAL, vaga: PRECO_VAGA_MENSAL },
    cobrancaConfigurada: cobrancaConfigurada(),
  };
}

export async function GET(req: NextRequest) {
  const user = await usuarioLogado();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const organizationId = req.nextUrl.searchParams.get("organization_id") ?? "";
  if (!UUID.test(organizationId)) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });
  try {
    const resposta = await situacao(organizationId, user.id);
    if (!resposta) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a assinatura" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await usuarioLogado();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => null) as { organization_id?: string; vagas_extras?: unknown } | null;
  const organizationId = body?.organization_id ?? "";
  const vagasExtras = vagasExtrasValidas(body?.vagas_extras ?? 0);
  if (!UUID.test(organizationId) || vagasExtras === null) {
    return NextResponse.json({ error: "Pedido de assinatura inválido" }, { status: 400 });
  }

  const atual = await situacao(organizationId, user.id).catch(() => null);
  if (!atual) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  if (!atual.admin) return NextResponse.json({ error: "Só quem administra a organização assina o módulo" }, { status: 403 });
  if (!atual.descricao.podeAssinar) {
    return NextResponse.json({ error: "A organização já tem a assinatura. Para mudar, use Gerenciar assinatura." }, { status: 409 });
  }
  const stripe = novoStripe();
  if (!stripe || !PRECOS_MODULO.modulo || !PRECOS_MODULO.vaga) {
    return NextResponse.json({ error: "Cobrança do módulo ainda não configurada" }, { status: 503 });
  }

  const admin = adminClient();
  const { data: perfil, error: erroPerfil } = await admin
    .from("profiles").select("full_name, stripe_customer_id").eq("id", user.id).maybeSingle();
  if (erroPerfil) return NextResponse.json({ error: "Não foi possível abrir o pagamento" }, { status: 500 });

  try {
    // O cliente no Stripe é o da pessoa, como no plano de captação: o portal
    // mostra as duas assinaturas juntas.
    let customerId = perfil?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: perfil?.full_name ?? user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      const { error } = await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      if (error) throw error;
    }

    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    const destino = "/meu-plano?modulo=prestacao&success=1";
    const metadata = { organization_id: organizationId, modulo: MODULO_PRESTACAO, user_id: user.id };
    const parametros = {
      customer: customerId,
      mode: "subscription",
      line_items: itensDoCheckout(PRECOS_MODULO, vagasExtras),
      success_url: `${origin}/assinatura/concluida?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(destino)}`,
      cancel_url: `${origin}/meu-plano?modulo=prestacao&canceled=1`,
      locale: "pt-BR",
      subscription_data: { metadata },
      metadata,
    } satisfies Stripe.Checkout.SessionCreateParams;
    // Se o Stripe recusar o pedido com a aparência da marca, o pagamento abre com a padrão.
    // Outros erros (rede, limite) seguem adiante: repetir só abriria outra sessão.
    const sessao = await stripe.checkout.sessions.create({ ...parametros, branding_settings: MARCA_DO_CHECKOUT })
      .catch((erroDaMarca: unknown) => {
        if ((erroDaMarca as { type?: string } | null)?.type !== "StripeInvalidRequestError") throw erroDaMarca;
        console.error("Checkout do módulo sem a aparência da marca", erroDaMarca);
        return stripe.checkout.sessions.create(parametros);
      });
    if (!sessao.url) throw new Error("Checkout sem endereço");
    return NextResponse.json({ url: sessao.url });
  } catch (error) {
    console.error("Checkout do módulo de prestação", error);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento" }, { status: 502 });
  }
}
