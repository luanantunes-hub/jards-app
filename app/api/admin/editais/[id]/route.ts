import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EditalUpdate = {
  titulo?: string | null;
  data_abertura?: string | null;
  data_fechamento?: string | null;
  url_acesso?: string | null;
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as EditalUpdate | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: edital, error } = await (admin as any)
    .from("editais")
    .update(body)
    .eq("id", id)
    .select("id,titulo")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!edital) return NextResponse.json({ error: "Edital não encontrado" }, { status: 404 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    action: "update",
    resourceType: "edital",
    resourceId: id,
    summary: `Edital atualizado: ${edital.titulo ?? id}`,
    metadata: { changes: body },
  });

  return NextResponse.json({ ok: true, edital });
}
