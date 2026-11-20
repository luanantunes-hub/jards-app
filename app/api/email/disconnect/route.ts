import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { deleteEmailConnection } from "@/lib/email/connections";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const body = (await req.json().catch(() => ({}))) as { provider?: string };
  const provider = body.provider === "microsoft" ? "microsoft" : "google";

  try {
    await deleteEmailConnection(user.id, provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao desconectar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
