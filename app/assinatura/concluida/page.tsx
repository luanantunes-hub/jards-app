import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import type { CompraVerificada } from "@/lib/conversao-google-ads";
import AvisoAssinatura from "./AvisoAssinatura";

export const dynamic = "force-dynamic";

const DESTINO_PADRAO = "/patrocinadores?welcome=paid";

// Volta do pagamento no Stripe: confere a compra no próprio Stripe antes de
// avisar o Google Ads e segue para a plataforma. Sem compra conferida, só segue.
export default async function AssinaturaConcluidaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { session_id, next } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : DESTINO_PADRAO;
  const compra = typeof session_id === "string" ? await compraVerificada(session_id) : null;
  return <AvisoAssinatura compra={compra} destino={destino} />;
}

async function compraVerificada(sessionId: string): Promise<CompraVerificada | null> {
  if (!stripe || !sessionId.startsWith("cs_")) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const sessao = await stripe.checkout.sessions.retrieve(sessionId);
    const daPessoa = sessao.metadata?.user_id === user.id;
    const paga = sessao.status === "complete" && sessao.payment_status === "paid";
    if (!daPessoa || !paga || !sessao.amount_total) return null;

    return {
      valor: sessao.amount_total / 100,
      moeda: (sessao.currency ?? "brl").toUpperCase(),
      transacao: sessao.id,
    };
  } catch {
    // A conversão é medição; um erro aqui nunca segura quem acabou de pagar.
    return null;
  }
}
