-- Ticketeria: a ORIGEM DAS VENDAS (primeira fatia do painel "Divulgação"). O link de divulgação que o produtor cola no Instagram, no WhatsApp ou num e-mail leva o nome do canal
-- (`?canal=instagram&acao=stories-do-lote-2`, mais as utm_* se houver); a página de compra manda isso junto com a compra e o pedido GUARDA de onde veio.
--   - `ticketeria_pedidos.origem_canal` (o canal, em letras minúsculas, números, "-" e "_", até 30), `origem_acao` (o nome da ação, até 60), `origem_referencia`
--     (o domínio de onde a pessoa chegou, quando o navegador informa) e `origem_utm` (só as cinco utm_* com valor de até 100 letras);
--   - `fn_ticketeria_registrar_origem(pedido, canal, ação, referência, utm)`: limpa o que chegou, grava uma vez só (a origem de um pedido não muda depois) e ignora o que vier
--     vazio. Só do servidor.
-- Só rótulos de campanha: nenhum dado pessoal, nada guardado no navegador. Falhar aqui nunca derruba uma compra (o servidor trata o registro como melhor esforço).
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_pedidos add column if not exists origem_canal text;
alter table public.ticketeria_pedidos add column if not exists origem_acao text;
alter table public.ticketeria_pedidos add column if not exists origem_referencia text;
alter table public.ticketeria_pedidos add column if not exists origem_utm jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_origem_canal_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_origem_canal_check check (origem_canal is null or origem_canal ~ '^[a-z0-9_-]{1,30}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_origem_acao_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_origem_acao_check check (origem_acao is null or origem_acao ~ '^[a-z0-9_-]{1,60}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_origem_referencia_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_origem_referencia_check check (origem_referencia is null or origem_referencia ~ '^[a-z0-9.-]{1,100}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_origem_utm_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_origem_utm_check check (origem_utm is null or jsonb_typeof(origem_utm) = 'object');
  end if;
end
$$;

create or replace function public.fn_ticketeria_registrar_origem(p_pedido uuid, p_canal text, p_acao text, p_referencia text, p_utm jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_canal text := nullif(left(regexp_replace(lower(coalesce(p_canal, '')), '[^a-z0-9_-]', '', 'g'), 30), '');
  v_acao text := nullif(left(regexp_replace(lower(coalesce(p_acao, '')), '[^a-z0-9_-]', '', 'g'), 60), '');
  v_referencia text := nullif(left(regexp_replace(lower(coalesce(p_referencia, '')), '[^a-z0-9.-]', '', 'g'), 100), '');
  v_utm jsonb;
begin
  if p_utm is not null and jsonb_typeof(p_utm) = 'object' then
    select nullif(coalesce(jsonb_object_agg(k.key, left(regexp_replace(k.value, '[[:cntrl:]]', '', 'g'), 100)), '{}'::jsonb), '{}'::jsonb) into v_utm
    from jsonb_each_text(p_utm) as k
    where k.key in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content') and btrim(coalesce(k.value, '')) <> '';
  end if;
  if v_canal is null and v_acao is null and v_referencia is null and v_utm is null then
    return;
  end if;
  update public.ticketeria_pedidos
     set origem_canal = v_canal, origem_acao = v_acao, origem_referencia = v_referencia, origem_utm = v_utm
   where id = p_pedido and origem_canal is null and origem_acao is null and origem_referencia is null and origem_utm is null;
  if not found then
    if not exists (select 1 from public.ticketeria_pedidos where id = p_pedido) then
      raise exception 'pedido_inexistente' using errcode = 'check_violation';
    end if;
    -- Já havia origem: não muda.
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_registrar_origem(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_registrar_origem(uuid, text, text, text, jsonb) to service_role;
