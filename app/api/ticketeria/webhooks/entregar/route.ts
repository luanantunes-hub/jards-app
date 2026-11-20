// POST /api/ticketeria/webhooks/entregar: a rodada de envio dos webhooks. Quem chama é o banco (pg_cron, a cada minuto, por fn_ticketeria_webhooks_disparar), com o segredo no cabeçalho
// `x-ticketeria-webhooks-segredo` (o mesmo de TICKETERIA_WEBHOOKS_SEGREDO). Sem o segredo configurado a rota responde 503 e não faz nada.

import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { enviarDevidas, type PortasDoEnvio } from "@/lib/ticketeria/webhooks-envio";
import { transporteHttps } from "@/lib/ticketeria/webhooks-transporte";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const resposta = (corpo: object, status = 200) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.TICKETERIA_WEBHOOKS_SEGREDO ?? "";
  if (esperado.length < 24) return false;
  const a = Buffer.from(recebido ?? "");
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if ((process.env.TICKETERIA_WEBHOOKS_SEGREDO ?? "").length < 24) return resposta({ error: "nao_configurado" }, 503);
  if (!segredoConfere(req.headers.get("x-ticketeria-webhooks-segredo"))) return resposta({ error: "nao_autorizado" }, 401);
  const t = clienteDaTicketeria(createAdminClient());
  const portas: PortasDoEnvio = {
    async reivindicar(limite) {
      const { data, error } = await t.rpc("fn_ticketeria_webhooks_reivindicar", { p_limite: limite });
      if (error) throw new Error(error.message);
      return data;
    },
    async registrar(entrega, ok, status, erro) {
      const { error } = await t.rpc("fn_ticketeria_webhooks_registrar", { p_entrega: entrega, p_ok: ok, p_status: status, p_erro: erro });
      if (error) throw new Error(error.message);
    },
  };
  try {
    const resumo = await enviarDevidas(portas, transporteHttps);
    // Uma vez por rodada, nada que pese: apaga o que já foi enviado ou desistido há mais de 30 dias.
    await t.rpc("fn_ticketeria_webhooks_limpar", { p_dias: 30 });
    return resposta(resumo);
  } catch (erro) {
    console.error("[ticketeria] webhooks:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_no_envio" }, 500);
  }
}
