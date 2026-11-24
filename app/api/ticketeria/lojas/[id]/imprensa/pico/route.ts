// POST /api/ticketeria/lojas/{id}/imprensa/pico { evento_id: uuid | null, dia: "AAAA-MM-DD" }: "Não foi imprensa": o pico de venda desse evento nesse dia não volta a aparecer.
// Quem pede precisa EDITAR a Ticketeria da organização.

import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { descartarPico } from "@/lib/ticketeria/imprensa-servidor";
import { autorizarLoja, resposta } from "@/lib/ticketeria/pagamento/autorizar-loja";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const a = await autorizarLoja(rota, { chave: "imprensa-pico", max: 30 });
  if (a.erro) return a.erro;
  const corpo = (await req.json().catch(() => null)) as { evento_id?: unknown; dia?: unknown } | null;
  const evento = corpo?.evento_id === null || corpo?.evento_id === undefined ? null : typeof corpo.evento_id === "string" && UUID.test(corpo.evento_id) ? corpo.evento_id.toLowerCase() : undefined;
  const dia = typeof corpo?.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia) ? corpo.dia : null;
  if (evento === undefined || !dia) return resposta({ error: "dados_invalidos" }, 400);
  if (evento) {
    const { data } = await a.admin.from("ticketeria_eventos").select("id").eq("id", evento).eq("loja_id", a.loja.id).maybeSingle();
    if (!data) return resposta({ error: "evento_de_outra_loja" }, 400);
  }
  try {
    await descartarPico(createAdminClient(), a.loja.id, a.loja.organization_id, evento, dia);
    return resposta({ ok: true });
  } catch (erro) {
    console.error("[ticketeria] descartar pico:", erro instanceof Error ? erro.message : erro);
    return resposta({ error: "falha_ao_gravar" }, 500);
  }
}
