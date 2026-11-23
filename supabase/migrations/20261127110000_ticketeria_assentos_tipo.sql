-- Ticketeria: o tipo de cada lugar do mapa (M2 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 4: acessibilidade).
--
-- `ticketeria_assentos.tipo`: comum (o padrão), cadeira_rodas, acompanhante, mobilidade_reduzida ou obeso. O lugar continua com a mesma identidade (setor, fileira,
-- número); o tipo é só uma marca, para o mapa do comprador mostrar (Decreto 9.404/2018, art. 23-B: os lugares de acessibilidade são identificados no mapa de venda) e para
-- o contador de referência do produtor. Não muda venda, preço, lotação nem reembolso. A regra de quem pode ocupar o lugar reservado (art. 23-A) NÃO está aqui.
--
-- Três funções trocam o corpo, COM A MESMA ASSINATURA (nenhuma sobrecarga: PGRST203):
--   - fn_ticketeria_salvar_mapa(uuid, jsonb, boolean): cada lugar do mapa aceita `tipo` (um dos cinco; outro valor é mapa_invalido). Lugar novo nasce com o tipo dito ou comum; lugar que
--     continua só muda de tipo quando o mapa traz `tipo` (o editor de hoje não manda: nada se apaga). O resto da função não mudou.
--   - fn_ticketeria_mapa_do_setor(uuid): cada lugar traz `tipo` quando não é comum (ausente = comum: o JSON de quem não tem tipo é o de antes).
--   - fn_ticketeria_mapa_da_sessao(uuid, uuid): o mesmo, no mapa do comprador. Parte da versão de produção (a das salas, com sala_id), não da do arquivo assentos_compra.
--
-- Expansão: coluna com padrão constante (sem reescrever a tabela) e troca de corpo de função. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_assentos add column if not exists tipo text not null default 'comum';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_assentos_tipo_check') then
    alter table public.ticketeria_assentos add constraint ticketeria_assentos_tipo_check
      check (tipo in ('comum', 'cadeira_rodas', 'acompanhante', 'mobilidade_reduzida', 'obeso'));
  end if;
end
$$;

comment on column public.ticketeria_assentos.tipo is 'Tipo do lugar: comum, cadeira_rodas, acompanhante, mobilidade_reduzida ou obeso. Só uma marca: não muda venda nem lotação.';

create or replace function public.fn_ticketeria_salvar_mapa(p_setor uuid, p_fileiras jsonb, p_corredor boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_setor record;
  v_fileira jsonb;
  v_assento jsonb;
  v_nome text;
  v_nomes text[] := '{}';
  v_numeros integer[];
  v_numero integer;
  v_total integer := 0;
  v_livres bigint;
  v_bloqueados bigint;
  v_evento uuid;
begin
  select s.id, s.organization_id, s.numerado, s.arquivado into v_setor from public.ticketeria_setores s where s.id = p_setor;
  if v_setor.id is null then
    raise exception 'setor_inexistente' using errcode = 'P0002';
  end if;
  if v_setor.arquivado then
    raise exception 'setor_arquivado' using errcode = 'check_violation';
  end if;
  if p_fileiras is null or jsonb_typeof(p_fileiras) <> 'array' or jsonb_array_length(p_fileiras) not between 1 and 60 then
    raise exception 'mapa_invalido' using errcode = 'check_violation';
  end if;
  for v_fileira in select * from jsonb_array_elements(p_fileiras) loop
    if jsonb_typeof(v_fileira) <> 'object' or jsonb_typeof(v_fileira -> 'assentos') is distinct from 'array' or jsonb_array_length(v_fileira -> 'assentos') not between 1 and 80 then
      raise exception 'mapa_invalido' using errcode = 'check_violation';
    end if;
    v_nome := upper(btrim(coalesce(v_fileira ->> 'nome', '')));
    if v_nome !~ '^[A-Z0-9]{1,4}$' or v_nome = any(v_nomes) then
      raise exception 'mapa_invalido' using errcode = 'check_violation';
    end if;
    v_nomes := v_nomes || v_nome;
    v_numeros := '{}';
    for v_assento in select * from jsonb_array_elements(v_fileira -> 'assentos') loop
      if jsonb_typeof(v_assento) <> 'object' or (v_assento ->> 'numero') !~ '^[0-9]{1,3}$' or jsonb_typeof(v_assento -> 'bloqueado') not in ('boolean', 'null')
         or jsonb_typeof(v_assento -> 'tipo') not in ('string', 'null')
         or (v_assento ->> 'tipo') not in ('comum', 'cadeira_rodas', 'acompanhante', 'mobilidade_reduzida', 'obeso') then
        raise exception 'mapa_invalido' using errcode = 'check_violation';
      end if;
      v_numero := (v_assento ->> 'numero')::integer;
      if v_numero not between 1 and 999 or v_numero = any(v_numeros) then
        raise exception 'mapa_invalido' using errcode = 'check_violation';
      end if;
      v_numeros := v_numeros || v_numero;
      v_total := v_total + 1;
    end loop;
  end loop;
  if v_total > 5000 then
    raise exception 'mapa_invalido' using errcode = 'check_violation';
  end if;

  -- Um setor que ainda não era numerado e já vendeu para uma sessão por vir: os ingressos vendidos não têm lugar.
  if not v_setor.numerado and exists (
    select 1 from public.ticketeria_pedido_itens pi
    join public.ticketeria_ingressos i on i.id = pi.ingresso_id
    join public.ticketeria_pedidos p on p.id = pi.pedido_id
    join public.ticketeria_sessoes s on s.id = p.sessao_id
    where i.setor_id = p_setor and s.inicio > now() and s.cancelada_em is null
      and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
  ) then
    raise exception 'setor_com_vendas' using errcode = 'check_violation';
  end if;
  -- Um lugar vendido para uma sessão por vir não sai do mapa nem se bloqueia.
  if public.fn_ticketeria_lugar_vendido_no_mapa(p_setor, p_fileiras) then
    raise exception 'lugar_vendido' using errcode = 'check_violation';
  end if;

  -- Os lugares que sumiram do mapa saem; os outros mantêm a identidade (e só mudam o bloqueio).
  delete from public.ticketeria_assentos a
  where a.setor_id = p_setor and not exists (
    select 1 from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
    where upper(btrim(f ->> 'nome')) = a.fileira and (x ->> 'numero')::integer = a.numero
  );
  insert into public.ticketeria_assentos (organization_id, setor_id, fileira, numero, bloqueado, tipo)
  select v_setor.organization_id, p_setor, upper(btrim(f ->> 'nome')), (x ->> 'numero')::integer, coalesce((x ->> 'bloqueado')::boolean, false), coalesce(x ->> 'tipo', 'comum')
  from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
  on conflict (setor_id, fileira, numero) do update set bloqueado = excluded.bloqueado;
  -- O tipo de um lugar que continua só muda quando o mapa diz o tipo (quem não manda `tipo`, como o editor de antes, não apaga o que está gravado).
  update public.ticketeria_assentos a set tipo = x ->> 'tipo'
  from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
  where a.setor_id = p_setor and a.fileira = upper(btrim(f ->> 'nome')) and a.numero = (x ->> 'numero')::integer
    and (x ->> 'tipo') is not null and a.tipo is distinct from (x ->> 'tipo');

  select count(*) filter (where not a.bloqueado), count(*) filter (where a.bloqueado) into v_livres, v_bloqueados from public.ticketeria_assentos a where a.setor_id = p_setor;
  if v_livres = 0 then
    raise exception 'mapa_sem_lugares' using errcode = 'check_violation';
  end if;

  update public.ticketeria_setores set numerado = true, corredor_no_meio = coalesce(p_corredor, true), lugares = v_livres::integer where id = p_setor;

  -- A oferta dos lotes de cada evento neste setor tem de caber nos lugares do mapa.
  for v_evento in select distinct i.evento_id from public.ticketeria_ingressos i where i.setor_id = p_setor and not i.arquivado loop
    perform public.fn_ticketeria_conferir_lugares(v_evento, p_setor);
  end loop;

  return jsonb_build_object('lugares', v_livres, 'bloqueados', v_bloqueados, 'fileiras', jsonb_array_length(p_fileiras));
end;
$$;

create or replace function public.fn_ticketeria_mapa_do_setor(p_setor uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by length(f.fileira), f.fileira), '[]'::jsonb)
  from (
    select a.fileira,
      jsonb_agg(jsonb_build_object('numero', a.numero, 'bloqueado', a.bloqueado) || case when a.tipo <> 'comum' then jsonb_build_object('tipo', a.tipo) else '{}'::jsonb end order by a.numero) as assentos
    from public.ticketeria_assentos a where a.setor_id = p_setor group by a.fileira
  ) f;
$$;

create or replace function public.fn_ticketeria_mapa_da_sessao(p_sessao uuid, p_ingresso uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_ingresso record;
begin
  select s.evento_id, s.local_id, s.sala_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.evento_id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    return null;
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, st.id as setor_id, st.nome as setor, st.numerado, st.corredor_no_meio, st.local_id, st.sala_id
    into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or v_ingresso.sala_id <> v_sessao.sala_id or not v_ingresso.publico or v_ingresso.arquivado or not v_ingresso.numerado then
    return null;
  end if;
  return jsonb_build_object('setor', v_ingresso.setor, 'corredor', v_ingresso.corredor_no_meio, 'fileiras', coalesce((
    select jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by length(f.fileira), f.fileira)
    from (
      select a.fileira,
        jsonb_agg(jsonb_build_object('numero', a.numero, 'estado', case when a.bloqueado or o.assento_id is not null then 'ocupado' else 'livre' end) || case when a.tipo <> 'comum' then jsonb_build_object('tipo', a.tipo) else '{}'::jsonb end order by a.numero) as assentos
      from public.ticketeria_assentos a
      left join (
        select pa.assento_id from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
        where pa.sessao_id = p_sessao and pa.assento_id is not null and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
      ) o on o.assento_id = a.id
      where a.setor_id = v_ingresso.setor_id
      group by a.fileira
    ) f
  ), '[]'::jsonb));
end;
$$;

-- Quem executa continua o mesmo de antes (create or replace já mantém os acessos; repetidos aqui para a migration dizer sozinha quem pode).
revoke execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) from public, anon;
revoke execute on function public.fn_ticketeria_mapa_do_setor(uuid) from public, anon;
revoke execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) to authenticated;
grant execute on function public.fn_ticketeria_mapa_do_setor(uuid) to authenticated;
grant execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) to service_role;
