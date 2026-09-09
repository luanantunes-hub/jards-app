-- =============================================================
--  JARDS — Migração 004: RLS para tabelas CRM
--  2026-07-21
--
--  Públicas BI (read-only autenticado):
--    tipologias, investimentos_anuais, investimentos_trimestres
--
--  Privadas CRM (CRUD isolado por account_id):
--    projetos_crm, empresas_crm, atividades, notas,
--    editais_user, desbloqueios, copy_templates,
--    sequencias_template, sequencias_passo
-- =============================================================


-- =============================================================
--  CAMADA 1 — PÚBLICOS: leitura para todos logados
-- =============================================================

alter table tipologias                enable row level security;
alter table investimentos_anuais      enable row level security;
alter table investimentos_trimestres  enable row level security;

create policy "tipologias: leitura pública autenticada"
  on tipologias for select to authenticated using (true);

create policy "investimentos_anuais: leitura pública autenticada"
  on investimentos_anuais for select to authenticated using (true);

create policy "investimentos_trimestres: leitura pública autenticada"
  on investimentos_trimestres for select to authenticated using (true);


-- =============================================================
--  CAMADA 2 — PRIVADOS: CRUD isolado por conta
--  Macro para reduzir repetição: cada tabela recebe 4 policies
-- =============================================================

-- ── projetos_crm ──
alter table projetos_crm enable row level security;

create policy "projetos_crm: select próprio"  on projetos_crm for select  to authenticated using (account_id = auth.uid());
create policy "projetos_crm: insert próprio"  on projetos_crm for insert  to authenticated with check (account_id = auth.uid());
create policy "projetos_crm: update próprio"  on projetos_crm for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "projetos_crm: delete próprio"  on projetos_crm for delete  to authenticated using (account_id = auth.uid());

-- ── empresas_crm ──
alter table empresas_crm enable row level security;

create policy "empresas_crm: select próprio"  on empresas_crm for select  to authenticated using (account_id = auth.uid());
create policy "empresas_crm: insert próprio"  on empresas_crm for insert  to authenticated with check (account_id = auth.uid());
create policy "empresas_crm: update próprio"  on empresas_crm for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "empresas_crm: delete próprio"  on empresas_crm for delete  to authenticated using (account_id = auth.uid());

-- ── atividades ──
alter table atividades enable row level security;

create policy "atividades: select próprio"  on atividades for select  to authenticated using (account_id = auth.uid());
create policy "atividades: insert próprio"  on atividades for insert  to authenticated with check (account_id = auth.uid());
create policy "atividades: update próprio"  on atividades for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "atividades: delete próprio"  on atividades for delete  to authenticated using (account_id = auth.uid());

-- ── notas ──
alter table notas enable row level security;

create policy "notas: select próprio"  on notas for select  to authenticated using (account_id = auth.uid());
create policy "notas: insert próprio"  on notas for insert  to authenticated with check (account_id = auth.uid());
create policy "notas: update próprio"  on notas for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "notas: delete próprio"  on notas for delete  to authenticated using (account_id = auth.uid());

-- ── editais_user ──
alter table editais_user enable row level security;

create policy "editais_user: select próprio"  on editais_user for select  to authenticated using (account_id = auth.uid());
create policy "editais_user: insert próprio"  on editais_user for insert  to authenticated with check (account_id = auth.uid());
create policy "editais_user: update próprio"  on editais_user for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "editais_user: delete próprio"  on editais_user for delete  to authenticated using (account_id = auth.uid());

-- ── desbloqueios ──
alter table desbloqueios enable row level security;

create policy "desbloqueios: select próprio"  on desbloqueios for select  to authenticated using (account_id = auth.uid());
create policy "desbloqueios: insert próprio"  on desbloqueios for insert  to authenticated with check (account_id = auth.uid());
create policy "desbloqueios: delete próprio"  on desbloqueios for delete  to authenticated using (account_id = auth.uid());
-- update não faz sentido para desbloqueios

-- ── copy_templates ──
alter table copy_templates enable row level security;

create policy "copy_templates: select próprio"  on copy_templates for select  to authenticated using (account_id = auth.uid());
create policy "copy_templates: insert próprio"  on copy_templates for insert  to authenticated with check (account_id = auth.uid());
create policy "copy_templates: update próprio"  on copy_templates for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "copy_templates: delete próprio"  on copy_templates for delete  to authenticated using (account_id = auth.uid());

-- ── sequencias_template ──
alter table sequencias_template enable row level security;

create policy "sequencias_template: select próprio"  on sequencias_template for select  to authenticated using (account_id = auth.uid());
create policy "sequencias_template: insert próprio"  on sequencias_template for insert  to authenticated with check (account_id = auth.uid());
create policy "sequencias_template: update próprio"  on sequencias_template for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "sequencias_template: delete próprio"  on sequencias_template for delete  to authenticated using (account_id = auth.uid());

-- ── sequencias_passo ──
-- Herdada via sequencia_id → account_id da sequencia_template
-- Para simplicidade, mantemos account_id direto
alter table sequencias_passo enable row level security;

create policy "sequencias_passo: select próprio"  on sequencias_passo for select  to authenticated using (account_id = auth.uid());
create policy "sequencias_passo: insert próprio"  on sequencias_passo for insert  to authenticated with check (account_id = auth.uid());
create policy "sequencias_passo: update próprio"  on sequencias_passo for update  to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());
create policy "sequencias_passo: delete próprio"  on sequencias_passo for delete  to authenticated using (account_id = auth.uid());
