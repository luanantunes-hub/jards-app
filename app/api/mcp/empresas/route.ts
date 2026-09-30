import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const params = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, params.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const busca = params.get("busca");
  const tipo = params.get("tipo");
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("empresas_crm")
    .select("id,nome,setor,site,tipo,status,localizacao,ja_patrocina_cultura,ja_patrocina_esporte,updated_at")
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (busca) query = query.ilike("nome", `%${busca}%`);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ empresas: data });
}
