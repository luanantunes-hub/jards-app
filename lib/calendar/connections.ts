import { createAdminClient } from "@/lib/supabase/admin";
import type { CalendarProvider } from "./config";
import { decryptSecret, encryptSecret } from "./crypto";
import {
  decryptGoogleAccess,
  listGoogleCalendars,
  refreshGoogleToken,
  type CalendarListItem,
} from "./google";
import {
  decryptMicrosoftAccess,
  listMicrosoftCalendars,
  refreshMicrosoftToken,
} from "./microsoft";

export type ConnectionRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: CalendarProvider;
  provider_account_email: string | null;
  calendar_id: string;
  calendar_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: string;
  scopes: string[] | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ConnectionPublic = Omit<ConnectionRow, "access_token_enc" | "refresh_token_enc" | "scopes">;

function toPublic(row: ConnectionRow): ConnectionPublic {
  const { access_token_enc: _a, refresh_token_enc: _r, scopes: _s, ...rest } = row;
  return rest;
}

export async function listPublicConnections(userId: string): Promise<ConnectionPublic[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("id, user_id, organization_id, provider, provider_account_email, calendar_id, calendar_name, access_token_enc, refresh_token_enc, token_expires_at, scopes, sync_enabled, last_sync_at, last_error, created_at, updated_at")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ConnectionRow[]).map(toPublic);
}

export async function getConnection(userId: string, provider: CalendarProvider): Promise<ConnectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnectionRow | null) ?? null;
}

export async function upsertConnection(input: {
  userId: string;
  organizationId: string | null;
  provider: CalendarProvider;
  email: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  calendarId: string;
  calendarName: string | null;
}): Promise<void> {
  const supabase = createAdminClient();
  const payload = {
    user_id: input.userId,
    organization_id: input.organizationId,
    provider: input.provider,
    provider_account_email: input.email,
    calendar_id: input.calendarId,
    calendar_name: input.calendarName,
    access_token_enc: encryptSecret(input.accessToken),
    refresh_token_enc: encryptSecret(input.refreshToken),
    token_expires_at: input.expiresAt.toISOString(),
    scopes: input.scopes,
    sync_enabled: true,
    last_error: null,
  };
  const { error } = await supabase
    .from("calendar_connections")
    .upsert(payload, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}

export async function updateConnection(
  userId: string,
  provider: CalendarProvider,
  patch: Partial<{
    calendar_id: string;
    calendar_name: string | null;
    sync_enabled: boolean;
    last_error: string | null;
    access_token_enc: string;
    refresh_token_enc: string;
    token_expires_at: string;
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(clean).length === 0) return;

  const { error } = await supabase
    .from("calendar_connections")
    .update(clean)
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

export async function deleteConnection(userId: string, provider: CalendarProvider): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

const REFRESH_SKEW_MS = 2 * 60 * 1000;

export async function getValidAccessToken(userId: string, provider: CalendarProvider): Promise<string> {
  const conn = await getConnection(userId, provider);
  if (!conn) throw new Error("Conta de calendário não conectada");

  const expires = new Date(conn.token_expires_at).getTime();
  if (expires - REFRESH_SKEW_MS > Date.now()) {
    return provider === "google"
      ? decryptGoogleAccess(conn.access_token_enc)
      : decryptMicrosoftAccess(conn.access_token_enc);
  }

  const refresh = decryptSecret(conn.refresh_token_enc);
  if (provider === "google") {
    const next = await refreshGoogleToken(refresh);
    await updateConnection(userId, provider, {
      access_token_enc: encryptSecret(next.accessToken),
      refresh_token_enc: next.refreshToken ? encryptSecret(next.refreshToken) : undefined,
      token_expires_at: next.expiresAt.toISOString(),
      last_error: null,
    });
    return next.accessToken;
  }

  const next = await refreshMicrosoftToken(refresh);
  await updateConnection(userId, provider, {
    access_token_enc: encryptSecret(next.accessToken),
    refresh_token_enc: next.refreshToken ? encryptSecret(next.refreshToken) : undefined,
    token_expires_at: next.expiresAt.toISOString(),
    last_error: null,
  });
  return next.accessToken;
}

export async function listCalendarsForUser(
  userId: string,
  provider: CalendarProvider,
): Promise<CalendarListItem[]> {
  const token = await getValidAccessToken(userId, provider);
  return provider === "google"
    ? listGoogleCalendars(token)
    : listMicrosoftCalendars(token);
}
