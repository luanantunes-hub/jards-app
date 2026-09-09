-- Registra o resultado comercial de uma proposta e identifica a empresa compradora.
-- A aceitação é atômica: proposta, negociação, venda e disponibilidade da cota
-- são atualizadas juntas e não podem ser contabilizadas duas vezes.

create table if not exists public.vendas_patrocinio (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  projeto_id uuid not null references public.projetos_crm(id) on delete cascade,
  proposta_id uuid not null references public.propostas(id) on delete restrict,
  captacao_id uuid not null references public.captacoes(id) on delete restrict,
  cota_id uuid references public.cotas_patrocinio(id) on delete restrict,
  empresa_crm_id uuid references public.empresas_crm(id) on delete restrict,
  empresa_id uuid references public.empresas(id) on delete restrict,
  quantidade integer not null default 1 check (quantidade > 0),
  valor_vendido numeric(15,2) not null check (valor_vendido >= 0),
  vendida_em timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vendas_patrocinio_comprador_check
    check (num_nonnulls(empresa_crm_id, empresa_id) >= 1),
  constraint vendas_patrocinio_proposta_unique unique (proposta_id),
  constraint vendas_patrocinio_captacao_unique unique (captacao_id)
);

create index if not exists idx_vendas_patrocinio_org_data
  on public.vendas_patrocinio(organization_id, vendida_em desc);
create index if not exists idx_vendas_patrocinio_projeto
  on public.vendas_patrocinio(projeto_id, vendida_em desc);
create index if not exists idx_vendas_patrocinio_cota
  on public.vendas_patrocinio(cota_id, vendida_em desc)
  where cota_id is not null;
create index if not exists idx_vendas_patrocinio_empresa_crm
  on public.vendas_patrocinio(empresa_crm_id, vendida_em desc)
  where empresa_crm_id is not null;

alter table public.vendas_patrocinio enable row level security;

drop policy if exists "vendas_patrocinio: select org" on public.vendas_patrocinio;
create policy "vendas_patrocinio: select org"
  on public.vendas_patrocinio
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

revoke insert, update, delete on public.vendas_patrocinio from authenticated;
grant select on public.vendas_patrocinio to authenticated;

create or replace function public.fn_aceitar_proposta_comercial(p_proposta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_proposta public.propostas%rowtype;
  v_captacao public.captacoes%rowtype;
  v_cota public.cotas_patrocinio%rowtype;
  v_venda public.vendas_patrocinio%rowtype;
  v_novas_unidades integer;
begin
  select * into v_proposta
  from public.propostas
  where id = p_proposta_id
  for update;

  if not found then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if not public.auth_can_write_org(v_proposta.organization_id) then
    raise exception 'Sem permissão para aceitar esta proposta.' using errcode = '42501';
  end if;
  if v_proposta.captacao_id is null then
    raise exception 'A proposta precisa estar vinculada a uma negociação.' using errcode = '23514';
  end if;
  if v_proposta.valor_proposto is null then
    raise exception 'Informe o valor adaptado antes de aceitar.' using errcode = '23514';
  end if;

  select * into v_captacao
  from public.captacoes
  where id = v_proposta.captacao_id
  for update;

  if not found
    or v_captacao.organization_id is distinct from v_proposta.organization_id
    or v_captacao.projeto_id is distinct from v_proposta.projeto_id then
    raise exception 'A negociação não corresponde ao projeto desta proposta.' using errcode = '23514';
  end if;
  if v_captacao.empresa_crm_id is null and v_captacao.empresa_id is null then
    raise exception 'Vincule uma empresa à negociação antes de aceitar a proposta.' using errcode = '23514';
  end if;

  select * into v_venda
  from public.vendas_patrocinio
  where proposta_id = v_proposta.id;

  if found then
    return jsonb_build_object('venda_id', v_venda.id, 'already_accepted', true);
  end if;

  if exists (
    select 1 from public.vendas_patrocinio
    where captacao_id = v_captacao.id
  ) then
    raise exception 'Esta negociação já possui uma venda registrada.' using errcode = '23505';
  end if;

  if v_proposta.cota_id is not null then
    select * into v_cota
    from public.cotas_patrocinio
    where id = v_proposta.cota_id
    for update;

    if not found
      or v_cota.organization_id is distinct from v_proposta.organization_id
      or v_cota.projeto_id is distinct from v_proposta.projeto_id then
      raise exception 'A cota-base não corresponde ao projeto desta proposta.' using errcode = '23514';
    end if;
    if coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
      raise exception 'Não há unidades disponíveis nesta cota.' using errcode = '23514';
    end if;
  end if;

  insert into public.vendas_patrocinio (
    organization_id, projeto_id, proposta_id, captacao_id, cota_id,
    empresa_crm_id, empresa_id, quantidade, valor_vendido, created_by
  ) values (
    v_proposta.organization_id, v_proposta.projeto_id, v_proposta.id,
    v_captacao.id, v_proposta.cota_id, v_captacao.empresa_crm_id,
    v_captacao.empresa_id, 1, v_proposta.valor_proposto, auth.uid()
  ) returning * into v_venda;

  if v_proposta.cota_id is not null then
    v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
    update public.cotas_patrocinio
    set unidades_vendidas = v_novas_unidades,
        status = case
          when v_novas_unidades >= coalesce(unidades, 1) then 'vendida'
          else 'disponivel'
        end
    where id = v_cota.id;
  end if;

  update public.propostas
  set status = 'aceita'
  where id = v_proposta.id;

  update public.captacoes
  set status = 'aprovado',
      valor_aprovado = v_proposta.valor_proposto
  where id = v_captacao.id;

  return jsonb_build_object(
    'venda_id', v_venda.id,
    'captacao_id', v_captacao.id,
    'cota_id', v_proposta.cota_id,
    'empresa_crm_id', v_captacao.empresa_crm_id,
    'empresa_id', v_captacao.empresa_id,
    'valor_vendido', v_proposta.valor_proposto,
    'already_accepted', false
  );
end;
$function$;

revoke all on function public.fn_aceitar_proposta_comercial(uuid) from public, anon;
grant execute on function public.fn_aceitar_proposta_comercial(uuid) to authenticated, service_role;

comment on table public.vendas_patrocinio is
  'Vendas aprovadas, com vínculo entre proposta, negociação, cota e empresa compradora.';
comment on function public.fn_aceitar_proposta_comercial(uuid) is
  'Aceita uma proposta e registra atomicamente a venda e a ocupação de uma unidade da cota-base.';
