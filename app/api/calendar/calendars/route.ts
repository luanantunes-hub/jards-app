import { NextRequest, NextResponse } from "next/server";
import type { CalendarProvider } from "@/lib/calendar/config";
import { listCalendarsForUser } from "@/lib/calendar/connections";
import { requireUser } from "@/lib/calendar/require-user";

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const provider = req.nextUrl.searchParams.get("provider") as CalendarProvider | null;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Provedor inválido" }, { status: 400 });
  }

  try {
    const calendars = await listCalendarsForUser(user.id, provider);
    return NextResponse.json({ calendars });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao listar calendários";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
