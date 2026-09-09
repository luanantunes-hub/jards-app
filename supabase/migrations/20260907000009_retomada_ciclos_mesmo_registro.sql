-- Retomadas comerciais mantêm a mesma negociação/inscrição e preservam
-- cada passagem em um histórico estruturado de ciclos.

alter table public.captacoes
  add column if not exists retomada_programada_em timestamptz,
  add column if not exists ciclo_programado integer,
  add column if not exists retomada_atividade_id uuid references public.atividades(id) on delete set null;

alter table public.editais_user
  add column if not exists retomada_programada_em timestamptz,
  add column if not exists ciclo_programado integer,
  add column if not exists retomada_atividade_id uuid references public.atividades(id) on delete set null;

create table if not exists public.ciclos_comerciais (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  captacao_id uuid references public.captacoes(id) on delete cascade,
  edital_user_id uuid references public.editais_user(id) on delete cascade,
  atividade_id uuid references public.atividades(id) on delete set null,
  ciclo_ano integer not null,
  proximo_ciclo_ano integer not null,
  status_final text not null,
  resultado text,
  nota text,
  valor_solicitado numeric(15,2),
  valor_aprovado numeric(15,2),
  potencial_fechamento text,
  iniciado_em timestamptz,
  encerrado_em timestamptz not null default now(),
  retomada_programada_em timestamptz not null,
  reaberto_em timestamptz,
  cancelado_em timestamptz,
  estado text not null default 'programado' check (estado in ('programado','reaberto','cancelado')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((captacao_id is not null)::integer + (edital_user_id is not null)::integer = 1)
);

create index if not exists idx_ciclos_comerciais_captacao
  on public.ciclos_comerciais(captacao_id, encerrado_em desc)
  where captacao_id is not null;
create index if not exists idx_ciclos_comerciais_inscricao
  on public.ciclos_comerciais(edital_user_id, encerrado_em desc)
  where edital_user_id is not null;
create index if not exists idx_ciclos_comerciais_retomada
  on public.ciclos_comerciais(retomada_programada_em)
  where estado = 'programado';
create unique index if not exists uq_ciclo_programado_captacao
  on public.ciclos_comerciais(captacao_id)
  where captacao_id is not null and estado = 'programado';
create unique index if not exists uq_ciclo_programado_inscricao
  on public.ciclos_comerciais(edital_user_id)
  where edital_user_id is not null and estado = 'programado';

alter table public.ciclos_comerciais enable row level security;
drop policy if exists ciclos_comerciais_org_select on public.ciclos_comerciais;
create policy ciclos_comerciais_org_select on public.ciclos_comerciais
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));
grant select on public.ciclos_comerciais to authenticated;

drop function if exists public.fn_renovar_captacao(uuid);
drop function if exists public.fn_renovar_captacao(uuid, timestamptz);
drop function if exists public.fn_renovar_captacao(uuid, timestamptz, integer);

create function public.fn_renovar_captacao(
  p_captacao_id uuid,
  p_data_retomada timestamptz default null,
  p_ciclo_ano integer default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.captacoes%rowtype;
  v_ciclo public.ciclos_comerciais%rowtype;
  v_atividade_id uuid;
  v_ano_atual integer;
  v_ano_novo integer;
  v_data timestamptz;
  v_projeto_nome text;
  v_tem_ciclo boolean;
begin
  select * into v_original from public.captacoes where id = p_captacao_id for update;
  if not found then raise exception 'Negociação não encontrada.'; end if;
  if not public.auth_can_write_org(v_original.organization_id) then
    raise exception 'Sem permissão para programar esta retomada.' using errcode = '42501';
  end if;
  if v_original.status <> 'recusado' then
    raise exception 'A retomada só pode ser programada para uma negociação recusada.' using errcode = '23514';
  end if;

  v_data := coalesce(p_data_retomada, now() + interval '60 days');
  if v_data <= now() then
    raise exception 'Escolha uma data futura para a retomada.' using errcode = '23514';
  end if;
  v_ano_atual := coalesce(v_original.ciclo_ano, extract(year from v_original.created_at)::integer);
  v_ano_novo := coalesce(p_ciclo_ano, v_ano_atual + 1);

  select * into v_ciclo
  from public.ciclos_comerciais
  where captacao_id = p_captacao_id and estado = 'programado'
  for update;
  v_tem_ciclo := found;

  select nome into v_projeto_nome from public.projetos_crm where id = v_original.projeto_id;

  if v_tem_ciclo then
    v_atividade_id := v_ciclo.atividade_id;
    update public.ciclos_comerciais
    set proximo_ciclo_ano = v_ano_novo,
        resultado = v_original.status,
        nota = nullif(trim(p_nota), ''),
        retomada_programada_em = v_data,
        updated_at = now()
    where id = v_ciclo.id;

    update public.atividades
    set nome = 'Retomar negociação · Ciclo ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
        data_inicio = v_data,
        data_prevista = v_data,
        resultado = v_original.status,
        nota = nullif(trim(p_nota), ''),
        updated_at = now()
    where id = v_atividade_id;
  else
    insert into public.atividades (
      account_id, organization_id, empresa_crm_id, projeto_id, captacao_id,
      nome, tipo, prioridade, data_inicio, data_prevista, feita, responsavel_id,
      resultado, nota, origem_automatica, regra_origem
    ) values (
      v_original.account_id, v_original.organization_id, v_original.empresa_crm_id,
      v_original.projeto_id, v_original.id,
      'Retomar negociação · Ciclo ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
      'outro', 'media', v_data, v_data, false,
      coalesce(v_original.supervisor_id, v_original.captador_id),
      v_original.status, nullif(trim(p_nota), ''), true, 'retomada_ciclo'
    ) returning id into v_atividade_id;

    insert into public.ciclos_comerciais (
      organization_id, account_id, captacao_id, atividade_id, ciclo_ano,
      proximo_ciclo_ano, status_final, resultado, nota, valor_solicitado,
      valor_aprovado, potencial_fechamento, iniciado_em, retomada_programada_em
    ) values (
      v_original.organization_id, v_original.account_id, v_original.id, v_atividade_id,
      v_ano_atual, v_ano_novo, v_original.status, v_original.status,
      nullif(trim(p_nota), ''), v_original.valor_solicitado, v_original.valor_aprovado,
      v_original.potencial_fechamento, v_original.created_at, v_data
    );
  end if;

  update public.captacoes
  set retomada_programada_em = v_data,
      ciclo_programado = v_ano_novo,
      retomada_atividade_id = v_atividade_id
  where id = v_original.id;

  return jsonb_build_object('id', v_original.id, 'ciclo_ano', v_ano_novo, 'atividade_id', v_atividade_id, 'programado', true);
end;
$$;

drop function if exists public.fn_renovar_inscricao(uuid);
drop function if exists public.fn_renovar_inscricao(uuid, timestamptz);
drop function if exists public.fn_renovar_inscricao(uuid, timestamptz, integer);

create function public.fn_renovar_inscricao(
  p_inscricao_id uuid,
  p_data_retomada timestamptz default null,
  p_ciclo_ano integer default null,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original public.editais_user%rowtype;
  v_ciclo public.ciclos_comerciais%rowtype;
  v_atividade_id uuid;
  v_ano_atual integer;
  v_ano_novo integer;
  v_data timestamptz;
  v_projeto_nome text;
  v_tem_ciclo boolean;
begin
  select * into v_original from public.editais_user where id = p_inscricao_id for update;
  if not found then raise exception 'Inscrição não encontrada.'; end if;
  if not public.auth_can_write_org(v_original.organization_id) then
    raise exception 'Sem permissão para programar esta retomada.' using errcode = '42501';
  end if;
  if v_original.status not in ('reprovado', 'cancelado') then
    raise exception 'A retomada só pode ser programada para uma inscrição reprovada ou cancelada.' using errcode = '23514';
  end if;

  v_data := coalesce(p_data_retomada, now() + interval '60 days');
  if v_data <= now() then
    raise exception 'Escolha uma data futura para a retomada.' using errcode = '23514';
  end if;
  v_ano_atual := coalesce(v_original.ciclo_ano, extract(year from v_original.created_at)::integer);
  v_ano_novo := coalesce(p_ciclo_ano, v_ano_atual + 1);

  select * into v_ciclo
  from public.ciclos_comerciais
  where edital_user_id = p_inscricao_id and estado = 'programado'
  for update;
  v_tem_ciclo := found;

  select nome into v_projeto_nome from public.projetos_crm where id = v_original.projeto_id;

  if v_tem_ciclo then
    v_atividade_id := v_ciclo.atividade_id;
    update public.ciclos_comerciais
    set proximo_ciclo_ano = v_ano_novo,
        resultado = v_original.status,
        nota = nullif(trim(p_nota), ''),
        retomada_programada_em = v_data,
        updated_at = now()
    where id = v_ciclo.id;

    update public.atividades
    set nome = 'Retomar inscrição · Ciclo ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
        data_inicio = v_data,
        data_prevista = v_data,
        resultado = v_original.status,
        nota = nullif(trim(p_nota), ''),
        updated_at = now()
    where id = v_atividade_id;
  else
    insert into public.atividades (
      account_id, organization_id, empresa_crm_id, projeto_id, edital_user_id,
      nome, tipo, prioridade, data_inicio, data_prevista, feita, responsavel_id,
      resultado, nota, origem_automatica, regra_origem
    ) values (
      v_original.account_id, v_original.organization_id, v_original.empresa_crm_id,
      v_original.projeto_id, v_original.id,
      'Retomar inscrição · Ciclo ' || v_ano_novo || coalesce(' · ' || v_projeto_nome, ''),
      'outro', 'media', v_data, v_data, false, v_original.responsavel_id,
      v_original.status, nullif(trim(p_nota), ''), true, 'retomada_ciclo'
    ) returning id into v_atividade_id;

    insert into public.ciclos_comerciais (
      organization_id, account_id, edital_user_id, atividade_id, ciclo_ano,
      proximo_ciclo_ano, status_final, resultado, nota, valor_solicitado,
      potencial_fechamento, iniciado_em, retomada_programada_em
    ) values (
      v_original.organization_id, v_original.account_id, v_original.id, v_atividade_id,
      v_ano_atual, v_ano_novo, v_original.status, v_original.status,
      nullif(trim(p_nota), ''), v_original.valor, v_original.potencial_fechamento,
      v_original.created_at, v_data
    );
  end if;

  update public.editais_user
  set retomada_programada_em = v_data,
      ciclo_programado = v_ano_novo,
      retomada_atividade_id = v_atividade_id
  where id = v_original.id;

  return jsonb_build_object('id', v_original.id, 'ciclo_ano', v_ano_novo, 'atividade_id', v_atividade_id, 'programado', true);
end;
$$;

create or replace function public.fn_processar_retomadas_comerciais()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ciclo public.ciclos_comerciais%rowtype;
  v_total integer := 0;
begin
  for v_ciclo in
    select * from public.ciclos_comerciais
    where estado = 'programado' and retomada_programada_em <= now()
    order by retomada_programada_em
    for update skip locked
  loop
    if v_ciclo.captacao_id is not null then
      update public.captacoes
      set status = 'prospeccao',
          potencial_fechamento = 'medio',
          ciclo_ano = v_ciclo.proximo_ciclo_ano,
          valor_aprovado = null,
          retorno = null,
          proxima_prospeccao = v_ciclo.retomada_programada_em,
          retomada_programada_em = null,
          ciclo_programado = null,
          retomada_atividade_id = null
      where id = v_ciclo.captacao_id and status = 'recusado';
    else
      update public.editais_user
      set status = 'interesse',
          potencial_fechamento = 'medio',
          ciclo_ano = v_ciclo.proximo_ciclo_ano,
          data_abertura = null,
          data_fechamento = null,
          data_resultado = null,
          retomada_programada_em = null,
          ciclo_programado = null,
          retomada_atividade_id = null
      where id = v_ciclo.edital_user_id and status in ('reprovado', 'cancelado');
    end if;

    if found then
      update public.ciclos_comerciais
      set estado = 'reaberto', reaberto_em = now(), updated_at = now()
      where id = v_ciclo.id;
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.fn_renovar_captacao(uuid, timestamptz, integer, text) from public, anon;
revoke all on function public.fn_renovar_inscricao(uuid, timestamptz, integer, text) from public, anon;
grant execute on function public.fn_renovar_captacao(uuid, timestamptz, integer, text) to authenticated, service_role;
grant execute on function public.fn_renovar_inscricao(uuid, timestamptz, integer, text) to authenticated, service_role;
revoke all on function public.fn_processar_retomadas_comerciais() from public, anon, authenticated;
grant execute on function public.fn_processar_retomadas_comerciais() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'jards-commercial-cycle-reopen';
    perform cron.schedule(
      'jards-commercial-cycle-reopen',
      '10 * * * *',
      'select public.fn_processar_retomadas_comerciais();'
    );
  else
    raise notice 'pg_cron indisponível; agende fn_processar_retomadas_comerciais externamente.';
  end if;
exception when others then
  raise notice 'Não foi possível agendar retomadas comerciais automaticamente: %', sqlerrm;
end;
$$;
