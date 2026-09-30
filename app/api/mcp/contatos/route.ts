import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

export async function POST(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const body = await req.json().catch(() => ({}));
  const orgId = resolveOrgId(ctx, body.organization_id ?? null);
  if (isErrorResponse(orgId)) return orgId;

  if (!body.nome || typeof body.nome !== "string" || !body.nome.trim()) {
    return NextResponse.json({ error: "Informe nome" }, { status: 400 });
  }

  const campos = {
    nome: body.nome.trim(),
    empresa_crm_id: body.empresa_crm_id ?? null,
    proponente_id: body.proponente_id ?? null,
    captador_id: body.captador_id ?? null,
    cargo: body.cargo ?? null,
    email: body.email ?? null,
    telefone: body.telefone ?? null,
    linkedin_url: body.linkedin_url ?? null,
    origem: body.origem ?? null,
    notas: body.notas ?? null,
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contatos")
    .insert({ organization_id: orgId, account_id: ctx.userId, ...campos })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contato: data }, { status: 201 });
}
