-- Renovação operacional: planejamento no cliente, atividade programada e
-- criação idempotente de uma nova negociação vinculada à conta e ao contrato.

alter table public.captacoes
  add column if not exists conta_patrocinio_id uuid references public.contas_patrocinio(id) on delete set null,
  add column if not exists renovacao_id uuid,
  add column if not exists contrato_origem_id uuid references public.contratos(id) on delete set null;

create table if not exists public.renovacoes_cliente (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade,
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  contrato_origem_id uuid not null references public.contratos(id) on delete cascade,
  projeto_id uuid references public.projetos_crm(id) on delete set null,
  captacao_id uuid references public.captacoes(id) on delete set null,
  atividade_id uuid references public.atividades(id) on delete set null,
  responsavel_id uuid references public.profiles(id) on delete set null,
  cenario text not null default 'renovar' check (cenario in ('renovar','expandir','reduzir','encerrar')),
  status text not null default 'programada' check (status in ('programada','em_negociacao','aprovada','recusada','encerrada','cancelada')),
  valor_atual numeric(15,2),
  valor_esperado numeric(15,2),
  probabilidade smallint check (probabilidade is null or probabilidade between 0 and 100),
  confianca text check (confianca is null or confianca in ('baixa','media','alta')),
  iniciar_negociacao_em date not null,
  nota text,
  riscos text,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.captacoes
  drop constraint if exists captacoes_renovacao_id_fkey;
alter table public.captacoes
  add constraint captacoes_renovacao_id_fkey
  foreign key (renovacao_id) references public.renovacoes_cliente(id) on delete set null;

create index if not exists idx_renovacoes_cliente_conta
  on public.renovacoes_cliente(conta_patrocinio_id, created_at desc);
create index if not exists idx_renovacoes_cliente_inicio
  on public.renovacoes_cliente(iniciar_negociacao_em)
  where status = 'programada';
create unique index if not exists uq_renovacao_ativa_contrato
  on public.renovacoes_cliente(contrato_origem_id)
  where status in ('programada','em_negociacao');
create unique index if not exists uq_captacao_renovacao
  on public.captacoes(renovacao_id)
  where renovacao_id is not null;
create index if not exists idx_captacoes_conta
  on public.captacoes(conta_patrocinio_id, updated_at desc)
  where conta_patrocinio_id is not null;

alter table public.renovacoes_cliente enable row level security;
drop policy if exists renovacoes_cliente_org_select on public.renovacoes_cliente;
create policy renovacoes_cliente_org_select on public.renovacoes_cliente
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));
grant select on public.renovacoes_cliente to authenticated;

create or replace function public.fn_planejar_renovacao_cliente(
  p_conta_id uuid,
  p_contrato_id uuid,
  p_cenario text,
  p_iniciar_em date,
  p_valor_esperado numeric default null,
  p_probabilidade integer default null,
  p_confianca text default null,
  p_projeto_id uuid default null,
  p_responsavel_id uuid default null,
  p_nota text default null,
  p_riscos text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conta public.contas_patrocinio%rowtype;
  v_contrato public.contratos%rowtype;
  v_renovacao public.renovacoes_cliente%rowtype;
  v_atividade_id uuid;
  v_titulo text;
begin
  select * into v_conta from public.contas_patrocinio where id = p_conta_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  if not public.auth_can_write_org(v_conta.organization_id) then
    raise exception 'Sem permissão para planejar esta renovação.' using errcode = '42501';
  end if;

  select * into v_contrato
  from public.contratos
  where id = p_contrato_id and conta_patrocinio_id = p_conta_id;
  if not found then raise exception 'O contrato não pertence a este cliente.' using errcode = '23514'; end if;
  if p_cenario not in ('renovar','expandir','reduzir','encerrar') then
    raise exception 'Cenário de renovação inválido.' using errcode = '23514';
  end if;
  if p_iniciar_em is null then raise exception 'Informe quando iniciar a negociação.' using errcode = '23514'; end if;
  if p_probabilidade is not null and (p_probabilidade < 0 or p_probabilidade > 100) then
    raise exception 'A probabilidade deve estar entre 0 e 100.' using errcode = '23514';
  end if;

  select * into v_renovacao
  from public.renovacoes_cliente
  where contrato_origem_id = p_contrato_id
    and status in ('programada','em_negociacao')
  order by created_at desc
  limit 1
  for update;

  v_titulo := case p_cenario
    when 'expandir' then 'Preparar expansão'
    when 'reduzir' then 'Preparar renegociação'
    when 'encerrar' then 'Preparar encerramento'
    else 'Preparar renovação'
  end || ' · ' || coalesce(v_contrato.titulo, v_contrato.numero, 'Contrato');

  if found then
    update public.renovacoes_cliente
    set cenario = p_cenario,
        projeto_id = p_projeto_id,
        responsavel_id = p_responsavel_id,
        valor_esperado = p_valor_esperado,
        probabilidade = p_probabilidade,
        confianca = nullif(p_confianca, ''),
        iniciar_negociacao_em = p_iniciar_em,
        nota = nullif(trim(p_nota), ''),
        riscos = nullif(trim(p_riscos), ''),
        updated_at = now()
    where id = v_renovacao.id
    returning * into v_renovacao;
    v_atividade_id := v_renovacao.atividade_id;

    if v_atividade_id is not null then
      update public.atividades
      set nome = v_titulo,
          projeto_id = p_projeto_id,
          responsavel_id = p_responsavel_id,
          data_inicio = p_iniciar_em::timestamptz,
          data_prevista = p_iniciar_em::timestamptz,
          nota = nullif(trim(p_nota), ''),
          updated_at = now()
      where id = v_atividade_id;
    end if;
  else
    insert into public.atividades (
      account_id, organization_id, empresa_crm_id, projeto_id,
      conta_patrocinio_id, contrato_id, responsavel_id, nome, tipo,
      prioridade, data_inicio, data_prevista, feita, nota,
      origem_automatica, regra_origem
    ) values (
      v_conta.account_id, v_conta.organization_id, v_conta.empresa_crm_id,
      p_projeto_id, v_conta.id, v_contrato.id, p_responsavel_id, v_titulo,
      'outro', 'alta', p_iniciar_em::timestamptz, p_iniciar_em::timestamptz,
      false, nullif(trim(p_nota), ''), true, 'renovacao_cliente'
    ) returning id into v_atividade_id;

    insert into public.renovacoes_cliente (
      organization_id, account_id, conta_patrocinio_id, contrato_origem_id,
      projeto_id, atividade_id, responsavel_id, cenario, status, valor_atual,
      valor_esperado, probabilidade, confianca, iniciar_negociacao_em, nota, riscos
    ) values (
      v_conta.organization_id, v_conta.account_id, v_conta.id, v_contrato.id,
      p_projeto_id, v_atividade_id, p_responsavel_id, p_cenario, 'programada',
      v_contrato.valor, p_valor_esperado, p_probabilidade, nullif(p_confianca, ''),
      p_iniciar_em, nullif(trim(p_nota), ''), nullif(trim(p_riscos), '')
    ) returning * into v_renovacao;
  end if;

  insert into public.previsoes_renovacao (
    organization_id, account_id, contrato_id, cenario, valor_esperado,
    probabilidade, confianca, data_esperada, riscos, responsavel_id
  ) values (
    v_conta.organization_id, v_conta.account_id, v_contrato.id, p_cenario,
    p_valor_esperado, p_probabilidade, nullif(p_confianca, ''), p_iniciar_em,
    nullif(trim(p_riscos), ''), p_responsavel_id
  )
  on conflict (contrato_id) do update set
    cenario = excluded.cenario,
    valor_esperado = excluded.valor_esperado,
    probabilidade = excluded.probabilidade,
    confianca = excluded.confianca,
    data_esperada = excluded.data_esperada,
    riscos = excluded.riscos,
    responsavel_id = excluded.responsavel_id,
    updated_at = now();

  return jsonb_build_object(
    'id', v_renovacao.id,
    'atividade_id', v_atividade_id,
    'captacao_id', v_renovacao.captacao_id,
    'status', v_renovacao.status
  );
end;
$$;

create or replace function public.fn_processar_renovacoes_cliente()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_renovacao public.renovacoes_cliente%rowtype;
  v_conta public.contas_patrocinio%rowtype;
  v_contrato public.contratos%rowtype;
  v_captacao_id uuid;
  v_potencial text;
  v_titulo text;
  v_total integer := 0;
begin
  for v_renovacao in
    select * from public.renovacoes_cliente
    where status = 'programada' and iniciar_negociacao_em <= current_date
    order by iniciar_negociacao_em, created_at
    for update skip locked
  loop
    select * into v_conta from public.contas_patrocinio where id = v_renovacao.conta_patrocinio_id;
    select * into v_contrato from public.contratos where id = v_renovacao.contrato_origem_id;

    if v_renovacao.cenario = 'encerrar' then
      update public.renovacoes_cliente
      set status = 'encerrada', concluida_em = now(), updated_at = now()
      where id = v_renovacao.id;
      v_total := v_total + 1;
      continue;
    end if;

    v_potencial := case
      when coalesce(v_renovacao.probabilidade, 60) >= 75 then 'alto'
      when coalesce(v_renovacao.probabilidade, 60) < 40 then 'baixo'
      else 'medio'
    end;
    v_titulo := case v_renovacao.cenario
      when 'expandir' then 'Expansão'
      when 'reduzir' then 'Renegociação'
      else 'Renovação'
    end || ' · ' || coalesce(v_contrato.titulo, v_contrato.numero, 'Contrato');

    insert into public.captacoes (
      account_id, organization_id, empresa_crm_id, projeto_id, titulo,
      valor_solicitado, status, prioridade, potencial_fechamento,
      supervisor_id, proxima_prospeccao, conta_patrocinio_id,
      renovacao_id, contrato_origem_id, ciclo_ano
    ) values (
      v_renovacao.account_id, v_renovacao.organization_id, v_conta.empresa_crm_id,
      v_renovacao.projeto_id, v_titulo, v_renovacao.valor_esperado,
      'prospeccao', 'alta', v_potencial, v_renovacao.responsavel_id,
      v_renovacao.iniciar_negociacao_em::timestamptz, v_conta.id,
      v_renovacao.id, v_contrato.id, extract(year from v_renovacao.iniciar_negociacao_em)::integer
    )
    on conflict (renovacao_id) where renovacao_id is not null
    do update set updated_at = now()
    returning id into v_captacao_id;

    update public.renovacoes_cliente
    set captacao_id = v_captacao_id, status = 'em_negociacao', iniciada_em = now(), updated_at = now()
    where id = v_renovacao.id;
    update public.atividades set captacao_id = v_captacao_id where id = v_renovacao.atividade_id;
    v_total := v_total + 1;
  end loop;
  return v_total;
end;
$$;

create or replace function public.fn_sync_resultado_renovacao_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.renovacao_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  update public.renovacoes_cliente
  set status = case
        when new.status = 'aprovado' then 'aprovada'
        when new.status = 'recusado' then 'recusada'
        else 'em_negociacao'
      end,
      concluida_em = case when new.status in ('aprovado','recusado') then now() else null end,
      updated_at = now()
  where id = new.renovacao_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_resultado_renovacao_cliente on public.captacoes;
create trigger trg_sync_resultado_renovacao_cliente
  after update of status on public.captacoes
  for each row execute function public.fn_sync_resultado_renovacao_cliente();

revoke all on function public.fn_planejar_renovacao_cliente(uuid,uuid,text,date,numeric,integer,text,uuid,uuid,text,text) from public, anon;
grant execute on function public.fn_planejar_renovacao_cliente(uuid,uuid,text,date,numeric,integer,text,uuid,uuid,text,text) to authenticated, service_role;
revoke all on function public.fn_processar_renovacoes_cliente() from public, anon, authenticated;
grant execute on function public.fn_processar_renovacoes_cliente() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'jards-client-renewal-start';
    perform cron.schedule(
      'jards-client-renewal-start',
      '20 * * * *',
      'select public.fn_processar_renovacoes_cliente();'
    );
  else
    raise notice 'pg_cron indisponível; agende fn_processar_renovacoes_cliente externamente.';
  end if;
exception when others then
  raise notice 'Não foi possível agendar o início das renovações: %', sqlerrm;
end;
$$;

