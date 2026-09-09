-- =============================================================
--  JARDS — Migração 009: Adicionar organization_id às tabelas privadas
--  2026-07-26
--
--  Nullable por ora — o backfill (migração 011) popula os dados.
--  A coluna account_id é mantida para backward compat durante
--  a transição, mas o RLS passa a usar organization_id (migração 012).
-- =============================================================

alter table captacoes           add column if not exists organization_id uuid references organizations(id);
alter table projetos_crm        add column if not exists organization_id uuid references organizations(id);
alter table empresas_crm        add column if not exists organization_id uuid references organizations(id);
alter table editais_user        add column if not exists organization_id uuid references organizations(id);
alter table contatos            add column if not exists organization_id uuid references organizations(id);
alter table atividades          add column if not exists organization_id uuid references organizations(id);
alter table notas               add column if not exists organization_id uuid references organizations(id);
alter table copy_templates      add column if not exists organization_id uuid references organizations(id);
alter table sequencias_template add column if not exists organization_id uuid references organizations(id);
alter table sequencias_passo    add column if not exists organization_id uuid references organizations(id);
alter table desbloqueios        add column if not exists organization_id uuid references organizations(id);

-- Índices para performance das queries de RLS
create index idx_captacoes_org_id           on captacoes(organization_id);
create index idx_projetos_crm_org_id        on projetos_crm(organization_id);
create index idx_empresas_crm_org_id        on empresas_crm(organization_id);
create index idx_editais_user_org_id        on editais_user(organization_id);
create index idx_contatos_org_id            on contatos(organization_id);
create index idx_atividades_org_id          on atividades(organization_id);
create index idx_notas_org_id              on notas(organization_id);
create index idx_copy_templates_org_id     on copy_templates(organization_id);
create index idx_seq_template_org_id       on sequencias_template(organization_id);
create index idx_seq_passo_org_id          on sequencias_passo(organization_id);
create index idx_desbloqueios_org_id       on desbloqueios(organization_id);
