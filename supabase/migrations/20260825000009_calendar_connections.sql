-- Integração de calendários (Google / Microsoft)
-- Tokens ficam criptografados no servidor; o cliente autenticado não lê colunas de token.

-- ─────────────────────────────────────────────
--  1. calendar_connections
-- ─────────────────────────────────────────────
create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  provider text not null check (provider in ('google', 'microsoft')),
  provider_account_email text,
  calendar_id text not null default 'primary',
  calendar_name text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz not null,
  scopes text[],
  watch_channel_id text,
  watch_resource_id text,
  watch_expiration timestamptz,
  graph_subscription_id text,
  graph_subscription_expires_at timestamptz,
  sync_enabled boolean not null default true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, provider)
);

create index if not exists idx_calendar_connections_user on calendar_connections(user_id);
create index if not exists idx_calendar_connections_org on calendar_connections(organization_id);

create trigger trg_calendar_connections_updated_at
  before update on calendar_connections
  for each row execute function update_updated_at();

alter table calendar_connections enable row level security;

revoke all on calendar_connections from public, anon, authenticated;

-- ─────────────────────────────────────────────
--  2. colunas de sync em atividades (usadas na fase 2+)
-- ─────────────────────────────────────────────
alter table atividades
  add column if not exists google_event_id text,
  add column if not exists microsoft_event_id text,
  add column if not exists calendar_sync_status text,
  add column if not exists calendar_sync_error text,
  add column if not exists calendar_synced_at timestamptz,
  add column if not exists sync_origin text,
  add column if not exists external_etag text,
  add column if not exists skip_calendar_push boolean not null default false;

alter table atividades drop constraint if exists atividades_calendar_sync_status_check;
alter table atividades add constraint atividades_calendar_sync_status_check
  check (calendar_sync_status is null or calendar_sync_status in ('pending','synced','error','conflict','skipped'));

alter table atividades drop constraint if exists atividades_sync_origin_check;
alter table atividades add constraint atividades_sync_origin_check
  check (sync_origin is null or sync_origin in ('jards','google','microsoft'));

create index if not exists idx_atividades_google_event on atividades(google_event_id);
create index if not exists idx_atividades_microsoft_event on atividades(microsoft_event_id);
