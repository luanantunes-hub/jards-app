-- A meia-entrada é um desconto de 50% sobre a inteira, não outro ingresso para cuidar.
--
-- Por baixo, a meia continua sendo uma linha de ticketeria_ingressos (assim o pedido, o cupom, o reembolso e os relatórios não mudam), mas agora ela
-- é LIGADA à inteira:
--   - ticketeria_ingressos.meia_de: a meia aponta para a inteira (ou outro ingresso pago) de que é o desconto. Uma meia por ingresso; o mesmo evento e
--     o mesmo setor; quem apaga a inteira leva a meia. Sem meia_de, tudo funciona como antes (as meias que já existem seguem como estão);
--   - ticketeria_lotes.espelho_de: o lote da meia aponta para o lote da inteira que ele espelha;
--   - fn_ticketeria_espelhar_lote (gatilho): todo lote da inteira cria, muda ou perde o lote espelho da meia: o nome, a ordem, a quantidade e a janela
--     de venda iguais, e o preço pela metade (arredondado, nunca abaixo de 1 centavo: a mesma conta do app). Mudou o preço da inteira, a meia muda junto;
--   - fn_ticketeria_meia_coerencia (gatilho): a meia é do mesmo evento, setor e organização da inteira, e a inteira é uma inteira ou "outra" (não meia, social, gratuito nem cortesia)
--     (meia_incoerente);
--   - fn_ticketeria_meia_acompanha (gatilho): setor, "aparece ao público" e limite por pedido da meia seguem os da inteira; inteira arquivada arquiva a meia.
-- Não há DELETE nem DROP: só colunas, índices, gatilhos e a troca de fn_ticketeria_comecar_pracas (mesma assinatura, create or replace), que passa a
-- criar a meia ligada. Aditiva e reaplicável.

set local lock_timeout = '10s';

alter table public.ticketeria_ingressos add column if not exists meia_de uuid references public.ticketeria_ingressos (id) on delete cascade;
alter table public.ticketeria_lotes add column if not exists espelho_de uuid references public.ticketeria_lotes (id) on delete cascade;

do $c$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_ingressos_meia_de_check') then
    alter table public.ticketeria_ingressos add constraint ticketeria_ingressos_meia_de_check check (meia_de is null or (categoria = 'meia' and meia_de <> id));
  end if;
end
$c$;

create unique index if not exists ticketeria_ingressos_meia_de_key on public.ticketeria_ingressos (meia_de) where meia_de is not null;
create unique index if not exists ticketeria_lotes_espelho_de_key on public.ticketeria_lotes (espelho_de) where espelho_de is not null;

-- ─── A meia combina com a inteira ───────────────────────────────────────────

create or replace function public.fn_ticketeria_meia_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base record;
begin
  if new.meia_de is null then
    return new;
  end if;
  select i.id, i.organization_id, i.evento_id, i.setor_id, i.categoria, i.meia_de into v_base from public.ticketeria_ingressos i where i.id = new.meia_de;
  if v_base.id is null or v_base.organization_id <> new.organization_id or v_base.evento_id <> new.evento_id or v_base.setor_id <> new.setor_id
     or v_base.meia_de is not null or v_base.categoria not in ('inteira', 'outra') then
    raise exception 'meia_incoerente' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_ingressos_meia_coerencia before insert or update of meia_de, organization_id, evento_id, setor_id, categoria on public.ticketeria_ingressos
  for each row execute function public.fn_ticketeria_meia_coerencia();

-- ─── A meia acompanha a inteira ─────────────────────────────────────────────

create or replace function public.fn_ticketeria_meia_acompanha()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.meia_de is not null then
    return new;
  end if;
  update public.ticketeria_ingressos m
  set setor_id = new.setor_id, publico = new.publico, limite_por_pedido = new.limite_por_pedido, arquivado = m.arquivado or new.arquivado
  where m.meia_de = new.id
    and (m.setor_id, m.publico, m.limite_por_pedido, m.arquivado) is distinct from (new.setor_id, new.publico, new.limite_por_pedido, m.arquivado or new.arquivado);
  return new;
end;
$$;

create or replace trigger ticketeria_ingressos_meia_acompanha after update of setor_id, publico, limite_por_pedido, arquivado on public.ticketeria_ingressos
  for each row execute function public.fn_ticketeria_meia_acompanha();

-- ─── Os lotes da meia são o espelho dos da inteira ──────────────────────────

create or replace function public.fn_ticketeria_espelhar_lote()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meia uuid;
begin
  if new.espelho_de is not null then
    return new;
  end if;
  select m.id into v_meia from public.ticketeria_ingressos m where m.meia_de = new.ingresso_id;
  if v_meia is null then
    return new;
  end if;
  insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade, vendas_inicio, vendas_fim, espelho_de)
  values (new.organization_id, v_meia, new.nome, new.ordem, greatest(1, round(new.preco_centavos / 2.0)::integer), new.quantidade, new.vendas_inicio, new.vendas_fim, new.id)
  on conflict (espelho_de) where espelho_de is not null do update
    set nome = excluded.nome, ordem = excluded.ordem, preco_centavos = excluded.preco_centavos, quantidade = excluded.quantidade,
        vendas_inicio = excluded.vendas_inicio, vendas_fim = excluded.vendas_fim;
  return new;
end;
$$;

create or replace trigger ticketeria_lotes_espelhar after insert or update of nome, ordem, preco_centavos, quantidade, vendas_inicio, vendas_fim on public.ticketeria_lotes
  for each row execute function public.fn_ticketeria_espelhar_lote();

-- Uma meia nova (ou ligada agora à inteira) ganha os espelhos dos lotes que a inteira já tem.
create or replace function public.fn_ticketeria_meia_nova()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade, vendas_inicio, vendas_fim, espelho_de)
  select l.organization_id, new.id, l.nome, l.ordem, greatest(1, round(l.preco_centavos / 2.0)::integer), l.quantidade, l.vendas_inicio, l.vendas_fim, l.id
  from public.ticketeria_lotes l where l.ingresso_id = new.meia_de and l.espelho_de is null
  on conflict (espelho_de) where espelho_de is not null do update
    set nome = excluded.nome, ordem = excluded.ordem, preco_centavos = excluded.preco_centavos, quantidade = excluded.quantidade,
        vendas_inicio = excluded.vendas_inicio, vendas_fim = excluded.vendas_fim;
  return new;
end;
$$;

create or replace trigger ticketeria_ingressos_meia_nova after insert or update of meia_de on public.ticketeria_ingressos
  for each row when (new.meia_de is not null) execute function public.fn_ticketeria_meia_nova();

revoke execute on function public.fn_ticketeria_meia_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_meia_acompanha() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_espelhar_lote() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_meia_nova() from public, anon, authenticated;

comment on column public.ticketeria_ingressos.meia_de is 'Meia-entrada: o ingresso de que ela é o desconto de 50%. Os lotes dela espelham os dele (metade do preço).';
comment on column public.ticketeria_lotes.espelho_de is 'Lote de meia-entrada: o lote da inteira que ele espelha. Não se edita à mão: muda quando o lote da inteira muda.';

CREATE OR REPLACE FUNCTION public.fn_ticketeria_comecar_pracas(p_org uuid, p_perfil text, p_evento text, p_pracas jsonb, p_lugares integer, p_hora time without time zone, p_preco_centavos integer, p_meia boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fuso constant text := 'America/Sao_Paulo';
  v_hoje date := (now() at time zone v_fuso)::date;
  v_loja uuid;
  v_evento uuid;
  v_nome_org text;
  v_praca jsonb;
  v_datas date[];
  v_data date;
  v_nome_local text;
  v_cidade text;
  v_uf text;
  v_local uuid;
  v_setor uuid;
  v_lugares integer;
  v_numerado boolean;
  v_meia integer;
  v_ingresso uuid;
  v_locais uuid[] := '{}';
  v_total integer := 0;
  v_saida jsonb := '[]'::jsonb;
begin
  if not public.auth_ticketeria_pode(p_org, 'editar') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  if p_perfil is null or p_perfil not in ('espaco', 'turne', 'unico', 'festival') then
    raise exception 'perfil_invalido' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_evento, '')), '') is null then
    raise exception 'evento_sem_nome' using errcode = '22023';
  end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 200000 then
    raise exception 'lugares_invalidos' using errcode = '22023';
  end if;
  if p_hora is null then
    raise exception 'sem_data' using errcode = '22023';
  end if;
  if p_preco_centavos is null or p_preco_centavos < 0 or p_preco_centavos > 10000000 then
    raise exception 'preco_invalido' using errcode = '22023';
  end if;
  if p_pracas is null or jsonb_typeof(p_pracas) <> 'array' or jsonb_array_length(p_pracas) < 1 or jsonb_array_length(p_pracas) > 20 then
    raise exception 'pracas_invalidas' using errcode = '22023';
  end if;

  -- Confere tudo antes de gravar qualquer coisa.
  for v_praca in select * from jsonb_array_elements(p_pracas) loop
    if jsonb_typeof(v_praca) <> 'object' or nullif(btrim(coalesce(v_praca ->> 'local', '')), '') is null then
      raise exception 'local_sem_nome' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(v_praca ->> 'cidade', '')), '') is null then
      raise exception 'cidade_sem_nome' using errcode = '22023';
    end if;
    if coalesce(v_praca ->> 'uf', '') !~ '^[A-Z]{2}$' then
      raise exception 'uf_invalida' using errcode = '22023';
    end if;
    if jsonb_typeof(v_praca -> 'datas') <> 'array' or jsonb_array_length(v_praca -> 'datas') < 1 then
      raise exception 'sem_data' using errcode = '22023';
    end if;
    if jsonb_array_length(v_praca -> 'datas') > 60 then
      raise exception 'datas_demais' using errcode = '22023';
    end if;
    v_total := v_total + jsonb_array_length(v_praca -> 'datas');
    select array_agg(d::date order by d::date) into v_datas from jsonb_array_elements_text(v_praca -> 'datas') d;
    if cardinality(v_datas) <> (select count(distinct x) from unnest(v_datas) x) then
      raise exception 'data_repetida' using errcode = '22023';
    end if;
    if v_datas[1] < v_hoje then
      raise exception 'data_no_passado' using errcode = '22023';
    end if;
  end loop;
  if v_total > 200 then
    raise exception 'sessoes_demais' using errcode = '22023';
  end if;

  -- Loja: a da organização, ou uma nova com o nome dela.
  select l.id into v_loja from public.ticketeria_lojas l where l.organization_id = p_org;
  if v_loja is null then
    select left(coalesce(nullif(btrim(o.nome), ''), 'Loja'), 120) into v_nome_org from public.organizations o where o.id = p_org;
    insert into public.ticketeria_lojas (organization_id, nome, criado_por)
    values (p_org, coalesce(v_nome_org, 'Loja'), auth.uid())
    returning id into v_loja;
  end if;
  update public.ticketeria_lojas set perfil = p_perfil where id = v_loja;

  insert into public.ticketeria_eventos (organization_id, loja_id, titulo, criado_por)
  values (p_org, v_loja, left(btrim(p_evento), 200), auth.uid())
  returning id into v_evento;

  for v_praca in select * from jsonb_array_elements(p_pracas) loop
    v_nome_local := left(btrim(v_praca ->> 'local'), 200);
    v_cidade := left(btrim(v_praca ->> 'cidade'), 120);
    v_uf := v_praca ->> 'uf';
    select array_agg(d::date order by d::date) into v_datas from jsonb_array_elements_text(v_praca -> 'datas') d;

    -- Local: o de mesmo nome e mesma cidade, ou um novo.
    select lo.id into v_local from public.ticketeria_locais lo
    where lo.loja_id = v_loja and not lo.arquivado and lower(btrim(lo.nome)) = lower(v_nome_local) and lower(btrim(coalesce(lo.cidade, ''))) = lower(v_cidade)
    order by lo.created_at limit 1;
    if v_local is null then
      insert into public.ticketeria_locais (organization_id, loja_id, nome, cidade, uf, fuso, criado_por)
      values (p_org, v_loja, v_nome_local, v_cidade, v_uf, v_fuso, auth.uid())
      returning id into v_local;
    else
      update public.ticketeria_locais set uf = v_uf where id = v_local and uf is null;
    end if;
    if v_local = any(v_locais) then
      raise exception 'praca_repetida' using errcode = '22023';
    end if;
    v_locais := v_locais || v_local;

    -- Setor "Geral": o que já existe no local, ou um novo com os lugares informados.
    select s.id, s.lugares, s.numerado into v_setor, v_lugares, v_numerado from public.ticketeria_setores s
    where s.local_id = v_local and s.nome = 'Geral' and not s.arquivado;
    if v_setor is null then
      insert into public.ticketeria_setores (organization_id, local_id, nome, lugares)
      values (p_org, v_local, 'Geral', p_lugares)
      returning id, lugares, numerado into v_setor, v_lugares, v_numerado;
    end if;

    foreach v_data in array v_datas loop
      insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio)
      values (p_org, v_evento, v_local, (v_data + p_hora) at time zone v_fuso);
    end loop;

    v_meia := 0;
    if p_preco_centavos = 0 then
      insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
      values (p_org, v_evento, v_setor, 'Gratuito', 'gratuito', 0)
      returning id into v_ingresso;
      insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
      values (p_org, v_ingresso, 'Lote 1', 0, v_lugares);
    else
      if coalesce(p_meia, false) then
        v_meia := v_lugares;
      end if;
      insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
      values (p_org, v_evento, v_setor, 'Inteira', 'inteira', 0)
      returning id into v_ingresso;
      insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
      values (p_org, v_ingresso, 'Lote 1', p_preco_centavos, v_lugares);
      if v_meia > 0 then
        -- A meia é a inteira com 50% de desconto: o banco espelha os lotes dela (metade do preço, mesma quantidade e janela).
        insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem, meia_de)
        values (p_org, v_evento, v_setor, 'Meia-entrada', 'meia', 1, v_ingresso)
        returning id into v_ingresso;
      end if;
    end if;

    v_saida := v_saida || jsonb_build_object('local_id', v_local, 'setor_id', v_setor, 'setor_lugares', v_lugares, 'setor_numerado', v_numerado,
                                              'sessoes', cardinality(v_datas), 'inteira', v_lugares, 'meia', v_meia);
  end loop;

  return jsonb_build_object('loja_id', v_loja, 'evento_id', v_evento, 'sessoes', v_total, 'pracas', v_saida);
end;
$function$;
