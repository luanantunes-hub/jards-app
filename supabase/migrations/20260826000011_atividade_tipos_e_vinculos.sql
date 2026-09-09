-- Tipos personalizados e novos vínculos para atividades.

create table if not exists atividade_tipos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 60),
  nome_key text generated always as (lower(trim(nome))) stored,
  icone text not null default 'outro' check (icone in ('email', 'telefone', 'linkedin', 'reuniao', 'evento', 'outro')),
  cor text not null default '#6B7280' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, nome_key)
);

drop trigger if exists trg_atividade_tipos_updated_at on atividade_tipos;
create trigger trg_atividade_tipos_updated_at
  before update on atividade_tipos
  for each row execute function update_updated_at();

alter table atividade_tipos enable row level security;

drop policy if exists "atividade_tipos: select org" on atividade_tipos;
drop policy if exists "atividade_tipos: insert org" on atividade_tipos;
drop policy if exists "atividade_tipos: update org" on atividade_tipos;
drop policy if exists "atividade_tipos: delete org" on atividade_tipos;
create policy "atividade_tipos: select org" on atividade_tipos
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "atividade_tipos: insert org" on atividade_tipos
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "atividade_tipos: update org" on atividade_tipos
  for update to authenticated using (organization_id = any(array(select auth_org_ids())))
  with check (organization_id = any(array(select auth_org_ids())));
create policy "atividade_tipos: delete org" on atividade_tipos
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

grant select, insert, update, delete on atividade_tipos to authenticated;

alter table atividades
  add column if not exists tipo_custom_id uuid references atividade_tipos(id) on delete set null,
  add column if not exists captador_id uuid references captadores(id) on delete set null,
  add column if not exists proponente_id uuid references proponentes(id) on delete set null;

create index if not exists idx_atividades_tipo_custom on atividades(tipo_custom_id);
create index if not exists idx_atividades_captador on atividades(captador_id);
create index if not exists idx_atividades_proponente on atividades(proponente_id);
