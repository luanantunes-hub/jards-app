-- Migration: Tabelas contas_patrocinio e contratos
-- Separa "prospecção" (empresas_crm) de "gestão de contas" (contas_patrocinio + contratos)

-- ─────────────────────────────────────────────
--  CONTAS PATROCINIO
--  Uma empresa pode ter múltiplas contas ao longo do tempo
-- ─────────────────────────────────────────────
create table if not exists contas_patrocinio (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references auth.users(id),
  organization_id uuid references organizations(id),

  empresa_crm_id  uuid not null references empresas_crm(id) on delete cascade,
  nome            text,                   -- nome da conta (ex: "Jards 2026", "Patrocínio Anual")
  status          text not null default 'ativa'
                  check (status in ('ativa', 'pausada', 'encerrada')),
  data_abertura   timestamptz not null default now(),
  data_encerramento timestamptz,
  motivo_encerramento text,
  valor_total     numeric(15,2) default 0,  -- soma dos contratos
  notas           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_contas_patrocinio_empresa  on contas_patrocinio(empresa_crm_id);
create index idx_contas_patrocinio_org      on contas_patrocinio(organization_id);
create index idx_contas_patrocinio_status   on contas_patrocinio(status);

-- ─────────────────────────────────────────────
--  CONTRATOS
--  Cada contrato pertence a uma conta de patrocínio
-- ─────────────────────────────────────────────
create table if not exists contratos (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references auth.users(id),
  organization_id       uuid references organizations(id),

  conta_patrocinio_id   uuid not null references contas_patrocinio(id) on delete cascade,
  numero                text,               -- número do contrato
  titulo                text,               -- descrição do contrato
  valor                 numeric(15,2) not null default 0,
  status                text not null default 'proposta'
                        check (status in ('proposta', 'assinado', 'vigente', 'encerrado', 'renovado')),
  data_proposta         timestamptz,
  data_assinatura       timestamptz,
  data_inicio           timestamptz,
  data_fim              timestamptz,
  data_encerramento     timestamptz,
  renovacao_automatica  boolean default false,
  proxima_renovacao     timestamptz,
  notas                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_contratos_conta     on contratos(conta_patrocinio_id);
create index idx_contratos_org       on contratos(organization_id);
create index idx_contratos_status    on contratos(status);
create index idx_contratos_renovacao on contratos(proxima_renovacao) where proxima_renovacao is not null;

-- ─────────────────────────────────────────────
--  RLS — organization-scoped
-- ─────────────────────────────────────────────
alter table contas_patrocinio enable row level security;
alter table contratos enable row level security;

create policy "contas_patrocinio: select org" on contas_patrocinio
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "contas_patrocinio: insert org" on contas_patrocinio
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "contas_patrocinio: update org" on contas_patrocinio
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "contas_patrocinio: delete org" on contas_patrocinio
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

create policy "contratos: select org" on contratos
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "contratos: insert org" on contratos
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "contratos: update org" on contratos
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "contratos: delete org" on contratos
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

-- ─────────────────────────────────────────────
--  Trigger: updated_at automático
-- ─────────────────────────────────────────────
create or replace function update_contas_patrocinio_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contas_patrocinio_updated_at
  before update on contas_patrocinio
  for each row execute function update_contas_patrocinio_updated_at();

create or replace function update_contratos_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_contratos_updated_at
  before update on contratos
  for each row execute function update_contratos_updated_at();

-- ─────────────────────────────────────────────
--  Trigger: sincronizar empresas_crm.tipo com contas_patrocinio
--  Quando uma conta é criada/alterada/encerrada, atualiza o tipo da empresa
-- ─────────────────────────────────────────────
create or replace function fn_sync_empresa_tipo()
returns trigger as $$
declare
  v_empresa_id uuid;
  v_tem_conta_ativa boolean;
begin
  -- Determinar empresa_crm_id
  if TG_OP = 'DELETE' then
    v_empresa_id := OLD.empresa_crm_id;
  else
    v_empresa_id := NEW.empresa_crm_id;
  end if;

  -- Verificar se existe alguma conta ativa para esta empresa
  select exists(
    select 1 from contas_patrocinio
    where empresa_crm_id = v_empresa_id
      and status = 'ativa'
  ) into v_tem_conta_ativa;

  -- Atualizar tipo da empresa
  if v_tem_conta_ativa then
    update empresas_crm set tipo = 'cliente_ativo' where id = v_empresa_id and tipo != 'cliente_ativo';
  else
    -- Se não tem conta ativa mas já foi cliente, marca como ex_cliente
    update empresas_crm set tipo = 'ex_cliente'
    where id = v_empresa_id
      and tipo = 'cliente_ativo'
      and exists(select 1 from contas_patrocinio where empresa_crm_id = v_empresa_id);
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql;

create trigger trg_sync_empresa_tipo
  after insert or update or delete on contas_patrocinio
  for each row execute function fn_sync_empresa_tipo();

-- ─────────────────────────────────────────────
--  Trigger: atualizar valor_total na conta quando contrato muda
-- ─────────────────────────────────────────────
create or replace function fn_update_conta_valor()
returns trigger as $$
declare
  v_conta_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_conta_id := OLD.conta_patrocinio_id;
  else
    v_conta_id := NEW.conta_patrocinio_id;
  end if;

  update contas_patrocinio
  set valor_total = coalesce((
    select sum(valor) from contratos
    where conta_patrocinio_id = v_conta_id
      and status in ('assinado', 'vigente', 'renovado')
  ), 0)
  where id = v_conta_id;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$ language plpgsql;

create trigger trg_update_conta_valor
  after insert or update or delete on contratos
  for each row execute function fn_update_conta_valor();
