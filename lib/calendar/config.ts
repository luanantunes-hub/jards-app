export type CalendarProvider = "google" | "microsoft";

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function googleRedirectUri(): string {
  return `${appUrl()}/api/calendar/google/callback`;
}

export function microsoftRedirectUri(): string {
  return `${appUrl()}/api/calendar/microsoft/callback`;
}

export function googleConfigured(): boolean {
  return Boolean(
    calendarSyncEnabled() &&
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    tokenSecret()
  );
}

export function microsoftConfigured(): boolean {
  return Boolean(
    calendarSyncEnabled() &&
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    tokenSecret()
  );
}

export function calendarSyncEnabled(): boolean {
  return process.env.CALENDAR_SYNC_ENABLED === "true"
    && Boolean(process.env.CALENDAR_SYNC_WEBHOOK_SECRET);
}

export function tokenSecret(): string | undefined {
  return process.env.CALENDAR_TOKEN_SECRET || process.env.CALENDAR_OAUTH_STATE_SECRET;
}

export function microsoftTenant(): string {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export const MICROSOFT_SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
];
