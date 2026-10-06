-- Envio da prestação só sem bloqueio aberto nas verificações (P2.7 a P2.10).
--
-- fn_prestacao_mudar_status passa a recusar a ida para "enviado" quando a
-- prestação nunca foi verificada (verificacao_pendente) ou quando há
-- verificação de severidade bloqueio ainda aberta (bloqueios_abertos, com a
-- quantidade no detalhe). O bloqueio sai quando o problema é resolvido (a
-- verificação seguinte o fecha) ou quando o revisor o dispensa, com o motivo.
-- As demais transições não mudam. A conferência vem depois da transição e do
-- papel: quem não pode enviar recebe sem_permissao, não a lista de bloqueios.
-- Idempotente; sem DROP.

create or replace function public.fn_prestacao_mudar_status(
  p_prestacao_id uuid, p_novo_status public.status_prestacao, p_comentario text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  atual public.status_prestacao;
  verificada timestamptz;
  acao text;
  bloqueios integer;
  registro uuid;
begin
  if auth.uid() is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;

  select status, verificada_em into atual, verificada from public.prestacoes_contas where id = p_prestacao_id for update;
  if not found or not (public.is_jards_super_admin() or public.can_access_prestacao(p_prestacao_id)) then
    raise exception 'prestacao_inexistente' using errcode = 'P0002';
  end if;

  acao := public.prestacao_transicao(atual, p_novo_status);
  if acao is null then
    raise exception 'transicao_invalida' using errcode = 'P0001';
  end if;
  if not public.auth_prestacao_pode(p_prestacao_id, acao) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  if p_novo_status = 'enviado' then
    if verificada is null then
      raise exception 'verificacao_pendente' using errcode = 'P0001';
    end if;
    select count(*) into bloqueios
      from public.prestacao_verificacoes
     where prestacao_id = p_prestacao_id and status = 'aberta' and severidade = 'bloqueio';
    if bloqueios > 0 then
      raise exception 'bloqueios_abertos' using errcode = 'P0001', detail = bloqueios::text;
    end if;
  end if;

  update public.prestacoes_contas set status = p_novo_status where id = p_prestacao_id;
  insert into public.prestacao_status_log (prestacao_id, status_anterior, status_novo, usuario_id, comentario)
  values (p_prestacao_id, atual, p_novo_status, auth.uid(), left(nullif(trim(p_comentario), ''), 2000))
  returning id into registro;
  return registro;
end;
$$;
revoke execute on function public.fn_prestacao_mudar_status(uuid, public.status_prestacao, text) from public, anon;
grant execute on function public.fn_prestacao_mudar_status(uuid, public.status_prestacao, text) to authenticated, service_role;
