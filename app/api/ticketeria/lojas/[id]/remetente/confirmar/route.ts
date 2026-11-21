// POST /api/ticketeria/lojas/{id}/remetente/confirmar { session_id }: quando o produtor volta do checkout, confere no Stripe se a sessão é desta loja e foi paga e ativa a assinatura na hora
// (o aviso do Stripe faz o mesmo e continua sendo quem acompanha cobrança, cancelamento e atraso). Idempotente.
//   → 200 { remetente } | 400 sessao_invalida | 403 (a sessão é de outra loja) | 409 pagamento_pendente | 503 cobranca_nao_configurada | 502 falha_ao_confirmar

import type { NextRequest } from "next/server";
import { novoStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { aplicarAssinaturaDoEmail } from "@/lib/ticketeria/assinatura-email-servidor";
import { lojaDoMetadado } from "@/lib/ticketeria/assinatura-email";
import { emailsDoPeriodo, remetenteDaLoja, remetenteParaATela } from "@/lib/ticketeria/remetente-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const SESSAO = /^cs_[A-Za-z0-9_]{10,200}$/;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente-confirmar", max: 20 });
  if (a.erro) return a.erro;
  const corpo = (await req.json().catch(() => null)) as { session_id?: unknown } | null;
  const sessaoId = typeof corpo?.session_id === "string" ? corpo.session_id : "";
  if (!SESSAO.test(sessaoId)) return resposta({ error: "sessao_invalida" }, 400);
  const stripe = novoStripe();
  if (!stripe) return resposta({ error: "cobranca_nao_configurada" }, 503);
  try {
    const sessao = await stripe.checkout.sessions.retrieve(sessaoId);
    const dono = lojaDoMetadado(sessao.metadata);
    if (!dono || dono.lojaId !== a.loja.id || dono.organizationId !== a.loja.organization_id) return resposta({ error: "sessao_de_outra_loja" }, 403);
    const assinaturaId = typeof sessao.subscription === "string" ? sessao.subscription : sessao.subscription?.id;
    if (sessao.status !== "complete" || !assinaturaId) return resposta({ error: "pagamento_pendente" }, 409);
    const admin = createAdminClient();
    await aplicarAssinaturaDoEmail(admin, stripe, assinaturaId, dono);
    const r = await remetenteDaLoja(admin, a.loja.id);
    return resposta({ remetente: remetenteParaATela(r, r ? await emailsDoPeriodo(admin, a.loja.id, r) : 0) });
  } catch (erro) {
    console.error("[ticketeria] confirmar assinatura do e-mail:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_confirmar" }, 502);
  }
}
