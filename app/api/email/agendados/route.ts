import { NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

/** Os e-mails agendados da pessoa: os que esperam a hora e os que falharam (com o motivo). */
export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  try {
    const { data, error } = await (createAdminClient() as any)
      .from("email_agendados")
      .select("id, provider, para, cc, assunto, enviar_em, estado, erro, tentativas")
      .eq("user_id", user.id)
      .in("estado", ["pendente", "enviando", "falhou"])
      .order("enviar_em", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return NextResponse.json({ agendados: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao listar os agendados" }, { status: 500 });
  }
}
