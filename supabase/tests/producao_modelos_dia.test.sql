-- PD1.7: modelos de dia da organização (producao_modelos_dia).
--
-- Quem lê e quem grava o modelo (administrador, colaborador, leitor, outra organização, produção só para leitura,
-- visitante), a forma dos dados (nome, lista de blocos e o conteúdo de cada bloco), a coerência da organização e o
-- histórico. Ids 0d230000-0000-4000-8000-0000000000XX, ou md.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: modelo M1 (61); a1 admin, a2 colaborador, a3 leitor.
--   B (b0), cortesia: b1 admin.  C (c0), produção só para leitura: modelo (6c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_modelos_dia na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

create schema md;
grant usage on schema md to authenticated, anon;

create function md.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d230000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select md.id(s), 'md-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (md.id('a0'), 'MD A'), (md.id('b0'), 'MD B'), (md.id('c0'), 'MD C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (md.id('a0'), 'producao', 'cortesia', 20), (md.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (md.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = md.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select md.id(o), md.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_modelos_dia (id, organization_id, nome, blocos) values
    (md.id('61'), md.id('a0'), 'Show com passagem de som', '[{"tipo":"montagem","titulo":"Montagem","duracaoMin":120},{"tipo":"show","titulo":"Show","duracaoMin":90}]'::jsonb),
    (md.id('6c'), md.id('c0'), 'Modelo da C', '[{"tipo":"show","titulo":"Show","duracaoMin":60}]'::jsonb);
end
$dados$;

create function md.tenta(comando text) returns text language plpgsql as $$
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

create function md.efeito(comando text) returns text language plpgsql as $$
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

create function md.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_modelos_dia where organization_id = md.id(o || '0'))::text;
$$;

create function md.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', md.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function md.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_modelos_dia'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select relrowsecurity from pg_class where oid = 'public.producao_modelos_dia'::regclass), true, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_modelos_dia'::regclass),
          'producao_modelos_dia_organization_id_fkey=c', 'o modelo sai com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_modelo_dia_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_modelos_dia', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_modelos_dia'::regclass),
          'producao_modelos_dia_coerencia producao_modelos_dia_historico producao_modelos_dia_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select md.como('a1');
select is(md.ve('a'), '1', 'administrador lê');
select md.como('a2');
select is(md.ve('a'), '1', 'colaborador lê');
select md.como('a3');
select is(md.ve('a'), '1', 'leitor lê');
select md.como('b1');
select is(md.ve('a'), '0', 'outra organização não lê');
select md.como('c1');
select is(md.ve('c'), '1', 'produção só para leitura lê');
select md.como(null);
select is(md.efeito('select 1 from public.producao_modelos_dia'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select md.como('a2');
select is(md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)',
                          md.id('a0'), 'Dia de ensaio', '[{"tipo":"ensaio","titulo":"Ensaio","duracaoMin":180}]')), 'aceito', 'colaborador cria o modelo');
select is(md.efeito(format('update public.producao_modelos_dia set nome = %L where id = %L', 'Show completo', md.id('61'))), 'sim', 'colaborador altera');
select md.como('a3');
select ok(md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)',
                          md.id('a0'), 'x', '[{"tipo":"show","titulo":"Show","duracaoMin":60}]')) like '42501%', 'leitor não cria');
select md.como('c1');
select ok(md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)',
                          md.id('c0'), 'x', '[{"tipo":"show","titulo":"Show","duracaoMin":60}]')) like '42501%', 'produção só para leitura não grava');
select md.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), ' ', '[{"tipo":"show","titulo":"S","duracaoMin":60}]')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Vazio', '[]')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Objeto', '{"a":1}')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Show com passagem de som', '[{"tipo":"show","titulo":"S","duracaoMin":60}]')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Sem duração', '[{"tipo":"show","titulo":"S"}]')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Duração zero', '[{"tipo":"show","titulo":"S","duracaoMin":0}]')),
            md.tenta(format('insert into public.producao_modelos_dia (organization_id, nome, blocos) values (%L, %L, %L::jsonb)', md.id('a0'), 'Quebrada', '[{"tipo":"show","titulo":"S","duracaoMin":1.5}]')),
            md.tenta(format('update public.producao_modelos_dia set organization_id = %L where id = %L', md.id('b0'), md.id('61')))],
          array['23514 producao_modelos_dia_nome_check', '23514 producao_modelos_dia_blocos_check', '23514 producao_modelos_dia_blocos_check',
                '23505 producao_modelos_dia_nome_key', '23514 bloco_invalido', '23514 bloco_invalido', '23514 bloco_invalido', '23514 organizacao_nao_muda'],
          'nome, lista de blocos, conteúdo de cada bloco e organização fixa');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_modelos_dia set nome = 'Show com som' where id = md.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = md.id('61') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select md.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_modelos_dia' and entidade_id = md.id('61')) > 0, 'quem lê o modelo lê o histórico dele');
select md.volta();

select * from finish();
rollback;
