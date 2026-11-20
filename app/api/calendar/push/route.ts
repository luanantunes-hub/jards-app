import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarParaAgenda, type AvisoDoBanco } from "@/lib/calendar/empurrar";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.CALENDAR_SYNC_WEBHOOK_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamada pelo banco (fn dispatch_calendar_sync_push) a cada mudança numa atividade: cria, atualiza ou apaga o evento na agenda de quem é o responsável.
export async function POST(req: NextRequest) {
  if (!process.env.CALENDAR_SYNC_WEBHOOK_SECRET) return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  if (!segredoConfere(req.headers.get("x-calendar-sync-secret"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const aviso = await req.json().catch(() => null) as AvisoDoBanco | null;
  if (!aviso || (aviso.type !== "INSERT" && aviso.type !== "UPDATE" && aviso.type !== "DELETE")) return NextResponse.json({ error: "Aviso inválido" }, { status: 400 });
  try {
    return NextResponse.json(await enviarParaAgenda(createAdminClient(), aviso), { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("calendar push", erro);
    return NextResponse.json({ error: erro instanceof Error ? erro.message : "Erro desconhecido" }, { status: 500 });
  }
}
