import {
  MICROSOFT_SCOPES,
  microsoftConfigured,
  microsoftRedirectUri,
  microsoftTenant,
} from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { generateNonce, generatePkce, saveOAuthSession } from "./oauth";
import type { CalendarListItem } from "./google";

function tokenUrl(): string {
  return `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/token`;
}

export function microsoftAuthUrl(challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: microsoftRedirectUri(),
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    state: nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://login.microsoftonline.com/${microsoftTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function startMicrosoftOAuth(userId: string, organizationId: string | null): Promise<string> {
  if (!microsoftConfigured()) throw new Error("Microsoft Calendar não configurado");
  const { verifier, challenge } = generatePkce();
  const nonce = generateNonce();
  await saveOAuthSession({ nonce, verifier, provider: "microsoft", userId, organizationId });
  return microsoftAuthUrl(challenge, nonce);
}

export async function exchangeMicrosoftCode(code: string, verifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | null;
  scopes: string[];
}> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: microsoftRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
    scope: MICROSOFT_SCOPES.join(" "),
  });
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao trocar código Microsoft");
  }
  if (!json.refresh_token) {
    throw new Error("Microsoft não devolveu refresh token. Confira o escopo offline_access.");
  }

  let email: string | null = null;
  const me = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (me.ok) {
    const profile = await me.json() as { mail?: string; userPrincipalName?: string };
    email = profile.mail || profile.userPrincipalName || null;
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    email,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPES.join(" "),
  });
  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao renovar token Microsoft");
  }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    refreshToken: json.refresh_token,
  };
}

export async function listMicrosoftCalendars(accessToken: string): Promise<CalendarListItem[]> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/calendars", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json() as {
    value?: Array<{
      id?: string;
      name?: string;
      isDefaultCalendar?: boolean;
      canEdit?: boolean;
    }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || "Falha ao listar calendários Microsoft");
  return (json.value ?? [])
    .filter((c): c is { id: string; name?: string; isDefaultCalendar?: boolean; canEdit?: boolean } => Boolean(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name || c.id,
      primary: Boolean(c.isDefaultCalendar),
      canWrite: c.canEdit !== false,
    }));
}

export function encryptMicrosoftTokens(accessToken: string, refreshToken: string) {
  return {
    access_token_enc: encryptSecret(accessToken),
    refresh_token_enc: encryptSecret(refreshToken),
  };
}

export function decryptMicrosoftRefresh(enc: string): string {
  return decryptSecret(enc);
}

export function decryptMicrosoftAccess(enc: string): string {
  return decryptSecret(enc);
}
