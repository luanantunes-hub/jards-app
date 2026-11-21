-- Começar sem limite de meia-entrada: a Meia nasce com todos os lugares do setor, igual à Inteira (o setor é um balde só, e quem vende primeiro leva).
-- Antes (20261127100300), a Meia nascia com 40% dos lugares como teto. O Luan decidiu (21/11/2026) que não há limite de meia-entrada no produto;
-- a quantidade do lote da meia deixa de ser um teto e some o "mínimo de 3 lugares" para ter meia (ele existia só porque 40% de menos de 3 é zero).
-- Só fn_ticketeria_comecar_pracas, com a mesma assinatura e create or replace; sem DROP, sem sobrecarga (PGRST203); reaplicável. Eventos que já
-- existem não são tocados.

set local lock_timeout = '10s';

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
        insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
        values (p_org, v_evento, v_setor, 'Meia-entrada', 'meia', 1)
        returning id into v_ingresso;
        insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
        values (p_org, v_ingresso, 'Lote 1', greatest(1, round(p_preco_centavos / 2.0)::integer), v_meia);
      end if;
    end if;

    v_saida := v_saida || jsonb_build_object('local_id', v_local, 'setor_id', v_setor, 'setor_lugares', v_lugares, 'setor_numerado', v_numerado,
                                              'sessoes', cardinality(v_datas), 'inteira', v_lugares, 'meia', v_meia);
  end loop;

  return jsonb_build_object('loja_id', v_loja, 'evento_id', v_evento, 'sessoes', v_total, 'pracas', v_saida);
end;
$function$;
