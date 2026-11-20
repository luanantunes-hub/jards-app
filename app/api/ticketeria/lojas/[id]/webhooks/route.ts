// /api/ticketeria/lojas/{id}/webhooks: os endereços que o Jards avisa quando algo acontece na loja. Quem pede precisa EDITAR a Ticketeria da organização.
//
//   GET                              os endereços da loja (sem o segredo), com o que cada um recebe e se está ligado
//   POST { url, eventos }            cria um endereço (até 5) e devolve o SEGREDO, que só aparece agora (e quando o endereço gira o segredo)

import { type NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerCorpoDoWebhook, mensagemDoErroDoWebhook } from "@/lib/ticketeria/webhooks";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "webhooks", max: 30 });
  if (a.erro) return a.erro;
  const { data, error } = await a.ticketeria.from("ticketeria_webhooks").select("id, url, eventos, ativo, created_at").eq("loja_id", a.loja.id).order("created_at");
  if (error) { console.error("[ticketeria] webhooks:", error.message); return resposta({ error: "falha_ao_ler" }, 500); }
  return resposta({ webhooks: data ?? [] });
}

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "webhooks-muda", max: 20 });
  if (a.erro) return a.erro;
  let entrada: unknown;
  try { entrada = await req.json(); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const leitura = lerCorpoDoWebhook(entrada, true);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", mensagem: leitura.erro }, 400);
  const { data, error } = await a.admin.rpc("fn_ticketeria_webhook_criar", { p_loja: a.loja.id, p_url: leitura.corpo.url as string, p_eventos: leitura.corpo.eventos as string[], p_usuario: a.user.id });
  if (error) {
    const mensagem = mensagemDoErroDoWebhook(error);
    const conhecido = /limite_de_webhooks|url_invalida|eventos_invalidos/.test(error.message);
    if (!conhecido) console.error("[ticketeria] webhooks:", error.message);
    return resposta({ error: conhecido ? "dados_invalidos" : "falha_ao_salvar", mensagem }, conhecido ? 400 : 500);
  }
  return resposta(data as object, 201);
}
