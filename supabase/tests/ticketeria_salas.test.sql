-- Salas (migration ticketeria_salas): um espaço pode ter mais de uma sala; o setor e a sessão são de uma sala, e a venda confere a sala.
--
-- O espaço novo ganha a "Sala única"; setor e sessão sem sala entram na primeira sala ativa; a sala é do espaço e da organização (sala_incoerente); sala arquivada
-- não recebe setor nem sessão novos; a última sala ativa não se arquiva nem se apaga (sala_unica); a sala não muda de espaço; apagar o espaço leva as salas; a venda
-- (reservar), a lista de espera e o mapa da sessão só aceitam ingresso de setor da sala da sessão; e quem pode mexer nas salas. Ids 0d820000-0000-4000-8000-0000000000XX,
-- ou ts.id('XX'), esquema `ts`. Desfeito no fim.
--   A (a0): loja 61; espaço 51 (a sala padrão nasce sozinha) com o setor 41 (10 lugares), o ingresso 31 e a sessão 81 (sem dizer a sala); a sala "Sala 2" (id 91) do espaço 51
--   com o setor 42, o ingresso 32 e a sessão 82; espaço 52 com a sala padrão. a1 admin, a3 leitor.   B (b0): loja 62 e espaço 53.
-- Rodar: supabase/tests/README.md, com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio e ticketeria_salas na frente se não estiverem aplicadas
-- (pela CLI, `supabase db query --linked -f bloco.sql`). A seção "Apagar" usa DELETE (desfeito).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

create schema ts;
grant usage on schema ts to authenticated, anon;

create function ts.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d820000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function ts.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when insufficient_privilege then return '42501';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function ts.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ts.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ts.id(s), 'ts-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3']) as s;
  insert into public.organizations (id, nome) values (ts.id('a0'), 'TS A'), (ts.id('b0'), 'TS B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (ts.id('a0'), 'ticketeria', 'cortesia', 20), (ts.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ts.id(o), ts.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (ts.id('61'), ts.id('a0'), 'Loja A'), (ts.id('62'), ts.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values
    (ts.id('51'), ts.id('a0'), ts.id('61'), 'Cinema A'), (ts.id('52'), ts.id('a0'), ts.id('61'), 'Galpão'), (ts.id('53'), ts.id('b0'), ts.id('62'), 'Cinema B');
  -- a sala padrão de cada espaço nasceu sozinha; a Sala 2 do espaço 51 é dita
  insert into public.ticketeria_salas (id, organization_id, local_id, nome, ordem) values (ts.id('91'), ts.id('a0'), ts.id('51'), 'Sala 2', 1);
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (ts.id('41'), ts.id('a0'), ts.id('51'), 'Plateia', 10);
  insert into public.ticketeria_setores (id, organization_id, local_id, sala_id, nome, lugares) values (ts.id('42'), ts.id('a0'), ts.id('51'), ts.id('91'), 'Camarote', 10);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (ts.id('71'), ts.id('a0'), ts.id('61'), 'Filme', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (ts.id('81'), ts.id('a0'), ts.id('71'), ts.id('51'), now() + interval '10 days');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, sala_id, inicio) values (ts.id('82'), ts.id('a0'), ts.id('71'), ts.id('51'), ts.id('91'), now() + interval '11 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (ts.id('31'), ts.id('a0'), ts.id('71'), ts.id('41'), 'Inteira', 'inteira', true), (ts.id('32'), ts.id('a0'), ts.id('71'), ts.id('42'), 'Camarote', 'inteira', true);
  insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values
    (ts.id('a0'), ts.id('31'), '1º lote', 5000, 10), (ts.id('a0'), ts.id('32'), '1º lote', 8000, 10);
end
$dados$;

create function ts.salas(local text) returns text language sql as $$
  select coalesce(string_agg(nome || ':' || ordem || ':' || arquivado, ',' order by ordem), '') from public.ticketeria_salas where local_id = ts.id(local)
$$;

-- ─── A sala padrão e o que entra sem dizer a sala ───────────────────────────

select is(ts.salas('52'), 'Sala única:0:false', 'o espaço novo ganhou sozinho a "Sala única"');
select is(ts.salas('51'), 'Sala única:0:false,Sala 2:1:false', 'um espaço com duas salas: a padrão e a Sala 2');
select is((select sa.nome from public.ticketeria_setores st join public.ticketeria_salas sa on sa.id = st.sala_id where st.id = ts.id('41')), 'Sala única', 'o setor sem sala dita entrou na primeira sala ativa do espaço');
select is((select sa.nome from public.ticketeria_sessoes se join public.ticketeria_salas sa on sa.id = se.sala_id where se.id = ts.id('81')), 'Sala única', 'a sessão sem sala dita também');
select is((select sa.nome from public.ticketeria_sessoes se join public.ticketeria_salas sa on sa.id = se.sala_id where se.id = ts.id('82')), 'Sala 2', 'e a que disse a sala ficou nela');
select ok(exists (select 1 from pg_indexes where indexname = 'ticketeria_setores_sala_nome_key'), 'o nome do setor também é único dentro da sala');

-- ─── O que não combina ──────────────────────────────────────────────────────

select is(ts.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, sala_id, nome, lugares) values (%L, %L, %L, %L, 5)', ts.id('a0'), ts.id('51'), ts.id('91'), 'Mezanino')), 'aceito', 'setor numa sala do próprio espaço: aceito');
select is(ts.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, sala_id, nome, lugares) values (%L, %L, (select id from public.ticketeria_salas where local_id = %L limit 1), %L, 5)', ts.id('a0'), ts.id('51'), ts.id('52'), 'Pista')),
          '23514 sala_incoerente', 'setor com a sala de outro espaço: recusado');
select is(ts.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, sala_id, inicio) values (%L, %L, %L, (select id from public.ticketeria_salas where local_id = %L limit 1), now() + interval %L)', ts.id('a0'), ts.id('71'), ts.id('51'), ts.id('53'), '20 days')),
          '23514 sala_incoerente', 'sessão com a sala de outra organização: recusada');
select is(ts.tenta(format('update public.ticketeria_salas set local_id = %L where id = %L', ts.id('52'), ts.id('91'))), '23514 sala_nao_muda_de_espaco', 'a sala não muda de espaço');
select is(ts.tenta(format('insert into public.ticketeria_salas (organization_id, local_id, nome) values (%L, %L, %L)', ts.id('a0'), ts.id('53'), 'Sala invasora')), '23514 espaco_de_outra_organizacao', 'sala num espaço de outra organização: recusada');

-- ─── A última sala ativa ────────────────────────────────────────────────────

select is(ts.tenta(format('update public.ticketeria_salas set arquivado = true where local_id = %L', ts.id('52'))), '23514 sala_unica', 'a única sala do espaço não se arquiva');
select is(ts.tenta(format('delete from public.ticketeria_salas where local_id = %L', ts.id('52'))), '23514 sala_unica', 'nem se apaga');
update public.ticketeria_salas set arquivado = true where id = ts.id('91');
select is(ts.salas('51'), 'Sala única:0:false,Sala 2:1:true', 'havendo outra sala ativa, uma se arquiva');
select is(ts.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, sala_id, nome, lugares) values (%L, %L, %L, %L, 5)', ts.id('a0'), ts.id('51'), ts.id('91'), 'Balcão')), '23514 sala_arquivada', 'sala arquivada não recebe setor novo');
select is(ts.tenta(format('update public.ticketeria_salas set arquivado = true where local_id = %L and nome = %L', ts.id('51'), 'Sala única')), '23514 sala_unica', 'e a última ativa (a padrão) agora não se arquiva');
update public.ticketeria_salas set arquivado = false where id = ts.id('91');

-- ─── A venda confere a sala ─────────────────────────────────────────────────

select is(ts.tenta(format('select public.fn_ticketeria_reservar(%L, %L::jsonb, %L, %L, 15)', ts.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', ts.id('31'), 'quantidade', 1))::text, 'Rita Teste', 'rita@teste.invalid')), 'aceito', 'ingresso do setor da sala da sessão: a reserva vale');
select is(ts.tenta(format('select public.fn_ticketeria_reservar(%L, %L::jsonb, %L, %L, 15)', ts.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', ts.id('32'), 'quantidade', 1))::text, 'Rita Teste', 'rita@teste.invalid')), '23514 ingresso_de_outro_local', 'ingresso de um setor de OUTRA sala do mesmo espaço: recusado');
select is(ts.tenta(format('select public.fn_ticketeria_reservar(%L, %L::jsonb, %L, %L, 15)', ts.id('82'), jsonb_build_array(jsonb_build_object('ingresso_id', ts.id('32'), 'quantidade', 1))::text, 'Rita Teste', 'rita@teste.invalid')), 'aceito', 'a sessão da Sala 2 vende o ingresso do setor da Sala 2');
select is(ts.tenta(format('select public.fn_ticketeria_reservar(%L, %L::jsonb, %L, %L, 15)', ts.id('82'), jsonb_build_array(jsonb_build_object('ingresso_id', ts.id('31'), 'quantidade', 1))::text, 'Rita Teste', 'rita@teste.invalid')), '23514 ingresso_de_outro_local', 'e não vende o da sala padrão');

-- ─── Quem mexe nas salas ────────────────────────────────────────────────────

select ts.como('a1');
select is(ts.tenta(format('insert into public.ticketeria_salas (organization_id, local_id, nome, ordem) values (%L, %L, %L, 2)', ts.id('a0'), ts.id('51'), 'Sala 3')), 'aceito', 'quem edita a Ticketeria cria sala');
select ts.como('a3');
select is(ts.tenta(format('insert into public.ticketeria_salas (organization_id, local_id, nome, ordem) values (%L, %L, %L, 3)', ts.id('a0'), ts.id('51'), 'Sala 4')), '42501', 'o leitor não cria');
select ts.como(null);
select is(ts.tenta('select count(*) from public.ticketeria_salas'), '42501', 'o visitante não lê');

select * from finish();
rollback;
