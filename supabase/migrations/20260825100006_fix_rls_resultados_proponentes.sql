-- Migration 006: Fix RLS para org-based
-- Corrige RLS de resultados_projeto e proponentes (de account-based para org-based)

-- ── resultados_projeto ────────────────────────────────────────────────────────
-- Remover políticas antigas (account-based)
drop policy if exists "resultados_projeto: select próprio" on resultados_projeto;
drop policy if exists "resultados_projeto: insert próprio" on resultados_projeto;
drop policy if exists "resultados_projeto: update próprio" on resultados_projeto;
drop policy if exists "resultados_projeto: delete próprio" on resultados_projeto;

-- Novas políticas org-based
create policy "resultados_projeto: select org" on resultados_projeto
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "resultados_projeto: insert org" on resultados_projeto
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "resultados_projeto: update org" on resultados_projeto
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "resultados_projeto: delete org" on resultados_projeto
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

-- ── proponentes ───────────────────────────────────────────────────────────────
-- Remover políticas antigas (account-based)
drop policy if exists "proponentes: select próprio" on proponentes;
drop policy if exists "proponentes: insert próprio" on proponentes;
drop policy if exists "proponentes: update próprio" on proponentes;
drop policy if exists "proponentes: delete próprio" on proponentes;

-- Novas políticas org-based
create policy "proponentes: select org" on proponentes
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "proponentes: insert org" on proponentes
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "proponentes: update org" on proponentes
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "proponentes: delete org" on proponentes
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));
