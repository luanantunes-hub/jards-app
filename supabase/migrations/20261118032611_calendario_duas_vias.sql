-- Agenda nos dois sentidos.
--  Jards -> agenda: o gatilho que avisa a cada mudança numa atividade passa a ler o endereço e a senha do cofre (vault) e chamar a rota /api/calendar/push do próprio app
--                   (a função Deno calendar-sync-push nunca foi publicada). Atividade que nasceu na agenda não é reenviada.
--  Agenda -> Jards: a cada 10 minutos o banco chama /api/calendar/importar, que traz as reuniões das agendas conectadas para as atividades.
-- Segredos no cofre: calendar_sync_push_url, calendar_importar_url e calendar_sync_webhook_secret. Sem eles as funções não fazem nada, então aplicar esta migration não liga nada sozinha.

-- Uma mesma reunião da agenda nunca vira duas atividades para a mesma pessoa, mesmo se duas rodadas se cruzarem.
create unique index if not exists uq_atividades_evento_google
  on public.atividades (responsavel_id, google_event_id) where sync_origin = 'google' and google_event_id is not null;
create unique index if not exists uq_atividades_evento_microsoft
  on public.atividades (responsavel_id, microsoft_event_id) where sync_origin = 'microsoft' and microsoft_event_id is not null;

create or replace function public.dispatch_calendar_sync_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
  v_linha jsonb;
begin
  v_linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  -- veio da agenda (importada): o evento já existe lá, não há o que enviar
  if coalesce(v_linha ->> 'sync_origin', '') in ('google', 'microsoft') then
    return coalesce(new, old);
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'calendar_sync_push_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'calendar_sync_webhook_secret';
  -- compatibilidade com a configuração antiga, por parâmetros do banco
  v_url := coalesce(nullif(v_url, ''), nullif(current_setting('app.settings.calendar_sync_push_url', true), ''));
  v_segredo := coalesce(nullif(v_segredo, ''), nullif(current_setting('app.settings.calendar_sync_webhook_secret', true), ''));
  if v_url is null or v_segredo is null then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-calendar-sync-secret', v_segredo),
    body := jsonb_build_object(
      'type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
      'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
      'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
    ),
    timeout_milliseconds := 20000
  );
  return coalesce(new, old);
end;
$$;

-- Reunião importada da agenda não deve avisar "Nova atividade para você": a pessoa já a conhece, é a agenda dela.
create or replace function public.fn_notify_activity_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.responsavel_id is not null
     and coalesce(new.sync_origin, '') not in ('google', 'microsoft')
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
$$;

create or replace function public.fn_calendario_importar_disparar()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'calendar_importar_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'calendar_sync_webhook_secret';
  if v_url is null or v_url = '' or v_segredo is null or v_segredo = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-calendar-sync-secret', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.fn_calendario_importar_disparar() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-calendario-importar', '*/10 * * * *', 'select public.fn_calendario_importar_disparar();');
  end if;
end;
$$;
