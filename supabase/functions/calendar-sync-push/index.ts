import { createClient } from "@supabase/supabase-js";

type Provider = "google" | "microsoft";
type Activity = {
  id: string; account_id: string | null; responsavel_id: string | null;
  nome: string; nota: string | null; tipo: string | null;
  data_inicio: string | null; data_prevista: string | null; feita: boolean;
  google_event_id: string | null; microsoft_event_id: string | null;
  calendar_sync_requested: boolean; skip_calendar_push: boolean;
};
type Connection = {
  user_id: string; provider: Provider; calendar_id: string;
  access_token_enc: string; refresh_token_enc: string;
  token_expires_at: string; sync_enabled: boolean;
};
type WebhookPayload = { type: "INSERT" | "UPDATE" | "DELETE"; record: Activity | null; old_record: Activity | null };

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const WEBHOOK_SECRET = Deno.env.get("CALENDAR_SYNC_WEBHOOK_SECRET");
const TOKEN_SECRET = Deno.env.get("CALENDAR_TOKEN_SECRET");
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");
const MICROSOFT_TENANT_ID = Deno.env.get("MICROSOFT_TENANT_ID") || "common";
const TIME_ZONE = Deno.env.get("CALENDAR_TIME_ZONE") || "America/Sao_Paulo";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenKey(usage: KeyUsage[]): Promise<CryptoKey> {
  if (!TOKEN_SECRET) throw new Error("CALENDAR_TOKEN_SECRET não configurado");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(TOKEN_SECRET));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, usage);
}

async function decryptSecret(payload: string): Promise<string> {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Token criptografado inválido");
  const encryptedBytes = base64UrlToBytes(encrypted);
  const data = new Uint8Array(encryptedBytes.length + 16);
  data.set(encryptedBytes);
  data.set(base64UrlToBytes(tag), encryptedBytes.length);
  const result = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(iv), tagLength: 128 }, await tokenKey(["decrypt"]), data);
  return new TextDecoder().decode(result);
}

/** Mantém compatibilidade com lib/calendar/crypto.ts no runtime Next.js. */
async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 }, await tokenKey(["encrypt"]), new TextEncoder().encode(plain),
  ));
  const ciphertext = encrypted.slice(0, -16);
  const tag = encrypted.slice(-16);
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(tag)}.${bytesToBase64Url(ciphertext)}`;
}

function nextDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function description(activity: Activity): string {
  return `Atividade criada no Jards.${activity.nota ? `\n\n${activity.nota}` : ""}\n\nID Jards: ${activity.id}`;
}

function eventPayload(activity: Activity, provider: Provider) {
  const start = activity.data_inicio?.slice(0, 10) || activity.data_prevista?.slice(0, 10);
  const end = activity.data_prevista?.slice(0, 10) || start;
  if (!start || !end) return null;
  const endExclusive = nextDate(end);
  if (provider === "google") {
    const colorId = ({ reuniao: "5", evento: "7", email: "9", telefone: "10", linkedin: "1", outro: "8" } as Record<string, string>)[activity.tipo ?? ""];
    return {
      summary: activity.nome, description: description(activity),
      start: { date: start }, end: { date: endExclusive },
      transparency: activity.feita ? "transparent" : "opaque", colorId,
      extendedProperties: { private: { jards_atividade_id: activity.id, jards_source: "jards" } },
    };
  }
  return {
    subject: activity.nome, body: { contentType: "text", content: description(activity) }, isAllDay: true,
    start: { dateTime: `${start}T00:00:00`, timeZone: TIME_ZONE },
    end: { dateTime: `${endExclusive}T00:00:00`, timeZone: TIME_ZONE },
    showAs: activity.feita ? "free" : "busy", categories: ["Jards", activity.tipo || "outro"],
    singleValueExtendedProperties: [{ id: "String {0eecadf5-7b24-4ec8-9f92-1a6b2ba1e6d3} Name jards_atividade_id", value: activity.id }],
  };
}

async function accessToken(connection: Connection): Promise<string> {
  if (new Date(connection.token_expires_at).getTime() - 120_000 > Date.now()) return decryptSecret(connection.access_token_enc);
  const refreshToken = await decryptSecret(connection.refresh_token_enc);
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken });
  let endpoint: string;
  if (connection.provider === "google") {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("Credenciais Google não configuradas");
    endpoint = "https://oauth2.googleapis.com/token";
    form.set("client_id", GOOGLE_CLIENT_ID); form.set("client_secret", GOOGLE_CLIENT_SECRET);
  } else {
    if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) throw new Error("Credenciais Microsoft não configuradas");
    endpoint = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
    form.set("client_id", MICROSOFT_CLIENT_ID); form.set("client_secret", MICROSOFT_CLIENT_SECRET);
    form.set("scope", "offline_access User.Read Calendars.ReadWrite");
  }
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error_description || "Falha ao renovar token do calendário");
  const { error } = await supabase.from("calendar_connections").update({
    access_token_enc: await encryptSecret(body.access_token),
    refresh_token_enc: body.refresh_token ? await encryptSecret(body.refresh_token) : connection.refresh_token_enc,
    token_expires_at: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
    last_error: null,
  }).eq("user_id", connection.user_id).eq("provider", connection.provider);
  if (error) throw new Error(error.message);
  return body.access_token;
}

async function syncEvent(connection: Connection, activity: Activity, action: "upsert" | "delete") {
  const token = await accessToken(connection);
  const eventId = connection.provider === "google" ? activity.google_event_id : activity.microsoft_event_id;
  const base = connection.provider === "google"
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`
    : connection.calendar_id === "primary"
      ? "https://graph.microsoft.com/v1.0/me/events"
      : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(connection.calendar_id)}/events`;
  if (action === "delete") {
    if (!eventId) return null;
    const result = await fetch(`${base}/${encodeURIComponent(eventId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!result.ok && result.status !== 404) throw new Error(`Falha ao apagar evento ${connection.provider} (${result.status})`);
    return null;
  }
  const body = eventPayload(activity, connection.provider);
  if (!body) return null;
  const result = await fetch(eventId ? `${base}/${encodeURIComponent(eventId)}` : base, {
    method: eventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const parsed = await result.json().catch(() => ({})) as { id?: string; etag?: string; changeKey?: string; error?: { message?: string } };
  if (!result.ok || !parsed.id) throw new Error(parsed.error?.message || `Falha ao sincronizar ${connection.provider} (${result.status})`);
  return { id: parsed.id, etag: parsed.etag || parsed.changeKey || null };
}

async function patchActivity(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("atividades").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!WEBHOOK_SECRET || request.headers.get("x-calendar-sync-secret") !== WEBHOOK_SECRET) return json(401, { error: "Unauthorized" });
  try {
    const payload = await request.json() as WebhookPayload;
    const activity = payload.type === "DELETE" ? payload.old_record : payload.record;
    if (!activity?.id) return json(400, { error: "Payload sem atividade" });
    if (payload.type !== "DELETE" && activity.skip_calendar_push) {
      await patchActivity(activity.id, { skip_calendar_push: false });
      return json(200, { skipped: "originado por calendário" });
    }
    const ownerId = activity.responsavel_id || activity.account_id;
    if (!ownerId) {
      if (payload.type !== "DELETE") await patchActivity(activity.id, { calendar_sync_status: "skipped", calendar_sync_error: "Atividade sem responsável ou criador" });
      return json(200, { skipped: "sem responsável" });
    }
    const { data, error } = await supabase.from("calendar_connections")
      .select("user_id, provider, calendar_id, access_token_enc, refresh_token_enc, token_expires_at, sync_enabled")
      .eq("user_id", ownerId).eq("sync_enabled", true);
    if (error) throw new Error(error.message);
    const connections = (data ?? []) as Connection[];
    const wantsSync = activity.calendar_sync_requested && Boolean(activity.data_inicio || activity.data_prevista);
    if (!wantsSync && payload.type !== "DELETE") {
      await Promise.all(connections.map(connection => syncEvent(connection, activity, "delete")));
      await patchActivity(activity.id, { google_event_id: null, microsoft_event_id: null, calendar_sync_status: "skipped", calendar_sync_error: null });
      return json(200, { skipped: "sincronização não solicitada ou sem data" });
    }
    if (!connections.length) {
      if (payload.type !== "DELETE") await patchActivity(activity.id, { calendar_sync_status: "skipped", calendar_sync_error: "Nenhum calendário conectado para o responsável" });
      return json(200, { skipped: "sem conexão" });
    }
    if (payload.type === "DELETE") {
      await Promise.all(connections.map(connection => syncEvent(connection, activity, "delete")));
      return json(200, { deleted: true });
    }
    const outcomes = await Promise.allSettled(connections.map(async connection => ({ connection, event: await syncEvent(connection, activity, "upsert") })));
    const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    const patch: Record<string, unknown> = { calendar_synced_at: new Date().toISOString(), sync_origin: "jards" };
    for (const outcome of outcomes) {
      if (outcome.status !== "fulfilled" || !outcome.value.event) continue;
      patch[outcome.value.connection.provider === "google" ? "google_event_id" : "microsoft_event_id"] = outcome.value.event.id;
      patch.external_etag = outcome.value.event.etag;
    }
    patch.calendar_sync_status = failures.length === outcomes.length ? "error" : "synced";
    patch.calendar_sync_error = failures.length ? failures.map(failure => String(failure.reason?.message || failure.reason)).join(" | ").slice(0, 1000) : null;
    await patchActivity(activity.id, patch);
    return json(200, { synced: outcomes.length - failures.length, failed: failures.length });
  } catch (error) {
    console.error(error);
    return json(500, { error: error instanceof Error ? error.message : "Erro desconhecido" });
  }
});
