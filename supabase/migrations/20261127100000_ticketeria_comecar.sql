-- Onboarding da Ticketeria ("Começar"): o produtor diz como trabalha, responde duas perguntas
-- e sai com o primeiro evento pronto, em rascunho.
--
-- Aditiva, sem DROP:
--   1. ticketeria_lojas.perfil (nulo até o produtor responder): espaço, turnê, evento único ou
--      festival. Guarda a resposta para a página inicial se adaptar depois.
--   2. fn_ticketeria_comecar(...): cria numa só operação a loja (se ainda não houver), o local,
--      o setor "Geral", o evento em rascunho, as sessões (uma, ou uma por dia no festival), os
--      ingressos e os lotes. Ou tudo entra, ou nada entra.
--
-- A função roda com a permissão de quem chama (security invoker): cada insert passa pelas
-- mesmas regras de sempre (auth_ticketeria_pode(org, 'editar')). Ela só junta os passos.
--
-- Meia-entrada: o banco não deixa a soma dos lotes de um setor passar dos lugares
-- (fn_ticketeria_conferir_lugares). Por isso a lotação é dividida: 40% meia (a cota da Lei
-- 12.933/2013), 60% inteira. Com menos de 3 lugares não há meia. Gratuito: um ingresso
-- "gratuito" a R$ 0 com todos os lugares.
--
-- Horário: a data e a hora vêm como o produtor digitou e são lidas no fuso do local
-- (America/Sao_Paulo, o padrão das locais novas).

set local lock_timeout = '10s';

-- Conserto achado aqui: o gatilho que dá o slug ao evento novo (fn_ticketeria_evento_slug, migration
-- 20261123600000) roda com a permissão de quem insere, mas chama fn_ticketeria_evento_slug_livre, que
-- só o dono do banco e a chave de serviço executam. Resultado: criar evento pelo app, sem mandar slug,
-- dava "permission denied for function fn_ticketeria_evento_slug_livre" para qualquer produtor (o
-- teste dessa migration rodava como dono do banco e não via). O gatilho passa a rodar com a permissão
-- do dono, como os gatilhos de coerência da Ticketeria; ninguém o chama de fora (execute revogado).
alter function public.fn_ticketeria_evento_slug() security definer;

alter table public.ticketeria_lojas add column if not exists perfil text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_lojas_perfil_check') then
    alter table public.ticketeria_lojas
      add constraint ticketeria_lojas_perfil_check
      check (perfil is null or perfil in ('espaco', 'turne', 'unico', 'festival'));
  end if;
end
$$;

comment on column public.ticketeria_lojas.perfil is
  'Como o produtor trabalha, respondido no onboarding: espaco (tem um espaço), turne (circula com um espetáculo), unico (evento único) ou festival.';

create or replace function public.fn_ticketeria_comecar(
  p_org uuid,
  p_perfil text,
  p_evento text,
  p_local text,
  p_cidade text,
  p_lugares integer,
  p_data date,
  p_hora time,
  p_dias integer,
  p_preco_centavos integer,
  p_meia boolean)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fuso constant text := 'America/Sao_Paulo';
  v_hoje date := (now() at time zone v_fuso)::date;
  v_loja uuid;
  v_local uuid;
  v_setor uuid;
  v_lugares integer;
  v_evento uuid;
  v_dias integer := case when p_perfil = 'festival' then coalesce(p_dias, 1) else 1 end;
  v_meia integer := 0;
  v_ingresso uuid;
  v_nome_org text;
  i integer;
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
  if nullif(btrim(coalesce(p_local, '')), '') is null then
    raise exception 'local_sem_nome' using errcode = '22023';
  end if;
  if p_lugares is null or p_lugares < 1 or p_lugares > 200000 then
    raise exception 'lugares_invalidos' using errcode = '22023';
  end if;
  if p_data is null or p_hora is null then
    raise exception 'sem_data' using errcode = '22023';
  end if;
  if p_data < v_hoje then
    raise exception 'data_no_passado' using errcode = '22023';
  end if;
  if v_dias < 1 or v_dias > 31 then
    raise exception 'dias_invalidos' using errcode = '22023';
  end if;
  if p_preco_centavos is null or p_preco_centavos < 0 or p_preco_centavos > 10000000 then
    raise exception 'preco_invalido' using errcode = '22023';
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

  -- Local: reaproveita um de mesmo nome (quem refaz o onboarding não duplica o espaço).
  select lo.id into v_local from public.ticketeria_locais lo
  where lo.loja_id = v_loja and not lo.arquivado and lower(btrim(lo.nome)) = lower(btrim(p_local))
  order by lo.created_at limit 1;
  if v_local is null then
    insert into public.ticketeria_locais (organization_id, loja_id, nome, cidade, fuso, criado_por)
    values (p_org, v_loja, left(btrim(p_local), 200), nullif(left(btrim(coalesce(p_cidade, '')), 120), ''), v_fuso, auth.uid())
    returning id into v_local;
  end if;

  -- Setor "Geral": o que já existe no local, ou um novo com os lugares informados.
  select s.id, s.lugares into v_setor, v_lugares from public.ticketeria_setores s
  where s.local_id = v_local and s.nome = 'Geral' and not s.arquivado;
  if v_setor is null then
    insert into public.ticketeria_setores (organization_id, local_id, nome, lugares)
    values (p_org, v_local, 'Geral', p_lugares)
    returning id, lugares into v_setor, v_lugares;
  end if;

  insert into public.ticketeria_eventos (organization_id, loja_id, titulo, criado_por)
  values (p_org, v_loja, left(btrim(p_evento), 200), auth.uid())
  returning id into v_evento;

  for i in 0 .. v_dias - 1 loop
    insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio)
    values (p_org, v_evento, v_local, ((p_data + i) + p_hora) at time zone v_fuso);
  end loop;

  if p_preco_centavos = 0 then
    insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
    values (p_org, v_evento, v_setor, 'Gratuito', 'gratuito', 0)
    returning id into v_ingresso;
    insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
    values (p_org, v_ingresso, 'Lote 1', 0, v_lugares);
  else
    if coalesce(p_meia, false) and v_lugares >= 3 then
      v_meia := floor(v_lugares * 0.4);
    end if;
    insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
    values (p_org, v_evento, v_setor, 'Inteira', 'inteira', 0)
    returning id into v_ingresso;
    insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
    values (p_org, v_ingresso, 'Lote 1', p_preco_centavos, v_lugares - v_meia);
    if v_meia > 0 then
      insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, ordem)
      values (p_org, v_evento, v_setor, 'Meia-entrada', 'meia', 1)
      returning id into v_ingresso;
      insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade)
      values (p_org, v_ingresso, 'Lote 1', greatest(1, round(p_preco_centavos / 2.0)::integer), v_meia);
    end if;
  end if;

  return jsonb_build_object('loja_id', v_loja, 'evento_id', v_evento, 'local_id', v_local,
                            'sessoes', v_dias, 'meia', v_meia, 'inteira', v_lugares - v_meia);
end;
$$;

revoke execute on function public.fn_ticketeria_comecar(uuid, text, text, text, text, integer, date, time, integer, integer, boolean) from public, anon;
grant execute on function public.fn_ticketeria_comecar(uuid, text, text, text, text, integer, date, time, integer, integer, boolean) to authenticated;
