import { NextResponse } from "next/server";
import { requireUser, resolveAuthorizedOrganizationId } from "@/lib/calendar/require-user";
import { listEmailConnections } from "@/lib/email/connections";
import { googleEmailConfigured, microsoftEmailConfigured } from "@/lib/email/config";
import { podeConectarEmail } from "@/lib/email/liberacao";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const connections = await listEmailConnections(user.id);
    const organization = await resolveAuthorizedOrganizationId(null);
    return NextResponse.json({
      googleConfigured: googleEmailConfigured(),
      microsoftConfigured: microsoftEmailConfigured(),
      // Quem pode conectar agora: o recurso está em beta fechado (ver lib/email/beta.ts).
      beta: await podeConectarEmail({ id: user.id, email: user.email }, organization.organizationId),
      connections,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar conexões";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
