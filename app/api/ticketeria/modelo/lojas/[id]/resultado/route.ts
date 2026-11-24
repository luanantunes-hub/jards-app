// POST /api/ticketeria/modelo/lojas/{id}/resultado: o job devolve o resultado do modelo de uma loja (ou que a rodada não deu: { "falhou": true, "motivo": "…" }). O corpo é conferido de novo
// (lib/ticketeria/modelo-resultado.ts: a confiança e os avisos de margem são calculados AQUI, não pelo job) e gravado de uma vez, ou nada. Só o job semanal, com o token do modelo.

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { lerResultadoDoModelo } from "@/lib/ticketeria/modelo-resultado";
import { comEfeitoTotal } from "@/lib/ticketeria/efeito-total-servidor";
import { recusarSemTokenDoModelo } from "@/lib/ticketeria/modelo-token";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAMANHO_MAXIMO = 512 * 1024;
const resposta = (corpo: object, status: number) => NextResponse.json(corpo, { status, headers: { "cache-control": "no-store" } });

export async function POST(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const recusa = recusarSemTokenDoModelo(req);
  if (recusa) return recusa;
  const { id } = await rota.params;
  if (!UUID.test(id)) return resposta({ error: "loja_invalida" }, 400);
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > TAMANHO_MAXIMO) return resposta({ error: "corpo_grande_demais" }, 413);
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { return resposta({ error: "corpo_invalido" }, 400); }
  const t = clienteDaTicketeria(createAdminClient());
  const lojaId = id.toLowerCase();
  if (bruto && typeof bruto === "object" && (bruto as { falhou?: unknown }).falhou === true) {
    const motivo = String((bruto as { motivo?: unknown }).motivo ?? "O modelo não rodou.").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 300);
    const { error } = await t.rpc("fn_ticketeria_mmm_falhou", { p_loja: lojaId, p_motivo: motivo });
    if (error) { console.error("[ticketeria] registrar rodada que falhou:", error.message); return resposta({ error: "falha_ao_gravar" }, 500); }
    return resposta({ ok: true, situacao: "falhou" }, 201);
  }
  const leitura = lerResultadoDoModelo(bruto);
  if (!leitura.ok) return resposta({ error: "dados_invalidos", problema: leitura.problema }, 400);
  // O efeito total de cada canal (com o boca a boca e a urgência que ele puxa) é calculado aqui, com as sessões da loja; a rodada grava mesmo se a conta não der.
  const resultado = await comEfeitoTotal(createAdminClient(), lojaId, leitura.resultado);
  const { data, error } = await t.rpc("fn_ticketeria_mmm_gravar", { p_loja: lojaId, p_resultado: resultado as unknown as Json });
  if (error) { console.error("[ticketeria] gravar resultado do modelo:", error.message); return resposta({ error: "falha_ao_gravar" }, 500); }
  return resposta({ ok: true, situacao: "ok", id: data, confianca: leitura.resultado.confianca }, 201);
}
