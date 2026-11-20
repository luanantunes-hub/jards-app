import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processarAgendados } from "@/lib/email/agendados";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.EMAIL_AGENDADOS_SEGREDO;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Chamada pelo agendador do banco a cada minuto (fn_email_agendados_disparar). Sem o segredo combinado, nada roda.
export async function POST(req: NextRequest) {
  if (!process.env.EMAIL_AGENDADOS_SEGREDO) return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  if (!segredoConfere(req.headers.get("x-email-segredo"))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const resultado = await processarAgendados(createAdminClient() as any);
    return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao enviar os agendados" }, { status: 500 });
  }
}
