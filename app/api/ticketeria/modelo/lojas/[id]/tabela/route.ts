// GET /api/ticketeria/modelo/lojas/{id}/tabela: a tabela semanal da loja (semana, ingressos e gasto por canal em centavos), a mesma que a aba Modelo usa. Só o job semanal, com o token do modelo.

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entradaDaLoja } from "@/lib/ticketeria/modelo-servidor";
import { recusarSemTokenDoModelo } from "@/lib/ticketeria/modelo-token";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, rota: { params: Promise<{ id: string }> }) {
  const recusa = recusarSemTokenDoModelo(req);
  if (recusa) return recusa;
  const { id } = await rota.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "loja_invalida" }, { status: 400 });
  try {
    const entrada = await entradaDaLoja(createAdminClient(), id.toLowerCase());
    return NextResponse.json({ loja_id: id.toLowerCase(), semanas: entrada.tabela }, { headers: { "cache-control": "no-store" } });
  } catch (erro) {
    console.error("[ticketeria] tabela semanal do modelo:", erro instanceof Error ? erro.message : erro);
    return NextResponse.json({ error: "falha_ao_ler" }, { status: 500 });
  }
}
