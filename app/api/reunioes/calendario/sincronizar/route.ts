import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarCalendarios } from "@/lib/reunioes/calendario-sincronizar";
import { conferirReunioesParadas } from "@/lib/reunioes/conferir";

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
  const admin = createAdminClient();
  const resultado = await sincronizarCalendarios(admin);
  // a mesma rodada confere as reuniões que o Vexa não avisou que terminaram ou falharam (o aviso pode se perder)
  const conferencia = await conferirReunioesParadas(admin).catch(erro => ({ conferidas: 0, concluidas: 0, falhas: 0, iniciadas: 0, erros: [erro instanceof Error ? erro.message : "falha na conferência"] }));
  return NextResponse.json({ ...resultado, conferencia }, { headers: { "Cache-Control": "no-store" } });
}
