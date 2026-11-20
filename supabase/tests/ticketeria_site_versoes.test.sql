-- Ticketeria: o histórico de versões das páginas do site (ticketeria_site_versoes, o gatilho de publicar e fn_ticketeria_site_restaurar_versao): publicar guarda a versão (sem repetir a mesma),
-- ficam as 20 mais novas, restaurar troca o rascunho guardando o de antes, só quem edita o site restaura e lê, e nada é escrito de fora.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou tv.id('XX'). Org A (a0, usuário a1 admin da Ticketeria), org B (b0, usuário b1); loja 61, site 71, página 81 (org A).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_site_versoes, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema tv;
grant usage on schema tv to authenticated, anon;

create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;
create function tv.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlstate || ':' || sqlerrm;
end;
$$;
create function tv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;
create function tv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;
create function tv.restaurar(sufixo text, versao uuid) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform tv.como(sufixo);
  begin
    r := public.fn_ticketeria_site_restaurar_versao(versao);
  exception when others then
    perform tv.volta();
    raise;
  end;
  perform tv.volta();
  return r;
end;
$$;
create function tv.blocos(texto text) returns jsonb language sql immutable as $$ select jsonb_build_array(jsonb_build_object('tipo', 'titulo', 'texto', texto)) $$;
create function tv.rascunho(texto text) returns void language sql as $$ update public.ticketeria_site_paginas set blocos = tv.blocos(texto) where id = tv.id('81') $$;
create function tv.publicar() returns void language sql as $$ select public.fn_ticketeria_site_publicar_pagina(tv.id('81')) $$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (tv.id('a1'), 'tv-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()), (tv.id('b1'), 'tv-b1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tv.id('a0'), tv.id('a1'), 'admin', '{ticketeria}'::text[]), (tv.id('b0'), tv.id('b1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A');
  insert into public.ticketeria_sites (id, organization_id, loja_id, nome) values (tv.id('71'), tv.id('a0'), tv.id('61'), 'Site A');
  insert into public.ticketeria_site_paginas (id, organization_id, site_id, slug, titulo, blocos) values (tv.id('81'), tv.id('a0'), tv.id('71'), 'inicio', 'Início', tv.blocos('A'));
end
$dados$;

select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81')), 0, 'uma página sem publicar não tem versão');

-- Publicar guarda; publicar o mesmo não repete.
select tv.publicar();
select is((select count(*)::int || '/' || min(origem) || '/' || (min(blocos::text) = tv.blocos('A')::text)::text from public.ticketeria_site_versoes where pagina_id = tv.id('81')), '1/publicada/true', 'publicar guarda a versão publicada');
select tv.publicar();
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81')), 1, 'publicar de novo o mesmo conteúdo não repete a versão');
select tv.rascunho('B');
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81')), 1, 'mudar só o rascunho não guarda versão');
select tv.publicar();
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81') and origem = 'publicada'), 2, 'publicar outro conteúdo guarda a segunda');
select tv.rascunho('A');
select tv.publicar();
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81') and origem = 'publicada'), 3, 'voltar a publicar um conteúdo antigo (A, B, A) guarda de novo: a última publicada era B');

-- Restaurar (como quem edita).
select tv.rascunho('C');
create table tv.v_antiga as select id from public.ticketeria_site_versoes where pagina_id = tv.id('81') and blocos = tv.blocos('B') order by created_at limit 1;
grant select on tv.v_antiga to authenticated, anon;
create table tv.r1 as select tv.restaurar('a1', (select id from tv.v_antiga)) as r;
select is((select r ->> 'guardado' from tv.r1), 'true', 'o rascunho de antes (C) era diferente: foi guardado');
select is((select blocos::text from public.ticketeria_site_paginas where id = tv.id('81')), tv.blocos('B')::text, 'o rascunho agora é a versão restaurada (B)');
select is((select blocos::text from public.ticketeria_site_versoes where pagina_id = tv.id('81') and origem = 'rascunho_guardado'), tv.blocos('C')::text, 'e o rascunho de antes (C) ficou guardado na lista');
select is((select blocos_publicados::text from public.ticketeria_site_paginas where id = tv.id('81')), tv.blocos('A')::text, 'o que está no ar não mudou');
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81') and origem = 'publicada'), 3, 'restaurar não cria versão publicada');
-- Restaurar a mesma versão com o rascunho já igual: nada a guardar.
create table tv.r2 as select tv.restaurar('a1', (select id from tv.v_antiga)) as r;
select is((select r ->> 'guardado' from tv.r2), 'false', 'rascunho já igual à versão: nada a guardar');
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81') and origem = 'rascunho_guardado'), 1, 'e a lista não ganha linha à toa');
-- Rascunho vazio não vira versão guardada.
update public.ticketeria_site_paginas set blocos = '[]'::jsonb where id = tv.id('81');
create table tv.r3 as select tv.restaurar('a1', (select id from tv.v_antiga)) as r;
select is((select r ->> 'guardado' from tv.r3), 'false', 'rascunho vazio não é guardado');

-- Quem pode.
select tv.como('b1');
select is(tv.erro(format($t$select tv.restaurar('b1', %L)$t$, (select id from tv.v_antiga))), '42501:sem_permissao', 'quem é de outra organização não restaura');
select is((select count(*)::int from public.ticketeria_site_versoes), 0, 'nem lê as versões dos outros');
select tv.volta();
select tv.como('a1');
select is((select count(*)::int > 0 from public.ticketeria_site_versoes where pagina_id = tv.id('81')), true, 'quem edita lê as versões');
select is(tv.erro(format($t$select tv.restaurar('a1', %L)$t$, tv.id('ff'))), 'P0002:versao_inexistente', 'versão que não existe: versao_inexistente');
select is(tv.erro(format($t$insert into public.ticketeria_site_versoes (organization_id, pagina_id, origem, blocos) values (%L, %L, 'publicada', '[]')$t$, tv.id('a0'), tv.id('81'))) ~ '^42501', true, 'ninguém grava versão direto da tela');
select tv.volta();
select tv.como(null);
select is(tv.erro(format($t$select tv.restaurar(null, %L)$t$, (select id from tv.v_antiga))) ~ '^42501', true, 'o visitante não executa a restauração');
select tv.volta();

-- As 20 mais novas.
do $$
begin
  for i in 1..24 loop
    perform tv.rascunho('V' || i);
    perform tv.publicar();
  end loop;
end
$$;
select is((select count(*)::int from public.ticketeria_site_versoes where pagina_id = tv.id('81')), 20, 'ficam só as 20 mais recentes da página');
select is((select blocos::text from public.ticketeria_site_versoes where pagina_id = tv.id('81') order by created_at desc, id desc limit 1), tv.blocos('V24')::text, 'e a mais nova é a última publicada');

-- Funções internas e apagar a página.
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_site_versao_guardar(uuid, text, jsonb, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_site_restaurar_versao(uuid)', 'execute') and has_function_privilege('authenticated', 'public.fn_ticketeria_site_restaurar_versao(uuid)', 'execute'), 'só a restauração é da tela; guardar é interna');
delete from public.ticketeria_site_paginas where id = tv.id('81');
select is((select count(*)::int from public.ticketeria_site_versoes where organization_id = tv.id('a0')), 0, 'apagar a página apaga o histórico dela');

select * from finish();
rollback;
