-- Notification Inbox v2
-- Evolui a caixa atual sem apagar dados e introduz uma outbox de eventos
-- transacional, deduplicação e os primeiros eventos críticos do produto.

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  event_key text not null,
  entity_type text,
  entity_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create unique index if not exists idx_notification_events_dedupe
  on public.notification_events(dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_notification_events_pending
  on public.notification_events(status, occurred_at)
  where status = 'pending';

alter table public.notification_events enable row level security;
revoke all on public.notification_events from anon, authenticated;
grant all on public.notification_events to service_role;

alter table public.notificacoes
  add column if not exists event_id uuid references public.notification_events(id) on delete set null,
  add column if not exists event_key text,
  add column if not exists categoria text not null default 'sistema',
  add column if not exists prioridade text not null default 'normal',
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists actor_id uuid references auth.users(id) on delete set null,
  add column if not exists dados jsonb not null default '{}'::jsonb,
  add column if not exists dedupe_key text,
  add column if not exists lida_em timestamptz,
  add column if not exists arquivada_em timestamptz,
  add column if not exists adiada_ate timestamptz,
  add column if not exists expires_at timestamptz;

update public.notificacoes
set lida_em = coalesce(lida_em, created_at)
where lida = true and lida_em is null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notificacoes'::regclass
      and conname = 'notificacoes_prioridade_check'
  ) then
    alter table public.notificacoes
      add constraint notificacoes_prioridade_check
      check (prioridade in ('baixa', 'normal', 'alta', 'critica'));
  end if;
end
$constraints$;

create unique index if not exists idx_notificacoes_user_dedupe
  on public.notificacoes(user_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists idx_notificacoes_inbox
  on public.notificacoes(user_id, arquivada_em, created_at desc);
create index if not exists idx_notificacoes_entity
  on public.notificacoes(organization_id, entity_type, entity_id);
create index if not exists idx_notificacoes_snoozed
  on public.notificacoes(user_id, adiada_ate)
  where adiada_ate is not null and arquivada_em is null;

-- Mantém o booleano legado sincronizado com o timestamp novo.
create or replace function public.fn_sync_notification_read_state()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.lida is distinct from old.lida then
    new.lida_em := case when new.lida then coalesce(new.lida_em, now()) else null end;
  elsif new.lida_em is distinct from old.lida_em then
    new.lida := new.lida_em is not null;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sync_notification_read_state on public.notificacoes;
create trigger trg_sync_notification_read_state
before update of lida, lida_em on public.notificacoes
for each row execute function public.fn_sync_notification_read_state();

-- A outbox recebe o evento; um trigger pequeno materializa a inbox nesta fase.
-- O contrato permite trocar o trigger por Edge Function/worker sem alterar os módulos.
create or replace function public.fn_dispatch_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_recipient uuid;
  v_account uuid;
begin
  v_recipient := nullif(new.payload->>'recipient_id', '')::uuid;
  v_account := coalesce(nullif(new.payload->>'account_id', '')::uuid, v_recipient);

  if v_recipient is null then
    update public.notification_events
      set status = 'failed', processed_at = now(), error = 'recipient_id ausente'
    where id = new.id;
    return new;
  end if;

  insert into public.notificacoes (
    account_id, organization_id, user_id, tipo, titulo, mensagem, link,
    event_id, event_key, categoria, prioridade, entity_type, entity_id,
    actor_id, dados, dedupe_key
  ) values (
    v_account,
    new.organization_id,
    v_recipient,
    new.event_key,
    coalesce(new.payload->>'title', 'Nova notificação'),
    coalesce(new.payload->>'message', ''),
    new.payload->>'link',
    new.id,
    new.event_key,
    coalesce(new.payload->>'category', 'sistema'),
    coalesce(new.payload->>'priority', 'normal'),
    new.entity_type,
    new.entity_id,
    new.actor_id,
    new.payload - array['recipient_id', 'account_id', 'title', 'message', 'link', 'category', 'priority'],
    new.dedupe_key
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  update public.notification_events
    set status = 'processed', processed_at = now(), error = null
  where id = new.id;
  return new;
exception when others then
  update public.notification_events
    set status = 'failed', processed_at = now(), error = left(sqlerrm, 500)
  where id = new.id;
  return new;
end;
$function$;

drop trigger if exists trg_dispatch_notification_event on public.notification_events;
create trigger trg_dispatch_notification_event
after insert on public.notification_events
for each row execute function public.fn_dispatch_notification_event();

create or replace function public.fn_emit_notification(
  p_event_key text,
  p_organization_id uuid,
  p_recipient_id uuid,
  p_title text,
  p_message text,
  p_link text default null,
  p_category text default 'sistema',
  p_priority text default 'normal',
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_actor_id uuid default null,
  p_dedupe_key text default null,
  p_data jsonb default '{}'::jsonb,
  p_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_event_id uuid;
begin
  if p_recipient_id is null then return null; end if;
  if p_priority not in ('baixa', 'normal', 'alta', 'critica') then
    raise exception 'Prioridade de notificação inválida';
  end if;

  insert into public.notification_events (
    organization_id, event_key, entity_type, entity_id, actor_id, payload, dedupe_key
  ) values (
    p_organization_id,
    p_event_key,
    p_entity_type,
    p_entity_id,
    p_actor_id,
    coalesce(p_data, '{}'::jsonb) || jsonb_build_object(
      'recipient_id', p_recipient_id,
      'account_id', coalesce(p_account_id, p_recipient_id),
      'title', p_title,
      'message', p_message,
      'link', p_link,
      'category', p_category,
      'priority', p_priority
    ),
    p_dedupe_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_event_id;

  return v_event_id;
end;
$function$;

revoke all on function public.fn_emit_notification(text, uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;

-- Atividade atribuída a um membro.
create or replace function public.fn_notify_activity_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.responsavel_id is not null
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
     and new.responsavel_id is distinct from auth.uid() then
    perform public.fn_emit_notification(
      'atividade_atribuida', new.organization_id, new.responsavel_id,
      'Nova atividade para você', new.nome,
      '/atividades?atividade=' || new.id, 'atividades', 'alta',
      'atividade', new.id, auth.uid(),
      'atividade_atribuida:' || new.id || ':' || new.responsavel_id,
      jsonb_build_object('data_prevista', new.data_prevista), new.account_id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_activity_assignment on public.atividades;
create trigger trg_notify_activity_assignment
after insert or update of responsavel_id on public.atividades
for each row execute function public.fn_notify_activity_assignment();

-- Reimplementa a conclusão usando os campos atuais e a mesma infraestrutura.
create or replace function public.fn_notificar_atividade_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa_nome text;
  v_owner uuid;
  v_org uuid;
  v_account uuid;
  v_responsavel_nome text;
begin
  if new.feita = true and coalesce(old.feita, false) = false and new.captacao_id is not null then
    select e.nome, coalesce(c.captador_id, c.account_id), c.organization_id, c.account_id
      into v_empresa_nome, v_owner, v_org, v_account
    from public.captacoes c
    left join public.empresas_crm e on e.id = c.empresa_crm_id
    where c.id = new.captacao_id;

    select full_name into v_responsavel_nome from public.profiles where id = new.responsavel_id;

    if v_owner is not null and v_owner is distinct from coalesce(new.responsavel_id, auth.uid()) then
      perform public.fn_emit_notification(
        'atividade_concluida', v_org, v_owner,
        'Atividade concluída',
        coalesce(v_responsavel_nome, 'Um membro') || ' concluiu “' || new.nome || '”' ||
          case when v_empresa_nome is not null then ' em ' || v_empresa_nome else '' end,
        '/captacoes/' || new.captacao_id, 'atividades', 'normal',
        'atividade', new.id, coalesce(new.responsavel_id, auth.uid()),
        'atividade_concluida:' || new.id || ':' || v_owner,
        '{}'::jsonb, v_account
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_atividade_concluida_notify on public.atividades;
create trigger trg_atividade_concluida_notify
after update of feita on public.atividades
for each row execute function public.fn_notificar_atividade_concluida();

-- Erros e conflitos de calendário, somente na transição para o problema.
create or replace function public.fn_notify_calendar_issue()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_recipient uuid;
begin
  if new.calendar_sync_status in ('error', 'conflict')
     and new.calendar_sync_status is distinct from old.calendar_sync_status then
    v_recipient := coalesce(new.responsavel_id, new.account_id);
    perform public.fn_emit_notification(
      'calendario_' || new.calendar_sync_status, new.organization_id, v_recipient,
      case when new.calendar_sync_status = 'conflict' then 'Conflito no calendário' else 'Falha ao sincronizar calendário' end,
      'Não foi possível sincronizar a atividade “' || new.nome || '”.',
      '/atividades?atividade=' || new.id, 'integracoes', 'alta',
      'atividade', new.id, null,
      'calendario:' || new.id || ':' || new.calendar_sync_status || ':' || extract(epoch from now())::bigint,
      jsonb_build_object('error', new.calendar_sync_error), new.account_id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_calendar_issue on public.atividades;
create trigger trg_notify_calendar_issue
after update of calendar_sync_status on public.atividades
for each row execute function public.fn_notify_calendar_issue();

-- Pesquisa de patrocinador concluída.
create or replace function public.fn_notify_company_research_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_nome text;
begin
  if new.status = 'concluida' and old.status is distinct from new.status then
    select nome into v_nome from public.empresas where id = new.empresa_id;
    perform public.fn_emit_notification(
      'pesquisa_concluida', new.organization_id, new.solicitante_id,
      'Pesquisa concluída',
      'Os dados de ' || coalesce(v_nome, 'uma empresa') || ' estão disponíveis.',
      '/patrocinadores/' || new.empresa_id, 'patrocinadores', 'alta',
      'empresa', new.empresa_id, null,
      'pesquisa_concluida:' || new.id || ':' || new.solicitante_id,
      '{}'::jsonb, new.solicitante_id
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_company_research_complete on public.solicitacoes_pesquisa_empresa;
create trigger trg_notify_company_research_complete
after update of status on public.solicitacoes_pesquisa_empresa
for each row execute function public.fn_notify_company_research_complete();

-- Primeira visualização de proposta. O destinatário é o dono da negociação;
-- quando não há negociação, usa o dono do projeto.
create or replace function public.fn_notify_proposal_first_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_proposta public.propostas%rowtype;
  v_recipient uuid;
begin
  select * into v_proposta from public.propostas where id = new.proposta_id;
  if not found then return new; end if;

  if v_proposta.captacao_id is not null then
    select coalesce(c.captador_id, c.account_id)
      into v_recipient from public.captacoes c where c.id = v_proposta.captacao_id;
  end if;
  if v_recipient is null then
    select p.account_id into v_recipient
    from public.projetos_crm p where p.id = v_proposta.projeto_id;
  end if;

  perform public.fn_emit_notification(
    'proposta_visualizada', v_proposta.organization_id, v_recipient,
    'Proposta visualizada',
    '“' || v_proposta.titulo || '” foi aberta pela primeira vez.',
    '/projetos/' || v_proposta.projeto_id, 'propostas', 'alta',
    'proposta', v_proposta.id, null,
    'proposta_primeira_visualizacao:' || v_proposta.id || ':' || v_recipient,
    jsonb_build_object('captacao_id', v_proposta.captacao_id), v_recipient
  );
  return new;
end;
$function$;

drop trigger if exists trg_notify_proposal_first_view on public.proposta_visualizacoes;
create trigger trg_notify_proposal_first_view
after insert on public.proposta_visualizacoes
for each row execute function public.fn_notify_proposal_first_view();

-- Decisão relevante da proposta. Mudanças feitas pelo próprio dono são
-- silenciosas; decisões externas ou de outro membro chegam ao responsável.
create or replace function public.fn_notify_proposal_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_recipient uuid;
begin
  if new.status not in ('aceita', 'recusada', 'expirada')
     or new.status is not distinct from old.status then
    return new;
  end if;

  if new.captacao_id is not null then
    select coalesce(c.captador_id, c.account_id)
      into v_recipient from public.captacoes c where c.id = new.captacao_id;
  end if;
  if v_recipient is null then
    select p.account_id into v_recipient
    from public.projetos_crm p where p.id = new.projeto_id;
  end if;

  if v_recipient is distinct from auth.uid() then
    perform public.fn_emit_notification(
      'proposta_' || new.status, new.organization_id, v_recipient,
      case new.status
        when 'aceita' then 'Proposta aceita'
        when 'recusada' then 'Proposta recusada'
        else 'Proposta expirada'
      end,
      '“' || new.titulo || '” foi ' ||
        case new.status when 'aceita' then 'aceita.' when 'recusada' then 'recusada.' else 'expirada.' end,
      '/projetos/' || new.projeto_id, 'propostas',
      case when new.status = 'aceita' then 'critica' else 'alta' end,
      'proposta', new.id, auth.uid(),
      'proposta_decisao:' || new.id || ':' || new.status || ':' || v_recipient,
      jsonb_build_object('captacao_id', new.captacao_id, 'status', new.status), v_recipient
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_notify_proposal_decision on public.propostas;
create trigger trg_notify_proposal_decision
after update of status on public.propostas
for each row execute function public.fn_notify_proposal_decision();

-- Geração diária idempotente de prazos. Pode ser chamada pelo Supabase Cron
-- com: select public.fn_dispatch_deadline_notifications();
create or replace function public.fn_dispatch_deadline_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  r record;
  v_days integer;
  v_count integer := 0;
begin
  for r in
    select id, organization_id, account_id, responsavel_id, nome, data_prevista
    from public.atividades
    where feita = false
      and data_prevista is not null
      and data_prevista::date - current_date in (7, 3, 1, 0, -1, -3, -7)
  loop
    v_days := r.data_prevista::date - current_date;
    perform public.fn_emit_notification(
      case when v_days < 0 then 'atividade_atrasada' when v_days = 0 then 'atividade_vence_hoje' else 'atividade_prazo' end,
      r.organization_id, coalesce(r.responsavel_id, r.account_id),
      case when v_days < 0 then 'Atividade atrasada' when v_days = 0 then 'Atividade vence hoje' else 'Atividade próxima do prazo' end,
      '“' || r.nome || '” ' || case when v_days < 0 then 'está atrasada há ' || abs(v_days) || ' dia(s).' when v_days = 0 then 'vence hoje.' else 'vence em ' || v_days || ' dias.' end,
      '/atividades?atividade=' || r.id, 'atividades',
      case when v_days <= 1 then 'critica' else 'alta' end,
      'atividade', r.id, null,
      'atividade_prazo:' || r.id || ':' || r.data_prevista::date || ':' || v_days,
      jsonb_build_object('days_remaining', v_days), r.account_id
    );
    v_count := v_count + 1;
  end loop;

  for r in
    select id, organization_id, account_id, titulo, data_fechamento
    from public.editais_user
    where data_fechamento is not null
      and status not in ('aprovado', 'reprovado', 'cancelado')
      and data_fechamento - current_date in (30, 14, 7, 3, 1, 0)
  loop
    v_days := r.data_fechamento - current_date;
    perform public.fn_emit_notification(
      'edital_prazo', r.organization_id, r.account_id,
      case when v_days = 0 then 'Inscrição encerra hoje' else 'Prazo de inscrição se aproximando' end,
      '“' || coalesce(r.titulo, 'Edital') || '” ' || case when v_days = 0 then 'encerra hoje.' else 'encerra em ' || v_days || ' dias.' end,
      '/editais-inscritos/' || r.id, 'editais',
      case when v_days <= 1 then 'critica' when v_days <= 7 then 'alta' else 'normal' end,
      'edital_user', r.id, null,
      'edital_prazo:' || r.id || ':' || r.data_fechamento || ':' || v_days,
      jsonb_build_object('days_remaining', v_days), r.account_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.fn_dispatch_deadline_notifications() from public, anon, authenticated;
grant execute on function public.fn_dispatch_deadline_notifications() to service_role;

-- Agenda a varredura às 08:00 de Brasília (11:00 UTC). Em ambientes sem
-- pg_cron a migration continua válida e a função pode ser agendada pelo painel.
do $schedule$
declare
  v_job record;
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    for v_job in execute 'select jobid from cron.job where jobname = ''jards-notification-deadlines'''
    loop
      execute format('select cron.unschedule(%s)', v_job.jobid);
    end loop;
    execute 'select cron.schedule(''jards-notification-deadlines'', ''0 11 * * *'', ''select public.fn_dispatch_deadline_notifications();'')';
  end if;
exception when insufficient_privilege or undefined_table or undefined_function then
  raise notice 'pg_cron indisponível; agende fn_dispatch_deadline_notifications manualmente.';
end
$schedule$;

-- Mantém as políticas próprias existentes e reforça a ausência de INSERT cliente.
revoke insert, delete, update on public.notificacoes from anon, authenticated;
grant select on public.notificacoes to authenticated;
grant update (lida, lida_em, arquivada_em, adiada_ate) on public.notificacoes to authenticated;

-- Inclui a tabela na publicação Realtime quando ainda não estiver presente.
do $realtime$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notificacoes'
     ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
exception when insufficient_privilege then
  raise notice 'Sem permissão para adicionar notificacoes ao Realtime; habilite no Dashboard.';
end
$realtime$;
