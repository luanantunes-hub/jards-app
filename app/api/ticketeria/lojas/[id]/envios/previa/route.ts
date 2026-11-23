// POST /api/ticketeria/lojas/{id}/envios/previa { segmento, sessao_id, comparacao?, so_ultimo_ano? }: o que um envio por e-mail mandaria, sem mandar nada: quantas pessoas recebem, quantas
// ficam no grupo de comparação, quantas ficam de fora pelo limite da semana e pelas preferências, e a sugestão "mandar só para quem comprou no último ano". Quem pede precisa EDITAR a Ticketeria.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaNoFuso } from "@/lib/ticketeria/divulgacao";
import { destinatariosDoSegmento, SEGMENTO_TODOS } from "@/lib/ticketeria/envios";
import { prepararEnvio } from "@/lib/ticketeria/envios-controle-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";
import { entradaDoPublico } from "@/lib/ticketeria/publico-servidor";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "envio-previa", max: 60 });
  if (a.erro) return a.erro;
  const c = (await req.json().catch(() => null)) as { segmento?: unknown; sessao_id?: unknown; comparacao?: unknown; so_ultimo_ano?: unknown } | null;
  const segmento = typeof c?.segmento === "string" ? c.segmento.trim().toLowerCase() : "";
  const sessaoId = typeof c?.sessao_id === "string" && UUID.test(c.sessao_id) ? c.sessao_id.toLowerCase() : null;
  if (!sessaoId || (segmento !== SEGMENTO_TODOS && !/^evento:[0-9a-f-]{36}(:sem:[0-9a-f-]{36})?$/.test(segmento))) return resposta({ error: "dados_invalidos" }, 400);
  try {
    const admin = createAdminClient();
    const { data: sessao } = await clienteDaTicketeria(admin).from("ticketeria_sessoes").select("evento_id, inicio").eq("id", sessaoId).maybeSingle();
    if (!sessao) return resposta({ error: "sessao_indisponivel" }, 409);
    const entrada = await entradaDoPublico(admin, a.loja.id);
    const doSegmento = destinatariosDoSegmento(entrada, segmento, "email");
    const p = await prepararEnvio(admin, a.loja.id, entrada, doSegmento, { eventoId: sessao.evento_id, diaDaSemanaDaSessao: new Date(`${diaNoFuso(sessao.inicio)}T12:00:00Z`).getUTCDay(), comparacao: c?.comparacao !== false, soUltimoAno: c?.so_ultimo_ano === true });
    return resposta({ segmento: doSegmento.length, enviar: p.enviar.length, comparacao: p.comparacao.length, fora_pelo_limite: p.foraPeloLimite, fora_pelas_preferencias: p.foraPelasPreferencias, limite: p.limite, sugestao: p.sugestao });
  } catch (erro) {
    console.error("[ticketeria] prévia do envio:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_ler" }, 500);
  }
}
