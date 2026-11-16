-- PD3.5 (segundo corte): o link público da ficha técnica de um espaço (producao_ficha_links).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção
-- só para leitura e visitante); o hash do código, que o navegador não lê; gerar o link (só o hash fica guardado, o código tem 43 letras,
-- a validade vai de 1 a 90 dias, padrão 30); revogar; a forma e a coerência; e as chaves. Ids
-- 0d340000-0000-4000-8000-0000000000XX, ou fl.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço 61, link 71.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0): espaço 6b; b1 admin.  C (c0), produção só para leitura: espaço 6c, link 7c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_ficha_links na frente se não estiver aplicada. A seção "Chaves" usa DELETE:
-- rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

create schema fl;
grant usage on schema fl to authenticated, anon;

create function fl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d340000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select fl.id(s), 'fl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (fl.id('a0'), 'FL A'), (fl.id('b0'), 'FL B'), (fl.id('c0'), 'FL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (fl.id('a0'), 'producao', 'cortesia', 20), (fl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (fl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = fl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select fl.id(o), fl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (fl.id('a0'), fl.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (fl.id('61'), fl.id('a0'), 'FL Espaço A', 'Teatro'), (fl.id('6b'), fl.id('b0'), 'FL Espaço B', 'Teatro'), (fl.id('6c'), fl.id('c0'), 'FL Espaço C', 'Teatro');
  insert into public.producao_ficha_links (id, organization_id, espaco_id, token_hash, expira_em) values
    (fl.id('71'), fl.id('a0'), fl.id('61'), repeat('a', 64), now() + interval '30 days'),
    (fl.id('7c'), fl.id('c0'), fl.id('6c'), repeat('c', 64), now() + interval '30 days');
end
$dados$;

create function fl.tenta(comando text) returns text language plpgsql as $$
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

create function fl.efeito(comando text) returns text language plpgsql as $$
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

create function fl.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_ficha_links where organization_id = fl.id(o || '0'))::text;
$$;

create function fl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', fl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function fl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create temp table fl_ids (nome text primary key, valor text);
grant all on fl_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_ficha_links'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_ficha_links'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_ficha_links'::regclass),
          'producao_ficha_links_criado_por_fkey=n, producao_ficha_links_espaco_id_fkey=c, producao_ficha_links_organization_id_fkey=c',
          'o link sai com a espaço e a organização; apagar quem criou só solta o autor');
select ok(not has_column_privilege('authenticated', 'public.producao_ficha_links', 'token_hash', 'select')
          and not has_table_privilege('anon', 'public.producao_ficha_links', 'select'), 'o navegador não lê o hash do código e o visitante não toca na tabela');
select ok(not has_function_privilege('anon', 'public.fn_producao_ficha_criar_link(uuid, integer, boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_ficha_link_coerencia()', 'execute'), 'o visitante não gera link e a coerência não é chamável');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_ficha_links'::regclass),
          'producao_ficha_links_coerencia producao_ficha_links_updated_at', 'os dois gatilhos (sem histórico: o hash é segredo)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select fl.como('a1');
select is(fl.ve('a'), '1', 'administrador lê os links');
select fl.como('a2');
select is(fl.ve('a'), '1', 'colaborador lê os links');
select fl.como('a3');
select is(fl.ve('a'), '1', 'leitor lê os links');
select fl.como('a5');
select is(fl.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select fl.como('b1');
select is(fl.ve('a'), '0', 'outra organização não lê');
select fl.como('c1');
select is(fl.ve('c'), '1', 'produção só para leitura lê');
select fl.como(null);
select is(fl.efeito('select 1 from public.producao_ficha_links'), '', 'visitante não lê');

-- ─── Gerar e revogar ────────────────────────────────────────────────────────

select fl.como('a2');
insert into fl_ids select 'codigo', public.fn_producao_ficha_criar_link(fl.id('61'), 7, false);
insert into fl_ids select 'padrao', public.fn_producao_ficha_criar_link(fl.id('61'), null, false);
select is(fl.tenta(format('select token_hash from public.producao_ficha_links where espaco_id = %L', fl.id('61'))), '42501 permission denied for table producao_ficha_links', 'o navegador não lê o hash');
select fl.volta();
select is((select length(valor) from fl_ids where nome = 'codigo'), 43, 'o código do link tem 43 letras');
select is((select token_hash = encode(extensions.digest((select valor from fl_ids where nome = 'codigo'), 'sha256'), 'hex') and criado_por = fl.id('a2')
                  and expira_em between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
           from public.producao_ficha_links where espaco_id = fl.id('61') and expira_em < now() + interval '8 days' and id <> fl.id('71')),
          true, 'o banco guarda só o hash, quem criou e a validade pedida (7 dias)');
select is((select count(*)::int from public.producao_ficha_links where espaco_id = fl.id('61') and expira_em between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' and id <> fl.id('71')),
          1, 'sem validade informada, vale 30 dias');
insert into fl_ids select 'comcontato', public.fn_producao_ficha_criar_link(fl.id('61'), 7, true);
select fl.volta();
select is((select count(*)::int from public.producao_ficha_links where espaco_id = fl.id('61') and incluir_contato), 1, 'o contato só entra no link se foi pedido');
select is((select count(*)::int from public.producao_ficha_links where espaco_id = fl.id('61') and not incluir_contato and id <> fl.id('71')), 2, 'sem pedir, o contato não entra (padrão)');
select fl.como('a2');
select is(array[fl.tenta(format('select public.fn_producao_ficha_criar_link(%L, %s, false)', fl.id('61'), 91)), fl.tenta(format('select public.fn_producao_ficha_criar_link(%L, %s, false)', fl.id('61'), -1))],
          array['P0001 validade_invalida', 'P0001 validade_invalida'], 'a validade vai de 1 a 90 dias');
select fl.como('a3');
select ok(fl.tenta(format('select public.fn_producao_ficha_criar_link(%L, %s, false)', fl.id('61'), 7)) like '42501%', 'leitor não gera o link');
select fl.como('c1');
select ok(fl.tenta(format('select public.fn_producao_ficha_criar_link(%L, %s, false)', fl.id('6c'), 7)) like '42501%', 'produção só para leitura não gera');
select fl.como('a5');
select ok(fl.tenta(format('select public.fn_producao_ficha_criar_link(%L, %s, false)', fl.id('61'), 7)) like 'P0002%', 'o recorte sem vínculo nem enxerga a espaço');
select fl.como('a2');
select is(fl.efeito(format('update public.producao_ficha_links set revogado_em = now() where id = %L', fl.id('71'))), 'sim', 'colaborador revoga o link');
select fl.como('a3');
select is(fl.efeito(format('update public.producao_ficha_links set revogado_em = now() where id = %L', fl.id('71'))), '', 'leitor não revoga');
select fl.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            fl.tenta(format('insert into public.producao_ficha_links (organization_id, espaco_id, token_hash, expira_em) values (%L, %L, %L, now())', fl.id('a0'), fl.id('61'), 'abc')),
            fl.tenta(format('insert into public.producao_ficha_links (organization_id, espaco_id, token_hash, expira_em) values (%L, %L, %L, now())', fl.id('a0'), fl.id('61'), repeat('a', 64))),
            fl.tenta(format('insert into public.producao_ficha_links (organization_id, espaco_id, token_hash, expira_em) values (%L, %L, %L, now())', fl.id('a0'), fl.id('6b'), repeat('d', 64))),
            fl.tenta(format('update public.producao_ficha_links set organization_id = %L where id = %L', fl.id('b0'), fl.id('71'))),
            fl.tenta(format('update public.producao_ficha_links set espaco_id = %L where id = %L', fl.id('6b'), fl.id('71')))],
          array['23514 producao_ficha_links_token_hash_formato_check', '23505 producao_ficha_links_token_hash_key',
                '23514 espaco_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 espaco_nao_muda'],
          'hash (formato e único); espaço da organização; organização e espaço fixas');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_espacos where id = fl.id('61');
select is((select count(*)::int from public.producao_ficha_links where espaco_id = fl.id('61')), 0, 'apagar o espaço leva os links dele');

select * from finish();
rollback;
