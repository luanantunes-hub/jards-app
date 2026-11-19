import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { mudarVisibilidadeDaConversa } from "@/lib/email/mudar-visibilidade";
import type { Visibilidade } from "@/lib/email/visibilidade";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMO_DE_EMAILS = 200;

/** "Só eu vejo": a regra está em `mudarVisibilidadeDaConversa`; aqui só a entrada e a resposta. */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = (await req.json().catch(() => null)) as { emailIds?: unknown; visibilidade?: unknown } | null;
  const visibilidade: Visibilidade | null =
    corpo?.visibilidade === "private" || corpo?.visibilidade === "organization" ? corpo.visibilidade : null;
  const ids = Array.isArray(corpo?.emailIds) ? [...new Set(corpo.emailIds.filter((id): id is string => typeof id === "string"))] : [];
  if (!visibilidade || ids.length === 0 || ids.length > MAXIMO_DE_EMAILS || ids.some((id) => !UUID.test(id))) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    const resultado = await mudarVisibilidadeDaConversa(createAdminClient(), user.id, ids, visibilidade);
    return NextResponse.json(resultado.corpo, { status: resultado.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao mudar a visibilidade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
