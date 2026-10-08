import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_PREENCHA") {
  console.warn("[stripe] STRIPE_SECRET_KEY não configurado — pagamentos desativados.");
}

export const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== "sk_test_PREENCHA"
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-06-24.dahlia" })
  : null;

export const PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro:     process.env.STRIPE_PRICE_PRO ?? "",
} as const;

export const STRIPE_CONFIGURED = !!stripe;

/** Preços da assinatura do módulo de prestação de contas (P5.6). */
export const PRECOS_MODULO = {
  modulo: process.env.STRIPE_PRICE_MODULO_PRESTACAO ?? "",
  vaga: process.env.STRIPE_PRICE_SEAT ?? "",
};

/**
 * Endereço da API do Stripe. Fica vazio em produção; STRIPE_API_URL serve
 * para conferir as rotas localmente com um Stripe falso.
 */
function enderecoDaApi(): Pick<Stripe.StripeConfig, "host" | "port" | "protocol"> {
  const base = process.env.STRIPE_API_URL;
  if (!base) return {};
  const url = new URL(base);
  const protocol = url.protocol === "http:" ? "http" : "https";
  return { host: url.hostname, port: Number(url.port) || (protocol === "http" ? 80 : 443), protocol };
}

/** Cliente do Stripe para as rotas do servidor, ou null sem a chave. */
export function novoStripe(): Stripe | null {
  const chave = process.env.STRIPE_SECRET_KEY;
  if (!chave || chave === "sk_test_PREENCHA") return null;
  return new Stripe(chave, enderecoDaApi());
}
