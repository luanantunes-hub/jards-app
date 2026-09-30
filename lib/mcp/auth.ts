import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited } from "@/lib/mcp/rateLimit";

const MAX_REQUESTS_PER_KEY_PER_MIN = 60;
const MAX_FAILED_AUTH_PER_IP_PER_MIN = 20;

export type McpKeyScope = "read" | "write";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

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
  scope: McpKeyScope;
}

/**
 * Autentica uma requisição do MCP/Custom GPT pelo header `Authorization: Bearer <chave>`.
 * Nunca confia em organization_id vindo da requisição: resolve as organizações do
 * dono da chave e usa só essas — o mesmo corte que o RLS aplicaria no app web.
 */
export async function authenticateMcpRequest(
  req: NextRequest
): Promise<McpAuthContext | NextResponse> {
  const ip = getIp(req);

  // Barato e antes de tocar o banco: contém tentativas de adivinhar uma chave.
  if (isRateLimited(`mcp-auth-fail:${ip}`, MAX_FAILED_AUTH_PER_IP_PER_MIN)) {
    return NextResponse.json({ error: "Muitas tentativas de autenticação. Aguarde um momento." }, { status: 429 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const rawKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!rawKey) {
    return NextResponse.json({ error: "Informe a chave em Authorization: Bearer <chave>" }, { status: 401 });
  }

  const admin = createAdminClient();
  const keyHash = hashApiKey(rawKey);
  const { data: key, error } = await admin
    .from("mcp_api_keys")
    .select("id,user_id,revoked_at,expires_at,scope")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!key || key.revoked_at) {
    return NextResponse.json({ error: "Chave inválida ou revogada" }, { status: 401 });
  }
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Chave expirada — gere uma nova em /configuracoes/mcp" }, { status: 401 });
  }

  // Limite por chave — independe de IP, então funciona igual atrás do egress
  // compartilhado de um provedor de LLM (ex. ChatGPT) sem punir outras chaves.
  if (isRateLimited(`mcp-key:${key.id}`, MAX_REQUESTS_PER_KEY_PER_MIN)) {
    return NextResponse.json({ error: "Limite de requisições da chave excedido. Aguarde um momento." }, { status: 429 });
  }

  void admin.from("mcp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  // Trilha de auditoria — "quem acessou o quê, quando". Fire-and-forget: não
  // atrasa a resposta nem derruba a requisição se a gravação falhar.
  void admin.from("mcp_api_key_usage").insert({
    key_id: key.id,
    user_id: key.user_id,
    method: req.method,
    path: req.nextUrl.pathname,
    ip,
  });

  const { data: memberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", key.user_id);
  if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

  return {
    userId: key.user_id,
    organizationIds: (memberships ?? []).map((m) => m.organization_id),
    scope: (key.scope as McpKeyScope) ?? "read",
  };
}

/** Bloqueia ferramentas de escrita para chaves geradas como somente-leitura (mínimo privilégio). */
export function requireWriteScope(ctx: McpAuthContext): NextResponse | null {
  if (ctx.scope !== "write") {
    return NextResponse.json(
      { error: "Esta chave é somente leitura. Gere uma chave com escopo de escrita em /configuracoes/mcp para criar registros." },
      { status: 403 }
    );
  }
  return null;
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
