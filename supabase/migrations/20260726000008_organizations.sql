-- =============================================================
--  JARDS — Migração 008: Organizações (multi-tenancy)
--  2026-07-26
--
--  Cria as tabelas de organização e membros.
--  Cada usuário pertence a pelo menos uma organização.
--  O papel controla o nível de acesso dentro da organização.
-- =============================================================

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  papel           text not null check (papel in ('admin', 'captador', 'visualizador')),
  created_at      timestamptz not null default now(),
  unique(organization_id, user_id)
);

-- Índices para as queries de RLS (alta frequência)
create index idx_org_members_user_id on organization_members(user_id);
create index idx_org_members_org_id  on organization_members(organization_id);

-- ── RLS: organizations ──
alter table organizations enable row level security;

create policy "organizations: membros leem a própria org"
  on organizations for select
  to authenticated
  using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid()
    )
  );

create policy "organizations: admins atualizam"
  on organizations for update
  to authenticated
  using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid() and papel = 'admin'
    )
  );

-- ── RLS: organization_members ──
alter table organization_members enable row level security;

create policy "organization_members: ver membros da mesma org"
  on organization_members for select
  to authenticated
  using (
    organization_id in (
      select organization_id from organization_members m2
      where m2.user_id = auth.uid()
    )
  );

create policy "organization_members: admin gerencia membros"
  on organization_members for insert
  to authenticated
  with check (
    organization_id in (
      select organization_id from organization_members m2
      where m2.user_id = auth.uid() and m2.papel = 'admin'
    )
  );

create policy "organization_members: admin remove membros"
  on organization_members for delete
  to authenticated
  using (
    organization_id in (
      select organization_id from organization_members m2
      where m2.user_id = auth.uid() and m2.papel = 'admin'
    )
  );
