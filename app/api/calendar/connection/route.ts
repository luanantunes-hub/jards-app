import { NextRequest, NextResponse } from "next/server";
import type { CalendarProvider } from "@/lib/calendar/config";
import { updateConnection } from "@/lib/calendar/connections";
import { requireUser } from "@/lib/calendar/require-user";

export async function PATCH(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const body = await req.json() as {
    provider?: CalendarProvider;
    calendar_id?: string;
    calendar_name?: string | null;
    sync_enabled?: boolean;
  };

  if (body.provider !== "google" && body.provider !== "microsoft") {
    return NextResponse.json({ error: "Provedor inválido" }, { status: 400 });
  }

  const patch: {
    calendar_id?: string;
    calendar_name?: string | null;
    sync_enabled?: boolean;
  } = {};
  if (typeof body.calendar_id === "string" && body.calendar_id) patch.calendar_id = body.calendar_id;
  if (body.calendar_name !== undefined) patch.calendar_name = body.calendar_name;
  if (typeof body.sync_enabled === "boolean") patch.sync_enabled = body.sync_enabled;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  try {
    await updateConnection(user.id, body.provider, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao atualizar conexão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
