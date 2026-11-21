import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import type { Database } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { dadosDaAssinatura, devoAplicar, lojaDoMetadado, type AssinaturaDoStripe } from "@/lib/ticketeria/assinatura-email";

type Admin = SupabaseClient<Database>;

/** Busca a assinatura no Stripe (a fonte da verdade: o aviso só diz qual é) e grava o estado dela na loja. Devolve a situação gravada, ou null se a assinatura não é do e-mail da Ticketeria / foi ignorada. */
export async function aplicarAssinaturaDoEmail(admin: Admin, stripe: Stripe, assinaturaId: string, loja?: { lojaId: string; organizationId: string }): Promise<string | null> {
  const s = await stripe.subscriptions.retrieve(assinaturaId) as unknown as AssinaturaDoStripe;
  const dono = lojaDoMetadado(s.metadata);
  if (!dono || (loja && (loja.lojaId !== dono.lojaId || loja.organizationId !== dono.organizationId))) return null;
  const dados = dadosDaAssinatura(s);
  const t = clienteDaTicketeria(admin);
  const { data: existente } = await t.from("ticketeria_remetentes").select("assinatura, stripe_subscription_id").eq("loja_id", dono.lojaId).maybeSingle();
  if (!devoAplicar(existente, dados)) return null;
  const { error } = await t.from("ticketeria_remetentes").upsert(
    { organization_id: dono.organizationId, loja_id: dono.lojaId, ...dados, updated_at: new Date().toISOString() },
    { onConflict: "loja_id" },
  );
  if (error) throw new Error(error.message);
  return dados.assinatura;
}
