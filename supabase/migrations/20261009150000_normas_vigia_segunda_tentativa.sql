-- P1.10: segunda tentativa diária do vigia normativo.
--
-- O INLABS às vezes recusa conexões (502, conexão encerrada). A coleta das
-- 8h07 continua; às 11h07 a rotina roda de novo com {"ultima": true}: a
-- função não refaz o dia já lido e, se falhar outra vez, avisa o super admin.

drop function if exists public.fn_agente_normativo_disparar();

create function public.fn_agente_normativo_disparar(p_ultima boolean default false)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'agente_normativo_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'agente_normativo_segredo';
  if coalesce(v_url, '') = '' or coalesce(v_segredo, '') = '' then
    raise notice 'agente normativo sem endereço ou segredo no cofre';
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-agente-segredo', v_segredo),
    body := jsonb_build_object('ultima', p_ultima),
    timeout_milliseconds := 150000);
end;
$$;
revoke all on function public.fn_agente_normativo_disparar(boolean) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'jards-agente-normativo') then
      perform cron.unschedule('jards-agente-normativo');
    end if;
    if exists (select 1 from cron.job where jobname = 'jards-agente-normativo-repeticao') then
      perform cron.unschedule('jards-agente-normativo-repeticao');
    end if;
    -- 8h07 e 11h07 em Brasília.
    perform cron.schedule('jards-agente-normativo', '7 11 * * *', 'select public.fn_agente_normativo_disparar(false);');
    perform cron.schedule('jards-agente-normativo-repeticao', '7 14 * * *', 'select public.fn_agente_normativo_disparar(true);');
  end if;
end
$$;
