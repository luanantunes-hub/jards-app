import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey } from "@/lib/mcp/auth";
import { escopoComModulos, normalizarModulosDaChave, type ModuloMcp } from "@/lib/mcp/modulos";
import {
  OAUTH_ACCESS_TOKEN_TTL_MS,
  OAUTH_REFRESH_TOKEN_TTL_MS,
  findOAuthClient,
  generateOpaqueToken,
  validClientCredentials,
  verifyPkce,
  verifyPkceS256,
} from "@/lib/mcp/oauth";

/** A resposta com tokens nunca pode ficar em cache (RFC 6749, seção 5.1). */
const SEM_CACHE = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** Aceita form-urlencoded (padrão OAuth) ou JSON, e client_secret no body OU em Basic auth. */
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    Object.assign(out, await req.json().catch(() => ({})));
  } else {
    const form = await req.formData().catch(() => null);
    if (form) for (const [k, v] of form.entries()) out[k] = String(v);
  }
  const basic = req.headers.get("authorization");
  if (basic?.startsWith("Basic ")) {
    const [id, secret] = Buffer.from(basic.slice(6), "base64").toString("utf8").split(":");
    if (id && !out.client_id) out.client_id = id;
    if (secret && !out.client_secret) out.client_secret = secret;
  }
  return out;
}

/**
 * Cria um access token (linha em mcp_api_keys) + refresh token para um usuário/escopo. Os módulos são os que a pessoa
 * autorizou: a renovação repete os mesmos, nunca ganha um novo.
 */
async function issueTokens(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  clientId: string,
  scope: "read" | "write",
  modulos: ModuloMcp[],
  label: string
) {
  const { raw: rawAccess, hash: accessHash, prefix } = generateApiKey();
  const { data: keyRow, error: keyError } = await admin
    .from("mcp_api_keys")
    .insert({
      user_id: userId,
      key_hash: accessHash,
      key_prefix: prefix,
      label,
      scope,
      modulos,
      source: "oauth",
      oauth_client_id: clientId,
      expires_at: new Date(Date.now() + OAUTH_ACCESS_TOKEN_TTL_MS).toISOString(),
    })
    .select("id")
    .single();
  if (keyError || !keyRow) throw new Error(keyError?.message ?? "Falha ao emitir access token");

  const { raw: rawRefresh, hash: refreshHash } = generateOpaqueToken("jards_oauth_refresh_");
  const { error: refreshError } = await admin.from("oauth_refresh_tokens").insert({
    token_hash: refreshHash,
    user_id: userId,
    client_id: clientId,
    scope,
    modulos,
    access_key_id: keyRow.id,
    expires_at: new Date(Date.now() + OAUTH_REFRESH_TOKEN_TTL_MS).toISOString(),
  });
  if (refreshError) throw new Error(refreshError.message);

  return {
    access_token: rawAccess,
    token_type: "bearer",
    expires_in: Math.floor(OAUTH_ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: rawRefresh,
    scope: escopoComModulos(scope, modulos),
  };
}

export async function POST(req: NextRequest) {
  const params = await readParams(req);
  const grantType = params.grant_type;
  const clientId = params.client_id ?? "";
  const clientSecret = params.client_secret ?? "";

  const admin = createAdminClient();

  // ChatGPT: cliente fixo com segredo. Assistentes MCP (Claude): cliente público registrado, sem
  // segredo, protegido por PKCE S256 (exigido abaixo).
  const client = await findOAuthClient(admin, clientId);
  if (!client || (client.kind === "chatgpt" && !validClientCredentials(clientId, clientSecret))) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }
  const label = client.kind === "chatgpt" ? "ChatGPT (OAuth)" : `${client.name} (OAuth)`;

  if (grantType === "authorization_code") {
    const code = params.code ?? "";
    const redirectUri = params.redirect_uri ?? "";
    const codeVerifier = params.code_verifier ?? "";
    if (!code) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });

    const codeHash = hashApiKey(code);
    const { data: codeRow, error } = await admin
      .from("oauth_authorization_codes")
      .select("*")
      .eq("code_hash", codeHash)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    if (
      !codeRow ||
      codeRow.used_at ||
      codeRow.client_id !== clientId ||
      codeRow.redirect_uri !== redirectUri ||
      new Date(codeRow.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }
    if (client.kind === "public") {
      if (codeRow.code_challenge_method !== "S256" || !verifyPkceS256(codeVerifier, codeRow.code_challenge ?? "")) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE inválido" }, { status: 400 });
      }
    } else if (codeRow.code_challenge) {
      if (!codeVerifier || !verifyPkce(codeVerifier, codeRow.code_challenge, codeRow.code_challenge_method)) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE inválido" }, { status: 400 });
      }
    }

    // Uso único — marca antes de emitir para que uma corrida concorrente não emita duas vezes.
    const { data: marked, error: markError } = await admin
      .from("oauth_authorization_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .is("used_at", null)
      .select("id");
    if (markError || !marked || marked.length === 0) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });

    try {
      const tokens = await issueTokens(admin, codeRow.user_id, clientId, codeRow.scope, normalizarModulosDaChave(codeRow.modulos), label);
      return NextResponse.json(tokens, { headers: SEM_CACHE });
    } catch {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  if (grantType === "refresh_token") {
    const refreshToken = params.refresh_token ?? "";
    if (!refreshToken) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });

    const refreshHash = hashApiKey(refreshToken);
    const { data: tokenRow, error } = await admin
      .from("oauth_refresh_tokens")
      .select("*")
      .eq("token_hash", refreshHash)
      .maybeSingle();
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
    if (
      !tokenRow ||
      tokenRow.revoked_at ||
      tokenRow.client_id !== clientId ||
      new Date(tokenRow.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }

    // Rotação: revoga o refresh token e o access token antigos antes de emitir os novos.
    await admin.from("oauth_refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokenRow.id);
    if (tokenRow.access_key_id) {
      await admin.from("mcp_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", tokenRow.access_key_id);
    }

    try {
      const tokens = await issueTokens(admin, tokenRow.user_id, clientId, tokenRow.scope, normalizarModulosDaChave(tokenRow.modulos), label);
      return NextResponse.json(tokens, { headers: SEM_CACHE });
    } catch {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}
