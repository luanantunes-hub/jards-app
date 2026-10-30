// POST /api/suporte/mensagem: a pessoa logada manda uma mensagem para a equipe pelo botão "?" do app.
// Guarda em suporte_mensagens e avisa por e-mail (SUPORTE_EMAIL_DESTINO; sem ele, o e-mail do Luan). A regra e os limites
// ficam em lib/suporte/mensagem.ts.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { lerMensagem, registrarMensagemDeSuporte } from "@/lib/suporte/mensagem";

const DESTINO_PADRAO = "luan.antunes@jards.com.br";
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Entre na sua conta para falar com a equipe." }, { status: 401, headers: SEM_CACHE });
  }

  const corpo = await req.json().catch(() => null);
  const lido = lerMensagem(corpo);
  if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400, headers: SEM_CACHE });

  const metadados = (user.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const nome = [metadados.full_name, metadados.name].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null;

  const resultado = await registrarMensagemDeSuporte(
    {
      admin: createAdminClient(),
      enviarEmail: sendTransactionalEmail,
      destino: process.env.SUPORTE_EMAIL_DESTINO || DESTINO_PADRAO,
      agora: Date.now,
    },
    { userId: user.id, email: user.email ?? null, nome },
    lido.lida,
  );
  if (!resultado.ok) return NextResponse.json({ error: resultado.erro }, { status: resultado.status, headers: SEM_CACHE });
  return NextResponse.json({ ok: true }, { status: 201, headers: SEM_CACHE });
}
