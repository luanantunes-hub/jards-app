-- Ticketeria: guardar o layout do mapa de assentos (M1 do estudo ticketeria-mapa-de-assentos-avancado.md, seção 5.1).
--
-- O motor do desenho (lib/ticketeria/mapa-layout.ts) descreve o mapa por parâmetros: blocos (posição, ângulo, curva, espaço, corredores, regra de numeração) e o palco.
-- Aqui o banco passa a guardar essa descrição, SEM mexer na identidade dos lugares: `ticketeria_assentos` segue sendo (setor, fileira, número), e é nisso que venda, ingresso e reembolso se apoiam.
--
--   - `ticketeria_setores.layout` (jsonb, nulo = o setor é só a lista de fileiras de sempre). Trava de tabela `ticketeria_setores_layout_check` pela
--     `fn_ticketeria_layout_ok` (formato, limites de números, até 30 blocos, 60 fileiras por bloco, 80 lugares por fileira, 5.000 lugares). O que depende de contas de desenho
--     (blocos um em cima do outro, números repetidos) o app confere antes (lib/ticketeria/mapa-layout.ts); o banco confere que o layout fala dos MESMOS lugares do mapa.
--   - `fn_ticketeria_salvar_mapa_com_layout(setor, fileiras, corredor, layout)`: função NOVA (outro nome: nenhuma sobrecarga, PGRST203). Salva o mapa pela função de sempre e guarda o layout
--     na mesma chamada; `layout_invalido` se o formato não serve e `layout_inconsistente` se as fileiras e as quantidades de lugares do layout não são as do mapa. Layout nulo apaga o layout.
--   - `fn_ticketeria_salvar_mapa(uuid, jsonb, boolean)`: corpo trocado, MESMA assinatura. Quem muda os LUGARES (fileira nova, lugar a mais ou a menos) sem mandar layout deixa o setor sem layout
--     (ele já não descreveria o mapa); bloquear lugar ou mudar o tipo não derruba o layout.
--   - `fn_ticketeria_mapa_da_sessao(uuid, uuid)`: corpo trocado, MESMA assinatura. Traz `layout` quando o setor tem (o JSON de quem não tem é o de antes). Parte da versão de produção.
--
-- Expansão: coluna anulável, função nova e troca de corpo de duas funções. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_setores add column if not exists layout jsonb;

comment on column public.ticketeria_setores.layout is 'Layout do mapa (blocos, corredores, curva, ângulo, numeração e palco), ou nulo quando o setor é só a lista de fileiras. Não muda a identidade dos lugares (ticketeria_assentos).';

-- ─── A validação do formato ─────────────────────────────────────────────────

create or replace function public.fn_ticketeria_layout_numero(p_valor jsonb, p_min numeric, p_max numeric, p_inteiro boolean default false)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  -- CASE: o SQL não garante a ordem do AND, e converter texto em número daria erro.
  select case when jsonb_typeof(p_valor) = 'number'
    then (p_valor #>> '{}')::numeric between p_min and p_max and (not p_inteiro or (p_valor #>> '{}')::numeric = trunc((p_valor #>> '{}')::numeric))
    else false end;
$$;

-- Ausente ou nulo serve; lista de até 40 inteiros de 1 a 79 (depois de quantos lugares há um corredor).
create or replace function public.fn_ticketeria_layout_corredores(p_valor jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
begin
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then
    return true;
  end if;
  if jsonb_typeof(p_valor) <> 'array' or jsonb_array_length(p_valor) > 40 then
    return false;
  end if;
  for v_item in select * from jsonb_array_elements(p_valor) loop
    if not public.fn_ticketeria_layout_numero(v_item, 1, 79, true) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.fn_ticketeria_layout_ok(p_layout jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
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
  end loop;
  return v_total <= 5000;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_setores_layout_check') then
    alter table public.ticketeria_setores add constraint ticketeria_setores_layout_check check (layout is null or public.fn_ticketeria_layout_ok(layout));
  end if;
end
$$;

-- O layout fala dos mesmos lugares do mapa? Cada fileira do layout (somando os blocos por onde ela passa) tem tantos lugares quanto a fileira do mapa, e não sobra nem falta fileira.
-- Os números de cada lugar vêm da regra de numeração, que o app confere (lib/ticketeria/mapa-layout.ts).
create or replace function public.fn_ticketeria_layout_confere(p_setor uuid, p_layout jsonb)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from (
      select f ->> 'nome' as fileira, sum((f ->> 'lugares')::integer) as n
      from jsonb_array_elements(p_layout -> 'blocos') b, jsonb_array_elements(b -> 'fileiras') f
      group by 1
    ) l
    full join (select a.fileira, count(*) as n from public.ticketeria_assentos a where a.setor_id = p_setor group by a.fileira) m on m.fileira = l.fileira
    where l.n is distinct from m.n
  );
$$;

-- ─── Salvar o mapa com o layout ─────────────────────────────────────────────

create or replace function public.fn_ticketeria_salvar_mapa_com_layout(p_setor uuid, p_fileiras jsonb, p_corredor boolean, p_layout jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_resultado jsonb;
begin
  if p_layout is not null and jsonb_typeof(p_layout) = 'null' then
    p_layout := null;
  end if;
  if p_layout is not null and not public.fn_ticketeria_layout_ok(p_layout) then
    raise exception 'layout_invalido' using errcode = 'check_violation';
  end if;
  v_resultado := public.fn_ticketeria_salvar_mapa(p_setor, p_fileiras, p_corredor);
  if p_layout is not null and not public.fn_ticketeria_layout_confere(p_setor, p_layout) then
    raise exception 'layout_inconsistente' using errcode = 'check_violation';
  end if;
  update public.ticketeria_setores set layout = p_layout where id = p_setor;
  return v_resultado || jsonb_build_object('layout', p_layout is not null);
end;
$$;

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
  v_antes text;
  v_depois text;
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

  -- A identidade dos lugares antes (o layout só vale enquanto os lugares são os mesmos).
  select md5(coalesce(string_agg(a.fileira || ':' || a.numero, ',' order by a.fileira, a.numero), '')) into v_antes from public.ticketeria_assentos a where a.setor_id = p_setor;

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

  -- Se o conjunto de lugares mudou (fileira nova, lugar a mais ou a menos), o layout guardado já não descreve o mapa: sai, e o setor volta a ser a lista de fileiras.
  select md5(coalesce(string_agg(a.fileira || ':' || a.numero, ',' order by a.fileira, a.numero), '')) into v_depois from public.ticketeria_assentos a where a.setor_id = p_setor;
  if v_antes is distinct from v_depois then
    update public.ticketeria_setores set layout = null where id = p_setor and layout is not null;
  end if;

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
  select i.id, i.evento_id, i.publico, i.arquivado, st.id as setor_id, st.nome as setor, st.numerado, st.corredor_no_meio, st.local_id, st.sala_id, st.layout
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
  ), '[]'::jsonb)) || case when v_ingresso.layout is not null then jsonb_build_object('layout', v_ingresso.layout) else '{}'::jsonb end;
end;
$$;

-- Quem executa: as de formato também rodam na trava da tabela, então o logado precisa poder chamá-las; o visitante não.
revoke execute on function public.fn_ticketeria_layout_numero(jsonb, numeric, numeric, boolean) from public, anon;
revoke execute on function public.fn_ticketeria_layout_corredores(jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_layout_ok(jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_layout_confere(uuid, jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_salvar_mapa_com_layout(uuid, jsonb, boolean, jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) from public, anon;
revoke execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_layout_numero(jsonb, numeric, numeric, boolean) to authenticated, service_role;
grant execute on function public.fn_ticketeria_layout_corredores(jsonb) to authenticated, service_role;
grant execute on function public.fn_ticketeria_layout_ok(jsonb) to authenticated, service_role;
grant execute on function public.fn_ticketeria_layout_confere(uuid, jsonb) to authenticated;
grant execute on function public.fn_ticketeria_salvar_mapa_com_layout(uuid, jsonb, boolean, jsonb) to authenticated;
grant execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) to authenticated;
grant execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) to service_role;
