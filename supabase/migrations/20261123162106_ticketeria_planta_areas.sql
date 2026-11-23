-- Ticketeria: pista e áreas em pé no mapa da sala (fatia 4 do plano do editor do mapa; estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.2 item 7).
--
-- Um setor SEM lugares numerados (pista, gramado, área em pé) já se vende por quantidade, dentro da capacidade dele (`ticketeria_setores.lugares`): a reserva, o estoque e o pagamento NÃO mudam
-- aqui. O que muda é só o desenho: a planta da sala passa a poder pôr esse setor como uma ÁREA (um retângulo com posição e tamanho) ao lado dos setores de lugares numerados.
--
--   - `ticketeria_salas.planta`: cada setor da lista `setores` pode levar `area` = { largura, altura } (2 a 400 lugares de cada lado); a posição (x, y) vale como o canto de cima à esquerda da
--     área. Sem coluna nova. `fn_ticketeria_planta_ok(jsonb)`: corpo trocado, MESMA assinatura, e a trava `ticketeria_salas_planta_check` que a usa vale para a área também. Parte da versão de produção
--     (a de 20261123155349_ticketeria_planta_fundo.sql).
--   - `fn_ticketeria_mapa_da_sessao(uuid, uuid)`: corpo trocado, MESMA assinatura. Quando a sala tem planta, `sala` traz também `em_pe`: o id, o nome e a capacidade de cada setor não numerado e em uso da
--     sala que tem ingresso público à venda neste evento. O JSON de quem não tem planta é o de antes, e `setores` não muda. Parte da versão de produção (a de 20261123153914_ticketeria_planta_da_sala.sql).
--
-- Expansão: troca de corpo de duas funções. Aditiva e reaplicável; sem coluna nova, sem DROP.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_planta_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_setor jsonb;
  v_ids text[] := '{}';
  v_palco jsonb;
  v_fundo jsonb;
begin
  if p is null then
    return true;
  end if;
  if jsonb_typeof(p) <> 'object' or p -> 'versao' is distinct from '1'::jsonb then
    return false;
  end if;
  if jsonb_typeof(p -> 'setores') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(p -> 'setores') < 1 or jsonb_array_length(p -> 'setores') > 40 then
    return false;
  end if;
  for v_setor in select * from jsonb_array_elements(p -> 'setores') loop
    if jsonb_typeof(v_setor) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(v_setor -> 'setor') <> 'string' then
      return false;
    end if;
    if (v_setor ->> 'setor') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or (v_setor ->> 'setor') = any (v_ids) then
      return false;
    end if;
    v_ids := v_ids || (v_setor ->> 'setor');
    if not public.fn_ticketeria_layout_numero(v_setor -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_setor -> 'y', -2000, 2000) then
      return false;
    end if;
    if jsonb_typeof(v_setor -> 'cor') <> 'string' then
      return false;
    end if;
    if (v_setor ->> 'cor') !~ '^#[0-9a-fA-F]{6}$' then
      return false;
    end if;
    -- Setor sem lugares numerados (pista, área em pé): um retângulo de 2 a 400 lugares de cada lado. Ausente ou nulo serve (o setor numerado não tem área).
    if v_setor -> 'area' is not null and jsonb_typeof(v_setor -> 'area') <> 'null' then
      if jsonb_typeof(v_setor -> 'area') <> 'object' then
        return false;
      end if;
      if not public.fn_ticketeria_layout_numero(v_setor -> 'area' -> 'largura', 2, 400) or not public.fn_ticketeria_layout_numero(v_setor -> 'area' -> 'altura', 2, 400) then
        return false;
      end if;
    end if;
  end loop;
  v_palco := p -> 'palco';
  if v_palco is not null and jsonb_typeof(v_palco) <> 'null' then
    if jsonb_typeof(v_palco) <> 'object' then
      return false;
    end if;
    if not public.fn_ticketeria_layout_numero(v_palco -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_palco -> 'y', -2000, 2000)
       or not public.fn_ticketeria_layout_numero(v_palco -> 'largura', 1, 2000) or not public.fn_ticketeria_layout_numero(v_palco -> 'altura', 0.5, 100) then
      return false;
    end if;
    if jsonb_typeof(v_palco -> 'rotulo') <> 'string' then
      return false;
    end if;
    if char_length(v_palco ->> 'rotulo') not between 1 and 30 then
      return false;
    end if;
  end if;
  v_fundo := p -> 'fundo';
  if v_fundo is not null and jsonb_typeof(v_fundo) <> 'null' then
    if jsonb_typeof(v_fundo) <> 'object' then
      return false;
    end if;
    if jsonb_typeof(v_fundo -> 'caminho') <> 'string' then
      return false;
    end if;
    -- <id da organização>/<id da imagem>.<webp|jpg|png>: só uma imagem da biblioteca de imagens da loja (espaço `ticketeria-site`), nunca um endereço de fora.
    if (v_fundo ->> 'caminho') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$' then
      return false;
    end if;
    if not public.fn_ticketeria_layout_numero(v_fundo -> 'x', -2000, 2000) or not public.fn_ticketeria_layout_numero(v_fundo -> 'y', -2000, 2000)
       or not public.fn_ticketeria_layout_numero(v_fundo -> 'largura', 1, 4000) or not public.fn_ticketeria_layout_numero(v_fundo -> 'altura', 1, 4000)
       or not public.fn_ticketeria_layout_numero(v_fundo -> 'opacidade', 10, 100, true) then
      return false;
    end if;
  end if;
  return true;
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

-- Quem executa: o de sempre. A conferência do formato roda na trava da tabela (logado sim, visitante não); o mapa do comprador segue só para o servidor.
revoke execute on function public.fn_ticketeria_planta_ok(jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_planta_ok(jsonb) to authenticated, service_role;
grant execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) to service_role;
