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
