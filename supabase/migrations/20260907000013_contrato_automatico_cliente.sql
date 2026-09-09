-- Todo cliente possui ao menos um contrato editável.
-- Aprovações de negociações e inscrições ligam o contrato à origem comercial,
-- preservando idempotência em reprocessamentos, webhooks e mudanças de status.

begin;

alter table public.contratos
  add column if not exists rascunho_automatico boolean not null default false,
  add column if not exists origem_tipo text,
  add column if not exists captacao_id uuid references public.captacoes(id) on delete set null,
  add column if not exists edital_user_id uuid references public.editais_user(id) on delete set null;

alter table public.contratos
  drop constraint if exists contratos_origem_tipo_check;
alter table public.contratos
  add constraint contratos_origem_tipo_check
  check (origem_tipo is null or origem_tipo in ('captacao', 'inscricao', 'manual'));

alter table public.contratos
  drop constraint if exists contratos_origem_unica_check;
alter table public.contratos
  add constraint contratos_origem_unica_check
  check (num_nonnulls(captacao_id, edital_user_id) <= 1);

create unique index if not exists idx_contratos_captacao_unique
  on public.contratos(captacao_id)
  where captacao_id is not null;

create unique index if not exists idx_contratos_inscricao_unique
  on public.contratos(edital_user_id)
  where edital_user_id is not null;

create index if not exists idx_contratos_rascunho_automatico
  on public.contratos(conta_patrocinio_id, rascunho_automatico)
  where rascunho_automatico = true;

create or replace function public.fn_criar_minuta_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.contratos (
    account_id,
    organization_id,
    conta_patrocinio_id,
    titulo,
    valor,
    status,
    data_proposta,
    rascunho_automatico,
    origem_tipo
  ) values (
    new.account_id,
    new.organization_id,
    new.id,
    'Contrato em preparação',
    0,
    'proposta',
    now(),
    true,
    'manual'
  );

  return new;
end;
$function$;

revoke all on function public.fn_criar_minuta_cliente() from public, anon, authenticated;

drop trigger if exists trg_cliente_criar_minuta on public.contas_patrocinio;
create trigger trg_cliente_criar_minuta
  after insert on public.contas_patrocinio
  for each row execute function public.fn_criar_minuta_cliente();

create or replace function public.fn_ensure_contrato_origem_aprovada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_conta public.contas_patrocinio%rowtype;
  v_contrato_id uuid;
  v_titulo text;
  v_valor numeric(15,2);
  v_origem_tipo text;
  v_captacao_id uuid;
  v_edital_user_id uuid;
begin
  if new.status is distinct from 'aprovado' or new.empresa_crm_id is null then
    return new;
  end if;

  select * into v_conta
  from public.contas_patrocinio
  where organization_id = new.organization_id
    and empresa_crm_id = new.empresa_crm_id
    and status = 'ativa'
  order by data_abertura desc, created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  if tg_table_name = 'captacoes' then
    v_origem_tipo := 'captacao';
    v_captacao_id := new.id;
    v_titulo := coalesce(nullif(trim(new.titulo), ''), 'Contrato da negociação');
    v_valor := coalesce(new.valor_aprovado, new.valor_solicitado, 0);

    select id into v_contrato_id
    from public.contratos
    where captacao_id = new.id
    limit 1;
  else
    v_origem_tipo := 'inscricao';
    v_edital_user_id := new.id;
    v_titulo := coalesce(nullif(trim(new.titulo), ''), 'Contrato da inscrição');
    v_valor := coalesce(new.valor, 0);

    select id into v_contrato_id
    from public.contratos
    where edital_user_id = new.id
    limit 1;
  end if;

  -- Uma mudança posterior no valor ou no título continua refletida na minuta,
  -- enquanto ela permanecer como rascunho automático.
  if v_contrato_id is not null then
    update public.contratos
    set titulo = case when rascunho_automatico then v_titulo else titulo end,
        valor = case when rascunho_automatico then v_valor else valor end,
        updated_at = now()
    where id = v_contrato_id;
    return new;
  end if;

  -- Se o cliente acabou de nascer, reaproveita a minuta vazia criada junto dele.
  select id into v_contrato_id
  from public.contratos
  where conta_patrocinio_id = v_conta.id
    and rascunho_automatico = true
    and captacao_id is null
    and edital_user_id is null
  order by created_at
  limit 1
  for update;

  if v_contrato_id is not null then
    update public.contratos
    set titulo = v_titulo,
        valor = v_valor,
        origem_tipo = v_origem_tipo,
        captacao_id = v_captacao_id,
        edital_user_id = v_edital_user_id,
        updated_at = now()
    where id = v_contrato_id;
  else
    insert into public.contratos (
      account_id,
      organization_id,
      conta_patrocinio_id,
      titulo,
      valor,
      status,
      data_proposta,
      rascunho_automatico,
      origem_tipo,
      captacao_id,
      edital_user_id
    ) values (
      v_conta.account_id,
      v_conta.organization_id,
      v_conta.id,
      v_titulo,
      v_valor,
      'proposta',
      now(),
      true,
      v_origem_tipo,
      v_captacao_id,
      v_edital_user_id
    )
    on conflict do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function public.fn_ensure_contrato_origem_aprovada() from public, anon, authenticated;

drop trigger if exists trg_captacao_contrato_ao_aprovar on public.captacoes;
create trigger trg_captacao_contrato_ao_aprovar
  after insert or update of status, valor_aprovado, valor_solicitado, titulo, empresa_crm_id
  on public.captacoes
  for each row execute function public.fn_ensure_contrato_origem_aprovada();

drop trigger if exists trg_inscricao_contrato_ao_aprovar on public.editais_user;
create trigger trg_inscricao_contrato_ao_aprovar
  after insert or update of status, valor, titulo, empresa_crm_id
  on public.editais_user
  for each row execute function public.fn_ensure_contrato_origem_aprovada();

-- Clientes legados sem contrato recebem primeiro uma minuta genérica.
insert into public.contratos (
  account_id,
  organization_id,
  conta_patrocinio_id,
  titulo,
  valor,
  status,
  data_proposta,
  rascunho_automatico,
  origem_tipo
)
select
  conta.account_id,
  conta.organization_id,
  conta.id,
  'Contrato em preparação',
  0,
  'proposta',
  now(),
  true,
  'manual'
from public.contas_patrocinio conta
where not exists (
  select 1 from public.contratos contrato
  where contrato.conta_patrocinio_id = conta.id
);

-- Dispara a reconciliação idempotente das aprovações existentes. A primeira
-- origem reaproveita a minuta genérica; as demais geram contratos próprios.
update public.captacoes
set status = status
where status = 'aprovado'
  and empresa_crm_id is not null;

update public.editais_user
set status = status
where status = 'aprovado'
  and empresa_crm_id is not null;

comment on column public.contratos.rascunho_automatico is
  'Indica contrato criado pelo sistema e ainda livre para complementação pelo usuário.';

comment on function public.fn_criar_minuta_cliente() is
  'Cria uma minuta editável sempre que um cliente é aberto.';

comment on function public.fn_ensure_contrato_origem_aprovada() is
  'Vincula ou cria contrato idempotente ao aprovar negociação ou inscrição.';

commit;
