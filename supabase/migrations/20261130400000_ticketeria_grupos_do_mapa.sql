-- Ticketeria: mesas e camarotes no mapa (fatia 5 do plano do editor do mapa; estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.2 item 7).
--
-- Uma mesa ou um camarote é uma FILEIRA com forma (um bloco do desenho com `grupo` = { forma: mesa|camarote, inteiro, colunas }): os lugares continuam com a identidade de sempre (setor, fileira,
-- número) e cada pessoa recebe o seu ingresso e o seu QR; o preço segue por lugar. A novidade do banco é a regra "vende inteiro": um grupo marcado assim só se compra completo, num pedido só.
--
--   - `ticketeria_assentos.venda_em_grupo` (boolean, padrão falso): verdadeiro nos lugares de uma fileira que é mesa ou camarote que vende inteiro. NINGUÉM grava à mão: o gatilho
--     `ticketeria_setores_layout_grupos` (depois de mudar `ticketeria_setores.layout`) recalcula a marca dos lugares do setor a partir do layout; layout nulo desliga todas.
--   - `fn_ticketeria_layout_ok(jsonb)`: corpo trocado, MESMA assinatura. Passa a conferir o `grupo` do bloco (ver acima), além do que já conferia. Parte da versão de produção.
--   - `fn_ticketeria_reservar_com_lugares(...)`: corpo trocado, MESMA assinatura. Antes de reservar, se algum lugar escolhido tem `venda_em_grupo`, o pedido tem de levar todos os lugares da fileira dele:
--     senão `grupo_incompleto`. Vale também para a `fn_ticketeria_reservar_com_declaracao`, que passa por ela. Parte da versão de produção.
--   - `fn_ticketeria_mapa_da_sessao(uuid, uuid)`: corpo trocado, MESMA assinatura. Num grupo que vende inteiro, se UM lugar está tomado ou bloqueado, todos os lugares do grupo aparecem como ocupados. O JSON
--     do resto não muda. Parte da versão de produção (a de 20261123162106_ticketeria_planta_areas.sql).
--
-- Expansão: coluna com padrão, gatilho novo e troca de corpo de três funções. Aditiva e reaplicável; sem DROP. Quem já tem mapa não muda: nenhum layout tem grupo ainda.

set local lock_timeout = '10s';

alter table public.ticketeria_assentos add column if not exists venda_em_grupo boolean not null default false;

comment on column public.ticketeria_assentos.venda_em_grupo is 'O lugar é de uma mesa ou de um camarote que só se vende inteiro (todos os lugares da fileira, num pedido só). Recalculado pelo gatilho do layout do setor; ninguém grava à mão.';

-- ─── A marca vem do layout ──────────────────────────────────────────────────

create or replace function public.fn_ticketeria_setor_layout_grupos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticketeria_assentos a
     set venda_em_grupo = coalesce(exists (
       select 1 from jsonb_array_elements(coalesce(new.layout -> 'blocos', '[]'::jsonb)) b
       where (b -> 'grupo' ->> 'inteiro') = 'true' and (b -> 'fileiras' -> 0 ->> 'nome') = a.fileira
     ), false)
   where a.setor_id = new.id
     and a.venda_em_grupo is distinct from coalesce(exists (
       select 1 from jsonb_array_elements(coalesce(new.layout -> 'blocos', '[]'::jsonb)) b
       where (b -> 'grupo' ->> 'inteiro') = 'true' and (b -> 'fileiras' -> 0 ->> 'nome') = a.fileira
     ), false);
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'ticketeria_setores_layout_grupos' and tgrelid = 'public.ticketeria_setores'::regclass) then
    create trigger ticketeria_setores_layout_grupos after update of layout on public.ticketeria_setores
      for each row execute function public.fn_ticketeria_setor_layout_grupos();
  end if;
end
$$;

-- ─── As funções ─────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_layout_ok(p_layout jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_bloco jsonb;
  v_fileira jsonb;
  v_palco jsonb;
  v_primeiro integer;
  v_lugares integer;
  v_total integer := 0;
begin
  if p_layout is null then
    return true;
  end if;
  if jsonb_typeof(p_layout) <> 'object' or p_layout -> 'versao' is distinct from '1'::jsonb or octet_length(p_layout::text) > 200000 then
    return false;
  end if;
  if jsonb_typeof(p_layout -> 'blocos') is distinct from 'array' or jsonb_array_length(p_layout -> 'blocos') not between 1 and 30 then
    return false;
  end if;
  v_palco := p_layout -> 'palco';
  if v_palco is not null and jsonb_typeof(v_palco) <> 'null' then
    if jsonb_typeof(v_palco) <> 'object'
       or not public.fn_ticketeria_layout_numero(v_palco -> 'x', -1000, 1000)
       or not public.fn_ticketeria_layout_numero(v_palco -> 'y', -1000, 1000)
       or not public.fn_ticketeria_layout_numero(v_palco -> 'largura', 1, 1000)
       or not public.fn_ticketeria_layout_numero(v_palco -> 'altura', 0.5, 100)
       or jsonb_typeof(v_palco -> 'rotulo') is distinct from 'string' or char_length(v_palco ->> 'rotulo') not between 1 and 30 then
      return false;
    end if;
  end if;
  for v_bloco in select * from jsonb_array_elements(p_layout -> 'blocos') loop
    if jsonb_typeof(v_bloco) <> 'object'
       or jsonb_typeof(v_bloco -> 'id') is distinct from 'string' or char_length(v_bloco ->> 'id') not between 1 and 30
       or not (v_bloco -> 'setor' is null or jsonb_typeof(v_bloco -> 'setor') = 'null')
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'x', -500, 500)
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'y', -500, 500)
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'angulo', -360, 360)
       or not (v_bloco -> 'raio' is null or jsonb_typeof(v_bloco -> 'raio') = 'null' or public.fn_ticketeria_layout_numero(v_bloco -> 'raio', 0.5, 1000))
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'espacoFileira', 0.5, 5)
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'larguraCorredor', 0, 6)
       or coalesce((v_bloco ->> 'numeracao') <> all (array['esq-dir', 'dir-esq', 'centro-fora']), true)
       or not public.fn_ticketeria_layout_numero(v_bloco -> 'primeiroNumero', 1, 999, true)
       or not public.fn_ticketeria_layout_corredores(v_bloco -> 'corredores')
       or jsonb_typeof(v_bloco -> 'fileiras') is distinct from 'array' or jsonb_array_length(v_bloco -> 'fileiras') not between 1 and 60 then
      return false;
    end if;
    v_primeiro := (v_bloco ->> 'primeiroNumero')::integer;
    for v_fileira in select * from jsonb_array_elements(v_bloco -> 'fileiras') loop
      if jsonb_typeof(v_fileira) <> 'object'
         or jsonb_typeof(v_fileira -> 'nome') is distinct from 'string' or (v_fileira ->> 'nome') !~ '^[A-Z0-9]{1,4}$'
         or not public.fn_ticketeria_layout_numero(v_fileira -> 'lugares', 1, 80, true)
         or not public.fn_ticketeria_layout_corredores(v_fileira -> 'corredores') then
        return false;
      end if;
      v_lugares := (v_fileira ->> 'lugares')::integer;
      if v_primeiro + v_lugares - 1 > 999 then
        return false;
      end if;
      v_total := v_total + v_lugares;
    end loop;
    -- Mesa ou camarote: um bloco de UMA fileira, mesa de 2 a 12 lugares e camarote de 1 a 24; `inteiro` é verdadeiro ou falso; `colunas` (lugares por fila) só no camarote, de 1 a 12. Ausente ou nulo serve.
    if v_bloco -> 'grupo' is not null and jsonb_typeof(v_bloco -> 'grupo') <> 'null' then
      if jsonb_typeof(v_bloco -> 'grupo') <> 'object' or coalesce((v_bloco -> 'grupo' ->> 'forma') <> all (array['mesa', 'camarote']), true)
         or jsonb_typeof(v_bloco -> 'grupo' -> 'inteiro') is distinct from 'boolean' or jsonb_array_length(v_bloco -> 'fileiras') <> 1 then
        return false;
      end if;
      if (v_bloco -> 'grupo' ->> 'forma') = 'mesa' and v_lugares not between 2 and 12 then
        return false;
      end if;
      if (v_bloco -> 'grupo' ->> 'forma') = 'camarote' and v_lugares not between 1 and 24 then
        return false;
      end if;
      if v_bloco -> 'grupo' -> 'colunas' is not null and jsonb_typeof(v_bloco -> 'grupo' -> 'colunas') <> 'null' then
        if (v_bloco -> 'grupo' ->> 'forma') <> 'camarote' or not public.fn_ticketeria_layout_numero(v_bloco -> 'grupo' -> 'colunas', 1, 12, true) then
          return false;
        end if;
      end if;
    end if;
  end loop;
  return v_total <= 5000;
end;
$$;

create or replace function public.fn_ticketeria_reservar_com_lugares(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer, p_codigo text, p_lugares jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_reserva jsonb;
  v_pedido uuid;
  v_entrada jsonb;
  v_ingresso_id uuid;
  v_setor record;
  v_quantidade bigint;
  v_chaves text[] := '{}';
  v_ids uuid[] := '{}';
  v_chave text;
  v_lugar jsonb;
  v_assento record;
  v_org uuid;
  v_vistos uuid[] := '{}';
begin
  if p_lugares is not null and jsonb_typeof(p_lugares) <> 'array' then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;
  v_reserva := public.fn_ticketeria_reservar_com_cupom(p_sessao, p_itens, p_nome, p_email, p_minutos, p_codigo);
  v_pedido := (v_reserva ->> 'pedido_id')::uuid;
  select organization_id into v_org from public.ticketeria_pedidos where id = v_pedido;

  -- Todo ingresso de setor numerado do pedido pede os lugares dele, na quantidade certa; ingresso de setor comum não leva lugar.
  for v_ingresso_id, v_quantidade in select it.ingresso_id, sum(it.quantidade) from public.ticketeria_pedido_itens it where it.pedido_id = v_pedido group by it.ingresso_id loop
    select st.id, st.numerado into v_setor from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = v_ingresso_id;
    select e into v_entrada from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) e where (e ->> 'ingresso_id') = v_ingresso_id::text limit 1;
    if v_setor.numerado then
      if v_entrada is null then
        raise exception 'lugares_obrigatorios' using errcode = 'check_violation';
      end if;
      if jsonb_typeof(v_entrada -> 'assentos') is distinct from 'array' or jsonb_array_length(v_entrada -> 'assentos') <> v_quantidade then
        raise exception 'lugares_quantidade' using errcode = 'check_violation';
      end if;
      v_vistos := v_vistos || v_ingresso_id;
    elsif v_entrada is not null then
      raise exception 'ingresso_sem_mapa' using errcode = 'check_violation';
    end if;
  end loop;
  -- Entrada para ingresso que não está no pedido, ou repetida.
  if exists (select 1 from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) e where not ((e ->> 'ingresso_id') = any(select x::text from unnest(v_vistos) x))) then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb))) <> coalesce(array_length(v_vistos, 1), 0) then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;

  -- Os lugares: existem no setor do ingresso, não estão bloqueados, não se repetem.
  for v_entrada in select * from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) loop
    v_ingresso_id := (v_entrada ->> 'ingresso_id')::uuid;
    for v_lugar in select * from jsonb_array_elements(v_entrada -> 'assentos') loop
      if jsonb_typeof(v_lugar) <> 'object' or upper(btrim(coalesce(v_lugar ->> 'fileira', ''))) !~ '^[A-Z0-9]{1,4}$' or (v_lugar ->> 'numero') !~ '^[0-9]{1,3}$' then
        raise exception 'lugares_invalidos' using errcode = 'check_violation';
      end if;
      select a.id into v_assento from public.ticketeria_assentos a join public.ticketeria_ingressos i on i.setor_id = a.setor_id
        where i.id = v_ingresso_id and a.fileira = upper(btrim(v_lugar ->> 'fileira')) and a.numero = (v_lugar ->> 'numero')::integer and not a.bloqueado;
      if v_assento.id is null then
        raise exception 'lugar_indisponivel' using errcode = 'check_violation';
      end if;
      if v_assento.id = any(v_ids) then
        raise exception 'lugares_invalidos' using errcode = 'check_violation';
      end if;
      v_ids := v_ids || v_assento.id;
    end loop;
  end loop;

  -- Mesa ou camarote que só vende inteiro (`venda_em_grupo`): o pedido leva TODOS os lugares do grupo. Sem isso, ninguém fica com um camarote pela metade.
  if exists (
    select 1 from public.ticketeria_assentos a
    where a.id = any(v_ids) and a.venda_em_grupo
      and (select count(*) from public.ticketeria_assentos g where g.setor_id = a.setor_id and g.fileira = a.fileira)
        <> (select count(*) from public.ticketeria_assentos g where g.setor_id = a.setor_id and g.fileira = a.fileira and g.id = any(v_ids))
  ) then
    raise exception 'grupo_incompleto' using errcode = 'check_violation';
  end if;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    -- Trava os lugares (sempre na mesma ordem) e confere que ninguém os pegou.
    perform 1 from public.ticketeria_assentos a where a.id = any(v_ids) order by a.id for update;
    if exists (
      select 1 from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
      where pa.assento_id = any(v_ids) and pa.sessao_id = p_sessao and pa.pedido_id <> v_pedido
        and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
    ) then
      raise exception 'lugar_ocupado' using errcode = 'check_violation';
    end if;
    insert into public.ticketeria_pedido_assentos (organization_id, pedido_id, sessao_id, ingresso_id, assento_id, fileira, numero)
    select v_org, v_pedido, p_sessao, (e ->> 'ingresso_id')::uuid, a.id, a.fileira, a.numero
    from jsonb_array_elements(p_lugares) e
    cross join lateral jsonb_array_elements(e -> 'assentos') l
    join public.ticketeria_ingressos i on i.id = (e ->> 'ingresso_id')::uuid
    join public.ticketeria_assentos a on a.setor_id = i.setor_id and a.fileira = upper(btrim(l ->> 'fileira')) and a.numero = (l ->> 'numero')::integer;
    -- Pedido que já nasceu pago (gratuito ou cupom de 100%): os ingressos já foram emitidos, agora ganham o lugar.
    perform public.fn_ticketeria_lugares_aos_ingressos(v_pedido);
  end if;
  return v_reserva;
end;
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
  v_planta jsonb;
  v_resultado jsonb;
begin
  select s.evento_id, s.local_id, s.sala_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.evento_id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    return null;
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, st.id as setor_id, st.nome as setor, st.numerado, st.corredor_no_meio, st.local_id, st.sala_id, st.layout
    into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or v_ingresso.sala_id <> v_sessao.sala_id or not v_ingresso.publico or v_ingresso.arquivado or not v_ingresso.numerado then
    return null;
  end if;
  v_resultado := jsonb_build_object('setor', v_ingresso.setor, 'corredor', v_ingresso.corredor_no_meio, 'fileiras', coalesce((
    select jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by length(f.fileira), f.fileira)
    from (
      select x.fileira,
        jsonb_agg(jsonb_build_object('numero', x.numero, 'estado', case when x.ocupado or (x.venda_em_grupo and x.grupo_ocupado) then 'ocupado' else 'livre' end) || case when x.tipo <> 'comum' then jsonb_build_object('tipo', x.tipo) else '{}'::jsonb end order by x.numero) as assentos
      from (
        -- `grupo_ocupado`: algum lugar da fileira está tomado ou bloqueado. Numa mesa ou camarote que só vende inteiro, isso tira o grupo todo da venda.
        select a.fileira, a.numero, a.tipo, a.venda_em_grupo, (a.bloqueado or o.assento_id is not null) as ocupado,
          bool_or(a.bloqueado or o.assento_id is not null) over (partition by a.fileira) as grupo_ocupado
        from public.ticketeria_assentos a
      left join (
        select pa.assento_id from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
        where pa.sessao_id = p_sessao and pa.assento_id is not null and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
      ) o on o.assento_id = a.id
        where a.setor_id = v_ingresso.setor_id
      ) x
      group by x.fileira
    ) f
  ), '[]'::jsonb)) || case when v_ingresso.layout is not null then jsonb_build_object('layout', v_ingresso.layout) else '{}'::jsonb end;
  -- O mapa da sala: só com planta, e só os setores à venda neste evento (um setor interno, sem ingresso público, não aparece): os desenhados em blocos (`setores`) e os sem lugares numerados, que viram áreas (`em_pe`).
  select sa.planta into v_planta from public.ticketeria_salas sa where sa.id = v_ingresso.sala_id;
  if v_planta is not null then
    v_resultado := v_resultado || jsonb_build_object('sala', jsonb_build_object('atual', v_ingresso.setor_id, 'planta', v_planta, 'em_pe', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'capacidade', e.lugares) order by e.nome, e.id)
      from public.ticketeria_setores e
      where e.sala_id = v_ingresso.sala_id and not e.numerado and not e.arquivado and e.lugares >= 1
        and exists (select 1 from public.ticketeria_ingressos i3 where i3.setor_id = e.id and i3.evento_id = v_sessao.evento_id and i3.publico and not i3.arquivado)
    ), '[]'::jsonb), 'setores', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'layout', s.layout) order by s.nome, s.id)
      from public.ticketeria_setores s
      where s.sala_id = v_ingresso.sala_id and s.numerado and not s.arquivado and s.layout is not null
        and exists (select 1 from public.ticketeria_ingressos i2 where i2.setor_id = s.id and i2.evento_id = v_sessao.evento_id and i2.publico and not i2.arquivado)
    ), '[]'::jsonb)));
  end if;
  return v_resultado;
end;
$$;

-- Quem executa: o de sempre. A conferência do formato roda na trava da tabela (logado sim, visitante não); a reserva e o mapa do comprador são do servidor; o gatilho não é de ninguém.
revoke execute on function public.fn_ticketeria_setor_layout_grupos() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_layout_ok(jsonb) from public, anon;
grant execute on function public.fn_ticketeria_layout_ok(jsonb) to authenticated, service_role;
revoke execute on function public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb) to service_role;
revoke execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) to service_role;
