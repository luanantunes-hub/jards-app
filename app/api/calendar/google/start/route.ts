import { NextRequest, NextResponse } from "next/server";
import { googleConfigured } from "@/lib/calendar/config";
import { startGoogleOAuth } from "@/lib/calendar/google";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google Calendar não configurado no servidor" }, { status: 503 });
  }

  try {
    const organization = await resolveAuthorizedOrganizationId(
      req.nextUrl.searchParams.get("organization_id") || null,
    );
    if (!organization.authorized) {
      return NextResponse.json({ error: "Organização inválida" }, { status: 403 });
    }
    const url = await startGoogleOAuth(user.id, organization.organizationId);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao iniciar OAuth Google";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
