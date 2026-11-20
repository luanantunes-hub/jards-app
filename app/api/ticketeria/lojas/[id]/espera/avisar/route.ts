// POST /api/ticketeria/lojas/{id}/espera/avisar: o produtor avisa por e-mail as próximas pessoas da lista de espera de um ingresso (na ordem de chegada).
//
//   { sessao_id, ingresso_id, quantas }
//   → 200 { avisadas, falharam }     (quem não recebeu o e-mail continua na vez)
//   → 409 { error, mensagem }        (sem lugar livre, sessão de outra loja)
//
// Exige lugar livre no ingresso e quem EDITA a Ticketeria da organização. O aviso não reserva lugar.

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { createAdminClient } from "@/lib/supabase/admin";
import { mensagemDoErroDeAvisar } from "@/lib/ticketeria/espera";
import { avisarEspera } from "@/lib/ticketeria/espera-aviso";
import { portasDoAvisoDoSupabase } from "@/lib/ticketeria/espera-servidor";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "espera-avisar", max: 10 });
  if (a.erro) return a.erro;
  let bruto: unknown;
  try { bruto = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const e = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  const sessao = typeof e.sessao_id === "string" ? e.sessao_id.toLowerCase() : "";
  const ingresso = typeof e.ingresso_id === "string" ? e.ingresso_id.toLowerCase() : "";
  const quantas = e.quantas;
  if (!UUID.test(sessao) || !UUID.test(ingresso) || typeof quantas !== "number" || !Number.isInteger(quantas) || quantas < 1 || quantas > 500) return resposta({ error: "dados_invalidos" }, 400);
  try {
    const r = await avisarEspera({ loja: a.loja.id, sessao, ingresso, quantas }, portasDoAvisoDoSupabase(createAdminClient(), erro => console.error("[ticketeria] aviso da espera:", erro instanceof Error ? erro.message : erro)));
    return resposta(r);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "";
    if (/sem_lugar|sessao_de_outra_loja|quantas_invalido/.test(mensagem)) return resposta({ error: mensagem.match(/sem_lugar|sessao_de_outra_loja|quantas_invalido/)?.[0], mensagem: mensagemDoErroDeAvisar(mensagem) }, 409);
    console.error("[ticketeria] avisar espera:", mensagem);
    return resposta({ error: "falha_ao_avisar", mensagem: "Não foi possível avisar agora. Tente de novo em instantes." }, 500);
  }
}
