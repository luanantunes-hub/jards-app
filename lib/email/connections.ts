import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/calendar/crypto";
import type { EmailProvider } from "./config";
import { refreshGoogleEmailToken } from "./google";
import { refreshMicrosoftEmailToken } from "./microsoft";

export type EmailConnectionRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: EmailProvider;
  provider_account_email: string | null;
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

export type EmailConnectionPublic = Omit<
  EmailConnectionRow,
  "access_token_enc" | "refresh_token_enc" | "scopes"
>;

function toPublic(row: EmailConnectionRow): EmailConnectionPublic {
  const { access_token_enc: _a, refresh_token_enc: _r, scopes: _s, ...rest } =
    row;
  return rest;
}

/** Todas as conexões de e-mail da pessoa (Gmail e Microsoft), sem os tokens. */
export async function listEmailConnections(
  userId: string,
): Promise<EmailConnectionPublic[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_connections" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EmailConnectionRow[]).map(toPublic);
}

export async function getEmailConnection(
  userId: string,
  provider: EmailProvider,
): Promise<EmailConnectionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_connections" as any)
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EmailConnectionRow | null) ?? null;
}

export async function upsertEmailConnection(input: {
  userId: string;
  organizationId: string | null;
  provider: EmailProvider;
  email: string | null;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}): Promise<void> {
  const supabase = createAdminClient();
  const payload = {
    user_id: input.userId,
    organization_id: input.organizationId,
    provider: input.provider,
    provider_account_email: input.email,
    access_token_enc: encryptSecret(input.accessToken),
    refresh_token_enc: encryptSecret(input.refreshToken),
    token_expires_at: input.expiresAt.toISOString(),
    scopes: input.scopes,
    sync_enabled: true,
    last_error: null,
  };
  const { error } = await supabase
    .from("email_connections" as any)
    .upsert(payload, { onConflict: "user_id,provider" });
  if (error) throw new Error(error.message);
}

export async function deleteEmailConnection(
  userId: string,
  provider: EmailProvider,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_connections" as any)
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  if (error) throw new Error(error.message);
}

const REFRESH_SKEW_MS = 2 * 60 * 1000;

export async function getValidEmailAccessToken(
  userId: string,
  provider: EmailProvider,
): Promise<string> {
  const conn = await getEmailConnection(userId, provider);
  if (!conn) throw new Error("Conta de email não conectada");

  const expires = new Date(conn.token_expires_at).getTime();
  if (expires - REFRESH_SKEW_MS > Date.now()) {
    return decryptSecret(conn.access_token_enc);
  }

  const refresh = decryptSecret(conn.refresh_token_enc);
  const next =
    provider === "microsoft"
      ? await refreshMicrosoftEmailToken(refresh)
      : await refreshGoogleEmailToken(refresh);

  const supabase = createAdminClient();
  await (supabase as any)
    .from("email_connections")
    .update({
      access_token_enc: encryptSecret(next.accessToken),
      ...(next.refreshToken
        ? { refresh_token_enc: encryptSecret(next.refreshToken) }
        : {}),
      token_expires_at: next.expiresAt.toISOString(),
      last_error: null,
    })
    .eq("user_id", userId)
    .eq("provider", provider);

  return next.accessToken;
}
