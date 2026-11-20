import { NextRequest, NextResponse } from "next/server";
import { googleEmailConfigured } from "@/lib/email/config";
import { startGoogleEmailOAuth } from "@/lib/email/google";
import { podeConectarEmail } from "@/lib/email/liberacao";
import { emailSettingsRedirect } from "@/lib/email/oauth";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (!googleEmailConfigured()) {
    return NextResponse.json(
      { error: "Google Email não configurado no servidor" },
      { status: 503 },
    );
  }

  try {
    const organization = await resolveAuthorizedOrganizationId(
      req.nextUrl.searchParams.get("organization_id") || null,
    );
    if (!organization.authorized) {
      return NextResponse.json({ error: "Organização inválida" }, { status: 403 });
    }
    // O Google só deixa 100 pessoas autorizarem o app enquanto ele não é verificado: só entra quem está no beta.
    if (!(await podeConectarEmail({ id: user.id, email: user.email }, organization.organizationId))) {
      return NextResponse.redirect(emailSettingsRedirect({ email_error: "A conexão de e-mail ainda está em teste fechado." }));
    }
    const url = await startGoogleEmailOAuth(user.id, organization.organizationId);
    return NextResponse.redirect(url);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha ao iniciar OAuth Gmail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
