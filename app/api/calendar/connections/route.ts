import { NextResponse } from "next/server";
import { googleConfigured, microsoftConfigured } from "@/lib/calendar/config";
import { listPublicConnections } from "@/lib/calendar/connections";
import { requireUser } from "@/lib/calendar/require-user";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const connections = await listPublicConnections(user.id);
    return NextResponse.json({
      googleConfigured: googleConfigured(),
      microsoftConfigured: microsoftConfigured(),
      connections,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao listar conexões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
