-- Migration 006: Fix RLS proponentes para org-based
-- proponentes precisa ser org-based antes da Fase A (bloqueador para multi-user)

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
