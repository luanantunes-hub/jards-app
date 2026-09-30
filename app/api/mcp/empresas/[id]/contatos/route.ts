import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

/**
 * Ver os contatos de uma empresa consome 1 crédito da organização, na primeira
 * vez (mesma regra do app — fn_desbloquear_empresa_as). Se já estava
 * desbloqueada, não cobra de novo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const searchParams = req.nextUrl.searchParams;
  const orgId = resolveOrgId(ctx, searchParams.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const { id: empresaCrmId } = await params;
  const admin = createAdminClient();

  const { data: desbloqueio, error: desbloqueioError } = await admin.rpc("fn_desbloquear_empresa_as", {
    p_user_id: ctx.userId,
    p_organization_id: orgId,
    p_empresa_id: empresaCrmId,
  });
  if (desbloqueioError) return NextResponse.json({ error: desbloqueioError.message }, { status: 402 });

  const busca = searchParams.get("busca");
  const limite = Math.min(Math.max(Number(searchParams.get("limite") ?? 20), 1), 100);

  let query = admin
    .from("contatos")
    .select(
      "id,nome,cargo,email,telefone,telefone_2,linkedin_url,papel_decisao,sentimento,score,ativo_na_empresa,ultima_interacao,updated_at"
    )
    .eq("organization_id", orgId)
    .eq("empresa_crm_id", empresaCrmId)
    .order("updated_at", { ascending: false })
    .limit(limite);
  if (busca) query = query.ilike("nome", `%${busca}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ desbloqueio, contatos: data });
}
