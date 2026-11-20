// GET /api/ticketeria/modelo/prontas: as lojas cujos dados já bastam para o modelo rodar (a mesma prontidão da aba Modelo). Só o job semanal, com o token do modelo.

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { prontidaoDaLoja } from "@/lib/ticketeria/modelo-servidor";
import { recusarSemTokenDoModelo } from "@/lib/ticketeria/modelo-token";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const MAX_LOJAS = 500;

export async function GET(req: NextRequest) {
  const recusa = recusarSemTokenDoModelo(req);
  if (recusa) return recusa;
  try {
    const admin = createAdminClient();
    const { data } = await clienteDaTicketeria(admin).from("ticketeria_lojas").select("id").limit(MAX_LOJAS);
    const lojas: { id: string; semanas: number; confianca: string | null }[] = [];
    for (const l of data ?? []) {
      try {
        const p = await prontidaoDaLoja(admin, l.id);
        if (p.pronto) lojas.push({ id: l.id, semanas: p.semanas, confianca: p.confianca });
      } catch (erro) {
        console.error("[ticketeria] prontidão da loja", l.id, erro instanceof Error ? erro.message : erro);
      }
    }
    return NextResponse.json({ lojas }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[ticketeria] lojas prontas para o modelo:", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "falha_ao_ler" }, { status: 500 });
  }
}
