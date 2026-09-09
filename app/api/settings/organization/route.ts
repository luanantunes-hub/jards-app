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
    visibilidade_captacoes?: "admin_only" | "team_shared";
    acesso_contatos?: "admin_only" | "team_with_credits";
  } | null;
  const organizationId = body?.organization_id ?? "";
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });

  const update: Record<string, string> = {};
  if (body?.visibilidade_captacoes) {
    if (!["admin_only", "team_shared"].includes(body.visibilidade_captacoes)) {
      return NextResponse.json({ error: "Visibilidade inválida" }, { status: 400 });
    }
    update.visibilidade_captacoes = body.visibilidade_captacoes;
  }
  if (body?.acesso_contatos) {
    if (!["admin_only", "team_with_credits"].includes(body.acesso_contatos)) {
      return NextResponse.json({ error: "Regra de contatos inválida" }, { status: 400 });
    }
    update.acesso_contatos = body.acesso_contatos;
  }
  if (Object.keys(update).length !== 1) {
    return NextResponse.json({ error: "Envie exatamente uma configuração por vez" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("papel")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });
  if (membership?.papel !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { data, error } = await admin
    .from("config_org")
    .update(update)
    .eq("organization_id", organizationId)
    .select("organization_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Configuração da organização não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
