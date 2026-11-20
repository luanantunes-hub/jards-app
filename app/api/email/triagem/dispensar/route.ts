import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { listEmailConnections } from "@/lib/email/connections";
import { podeConectarEmail } from "@/lib/email/liberacao";
import { dispensarRemetente } from "@/lib/email/triagem-acoes";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const corpo = (await req.json().catch(() => null)) as { organizationId?: unknown; endereco?: unknown } | null;
  const organizationId = typeof corpo?.organizationId === "string" ? corpo.organizationId : "";
  const endereco = typeof corpo?.endereco === "string" ? corpo.endereco : "";
  if (!UUID.test(organizationId) || !endereco.includes("@") || endereco.length > 254) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  try {
    // A organização precisa ser a de uma conexão de e-mail da própria pessoa.
    const conexoes = await listEmailConnections(user.id);
    if (!conexoes.some((conexao) => conexao.organization_id === organizationId)) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }
    if (!(await podeConectarEmail({ id: user.id, email: user.email }, organizationId))) {
      return NextResponse.json({ error: "O e-mail ainda está em teste fechado." }, { status: 403 });
    }
    const resultado = await dispensarRemetente(createAdminClient() as any, user.id, organizationId, endereco);
    return NextResponse.json(resultado.corpo, { status: resultado.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao tratar o remetente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
