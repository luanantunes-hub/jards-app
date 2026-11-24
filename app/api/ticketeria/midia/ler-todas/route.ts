// GET /api/ticketeria/midia/ler-todas: a leitura diária (Vercel Cron, ver vercel.json). Lê o gasto de todas as conexões ativas (Meta e Google Ads), uma de cada vez. Só aceita o cabeçalho
// `Authorization: Bearer ${CRON_SECRET}` (a Vercel o envia sozinha quando a variável existe); sem CRON_SECRET configurado responde 503.

import { timingSafeEqual } from "crypto";
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { lerConexaoAgora } from "@/lib/ticketeria/midia/servidor";
import { esgotamentoDaLoja } from "@/lib/ticketeria/esgotamento-servidor";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

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
  // Os avisos do sino de esgotamento, depois de ler o gasto do dia: anúncio gastando com o evento esgotado (um aviso por evento) e evento quase esgotado (um por evento).
  let avisos = 0;
  const t = clienteDaTicketeria(admin);
  const { data: lojas } = await t.from("ticketeria_conexoes_midia").select("loja_id, organization_id").eq("situacao", "ativa").in("provedor", ["meta", "google_ads"]).limit(MAX_CONEXOES_POR_RODADA);
  for (const loja of [...new Map((lojas ?? []).map(l => [l.loja_id, l])).values()]) {
    try {
      const { esgotados, quase } = await esgotamentoDaLoja(admin, loja.loja_id);
      for (const e of esgotados) {
        const { error } = await t.rpc("fn_ticketeria_avisar", { p_org: loja.organization_id, p_chave: "ticketeria_anuncio_esgotado", p_titulo: `${e.evento} esgotou`,
          p_mensagem: `As campanhas do evento continuam gastando${e.porDia > 0 ? `, cerca de ${formatarMoeda(e.porDia)} por dia` : ""}. Pause no Meta e no Google.`, p_link: "/ingressos/divulgacao", p_prioridade: "alta",
          p_entidade: "ticketeria_evento", p_entidade_id: e.eventoId, p_dedupe: `ticketeria_anuncio_esgotado:${e.eventoId}:${e.esgotouEm}` });
        if (!error) avisos++;
      }
      for (const q of quase) {
        const { error } = await t.rpc("fn_ticketeria_avisar", { p_org: loja.organization_id, p_chave: "ticketeria_quase_esgotado", p_titulo: `${q.evento} está quase esgotado`,
          p_mensagem: `${Math.round(q.parteVendida * 100)}% vendido e ${q.diasAteASessao === 1 ? "falta 1 dia" : `faltam ${q.diasAteASessao} dias`}. Antes de pôr mais dinheiro em anúncio, veja quantos lugares restam.`, p_link: "/ingressos/divulgacao",
          p_prioridade: "normal", p_entidade: "ticketeria_evento", p_entidade_id: q.eventoId, p_dedupe: `ticketeria_quase_esgotado:${q.eventoId}` });
        if (!error) avisos++;
      }
    } catch (erro) {
      console.error("[ticketeria] avisos de esgotamento:", erro instanceof Error ? erro.message : erro);
    }
  }
  return resposta({ lidas, erros, avisos });
}
