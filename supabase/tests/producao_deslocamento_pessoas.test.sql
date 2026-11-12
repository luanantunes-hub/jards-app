-- PD6.2 (segundo corte): quem vai em cada deslocamento (producao_deslocamento_pessoas).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante), a coerência (deslocamento e pessoa da organização; o que não muda),
-- uma pessoa uma só vez por deslocamento, a pessoa que vai que não se apaga e as chaves. Ids
-- 0d2e0000-0000-4000-8000-0000000000XX, ou dp.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, deslocamento 61, pessoas 51 e 52, passageiro 91 (pessoa 51 no 61); a1 admin,
--   a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada 2b, data 4b, deslocamento 6b, pessoa 5b; b1 admin.
--   C (c0), produção só para leitura: temporada 2c, data 4c, deslocamento 6c, pessoa 5c, passageiro 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_deslocamento_pessoas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

create schema dp;
grant usage on schema dp to authenticated, anon;

create function dp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select dp.id(s), 'dp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (dp.id('a0'), 'DP A'), (dp.id('b0'), 'DP B'), (dp.id('c0'), 'DP C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (dp.id('a0'), 'producao', 'cortesia', 20), (dp.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (dp.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = dp.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select dp.id(o), dp.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (dp.id('a0'), dp.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (dp.id('21'), dp.id('a0'), 'circulacao', 'circula', 'teatro', 'DP T'), (dp.id('2b'), dp.id('b0'), 'circulacao', 'circula', 'teatro', 'DP TB'),
    (dp.id('2c'), dp.id('c0'), 'circulacao', 'circula', 'teatro', 'DP TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (dp.id('41'), dp.id('a0'), dp.id('21'), date '2026-12-05'), (dp.id('4b'), dp.id('b0'), dp.id('2b'), date '2026-12-05'),
    (dp.id('4c'), dp.id('c0'), dp.id('2c'), date '2026-12-05');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (dp.id('51'), dp.id('a0'), 'DP Pessoa 1'), (dp.id('52'), dp.id('a0'), 'DP Pessoa 2'), (dp.id('5b'), dp.id('b0'), 'DP Pessoa B'), (dp.id('5c'), dp.id('c0'), 'DP Pessoa C');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo) values
    (dp.id('61'), dp.id('a0'), dp.id('41'), 'van'), (dp.id('6b'), dp.id('b0'), dp.id('4b'), 'van'), (dp.id('6c'), dp.id('c0'), dp.id('4c'), 'van');
  insert into public.producao_deslocamento_pessoas (id, organization_id, deslocamento_id, pessoa_id) values
    (dp.id('91'), dp.id('a0'), dp.id('61'), dp.id('51')), (dp.id('9c'), dp.id('c0'), dp.id('6c'), dp.id('5c'));
end
$dados$;

create function dp.tenta(comando text) returns text language plpgsql as $$
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

create function dp.efeito(comando text) returns text language plpgsql as $$
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

create function dp.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using dp.id(o || '0');
  return n::text;
end;
$$;

create function dp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', dp.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function dp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamento_pessoas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_deslocamento_pessoas'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_deslocamento_pessoas'::regclass),
          'producao_deslocamento_pessoas_deslocamento_id_fkey=c, producao_deslocamento_pessoas_organization_id_fkey=c, producao_deslocamento_pessoas_pessoa_id_fkey=r',
          'sai com o deslocamento; a pessoa que vai não se apaga');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_deslocamento_pessoa_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_deslocamento_pessoas', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_deslocamento_pessoas'::regclass),
          'producao_deslocamento_pessoas_coerencia', 'o gatilho (sem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select dp.como('a1');
select is(dp.ve('producao_deslocamento_pessoas', 'a'), '1', 'administrador lê');
select dp.como('a2');
select is(dp.ve('producao_deslocamento_pessoas', 'a'), '1', 'colaborador lê');
select dp.como('a3');
select is(dp.ve('producao_deslocamento_pessoas', 'a'), '1', 'leitor lê');
select dp.como('a5');
select is(dp.ve('producao_deslocamento_pessoas', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select dp.como('b1');
select is(dp.ve('producao_deslocamento_pessoas', 'a'), '0', 'outra organização não lê');
select dp.como('c1');
select is(dp.ve('producao_deslocamento_pessoas', 'c'), '1', 'produção só para leitura lê');
select dp.como(null);
select is(dp.efeito('select 1 from public.producao_deslocamento_pessoas'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select dp.como('a2');
select is(dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('52'))), 'aceito', 'colaborador põe uma pessoa no deslocamento');
select is(dp.efeito(format('delete from public.producao_deslocamento_pessoas where id = %L', dp.id('91'))), 'sim', 'colaborador tira uma pessoa do deslocamento');
select dp.como('a3');
select ok(dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('52'))) like '42501%', 'leitor não grava');
select dp.como('c1');
select ok(dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('c0'), dp.id('6c'), dp.id('5c'))) like '42501%', 'produção só para leitura não grava');
select dp.como('a5');
select ok(dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('52'))) like '42501%', 'o recorte "vinculado" sem vínculo não grava');
select dp.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('5b'))),
            dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('6b'), dp.id('51'))),
            dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('51'))),
            dp.tenta(format('update public.producao_deslocamento_pessoas set organization_id = %L where id = %L', dp.id('b0'), dp.id('91'))),
            dp.tenta(format('update public.producao_deslocamento_pessoas set deslocamento_id = %L where id = %L', dp.id('6b'), dp.id('91'))),
            dp.tenta(format('update public.producao_deslocamento_pessoas set pessoa_id = %L where id = %L', dp.id('52'), dp.id('91'))),
            dp.tenta(format('insert into public.producao_deslocamento_pessoas (organization_id, deslocamento_id, pessoa_id) values (%L, %L, %L)', dp.id('a0'), dp.id('61'), dp.id('52')))],
          array['23514 pessoa_de_outra_organizacao', '23514 deslocamento_de_outra_organizacao', '23505 producao_deslocamento_pessoas_pessoa_key',
                '23514 organizacao_nao_muda', '23514 deslocamento_nao_muda', '23514 pessoa_nao_muda', 'aceito'],
          'pessoa e deslocamento da organização, uma pessoa uma só vez por deslocamento e o que não muda');
select is(dp.tenta(format('delete from public.producao_pessoas where id = %L', dp.id('51'))), '23503 producao_deslocamento_pessoas_pessoa_id_fkey', 'a pessoa que vai a um deslocamento não se apaga');

select * from finish();
rollback;
