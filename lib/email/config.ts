export type EmailProvider = "google";

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function googleEmailRedirectUri(): string {
  return `${appUrl()}/api/email/google/callback`;
}

export function googleEmailClientId(): string {
  return process.env.GOOGLE_EMAIL_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID || "";
}

export function googleEmailClientSecret(): string {
  return process.env.GOOGLE_EMAIL_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "";
}

export function tokenSecret(): string | undefined {
  return process.env.CALENDAR_TOKEN_SECRET || process.env.CALENDAR_OAUTH_STATE_SECRET;
}

export function googleEmailConfigured(): boolean {
  return Boolean(googleEmailClientId() && googleEmailClientSecret() && tokenSecret());
}

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];
