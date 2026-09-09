-- Auditoria enxuta do backoffice.
-- Não armazenar senhas, tokens, cookies, links de autenticação ou payloads completos.

alter table public.profiles
  add column if not exists jards_super_admin boolean not null default false;

create or replace function public.is_jards_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select profile.jards_super_admin
       from public.profiles as profile
      where profile.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_jards_super_admin() from public;
grant execute on function public.is_jards_super_admin() to authenticated;

create table if not exists public.admin_audit_logs (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references auth.users(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  action          text not null,
  resource_type   text not null,
  resource_id     text,
  target_user_id  uuid references auth.users(id) on delete set null,
  summary         text not null check (char_length(summary) between 1 and 500),
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created
  on public.admin_audit_logs(created_at desc);
create index if not exists idx_admin_audit_logs_action_created
  on public.admin_audit_logs(action, created_at desc);
create index if not exists idx_admin_audit_logs_resource_created
  on public.admin_audit_logs(resource_type, created_at desc);
create index if not exists idx_admin_audit_logs_actor_created
  on public.admin_audit_logs(actor_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs: select superadmin"
  on public.admin_audit_logs for select to authenticated
  using (public.is_jards_super_admin());

-- A escrita ocorre apenas por rotas de servidor com a sessão validada.
revoke all on public.admin_audit_logs from anon, authenticated;
grant select on public.admin_audit_logs to authenticated;

comment on table public.admin_audit_logs is
  'Auditoria administrativa resumida; manter somente eventos operacionais relevantes.';
