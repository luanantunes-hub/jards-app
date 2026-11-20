-- Ticketeria: TENTAR DE NOVO um reembolso por e-mail que falhou (passo D, complemento). O Asaas pode recusar o estorno (sem saldo, por exemplo) e o pedido de reembolso fica na fila como
-- `falhou`. `fn_ticketeria_reembolso_reabrir(reembolso, loja)` o devolve a `recebido` (e devolve o e-mail original) para a mesma lógica decidir de novo: o prazo de 7 dias vale a
-- partir da hora em que o e-mail CHEGOU, então reabrir não estende o prazo. Só reabre o que está `falhou` e é de um pedido da loja. Só do servidor. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_reembolso_reabrir(p_reembolso uuid, p_loja uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r public.ticketeria_reembolsos%rowtype;
begin
  select r.* into v_r
  from public.ticketeria_reembolsos r join public.ticketeria_pedidos p on p.id = r.pedido_id
  where r.id = p_reembolso and p.loja_id = p_loja and r.situacao = 'falhou'
  for update of r;
  if not found then
    raise exception 'reembolso_nao_reabrivel' using errcode = 'check_violation';
  end if;
  update public.ticketeria_reembolsos set situacao = 'recebido', motivo = null, updated_at = now() where id = v_r.id;
  return jsonb_build_object('email_id', v_r.email_id, 'remetente', v_r.remetente, 'assunto', v_r.assunto, 'recebido_em', v_r.recebido_em);
end;
$$;

revoke execute on function public.fn_ticketeria_reembolso_reabrir(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reembolso_reabrir(uuid, uuid) to service_role;
