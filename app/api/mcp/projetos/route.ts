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
  const fase = params.get("fase");
  const limite = Math.min(Math.max(Number(params.get("limite") ?? 20), 1), 100);

  const admin = createAdminClient();
  let query = admin
    .from("projetos_crm")
    .select(
      "id,nome,descricao,fase,status_operacional,status_comercial,valor_alvo,valor_total,valor_garantido,proponente_nome,cidade,estado,data_inicio,data_fim,updated_at"
    )
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (busca) query = query.ilike("nome", `%${busca}%`);
  if (fase) query = query.eq("fase", fase);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projetos: data });
}
