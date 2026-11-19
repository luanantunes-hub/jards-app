-- Ticketeria: o ACEITE DOS TERMOS DE COMPRA. O comprador marca "Li e concordo com os Termos de compra" antes de gerar o Pix; o servidor exige o aceite da versão atual do texto
-- (lib/ticketeria/termos-de-compra.ts) e o pedido guarda QUAL versão foi aceita e QUANDO. Trocar o texto é trocar a versão: os pedidos antigos seguem com a versão que o comprador viu.
--   - `ticketeria_pedidos.termos_versao` e `termos_aceitos_em`;
--   - `fn_ticketeria_registrar_aceite(pedido, versao)`: grava uma vez só (o aceite de um pedido não muda depois). Só do servidor.
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_pedidos add column if not exists termos_versao text;
alter table public.ticketeria_pedidos add column if not exists termos_aceitos_em timestamptz;

create or replace function public.fn_ticketeria_registrar_aceite(p_pedido uuid, p_versao text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_versao is null or p_versao !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'versao_invalida' using errcode = 'check_violation';
  end if;
  update public.ticketeria_pedidos set termos_versao = p_versao, termos_aceitos_em = now()
  where id = p_pedido and termos_versao is null;
  if not found then
    if not exists (select 1 from public.ticketeria_pedidos where id = p_pedido) then
      raise exception 'pedido_inexistente' using errcode = 'check_violation';
    end if;
    -- Já havia aceite: não muda.
  end if;
end;
$$;

revoke execute on function public.fn_ticketeria_registrar_aceite(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_registrar_aceite(uuid, text) to service_role;
