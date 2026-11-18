import { NextRequest, NextResponse } from "next/server";
import {
  clearEmailOAuthSession,
  readEmailOAuthSession,
  emailSettingsRedirect,
} from "@/lib/email/oauth";
import { exchangeGoogleEmailCode } from "@/lib/email/google";
import { upsertEmailConnection } from "@/lib/email/connections";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (err) {
    await clearEmailOAuthSession();
    return NextResponse.redirect(emailSettingsRedirect({ email_error: err }));
  }

  const session = await readEmailOAuthSession();
  await clearEmailOAuthSession();

  if (!code || !state || !session || session.nonce !== state || (session.provider ?? "google") !== "google") {
    return NextResponse.redirect(
      emailSettingsRedirect({ email_error: "oauth_invalido" }),
    );
  }

  try {
    const tokens = await exchangeGoogleEmailCode(code, session.verifier);

    // O Google deixa desmarcar permissões na tela de autorização: sem a leitura do Gmail não há o que sincronizar.
    if (!tokens.scopes.some((escopo) => escopo.endsWith("/gmail.readonly"))) {
      return NextResponse.redirect(
        emailSettingsRedirect({ email_error: "Faltou a permissão de leitura do Gmail. Conecte de novo e marque o acesso ao e-mail." }),
      );
    }

    await upsertEmailConnection({
      userId: session.userId,
      organizationId: session.organizationId,
      provider: "google",
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    return NextResponse.redirect(emailSettingsRedirect({ email: "google" }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao conectar Gmail";
    return NextResponse.redirect(
      emailSettingsRedirect({ email_error: message }),
    );
  }
}
