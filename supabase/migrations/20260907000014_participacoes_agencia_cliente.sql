-- Preserva a participação de agências de captação após a conversão comercial.
-- A agência pertence ao contrato/resultado comercial, não permanentemente ao cliente.

begin;

create table if not exists public.participacoes_agencia_cliente (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete restrict,
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  venda_id uuid references public.vendas_patrocinio(id) on delete set null,
  captador_id uuid not null references public.captadores(id) on delete restrict,
  captacao_id uuid references public.captacoes(id) on delete set null,
  edital_user_id uuid references public.editais_user(id) on delete set null,
  atribuicao_id uuid references public.atribuicoes(id) on delete set null,
  papel text not null default 'principal'
    check (papel in ('principal','compartilhada','originadora','relacionamento','apoio')),
  status text not null default 'ativa'
    check (status in ('ativa','encerrada','cancelada')),
  percentual_comissao numeric(5,2)
    check (percentual_comissao is null or percentual_comissao between 0 and 100),
  valor_comissao numeric(15,2)
    check (valor_comissao is null or valor_comissao >= 0),
  data_inicio date not null default current_date,
  data_fim date,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(captacao_id, edital_user_id) <= 1),
  check (data_fim is null or data_fim >= data_inicio)
);

create unique index if not exists uq_participacao_principal_ativa_contrato
  on public.participacoes_agencia_cliente(contrato_id)
  where status = 'ativa' and papel = 'principal';

create unique index if not exists uq_participacao_agencia_papel_contrato
  on public.participacoes_agencia_cliente(contrato_id, captador_id, papel);

create index if not exists idx_participacoes_agencia_conta
  on public.participacoes_agencia_cliente(conta_patrocinio_id, status, created_at desc);

create index if not exists idx_participacoes_agencia_captador
  on public.participacoes_agencia_cliente(captador_id, status, created_at desc);

create index if not exists idx_participacoes_agencia_org
  on public.participacoes_agencia_cliente(organization_id, status);

alter table public.participacoes_agencia_cliente enable row level security;

drop policy if exists participacoes_agencia_select_org on public.participacoes_agencia_cliente;
create policy participacoes_agencia_select_org on public.participacoes_agencia_cliente
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists participacoes_agencia_insert_org on public.participacoes_agencia_cliente;
create policy participacoes_agencia_insert_org on public.participacoes_agencia_cliente
  for insert to authenticated
  with check (public.auth_can_write_org(organization_id));

drop policy if exists participacoes_agencia_update_org on public.participacoes_agencia_cliente;
create policy participacoes_agencia_update_org on public.participacoes_agencia_cliente
  for update to authenticated
  using (public.auth_can_write_org(organization_id))
  with check (public.auth_can_write_org(organization_id));

drop policy if exists participacoes_agencia_delete_org on public.participacoes_agencia_cliente;
create policy participacoes_agencia_delete_org on public.participacoes_agencia_cliente
  for delete to authenticated
  using (public.auth_can_write_org(organization_id));

grant select, insert, update, delete on public.participacoes_agencia_cliente to authenticated;

create or replace function public.fn_touch_participacao_agencia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_participacao_agencia on public.participacoes_agencia_cliente;
create trigger trg_touch_participacao_agencia
  before update on public.participacoes_agencia_cliente
  for each row execute function public.fn_touch_participacao_agencia();

create or replace function public.fn_sync_agencia_contrato_origem()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_captador_id uuid;
  v_venda_id uuid;
  v_atribuicao_id uuid;
  v_empresa_crm_id uuid;
begin
  if new.captacao_id is not null then
    select captador_externo_id, empresa_crm_id
      into v_captador_id, v_empresa_crm_id
    from public.captacoes
    where id = new.captacao_id;

    select id into v_venda_id
    from public.vendas_patrocinio
    where captacao_id = new.captacao_id
    order by created_at desc
    limit 1;
  elsif new.edital_user_id is not null then
    select case when responsavel_tipo = 'agencia' then responsavel_id end,
           empresa_crm_id
      into v_captador_id, v_empresa_crm_id
    from public.editais_user
    where id = new.edital_user_id;

    select id into v_venda_id
    from public.vendas_patrocinio
    where edital_user_id = new.edital_user_id
    order by created_at desc
    limit 1;
  end if;

  if v_captador_id is null then
    return new;
  end if;

  select id into v_atribuicao_id
  from public.atribuicoes
  where organization_id = new.organization_id
    and captador_user_id = v_captador_id
    and empresa_crm_id = v_empresa_crm_id
  order by (status = 'ativa') desc, created_at desc
  limit 1;

  insert into public.participacoes_agencia_cliente (
    organization_id, account_id, conta_patrocinio_id, contrato_id,
    venda_id, captador_id, captacao_id, edital_user_id, atribuicao_id,
    papel, status, created_by
  ) values (
    new.organization_id, new.account_id, new.conta_patrocinio_id, new.id,
    v_venda_id, v_captador_id, new.captacao_id, new.edital_user_id,
    v_atribuicao_id, 'principal', 'ativa', new.account_id
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.fn_sync_agencia_contrato_origem() from public, anon, authenticated;

drop trigger if exists trg_contrato_sync_agencia_origem on public.contratos;
create trigger trg_contrato_sync_agencia_origem
  after insert or update of captacao_id, edital_user_id, conta_patrocinio_id
  on public.contratos
  for each row execute function public.fn_sync_agencia_contrato_origem();

-- A renovação pode confirmar ou substituir a agência herdada do contrato anterior.
alter table public.renovacoes_cliente
  add column if not exists captador_id uuid references public.captadores(id) on delete set null;

create index if not exists idx_renovacoes_cliente_captador
  on public.renovacoes_cliente(captador_id)
  where captador_id is not null;

create or replace function public.fn_herdar_agencia_renovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.captador_id is null then
    select participacao.captador_id into new.captador_id
    from public.participacoes_agencia_cliente participacao
    where participacao.contrato_id = new.contrato_origem_id
      and participacao.status = 'ativa'
    order by (participacao.papel = 'principal') desc, participacao.created_at
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.fn_herdar_agencia_renovacao() from public, anon, authenticated;

drop trigger if exists trg_renovacao_herdar_agencia on public.renovacoes_cliente;
create trigger trg_renovacao_herdar_agencia
  before insert or update of contrato_origem_id, captador_id
  on public.renovacoes_cliente
  for each row execute function public.fn_herdar_agencia_renovacao();

create or replace function public.fn_definir_agencia_renovacao(
  p_renovacao_id uuid,
  p_captador_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.renovacoes_cliente
  where id = p_renovacao_id;

  if v_org_id is null then
    raise exception 'Renovação não encontrada.' using errcode = 'P0002';
  end if;
  if not public.auth_can_write_org(v_org_id) then
    raise exception 'Sem permissão para alterar esta renovação.' using errcode = '42501';
  end if;
  if p_captador_id is not null and not exists (
    select 1 from public.captadores
    where id = p_captador_id and organization_id = v_org_id
  ) then
    raise exception 'Agência inválida para esta organização.' using errcode = '23514';
  end if;

  update public.renovacoes_cliente
  set captador_id = p_captador_id, updated_at = now()
  where id = p_renovacao_id;
end;
$$;

revoke all on function public.fn_definir_agencia_renovacao(uuid, uuid) from public, anon;
grant execute on function public.fn_definir_agencia_renovacao(uuid, uuid) to authenticated, service_role;

-- Quando a negociação futura da renovação nascer, mantém a agência confirmada.
create or replace function public.fn_captacao_herdar_agencia_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.captador_externo_id is not null then
    return new;
  end if;

  if new.renovacao_id is not null then
    select captador_id into new.captador_externo_id
    from public.renovacoes_cliente
    where id = new.renovacao_id;
  end if;

  if new.captador_externo_id is null and new.contrato_origem_id is not null then
    select captador_id into new.captador_externo_id
    from public.participacoes_agencia_cliente
    where contrato_id = new.contrato_origem_id and status = 'ativa'
    order by (papel = 'principal') desc, created_at
    limit 1;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_captacao_herdar_agencia_cliente() from public, anon, authenticated;

drop trigger if exists trg_captacao_herdar_agencia_cliente on public.captacoes;
create trigger trg_captacao_herdar_agencia_cliente
  before insert or update of renovacao_id, contrato_origem_id
  on public.captacoes
  for each row execute function public.fn_captacao_herdar_agencia_cliente();

-- Corrige a FK histórica de comissões: o captador externo vive em captadores,
-- e não obrigatoriamente possui conta em auth.users.
update public.comissoes comissao
set captador_user_id = captador.id
from public.captadores captador
where captador.user_id = comissao.captador_user_id
  and captador.organization_id = comissao.organization_id;

do $$
begin
  if exists (
    select 1
    from public.comissoes comissao
    left join public.captadores captador on captador.id = comissao.captador_user_id
    where captador.id is null
  ) then
    raise exception 'Existem comissões legadas sem correspondência em captadores; corrija-as antes de aplicar a FK.';
  end if;
end;
$$;

alter table public.comissoes
  drop constraint if exists comissoes_captador_user_id_fkey;
alter table public.comissoes
  add constraint comissoes_captador_user_id_fkey
  foreign key (captador_user_id) references public.captadores(id) on delete restrict;

alter table public.comissoes
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null,
  add column if not exists participacao_id uuid references public.participacoes_agencia_cliente(id) on delete set null,
  add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null;

create index if not exists idx_comissoes_contrato on public.comissoes(contrato_id);
create index if not exists idx_comissoes_participacao on public.comissoes(participacao_id);

-- Backfill exato dos contratos já ligados a uma negociação ou inscrição.
insert into public.participacoes_agencia_cliente (
  organization_id, account_id, conta_patrocinio_id, contrato_id,
  venda_id, captador_id, captacao_id, edital_user_id, atribuicao_id,
  papel, status, created_by
)
select
  contrato.organization_id,
  contrato.account_id,
  contrato.conta_patrocinio_id,
  contrato.id,
  venda.id,
  coalesce(captacao.captador_externo_id,
    case when inscricao.responsavel_tipo = 'agencia' then inscricao.responsavel_id end),
  contrato.captacao_id,
  contrato.edital_user_id,
  atribuicao.id,
  'principal',
  'ativa',
  contrato.account_id
from public.contratos contrato
left join public.captacoes captacao on captacao.id = contrato.captacao_id
left join public.editais_user inscricao on inscricao.id = contrato.edital_user_id
left join lateral (
  select v.id
  from public.vendas_patrocinio v
  where v.captacao_id = contrato.captacao_id
     or v.edital_user_id = contrato.edital_user_id
  order by v.created_at desc
  limit 1
) venda on true
left join lateral (
  select a.id
  from public.atribuicoes a
  where a.organization_id = contrato.organization_id
    and a.empresa_crm_id = coalesce(captacao.empresa_crm_id, inscricao.empresa_crm_id)
    and a.captador_user_id = coalesce(captacao.captador_externo_id,
      case when inscricao.responsavel_tipo = 'agencia' then inscricao.responsavel_id end)
  order by (a.status = 'ativa') desc, a.created_at desc
  limit 1
) atribuicao on true
where contrato.organization_id is not null
  and coalesce(captacao.captador_externo_id,
    case when inscricao.responsavel_tipo = 'agencia' then inscricao.responsavel_id end) is not null
on conflict do nothing;

comment on table public.participacoes_agencia_cliente is
  'Participação histórica de agências externas em contratos e resultados comerciais de clientes.';
comment on column public.participacoes_agencia_cliente.papel is
  'Papel comercial da agência no contrato; principal é único enquanto ativo.';

commit;
