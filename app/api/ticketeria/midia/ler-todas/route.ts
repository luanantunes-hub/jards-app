// GET /api/ticketeria/midia/ler-todas: a leitura diária (Vercel Cron, ver vercel.json). Lê o gasto de todas as conexões ativas (Meta e Google Ads), uma de cada vez. Só aceita o cabeçalho
// `Authorization: Bearer ${CRON_SECRET}` (a Vercel o envia sozinha quando a variável existe); sem CRON_SECRET configurado responde 503.

import { timingSafeEqual } from "crypto";
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerConexaoAgora } from "@/lib/ticketeria/midia/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CONEXOES_POR_RODADA = 200;

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
  const { data: ativas } = await clienteDaTicketeria(admin).from("ticketeria_conexoes_midia").select("id").eq("situacao", "ativa").order("ultima_leitura_em", { ascending: true, nullsFirst: true }).limit(MAX_CONEXOES_POR_RODADA);
  let lidas = 0;
  let erros = 0;
  for (const c of ativas ?? []) {
    const r = await lerConexaoAgora(admin, c.id);
    if (r?.ok) lidas++; else erros++;
  }
  return resposta({ lidas, erros });
}
