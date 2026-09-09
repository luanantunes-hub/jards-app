-- Unifica o aceite comercial de negociações e inscrições.
-- A operação cria/localiza o cliente, registra a venda e materializa as
-- contrapartidas adaptadas como entregas operacionais de forma idempotente.

alter table public.vendas_patrocinio
  alter column captacao_id drop not null,
  add column if not exists edital_user_id uuid references public.editais_user(id) on delete restrict;

alter table public.vendas_patrocinio
  drop constraint if exists vendas_patrocinio_origem_check;
alter table public.vendas_patrocinio
  add constraint vendas_patrocinio_origem_check
  check (num_nonnulls(captacao_id, edital_user_id) = 1) not valid;
alter table public.vendas_patrocinio validate constraint vendas_patrocinio_origem_check;

create unique index if not exists idx_vendas_patrocinio_edital_unique
  on public.vendas_patrocinio(edital_user_id)
  where edital_user_id is not null;

alter table public.compromissos_cliente
  add column if not exists proposta_id uuid references public.propostas(id) on delete set null,
  add column if not exists contrapartida_ordem integer;

alter table public.compromissos_cliente
  drop constraint if exists compromissos_cliente_origem_check;
alter table public.compromissos_cliente
  add constraint compromissos_cliente_origem_check
  check (origem in ('manual','cota','contrato','importacao','proposta'));

create unique index if not exists idx_compromissos_proposta_item_unique
  on public.compromissos_cliente(proposta_id, contrapartida_ordem)
  where proposta_id is not null and contrapartida_ordem is not null;

create index if not exists idx_compromissos_proposta
  on public.compromissos_cliente(proposta_id)
  where proposta_id is not null;

create or replace function public.fn_aceitar_proposta_comercial(p_proposta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_proposta public.propostas%rowtype;
  v_captacao public.captacoes%rowtype;
  v_inscricao public.editais_user%rowtype;
  v_cota public.cotas_patrocinio%rowtype;
  v_venda public.vendas_patrocinio%rowtype;
  v_empresa_crm_id uuid;
  v_empresa_pub_id uuid;
  v_conta_id uuid;
  v_empresa_nome text;
  v_empresa_setor text;
  v_empresa_site text;
  v_novas_unidades integer;
  v_already_accepted boolean := false;
  v_entregas_criadas integer := 0;
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
  if num_nonnulls(v_proposta.captacao_id, v_proposta.edital_user_id) <> 1 then
    raise exception 'A proposta precisa estar vinculada a uma negociação ou inscrição.' using errcode = '23514';
  end if;
  if v_proposta.valor_proposto is null then
    raise exception 'Informe o valor adaptado antes de aceitar.' using errcode = '23514';
  end if;

  if v_proposta.captacao_id is not null then
    select * into v_captacao from public.captacoes
    where id = v_proposta.captacao_id for update;
    if not found
      or v_captacao.organization_id is distinct from v_proposta.organization_id
      or v_captacao.projeto_id is distinct from v_proposta.projeto_id then
      raise exception 'A negociação não corresponde ao projeto desta proposta.' using errcode = '23514';
    end if;
    v_empresa_crm_id := v_captacao.empresa_crm_id;
    v_empresa_pub_id := v_captacao.empresa_id;
  else
    select * into v_inscricao from public.editais_user
    where id = v_proposta.edital_user_id for update;
    if not found
      or v_inscricao.organization_id is distinct from v_proposta.organization_id
      or v_inscricao.projeto_id is distinct from v_proposta.projeto_id then
      raise exception 'A inscrição não corresponde ao projeto desta proposta.' using errcode = '23514';
    end if;
    v_empresa_crm_id := v_inscricao.empresa_crm_id;
    v_empresa_pub_id := v_inscricao.empresa_pub_id;
  end if;

  -- Quando o caso veio do catálogo público, materializa a empresa no CRM da organização.
  if v_empresa_crm_id is null and v_empresa_pub_id is not null then
    select id into v_empresa_crm_id
    from public.empresas_crm
    where organization_id = v_proposta.organization_id
      and empresa_pub_id = v_empresa_pub_id
    order by created_at
    limit 1;

    if v_empresa_crm_id is null then
      select nome, setor, site into v_empresa_nome, v_empresa_setor, v_empresa_site
      from public.empresas where id = v_empresa_pub_id;
      if v_empresa_nome is null then
        raise exception 'Empresa da proposta não encontrada.' using errcode = '23514';
      end if;
      insert into public.empresas_crm (
        account_id, organization_id, empresa_pub_id, nome, nome_key, setor, site, status
      ) values (
        auth.uid(), v_proposta.organization_id, v_empresa_pub_id, v_empresa_nome,
        lower(trim(v_empresa_nome)), v_empresa_setor, v_empresa_site, 'aprovado'
      ) returning id into v_empresa_crm_id;
    end if;

    if v_proposta.captacao_id is not null then
      update public.captacoes set empresa_crm_id = v_empresa_crm_id where id = v_proposta.captacao_id;
    else
      update public.editais_user set empresa_crm_id = v_empresa_crm_id where id = v_proposta.edital_user_id;
    end if;
  end if;

  if v_empresa_crm_id is null then
    raise exception 'Vincule uma empresa do CRM antes de aceitar a proposta.' using errcode = '23514';
  end if;

  select id into v_conta_id
  from public.contas_patrocinio
  where organization_id = v_proposta.organization_id
    and empresa_crm_id = v_empresa_crm_id
    and status = 'ativa'
  order by data_abertura desc
  limit 1
  for update;

  if v_conta_id is null then
    insert into public.contas_patrocinio (
      account_id, organization_id, empresa_crm_id, status
    ) values (
      auth.uid(), v_proposta.organization_id, v_empresa_crm_id, 'ativa'
    ) returning id into v_conta_id;
  end if;

  select * into v_venda
  from public.vendas_patrocinio
  where proposta_id = v_proposta.id;
  v_already_accepted := found;

  if not v_already_accepted then
    if v_proposta.cota_id is not null then
      select * into v_cota from public.cotas_patrocinio
      where id = v_proposta.cota_id for update;
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
      organization_id, projeto_id, proposta_id, captacao_id, edital_user_id,
      cota_id, empresa_crm_id, empresa_id, quantidade, valor_vendido, created_by
    ) values (
      v_proposta.organization_id, v_proposta.projeto_id, v_proposta.id,
      v_proposta.captacao_id, v_proposta.edital_user_id, v_proposta.cota_id,
      v_empresa_crm_id, v_empresa_pub_id, 1, v_proposta.valor_proposto, auth.uid()
    ) returning * into v_venda;

    if v_proposta.cota_id is not null then
      v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
      update public.cotas_patrocinio
      set unidades_vendidas = v_novas_unidades,
          status = case when v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
      where id = v_cota.id;
    end if;
  end if;

  update public.propostas set status = 'aceita' where id = v_proposta.id;
  if v_proposta.captacao_id is not null then
    update public.captacoes
    set status = 'aprovado', valor_aprovado = v_proposta.valor_proposto, empresa_crm_id = v_empresa_crm_id
    where id = v_proposta.captacao_id;
  else
    update public.editais_user
    set status = 'aprovado', valor = v_proposta.valor_proposto, empresa_crm_id = v_empresa_crm_id
    where id = v_proposta.edital_user_id;
  end if;

  insert into public.compromissos_cliente (
    organization_id, account_id, conta_patrocinio_id, projeto_id, cota_id,
    proposta_id, contrapartida_ordem, titulo, categoria, status,
    evidencia_obrigatoria, origem
  )
  select
    v_proposta.organization_id, auth.uid(), v_conta_id, v_proposta.projeto_id,
    v_proposta.cota_id, v_proposta.id, item.ordem::integer, trim(item.titulo),
    'outro', 'pendente', true, 'proposta'
  from unnest(coalesce(v_proposta.contrapartidas, '{}'::text[])) with ordinality as item(titulo, ordem)
  where nullif(trim(item.titulo), '') is not null
  on conflict (proposta_id, contrapartida_ordem)
    where proposta_id is not null and contrapartida_ordem is not null
  do update set
    titulo = excluded.titulo,
    conta_patrocinio_id = excluded.conta_patrocinio_id,
    projeto_id = excluded.projeto_id,
    cota_id = excluded.cota_id;
  get diagnostics v_entregas_criadas = row_count;

  return jsonb_build_object(
    'venda_id', v_venda.id,
    'captacao_id', v_proposta.captacao_id,
    'edital_user_id', v_proposta.edital_user_id,
    'cota_id', v_proposta.cota_id,
    'empresa_crm_id', v_empresa_crm_id,
    'conta_patrocinio_id', v_conta_id,
    'valor_vendido', v_proposta.valor_proposto,
    'entregas_processadas', v_entregas_criadas,
    'already_accepted', v_already_accepted
  );
end;
$function$;

revoke all on function public.fn_aceitar_proposta_comercial(uuid) from public, anon;
grant execute on function public.fn_aceitar_proposta_comercial(uuid) to authenticated, service_role;

comment on function public.fn_aceitar_proposta_comercial(uuid) is
  'Aceita proposta de negociação ou inscrição, registra venda, cria/localiza cliente e gera entregas a partir das contrapartidas.';
