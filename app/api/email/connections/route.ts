import { NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { listEmailConnections } from "@/lib/email/connections";
import { googleEmailConfigured } from "@/lib/email/config";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const connections = await listEmailConnections(user.id);
    return NextResponse.json({
      googleConfigured: googleEmailConfigured(),
      connections,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar conexões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
