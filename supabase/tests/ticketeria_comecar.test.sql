-- Onboarding da Ticketeria: fn_ticketeria_comecar e ticketeria_lojas.perfil (migration ticketeria_comecar).
--
-- Confere que o primeiro evento nasce inteiro numa só chamada (loja, local, setor "Geral", evento em rascunho, sessões,
-- ingressos e lotes); a divisão da meia-entrada (40%) e o preço dela; o festival com uma sessão por dia; o gratuito; que
-- refazer com o mesmo espaço não duplica o local; e quem pode chamar (editor sim; leitor, outra organização e visitante não).
-- Ids 0d7c0000-0000-4000-8000-0000000000XX, ou tc.id('XX').
--   A (a0): ticketeria em cortesia, ainda sem loja; a1 admin, a3 leitor.   B (b0): ticketeria em cortesia; b1 admin.
-- Sem DELETE. Rodar: supabase/tests/README.md, com a migration ticketeria_comecar na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

create schema tc;
grant usage on schema tc to authenticated, anon;

create function tc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- Daqui a 30 dias, no horário de Brasília: a data que o produtor digitaria.
create function tc.dia() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 30;
$$;

grant execute on function tc.id(text), tc.dia() to authenticated, anon;

create table tc.r (k text primary key, r jsonb);
grant select, insert on tc.r to authenticated;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tc.id(s), 'tc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tc.id('a0'), 'TC Produtora A'), (tc.id('b0'), 'TC B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tc.id('a0'), 'ticketeria', 'cortesia', 10), (tc.id('b0'), 'ticketeria', 'cortesia', 10);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tc.id(o), tc.id(p), papel, '{ticketeria}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  -- Um setor da organização B, para provar que quem edita A não confere os lugares dele.
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tc.id('6b'), tc.id('b0'), 'TC Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tc.id('5b'), tc.id('b0'), tc.id('6b'), 'TC Local B');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tc.id('4b'), tc.id('b0'), tc.id('5b'), 'Geral', 50);
end
$dados$;

create function tc.tenta(comando text) returns text language plpgsql as $$
begin
  begin
    execute comando;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then return sqlerrm;
  end;
end;
$$;
grant execute on function tc.tenta(text) to authenticated, anon;

-- ─── A forma da coluna nova e o conserto do slug ────────────────────────────

select is((select prosecdef from pg_proc where oid = 'public.fn_ticketeria_evento_slug()'::regprocedure), true,
          'o gatilho do slug roda com a permissão do dono (criar evento pelo app funciona)');

select throws_ok($t$insert into public.ticketeria_lojas (organization_id, nome, perfil) values (tc.id('b0'), 'X', 'xyz')$t$,
  '23514', null, 'perfil desconhecido é recusado');

-- ─── Evento único, pago, com meia: tudo numa chamada ────────────────────────

set local request.jwt.claims = '{"sub":"0d7c0000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;

insert into tc.r select 'r1', public.fn_ticketeria_comecar(tc.id('a0'), 'unico', 'Show de lançamento', 'Casa de Cultura', 'Rio de Janeiro',
                                      100, tc.dia(), '20:00', null, 6000, true);

select is((select perfil from public.ticketeria_lojas where organization_id = tc.id('a0')), 'unico',
          'a loja nasce com o nome da organização e o perfil respondido');
select is((select nome from public.ticketeria_lojas where organization_id = tc.id('a0')), 'TC Produtora A', 'o nome da loja é o da organização');
select is((select titulo || '|' || situacao from public.ticketeria_eventos where id = ((select r from tc.r where k = 'r1') ->> 'evento_id')::uuid),
          'Show de lançamento|rascunho', 'o evento nasce em rascunho');
select is((select count(*)::int from public.ticketeria_sessoes where evento_id = ((select r from tc.r where k = 'r1') ->> 'evento_id')::uuid), 1,
          'evento único: uma sessão');
select is((select inicio from public.ticketeria_sessoes where evento_id = ((select r from tc.r where k = 'r1') ->> 'evento_id')::uuid),
          (tc.dia() + time '20:00') at time zone 'America/Sao_Paulo', 'a sessão começa às 20h de Brasília do dia escolhido');
select is((select nome || '|' || coalesce(cidade, '') from public.ticketeria_locais where id = ((select r from tc.r where k = 'r1') ->> 'local_id')::uuid),
          'Casa de Cultura|Rio de Janeiro', 'o local guarda nome e cidade');
select is((select string_agg(s.nome || ':' || s.lugares, ',') from public.ticketeria_setores s where s.local_id = ((select r from tc.r where k = 'r1') ->> 'local_id')::uuid),
          'Geral:100', 'o setor Geral tem os lugares informados');
select is((select string_agg(i.categoria || ':' || l.preco_centavos || ':' || l.quantidade, ',' order by i.ordem)
           from public.ticketeria_ingressos i join public.ticketeria_lotes l on l.ingresso_id = i.id
           where i.evento_id = ((select r from tc.r where k = 'r1') ->> 'evento_id')::uuid),
          'inteira:6000:60,meia:3000:40', 'inteira com 60% dos lugares e meia pela metade do preço com 40%');

-- ─── Festival gratuito: uma sessão por dia ──────────────────────────────────

insert into tc.r select 'r2', public.fn_ticketeria_comecar(tc.id('a0'), 'festival', 'Festival de Inverno', 'Parque da Cidade', null,
                                      500, tc.dia(), '14:00', 3, 0, true);

select is((select array_agg((inicio at time zone 'America/Sao_Paulo')::date - tc.dia() order by inicio)
           from public.ticketeria_sessoes where evento_id = ((select r from tc.r where k = 'r2') ->> 'evento_id')::uuid),
          array[0, 1, 2], 'festival de 3 dias: três sessões em dias seguidos');
select is((select string_agg(i.categoria || ':' || l.preco_centavos || ':' || l.quantidade, ',')
           from public.ticketeria_ingressos i join public.ticketeria_lotes l on l.ingresso_id = i.id
           where i.evento_id = ((select r from tc.r where k = 'r2') ->> 'evento_id')::uuid),
          'gratuito:0:500', 'gratuito: um ingresso a R$ 0 com todos os lugares (a meia não se aplica)');
select is((select perfil from public.ticketeria_lojas where organization_id = tc.id('a0')), 'festival', 'o perfil guarda a última resposta');

-- ─── Espaço: refazer com o mesmo nome não duplica o local ───────────────────

select lives_ok($t$select public.fn_ticketeria_comecar(tc.id('a0'), 'espaco', 'Hamlet', 'casa de cultura ', 'Rio de Janeiro',
                                                       100, tc.dia(), '21:00', null, 8000, true)$t$,
  'espaço: um segundo evento no mesmo lugar');
select is((select count(*)::int from public.ticketeria_locais where organization_id = tc.id('a0') and lower(btrim(nome)) = 'casa de cultura'), 1,
          'o local de mesmo nome é reaproveitado');
select is((select count(*)::int from public.ticketeria_setores s join public.ticketeria_locais lo on lo.id = s.local_id
           where lo.organization_id = tc.id('a0') and lower(btrim(lo.nome)) = 'casa de cultura'), 1, 'e o setor Geral também');

-- ─── Lugares numerados: o evento nasce e o mapa do auditório é montado em seguida (o que a tela faz) ───────────

insert into tc.r select 'r3', public.fn_ticketeria_comecar(tc.id('a0'), 'unico', 'Concerto numerado', 'Sala numerada', 'Sorocaba', 100, tc.dia(), '20:00', null, 6000, true);

select lives_ok($t$select public.fn_ticketeria_salvar_mapa(
    (select s.id from public.ticketeria_setores s where s.local_id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid and s.nome = 'Geral'),
    (select jsonb_agg(jsonb_build_object('nome', chr(64 + f), 'assentos',
              (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, case when f = 7 then 4 else 16 end) n)) order by f)
     from generate_series(1, 7) f), true)$t$,
  'auditório: o mapa de 7 fileiras (16 lugares, a última com 4) é salvo no setor que a função criou, com a meia e a inteira já nos lotes');

select is((select numerado::text || ':' || lugares from public.ticketeria_setores
           where local_id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid and nome = 'Geral'),
          'true:100', 'auditório: o setor fica numerado com os 100 lugares do mapa');
select is((select count(*)::int from public.ticketeria_assentos a join public.ticketeria_setores s on s.id = a.setor_id
           where s.local_id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid), 100, 'auditório: são 100 lugares gravados');
select is((select count(*)::int from public.ticketeria_assentos a join public.ticketeria_setores s on s.id = a.setor_id
           where s.local_id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid and a.fileira = 'G'), 4, 'auditório: a última fileira leva os 4 que sobram');

select lives_ok($t$update public.ticketeria_locais set uf = 'SP' where id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid$t$,
  'o estado escolhido no mapa é gravado no local logo depois de criar o evento');
select is((select uf from public.ticketeria_locais where id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid), 'SP', 'o local guarda o estado');

-- A conferência dos lugares só vale para setor da própria organização (o conserto da migration ticketeria_conferir_lugares_do_editor).
select is(tc.tenta($t$select public.fn_ticketeria_conferir_lugares(
              ((select r from tc.r where k = 'r3') ->> 'evento_id')::uuid,
              (select s.id from public.ticketeria_setores s where s.local_id = ((select r from tc.r where k = 'r3') ->> 'local_id')::uuid and s.nome = 'Geral'))$t$),
          'aceito', 'o editor confere os lugares do setor da própria organização');

select is(tc.tenta($t$select public.fn_ticketeria_conferir_lugares(((select r from tc.r where k = 'r3') ->> 'evento_id')::uuid, tc.id('4b'))$t$),
          'sem_permissao', 'quem edita A não confere os lugares do setor da organização B');

-- ─── Poucos lugares: sem meia ───────────────────────────────────────────────

select is((select (public.fn_ticketeria_comecar(tc.id('a0'), 'unico', 'Sarau', 'Sala pequena', null, 2, tc.dia(), '19:00', null, 2000, true)) ->> 'meia'),
          '0', 'com menos de 3 lugares, não há meia: os 2 ficam na inteira');

-- ─── O que é recusado ───────────────────────────────────────────────────────

select is(tc.tenta($t$select public.fn_ticketeria_comecar(tc.id('a0'), 'unico', 'Ontem', 'Lugar', null, 10, tc.dia() - 31, '20:00', null, 1000, false)$t$),
          'data_no_passado', 'data no passado é recusada');
select is(tc.tenta($t$select public.fn_ticketeria_comecar(tc.id('a0'), 'empresa', 'X', 'Lugar', null, 10, tc.dia(), '20:00', null, 1000, false)$t$),
          'perfil_invalido', 'perfil desconhecido é recusado');
select is(tc.tenta($t$select public.fn_ticketeria_comecar(tc.id('a0'), 'unico', ' ', 'Lugar', null, 10, tc.dia(), '20:00', null, 1000, false)$t$),
          'evento_sem_nome', 'evento sem nome é recusado');
select is(tc.tenta($t$select public.fn_ticketeria_comecar(tc.id('b0'), 'unico', 'Invasão', 'Lugar', null, 10, tc.dia(), '20:00', null, 1000, false)$t$),
          'sem_permissao', 'outra organização: recusado');
reset role;

set local request.jwt.claims = '{"sub":"0d7c0000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(tc.tenta($t$select public.fn_ticketeria_comecar(tc.id('a0'), 'unico', 'Leitor', 'Lugar', null, 10, tc.dia(), '20:00', null, 1000, false)$t$),
          'sem_permissao', 'leitor: recusado');
reset role;
reset request.jwt.claims;

select is(has_function_privilege('anon', 'public.fn_ticketeria_comecar(uuid, text, text, text, text, integer, date, time, integer, integer, boolean)', 'execute'),
          false, 'o visitante não executa a função');
select is(has_function_privilege('authenticated', 'public.fn_ticketeria_comecar(uuid, text, text, text, text, integer, date, time, integer, integer, boolean)', 'execute'),
          true, 'quem está logado executa (as regras de cada tabela decidem o resto)');

select * from finish();
rollback;
