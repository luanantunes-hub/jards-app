import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarCalendarios } from "@/lib/reunioes/calendario-sincronizar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.REUNIOES_CALENDARIO_SEGREDO;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamada pelo agendador do banco a cada 3 minutos (fn_reunioes_calendario_disparar). Sem o segredo combinado, nada roda.
export async function POST(req: NextRequest) {
  if (!process.env.REUNIOES_CALENDARIO_SEGREDO) return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  if (!segredoConfere(req.headers.get("x-reunioes-segredo"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const resultado = await sincronizarCalendarios(createAdminClient());
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
