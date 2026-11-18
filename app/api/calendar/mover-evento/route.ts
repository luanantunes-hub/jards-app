import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/calendar/require-user";
import { moverEventoDaAgenda, type MudancaDeHorario } from "@/lib/calendar/mover";

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

// Arrastar no calendário do Jards um compromisso que veio do Google Agenda ou do Outlook: muda o horário lá e aqui.
// Só quem conectou a agenda de onde ele veio pode mudar (conferido em moverEventoDaAgenda).
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = await req.json().catch(() => null) as Partial<MudancaDeHorario> | null;
  if (!corpo?.atividadeId || !corpo.data_prevista || !DATA.test(corpo.data_prevista)
    || (corpo.data_inicio && !DATA.test(corpo.data_inicio))
    || !corpo.hora_inicio || !HORA.test(corpo.hora_inicio) || !corpo.hora_fim || !HORA.test(corpo.hora_fim)) {
    return NextResponse.json({ error: "Dia e horário inválidos." }, { status: 400 });
  }

  const resultado = await moverEventoDaAgenda(createAdminClient(), user.id, {
    atividadeId: corpo.atividadeId, data_prevista: corpo.data_prevista, data_inicio: corpo.data_inicio ?? null,
    hora_inicio: corpo.hora_inicio, hora_fim: corpo.hora_fim,
  });
  if (!resultado.ok) return NextResponse.json({ error: resultado.erro }, { status: resultado.status });
  return NextResponse.json({ ok: true });
}
