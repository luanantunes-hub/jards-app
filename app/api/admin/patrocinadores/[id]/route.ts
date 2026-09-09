import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type EmpresaUpdate = {
  nome?: string;
  setor?: string | null;
  cidade?: string | null;
  estado?: string | null;
  site?: string | null;
  email_geral?: string | null;
  telefone?: string | null;
  logo_url?: string | null;
  descricao?: string | null;
  trimestre_1?: boolean | null;
  trimestre_2?: boolean | null;
  trimestre_3?: boolean | null;
  trimestre_4?: boolean | null;
  aporte_estimado?: number | null;
  tem_detalhe?: boolean | null;
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
  const body = await request.json().catch(() => null) as EmpresaUpdate | null;
  if (!body || !id) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await (admin as any)
    .from("empresas")
    .select("id,nome,tem_detalhe")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "Patrocinador não encontrado" }, { status: 404 });

  const { data: empresa, error: updateError } = await (admin as any)
    .from("empresas")
    .update(body)
    .eq("id", id)
    .select("id,nome,tem_detalhe")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const becameAvailable = before.tem_detalhe !== true && empresa.tem_detalhe === true;

  await writeAdminAuditLog({
    actorUserId: user.id,
    action: "update",
    resourceType: "patrocinador",
    resourceId: id,
    summary: becameAvailable ? "Patrocinador disponibilizado" : "Dados do patrocinador atualizados",
    metadata: { becameAvailable },
  });

  return NextResponse.json({
    ok: true,
    empresa,
  });
}
