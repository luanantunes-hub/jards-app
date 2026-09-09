import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function currentUser() {
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    organization_id?: string;
    nome?: string;
    avatar_url?: string | null;
  } | null;
  const organizationId = body?.organization_id ?? "";
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });

  const update: Record<string, string | null> = {};
  if (body?.nome !== undefined) {
    const nome = String(body.nome ?? "").trim();
    if (nome.length < 2) return NextResponse.json({ error: "Nome da organização inválido" }, { status: 400 });
    update.nome = nome;
  }
  if (body?.avatar_url !== undefined) update.avatar_url = body.avatar_url;

  if (Object.keys(update).length !== 1) {
    return NextResponse.json({ error: "Envie exatamente uma alteração por vez" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: membership } = await admin
    .from("organization_members")
    .select("papel")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.papel !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}