-- T1 da Ticketeria: a loja do produtor e o site dela (ticketeria_lojas, ticketeria_sites, ticketeria_site_paginas e
-- ticketeria_site_dominios), que vieram da Produção (o desenho de 20261113150000_producao_sites.sql).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, quem não tem a ticketeria no vínculo, outra organização,
-- organização sem a ticketeria e visitante); a loja, que o navegador não apaga e que é uma por organização; o domínio, que o
-- navegador só lê (quem escreve é o servidor, depois de conferir o DNS); publicar a página (o rascunho vira o publicado);
-- a forma (nome, cor, situação, slug, blocos, SEO, domínio e token) e a coerência (loja e site da mesma organização, um site
-- por loja, organização, loja e site fixos); e as chaves. Ids 0d710000-0000-4000-8000-0000000000XX, ou tt.id('XX'). Desfeito no fim.
--   A (a0), ticketeria por cortesia: loja 61, site 71, página 81 (slug inicio, com um bloco), domínio 91 (casa.exemplo.com.br, ativo).
--   a1 admin, a2 colaborador, a3 leitor, a6 colaborador só com a captação no vínculo.
--   B (b0), ticketeria por cortesia: loja 6b, site 7b; b1 admin.   C (c0), só a produção: c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration ticketeria_lojas_site na frente se não estiver aplicada. A última seção
-- ("Chaves") usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

create schema tt;
grant usage on schema tt to authenticated, anon;

create function tt.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d710000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tt.id(s), 'tt-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a6', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (tt.id('a0'), 'TT A'), (tt.id('b0'), 'TT B'), (tt.id('c0'), 'TT C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tt.id('a0'), 'ticketeria', 'cortesia', 20), (tt.id('b0'), 'ticketeria', 'cortesia', 5), (tt.id('c0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tt.id(o), tt.id(p), papel, acesso::text[] from (values
    ('a0', 'a1', 'admin', '{ticketeria}'), ('a0', 'a2', 'colaborador', '{ticketeria}'), ('a0', 'a3', 'leitor', '{ticketeria}'),
    ('a0', 'a6', 'colaborador', '{captacao}'), ('b0', 'b1', 'admin', '{ticketeria}'), ('c0', 'c1', 'colaborador', '{producao}')) as v(o, p, papel, acesso);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tt.id('61'), tt.id('a0'), 'Teatro Central'), (tt.id('6b'), tt.id('b0'), 'Loja B');
  insert into public.ticketeria_sites (id, organization_id, loja_id, nome, titulo) values
    (tt.id('71'), tt.id('a0'), tt.id('61'), 'Site do teatro', 'Teatro Central'), (tt.id('7b'), tt.id('b0'), tt.id('6b'), 'Site da B', null);
  insert into public.ticketeria_site_paginas (id, organization_id, site_id, slug, titulo, blocos) values
    (tt.id('81'), tt.id('a0'), tt.id('71'), 'inicio', 'Início', '[{"tipo":"texto","texto":"Bem-vindo"}]'::jsonb);
  insert into public.ticketeria_site_dominios (id, organization_id, site_id, dominio, situacao, token_verificacao) values
    (tt.id('91'), tt.id('a0'), tt.id('71'), 'casa.exemplo.com.br', 'ativo', repeat('a', 32));
end
$dados$;

create function tt.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function tt.efeito(comando text) returns text language plpgsql as $$
declare linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'CD000', message = linhas::text;
  exception
    when sqlstate 'CD000' then return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then return '';
    when others then return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

create function tt.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tt.id(o || '0');
  return n::text;
end;
$$;

create function tt.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tt.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tt.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select string_agg(tablename || '=' || n, ' ' order by tablename) from (
             select tablename::text, count(*) n from pg_policies where schemaname = 'public' and tablename::text ~ '^ticketeria_(lojas|site)'
               and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true' group by tablename) x),
          'ticketeria_lojas=3 ticketeria_site_dominios=1 ticketeria_site_paginas=4 ticketeria_sites=4', 'as regras de cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.ticketeria_lojas'::regclass, 'public.ticketeria_sites'::regclass, 'public.ticketeria_site_paginas'::regclass, 'public.ticketeria_site_dominios'::regclass) and relrowsecurity), 4, 'segurança por linha ligada nas quatro');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.ticketeria_lojas'::regclass, 'public.ticketeria_sites'::regclass, 'public.ticketeria_site_paginas'::regclass, 'public.ticketeria_site_dominios'::regclass)),
          'ticketeria_lojas.ticketeria_lojas_criado_por_fkey=n, ticketeria_lojas.ticketeria_lojas_organization_id_fkey=c, '
          || 'ticketeria_site_dominios.ticketeria_site_dominios_criado_por_fkey=n, ticketeria_site_dominios.ticketeria_site_dominios_organization_id_fkey=c, ticketeria_site_dominios.ticketeria_site_dominios_site_id_fkey=c, '
          || 'ticketeria_site_paginas.ticketeria_site_paginas_organization_id_fkey=c, ticketeria_site_paginas.ticketeria_site_paginas_site_id_fkey=c, '
          || 'ticketeria_sites.ticketeria_sites_criado_por_fkey=n, ticketeria_sites.ticketeria_sites_loja_id_fkey=c, ticketeria_sites.ticketeria_sites_organization_id_fkey=c',
          'a loja sai com a organização; o site sai com a loja; as páginas e os domínios saem com o site; apagar quem criou só solta o autor');
select ok(has_table_privilege('authenticated', 'public.ticketeria_site_dominios', 'select')
          and not has_table_privilege('authenticated', 'public.ticketeria_site_dominios', 'insert')
          and not has_table_privilege('authenticated', 'public.ticketeria_site_dominios', 'update')
          and not has_table_privilege('authenticated', 'public.ticketeria_site_dominios', 'delete')
          and not has_table_privilege('authenticated', 'public.ticketeria_lojas', 'delete')
          and not has_table_privilege('anon', 'public.ticketeria_site_dominios', 'select')
          and not has_table_privilege('anon', 'public.ticketeria_lojas', 'select')
          and not has_table_privilege('anon', 'public.ticketeria_sites', 'select'), 'o navegador só lê os domínios e não apaga a loja; o visitante não toca em nada');
select ok(not has_function_privilege('anon', 'public.fn_ticketeria_site_publicar_pagina(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.auth_ticketeria_pode(uuid, text)', 'execute')
          and has_function_privilege('authenticated', 'public.auth_ticketeria_pode(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_site_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_site_filho_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_loja_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_updated_at()', 'execute'), 'o visitante não publica nem pergunta; as funções de gatilho não são chamáveis');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.ticketeria_lojas'::regclass, 'public.ticketeria_sites'::regclass, 'public.ticketeria_site_paginas'::regclass, 'public.ticketeria_site_dominios'::regclass)),
          'ticketeria_lojas.ticketeria_lojas_coerencia ticketeria_lojas.ticketeria_lojas_updated_at ticketeria_site_dominios.ticketeria_site_dominios_coerencia ticketeria_site_dominios.ticketeria_site_dominios_updated_at '
          || 'ticketeria_site_paginas.ticketeria_site_paginas_coerencia ticketeria_site_paginas.ticketeria_site_paginas_updated_at ticketeria_sites.ticketeria_sites_coerencia ticketeria_sites.ticketeria_sites_updated_at',
          'os gatilhos de cada tabela (sem histórico nesta fase)');
select is((select string_agg(proname || '=' || prosecdef::text, ' ' order by proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('fn_ticketeria_site_publicar_pagina', 'auth_ticketeria_pode')),
          'auth_ticketeria_pode=true fn_ticketeria_site_publicar_pagina=false', 'publicar roda com as regras de quem chama; a pergunta de acesso lê os vínculos como dona');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select tt.como('a1');
select is(tt.ve('ticketeria_lojas', 'a') || tt.ve('ticketeria_sites', 'a'), '11', 'administrador lê a loja e o site');
select tt.como('a2');
select is(tt.ve('ticketeria_site_paginas', 'a') || tt.ve('ticketeria_site_dominios', 'a'), '11', 'colaborador lê as páginas e os domínios');
select tt.como('a3');
select is(tt.ve('ticketeria_sites', 'a'), '1', 'leitor lê o site');
select tt.como('a6');
select is(tt.ve('ticketeria_lojas', 'a') || tt.ve('ticketeria_sites', 'a') || tt.ve('ticketeria_site_paginas', 'a'), '000', 'quem não tem a ticketeria no vínculo não lê nada');
select tt.como('b1');
select is(tt.ve('ticketeria_sites', 'a') || tt.ve('ticketeria_sites', 'b'), '01', 'outra organização não lê; a própria, sim');
select tt.como('c1');
select is(tt.ve('ticketeria_lojas', 'a') || tt.ve('ticketeria_lojas', 'c'), '00', 'quem só tem a produção não lê a ticketeria');
select tt.como(null);
select is(tt.efeito('select 1 from public.ticketeria_sites'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select tt.como('a2');
select is(tt.efeito(format('update public.ticketeria_sites set titulo = %L where id = %L', 'Teatro Central (novo)', tt.id('71'))), 'sim', 'colaborador altera o site');
select is(tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'agenda', 'Agenda')), 'aceito', 'colaborador cria a página');
select ok(tt.tenta(format('insert into public.ticketeria_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'novo.exemplo.com.br', repeat('b', 32))) like '42501%', 'ninguém logado cadastra domínio: só o servidor');
select is(tt.efeito(format('update public.ticketeria_site_dominios set situacao = %L where id = %L', 'erro', tt.id('91'))), '', 'ninguém logado muda a situação do domínio');
select is(tt.efeito(format('delete from public.ticketeria_lojas where id = %L', tt.id('61'))), '', 'ninguém logado apaga a loja');
select is(tt.tenta(format('insert into public.ticketeria_lojas (organization_id, nome) values (%L, %L)', tt.id('a0'), 'Outra loja')), '23505 ticketeria_lojas_organizacao_key', 'uma loja por organização');
select is((select public.fn_ticketeria_site_publicar_pagina(tt.id('81')) is not null), true, 'colaborador publica a página');
select tt.como('a3');
select ok(tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'x', 'x')) like '42501%', 'leitor não cria página');
select ok(tt.tenta(format('select public.fn_ticketeria_site_publicar_pagina(%L)', tt.id('81'))) like 'P0002%', 'leitor não publica a página');
select tt.como('a6');
select is(tt.efeito(format('update public.ticketeria_sites set titulo = %L where id = %L', 'x', tt.id('71'))), '', 'quem não tem a ticketeria no vínculo não altera');
select tt.como('c1');
select ok(tt.tenta(format('insert into public.ticketeria_lojas (organization_id, nome) values (%L, %L)', tt.id('c0'), 'Loja C')) like '42501%', 'organização sem a ticketeria não cria loja');
select tt.volta();
select is((select blocos_publicados = blocos and publicada_em is not null from public.ticketeria_site_paginas where id = tt.id('81')), true, 'publicar copia o rascunho para o publicado e guarda a hora');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            tt.tenta(format('update public.ticketeria_lojas set nome = %L where id = %L', ' ', tt.id('61'))),
            tt.tenta(format('update public.ticketeria_sites set nome = %L where id = %L', ' ', tt.id('71'))),
            tt.tenta(format('update public.ticketeria_sites set cor = %L where id = %L', 'vermelho', tt.id('71'))),
            tt.tenta(format('update public.ticketeria_sites set situacao = %L where id = %L', 'talvez', tt.id('71'))),
            tt.tenta(format('insert into public.ticketeria_sites (organization_id, loja_id, nome) values (%L, %L, %L)', tt.id('a0'), tt.id('6b'), 'x')),
            tt.tenta(format('insert into public.ticketeria_sites (organization_id, loja_id, nome) values (%L, %L, %L)', tt.id('a0'), tt.id('61'), 'Segundo site')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'Slug Ruim', 'x')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'inicio', 'x')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo, blocos) values (%L, %L, %L, %L, %L::jsonb)', tt.id('a0'), tt.id('71'), 'novo', 'x', '{"a":1}')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo, blocos) values (%L, %L, %L, %L, (select jsonb_agg(1) from generate_series(1, 61)))', tt.id('a0'), tt.id('71'), 'cheio', 'x')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('7b'), 'novo', 'x')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo, descricao) values (%L, %L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'seo1', 'x', ' ')),
            tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo, imagem_url) values (%L, %L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'seo2', 'x', 'http://casa.com.br/a.jpg')),
            tt.tenta(format('insert into public.ticketeria_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'MAIUSCULA.com.br', repeat('b', 32))),
            tt.tenta(format('insert into public.ticketeria_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'novo.exemplo.com.br', 'curto')),
            tt.tenta(format('insert into public.ticketeria_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'casa.exemplo.com.br', repeat('b', 32))),
            tt.tenta(format('update public.ticketeria_lojas set organization_id = %L where id = %L', tt.id('b0'), tt.id('61'))),
            tt.tenta(format('update public.ticketeria_sites set organization_id = %L where id = %L', tt.id('b0'), tt.id('71'))),
            tt.tenta(format('update public.ticketeria_sites set loja_id = %L where id = %L', tt.id('6b'), tt.id('71'))),
            tt.tenta(format('update public.ticketeria_site_paginas set site_id = %L where id = %L', tt.id('7b'), tt.id('81')))],
          array['23514 ticketeria_lojas_nome_check', '23514 ticketeria_sites_nome_check', '23514 ticketeria_sites_cor_check', '23514 ticketeria_sites_situacao_check',
                '23514 loja_de_outra_organizacao', '23505 ticketeria_sites_loja_key',
                '23514 ticketeria_site_paginas_slug_check', '23505 ticketeria_site_paginas_slug_key', '23514 ticketeria_site_paginas_blocos_check', '23514 ticketeria_site_paginas_blocos_check',
                '23514 site_de_outra_organizacao', '23514 ticketeria_site_paginas_descricao_check', '23514 ticketeria_site_paginas_imagem_url_check',
                '23514 ticketeria_site_dominios_dominio_check', '23514 ticketeria_site_dominios_token_check', '23505 ticketeria_site_dominios_dominio_key',
                '23514 organizacao_nao_muda', '23514 organizacao_nao_muda', '23514 loja_nao_muda', '23514 site_nao_muda'],
          'nomes, cor e situação; loja da organização e um site por loja; slug (formato e único) e blocos em lista de até 60; site da organização; SEO; domínio (minúsculo, único) e token; organização, loja e site fixos');

select is(tt.tenta(format('insert into public.ticketeria_site_paginas (organization_id, site_id, slug, titulo, descricao, imagem_url) values (%L, %L, %L, %L, %L, %L)', tt.id('a0'), tt.id('71'), 'seo4', 'x', 'Teatro no centro da cidade', 'https://casa.com.br/capa.jpg')), 'aceito', 'a descrição e a imagem de compartilhamento (https) entram');

-- ─── Chaves (DELETE: pela CLI) ──────────────────────────────────────────────

delete from public.ticketeria_lojas where id = tt.id('61');
select is((select count(*)::int from public.ticketeria_sites where id = tt.id('71')) + (select count(*)::int from public.ticketeria_site_paginas where site_id = tt.id('71'))
          + (select count(*)::int from public.ticketeria_site_dominios where site_id = tt.id('71')), 0, 'apagar a loja leva o site, as páginas e os domínios');

select * from finish();
rollback;
