-- Garante que toda negociação ou inscrição aprovada possua um cliente ativo.
-- A regra é centralizada no banco para cobrir tabela, Kanban, detalhe, RPCs e automações.

create or replace function public.fn_ensure_cliente_aprovado(
  p_organization_id uuid,
  p_account_id uuid,
  p_empresa_crm_id uuid,
  p_empresa_pub_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_empresa_crm_id uuid := p_empresa_crm_id;
  v_empresa_nome text;
  v_empresa_setor text;
  v_empresa_site text;
  v_conta_id uuid;
begin
  if p_organization_id is null then
    raise exception 'A organização é obrigatória para aprovar e criar o cliente.' using errcode = '23514';
  end if;
  if p_account_id is null then
    raise exception 'O responsável é obrigatório para aprovar e criar o cliente.' using errcode = '23514';
  end if;
  if v_empresa_crm_id is null and p_empresa_pub_id is null then
    raise exception 'Vincule uma empresa antes de aprovar.' using errcode = '23514';
  end if;

  -- Serializa a materialização da mesma empresa pública dentro da organização.
  if v_empresa_crm_id is null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_organization_id::text || ':publica:' || p_empresa_pub_id::text, 0)
    );

    select id into v_empresa_crm_id
    from public.empresas_crm
    where organization_id = p_organization_id
      and empresa_pub_id = p_empresa_pub_id
    order by created_at
    limit 1;

    if v_empresa_crm_id is null then
      select nome, setor, site
      into v_empresa_nome, v_empresa_setor, v_empresa_site
      from public.empresas
      where id = p_empresa_pub_id;

      if v_empresa_nome is null then
        raise exception 'A empresa vinculada não foi encontrada.' using errcode = '23514';
      end if;

      insert into public.empresas_crm (
        account_id, organization_id, empresa_pub_id, nome, nome_key, setor, site, status
      ) values (
        p_account_id, p_organization_id, p_empresa_pub_id, v_empresa_nome,
        lower(trim(v_empresa_nome)), v_empresa_setor, v_empresa_site, 'aprovado'
      )
      returning id into v_empresa_crm_id;
    end if;
  end if;

  -- Impede duas aprovações simultâneas de criarem duas contas ativas.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':cliente:' || v_empresa_crm_id::text, 0)
  );

  select id into v_conta_id
  from public.contas_patrocinio
  where organization_id = p_organization_id
    and empresa_crm_id = v_empresa_crm_id
    and status = 'ativa'
  order by data_abertura desc
  limit 1;

  if v_conta_id is null then
    insert into public.contas_patrocinio (
      account_id, organization_id, empresa_crm_id, status
    ) values (
      p_account_id, p_organization_id, v_empresa_crm_id, 'ativa'
    );
  end if;

  return v_empresa_crm_id;
end;
$function$;

revoke all on function public.fn_ensure_cliente_aprovado(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;

create or replace function public.fn_cliente_ao_aprovar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_empresa_pub_id uuid;
  v_account_id uuid;
begin
  if new.status is distinct from 'aprovado' then
    return new;
  end if;

  if tg_table_name = 'captacoes' then
    v_empresa_pub_id := nullif(to_jsonb(new) ->> 'empresa_id', '')::uuid;
  else
    v_empresa_pub_id := nullif(to_jsonb(new) ->> 'empresa_pub_id', '')::uuid;
  end if;

  -- Em updates comuns, só executa ao entrar em aprovado ou trocar a empresa
  -- enquanto aprovado. INSERT aprovado também é coberto.
  if tg_op = 'UPDATE'
    and old.status = 'aprovado'
    and new.empresa_crm_id is not distinct from old.empresa_crm_id
    and v_empresa_pub_id is not distinct from (
      case
        when tg_table_name = 'captacoes' then nullif(to_jsonb(old) ->> 'empresa_id', '')::uuid
        else nullif(to_jsonb(old) ->> 'empresa_pub_id', '')::uuid
      end
    )
  then
    return new;
  end if;

  v_account_id := coalesce(auth.uid(), new.account_id);
  new.empresa_crm_id := public.fn_ensure_cliente_aprovado(
    new.organization_id,
    v_account_id,
    new.empresa_crm_id,
    v_empresa_pub_id
  );

  return new;
end;
$function$;

revoke all on function public.fn_cliente_ao_aprovar()
  from public, anon, authenticated;

drop trigger if exists trg_captacao_cliente_ao_aprovar on public.captacoes;
create trigger trg_captacao_cliente_ao_aprovar
  before insert or update of status, empresa_crm_id, empresa_id
  on public.captacoes
  for each row execute function public.fn_cliente_ao_aprovar();

drop trigger if exists trg_inscricao_cliente_ao_aprovar on public.editais_user;
create trigger trg_inscricao_cliente_ao_aprovar
  before insert or update of status, empresa_crm_id, empresa_pub_id
  on public.editais_user
  for each row execute function public.fn_cliente_ao_aprovar();

-- Reconcilição idempotente das aprovações existentes.
do $block$
declare
  v_row record;
  v_empresa_crm_id uuid;
begin
  for v_row in
    select id, account_id, organization_id, empresa_crm_id, empresa_id as empresa_pub_id
    from public.captacoes
    where status = 'aprovado'
      and (empresa_crm_id is not null or empresa_id is not null)
  loop
    v_empresa_crm_id := public.fn_ensure_cliente_aprovado(
      v_row.organization_id,
      v_row.account_id,
      v_row.empresa_crm_id,
      v_row.empresa_pub_id
    );
    if v_row.empresa_crm_id is distinct from v_empresa_crm_id then
      update public.captacoes set empresa_crm_id = v_empresa_crm_id where id = v_row.id;
    end if;
  end loop;

  for v_row in
    select id, account_id, organization_id, empresa_crm_id, empresa_pub_id
    from public.editais_user
    where status = 'aprovado'
      and (empresa_crm_id is not null or empresa_pub_id is not null)
  loop
    v_empresa_crm_id := public.fn_ensure_cliente_aprovado(
      v_row.organization_id,
      v_row.account_id,
      v_row.empresa_crm_id,
      v_row.empresa_pub_id
    );
    if v_row.empresa_crm_id is distinct from v_empresa_crm_id then
      update public.editais_user set empresa_crm_id = v_empresa_crm_id where id = v_row.id;
    end if;
  end loop;
end;
$block$;

comment on function public.fn_cliente_ao_aprovar() is
  'Ao aprovar negociação ou inscrição, materializa a empresa no CRM e garante um cliente ativo sem duplicação.';
