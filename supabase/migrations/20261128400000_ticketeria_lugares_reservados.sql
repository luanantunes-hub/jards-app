-- Ticketeria: a venda dos lugares reservados de acessibilidade (art. 23-A do Decreto 5.296/2004, na redação do Decreto 9.404/2018; estudo ticketeria-mapa-de-assentos-avancado.md, seção 4.1).
--
-- Lugar reservado = lugar de um setor numerado com tipo cadeira_rodas, mobilidade_reduzida ou obeso (ticketeria_assentos.tipo). A regra (decidida pelo Luan em 23/11/2026):
--   - quem DECLARA que ele (ou quem acompanha) precisa do lugar pode comprá-lo a qualquer momento;
--   - quem não declara só compra depois que a reserva termina (24 horas antes da sessão; 72 horas se o espaço tem mais de 10.000 lugares) E com os demais lugares do setor esgotados nessa sessão.
-- Ficam para depois: a marca "é cinema" (meia hora) e o acompanhante comprado junto.
--
--   - `ticketeria_pedidos.declarou_acessibilidade` (boolean, padrão falso): a declaração do comprador, gravada no pedido. É dado que o produtor precisa para a porta e que a lei exige para
--     a regra funcionar; entra na guarda de 12 meses dos dados do pedido (D6).
--   - `fn_ticketeria_reserva_do_setor(sessao, setor, fora)`: função NOVA, só do servidor. Diz `{ termina_em, outros_livres, liberada }` para o setor nesta sessão. `fora` é um pedido cujos lugares
--     contam como livres (a conta da própria venda, que não pode se contar como "esgotou").
--   - `fn_ticketeria_reservar_com_declaracao(...)`: função NOVA (outro nome, nenhum parâmetro novo em função publicada: PGRST203). Reserva pela cadeia de sempre (`fn_ticketeria_reservar_com_lugares`)
--     e, sem a declaração, recusa (`lugar_reservado`) o pedido que leva lugar reservado antes da hora; tudo na mesma transação, então a recusa desfaz a reserva.
--
-- Nenhuma função existente muda. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_pedidos add column if not exists declarou_acessibilidade boolean not null default false;

comment on column public.ticketeria_pedidos.declarou_acessibilidade is 'O comprador declarou que ele, ou quem acompanha, precisa de lugar para cadeira de rodas ou com mobilidade reduzida (libera os lugares reservados de acessibilidade).';

-- O setor, nesta sessão: quando a reserva termina, quantos lugares que NÃO são reservados ainda estão livres e se os reservados já podem ser vendidos a quem não declarou.
create or replace function public.fn_ticketeria_reserva_do_setor(p_sessao uuid, p_setor uuid, p_fora uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_capacidade bigint;
  v_termina timestamptz;
  v_outros bigint;
begin
  select s.id, s.inicio, s.sala_id into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.id is null then
    return null;
  end if;
  -- A capacidade do espaço: os lugares de todos os setores da sala da sessão.
  select coalesce(sum(st.lugares), 0) into v_capacidade from public.ticketeria_setores st where st.sala_id = v_sessao.sala_id and not st.arquivado;
  v_termina := v_sessao.inicio - make_interval(hours => case when v_capacidade > 10000 then 72 else 24 end);
  select count(*) into v_outros
  from public.ticketeria_assentos a
  where a.setor_id = p_setor and not a.bloqueado and a.tipo not in ('cadeira_rodas', 'mobilidade_reduzida', 'obeso')
    and not exists (
      select 1 from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
      where pa.assento_id = a.id and pa.sessao_id = p_sessao and p.id is distinct from p_fora
        and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
    );
  return jsonb_build_object('termina_em', v_termina, 'outros_livres', v_outros, 'liberada', now() >= v_termina and v_outros = 0);
end;
$$;

create or replace function public.fn_ticketeria_reservar_com_declaracao(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer, p_codigo text, p_lugares jsonb, p_declarou boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reserva jsonb;
  v_pedido uuid;
  v_setor uuid;
begin
  v_reserva := public.fn_ticketeria_reservar_com_lugares(p_sessao, p_itens, p_nome, p_email, p_minutos, p_codigo, p_lugares);
  v_pedido := (v_reserva ->> 'pedido_id')::uuid;
  if coalesce(p_declarou, false) then
    update public.ticketeria_pedidos set declarou_acessibilidade = true where id = v_pedido;
  else
    -- Sem declaração: cada setor de que o pedido leva um lugar reservado tem que já estar liberado (a própria venda não conta como "esgotou").
    for v_setor in
      select distinct a.setor_id
      from public.ticketeria_pedido_assentos pa join public.ticketeria_assentos a on a.id = pa.assento_id
      where pa.pedido_id = v_pedido and a.tipo in ('cadeira_rodas', 'mobilidade_reduzida', 'obeso')
    loop
      if not coalesce((public.fn_ticketeria_reserva_do_setor(p_sessao, v_setor, v_pedido) ->> 'liberada')::boolean, false) then
        raise exception 'lugar_reservado' using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  return v_reserva || jsonb_build_object('declarou_acessibilidade', coalesce(p_declarou, false));
end;
$$;

revoke execute on function public.fn_ticketeria_reserva_do_setor(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reservar_com_declaracao(uuid, jsonb, text, text, integer, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reserva_do_setor(uuid, uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_reservar_com_declaracao(uuid, jsonb, text, text, integer, text, jsonb, boolean) to service_role;
