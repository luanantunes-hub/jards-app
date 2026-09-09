-- Fase 2: estado de push para Google Calendar / Microsoft Outlook.
--
-- Esta migration não aponta para um projeto específico. Depois do deploy da
-- Edge Function, configure os dois settings (instruções no README da function)
-- e o trigger passará a enfileirar os requests via pg_net.

-- Alguns bancos legados ainda não receberam a migration 007 de atividades.
-- A Fase 2 também precisa dessa coluna para decidir o dono do calendário.
alter table atividades
  add column if not exists responsavel_id uuid references profiles(id);

create index if not exists idx_atividades_responsavel
  on atividades(responsavel_id);

alter table atividades
  add column if not exists calendar_sync_requested boolean not null default false;

create index if not exists idx_atividades_calendar_sync_requested
  on atividades(calendar_sync_requested)
  where calendar_sync_requested = true;

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_calendar_sync_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  endpoint text := current_setting('app.settings.calendar_sync_push_url', true);
  webhook_secret text := current_setting('app.settings.calendar_sync_webhook_secret', true);
  payload jsonb;
begin
  -- Permite aplicar a migration antes de a Edge Function ser publicada.
  if endpoint is null or endpoint = '' or webhook_secret is null or webhook_secret = '' then
    return coalesce(new, old);
  end if;

  payload := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
  );

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-calendar-sync-secret', webhook_secret
    ),
    body := payload,
    timeout_milliseconds := 8000
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_calendar_sync_push on atividades;
create trigger trg_calendar_sync_push
after insert or delete or update of
  nome, nota, tipo, data_inicio, data_prevista, feita,
  responsavel_id, account_id, calendar_sync_requested
on atividades
for each row execute function public.dispatch_calendar_sync_push();
