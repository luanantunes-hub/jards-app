import crypto from "crypto";
import { hashApiKey } from "@/lib/mcp/auth";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export const OAUTH_CODE_TTL_MS = 10 * 60_000; // 10 min
export const OAUTH_ACCESS_TOKEN_TTL_MS = 60 * 60_000; // 1h
export const OAUTH_REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60_000; // 90 dias

/**
 * Callback só pode ir para o domínio oficial do ChatGPT — trava o redirect_uri
 * contra ser usado para vazar o código de autorização para outro lugar.
 */
const ALLOWED_REDIRECT_URI = /^https:\/\/(chat\.openai\.com|chatgpt\.com)\/aip\/[A-Za-z0-9_-]+\/oauth\/callback$/;

export function isAllowedRedirectUri(uri: string): boolean {
  return ALLOWED_REDIRECT_URI.test(uri);
}

export function validClientCredentials(clientId: string, clientSecret: string): boolean {
  const expectedId = process.env.OAUTH_CHATGPT_CLIENT_ID;
  const expectedSecret = process.env.OAUTH_CHATGPT_CLIENT_SECRET;
  if (!expectedId || !expectedSecret) return false;
  return (
    timingSafeEqualStr(clientId, expectedId) && timingSafeEqualStr(clientSecret, expectedSecret)
  );
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateOpaqueToken(prefix: string): { raw: string; hash: string } {
  const raw = `${prefix}${crypto.randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashApiKey(raw) };
}

/** PKCE (RFC 7636) — opcional (o GPT builder não expõe code_verifier na UI), mas validado quando presente. */
export function verifyPkce(codeVerifier: string, codeChallenge: string, method: string | null): boolean {
  if (method === "plain" || !method) return codeVerifier === codeChallenge;
  if (method === "S256") {
    const computed = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
    return computed === codeChallenge;
  }
  return false;
}

export type OAuthScope = "read" | "write";

export function normalizeScope(raw: string | null | undefined): OAuthScope {
  return raw === "write" ? "write" : "read";
}

/* ─── Clientes públicos registrados dinamicamente (RFC 7591) — Claude e outros assistentes MCP ─── */

/** PKCE S256 obrigatório para clientes públicos: sem segredo, é o que protege o código de autorização. */
export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || !codeChallenge) return false;
  return timingSafeEqualStr(crypto.createHash("sha256").update(codeVerifier).digest("base64url"), codeChallenge);
}

export function isLoopbackRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

// Callback oficial do Claude (claude.ai e o domínio novo claude.com).
const CLAUDE_REDIRECT_URI = /^https:\/\/(claude\.ai|claude\.com)\/api\/mcp\/auth_callback$/;

/** O que um cliente pode registrar: callback do Claude ou loopback (Claude Code e ferramentas locais). */
export function isRegistrableRedirectUri(uri: string): boolean {
  if (typeof uri !== "string" || uri.length > 300) return false;
  if (CLAUDE_REDIRECT_URI.test(uri)) return true;
  return isLoopbackRedirectUri(uri) && !new URL(uri).hash;
}

/** Igual ao registrado; para loopback a porta é livre (RFC 8252 §7.3), o resto precisa bater. */
export function redirectUriMatchesRegistered(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  if (!isLoopbackRedirectUri(requested)) return false;
  const pedido = new URL(requested);
  return registered.some((uri) => {
    if (!isLoopbackRedirectUri(uri)) return false;
    const base = new URL(uri);
    return base.hostname === pedido.hostname && base.pathname === pedido.pathname;
  });
}

export type OAuthClient =
  | { kind: "chatgpt"; clientId: string }
  | { kind: "public"; clientId: string; name: string; redirectUris: string[] };

/** Cliente fixo do ChatGPT (variáveis de ambiente) ou cliente público registrado em oauth_clients. */
export async function findOAuthClient(admin: Admin, clientId: string): Promise<OAuthClient | null> {
  if (!clientId) return null;
  const chatgptId = process.env.OAUTH_CHATGPT_CLIENT_ID;
  if (chatgptId && timingSafeEqualStr(clientId, chatgptId)) return { kind: "chatgpt", clientId };
  const { data } = await admin
    .from("oauth_clients")
    .select("client_id,client_name,redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) return null;
  return { kind: "public", clientId: data.client_id, name: data.client_name, redirectUris: data.redirect_uris };
}

export interface AuthorizationRequest {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
}

/**
 * Valida um pedido de autorização (tela de consentimento e botão Permitir usam a mesma regra).
 * ChatGPT: callback oficial. Cliente público: callback registrado + PKCE S256 obrigatório.
 */
export async function validateAuthorizationRequest(
  admin: Admin,
  request: AuthorizationRequest,
  origin: string
): Promise<{ ok: true; client: OAuthClient } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  if (request.responseType !== "code") errors.push("response_type deve ser 'code'.");

  const client = await findOAuthClient(admin, request.clientId);
  if (!client) {
    errors.push("client_id desconhecido.");
    return { ok: false, errors };
  }

  if (client.kind === "chatgpt") {
    if (!request.redirectUri || !isAllowedRedirectUri(request.redirectUri)) {
      errors.push("redirect_uri não é um callback válido do ChatGPT.");
    }
  } else {
    if (!request.redirectUri || !redirectUriMatchesRegistered(client.redirectUris, request.redirectUri)) {
      errors.push("redirect_uri não corresponde ao callback registrado do aplicativo.");
    }
    if (!request.codeChallenge || request.codeChallengeMethod !== "S256") {
      errors.push("PKCE obrigatório: envie code_challenge com code_challenge_method=S256.");
    }
    if (request.resource) {
      let recursoValido = false;
      try {
        recursoValido = new URL(request.resource).origin === origin;
      } catch {
        recursoValido = false;
      }
      if (!recursoValido) errors.push("resource não pertence a este servidor.");
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, client };
}
