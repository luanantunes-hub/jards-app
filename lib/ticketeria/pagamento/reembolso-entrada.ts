import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { ProvedorAsaas, ambienteDoAsaas } from "@/lib/ticketeria/pagamento/asaas";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { portasDoReembolsoDoSupabase } from "@/lib/ticketeria/pagamento/portas-supabase";
import { enderecoDoRemetente, enderecosDeReembolso, lerAssuntoDoReembolso, tratarEmailDeReembolso } from "@/lib/ticketeria/pagamento/reembolso";

// O e-mail de reembolso chega pelo MESMO webhook do Resend dos e-mails da prestação (/api/email/entrada, já com a assinatura conferida): quando o e-mail não é de uma
// prestação, a rota entrega o que recebeu para cá. Aqui se decide se é um pedido de reembolso e se liga a lógica (lib/ticketeria/pagamento/reembolso.ts) às portas reais.

export type EmailRecebido = { email_id?: string; from?: string; to?: string[]; cc?: string[]; received_for?: string[]; subject?: string; created_at?: string };

type EmailDeReembolso = { email_id: string; remetente: string; assunto: string; recebido_em: string };

/** Roda a lógica do reembolso com as portas reais (banco, Asaas pela chave da subconta e e-mail). */
async function executar(email: EmailDeReembolso): Promise<{ status: number; corpo: object }> {
  const base = ambienteDoAsaas();
  // Sem Asaas não há pedido pago para estornar; 503 faz o Resend tentar de novo mais tarde.
  if (!base) return { status: 503, corpo: { error: "asaas_nao_configurado" } };
  const admin = createAdminClient();
  const carteira = process.env.ASAAS_WALLET_JARDS || null;
  const erro = (e: unknown) => console.error("[ticketeria] reembolso:", e instanceof Error ? e.message : e);
  try {
    const portas = portasDoReembolsoDoSupabase(admin, {
      registrarErro: erro,
      async estornar(pedido) {
        const { data: chave } = await clienteDaTicketeria(admin).rpc("fn_ticketeria_chave_da_conta_asaas", { p_loja: pedido.loja_id });
        if (!chave || !pedido.provedor_ref) return { ok: false, motivo: "sem_chave_ou_referencia" };
        const provedor = new ProvedorAsaas({ chave, tokenDoWebhook: process.env.ASAAS_WEBHOOK_TOKEN || "nao-usado-ao-estornar".padEnd(32, "x"), url: base.url });
        return provedor.estornarPixComComissao(pedido.provedor_ref, pedido.total_centavos, pedido.taxa_centavos, carteira);
      },
      async avisarOJards(a) {
        const r = await sendTransactionalEmail({ to: process.env.TICKETERIA_EMAIL_DE_ALERTA || "luan.antunes@jards.com.br", subject: a.assunto, text: a.texto, html: `<pre style="font-family:Arial,Helvetica,sans-serif;font-size:14px;white-space:pre-wrap">${a.texto.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>` });
        if (!r.ok) erro(new Error(`aviso ao Jards não enviado: ${r.error}`));
      },
      async responder(para, m) {
        const r = await sendTransactionalEmail({ to: para, subject: m.assunto, text: m.texto, html: m.html });
        if (!r.ok) erro(new Error(`resposta do reembolso não enviada: ${r.error}`));
      },
    });
    const r = await tratarEmailDeReembolso(email, portas);
    return { status: 200, corpo: { reembolso: r.resultado } };
  } catch (e) {
    erro(e);
    return { status: 500, corpo: { error: "falha_no_reembolso" } };
  }
}

/** null quando o e-mail não é um pedido de reembolso (a rota segue como "ignorado"); senão, a resposta do webhook. */
export async function tratarEventoDeReembolso(d: EmailRecebido): Promise<{ status: number; corpo: object } | null> {
  if (!d.email_id || !lerAssuntoDoReembolso(d.subject ?? "")) return null;
  const destinatarios = [...(d.to ?? []), ...(d.cc ?? []), ...(d.received_for ?? [])].map(enderecoDoRemetente);
  if (!enderecosDeReembolso().some(e => destinatarios.includes(e))) return null;
  return executar({ email_id: d.email_id, remetente: d.from ?? "", assunto: d.subject ?? "", recebido_em: d.created_at ?? new Date().toISOString() });
}

/** Tenta de novo um pedido de reembolso que falhou: reabre o registro (só se é de um pedido da loja e está `falhou`) e roda a lógica com o e-mail original. O prazo de 7 dias segue contando da hora em que o e-mail chegou. */
export async function tentarDeNovoOReembolso(reembolso: string, loja: string): Promise<{ status: number; corpo: object }> {
  const { data, error } = await clienteDaTicketeria(createAdminClient()).rpc("fn_ticketeria_reembolso_reabrir", { p_reembolso: reembolso, p_loja: loja });
  if (error) return error.message.includes("reembolso_nao_reabrivel") ? { status: 409, corpo: { error: "reembolso_nao_reabrivel" } } : { status: 500, corpo: { error: "falha_ao_reabrir" } };
  const e = data as EmailDeReembolso;
  return executar({ email_id: e.email_id, remetente: e.remetente, assunto: e.assunto, recebido_em: e.recebido_em });
}
