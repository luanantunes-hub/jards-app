import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeAdminAuditLog } from "@/lib/admin/audit";

/* O schema ainda não foi regenerado com a tabela de auditoria. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const ALLOWED_ACTIONS = new Set(["create", "update", "delete", "impersonate", "view", "approve", "reject"]);
const ALLOWED_RESOURCES = new Set(["patrocinador", "usuario", "pedido", "blog", "sistema"]);

async function getAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isSuperAdmin: false };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("jards_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, isSuperAdmin: profile?.jards_super_admin === true };
}

export async function POST(request: NextRequest) {
  const { user, isSuperAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isSuperAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const resourceType = typeof body?.resourceType === "string" ? body.resourceType : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  if (!ALLOWED_ACTIONS.has(action) || !ALLOWED_RESOURCES.has(resourceType) || !summary) {
    return NextResponse.json({ error: "Evento de auditoria inválido" }, { status: 400 });
  }

  await writeAdminAuditLog({
    actorUserId: user.id,
    organizationId: null,
    action,
    resourceType,
    resourceId: typeof body?.resourceId === "string" ? body.resourceId : null,
    targetUserId: typeof body?.targetUserId === "string" ? body.targetUserId : null,
    summary,
    metadata: typeof body?.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {},
  });

  return NextResponse.json({ ok: true });
}

function safeSearch(value: string) {
  return value.replace(/[,%()]/g, " ").trim().slice(0, 80);
}

export async function GET(request: NextRequest) {
  const { supabase, user, isSuperAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isSuperAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(10, Number(params.get("limit") ?? 25) || 25));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const query = safeSearch(params.get("q") ?? "");
  const action = params.get("action") ?? "";
  const resourceType = params.get("resource") ?? "";

  let builder = (supabase as any)
    .from("admin_audit_logs")
    .select("id, actor_user_id, organization_id, action, resource_type, resource_id, target_user_id, summary, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (query) builder = builder.or(`summary.ilike.%${query}%,resource_id.ilike.%${query}%`);
  if (action) builder = builder.eq("action", action);
  if (resourceType) builder = builder.eq("resource_type", resourceType);
  const dateFrom = params.get("from");
  const dateTo = params.get("to");
  if (dateFrom) builder = builder.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  if (dateTo) builder = builder.lte("created_at", `${dateTo}T23:59:59.999Z`);

  const { data, count, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{ actor_user_id: string | null; target_user_id: string | null }>;
  const profileIds = [...new Set(rows.flatMap(row => [row.actor_user_id, row.target_user_id]).filter(Boolean))];
  const { data: profiles } = profileIds.length > 0
    ? await (supabase as any).from("profiles").select("id, full_name, email").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile: { id: string; full_name: string | null; email: string | null }) => [profile.id, profile]));

  return NextResponse.json({
    data: rows.map((row: any) => ({
      ...row,
      actor: row.actor_user_id ? profileMap.get(row.actor_user_id) ?? null : null,
      target: row.target_user_id ? profileMap.get(row.target_user_id) ?? null : null,
    })),
    page,
    limit,
    total: count ?? 0,
  });
}
