import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ResponsavelUpdate = {
  nome?: string;
  cargo?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
};

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, allowed: false };
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  return { user, allowed: profile?.jards_super_admin === true };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responsavelId: string }> },
) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id, responsavelId } = await params;
  const body = await request.json().catch(() => null) as ResponsavelUpdate | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: responsavel, error } = await (admin as any)
    .from("responsaveis")
    .update(body)
    .eq("id", responsavelId)
    .eq("empresa_id", id)
    .select("id,nome")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!responsavel) return NextResponse.json({ error: "Responsável não encontrado" }, { status: 404 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    action: "update",
    resourceType: "responsavel",
    resourceId: responsavelId,
    summary: `Responsável atualizado: ${responsavel.nome}`,
    metadata: { empresaId: id, changes: body },
  });

  return NextResponse.json({ ok: true, responsavel });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responsavelId: string }> },
) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id, responsavelId } = await params;
  const admin = createAdminClient();

  const { data: before } = await (admin as any)
    .from("responsaveis")
    .select("id,nome")
    .eq("id", responsavelId)
    .eq("empresa_id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Responsável não encontrado" }, { status: 404 });

  const { error } = await (admin as any)
    .from("responsaveis")
    .delete()
    .eq("id", responsavelId);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Este responsável já foi salvo nos contatos de alguma organização e não pode ser removido." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAdminAuditLog({
    actorUserId: user.id,
    action: "delete",
    resourceType: "responsavel",
    resourceId: responsavelId,
    summary: `Responsável removido: ${before.nome}`,
    metadata: { empresaId: id },
  });

  return NextResponse.json({ ok: true });
}
