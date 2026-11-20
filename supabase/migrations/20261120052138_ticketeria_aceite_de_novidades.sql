-- Ticketeria: o ACEITE DE NOVIDADES na compra (primeira fatia do "Público"). O comprador pode marcar "Quero receber novidades e ofertas deste produtor" (desmarcado de início, à parte dos
-- Termos de compra) e, se quiser, informar o WhatsApp. O pedido guarda QUE aceitou, QUANDO e QUAL versão do texto (lib/ticketeria/novidades.ts); sem a marca, nada é guardado.
--   - `ticketeria_pedidos.novidades_versao`, `novidades_aceitas_em` e `comprador_whatsapp` (só dígitos, com o 55: 55 + DDD + número);
--   - `fn_ticketeria_registrar_novidades(pedido, versão, whatsapp)`: grava uma vez só (o aceite de um pedido não muda depois); número fora do formato é ignorado, não recusa o aceite. Só do servidor.
-- Aditiva e reaplicável; sem DROP. Falhar aqui nunca derruba uma compra (o servidor trata o registro como melhor esforço).

set local lock_timeout = '10s';

alter table public.ticketeria_pedidos add column if not exists novidades_versao text;
alter table public.ticketeria_pedidos add column if not exists novidades_aceitas_em timestamptz;
alter table public.ticketeria_pedidos add column if not exists comprador_whatsapp text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_comprador_whatsapp_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_comprador_whatsapp_check check (comprador_whatsapp is null or comprador_whatsapp ~ '^55[0-9]{10,11}$');
  end if;
end
$$;

create or replace function public.fn_ticketeria_registrar_novidades(p_pedido uuid, p_versao text, p_whatsapp text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_whatsapp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g'), '');
begin
  if p_versao is null or p_versao !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'versao_invalida' using errcode = 'check_violation';
  end if;
  if v_whatsapp is not null and v_whatsapp !~ '^55[0-9]{10,11}$' then
    v_whatsapp := null;
  end if;
  update public.ticketeria_pedidos
     set novidades_versao = p_versao, novidades_aceitas_em = now(), comprador_whatsapp = v_whatsapp
   where id = p_pedido and novidades_aceitas_em is null;
  if not found then
    if not exists (select 1 from public.ticketeria_pedidos where id = p_pedido) then
      raise exception 'pedido_inexistente' using errcode = 'check_violation';
    end if;
    -- Já havia aceite: não muda.
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_registrar_novidades(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_registrar_novidades(uuid, text, text) to service_role;
