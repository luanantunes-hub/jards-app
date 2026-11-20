import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { apagarAnexos } from "@/lib/email/anexos-storage";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cancela um e-mail agendado que ainda não saiu (ou tira da lista um que falhou). Só os da própria pessoa. */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const corpo = (await req.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof corpo?.id !== "string" || !UUID.test(corpo.id)) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("email_agendados")
      .update({ estado: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", corpo.id)
      .eq("user_id", user.id)
      .in("estado", ["pendente", "falhou"])
      .select("id, anexos");
    if (error) throw new Error(error.message);
    if (!(data ?? []).length) return NextResponse.json({ error: "Esse e-mail já foi enviado ou não está mais na fila." }, { status: 409 });
    await apagarAnexos(admin, data[0].anexos ?? []);
    return NextResponse.json({ cancelado: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao cancelar" }, { status: 500 });
  }
}
