-- PD12.1 e PD12.1b: o site do espaço e o domínio da pessoa (producao_sites, producao_site_paginas e producao_site_dominios).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante); o domínio, que o navegador só lê (quem escreve é o servidor, depois de
-- conferir o DNS); publicar a página (o rascunho vira o publicado); a forma (cor, situação, slug, blocos, domínio e token) e a
-- coerência; o histórico, que deixa o JSON dos blocos de fora; e as chaves. Ids 0d310000-0000-4000-8000-0000000000XX, ou
-- st.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço 31, site 71, página 81 (slug inicio, com um bloco), domínio 91 (casa.exemplo.com.br, ativo).
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): espaço 3b; b1 admin.
--   C (c0), produção só para leitura: espaço 3c, site 7c, página 8c, domínio 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_sites na frente se não estiver aplicada. A seção "Chaves"
-- usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema st;
grant usage on schema st to authenticated, anon;

create function st.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d310000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select st.id(s), 'st-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (st.id('a0'), 'ST A'), (st.id('b0'), 'ST B'), (st.id('c0'), 'ST C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (st.id('a0'), 'producao', 'cortesia', 20), (st.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (st.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = st.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select st.id(o), st.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (st.id('a0'), st.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (st.id('31'), st.id('a0'), 'ST E1', 'Teatro'), (st.id('3b'), st.id('b0'), 'ST EB', 'Teatro'), (st.id('3c'), st.id('c0'), 'ST EC', 'Teatro');
  insert into public.producao_sites (id, organization_id, espaco_id, nome, titulo) values
    (st.id('71'), st.id('a0'), st.id('31'), 'Site do teatro', 'Teatro Central'), (st.id('7c'), st.id('c0'), st.id('3c'), 'Site da C', null);
  insert into public.producao_site_paginas (id, organization_id, site_id, slug, titulo, blocos) values
    (st.id('81'), st.id('a0'), st.id('71'), 'inicio', 'Início', '[{"tipo":"texto","texto":"Bem-vindo"}]'::jsonb),
    (st.id('8c'), st.id('c0'), st.id('7c'), 'inicio', 'Início', '[]'::jsonb);
  insert into public.producao_site_dominios (id, organization_id, site_id, dominio, situacao, token_verificacao) values
    (st.id('91'), st.id('a0'), st.id('71'), 'casa.exemplo.com.br', 'ativo', repeat('a', 32)),
    (st.id('9c'), st.id('c0'), st.id('7c'), 'outra.exemplo.com.br', 'aguardando', repeat('c', 32));
end
$dados$;

create function st.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function st.efeito(comando text) returns text language plpgsql as $$
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

create function st.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using st.id(o || '0');
  return n::text;
end;
$$;

create function st.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', st.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function st.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_sites', 'producao_site_paginas', 'producao_site_dominios')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_sites'::regclass, 'public.producao_site_paginas'::regclass, 'public.producao_site_dominios'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_sites'::regclass, 'public.producao_site_paginas'::regclass, 'public.producao_site_dominios'::regclass)),
          'producao_site_dominios.producao_site_dominios_criado_por_fkey=n, producao_site_dominios.producao_site_dominios_organization_id_fkey=c, producao_site_dominios.producao_site_dominios_site_id_fkey=c, '
          || 'producao_site_paginas.producao_site_paginas_organization_id_fkey=c, producao_site_paginas.producao_site_paginas_site_id_fkey=c, '
          || 'producao_sites.producao_sites_criado_por_fkey=n, producao_sites.producao_sites_espaco_id_fkey=c, producao_sites.producao_sites_organization_id_fkey=c',
          'o site sai com o espaço; as páginas e os domínios saem com o site; apagar quem criou só solta o autor');
select ok(has_table_privilege('authenticated', 'public.producao_site_dominios', 'select')
          and not has_table_privilege('authenticated', 'public.producao_site_dominios', 'insert')
          and not has_table_privilege('authenticated', 'public.producao_site_dominios', 'update')
          and not has_table_privilege('authenticated', 'public.producao_site_dominios', 'delete')
          and not has_table_privilege('anon', 'public.producao_site_dominios', 'select'), 'o navegador só lê os domínios: quem escreve é o servidor');
select ok(not has_function_privilege('anon', 'public.fn_producao_site_publicar_pagina(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_site_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_site_filho_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_sites', 'select'), 'o visitante não publica, as coerências não são chamáveis e o visitante não toca no site');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_sites'::regclass, 'public.producao_site_paginas'::regclass, 'public.producao_site_dominios'::regclass)),
          'producao_site_dominios.producao_site_dominios_coerencia producao_site_dominios.producao_site_dominios_updated_at producao_site_paginas.producao_site_paginas_coerencia '
          || 'producao_site_paginas.producao_site_paginas_historico producao_site_paginas.producao_site_paginas_updated_at producao_sites.producao_sites_coerencia '
          || 'producao_sites.producao_sites_historico producao_sites.producao_sites_updated_at', 'os gatilhos de cada tabela (o domínio não tem histórico)');
select is((select count(*)::int from pg_proc where proname = 'fn_producao_site_publicar_pagina' and prosecdef), 0, 'publicar roda com as regras de quem chama (security invoker)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select st.como('a1');
select is(st.ve('producao_sites', 'a'), '1', 'administrador lê o site');
select st.como('a2');
select is(st.ve('producao_sites', 'a'), '1', 'colaborador lê o site');
select is(st.ve('producao_site_paginas', 'a') || st.ve('producao_site_dominios', 'a'), '11', 'colaborador lê as páginas e os domínios');
select st.como('a3');
select is(st.ve('producao_sites', 'a'), '1', 'leitor lê o site');
select st.como('a5');
select is(st.ve('producao_sites', 'a') || st.ve('producao_site_paginas', 'a') || st.ve('producao_site_dominios', 'a'), '000', 'o recorte "vinculado" sem vínculo não lê nada do site');
select st.como('b1');
select is(st.ve('producao_sites', 'a'), '0', 'outra organização não lê');
select st.como('c1');
select is(st.ve('producao_sites', 'c'), '1', 'produção só para leitura lê');
select st.como(null);
select is(st.efeito('select 1 from public.producao_sites'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select st.como('a2');
select is(st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('a0'), st.id('31'), 'Outro site')), 'aceito', 'colaborador cria o site');
select is(st.efeito(format('update public.producao_sites set titulo = %L where id = %L', 'Teatro Central (novo)', st.id('71'))), 'sim', 'colaborador altera o site');
select is(st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'programacao', 'Programação')), 'aceito', 'colaborador cria a página');
select ok(st.tenta(format('insert into public.producao_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'novo.exemplo.com.br', repeat('b', 32))) like '42501%', 'ninguém logado cadastra domínio: só o servidor');
select is(st.efeito(format('update public.producao_site_dominios set situacao = %L where id = %L', 'ativo', st.id('91'))), '', 'ninguém logado muda a situação do domínio');
select is((select public.fn_producao_site_publicar_pagina(st.id('81')) is not null), true, 'colaborador publica a página');
select st.como('a3');
select ok(st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('a0'), st.id('31'), 'x')) like '42501%', 'leitor não cria o site');
select ok(st.tenta(format('select public.fn_producao_site_publicar_pagina(%L)', st.id('81'))) like 'P0002%', 'leitor não publica a página');
select st.como('c1');
select ok(st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('c0'), st.id('3c'), 'x')) like '42501%', 'produção só para leitura não grava');
select st.como('a5');
select ok(st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('a0'), st.id('31'), 'x')) like '42501%', 'o recorte sem vínculo não grava');
select st.volta();
select is((select blocos_publicados = blocos and publicada_em is not null from public.producao_site_paginas where id = st.id('81')), true, 'publicar copia o rascunho para o publicado e guarda a hora');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('a0'), st.id('31'), ' ')),
            st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome, cor) values (%L, %L, %L, %L)', st.id('a0'), st.id('31'), 'x', 'vermelho')),
            st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome, situacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('31'), 'x', 'talvez')),
            st.tenta(format('insert into public.producao_sites (organization_id, espaco_id, nome) values (%L, %L, %L)', st.id('a0'), st.id('3b'), 'x')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'Slug Ruim', 'x')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'inicio', 'x')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, blocos) values (%L, %L, %L, %L, %L::jsonb)', st.id('a0'), st.id('71'), 'novo', 'x', '{"a":1}')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, blocos) values (%L, %L, %L, %L, (select jsonb_agg(1) from generate_series(1, 61)))', st.id('a0'), st.id('71'), 'cheio', 'x')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo) values (%L, %L, %L, %L)', st.id('a0'), st.id('7c'), 'novo', 'x')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, descricao) values (%L, %L, %L, %L, %L)', st.id('a0'), st.id('71'), 'seo1', 'x', ' ')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, imagem_url) values (%L, %L, %L, %L, %L)', st.id('a0'), st.id('71'), 'seo2', 'x', 'http://casa.com.br/a.jpg')),
            st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, descricao) values (%L, %L, %L, %L, repeat(%L, 301))', st.id('a0'), st.id('71'), 'seo3', 'x', 'a')),
            st.tenta(format('insert into public.producao_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'MAIUSCULA.com.br', repeat('b', 32))),
            st.tenta(format('insert into public.producao_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'semponto', repeat('b', 32))),
            st.tenta(format('insert into public.producao_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'novo.exemplo.com.br', 'curto')),
            st.tenta(format('insert into public.producao_site_dominios (organization_id, site_id, dominio, token_verificacao) values (%L, %L, %L, %L)', st.id('a0'), st.id('71'), 'casa.exemplo.com.br', repeat('b', 32))),
            st.tenta(format('update public.producao_sites set organization_id = %L where id = %L', st.id('b0'), st.id('71'))),
            st.tenta(format('update public.producao_site_paginas set site_id = %L where id = %L', st.id('7c'), st.id('81')))],
          array['23514 producao_sites_nome_check', '23514 producao_sites_cor_check', '23514 producao_sites_situacao_check', '23514 espaco_de_outra_organizacao',
                '23514 producao_site_paginas_slug_check', '23505 producao_site_paginas_slug_key', '23514 producao_site_paginas_blocos_check', '23514 producao_site_paginas_blocos_check', '23514 site_de_outra_organizacao', '23514 producao_site_paginas_descricao_check', '23514 producao_site_paginas_imagem_url_check', '23514 producao_site_paginas_descricao_check',
                '23514 producao_site_dominios_dominio_check', '23514 producao_site_dominios_dominio_check', '23514 producao_site_dominios_token_check', '23505 producao_site_dominios_dominio_key',
                '23514 organizacao_nao_muda', '23514 site_nao_muda'],
          'nome, cor e situação do site; espaço da organização; slug (formato e único) e blocos em lista de até 60; site da organização; domínio (minúsculo, com ponto, único) e token; organização e site fixos');

select is(st.tenta(format('insert into public.producao_site_paginas (organization_id, site_id, slug, titulo, descricao, imagem_url) values (%L, %L, %L, %L, %L, %L)', st.id('a0'), st.id('71'), 'seo4', 'x', 'Teatro no centro da cidade', 'https://casa.com.br/capa.jpg')), 'aceito', 'a descrição e a imagem de compartilhamento (https) entram');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_sites set nome = 'Site do teatro (v2)' where id = st.id('71');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_sites' and entidade_id = st.id('71') and acao = 'alterou' and campo = 'nome'), 'nome', 'mudar o nome do site deixa uma linha de histórico');
update public.producao_site_paginas set blocos = '[{"tipo":"texto","texto":"Mudou"}]'::jsonb, titulo = 'Início (v2)' where id = st.id('81');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_site_paginas' and entidade_id = st.id('81') and acao = 'alterou'), 'publicada_em,titulo', 'o histórico da página guarda a publicação e o título e deixa o JSON dos blocos (rascunho e publicado) de fora');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_sites where id = st.id('71');
select is((select count(*)::int from public.producao_site_paginas where site_id = st.id('71')) + (select count(*)::int from public.producao_site_dominios where site_id = st.id('71')), 0, 'apagar o site leva as páginas e os domínios dele');

select * from finish();
rollback;
