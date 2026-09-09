-- Migration 008: Migrar tarefas e editais_inscritos para org-based
-- Corrige gap de isolamento: essas duas tabelas legadas usavam account_id

-- ─────────────────────────────────────────────
--  1. tarefas: adicionar organization_id
-- ─────────────────────────────────────────────
alter table tarefas
  add column if not exists organization_id uuid references organizations(id);

create index if not exists idx_tarefas_org on tarefas(organization_id);

-- Backfill: pegar organization_id da captação vinculada
update tarefas t
set organization_id = c.organization_id
from captacoes c
where t.captacao_id = c.id
  and t.organization_id IS NULL;

-- Para tarefas sem captação, tentar via account_id → membership
-- (usuários que têm só uma org, o mais comum)
update tarefas t
set organization_id = (
  select om.organization_id
  from organization_members om
  where om.user_id = t.account_id
  limit 1
)
where t.organization_id IS NULL;

-- ─────────────────────────────────────────────
--  2. editais_inscritos: adicionar organization_id
-- ─────────────────────────────────────────────
alter table editais_inscritos
  add column if not exists organization_id uuid references organizations(id);

create index if not exists idx_editais_inscritos_org on editais_inscritos(organization_id);

-- Backfill: pegar organization_id da captação vinculada
update editais_inscritos ei
set organization_id = c.organization_id
from captacoes c
where ei.captacao_id = c.id
  and ei.organization_id IS NULL;

-- Para inscrições sem captação, tentar via account_id → membership
update editais_inscritos ei
set organization_id = (
  select om.organization_id
  from organization_members om
  where om.user_id = ei.account_id
  limit 1
)
where ei.organization_id IS NULL;

-- ─────────────────────────────────────────────
--  3. Migrar RLS de tarefas: account → org
-- ─────────────────────────────────────────────
drop policy if exists "tarefas: select próprio" on tarefas;
drop policy if exists "tarefas: insert próprio" on tarefas;
drop policy if exists "tarefas: update próprio" on tarefas;
drop policy if exists "tarefas: delete próprio" on tarefas;

create policy "tarefas: select org" on tarefas
  for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "tarefas: insert org" on tarefas
  for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "tarefas: update org" on tarefas
  for update to authenticated
  using (organization_id = any(array(select auth_org_ids())))
  with check (organization_id = any(array(select auth_org_ids())));
create policy "tarefas: delete org" on tarefas
  for delete to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- ─────────────────────────────────────────────
--  4. Migrar RLS de editais_inscritos: account → org
-- ─────────────────────────────────────────────
drop policy if exists "editais_inscritos: select próprio" on editais_inscritos;
drop policy if exists "editais_inscritos: insert próprio" on editais_inscritos;
drop policy if exists "editais_inscritos: update próprio" on editais_inscritos;
drop policy if exists "editais_inscritos: delete próprio" on editais_inscritos;

create policy "editais_inscritos: select org" on editais_inscritos
  for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "editais_inscritos: insert org" on editais_inscritos
  for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "editais_inscritos: update org" on editais_inscritos
  for update to authenticated
  using (organization_id = any(array(select auth_org_ids())))
  with check (organization_id = any(array(select auth_org_ids())));
create policy "editais_inscritos: delete org" on editais_inscritos
  for delete to authenticated
  using (organization_id = any(array(select auth_org_ids())));
