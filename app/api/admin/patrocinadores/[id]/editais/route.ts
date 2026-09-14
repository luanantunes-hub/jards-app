import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EditalCreate = {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null) as EditalCreate | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();

  const { data: empresa } = await (admin as any).from("empresas").select("id").eq("id", id).maybeSingle();
  if (!empresa) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });

  const { data: edital, error } = await (admin as any)
    .from("editais")
    .insert({
      empresa_id: id,
      titulo: body.titulo || null,
      data_abertura: body.data_abertura || null,
      data_fechamento: body.data_fechamento || null,
      url_acesso: body.url_acesso || null,
      ativo: true,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    action: "create",
    resourceType: "edital",
    resourceId: edital.id,
    summary: `Edital criado: ${edital.titulo ?? edital.id}`,
    metadata: { empresaId: id },
  });

  return NextResponse.json({ ok: true, edital });
}
