-- PD8.6 (segundo corte): o link público das tabelas para a transportadora e a locadora (producao_temporada_links).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante); o hash do código, que o navegador não lê; gerar o link (só o hash fica guardado, o código tem 43 letras; o tipo é
-- `transfers` ou `locacao`, esta só com a temporada ligada a uma obra; o filtro some quando vazio; a validade vai de 1 a 90 dias, padrão 30);
-- revogar; a forma e a coerência; e as chaves. Ids 0d320000-0000-4000-8000-0000000000XX, ou tl.id('XX'). Desfeito no fim.
--   A (a0), cortesia: obra 11, temporada 21 (com a obra), temporada 22 (sem obra), link 71.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o
--   recorte "vinculado" e sem vínculo.  B (b0): temporada 2b; b1 admin.  C (c0), produção só para leitura: temporada 2c, link 7c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_temporada_links na frente se não estiver aplicada. A seção "Chaves" usa DELETE:
-- rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

create schema tl;
grant usage on schema tl to authenticated, anon;

create function tl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d320000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tl.id(s), 'tl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (tl.id('a0'), 'TL A'), (tl.id('b0'), 'TL B'), (tl.id('c0'), 'TL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tl.id('a0'), 'producao', 'cortesia', 20), (tl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (tl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = tl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tl.id(o), tl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (tl.id('a0'), tl.id('a5'), false, 'vinculado');
  insert into public.producao_obras (id, organization_id, tipo, titulo) values (tl.id('11'), tl.id('a0'), 'teatro', 'TL obra');
  insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo) values
    (tl.id('21'), tl.id('a0'), tl.id('11'), 'circulacao', 'circula', 'teatro', 'TL T'), (tl.id('22'), tl.id('a0'), null, 'circulacao', 'circula', 'teatro', 'TL T sem obra'),
    (tl.id('2b'), tl.id('b0'), null, 'circulacao', 'circula', 'teatro', 'TL TB'), (tl.id('2c'), tl.id('c0'), null, 'circulacao', 'circula', 'teatro', 'TL TC');
  insert into public.producao_temporada_links (id, organization_id, temporada_id, tipo, filtro, token_hash, expira_em) values
    (tl.id('71'), tl.id('a0'), tl.id('21'), 'transfers', 'Viação Central', repeat('a', 64), now() + interval '30 days'),
    (tl.id('7c'), tl.id('c0'), tl.id('2c'), 'transfers', null, repeat('c', 64), now() + interval '30 days');
end
$dados$;

create function tl.tenta(comando text) returns text language plpgsql as $$
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

create function tl.efeito(comando text) returns text language plpgsql as $$
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

create function tl.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_temporada_links where organization_id = tl.id(o || '0'))::text;
$$;

create function tl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create temp table tl_ids (nome text primary key, valor text);
grant all on tl_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_temporada_links'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_temporada_links'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_temporada_links'::regclass),
          'producao_temporada_links_criado_por_fkey=n, producao_temporada_links_organization_id_fkey=c, producao_temporada_links_temporada_id_fkey=c',
          'o link sai com a temporada e a organização; apagar quem criou só solta o autor');
select ok(not has_column_privilege('authenticated', 'public.producao_temporada_links', 'token_hash', 'select')
          and not has_table_privilege('anon', 'public.producao_temporada_links', 'select'), 'o navegador não lê o hash do código e o visitante não toca na tabela');
select ok(not has_function_privilege('anon', 'public.fn_producao_temporada_criar_link(uuid, text, text, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_temporada_link_coerencia()', 'execute'), 'o visitante não gera link e a coerência não é chamável');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_temporada_links'::regclass),
          'producao_temporada_links_coerencia producao_temporada_links_updated_at', 'os dois gatilhos (sem histórico: o hash é segredo)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select tl.como('a1');
select is(tl.ve('a'), '1', 'administrador lê os links');
select tl.como('a2');
select is(tl.ve('a'), '1', 'colaborador lê os links');
select tl.como('a3');
select is(tl.ve('a'), '1', 'leitor lê os links');
select tl.como('a5');
select is(tl.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select tl.como('b1');
select is(tl.ve('a'), '0', 'outra organização não lê');
select tl.como('c1');
select is(tl.ve('c'), '1', 'produção só para leitura lê');
select tl.como(null);
select is(tl.efeito('select 1 from public.producao_temporada_links'), '', 'visitante não lê');

-- ─── Gerar e revogar ────────────────────────────────────────────────────────

select tl.como('a2');
insert into tl_ids select 'codigo', public.fn_producao_temporada_criar_link(tl.id('21'), 'transfers', '  Viação Central ', 7);
insert into tl_ids select 'padrao', public.fn_producao_temporada_criar_link(tl.id('21'), 'locacao', '   ', null);
select is(tl.tenta(format('select token_hash from public.producao_temporada_links where temporada_id = %L', tl.id('21'))), '42501 permission denied for table producao_temporada_links', 'o navegador não lê o hash');
select tl.volta();
select is((select length(valor) from tl_ids where nome = 'codigo'), 43, 'o código do link tem 43 letras');
select is((select token_hash = encode(extensions.digest((select valor from tl_ids where nome = 'codigo'), 'sha256'), 'hex') and criado_por = tl.id('a2') and tipo = 'transfers' and filtro = 'Viação Central'
                  and expira_em between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
           from public.producao_temporada_links where temporada_id = tl.id('21') and tipo = 'transfers' and id <> tl.id('71')),
          true, 'o banco guarda só o hash, quem criou, o tipo, o filtro sem as pontas e a validade pedida (7 dias)');
select is((select filtro is null and expira_em between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' from public.producao_temporada_links where temporada_id = tl.id('21') and tipo = 'locacao'),
          true, 'filtro só de espaços vira nulo, e sem validade informada vale 30 dias');
select is(array[tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('21'), 'hotel')),
                tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 91)', tl.id('21'), 'transfers')),
                tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, -1)', tl.id('21'), 'transfers')),
                tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, %L, 7)', tl.id('21'), 'transfers', repeat('x', 121))),
                tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('22'), 'locacao')),
                tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('22'), 'transfers'))],
          array['P0001 tipo_invalido', 'P0001 validade_invalida', 'P0001 validade_invalida', 'P0001 filtro_invalido', 'P0001 temporada_sem_obra', 'aceito'],
          'tipo da lista, validade de 1 a 90 dias, filtro de até 120 letras; a locação pede a temporada ligada a uma obra');
select tl.como('a3');
select ok(tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('21'), 'transfers')) like '42501%', 'leitor não gera o link');
select tl.como('c1');
select ok(tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('2c'), 'transfers')) like '42501%', 'produção só para leitura não gera');
select tl.como('a5');
select ok(tl.tenta(format('select public.fn_producao_temporada_criar_link(%L, %L, null, 7)', tl.id('21'), 'transfers')) like 'P0002%', 'o recorte sem vínculo nem enxerga a temporada');
select tl.como('a2');
select is(tl.efeito(format('update public.producao_temporada_links set revogado_em = now() where id = %L', tl.id('71'))), 'sim', 'colaborador revoga o link');
select tl.como('a3');
select is(tl.efeito(format('update public.producao_temporada_links set revogado_em = now() where id = %L', tl.id('71'))), '', 'leitor não revoga');
select tl.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            tl.tenta(format('insert into public.producao_temporada_links (organization_id, temporada_id, tipo, token_hash, expira_em) values (%L, %L, %L, %L, now())', tl.id('a0'), tl.id('21'), 'hotel', repeat('b', 64))),
            tl.tenta(format('insert into public.producao_temporada_links (organization_id, temporada_id, tipo, token_hash, expira_em) values (%L, %L, %L, %L, now())', tl.id('a0'), tl.id('21'), 'transfers', 'abc')),
            tl.tenta(format('insert into public.producao_temporada_links (organization_id, temporada_id, tipo, token_hash, expira_em) values (%L, %L, %L, %L, now())', tl.id('a0'), tl.id('21'), 'transfers', repeat('a', 64))),
            tl.tenta(format('insert into public.producao_temporada_links (organization_id, temporada_id, tipo, filtro, token_hash, expira_em) values (%L, %L, %L, %L, %L, now())', tl.id('a0'), tl.id('21'), 'transfers', ' ', repeat('d', 64))),
            tl.tenta(format('insert into public.producao_temporada_links (organization_id, temporada_id, tipo, token_hash, expira_em) values (%L, %L, %L, %L, now())', tl.id('a0'), tl.id('2b'), 'transfers', repeat('e', 64))),
            tl.tenta(format('update public.producao_temporada_links set organization_id = %L where id = %L', tl.id('b0'), tl.id('71'))),
            tl.tenta(format('update public.producao_temporada_links set temporada_id = %L where id = %L', tl.id('2b'), tl.id('71')))],
          array['23514 producao_temporada_links_tipo_check', '23514 producao_temporada_links_token_hash_formato_check', '23505 producao_temporada_links_token_hash_key',
                '23514 producao_temporada_links_filtro_check', '23514 temporada_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 temporada_nao_muda'],
          'tipo, hash (formato e único) e filtro; temporada da organização; organização e temporada fixas');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_temporadas where id = tl.id('21');
select is((select count(*)::int from public.producao_temporada_links where temporada_id = tl.id('21')), 0, 'apagar a temporada leva os links dela');

select * from finish();
rollback;
