-- Ticketeria: a FILA dos envios de e-mail (para passar de 300 pessoas). O envio cria todas as pessoas como "pendente" e a fila as manda em lotes: cada rodada "reivindica" um lote (marca
-- como "enviando", com a hora), manda, e marca cada pessoa como enviada ou falhada. Duas rodadas ao mesmo tempo (a que nasce junto com o envio e a do cron) nunca pegam a mesma pessoa; quem
-- ficou "enviando" por mais de 5 minutos (a rodada caiu no meio) volta para a fila.
--   - `ticketeria_envio_destinatarios`: a coluna `reivindicado_em` e o estado "enviando" na regra da situação (troca a regra `ticketeria_envio_destinatarios_situacao_check`, sem apagar dado);
--   - `fn_ticketeria_reivindicar_destinatarios(envio, n)`: reivindica até `n` pessoas e as devolve (id, e-mail, nome, token);
--   - `fn_ticketeria_marcar_destinatarios(itens)`: marca várias de uma vez como enviada (com o id do e-mail no Resend) ou falhada;
--   - `fn_ticketeria_atualizar_envio(envio)`: refaz as contagens do envio (enviados e falhas), conclui quando não sobra ninguém e devolve quantas faltam.
-- Só do servidor. Aditiva (a troca da regra não apaga dado) e reaplicável.

set local lock_timeout = '10s';

alter table public.ticketeria_envio_destinatarios add column if not exists reivindicado_em timestamptz;

alter table public.ticketeria_envio_destinatarios drop constraint if exists ticketeria_envio_destinatarios_situacao_check;
alter table public.ticketeria_envio_destinatarios add constraint ticketeria_envio_destinatarios_situacao_check check (situacao in ('pendente', 'enviando', 'enviado', 'falhou'));

create index if not exists ticketeria_envio_destinatarios_fila_idx on public.ticketeria_envio_destinatarios (envio_id, situacao);

create or replace function public.fn_ticketeria_reivindicar_destinatarios(p_envio uuid, p_n integer)
returns table (id uuid, email text, nome text, token uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_n is null or p_n < 1 or p_n > 200 then
    raise exception 'quantidade_invalida' using errcode = 'check_violation';
  end if;
  return query
  update public.ticketeria_envio_destinatarios d
     set situacao = 'enviando', reivindicado_em = now()
   where d.id in (
     select x.id from public.ticketeria_envio_destinatarios x
      where x.envio_id = p_envio and (x.situacao = 'pendente' or (x.situacao = 'enviando' and x.reivindicado_em < now() - interval '5 minutes'))
      order by x.created_at, x.id
      limit p_n
      for update skip locked)
  returning d.id, d.email, d.nome, d.token;
end;
$$;

create or replace function public.fn_ticketeria_marcar_destinatarios(p_itens jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) > 500 then
    raise exception 'itens_invalidos' using errcode = 'check_violation';
  end if;
  update public.ticketeria_envio_destinatarios d
     set situacao = case when x.ok then 'enviado' else 'falhou' end,
         provedor_id = case when x.ok then left(x.provedor_id, 100) else d.provedor_id end,
         enviado_em = case when x.ok then now() else null end
    from jsonb_to_recordset(p_itens) as x(id uuid, ok boolean, provedor_id text)
   where d.id = x.id and d.situacao = 'enviando';
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

create or replace function public.fn_ticketeria_atualizar_envio(p_envio uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enviados integer;
  v_falhas integer;
  v_restantes integer;
begin
  select count(*) filter (where situacao = 'enviado'), count(*) filter (where situacao = 'falhou'), count(*) filter (where situacao in ('pendente', 'enviando'))
    into v_enviados, v_falhas, v_restantes
    from public.ticketeria_envio_destinatarios where envio_id = p_envio;
  update public.ticketeria_envios
     set enviados = v_enviados, falhas = v_falhas,
         situacao = case when v_restantes > 0 then 'enviando' when v_enviados = 0 and v_falhas > 0 then 'falhou' else 'enviado' end,
         enviado_em = case when v_restantes > 0 then enviado_em else coalesce(enviado_em, now()) end
   where id = p_envio;
  return v_restantes;
end;
$$;

revoke execute on function public.fn_ticketeria_reivindicar_destinatarios(uuid, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_marcar_destinatarios(jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_atualizar_envio(uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reivindicar_destinatarios(uuid, integer) to service_role;
grant execute on function public.fn_ticketeria_marcar_destinatarios(jsonb) to service_role;
grant execute on function public.fn_ticketeria_atualizar_envio(uuid) to service_role;
