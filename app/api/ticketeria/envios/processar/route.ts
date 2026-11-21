// GET /api/ticketeria/envios/processar: a rodada da fila dos envios de e-mail (cron da Vercel, a cada minuto). Continua os envios que ainda têm gente "pendente" ou "enviando" há mais de 5
// minutos (a rodada que nasceu com o envio caiu ou acabou o tempo). Só com `Authorization: Bearer ${CRON_SECRET}` (a Vercel o envia sozinha quando a variável existe); sem CRON_SECRET
// responde 503. Sem o remetente de divulgação configurado não faz nada. Duas rodadas ao mesmo tempo nunca mandam para a mesma pessoa (o banco reivindica).

import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { appUrl } from "@/lib/email/config";
import { divulgacaoConfigurada } from "@/lib/email/divulgacao";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { processarEnvioDeEmail } from "@/lib/ticketeria/envios-servidor";
import { resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const ORCAMENTO_TOTAL_MS = 240_000;
const MAX_ENVIOS_POR_RODADA = 5;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  const recebido = req.headers.get("authorization") ?? "";
  if (!segredo) return false;
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const lido = Buffer.from(recebido);
  return lido.length === esperado.length && timingSafeEqual(lido, esperado);
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return resposta({ error: "cron_indisponivel" }, 503);
  if (!autorizado(req)) return resposta({ error: "nao_autorizado" }, 401);
  if (!divulgacaoConfigurada()) return resposta({ ok: true, envios: 0, motivo: "envio_desligado" });
  try {
    const admin = createAdminClient();
    const t = clienteDaTicketeria(admin);
    const { data: envios, error } = await t.from("ticketeria_envios").select("id").eq("canal", "email").eq("situacao", "enviando").order("created_at", { ascending: true }).limit(MAX_ENVIOS_POR_RODADA);
    if (error) throw new Error(error.message);
    const inicio = Date.now();
    const rodadas: { envio: string; enviados: number; falhas: number; faltam: number }[] = [];
    for (const e of envios ?? []) {
      const restante = ORCAMENTO_TOTAL_MS - (Date.now() - inicio);
      if (restante < 10_000) break;
      const r = await processarEnvioDeEmail(admin, e.id, appUrl(), restante);
      if (r) rodadas.push({ envio: e.id, ...r });
    }
    return resposta({ ok: true, envios: rodadas.length, rodadas });
  } catch (erro) {
    console.error("[ticketeria] cron dos envios:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha" }, 500);
  }
}
