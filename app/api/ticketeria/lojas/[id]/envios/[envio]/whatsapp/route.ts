// /api/ticketeria/lojas/{id}/envios/{envio}/whatsapp: a lista de um envio por WhatsApp. Quem pede precisa EDITAR a Ticketeria da organização (tem telefone).
//
//   GET  → { envio, pessoas: [{ id, nome, whatsapp, link, enviada }] }   (o `link` abre a conversa com a mensagem já escrita)
//   POST { destinatario } → { ok: true }   (o produtor abriu a conversa: marca como enviada)

import { type NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { marcarEnviadaPorWhatsapp, pessoasDoEnvioPorWhatsapp } from "@/lib/ticketeria/envios-whatsapp-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Rota = { params: Promise<{ id: string; envio: string }> };

export async function GET(_req: NextRequest, rota: Rota) {
  const a = await autorizarLoja(rota, { chave: "envio-whatsapp", max: 60 });
  if (a.erro) return a.erro;
  const { envio } = await rota.params;
  if (!UUID.test(envio)) return resposta({ error: "envio_invalido" }, 400);
  try {
    const dados = await pessoasDoEnvioPorWhatsapp(createAdminClient(), a.loja.id, envio.toLowerCase(), appUrl());
    return dados ? resposta(dados) : resposta({ error: "envio_nao_encontrado" }, 404);
  } catch (erro) {
    console.error("[ticketeria] lista do WhatsApp:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}

export async function POST(req: NextRequest, rota: Rota) {
  const a = await autorizarLoja(rota, { chave: "envio-whatsapp-marcar", max: 300 });
  if (a.erro) return a.erro;
  const { envio } = await rota.params;
  if (!UUID.test(envio)) return resposta({ error: "envio_invalido" }, 400);
  const texto = await req.text();
  if (texto.length > 512) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const destinatario = typeof (bruto as { destinatario?: unknown })?.destinatario === "string" ? (bruto as { destinatario: string }).destinatario.trim() : "";
  if (!UUID.test(destinatario)) return resposta({ error: "dados_invalidos" }, 400);
  try {
    const ok = await marcarEnviadaPorWhatsapp(createAdminClient(), a.loja.id, envio.toLowerCase(), destinatario.toLowerCase());
    return ok ? resposta({ ok: true }) : resposta({ error: "nao_encontrado" }, 404);
  } catch (erro) {
    console.error("[ticketeria] marcar WhatsApp:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha" }, 500);
  }
}
