import {
  GMAIL_SCOPES,
  googleEmailClientId,
  googleEmailClientSecret,
  googleEmailConfigured,
  googleEmailRedirectUri,
} from "./config";
import { generateNonce, generatePkce, saveEmailOAuthSession } from "./oauth";

export function googleEmailAuthUrl(challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: googleEmailClientId(),
    redirect_uri: googleEmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function startGoogleEmailOAuth(
  userId: string,
  organizationId: string | null,
): Promise<string> {
  if (!googleEmailConfigured()) throw new Error("Google Email não configurado");
  const { verifier, challenge } = generatePkce();
  const nonce = generateNonce();
  await saveEmailOAuthSession({ nonce, verifier, userId, organizationId });
  return googleEmailAuthUrl(challenge, nonce);
}

export async function exchangeGoogleEmailCode(
  code: string,
  verifier: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | null;
  scopes: string[];
}> {
  const body = new URLSearchParams({
    code,
    client_id: googleEmailClientId(),
    client_secret: googleEmailClientSecret(),
    redirect_uri: googleEmailRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Falha ao trocar código Google",
    );
  }
  if (!json.refresh_token) {
    throw new Error(
      "Google não devolveu refresh token. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
    );
  }

  let email: string | null = null;
  const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (me.ok) {
    const profile = (await me.json()) as { email?: string };
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

export async function refreshGoogleEmailToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}> {
  const body = new URLSearchParams({
    client_id: googleEmailClientId(),
    client_secret: googleEmailClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Falha ao renovar token Gmail",
    );
  }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    refreshToken: json.refresh_token,
  };
}

export type GmailMessage = {
  id: string;
  threadId: string;
  internetMessageId: string | null;
  from: string | null;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  sentAt: Date | null;
  direction: "inbound" | "outbound";
};

function parseEmailAddress(raw: string | null): {
  name: string | null;
  email: string | null;
} {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim() };
  return { name: null, email: raw.trim() };
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string,
): string | null {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    null
  );
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBodyText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };
  if (p.mimeType === "text/plain" && p.body?.data) {
    return decodeBase64Url(p.body.data);
  }
  if (p.parts) {
    for (const part of p.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  return null;
}

export async function fetchGmailMessages(
  accessToken: string,
  userEmail: string,
  maxResults = 50,
  after?: Date | null,
): Promise<GmailMessage[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (after) params.set("q", `after:${Math.floor(after.getTime() / 1000)}`);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const listJson = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    error?: { message?: string };
  };
  if (!listRes.ok)
    throw new Error(
      listJson.error?.message || "Falha ao listar mensagens Gmail",
    );

  const ids = (listJson.messages ?? []).map((m) => m.id);
  const messages: GmailMessage[] = [];

  await Promise.all(
    ids.map(async (id) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!msgRes.ok) return;
      const msg = (await msgRes.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
          mimeType?: string;
          body?: { data?: string };
          parts?: unknown[];
        };
      };

      const headers = msg.payload?.headers ?? [];
      const fromRaw = getHeader(headers, "From");
      const toRaw = getHeader(headers, "To") ?? "";
      const ccRaw = getHeader(headers, "Cc") ?? "";
      const dateRaw = getHeader(headers, "Date");
      const subject = getHeader(headers, "Subject");
      const internetMessageId = getHeader(headers, "Message-ID");

      const { name: fromName, email: fromEmail } =
        parseEmailAddress(fromRaw);
      const toEmails = toRaw
        .split(",")
        .map((t) => {
          const { email } = parseEmailAddress(t.trim());
          return email ?? t.trim();
        })
        .filter(Boolean);
      const ccEmails = ccRaw
        .split(",")
        .map((recipient) => {
          const { email } = parseEmailAddress(recipient.trim());
          return email ?? recipient.trim();
        })
        .filter(Boolean);

      const sentAt = dateRaw ? new Date(dateRaw) : null;
      const direction: "inbound" | "outbound" =
        fromEmail?.toLowerCase() === userEmail.toLowerCase()
          ? "outbound"
          : "inbound";

      const bodyText = extractBodyText(msg.payload);

      messages.push({
        id: msg.id,
        threadId: msg.threadId,
        internetMessageId,
        from: fromEmail,
        fromName,
        to: toEmails,
        cc: ccEmails,
        subject,
        snippet: msg.snippet ?? null,
        bodyText: bodyText ? bodyText.slice(0, 2000) : null,
        sentAt,
        direction,
      });
    }),
  );

  return messages.sort(
    (a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0),
  );
}
