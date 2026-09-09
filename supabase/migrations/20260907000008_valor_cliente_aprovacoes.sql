-- Mantém o valor da conta alinhado ao resultado comercial aprovado.
-- Contratos formalizados são a fonte prioritária; antes deles, usa negociações e inscrições aprovadas.

create or replace function public.fn_recalcular_valor_conta(p_conta_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_empresa_crm_id uuid;
  v_total_contratos numeric(15,2);
  v_n_contratos integer;
  v_total_aprovado numeric(15,2);
begin
  select organization_id, empresa_crm_id
    into v_organization_id, v_empresa_crm_id
  from public.contas_patrocinio
  where id = p_conta_id;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    coalesce(sum(valor), 0)::numeric(15,2)
    into v_n_contratos, v_total_contratos
  from public.contratos
  where conta_patrocinio_id = p_conta_id
    and status in ('assinado', 'vigente', 'renovado');

  select coalesce(sum(valor), 0)::numeric(15,2)
    into v_total_aprovado
  from (
    select coalesce(valor_aprovado, 0)::numeric as valor
    from public.captacoes
    where organization_id = v_organization_id
      and empresa_crm_id = v_empresa_crm_id
      and status = 'aprovado'

    union all

    select coalesce(valor, 0)::numeric as valor
    from public.editais_user
    where organization_id = v_organization_id
      and empresa_crm_id = v_empresa_crm_id
      and status = 'aprovado'
  ) aprovados;

  update public.contas_patrocinio
  set valor_total = case
    when v_n_contratos > 0 then v_total_contratos
    else v_total_aprovado
  end
  where id = p_conta_id;
end;
$$;

create or replace function public.fn_recalcular_valor_cliente_empresa(
  p_organization_id uuid,
  p_empresa_crm_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta_id uuid;
begin
  if p_organization_id is null or p_empresa_crm_id is null then
    return;
  end if;

  select id into v_conta_id
  from public.contas_patrocinio
  where organization_id = p_organization_id
    and empresa_crm_id = p_empresa_crm_id
    and status = 'ativa'
  order by data_abertura desc, created_at desc
  limit 1;

  if v_conta_id is not null then
    perform public.fn_recalcular_valor_conta(v_conta_id);
  end if;
end;
$$;

create or replace function public.fn_sync_valor_cliente_aprovacao()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.fn_recalcular_valor_cliente_empresa(old.organization_id, old.empresa_crm_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.fn_recalcular_valor_cliente_empresa(new.organization_id, new.empresa_crm_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_captacao_sync_valor_cliente on public.captacoes;
create trigger trg_captacao_sync_valor_cliente
  after insert or update of status, valor_aprovado, empresa_crm_id or delete
  on public.captacoes
  for each row execute function public.fn_sync_valor_cliente_aprovacao();

drop trigger if exists trg_inscricao_sync_valor_cliente on public.editais_user;
create trigger trg_inscricao_sync_valor_cliente
  after insert or update of status, valor, empresa_crm_id or delete
  on public.editais_user
  for each row execute function public.fn_sync_valor_cliente_aprovacao();

-- Mantém a regra também quando um contrato é criado, alterado ou removido.
create or replace function public.fn_update_conta_valor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta_id uuid;
begin
  if tg_op = 'DELETE' then
    v_conta_id := old.conta_patrocinio_id;
  else
    v_conta_id := new.conta_patrocinio_id;
  end if;

  perform public.fn_recalcular_valor_conta(v_conta_id);

  if tg_op = 'UPDATE' and old.conta_patrocinio_id is distinct from new.conta_patrocinio_id then
    perform public.fn_recalcular_valor_conta(old.conta_patrocinio_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Reconcilia clientes já criados antes desta regra.
do $$
declare
  v_conta record;
begin
  for v_conta in
    select distinct on (organization_id, empresa_crm_id) id
    from public.contas_patrocinio
    where status = 'ativa'
    order by organization_id, empresa_crm_id, data_abertura desc, created_at desc
  loop
    perform public.fn_recalcular_valor_conta(v_conta.id);
  end loop;
end;
$$;

revoke all on function public.fn_recalcular_valor_conta(uuid) from public, anon, authenticated;
revoke all on function public.fn_recalcular_valor_cliente_empresa(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fn_sync_valor_cliente_aprovacao() from public, anon, authenticated;
