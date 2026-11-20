// /api/ticketeria/lojas/{id}/webhooks/{webhook}: muda ou apaga um endereço. Só quem edita a Ticketeria da organização.
//
//   PATCH { url?, eventos?, ativo? }   muda o que vier        DELETE   apaga o endereço (e a fila de avisos dele)

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { UUID } from "@/lib/ticketeria/integracao";
import { lerCorpoDoWebhook, mensagemDoErroDoWebhook } from "@/lib/ticketeria/webhooks";

export const dynamic = "force-dynamic";
type Rota = { params: Promise<{ id: string; webhook: string }> };

async function webhookDaRota(rota: Rota) {
  const { webhook } = await rota.params;
  return UUID.test(webhook) ? webhook.toLowerCase() : null;
}

export async function PATCH(req: NextRequest, rota: Rota) {
  const a = await autorizarLoja(rota, { chave: "webhooks-muda", max: 20 });
  if (a.erro) return a.erro;
  const webhook = await webhookDaRota(rota);
  if (!webhook) return resposta({ error: "webhook_invalido" }, 400);
  let entrada: unknown;
  try { entrada = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDoWebhook(entrada, false);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", mensagem: leitura.erro }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_mudar", { p_loja: a.loja.id, p_id: webhook, p_url: leitura.corpo.url ?? null, p_eventos: leitura.corpo.eventos ?? null, p_ativo: leitura.corpo.ativo ?? null });
  if (error) {
    const conhecido = /url_invalida|eventos_invalidos/.test(error.message);
    if (!conhecido) console.error("[ticketeria] webhooks:", error.message);
    return resposta({ error: conhecido ? "dados_invalidos" : "falha_ao_salvar", mensagem: mensagemDoErroDoWebhook(error) }, conhecido ? 400 : 500);
  }
  return data === true ? resposta({ ok: true }) : resposta({ error: "nao_encontrado" }, 404);
}

export async function DELETE(_req: NextRequest, rota: Rota) {
  const a = await autorizarLoja(rota, { chave: "webhooks-muda", max: 20 });
  if (a.erro) return a.erro;
  const webhook = await webhookDaRota(rota);
  if (!webhook) return resposta({ error: "webhook_invalido" }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_apagar", { p_loja: a.loja.id, p_id: webhook });
  if (error) { console.error("[ticketeria] webhooks:", error.message); return resposta({ error: "falha_ao_apagar" }, 500); }
  return data === true ? resposta({ ok: true }) : resposta({ error: "nao_encontrado" }, 404);
}
