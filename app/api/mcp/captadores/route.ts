import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, requireModulo, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;
  // Esta rota é da captação: uma chave que só autorizou a prestação de contas não passa.
  const semModulo = requireModulo(ctx, "captacao");
  if (semModulo) return semModulo;

  const params = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, params.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const busca = params.get("busca");
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("captadores")
    .select("id,nome,email,ativo,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (busca) query = query.ilike("nome", `%${busca}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ captadores: data });
}
