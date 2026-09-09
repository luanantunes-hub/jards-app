-- Faz da cota a fonte de valor e contrapartidas das inscrições.
-- Ao aprovar, registra a venda e cria as entregas do cliente sem exigir proposta.

begin;

alter table public.editais_user
  add column if not exists cota_id uuid references public.cotas_patrocinio(id) on delete set null;

create index if not exists idx_editais_user_cota
  on public.editais_user(cota_id)
  where cota_id is not null;

alter table public.vendas_patrocinio
  alter column proposta_id drop not null;

alter table public.compromissos_cliente
  add column if not exists edital_user_id uuid references public.editais_user(id) on delete set null;

create unique index if not exists idx_compromissos_inscricao_cota_item_unique
  on public.compromissos_cliente(edital_user_id, contrapartida_ordem)
  where edital_user_id is not null and proposta_id is null and contrapartida_ordem is not null;

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

  new.valor := v_cota.valor;
  return new;
end;
$function$;

revoke all on function public.fn_inscricao_sincronizar_cota() from public, anon, authenticated;

drop trigger if exists trg_inscricao_sincronizar_cota on public.editais_user;
create trigger trg_inscricao_sincronizar_cota
  before insert or update of cota_id, projeto_id, status
  on public.editais_user
  for each row execute function public.fn_inscricao_sincronizar_cota();

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
    if coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
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
        valor_vendido = v_cota.valor
    where id = v_venda.id;

    v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
    update public.cotas_patrocinio
    set unidades_vendidas = v_novas_unidades,
        status = case when v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
    where id = v_cota.id;
  elsif found then
    update public.vendas_patrocinio
    set empresa_crm_id = new.empresa_crm_id,
        empresa_id = new.empresa_pub_id,
        valor_vendido = v_cota.valor
    where id = v_venda.id;
  else
    if coalesce(v_cota.unidades_vendidas, 0) >= coalesce(v_cota.unidades, 1) then
      raise exception 'Não há unidades disponíveis nesta cota.' using errcode = '23514';
    end if;

    insert into public.vendas_patrocinio (
      organization_id, projeto_id, proposta_id, captacao_id, edital_user_id,
      cota_id, empresa_crm_id, empresa_id, quantidade, valor_vendido, created_by
    ) values (
      new.organization_id, new.projeto_id, null, null, new.id,
      new.cota_id, new.empresa_crm_id, new.empresa_pub_id, 1, v_cota.valor,
      coalesce(auth.uid(), new.account_id)
    ) returning * into v_venda;

    v_novas_unidades := coalesce(v_cota.unidades_vendidas, 0) + 1;
    update public.cotas_patrocinio
    set unidades_vendidas = v_novas_unidades,
        status = case when v_novas_unidades >= coalesce(unidades, 1) then 'vendida' else 'disponivel' end
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

revoke all on function public.fn_inscricao_cota_ao_aprovar() from public, anon, authenticated;

drop trigger if exists trg_inscricao_cota_ao_aprovar on public.editais_user;
create trigger trg_inscricao_cota_ao_aprovar
  after insert or update of status, cota_id, projeto_id, empresa_crm_id
  on public.editais_user
  for each row execute function public.fn_inscricao_cota_ao_aprovar();

-- Liga inscrições históricas às cotas já registradas por vendas/propostas.
update public.editais_user inscricao
set cota_id = venda.cota_id,
    valor = venda.valor_vendido
from public.vendas_patrocinio venda
where venda.edital_user_id = inscricao.id
  and venda.cota_id is not null
  and inscricao.cota_id is null;

commit;

comment on column public.editais_user.cota_id is
  'Cota escolhida para a inscrição; define o valor e as contrapartidas convertidas em entregas na aprovação.';
comment on function public.fn_inscricao_cota_ao_aprovar() is
  'Registra a venda da cota e cria entregas do cliente quando uma inscrição é aprovada sem proposta.';
