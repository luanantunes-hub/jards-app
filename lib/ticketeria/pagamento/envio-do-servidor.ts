import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { appUrl } from "@/lib/email/config";
import { enviarIngressosDoPedido } from "@/lib/ticketeria/pagamento/ingressos";
import { portasDoEnvioDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";

/** Manda o e-mail dos ingressos de um pedido pago (uma vez só), com o e-mail transacional do Jards. Nunca lança. */
export async function mandarIngressosDoPedido(pedido: string): Promise<void> {
  await enviarIngressosDoPedido(
    pedido,
    portasDoEnvioDoSupabase(createAdminClient(), {
      enviarEmail: async (para, m) => (await sendTransactionalEmail({ to: para, subject: m.assunto, text: m.texto, html: m.html, idempotencyKey: `ticketeria-ingressos-${pedido}` })).ok,
      enderecoDaPagina: id => `${appUrl()}/pedido/${id}`,
    }),
    erro => console.error("[ticketeria] e-mail dos ingressos:", erro instanceof Error ? erro.message : erro),
  );
}
