import { NextRequest, NextResponse } from "next/server";
import type { CalendarProvider } from "@/lib/calendar/config";
import { deleteConnection } from "@/lib/calendar/connections";
import { requireUser } from "@/lib/calendar/require-user";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const body = await req.json() as { provider?: CalendarProvider };
  if (body.provider !== "google" && body.provider !== "microsoft") {
    return NextResponse.json({ error: "Provedor inválido" }, { status: 400 });
  }

  try {
    await deleteConnection(user.id, body.provider);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
