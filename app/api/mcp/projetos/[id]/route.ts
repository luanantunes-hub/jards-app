import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateMcpRequest, isErrorResponse, resolveOrgId } from "@/lib/mcp/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await authenticateMcpRequest(req);
  if (isErrorResponse(ctx)) return ctx;

  const orgId = resolveOrgId(ctx, req.nextUrl.searchParams.get("organization_id"));
  if (isErrorResponse(orgId)) return orgId;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projetos_crm")
    .select("*")
    .eq("organization_id", orgId)
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ projeto: data });
}
