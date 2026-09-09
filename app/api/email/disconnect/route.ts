import { NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { deleteEmailConnection } from "@/lib/email/connections";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    await deleteEmailConnection(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
