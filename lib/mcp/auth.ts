import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MCP_KEY_PREFIX = "jards_mcp_";

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `${MCP_KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, MCP_KEY_PREFIX.length + 6) };
}

export interface McpAuthContext {
  userId: string;
  organizationIds: string[];
}

/**
 * Autentica uma requisição do MCP/Custom GPT pelo header `Authorization: Bearer <chave>`.
 * Nunca confia em organization_id vindo da requisição: resolve as organizações do
 * dono da chave e usa só essas — o mesmo corte que o RLS aplicaria no app web.
 */
export async function authenticateMcpRequest(
  req: NextRequest
): Promise<McpAuthContext | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!rawKey) {
    return NextResponse.json({ error: "Informe a chave em Authorization: Bearer <chave>" }, { status: 401 });
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);
  const { data: key, error } = await admin
    .from("mcp_api_keys")
    .select("id,user_id,revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!key || key.revoked_at) {
    return NextResponse.json({ error: "Chave inválida ou revogada" }, { status: 401 });
  }

  void admin.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", key.user_id);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  return { userId: key.user_id, organizationIds: (memberships ?? []).map((m) => m.organization_id) };
}

export function resolveOrgId(ctx: McpAuthContext, requested: string | null): string | NextResponse {
  if (requested) {
    if (!ctx.organizationIds.includes(requested)) {
      return NextResponse.json({ error: "Você não pertence a essa organização" }, { status: 403 });
    }
    return requested;
  }
  if (ctx.organizationIds.length === 1) return ctx.organizationIds[0];
  if (ctx.organizationIds.length === 0) {
    return NextResponse.json({ error: "Você não pertence a nenhuma organização" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Você pertence a mais de uma organização — informe organization_id", organizacoes: ctx.organizationIds },
    { status: 400 }
  );
}

export function isErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
