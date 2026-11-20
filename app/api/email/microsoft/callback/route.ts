import { NextRequest, NextResponse } from "next/server";
import {
  clearEmailOAuthSession,
  readEmailOAuthSession,
  emailSettingsRedirect,
} from "@/lib/email/oauth";
import { exchangeMicrosoftEmailCode } from "@/lib/email/microsoft";
import { upsertEmailConnection } from "@/lib/email/connections";

/** A Microsoft devolve um texto técnico; quando é falta de aprovação da empresa, diz isso em português. */
function mensagemDoErro(erro: string, descricao: string | null): string {
  if (/AADSTS(65001|90094|90008|700016)|admin/i.test(descricao ?? "")) {
    return "A sua empresa exige que um administrador do Microsoft 365 aprove o acesso. Peça a aprovação a quem cuida do e-mail da empresa.";
  }
  return (descricao ?? erro).replace(/\s+/g, " ").trim().slice(0, 200);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const err = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (err) {
    await clearEmailOAuthSession();
    return NextResponse.redirect(
      emailSettingsRedirect({ email_error: mensagemDoErro(err, searchParams.get("error_description")) }),
    );
  }

  const session = await readEmailOAuthSession();
  await clearEmailOAuthSession();

  if (!code || !state || !session || session.nonce !== state || session.provider !== "microsoft") {
    return NextResponse.redirect(
      emailSettingsRedirect({ email_error: "oauth_invalido" }),
    );
  }

  try {
    const tokens = await exchangeMicrosoftEmailCode(code, session.verifier);

    if (!tokens.scopes.some((escopo) => escopo.toLowerCase().endsWith("mail.read"))) {
      return NextResponse.redirect(
        emailSettingsRedirect({ email_error: "Faltou a permissão de leitura do e-mail. Conecte de novo e aceite o acesso à caixa de entrada." }),
      );
    }

    await upsertEmailConnection({
      userId: session.userId,
      organizationId: session.organizationId,
      provider: "microsoft",
      email: tokens.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    return NextResponse.redirect(emailSettingsRedirect({ email: "microsoft" }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Falha ao conectar a Microsoft";
    return NextResponse.redirect(
      emailSettingsRedirect({ email_error: message }),
    );
  }
}
