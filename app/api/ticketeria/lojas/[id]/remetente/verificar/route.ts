// POST /api/ticketeria/lojas/{id}/remetente/verificar: pede ao provedor que confira os registros de DNS do domínio da loja agora e grava o que ele diz.
//   → 200 { remetente }   (situacao: aguardando_dns | verificado | falhou)
//   → 409 sem_dominio | 503 provedor_indisponivel | 502 provedor_falhou
// O DNS demora de minutos a horas para valer: a tela chama isto quando o produtor aperta "Conferir agora" e de tempos em tempos enquanto espera.

import type { NextRequest } from "next/server";
import { conferirDominio } from "@/lib/email/resend-dominios";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { emailsDoPeriodo, remetenteDaLoja, remetenteParaATela } from "@/lib/ticketeria/remetente-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "remetente-verificar", max: 30 });
  if (a.erro) return a.erro;
  try {
    const admin = createAdminClient();
    const atual = await remetenteDaLoja(admin, a.loja.id);
    if (!atual?.resend_domain_id || !atual.dominio) return resposta({ error: "sem_dominio" }, 409);
    const lido = await conferirDominio(atual.resend_domain_id);
    if (!lido.ok) {
      if (lido.semChave) return resposta({ error: "provedor_indisponivel" }, 503);
      console.error("[ticketeria] conferir domínio:", lido.erro);
      return resposta({ error: "provedor_falhou" }, 502);
    }
    const { error } = await clienteDaTicketeria(admin).from("ticketeria_remetentes").update({
      situacao: lido.dominio.situacao, registros: lido.dominio.registros as unknown as Json,
      verificado_em: lido.dominio.situacao === "verificado" ? atual.verificado_em ?? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq("loja_id", a.loja.id);
    if (error) throw new Error(error.message);
    const r = await remetenteDaLoja(admin, a.loja.id);
    return resposta({ remetente: remetenteParaATela(r, r ? await emailsDoPeriodo(admin, a.loja.id, r) : 0) });
  } catch (erro) {
    console.error("[ticketeria] verificar remetente:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_verificar" }, 500);
  }
}
