-- PD4.4 (primeiro corte): a lista do que levar (producao_rider_item_equipamentos): a ligação entre a linha do rider e o equipamento da casa que a atende.
--
-- Quem lê e quem grava (administrador, colaborador, leitor, outra organização, produção só para leitura); as regras (as duas pontas da mesma organização, a ligação não
-- muda, a mesma linha liga a um equipamento uma vez); e as chaves (apagar a linha do rider ou o equipamento leva a ligação).
-- Ids 0d4f0000-0000-4000-8000-0000000000XX, ou lv.id('XX'). Desfeito no fim.
--   A (a0), cortesia: espaço E (31), equipamento Q1 (41) e Q2 (42); rider R (71) com as linhas I1 (81) e I2 (82); ligação L1 (91: I1 com Q1). a1 admin, a2 colaborador, a3 leitor.
--   B (b0): espaço (3b), equipamento (4b), rider (7b), linha (8b); b1 admin.  C (c0), produção só para leitura: espaço (3c), equipamento (4c), rider (7c), linha (8c), ligação (9c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_rider_item_equipamentos na frente se não estiver aplicada. A seção "Chaves" usa DELETE: rode pela CLI
-- (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

create schema lv;
grant usage on schema lv to authenticated, anon;

create function lv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d4f0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select lv.id(s), 'lv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (lv.id('a0'), 'LV A'), (lv.id('b0'), 'LV B'), (lv.id('c0'), 'LV C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (lv.id('a0'), 'producao', 'cortesia', 20), (lv.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (lv.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = lv.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select lv.id(o), lv.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (lv.id('31'), lv.id('a0'), 'LV E1', 'Teatro'), (lv.id('3b'), lv.id('b0'), 'LV EB', 'Teatro'), (lv.id('3c'), lv.id('c0'), 'LV EC', 'Teatro');
  insert into public.producao_equipamentos (id, organization_id, espaco_id, nome, quantidade) values
    (lv.id('41'), lv.id('a0'), lv.id('31'), 'Refletor PAR', 6), (lv.id('42'), lv.id('a0'), lv.id('31'), 'Mesa de som', 1),
    (lv.id('4b'), lv.id('b0'), lv.id('3b'), 'Equipamento B', 1), (lv.id('4c'), lv.id('c0'), lv.id('3c'), 'Equipamento C', 1);
  insert into public.producao_riders (id, organization_id, nome) values
    (lv.id('71'), lv.id('a0'), 'Rider A'), (lv.id('7b'), lv.id('b0'), 'Rider B'), (lv.id('7c'), lv.id('c0'), 'Rider C');
  insert into public.producao_rider_itens (id, organization_id, rider_id, secao, texto, quantidade) values
    (lv.id('81'), lv.id('a0'), lv.id('71'), 'luz', '6 refletores PAR', 6), (lv.id('82'), lv.id('a0'), lv.id('71'), 'som', 'Mesa de som', 1),
    (lv.id('8b'), lv.id('b0'), lv.id('7b'), 'luz', 'Item B', 1), (lv.id('8c'), lv.id('c0'), lv.id('7c'), 'luz', 'Item C', 1);
  insert into public.producao_rider_item_equipamentos (id, organization_id, rider_item_id, equipamento_id) values
    (lv.id('91'), lv.id('a0'), lv.id('81'), lv.id('41')),
    (lv.id('9c'), lv.id('c0'), lv.id('8c'), lv.id('4c'));
end
$dados$;

create function lv.tenta(comando text) returns text language plpgsql as $$
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

create function lv.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_rider_item_equipamentos where organization_id = lv.id(o || '0'))::text;
$$;

create function lv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', lv.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function lv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_rider_item_equipamentos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_rider_item_equipamentos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_rider_item_equipamentos'::regclass),
          'producao_rider_item_equipamentos_equipamento_id_fkey=c, producao_rider_item_equipamentos_organization_id_fkey=c, producao_rider_item_equipamentos_rider_item_id_fkey=c',
          'a ligação sai com a linha do rider, com o equipamento e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_rider_item_equipamento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_rider_item_equipamentos', 'select'), 'a função de gatilho não é chamável e o visitante não toca na tabela');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select lv.como('a1');
select is(lv.ve('a'), '1', 'administrador lê as ligações');
select lv.como('a2');
select is(lv.ve('a'), '1', 'colaborador lê as ligações');
select lv.como('a3');
select is(lv.ve('a'), '1', 'leitor lê as ligações');
select lv.como('b1');
select is(lv.ve('a'), '0', 'outra organização não lê');
select lv.como('c1');
select is(lv.ve('c'), '1', 'produção só para leitura lê');
select lv.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select lv.como('a2');
select is(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('a0'), lv.id('82'), lv.id('42'))), 'aceito', 'colaborador liga a linha ao equipamento');
select lv.como('a3');
select ok(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('a0'), lv.id('82'), lv.id('41'))) like '42501%', 'leitor não liga');
select lv.como('c1');
select ok(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('c0'), lv.id('8c'), lv.id('4c'))) like '42501%', 'produção só para leitura não liga');
select lv.volta();

-- ─── As regras ──────────────────────────────────────────────────────────────

select is(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('a0'), lv.id('82'), lv.id('4b'))), '23514 equipamento_de_outra_organizacao', 'o equipamento é da mesma organização');
select is(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('a0'), lv.id('8b'), lv.id('41'))), '23514 item_de_outra_organizacao', 'a linha do rider é da mesma organização');
select is(lv.tenta(format('insert into public.producao_rider_item_equipamentos (organization_id, rider_item_id, equipamento_id) values (%L, %L, %L)', lv.id('a0'), lv.id('81'), lv.id('41'))), '23505 producao_rider_item_equipamentos_key', 'a mesma linha liga a um equipamento uma vez');
select is(lv.tenta(format('update public.producao_rider_item_equipamentos set equipamento_id = %L where id = %L', lv.id('42'), lv.id('91'))), '23514 ligacao_nao_muda', 'a ligação não muda');

-- ─── Chaves ────────────────────────────────────────────────────────────

delete from public.producao_equipamentos where id = lv.id('41');
select is((select count(*)::int from public.producao_rider_item_equipamentos where id = lv.id('91')), 0, 'apagar o equipamento leva a ligação');

select * from finish();
rollback;
