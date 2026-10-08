// Assinatura do módulo de prestação de contas no Stripe (P5.6).
//
// Lida do mesmo jeito pelo webhook do app (app/api/stripe/webhook) e pela
// edge function stripe-webhook, e montada no checkout do app
// (app/api/prestacao/assinatura). Sem dependências: recebe só os campos da
// assinatura que usa, nas duas versões da API do Stripe (o fim do período
// fica na assinatura nas antigas e em cada item nas novas).

export const MODULO_PRESTACAO = "prestacao";

/** Só para exibir; o valor cobrado é o do preço no Stripe. */
export const PRECO_MODULO_MENSAL = 92.8;
export const PRECO_VAGA_MENSAL = 19.9;
export const VAGAS_EXTRAS_MAX = 50;

export type PrecosDoModulo = { modulo: string; vaga: string };

type ItemDaAssinatura = {
  id: string;
  price: { id: string } | string;
  quantity?: number | null;
  current_period_end?: number | null;
};

export type AssinaturaStripe = {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string> | null;
  current_period_end?: number | null;
  items: { data: ItemDaAssinatura[] };
};

export type DadosDoContrato = {
  organizationId: string;
  billingUserId: string | null;
  customerId: string;
  subscriptionId: string;
  itemModuloId: string | null;
  itemVagasId: string | null;
  vagas: number;
  status: string;
  periodoFim: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const precoDoItem = (item: ItemDaAssinatura) => typeof item.price === "string" ? item.price : item.price?.id;

/** A assinatura é do módulo: marcada no checkout ou com o preço do módulo. */
export function ehAssinaturaDoModulo(assinatura: AssinaturaStripe, precos: PrecosDoModulo): boolean {
  if (assinatura.metadata?.modulo === MODULO_PRESTACAO) return true;
  return !!precos.modulo && assinatura.items.data.some(item => precoDoItem(item) === precos.modulo);
}

/** O que o contrato guarda da assinatura, ou o motivo de não dar para ler. */
export function dadosDoContrato(
  assinatura: AssinaturaStripe,
  precos: PrecosDoModulo,
): { ok: true; dados: DadosDoContrato } | { ok: false; erro: string } {
  const organizationId = assinatura.metadata?.organization_id ?? "";
  if (!UUID.test(organizationId)) return { ok: false, erro: `Assinatura ${assinatura.id} sem a organização` };
  const itens = assinatura.items.data;
  if (!precos.vaga && itens.length > 1) {
    return { ok: false, erro: "Preço do usuário extra (STRIPE_PRICE_SEAT) não configurado" };
  }
  const itemModulo = itens.find(item => precoDoItem(item) === precos.modulo) ?? null;
  const itensVagas = precos.vaga ? itens.filter(item => precoDoItem(item) === precos.vaga) : [];
  const fim = assinatura.current_period_end ?? itemModulo?.current_period_end ?? itens[0]?.current_period_end ?? null;
  const usuario = assinatura.metadata?.user_id ?? "";
  return {
    ok: true,
    dados: {
      organizationId,
      billingUserId: UUID.test(usuario) ? usuario : null,
      customerId: typeof assinatura.customer === "string" ? assinatura.customer : assinatura.customer.id,
      subscriptionId: assinatura.id,
      itemModuloId: itemModulo?.id ?? null,
      itemVagasId: itensVagas[0]?.id ?? null,
      vagas: itensVagas.reduce((soma, item) => soma + (item.quantity ?? 0), 0),
      status: assinatura.status,
      periodoFim: fim ? new Date(fim * 1000).toISOString() : null,
    },
  };
}

/** Parâmetros de fn_processar_cobranca_modulo para um evento do Stripe. */
export function parametrosDaCobranca(evento: { id: string; type: string }, dados: DadosDoContrato) {
  return {
    p_event_id: evento.id,
    p_event_type: evento.type,
    p_organization_id: dados.organizationId,
    p_modulo: MODULO_PRESTACAO,
    p_billing_user_id: dados.billingUserId,
    p_customer_id: dados.customerId,
    p_subscription_id: dados.subscriptionId,
    p_item_modulo_id: dados.itemModuloId,
    p_item_vagas_id: dados.itemVagasId,
    p_vagas: dados.vagas,
    p_stripe_status: dados.status,
    p_periodo_fim: dados.periodoFim,
  };
}

/** Itens do checkout: o módulo e, se pedidos, os usuários extras. */
export function itensDoCheckout(precos: PrecosDoModulo, vagasExtras: number): { price: string; quantity: number }[] {
  const itens = [{ price: precos.modulo, quantity: 1 }];
  if (vagasExtras > 0) itens.push({ price: precos.vaga, quantity: vagasExtras });
  return itens;
}

/** Quantidade de usuários extras pedida na tela: inteiro de 0 a VAGAS_EXTRAS_MAX. */
export function vagasExtrasValidas(valor: unknown): number | null {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero <= VAGAS_EXTRAS_MAX ? numero : null;
}
