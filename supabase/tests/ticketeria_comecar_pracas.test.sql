-- Onboarding da Ticketeria: fn_ticketeria_comecar_pracas (migration ticketeria_comecar_pracas): várias datas e várias cidades numa chamada.
--
-- Turnê em duas cidades com datas alternadas, festival gratuito de dias seguidos, o local reaproveitado (mesmo nome e cidade) e o mesmo nome em outra
-- cidade (local novo), o estado gravado, os lugares numerados (o setor volta pronto para o mapa), os erros (data no passado, praça repetida, data repetida,
-- cidade ou estado ausentes, datas demais, lista vazia) e quem pode chamar (editor sim; leitor, outra organização e visitante não).
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou tp.id('XX'). A (a0): ticketeria em cortesia, sem loja; a1 admin, a3 leitor. B (b0): b1 admin.
-- Sem DELETE. Rodar: supabase/tests/README.md, com as migrations ticketeria_comecar, ticketeria_conferir_lugares_do_editor e ticketeria_comecar_pracas na frente.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

create schema tp;
grant usage on schema tp to authenticated, anon;

create function tp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- Dias a partir de hoje, no horário de Brasília: o que o produtor marcaria no calendário.
create function tp.dia(mais integer) returns text language sql stable as $$
  select ((now() at time zone 'America/Sao_Paulo')::date + mais)::text;
$$;

create function tp.tenta(comando text) returns text language plpgsql as $$
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

create table tp.r (k text primary key, r jsonb);
grant select, insert on tp.r to authenticated;
grant execute on function tp.id(text), tp.dia(integer), tp.tenta(text) to authenticated, anon;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tp.id(s), 'tp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tp.id('a0'), 'TP Produtora A'), (tp.id('b0'), 'TP B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tp.id('a0'), 'ticketeria', 'cortesia', 10), (tp.id('b0'), 'ticketeria', 'cortesia', 10);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tp.id(o), tp.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
end
$dados$;

set local request.jwt.claims = '{"sub":"0d7d0000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;

-- ─── Turnê: duas cidades, datas alternadas ──────────────────────────────────

insert into tp.r select 'turne', public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'turne', 'O Auto da Compadecida',
  jsonb_build_array(
    jsonb_build_object('local', 'Teatro Municipal', 'cidade', 'Sorocaba', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(10), tp.dia(12), tp.dia(20))),
    jsonb_build_object('local', 'Teatro Guaíra', 'cidade', 'Curitiba', 'uf', 'PR', 'datas', jsonb_build_array(tp.dia(30), tp.dia(31)))),
  100, '20:00', 6000, true);

select is((select (r ->> 'sessoes')::int from tp.r where k = 'turne'), 5, 'turnê: 5 sessões no total (3 + 2)');
select is((select count(*)::int from public.ticketeria_sessoes where evento_id = ((select r from tp.r where k = 'turne') ->> 'evento_id')::uuid), 5, 'turnê: as 5 sessões estão no banco, num evento só');
select is((select array_agg((s.inicio at time zone 'America/Sao_Paulo')::date::text order by s.inicio) from public.ticketeria_sessoes s
           where s.evento_id = ((select r from tp.r where k = 'turne') ->> 'evento_id')::uuid and s.local_id = (((select r from tp.r where k = 'turne') -> 'pracas' -> 0) ->> 'local_id')::uuid),
          array[tp.dia(10), tp.dia(12), tp.dia(20)], 'turnê: as datas alternadas da primeira cidade ficam como foram marcadas');
select is((select string_agg(lo.cidade || '/' || lo.uf, ',' order by lo.cidade) from public.ticketeria_locais lo where lo.organization_id = tp.id('a0')),
          'Curitiba/PR,Sorocaba/SP', 'turnê: um local por cidade, já com o estado');
select is((select string_agg(lo.cidade || ':' || i.nome || ':' || l.preco_centavos || 'x' || l.quantidade, ',' order by lo.cidade, i.ordem)
           from public.ticketeria_ingressos i join public.ticketeria_lotes l on l.ingresso_id = i.id join public.ticketeria_setores s on s.id = i.setor_id join public.ticketeria_locais lo on lo.id = s.local_id
           where i.evento_id = ((select r from tp.r where k = 'turne') ->> 'evento_id')::uuid),
          'Curitiba:Inteira:6000x60,Curitiba:Meia-entrada:3000x40,Sorocaba:Inteira:6000x60,Sorocaba:Meia-entrada:3000x40', 'turnê: inteira e meia em cada cidade, com 60% e 40% dos lugares');
select is((select perfil from public.ticketeria_lojas where organization_id = tp.id('a0')), 'turne', 'o perfil fica na loja');
select is((select (r -> 'pracas' -> 1 ->> 'sessoes')::int from tp.r where k = 'turne'), 2, 'cada praça diz quantas sessões criou');

-- ─── Festival gratuito, dias seguidos ───────────────────────────────────────

insert into tp.r select 'festival', public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'festival', 'Festival de Inverno',
  jsonb_build_array(jsonb_build_object('local', 'Parque da Cidade', 'cidade', 'Campinas', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(40), tp.dia(41), tp.dia(42)))),
  500, '14:00', 0, true);
select is((select count(*)::int from public.ticketeria_sessoes where evento_id = ((select r from tp.r where k = 'festival') ->> 'evento_id')::uuid), 3, 'festival: uma sessão por dia marcado');
select is((select string_agg(i.categoria || ':' || l.preco_centavos || ':' || l.quantidade, ',') from public.ticketeria_ingressos i join public.ticketeria_lotes l on l.ingresso_id = i.id
           where i.evento_id = ((select r from tp.r where k = 'festival') ->> 'evento_id')::uuid), 'gratuito:0:500', 'festival gratuito: um ingresso a R$ 0 com todos os lugares, sem meia');

-- ─── O local é reaproveitado (mesmo nome e cidade); mesmo nome em outra cidade é outro local ─────

select lives_ok($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'espaco', 'Hamlet',
  jsonb_build_array(jsonb_build_object('local', 'teatro municipal ', 'cidade', 'sorocaba', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(50)))), 100, '21:00', 8000, true)$t$,
  'espaço: um segundo evento no mesmo teatro');
select is((select count(*)::int from public.ticketeria_locais where organization_id = tp.id('a0') and lower(btrim(nome)) = 'teatro municipal'), 1, 'o local de mesmo nome e mesma cidade é reaproveitado');
select lives_ok($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'espaco', 'Outro',
  jsonb_build_array(jsonb_build_object('local', 'Teatro Municipal', 'cidade', 'Campinas', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(60)))), 100, '21:00', 8000, false)$t$,
  'o mesmo nome de teatro em outra cidade');
select is((select count(*)::int from public.ticketeria_locais where organization_id = tp.id('a0') and lower(btrim(nome)) = 'teatro municipal'), 2, 'em outra cidade é outro local');

-- ─── Lugares numerados: o setor volta pronto para montar o mapa ─────────────

insert into tp.r select 'numerado', public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'Concerto numerado',
  jsonb_build_array(jsonb_build_object('local', 'Sala numerada', 'cidade', 'Santos', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(70)))), 100, '20:00', 6000, true);
select is((select (r -> 'pracas' -> 0 ->> 'setor_lugares') || ':' || (r -> 'pracas' -> 0 ->> 'setor_numerado') from tp.r where k = 'numerado'), '100:false', 'o setor volta com os lugares e ainda sem numeração');
select lives_ok($t$select public.fn_ticketeria_salvar_mapa(((select r from tp.r where k = 'numerado') -> 'pracas' -> 0 ->> 'setor_id')::uuid,
    (select jsonb_agg(jsonb_build_object('nome', chr(64 + f), 'assentos',
              (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, case when f = 7 then 4 else 16 end) n)) order by f)
     from generate_series(1, 7) f), true)$t$, 'o mapa de 100 lugares é salvo no setor que a função devolveu');
select is((select numerado::text || ':' || lugares from public.ticketeria_setores where id = ((select r from tp.r where k = 'numerado') -> 'pracas' -> 0 ->> 'setor_id')::uuid), 'true:100', 'o setor fica numerado');

-- ─── O que é recusado ───────────────────────────────────────────────────────

select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(-1)))), 10, '20:00', 1000, false)$t$),
          'data_no_passado', 'data no passado é recusada');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(5), tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'data_repetida', 'data repetida na mesma cidade é recusada');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'turne', 'X', jsonb_build_array(
            jsonb_build_object('local', 'Mesmo', 'cidade', 'Rio', 'uf', 'RJ', 'datas', jsonb_build_array(tp.dia(5))),
            jsonb_build_object('local', 'mesmo', 'cidade', 'rio', 'uf', 'RJ', 'datas', jsonb_build_array(tp.dia(6)))), 10, '20:00', 1000, false)$t$),
          'praca_repetida', 'o mesmo local duas vezes na lista é recusado');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', ' ', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'cidade_sem_nome', 'cidade em branco é recusada');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'sp', 'datas', jsonb_build_array(tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'uf_invalida', 'estado fora do formato é recusado');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', '[]'::jsonb)), 10, '20:00', 1000, false)$t$),
          'sem_data', 'praça sem data é recusada');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', '[]'::jsonb, 10, '20:00', 1000, false)$t$), 'pracas_invalidas', 'lista de praças vazia é recusada');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP',
            'datas', (select jsonb_agg(tp.dia(100 + n)) from generate_series(1, 61) n))), 10, '20:00', 1000, false)$t$), 'datas_demais', 'mais de 60 datas numa praça é recusado');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'empresa', 'X', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'perfil_invalido', 'perfil desconhecido é recusado');
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('b0'), 'unico', 'Invasão', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'sem_permissao', 'outra organização: recusado');
reset role;

-- Nada ficou pela metade: as recusas acima não deixaram evento nem local para trás.
select is((select count(*)::int from public.ticketeria_eventos where organization_id = tp.id('a0') and titulo in ('X', 'Invasão')), 0, 'as chamadas recusadas não deixam evento pela metade');

set local request.jwt.claims = '{"sub":"0d7d0000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(tp.tenta($t$select public.fn_ticketeria_comecar_pracas(tp.id('a0'), 'unico', 'Leitor', jsonb_build_array(jsonb_build_object('local', 'L', 'cidade', 'C', 'uf', 'SP', 'datas', jsonb_build_array(tp.dia(5)))), 10, '20:00', 1000, false)$t$),
          'sem_permissao', 'leitor: recusado');
reset role;
reset request.jwt.claims;

select is(has_function_privilege('anon', 'public.fn_ticketeria_comecar_pracas(uuid, text, text, jsonb, integer, time, integer, boolean)', 'execute'), false, 'o visitante não executa a função');
select is(has_function_privilege('authenticated', 'public.fn_ticketeria_comecar_pracas(uuid, text, text, jsonb, integer, time, integer, boolean)', 'execute'), true, 'quem está logado executa (as regras de cada tabela decidem o resto)');

select * from finish();
rollback;
