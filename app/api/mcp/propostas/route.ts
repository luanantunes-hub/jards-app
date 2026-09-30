import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, params.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const projetoId = params.get("projeto_id");
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("propostas")
    .select("id,projeto_id,titulo,status,valor_proposto,total_visualizacoes,created_at,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (projetoId) query = query.eq("projeto_id", projetoId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ propostas: data });
}
