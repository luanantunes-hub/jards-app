import { NextRequest, NextResponse } from "next/server";
import { microsoftEmailConfigured } from "@/lib/email/config";
import { podeConectarEmail } from "@/lib/email/liberacao";
import { startMicrosoftEmailOAuth } from "@/lib/email/microsoft";
import { emailSettingsRedirect } from "@/lib/email/oauth";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  if (!microsoftEmailConfigured()) {
    return NextResponse.json(
      { error: "Microsoft E-mail não configurado no servidor" },
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
    if (!(await podeConectarEmail({ id: user.id, email: user.email }, organization.organizationId))) {
      return NextResponse.redirect(emailSettingsRedirect({ email_error: "A conexão de e-mail ainda está em teste fechado." }));
    }
    const url = await startMicrosoftEmailOAuth(user.id, organization.organizationId);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao iniciar a conexão com a Microsoft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
