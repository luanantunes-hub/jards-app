import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { encryptSecret, decryptSecret } from "@/lib/calendar/crypto";

const COOKIE = "jards_email_oauth";
const MAX_AGE = 10 * 60;

export type EmailOAuthSession = {
  nonce: string;
  verifier: string;
  userId: string;
  organizationId: string | null;
};

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateNonce(): string {
  return randomBytes(16).toString("base64url");
}

export async function saveEmailOAuthSession(session: EmailOAuthSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, encryptSecret(JSON.stringify(session)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function readEmailOAuthSession(): Promise<EmailOAuthSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decryptSecret(raw)) as EmailOAuthSession;
  } catch {
    return null;
  }
}

export async function clearEmailOAuthSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export function emailSettingsRedirect(params: Record<string, string>): URL {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const url = new URL("/configuracoes", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}
