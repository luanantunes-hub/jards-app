import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { lerModuloDeVagas, mensagemCompraIndisponivel } from "@/lib/equipe-modulos";
import { dependenciasDeEquipe } from "@/lib/equipe-servidor";
import type { ModuloId } from "@/lib/modulos";
import { novoStripe } from "@/lib/stripe";

const SEAT_PRICE_ID = process.env.STRIPE_PRICE_SEAT ?? "";
const UNIT_PRICE = 19.9;

const adminClient = () => dependenciasDeEquipe.criarAdmin();
const authenticatedUser = () => dependenciasDeEquipe.usuarioAtual();

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
    // Mesma contagem de modulo_vagas_em_uso (20261005130000): só quem usa a
    // captação, sem captador e proponente, que não consomem assento.
    admin.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).contains("modulos_acesso", ["captacao"]).not("papel", "in", "(captador,proponente)"),
    admin.from("organization_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending").contains("modulos_acesso", ["captacao"]).not("role", "in", "(captador,proponente)"),
  ]);
  if (seatError) throw seatError;
  if (countError) throw countError;
  if (pendingError) throw pendingError;
  const purchased = seats?.purchased_seats ?? 0;
  const occupied = count ?? 0;
  const pending = pendingCount ?? 0;
  return {
    modulo: "captacao" as const,
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

/**
 * Vagas de um módulo com contrato (prestação de contas, produção): vêm do
 * contrato do módulo (cortesia ou assinatura), contadas pelas mesmas funções
 * que o banco usa ao convidar. Sem contrato em vigor, o módulo vem inativo.
 */
async function resumoDoModulo(organizationId: string, modulo: Exclude<ModuloId, "captacao">) {
  const admin = adminClient();
  const [limite, emUso, contrato, membros, pendentes] = await Promise.all([
    admin.rpc("modulo_vagas_limite", { p_org: organizationId, p_modulo: modulo }),
    admin.rpc("modulo_vagas_em_uso", { p_org: organizationId, p_modulo: modulo }),
    admin.from("organization_modulos").select("status, cortesia_ate").eq("organization_id", organizationId).eq("modulo", modulo).maybeSingle(),
    admin.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).contains("modulos_acesso", [modulo]).not("papel", "in", "(captador,proponente)"),
    admin.from("organization_invitations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending").contains("modulos_acesso", [modulo]).not("role", "in", "(captador,proponente)"),
  ]);
  const erro = limite.error ?? emUso.error ?? contrato.error ?? membros.error ?? pendentes.error;
  if (erro) throw erro;
  const total = Number(limite.data ?? 0);
  return {
    modulo,
    ativo: total > 0,
    status: contrato.data?.status ?? null,
    cortesia_ate: contrato.data?.cortesia_ate ?? null,
    total,
    occupied: membros.count ?? 0,
    pending: pendentes.count ?? 0,
    available: Math.max(0, total - Number(emUso.data ?? 0)),
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
  const modulo = lerModuloDeVagas(req.nextUrl.searchParams.get("modulo") ?? undefined);
  if (!modulo) return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  try {
    return NextResponse.json(modulo === "captacao" ? await seatSummary(organizationId) : await resumoDoModulo(organizationId, modulo));
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
    modulo?: unknown;
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
  // Sem o campo vale a captação; nome que não é módulo é recusado, nunca vira compra da captação.
  const modulo = lerModuloDeVagas(body?.modulo);
  if (!modulo) return NextResponse.json({ error: "Módulo inválido" }, { status: 400 });
  if (!SEAT_PRICE_ID || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Preço de usuário extra ainda não configurado" }, { status: 503 });
  }
  // Cada módulo vende as vagas do seu jeito. Só a captação e a prestação vendem vaga extra por aqui; a
  // produção espera a cobrança por módulo (PDL.1), que depende do preço, decisão do dono. Módulo sem ramo
  // próprio é recusado, nunca vira compra da captação.
  switch (modulo) {
    case "prestacao": return comprarVagasDaPrestacao(organizationId, user.id, quantity, requestId);
    case "captacao": break;
    default: return NextResponse.json({ error: mensagemCompraIndisponivel(modulo) }, { status: 409 });
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

  const stripe = novoStripe() ?? new Stripe(process.env.STRIPE_SECRET_KEY);
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

/**
 * Usuários extras da prestação de contas (P5.6): item do preço de vaga na
 * assinatura do módulo, que é da organização. Só quem paga a assinatura
 * compra; o contrato é atualizado na hora e o webhook confirma depois.
 */
async function comprarVagasDaPrestacao(organizationId: string, userId: string, quantity: number, requestId: string) {
  const admin = adminClient();
  const { data: contrato, error: contratoError } = await admin
    .from("organization_modulos")
    .select("status, billing_user_id, stripe_subscription_id, stripe_item_vagas_id, vagas_compradas")
    .eq("organization_id", organizationId)
    .eq("modulo", "prestacao")
    .maybeSingle();
  if (contratoError) return NextResponse.json({ error: "Falha ao consultar a assinatura" }, { status: 500 });
  if (!contrato?.stripe_subscription_id || !["ativo", "teste", "atraso"].includes(contrato.status)) {
    return NextResponse.json({ error: "É necessário assinar a prestação de contas para comprar usuários extras" }, { status: 402 });
  }
  if (contrato.billing_user_id !== userId) {
    return NextResponse.json({ error: "Somente quem paga a assinatura da prestação pode comprar usuários extras" }, { status: 403 });
  }

  const { data: previousPurchase } = await admin
    .from("organization_seat_purchases")
    .select("status")
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .eq("billing_user_id", userId)
    .maybeSingle();
  if (previousPurchase?.status === "completed") {
    return NextResponse.json({ ok: true, ...(await resumoDoModulo(organizationId, "prestacao")), reused: true });
  }
  if (previousPurchase?.status === "pending") {
    return NextResponse.json({ error: "Esta compra ainda está sendo processada" }, { status: 409 });
  }

  const previous = contrato.vagas_compradas ?? 0;
  const resultingQuantity = previous + quantity;
  const { error: purchaseError } = await admin.from("organization_seat_purchases").upsert({
    id: requestId,
    organization_id: organizationId,
    billing_user_id: userId,
    modulo: "prestacao",
    quantity,
    previous_quantity: previous,
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

  const stripe = novoStripe() ?? new Stripe(process.env.STRIPE_SECRET_KEY!);
  let itemId: string | null = contrato.stripe_item_vagas_id;
  let createdItem = false;
  try {
    const subscription = await stripe.subscriptions.retrieve(contrato.stripe_subscription_id, { expand: ["items"] });
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
        subscription: contrato.stripe_subscription_id,
        price: SEAT_PRICE_ID,
        quantity: resultingQuantity,
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      }, { idempotencyKey: `seat-purchase:${requestId}` });
      itemId = created.id;
      createdItem = true;
    }

    const { error: contratoUpdateError } = await admin.from("organization_modulos")
      .update({ vagas_compradas: resultingQuantity, stripe_item_vagas_id: itemId })
      .eq("organization_id", organizationId)
      .eq("modulo", "prestacao");
    if (contratoUpdateError) throw contratoUpdateError;

    const { error: completeError } = await admin.from("organization_seat_purchases").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", requestId);
    if (completeError) throw completeError;

    return NextResponse.json({ ok: true, ...(await resumoDoModulo(organizationId, "prestacao")) });
  } catch (error) {
    try {
      if (itemId && createdItem) {
        await stripe.subscriptionItems.del(itemId, { proration_behavior: "none" });
      } else if (itemId) {
        await stripe.subscriptionItems.update(itemId, { quantity: previous, proration_behavior: "none" });
      }
    } catch (rollbackError) {
      console.error("Falha ao reverter compra de usuários extras da prestação", rollbackError);
    }
    const message = error instanceof Error ? error.message : "Falha ao comprar usuários extras";
    await admin.from("organization_seat_purchases").update({ status: "failed", error: message.slice(0, 1000) }).eq("id", requestId);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
