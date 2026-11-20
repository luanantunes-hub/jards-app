-- PD8.3 (primeiro corte): o link público da programação de um espaço (producao_programacao_links).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante); o hash do código, que o navegador não lê; gerar o link (só o hash
-- fica guardado, o código tem 43 letras); revogar; a forma e a coerência; e as chaves. Ids
-- 0d300000-0000-4000-8000-0000000000XX, ou pg.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço 31, link 71.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem
--   vínculo.  B (b0): espaço 3b; b1 admin.  C (c0), produção só para leitura: espaço 3c, link 7c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_programacao_links na frente se não estiver aplicada. A seção
-- "Chaves" usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

create schema pg;
grant usage on schema pg to authenticated, anon;

create function pg.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d300000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pg.id(s), 'pg-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (pg.id('a0'), 'PG A'), (pg.id('b0'), 'PG B'), (pg.id('c0'), 'PG C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pg.id('a0'), 'producao', 'cortesia', 20), (pg.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pg.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = pg.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pg.id(o), pg.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (pg.id('a0'), pg.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (pg.id('31'), pg.id('a0'), 'PG E1', 'Teatro'), (pg.id('3b'), pg.id('b0'), 'PG EB', 'Teatro'), (pg.id('3c'), pg.id('c0'), 'PG EC', 'Teatro');
  insert into public.producao_programacao_links (id, organization_id, espaco_id, titulo, token_hash) values
    (pg.id('71'), pg.id('a0'), pg.id('31'), 'Programação do teatro', repeat('a', 64)),
    (pg.id('7c'), pg.id('c0'), pg.id('3c'), null, repeat('c', 64));
end
$dados$;

create function pg.tenta(comando text) returns text language plpgsql as $$
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

create function pg.efeito(comando text) returns text language plpgsql as $$
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

create function pg.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_programacao_links where organization_id = pg.id(o || '0'))::text;
$$;

create function pg.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pg.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pg.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create temp table pl_ids (nome text primary key, valor text);
grant all on pl_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_programacao_links'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_programacao_links'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_programacao_links'::regclass),
          'producao_programacao_links_criado_por_fkey=n, producao_programacao_links_espaco_id_fkey=c, producao_programacao_links_organization_id_fkey=c',
          'o link sai com o espaço e a organização; apagar quem criou só solta o autor');
select ok(not has_column_privilege('authenticated', 'public.producao_programacao_links', 'token_hash', 'select')
          and not has_table_privilege('anon', 'public.producao_programacao_links', 'select'), 'o navegador não lê o hash do código e o visitante não toca na tabela');
select ok(not has_function_privilege('anon', 'public.fn_producao_programacao_criar_link(uuid, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_programacao_link_coerencia()', 'execute'), 'o visitante não gera link e a coerência não é chamável');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_programacao_links'::regclass),
          'producao_programacao_links_coerencia producao_programacao_links_updated_at', 'os dois gatilhos (sem histórico: o hash é segredo)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select pg.como('a1');
select is(pg.ve('a'), '1', 'administrador lê os links');
select pg.como('a2');
select is(pg.ve('a'), '1', 'colaborador lê os links');
select pg.como('a3');
select is(pg.ve('a'), '1', 'leitor lê os links');
select pg.como('a5');
select is(pg.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select pg.como('b1');
select is(pg.ve('a'), '0', 'outra organização não lê');
select pg.como('c1');
select is(pg.ve('c'), '1', 'produção só para leitura lê');
select pg.como(null);
select is(pg.efeito('select 1 from public.producao_programacao_links'), '', 'visitante não lê');

-- ─── Gerar e revogar ────────────────────────────────────────────────────────

select pg.como('a2');
insert into pl_ids select 'codigo', public.fn_producao_programacao_criar_link(pg.id('31'), ' Em cartaz ');
select is(pg.tenta(format('select token_hash from public.producao_programacao_links where espaco_id = %L', pg.id('31'))), '42501 permission denied for table producao_programacao_links', 'o navegador não lê o hash');
select pg.volta();
select is((select length(valor) from pl_ids where nome = 'codigo'), 43, 'o código do link tem 43 letras');
select is((select token_hash = encode(extensions.digest((select valor from pl_ids where nome = 'codigo'), 'sha256'), 'hex') and titulo = 'Em cartaz' and criado_por = pg.id('a2')
           from public.producao_programacao_links where espaco_id = pg.id('31') and titulo = 'Em cartaz'), true, 'o banco guarda só o hash, o título sem as pontas e quem criou');
select pg.como('a3');
select ok(pg.tenta(format('select public.fn_producao_programacao_criar_link(%L, %L)', pg.id('31'), 'x')) like '42501%', 'leitor não gera o link');
select pg.como('c1');
select ok(pg.tenta(format('select public.fn_producao_programacao_criar_link(%L, %L)', pg.id('3c'), 'x')) like '42501%', 'produção só para leitura não gera');
select pg.como('a5');
select ok(pg.tenta(format('select public.fn_producao_programacao_criar_link(%L, %L)', pg.id('31'), 'x')) like 'P0002%', 'o recorte sem vínculo nem enxerga o espaço');
select pg.como('a2');
select is(pg.efeito(format('update public.producao_programacao_links set revogado_em = now() where id = %L', pg.id('71'))), 'sim', 'colaborador revoga o link');
select pg.como('a3');
select is(pg.efeito(format('update public.producao_programacao_links set revogado_em = now() where id = %L', pg.id('71'))), '', 'leitor não revoga');
select pg.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            pg.tenta(format('insert into public.producao_programacao_links (organization_id, espaco_id, token_hash, titulo) values (%L, %L, %L, %L)', pg.id('a0'), pg.id('31'), repeat('b', 64), ' ')),
            pg.tenta(format('insert into public.producao_programacao_links (organization_id, espaco_id, token_hash) values (%L, %L, %L)', pg.id('a0'), pg.id('31'), 'abc')),
            pg.tenta(format('insert into public.producao_programacao_links (organization_id, espaco_id, token_hash) values (%L, %L, %L)', pg.id('a0'), pg.id('31'), repeat('a', 64))),
            pg.tenta(format('insert into public.producao_programacao_links (organization_id, espaco_id, token_hash) values (%L, %L, %L)', pg.id('a0'), pg.id('3b'), repeat('d', 64))),
            pg.tenta(format('update public.producao_programacao_links set organization_id = %L where id = %L', pg.id('b0'), pg.id('71'))),
            pg.tenta(format('update public.producao_programacao_links set espaco_id = %L where id = %L', pg.id('3b'), pg.id('71')))],
          array['23514 producao_programacao_links_titulo_check', '23514 producao_programacao_links_token_hash_formato_check', '23505 producao_programacao_links_token_hash_key',
                '23514 espaco_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 espaco_nao_muda'],
          'título e hash (formato e único); espaço da organização; organização e espaço fixos');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_espacos where id = pg.id('31');
select is((select count(*)::int from public.producao_programacao_links where espaco_id = pg.id('31')), 0, 'apagar o espaço leva os links dele');

select * from finish();
rollback;
