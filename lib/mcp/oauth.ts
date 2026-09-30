import crypto from "crypto";
import { hashApiKey } from "@/lib/mcp/auth";

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
