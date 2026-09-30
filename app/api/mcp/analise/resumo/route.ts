import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

function contarPor<T extends Record<string, unknown>>(rows: T[], campo: keyof T) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const chave = String(row[campo] ?? "sem_status");
    out[chave] = (out[chave] ?? 0) + 1;
  }
  return out;
}

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const orgId = resolveOrgId(ctx, req.nextUrl.searchParams.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const admin = createAdminClient();
  const [projetos, propostas, tarefas, vendas] = await Promise.all([
    admin.from("projetos_crm").select("fase,status_comercial,valor_total").eq("organization_id", orgId),
    admin.from("propostas").select("status").eq("organization_id", orgId),
    admin.from("tarefas").select("status").eq("organization_id", orgId),
    admin.from("vendas_patrocinio").select("valor_vendido").eq("organization_id", orgId),
  ]);
  for (const r of [projetos, propostas, tarefas, vendas]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  return NextResponse.json({
    projetos_por_fase: contarPor(projetos.data ?? [], "fase"),
    projetos_por_status_comercial: contarPor(projetos.data ?? [], "status_comercial"),
    propostas_por_status: contarPor(propostas.data ?? [], "status"),
    tarefas_por_status: contarPor(tarefas.data ?? [], "status"),
    valor_total_captado_historico: (vendas.data ?? []).reduce((acc, v) => acc + (v.valor_vendido ?? 0), 0),
    total_projetos: (projetos.data ?? []).length,
  });
}
