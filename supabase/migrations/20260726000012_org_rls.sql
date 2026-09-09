-- =============================================================
--  JARDS — Migração 012: RLS baseado em organization_id
--  2026-07-26
--
--  Substitui as políticas de account_id = auth.uid() por políticas
--  de organization_id IN (orgs do usuário logado).
--  Isso permite que múltiplos membros de uma organização acessem
--  os mesmos registros conforme seu papel.
-- =============================================================

-- Função auxiliar para retornar os organization_ids do usuário atual.
-- security definer para que a query interna não seja bloqueada pela RLS
-- de organization_members durante a avaliação da política.
create or replace function auth_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id
  from organization_members
  where user_id = auth.uid()
$$;


-- ─────────────────────────────────────────────
-- captacoes
-- ─────────────────────────────────────────────
drop policy if exists "captacoes: select próprio"  on captacoes;
drop policy if exists "captacoes: insert próprio"  on captacoes;
drop policy if exists "captacoes: update próprio"  on captacoes;
drop policy if exists "captacoes: delete próprio"  on captacoes;

create policy "captacoes: select org"  on captacoes for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "captacoes: insert org"  on captacoes for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "captacoes: update org"  on captacoes for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "captacoes: delete org"  on captacoes for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- projetos_crm
-- ─────────────────────────────────────────────
drop policy if exists "projetos_crm: select próprio"  on projetos_crm;
drop policy if exists "projetos_crm: insert próprio"  on projetos_crm;
drop policy if exists "projetos_crm: update próprio"  on projetos_crm;
drop policy if exists "projetos_crm: delete próprio"  on projetos_crm;

create policy "projetos_crm: select org"  on projetos_crm for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "projetos_crm: insert org"  on projetos_crm for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "projetos_crm: update org"  on projetos_crm for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "projetos_crm: delete org"  on projetos_crm for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- empresas_crm
-- ─────────────────────────────────────────────
drop policy if exists "empresas_crm: select próprio"  on empresas_crm;
drop policy if exists "empresas_crm: insert próprio"  on empresas_crm;
drop policy if exists "empresas_crm: update próprio"  on empresas_crm;
drop policy if exists "empresas_crm: delete próprio"  on empresas_crm;

create policy "empresas_crm: select org"  on empresas_crm for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "empresas_crm: insert org"  on empresas_crm for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "empresas_crm: update org"  on empresas_crm for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "empresas_crm: delete org"  on empresas_crm for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- editais_user
-- ─────────────────────────────────────────────
drop policy if exists "editais_user: select próprio"  on editais_user;
drop policy if exists "editais_user: insert próprio"  on editais_user;
drop policy if exists "editais_user: update próprio"  on editais_user;
drop policy if exists "editais_user: delete próprio"  on editais_user;

create policy "editais_user: select org"  on editais_user for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "editais_user: insert org"  on editais_user for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "editais_user: update org"  on editais_user for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "editais_user: delete org"  on editais_user for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- contatos
-- ─────────────────────────────────────────────
drop policy if exists "contatos: select próprio"  on contatos;
drop policy if exists "contatos: insert próprio"  on contatos;
drop policy if exists "contatos: update próprio"  on contatos;
drop policy if exists "contatos: delete próprio"  on contatos;

create policy "contatos: select org"  on contatos for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "contatos: insert org"  on contatos for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "contatos: update org"  on contatos for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "contatos: delete org"  on contatos for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- atividades
-- ─────────────────────────────────────────────
drop policy if exists "atividades: select próprio"  on atividades;
drop policy if exists "atividades: insert próprio"  on atividades;
drop policy if exists "atividades: update próprio"  on atividades;
drop policy if exists "atividades: delete próprio"  on atividades;

create policy "atividades: select org"  on atividades for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "atividades: insert org"  on atividades for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "atividades: update org"  on atividades for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "atividades: delete org"  on atividades for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- notas
-- ─────────────────────────────────────────────
drop policy if exists "notas: select próprio"  on notas;
drop policy if exists "notas: insert próprio"  on notas;
drop policy if exists "notas: update próprio"  on notas;
drop policy if exists "notas: delete próprio"  on notas;

create policy "notas: select org"  on notas for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "notas: insert org"  on notas for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "notas: update org"  on notas for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "notas: delete org"  on notas for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- copy_templates
-- ─────────────────────────────────────────────
drop policy if exists "copy_templates: select próprio"  on copy_templates;
drop policy if exists "copy_templates: insert próprio"  on copy_templates;
drop policy if exists "copy_templates: update próprio"  on copy_templates;
drop policy if exists "copy_templates: delete próprio"  on copy_templates;

create policy "copy_templates: select org"  on copy_templates for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "copy_templates: insert org"  on copy_templates for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "copy_templates: update org"  on copy_templates for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "copy_templates: delete org"  on copy_templates for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- sequencias_template
-- ─────────────────────────────────────────────
drop policy if exists "sequencias_template: select próprio"  on sequencias_template;
drop policy if exists "sequencias_template: insert próprio"  on sequencias_template;
drop policy if exists "sequencias_template: update próprio"  on sequencias_template;
drop policy if exists "sequencias_template: delete próprio"  on sequencias_template;

create policy "sequencias_template: select org"  on sequencias_template for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_template: insert org"  on sequencias_template for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_template: update org"  on sequencias_template for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_template: delete org"  on sequencias_template for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- sequencias_passo
-- ─────────────────────────────────────────────
drop policy if exists "sequencias_passo: select próprio"  on sequencias_passo;
drop policy if exists "sequencias_passo: insert próprio"  on sequencias_passo;
drop policy if exists "sequencias_passo: update próprio"  on sequencias_passo;
drop policy if exists "sequencias_passo: delete próprio"  on sequencias_passo;

create policy "sequencias_passo: select org"  on sequencias_passo for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_passo: insert org"  on sequencias_passo for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_passo: update org"  on sequencias_passo for update  to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "sequencias_passo: delete org"  on sequencias_passo for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- desbloqueios
-- ─────────────────────────────────────────────
drop policy if exists "desbloqueios: select próprio"  on desbloqueios;
drop policy if exists "desbloqueios: insert próprio"  on desbloqueios;
drop policy if exists "desbloqueios: delete próprio"  on desbloqueios;

create policy "desbloqueios: select org"  on desbloqueios for select  to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "desbloqueios: insert org"  on desbloqueios for insert  to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "desbloqueios: delete org"  on desbloqueios for delete  to authenticated using (organization_id = any(array(select auth_org_ids())));


-- ─────────────────────────────────────────────
-- editais_inscritos (tabela original, mantida por compat)
-- ─────────────────────────────────────────────
-- Mantém as políticas existentes de account_id (não migra pois não está em uso ativo)
