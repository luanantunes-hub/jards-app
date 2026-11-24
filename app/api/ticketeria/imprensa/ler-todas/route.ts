// GET /api/ticketeria/imprensa/ler-todas: a leitura da imprensa (Vercel Cron, ver vercel.json; 3 vezes por dia, porque alguns RSS guardam só as notícias mais recentes). Para cada casa com
// evento à venda, lê o RSS dos veículos acompanhados e procura o nome dos eventos (lib/ticketeria/imprensa-monitor.ts). Só aceita `Authorization: Bearer ${CRON_SECRET}`; sem a variável, 503.

import { timingSafeEqual } from "crypto";
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerImprensaDaLoja } from "@/lib/ticketeria/imprensa-monitor-servidor";
import { resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
/** Para a rodada antes do limite da Vercel; as casas que faltarem ficam para a próxima. */
const TEMPO_DA_RODADA_MS = 240000;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || segredo.length < 16) return false;
  const enviado = req.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  return enviado.length === esperado.length && timingSafeEqual(Buffer.from(enviado), Buffer.from(esperado));
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return resposta({ error: "cron_indisponivel" }, 503);
  if (!autorizado(req)) return resposta({ error: "nao_autorizado" }, 401);
  const admin = createAdminClient();
  const inicio = Date.now();
  const { data: lojas } = await clienteDaTicketeria(admin).from("ticketeria_lojas").select("id, organization_id");
  let casas = 0, achados = 0;
  for (const l of lojas ?? []) {
    if (Date.now() - inicio > TEMPO_DA_RODADA_MS) break;
    try { const r = await lerImprensaDaLoja(admin, l.id, l.organization_id); if (r.veiculos > 0) casas++; achados += r.achados; } catch (erro) { console.error("[ticketeria] leitura da imprensa:", l.id, erro instanceof Error ? erro.message : erro); }
  }
  return resposta({ ok: true, casas, achados });
}
