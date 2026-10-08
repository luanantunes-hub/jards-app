-- P5.5: o aviso de e-mail recusado leva à visão geral da prestação, onde fica
-- o cartão da captura com o botão de autorizar o remetente. O aviso de
-- despesas recebidas continua levando aos comprovantes.

drop function public.fn_prestacao_avisar_captura(uuid, text, text, text);

create function public.fn_prestacao_avisar_captura(p_prestacao_id uuid, p_titulo text, p_mensagem text, p_email_id text, p_recusado boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.prestacoes_contas%rowtype;
begin
  select * into p from public.prestacoes_contas where id = p_prestacao_id;
  if not found then return; end if;
  perform public.fn_emit_notification(
    'prestacao_captura_email', p.organization_id, public.prestacao_responsavel(p.id),
    p_titulo, left(p_mensagem, 240),
    '/prestacoes/' || p.id || case when p_recusado then '' else '/comprovantes' end,
    'prestacao', 'normal', 'prestacao', p.id, null,
    'prestacao_captura_email:' || p_email_id, '{}'::jsonb, null);
end;
$$;
revoke all on function public.fn_prestacao_avisar_captura(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fn_prestacao_avisar_captura(uuid, text, text, text, boolean) to service_role;
