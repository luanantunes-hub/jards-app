import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function adminClient() {
  return createSupabaseClient(
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

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const organizationId = req.nextUrl.searchParams.get("organization_id") ?? "";
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });

  const admin = adminClient();
  const { data: requester, error: requesterError } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (requesterError) return NextResponse.json({ error: requesterError.message }, { status: 500 });
  if (!requester) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("user_id,papel,created_at,modulos_acesso,prestacao_funcao")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  const userIds = (memberships ?? []).map(member => member.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const profileById = new Map((profiles ?? []).map(profile => [profile.id, profile]));
  const members = (memberships ?? []).map(member => {
    const profile = profileById.get(member.user_id);
    return {
      user_id: member.user_id,
      papel: member.papel,
      modulos_acesso: member.modulos_acesso ?? ["captacao"],
      prestacao_funcao: member.prestacao_funcao ?? null,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      created_at: member.created_at,
    };
  });

  return NextResponse.json(
    { members },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
