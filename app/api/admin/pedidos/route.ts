import { NextRequest, NextResponse } from "next/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PedidoStatus = "pendente" | "entregue";

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

export async function GET() {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const admin = createAdminClient();
  const { data: requests, error } = await (admin as any)
    .from("solicitacoes_pesquisa_empresa")
    .select("id,created_at,updated_at,concluida_em,solicitante_id,empresa_id,organization_id,status")
    .in("status", ["pendente", "em_pesquisa", "concluida"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = requests ?? [];
  const userIds = [...new Set(rows.map((row: any) => row.solicitante_id))] as string[];
  const empresaIds = [...new Set(rows.map((row: any) => row.empresa_id))] as string[];
  const [{ data: profiles }, { data: empresas }] = await Promise.all([
    userIds.length
      ? (admin as any).from("profiles").select("id,full_name,email").in("id", userIds)
      : Promise.resolve({ data: [] }),
    empresaIds.length
      ? (admin as any).from("empresas").select("id,nome,tem_detalhe").in("id", empresaIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  const empresaById = new Map((empresas ?? []).map((empresa: any) => [empresa.id, empresa]));

  return NextResponse.json({
    pedidos: rows.map((row: any) => {
      const profile = profileById.get(row.solicitante_id) as any;
      const empresa = empresaById.get(row.empresa_id) as any;
      return {
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        concluida_em: row.concluida_em,
        organization_id: row.organization_id,
        solicitante_id: row.solicitante_id,
        empresa_id: row.empresa_id,
        status: row.status === "concluida" ? "entregue" : "pendente",
        user_nome: profile?.full_name ?? null,
        user_email: profile?.email ?? null,
        empresa_nome: empresa?.nome ?? null,
        tem_detalhe: empresa?.tem_detalhe === true,
      };
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const { user, allowed } = await requireSuperAdmin();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    id?: string;
    status?: PedidoStatus;
  } | null;
  if (!body?.id || !body.status || !["pendente", "entregue"].includes(body.status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current, error: findError } = await (admin as any)
    .from("solicitacoes_pesquisa_empresa")
    .select("id,empresa_id,solicitante_id,organization_id,status")
    .eq("id", body.id)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  if (body.status === "entregue") {
    const { error: empresaError } = await (admin as any)
      .from("empresas")
      .update({ tem_detalhe: true })
      .eq("id", current.empresa_id);
    if (empresaError) return NextResponse.json({ error: empresaError.message }, { status: 500 });
  }

  const dbStatus = body.status === "entregue" ? "concluida" : "pendente";
  const { data: updated, error: updateError } = await (admin as any)
    .from("solicitacoes_pesquisa_empresa")
    .update({
      status: dbStatus,
      concluida_em: body.status === "entregue" ? new Date().toISOString() : null,
    })
    .eq("id", body.id)
    .select("id,status,updated_at,concluida_em")
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await writeAdminAuditLog({
    actorUserId: user.id,
    organizationId: current.organization_id,
    action: "update",
    resourceType: "pedido",
    resourceId: current.id,
    targetUserId: current.solicitante_id,
    summary: body.status === "entregue"
      ? "Pedido de pesquisa entregue e solicitante notificado"
      : "Pedido de pesquisa devolvido para pendente",
    metadata: { status: body.status, empresa_id: current.empresa_id },
  });

  return NextResponse.json({
    ok: true,
    status: updated.status === "concluida" ? "entregue" : "pendente",
    updated_at: updated.updated_at,
    concluida_em: updated.concluida_em,
  });
}
