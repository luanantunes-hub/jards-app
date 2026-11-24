// A assinatura do e-mail da Ticketeria (R$ 32,90 por mês, cartão, no Stripe): traduz a assinatura do Stripe para o que o banco guarda (`ticketeria_remetentes`). Só regra, sem rede nem banco;
// quem chama (a rota de eventos do Stripe e a de confirmar o pagamento) busca a assinatura no Stripe e grava o resultado.

import type { AssinaturaDoEmail } from "@/lib/ticketeria/estados";

/** A marca que vai nos metadados do checkout e da assinatura: é assim que o aviso do Stripe diz de qual loja é. */
export const PRODUTO_DO_EMAIL = "ticketeria_email";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ItemDoStripe = { current_period_start?: number | null; current_period_end?: number | null };
/** O pedaço da assinatura do Stripe de que precisamos (a API nova guarda o período no item, a antiga na própria assinatura). */
export type AssinaturaDoStripe = {
  id: string; status: string; customer: string | { id: string } | null;
  cancel_at_period_end?: boolean | null; cancel_at?: number | null;
  current_period_start?: number | null; current_period_end?: number | null;
  items?: { data: ItemDoStripe[] };
  metadata?: Record<string, string> | null;
};

export type DadosDaAssinatura = {
  assinatura: AssinaturaDoEmail; stripe_customer_id: string | null; stripe_subscription_id: string;
  periodo_inicio: string | null; periodo_fim: string | null; cancela_no_fim: boolean;
};

/** Ativa e em teste valem como "ativa"; cartão recusado ou cobrança parada é "inadimplente" (o envio pausa); cancelada é cancelada; o resto (pagamento ainda aberto) é "pendente". */
export function assinaturaDoStatus(status: string): AssinaturaDoEmail {
  if (status === "active" || status === "trialing") return "ativa";
  if (status === "past_due" || status === "unpaid" || status === "paused") return "inadimplente";
  if (status === "canceled" || status === "incomplete_expired") return "cancelada";
  return "pendente";
}

const data = (segundos: number | null | undefined): string | null => typeof segundos === "number" && Number.isFinite(segundos) ? new Date(segundos * 1000).toISOString() : null;

export function dadosDaAssinatura(s: AssinaturaDoStripe): DadosDaAssinatura {
  const item = s.items?.data?.[0];
  return {
    assinatura: assinaturaDoStatus(s.status),
    stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
    stripe_subscription_id: s.id,
    periodo_inicio: data(s.current_period_start ?? item?.current_period_start),
    periodo_fim: data(s.current_period_end ?? item?.current_period_end),
    cancela_no_fim: Boolean(s.cancel_at_period_end || s.cancel_at),
  };
}

/** De qual loja é esta assinatura (ou checkout): só vale se a marca do produto for a do e-mail e os dois ids forem ids de verdade. */
export function lojaDoMetadado(metadata: Record<string, string> | null | undefined): { lojaId: string; organizationId: string } | null {
  if (!metadata || metadata.produto !== PRODUTO_DO_EMAIL) return null;
  const { ticketeria_loja_id: lojaId, organization_id: organizationId } = metadata;
  return lojaId && organizationId && UUID.test(lojaId) && UUID.test(organizationId) ? { lojaId, organizationId } : null;
}

/** Devo gravar este aviso? Não, se já há uma assinatura ATIVA diferente na loja e o aviso é de outra que não está ativa (o "cancelada" atrasado da assinatura antiga não derruba a nova). */
export function devoAplicar(existente: { assinatura: string; stripe_subscription_id: string | null } | null, novo: DadosDaAssinatura): boolean {
  if (!existente?.stripe_subscription_id || existente.stripe_subscription_id === novo.stripe_subscription_id) return true;
  return !(existente.assinatura === "ativa" && novo.assinatura !== "ativa");
}
