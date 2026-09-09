import {
  GOOGLE_SCOPES,
  googleConfigured,
  googleRedirectUri,
} from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import { generateNonce, generatePkce, saveOAuthSession } from "./oauth";

export type CalendarListItem = {
  id: string;
  name: string;
  primary: boolean;
  canWrite: boolean;
};

export function googleAuthUrl(challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function startGoogleOAuth(userId: string, organizationId: string | null): Promise<string> {
  if (!googleConfigured()) throw new Error("Google Calendar não configurado");
  const { verifier, challenge } = generatePkce();
  const nonce = generateNonce();
  await saveOAuthSession({ nonce, verifier, provider: "google", userId, organizationId });
  return googleAuthUrl(challenge, nonce);
}

export async function exchangeGoogleCode(code: string, verifier: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | null;
  scopes: string[];
}> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
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
    throw new Error(json.error_description || json.error || "Falha ao trocar código Google");
  }
  if (!json.refresh_token) {
    throw new Error("Google não devolveu refresh token. Revogue o acesso do app em myaccount.google.com/permissions e conecte de novo.");
  }

  let email: string | null = null;
  const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (me.ok) {
    const profile = await me.json() as { email?: string };
    email = profile.email ?? null;
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    email,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json() as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao renovar token Google");
  }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    refreshToken: json.refresh_token,
  };
}

export async function listGoogleCalendars(accessToken: string): Promise<CalendarListItem[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json() as {
    items?: Array<{
      id?: string;
      summary?: string;
      primary?: boolean;
      accessRole?: string;
    }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(json.error?.message || "Falha ao listar calendários Google");
  return (json.items ?? [])
    .filter((c): c is { id: string; summary?: string; primary?: boolean; accessRole?: string } => Boolean(c.id))
    .map((c) => ({
      id: c.id,
      name: c.summary || c.id,
      primary: Boolean(c.primary),
      canWrite: c.accessRole === "owner" || c.accessRole === "writer",
    }));
}

export function encryptGoogleTokens(accessToken: string, refreshToken: string) {
  return {
    access_token_enc: encryptSecret(accessToken),
    refresh_token_enc: encryptSecret(refreshToken),
  };
}

export function decryptGoogleRefresh(enc: string): string {
  return decryptSecret(enc);
}

export function decryptGoogleAccess(enc: string): string {
  return decryptSecret(enc);
}
