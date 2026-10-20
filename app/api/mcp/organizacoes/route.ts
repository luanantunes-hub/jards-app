import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, requireModulo } from "@/lib/mcp/auth";

export async function GET(req: NextRequest) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;
  // Esta rota é da captação: uma chave que só autorizou a prestação de contas não passa.
  const semModulo = requireModulo(ctx, "captacao");
  if (semModulo) return semModulo;
  if (ctx.organizationIds.length === 0) return NextResponse.json({ organizacoes: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id,nome")
    .in("id", ctx.organizationIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ organizacoes: data });
}
