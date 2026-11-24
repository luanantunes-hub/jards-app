// POST /api/ticketeria/lojas/{id}/envios/limite { limite }: quantos e-mails de divulgação a loja manda, no máximo, a uma mesma pessoa em 7 dias (1 a 14). Quem pede precisa EDITAR a Ticketeria.

import type { NextRequest } from "next/server";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "envio-limite", max: 20 });
  if (a.erro) return a.erro;
  const c = (await req.json().catch(() => null)) as { limite?: unknown } | null;
  const limite = typeof c?.limite === "number" && Number.isInteger(c.limite) && c.limite >= 1 && c.limite <= 14 ? c.limite : null;
  if (limite === null) return resposta({ error: "dados_invalidos" }, 400);
  const { error } = await a.admin.from("ticketeria_lojas").update({ limite_emails_semana: limite }).eq("id", a.loja.id);
  if (error) { console.error("[ticketeria] limite de e-mails:", error.message); return resposta({ error: "falha_ao_gravar" }, 500); }
  return resposta({ ok: true, limite });
}
