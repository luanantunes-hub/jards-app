import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type Role = "admin" | "captador" | "colaborador" | "leitor";

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

async function authorizeAdmin(organizationId: string, userId: string) {
  const admin = adminClient();
  const { data, error } = await admin.from("organization_members")
    .select("papel")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.papel === "admin";
}

async function targetMembership(organizationId: string, targetUserId: string) {
  const admin = adminClient();
  const { data, error } = await admin.from("organization_members")
    .select("id, papel")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function adminCount(organizationId: string) {
  const admin = adminClient();
  const { count, error } = await admin.from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("papel", "admin");
  if (error) throw error;
  return count ?? 0;
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { userId: targetUserId } = await context.params;
  const body = await req.json().catch(() => null) as { organization_id?: string; role?: Role } | null;
  const organizationId = body?.organization_id ?? "";
  const role = body?.role ?? "";
  if (!organizationId || !["admin", "captador", "colaborador", "leitor"].includes(role)) {
    return NextResponse.json({ error: "Alteração inválida" }, { status: 400 });
  }

  const admin = adminClient();
  try {
    if (!await authorizeAdmin(organizationId, user.id)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    const target = await targetMembership(organizationId, targetUserId);
    if (!target) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    if (targetUserId === user.id && role !== "admin") {
      return NextResponse.json({ error: "Você não pode remover seu próprio acesso administrativo" }, { status: 409 });
    }
    if (target.papel === "admin" && role !== "admin" && await adminCount(organizationId) <= 1) {
      return NextResponse.json({ error: "A organização precisa manter ao menos um administrador" }, { status: 409 });
    }
    const { error } = await admin.from("organization_members").update({ papel: role })
      .eq("organization_id", organizationId).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao alterar membro" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { userId: targetUserId } = await context.params;
  const body = await req.json().catch(() => null) as { organization_id?: string } | null;
  const organizationId = body?.organization_id ?? "";
  if (!organizationId) return NextResponse.json({ error: "Organização não informada" }, { status: 400 });

  const admin = adminClient();
  try {
    if (!await authorizeAdmin(organizationId, user.id)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    if (targetUserId === user.id) return NextResponse.json({ error: "Você não pode remover a si mesmo por esta tela" }, { status: 409 });
    const target = await targetMembership(organizationId, targetUserId);
    if (!target) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    if (target.papel === "admin" && await adminCount(organizationId) <= 1) {
      return NextResponse.json({ error: "A organização precisa manter ao menos um administrador" }, { status: 409 });
    }
    const { error } = await admin.from("organization_members").delete()
      .eq("organization_id", organizationId).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao remover membro" }, { status: 500 });
  }
}
