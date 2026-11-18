import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importarAgendas } from "@/lib/calendar/importar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.CALENDAR_SYNC_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamada pelo agendador do banco a cada 10 minutos (fn_calendario_importar_disparar): traz as reuniões das agendas conectadas para as atividades do Jards.
export async function POST(req: NextRequest) {
  if (!process.env.CALENDAR_SYNC_WEBHOOK_SECRET) return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  if (!segredoConfere(req.headers.get("x-calendar-sync-secret"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await importarAgendas(createAdminClient()), { headers: { "Cache-Control": "no-store" } });
}
