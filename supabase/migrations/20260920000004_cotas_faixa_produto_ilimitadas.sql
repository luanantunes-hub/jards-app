-- Cotas com preço fixo/faixa, nível/produto e capacidade limitada/ilimitada.
-- O valor contratado permanece na proposta/inscrição e na venda.
begin;

alter table public.cotas_patrocinio
  add column if not exists unidades integer not null default 1,
  add column if not exists unidades_ilimitadas boolean not null default false,
  add column if not exists valor_maximo numeric(15,2),
  add column if not exists modelo text not null default 'nivel',
  add column if not exists produto_nome text;

alter table public.cotas_patrocinio
  add constraint cotas_patrocinio_valor_faixa_check
  check (valor_maximo is null or (valor > 0 and valor_maximo > valor)),
  add constraint cotas_patrocinio_unidades_positivas_check
  check (unidades > 0),
  add constraint cotas_patrocinio_modelo_check
  check (modelo in ('nivel', 'produto')),
  add constraint cotas_patrocinio_produto_check
  check (modelo <> 'produto' or nullif(btrim(produto_nome), '') is not null);

-- Mantém cotas já existentes como fixas, limitadas e organizadas por nível.

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
      if not v_cota.unidades_ilimitadas and coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
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
          status = case when not unidades_ilimitadas and v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
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

create or replace function public.fn_inscricao_sincronizar_cota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_cota public.cotas_patrocinio%rowtype;
begin
  if new.cota_id is null then
    if new.status = 'aprovado'
      and (tg_op = 'INSERT' or old.status is distinct from 'aprovado') then
      raise exception 'Selecione uma cota antes de aprovar a inscrição.' using errcode = '23514';
    end if;
    return new;
  end if;

  select * into v_cota
  from public.cotas_patrocinio
  where id = new.cota_id;

  if not found
    or v_cota.organization_id is distinct from new.organization_id
    or v_cota.projeto_id is distinct from new.projeto_id then
    raise exception 'A cota selecionada não pertence ao projeto desta inscrição.' using errcode = '23514';
  end if;

  new.valor := coalesce(new.valor, v_cota.valor);
  return new;
end;
$function$;

create or replace function public.fn_inscricao_cota_ao_aprovar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_cota public.cotas_patrocinio%rowtype;
  v_venda public.vendas_patrocinio%rowtype;
  v_conta_id uuid;
  v_novas_unidades integer;
begin
  if new.status is distinct from 'aprovado' or new.cota_id is null then
    return new;
  end if;

  select * into v_cota
  from public.cotas_patrocinio
  where id = new.cota_id
  for update;

  if not found
    or v_cota.organization_id is distinct from new.organization_id
    or v_cota.projeto_id is distinct from new.projeto_id then
    raise exception 'A cota selecionada não pertence ao projeto desta inscrição.' using errcode = '23514';
  end if;

  select id into v_conta_id
  from public.contas_patrocinio
  where organization_id = new.organization_id
    and empresa_crm_id = new.empresa_crm_id
    and status = 'ativa'
  order by data_abertura desc, created_at desc
  limit 1;

  if v_conta_id is null then
    raise exception 'O cliente da inscrição aprovada não foi criado.' using errcode = '23514';
  end if;

  select * into v_venda
  from public.vendas_patrocinio
  where edital_user_id = new.id
  for update;

  -- Uma proposta aceita já é responsável pela venda e pelas entregas.
  if found and v_venda.proposta_id is not null then
    return new;
  end if;

  if found and v_venda.cota_id is distinct from new.cota_id then
    if not v_cota.unidades_ilimitadas and coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
      raise exception 'Não há unidades disponíveis nesta cota.' using errcode = '23514';
    end if;

    update public.cotas_patrocinio
    set unidades_vendidas = greatest(coalesce(unidades_vendidas, 0) - 1, 0),
        status = 'disponivel'
    where id = v_venda.cota_id;

    delete from public.compromissos_cliente
    where edital_user_id = new.id and proposta_id is null;

    update public.vendas_patrocinio
    set cota_id = new.cota_id,
        projeto_id = new.projeto_id,
        empresa_crm_id = new.empresa_crm_id,
        empresa_id = new.empresa_pub_id,
        valor_vendido = new.valor
    where id = v_venda.id;

    v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
    update public.cotas_patrocinio
    set unidades_vendidas = v_novas_unidades,
        status = case when not unidades_ilimitadas and v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
    where id = v_cota.id;
  elsif found then
    update public.vendas_patrocinio
    set empresa_crm_id = new.empresa_crm_id,
        empresa_id = new.empresa_pub_id,
        valor_vendido = new.valor
    where id = v_venda.id;
  else
    if not v_cota.unidades_ilimitadas and coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
      raise exception 'Não há unidades disponíveis nesta cota.' using errcode = '23514';
    end if;

    insert into public.vendas_patrocinio (
      organization_id, projeto_id, proposta_id, captacao_id, edital_user_id,
      cota_id, empresa_crm_id, empresa_id, quantidade, valor_vendido, created_by
    ) values (
      new.organization_id, new.projeto_id, null, null, new.id,
      new.cota_id, new.empresa_crm_id, new.empresa_pub_id, 1, new.valor,
      coalesce(auth.uid(), new.account_id)
    ) returning * into v_venda;

    v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
    update public.cotas_patrocinio
    set unidades_vendidas = v_novas_unidades,
        status = case when not unidades_ilimitadas and v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
    where id = v_cota.id;
  end if;

  insert into public.compromissos_cliente (
    organization_id, account_id, conta_patrocinio_id, projeto_id, cota_id,
    edital_user_id, contrapartida_ordem, titulo, categoria, status,
    evidencia_obrigatoria, origem
  )
  select
    new.organization_id, new.account_id, v_conta_id, new.projeto_id, new.cota_id,
    new.id, item.ordem::integer, trim(item.titulo), 'outro', 'pendente', true, 'cota'
  from unnest(coalesce(v_cota.contrapartidas, '{}'::text[])) with ordinality as item(titulo, ordem)
  where nullif(trim(item.titulo), '') is not null
  on conflict (edital_user_id, contrapartida_ordem)
    where edital_user_id is not null and proposta_id is null and contrapartida_ordem is not null
  do update set
    titulo = excluded.titulo,
    conta_patrocinio_id = excluded.conta_patrocinio_id,
    projeto_id = excluded.projeto_id,
    cota_id = excluded.cota_id;

  return new;
end;
$function$;


-- O valor da inscrição pode ser adaptado; ao trocar de cota, a tela pré-preenche
-- a nova referência, mas uma proposta aceita conserva o valor negociado.
drop trigger if exists trg_inscricao_sincronizar_cota on public.editais_user;
create trigger trg_inscricao_sincronizar_cota
  before insert or update of cota_id, projeto_id, status, valor
  on public.editais_user
  for each row execute function public.fn_inscricao_sincronizar_cota();

drop trigger if exists trg_inscricao_cota_ao_aprovar on public.editais_user;
create trigger trg_inscricao_cota_ao_aprovar
  after insert or update of status, cota_id, projeto_id, empresa_crm_id, valor
  on public.editais_user
  for each row execute function public.fn_inscricao_cota_ao_aprovar();

comment on column public.cotas_patrocinio.valor is 'Preço fixo ou limite inferior da faixa; referência, não valor contratado.';
comment on column public.cotas_patrocinio.valor_maximo is 'Limite superior opcional da faixa comercial.';
comment on column public.cotas_patrocinio.unidades_ilimitadas is 'Permite vendas contínuas sem consumir um teto de unidades.';
comment on column public.editais_user.cota_id is 'Cota-base da inscrição; valor negociado em editais_user.valor e benefícios nas contrapartidas.';

commit;
