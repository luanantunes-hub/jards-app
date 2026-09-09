import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/calendar/require-user";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  try {
    const { contatoIds, empresaCrmId, limit = 30 } = (await req.json()) as {
      contatoIds?: string[];
      empresaCrmId?: string;
      limit?: number;
    };

    const supabase = await createClient();

    let ids = contatoIds ?? [];
    if (!ids.length && empresaCrmId) {
      const { data: contatos } = await (supabase as any)
        .from("contatos")
        .select("id")
        .eq("empresa_crm_id", empresaCrmId);
      ids = (contatos ?? []).map((c: { id: string }) => c.id);
    }

    if (!ids.length) return NextResponse.json({ emails: [] });

    const { data: emails, error } = await (supabase as any)
      .from("emails")
      .select("id, message_id, thread_id, from_email, from_name, to_emails, cc_emails, subject, snippet, body_text, sent_at, direction, contato_id, empresa_crm_id, captacao_id, user_id")
      .eq("visibility", "organization")
      .in("contato_id", ids)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return NextResponse.json({ emails: emails ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar emails";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
