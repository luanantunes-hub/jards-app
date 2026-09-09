import { NextRequest, NextResponse } from "next/server";
import { clearOAuthSession, readOAuthSession, settingsRedirect } from "@/lib/calendar/oauth";
import { exchangeGoogleCode, listGoogleCalendars } from "@/lib/calendar/google";
import { upsertConnection } from "@/lib/calendar/connections";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (err) {
    await clearOAuthSession();
    return NextResponse.redirect(settingsRedirect({ calendar_error: err }));
  }

  const session = await readOAuthSession();
  await clearOAuthSession();

  if (!code || !state || !session || session.provider !== "google" || session.nonce !== state) {
    return NextResponse.redirect(settingsRedirect({ calendar_error: "oauth_invalido" }));
  }

  try {
    const tokens = await exchangeGoogleCode(code, session.verifier);
    const calendars = await listGoogleCalendars(tokens.accessToken);
    const writable = calendars.filter((c) => c.canWrite);
    const primary = writable.find((c) => c.primary) ?? writable[0] ?? calendars[0];

    await upsertConnection({
      userId: session.userId,
      organizationId: session.organizationId,
      provider: "google",
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      calendarId: primary?.id ?? "primary",
      calendarName: primary?.name ?? "Principal",
    });

    return NextResponse.redirect(settingsRedirect({ calendar: "google" }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao conectar Google";
    return NextResponse.redirect(settingsRedirect({ calendar_error: message }));
  }
}
