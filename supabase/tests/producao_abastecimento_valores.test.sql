-- PD6.4 (segundo corte): o valor pago em cada abastecimento (producao_abastecimento_valores).
--
-- Dinheiro: só lê e escreve quem tem a permissão de dinheiro (quem vê os litros mas não o dinheiro não vê o valor), outra organização não vê,
-- leitor com dinheiro lê mas não grava. Forma: de 0 a 99.999,99; o valor é da mesma organização do abastecimento; a organização não muda;
-- o valor sai com o abastecimento; sem histórico.
-- Ids 0d450000-0000-4000-8000-0000000000XX, ou vd.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, deslocamento 91, abastecimentos 71 (com valor) e 72 (sem valor); a2 colaborador com dinheiro, a3 colaborador
--   sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, temporada 2b, data 4b, deslocamento 9b, abastecimento 7b.
-- Rodar: supabase/tests/README.md, com as migrations producao_abastecimento e producao_abastecimento_valor na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

create schema vd;
grant usage on schema vd to authenticated, anon;

create function vd.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d450000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select vd.id(s), 'vd-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (vd.id('a0'), 'VD A'), (vd.id('b0'), 'VD B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (vd.id('a0'), 'producao', 'cortesia', 20), (vd.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select vd.id(o), vd.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (vd.id('a0'), vd.id('a2'), true, 'organizacao'), (vd.id('a0'), vd.id('a3'), false, 'organizacao'), (vd.id('a0'), vd.id('a4'), true, 'organizacao');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (vd.id('21'), vd.id('a0'), 'circulacao', 'circula', 'teatro', 'VD T'), (vd.id('2b'), vd.id('b0'), 'circulacao', 'circula', 'teatro', 'VD TB');
  insert into public.producao_datas (id, organization_id, temporada_id, data, situacao) values
    (vd.id('41'), vd.id('a0'), vd.id('21'), date '2026-12-05', 'confirmada'), (vd.id('4b'), vd.id('b0'), vd.id('2b'), date '2026-12-05', 'confirmada');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo) values
    (vd.id('91'), vd.id('a0'), vd.id('41'), 'van'), (vd.id('9b'), vd.id('b0'), vd.id('4b'), 'van');
  insert into public.producao_abastecimentos (id, organization_id, deslocamento_id, litros) values
    (vd.id('71'), vd.id('a0'), vd.id('91'), 40), (vd.id('72'), vd.id('a0'), vd.id('91'), 10), (vd.id('7b'), vd.id('b0'), vd.id('9b'), 20);
  insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values
    (vd.id('71'), vd.id('a0'), 240.00), (vd.id('7b'), vd.id('b0'), 120.00);
end
$dados$;

create function vd.tenta(comando text) returns text language plpgsql as $$
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

create function vd.efeito(comando text) returns text language plpgsql as $$
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

create function vd.ve(o text) returns text language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.producao_abastecimento_valores where organization_id = vd.id(o || '0');
  return n::text;
end;
$$;

create function vd.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', vd.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function vd.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimento_valores' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_abastecimento_valores'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_abastecimento_valores'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_abastecimento_valores_abastecimento_id_fkey=c, producao_abastecimento_valores_organization_id_fkey=c', 'o valor sai com o abastecimento');
select ok(not has_table_privilege('anon', 'public.producao_abastecimento_valores', 'select')
          and has_column_privilege('authenticated', 'public.producao_abastecimento_valores', 'valor', 'update')
          and not has_column_privilege('authenticated', 'public.producao_abastecimento_valores', 'organization_id', 'update')
          and not has_column_privilege('authenticated', 'public.producao_abastecimento_valores', 'abastecimento_id', 'update')
          and not has_function_privilege('authenticated', 'public.fn_producao_abastecimento_valor_coerencia()', 'execute'),
          'o visitante não lê, o navegador só muda o valor e a função do gatilho não é chamada de fora');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select vd.como('a2');
select is(vd.ve('a'), '1', 'colaborador com dinheiro lê o valor');
select is(vd.ve('b'), '0', 'e não lê o de outra organização');
select vd.volta();
select vd.como('a3');
select is(vd.ve('a'), '0', 'colaborador sem dinheiro não lê o valor');
select vd.volta();
select vd.como('a4');
select is(vd.ve('a'), '1', 'leitor com dinheiro lê o valor');
select vd.volta();
select vd.como('b1');
select is(vd.ve('a'), '0', 'outra organização não lê');
select vd.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select vd.como('a2');
select is(vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 59.90)', vd.id('72'), vd.id('a0'))), 'aceito', 'colaborador com dinheiro põe o valor');
select is(vd.efeito(format('update public.producao_abastecimento_valores set valor = 61 where abastecimento_id = %L', vd.id('71'))), 'sim', 'e muda o valor');
select vd.volta();
select vd.como('a3');
select ok(vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 10)', vd.id('72'), vd.id('a0'))) like '42501%', 'colaborador sem dinheiro não põe valor');
select is(vd.efeito(format('update public.producao_abastecimento_valores set valor = 1 where abastecimento_id = %L', vd.id('71'))), '', 'nem muda o valor que não vê');
select vd.volta();
select vd.como('a4');
select ok(vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 10)', vd.id('72'), vd.id('a0'))) like '42501%', 'leitor com dinheiro não grava');
select vd.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, -1)', vd.id('72'), vd.id('a0'))),
            vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 100000)', vd.id('72'), vd.id('a0'))),
            vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 10)', vd.id('7b'), vd.id('a0'))),
            vd.tenta(format('insert into public.producao_abastecimento_valores (abastecimento_id, organization_id, valor) values (%L, %L, 5)', vd.id('71'), vd.id('a0'))),
            vd.tenta(format('update public.producao_abastecimento_valores set organization_id = %L where abastecimento_id = %L', vd.id('b0'), vd.id('71')))],
          array['23514 producao_abastecimento_valores_valor_check', '23514 producao_abastecimento_valores_valor_check', '23514 abastecimento_de_outra_organizacao', '23505 producao_abastecimento_valores_pkey', '23514 organizacao_nao_muda'],
          'valor de 0 a 99.999,99; o abastecimento é da organização; um valor por abastecimento; a organização não muda');

-- ─── Com o abastecimento, e sem histórico ───────────────────────────────────

delete from public.producao_abastecimentos where id = vd.id('71');
select is((select count(*)::text from public.producao_abastecimento_valores where abastecimento_id = vd.id('71')), '0', 'apagar o abastecimento leva o valor junto');
select is((select count(*)::text from public.producao_historico where entidade = 'producao_abastecimento_valores'), '0', 'o valor não deixa histórico');

select * from finish();
rollback;
