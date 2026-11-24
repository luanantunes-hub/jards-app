// POST /api/ticketeria/novidades/preferencias { token, frequencia, dias }: a central de preferências (o link do e-mail de divulgação). O token do link é a prova de quem escolhe; a
// escolha vale para a loja do envio. → 200 { ok: true } | 400 (link ou escolha inválidos).

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest) {
  const texto = await req.text();
  if (texto.length > 512) return resposta({ error: "corpo_grande_demais" }, 413);
  let c: { token?: unknown; frequencia?: unknown; dias?: unknown } = {};
  try { c = JSON.parse(texto) as typeof c; } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const token = typeof c.token === "string" && UUID.test(c.token) ? c.token.toLowerCase() : null;
  const frequencia = c.frequencia === "tudo" || c.frequencia === "menos" || c.frequencia === "parecidos" ? c.frequencia : null;
  const dias = c.dias === "qualquer" || c.dias === "fim_de_semana" || c.dias === "semana" ? c.dias : null;
  if (!token || !frequencia || !dias) return resposta({ error: "dados_invalidos" }, 400);
  const t = clienteDaTicketeria(createAdminClient());
  const { data: d } = await t.from("ticketeria_envio_destinatarios").select("envio_id, email, organization_id").eq("token", token).maybeSingle();
  if (!d) return resposta({ error: "link_invalido" }, 400);
  const { data: envio } = await t.from("ticketeria_envios").select("loja_id").eq("id", d.envio_id).maybeSingle();
  if (!envio) return resposta({ error: "link_invalido" }, 400);
  const { error } = await t.from("ticketeria_preferencias").upsert({ organization_id: d.organization_id, loja_id: envio.loja_id, email: d.email.trim().toLowerCase(), frequencia, dias, updated_at: new Date().toISOString() }, { onConflict: "loja_id,email" });
  if (error) { console.error("[ticketeria] preferências:", error.message); return resposta({ error: "falha" }, 500); }
  return resposta({ ok: true }, 200);
}
