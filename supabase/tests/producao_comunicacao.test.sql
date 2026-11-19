-- PD9.5 (primeiro corte): comunicação por data (producao_comunicacao).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), a forma dos dados (tipo da lista, título, texto, endereço https, ao menos um conteúdo, ordem), a coerência
-- (data da organização; o que não muda) e o histórico, que deixa o texto do release de fora.
-- Ids 0d360000-0000-4000-8000-0000000000XX, ou cm.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, item 61; a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: temporada 2b, data 4b; b1 admin.  C (c0), produção só para leitura: temporada 2c, data 4c, item 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_comunicacao na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

create schema cm;
grant usage on schema cm to authenticated, anon;

create function cm.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d360000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cm.id(s), 'cm-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cm.id('a0'), 'CM A'), (cm.id('b0'), 'CM B'), (cm.id('c0'), 'CM C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cm.id('a0'), 'producao', 'cortesia', 20), (cm.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cm.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cm.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cm.id(o), cm.id(p), papel, m::text[] from (values
    ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a5', 'colaborador', '{producao}'),
    ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cm.id('a0'), cm.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (cm.id('21'), cm.id('a0'), 'circulacao', 'circula', 'teatro', 'CM T'), (cm.id('2b'), cm.id('b0'), 'circulacao', 'circula', 'teatro', 'CM TB'),
    (cm.id('2c'), cm.id('c0'), 'circulacao', 'circula', 'teatro', 'CM TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (cm.id('41'), cm.id('a0'), cm.id('21'), date '2026-12-05'), (cm.id('4b'), cm.id('b0'), cm.id('2b'), date '2026-12-05'), (cm.id('4c'), cm.id('c0'), cm.id('2c'), date '2026-12-05');
  insert into public.producao_comunicacao (id, organization_id, data_id, tipo, titulo, texto) values
    (cm.id('61'), cm.id('a0'), cm.id('41'), 'release', 'Release de estreia', 'Sobe o pano em Santos.'),
    (cm.id('6c'), cm.id('c0'), cm.id('4c'), 'arte', 'Cartaz da C', 'texto da C');
end
$dados$;

create function cm.tenta(comando text) returns text language plpgsql as $$
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

create function cm.efeito(comando text) returns text language plpgsql as $$
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

create function cm.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using cm.id(o || '0');
  return n::text;
end;
$$;

create function cm.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', cm.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function cm.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_comunicacao'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_comunicacao'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_comunicacao'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_comunicacao_data_id_fkey=c, producao_comunicacao_organization_id_fkey=c', 'o item sai com a data e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_comunicacao_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_comunicacao', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_comunicacao'::regclass),
          'producao_comunicacao_coerencia producao_comunicacao_historico producao_comunicacao_updated_at', 'os gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select cm.como('a2');
select is(cm.ve('producao_comunicacao', 'a'), '1', 'colaborador lê');
select cm.como('a3');
select is(cm.ve('producao_comunicacao', 'a'), '1', 'leitor lê');
select cm.como('a5');
select is(cm.ve('producao_comunicacao', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select cm.como('b1');
select is(cm.ve('producao_comunicacao', 'a'), '0', 'outra organização não lê');
select cm.como(null);
select is(cm.efeito('select 1 from public.producao_comunicacao'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select cm.como('a2');
select is(cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, tipo, titulo, url) values (%L, %L, %L, %L, %L)', cm.id('a0'), cm.id('41'), 'arte', 'Cartaz', 'https://casa.com.br/cartaz.pdf')), 'aceito', 'colaborador guarda um material');
select cm.como('a3');
select ok(cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, texto) values (%L, %L, %L, %L)', cm.id('a0'), cm.id('41'), 'x', 'y')) like '42501%', 'leitor não grava');
select cm.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, texto, tipo) values (%L, %L, %L, %L, %L)', cm.id('a0'), cm.id('41'), 'x', 'y', 'panfleto')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, texto) values (%L, %L, %L, %L)', cm.id('a0'), cm.id('41'), ' ', 'y')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo) values (%L, %L, %L)', cm.id('a0'), cm.id('41'), 'Sem conteúdo')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, url) values (%L, %L, %L, %L)', cm.id('a0'), cm.id('41'), 'x', 'http://casa.com.br/a.pdf')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, url) values (%L, %L, %L, %L)', cm.id('a0'), cm.id('41'), 'x', 'https://casa.com.br/com espaco.pdf')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, texto, ordem) values (%L, %L, %L, %L, 1000)', cm.id('a0'), cm.id('41'), 'x', 'y')),
            cm.tenta(format('insert into public.producao_comunicacao (organization_id, data_id, titulo, texto) values (%L, %L, %L, %L)', cm.id('a0'), cm.id('4b'), 'x', 'y')),
            cm.tenta(format('update public.producao_comunicacao set organization_id = %L where id = %L', cm.id('b0'), cm.id('61'))),
            cm.tenta(format('update public.producao_comunicacao set data_id = %L where id = %L', cm.id('4b'), cm.id('61')))],
          array['23514 producao_comunicacao_tipo_check', '23514 producao_comunicacao_titulo_check', '23514 producao_comunicacao_conteudo_check',
                '23514 producao_comunicacao_url_check', '23514 producao_comunicacao_url_check', '23514 producao_comunicacao_ordem_check',
                '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 data_nao_muda'],
          'tipo, título, ao menos um conteúdo, endereço https, ordem, data da organização e o que não muda');

-- ─── O histórico ────────────────────────────────────────────────────────────

update public.producao_comunicacao set titulo = 'Release novo', texto = 'Texto que não vai ao histórico' where id = cm.id('61');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = cm.id('61') and acao = 'alterou' and campo in ('titulo', 'texto')),
          'titulo', 'o histórico guarda o título e deixa o texto de fora');

select * from finish();
rollback;
