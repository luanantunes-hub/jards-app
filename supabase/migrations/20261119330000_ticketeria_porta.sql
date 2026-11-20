-- Ticketeria: a PORTA (passo C5 da T5): conferir os ingressos na entrada do evento. O ingresso emitido já tem `usado_em`; aqui entram quem o usou, a função que confere e marca
-- de uma vez só (dois celulares lendo o mesmo QR Code não deixam entrar duas vezes) e o resumo da sessão (quantos já entraram e as últimas entradas).
--
-- O que entra:
--   - `ticketeria_ingressos_emitidos.usado_por`: quem leu o ingresso na porta;
--   - `fn_ticketeria_conferir_ingresso(loja, sessao, codigo, usuario)`: trava o ingresso, confere e, estando tudo certo, marca como usado. Responde um de cinco resultados:
--     `pode_entrar`, `ja_usado` (com a hora), `outra_sessao` (com o dia da sessão do ingresso), `cancelado` (compra reembolsada) ou `nao_encontrado`. Ingresso de OUTRA loja
--     responde `nao_encontrado` (nunca mostra nome nem sessão de outra organização). A sessão precisa ser da loja (senão, erro);
--   - `fn_ticketeria_porta_resumo(loja, sessao)`: quantos ingressos válidos a sessão tem, quantos já entraram e as 10 últimas entradas (hora no fuso do local).
-- Só do servidor (a rota confere quem edita a Ticketeria da loja). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_ingressos_emitidos add column if not exists usado_por uuid;

create index if not exists ticketeria_ingressos_emitidos_usados_idx on public.ticketeria_ingressos_emitidos (sessao_id, usado_em desc) where usado_em is not null;

create or replace function public.fn_ticketeria_conferir_ingresso(p_loja uuid, p_sessao uuid, p_codigo text, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_sessao record;
  v_ing public.ticketeria_ingressos_emitidos%rowtype;
  v_ped record;
  v_fuso text;
  v_outra record;
  v_restantes bigint;
begin
  select s.id, s.local_id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  v_fuso := v_sessao.fuso;

  select * into v_ing from public.ticketeria_ingressos_emitidos where codigo = v_codigo for update;
  -- Sem ingresso, ou de outra loja: igual (nunca mostra nada de outra organização).
  if v_ing.id is null or (select e.loja_id from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id where s.id = v_ing.sessao_id) <> p_loja then
    return jsonb_build_object('tipo', 'nao_encontrado', 'codigo', v_codigo);
  end if;
  select comprador_nome into v_ped from public.ticketeria_pedidos where id = v_ing.pedido_id;
  if v_ing.cancelado_em is not null then
    return jsonb_build_object('tipo', 'cancelado', 'codigo', v_codigo, 'ingresso', v_ing.nome);
  end if;
  if v_ing.sessao_id <> p_sessao then
    select e.titulo, s.inicio, l.fuso into v_outra
    from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id where s.id = v_ing.sessao_id;
    return jsonb_build_object('tipo', 'outra_sessao', 'codigo', v_codigo, 'ingresso', v_ing.nome, 'evento', v_outra.titulo, 'sessao_inicio', v_outra.inicio, 'sessao_fuso', v_outra.fuso);
  end if;
  if v_ing.usado_em is not null then
    return jsonb_build_object('tipo', 'ja_usado', 'codigo', v_codigo, 'ingresso', v_ing.nome, 'comprador', v_ped.comprador_nome, 'usado_em', v_ing.usado_em, 'fuso', v_fuso);
  end if;
  update public.ticketeria_ingressos_emitidos set usado_em = now(), usado_por = p_usuario where id = v_ing.id;
  select count(*) into v_restantes from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null and usado_em is null;
  return jsonb_build_object('tipo', 'pode_entrar', 'codigo', v_codigo, 'ingresso', v_ing.nome, 'comprador', v_ped.comprador_nome, 'restantes', v_restantes);
end;
$$;

create or replace function public.fn_ticketeria_porta_resumo(p_loja uuid, p_sessao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
begin
  select s.id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  return jsonb_build_object(
    'validos', (select count(*) from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null),
    'entraram', (select count(*) from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null and usado_em is not null),
    'recentes', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'ingresso', x.nome, 'comprador', x.comprador_nome, 'usado_em', x.usado_em) order by x.usado_em desc)
      from (
        select i.codigo, i.nome, p.comprador_nome, i.usado_em
        from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id
        where i.sessao_id = p_sessao and i.usado_em is not null and i.cancelado_em is null
        order by i.usado_em desc limit 10
      ) x
    ), '[]'::jsonb),
    'fuso', v_sessao.fuso
  );
end;
$$;

revoke execute on function public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_resumo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_resumo(uuid, uuid) to service_role;
