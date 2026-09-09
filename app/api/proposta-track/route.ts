import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { proposta_id, duracao_segundos } = body;

    if (
      typeof proposta_id !== "string" ||
      !UUID_RE.test(proposta_id) ||
      typeof duracao_segundos !== "number"
    ) {
      return NextResponse.json({ ok: true }); // silently ignore invalid
    }

    await adminClient()
      .from("proposta_visualizacoes")
      .update({ duracao_segundos: Math.min(duracao_segundos, 86400) })
      .eq("proposta_id", proposta_id)
      .is("duracao_segundos", null)
      .order("visualizado_em", { ascending: false })
      .limit(1);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never block the beacon
  }
}
