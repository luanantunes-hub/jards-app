-- PD8.5 (primeiro corte): planta expográfica (producao_expografia).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para leitura e
-- visitante), a forma dos dados (posição, altura, ordem, luz, lux, nota, uma obra por sala), a coerência (a obra é um item de arte da mesma
-- organização, a sala é da organização) e o histórico.
-- Ids 0d3e0000-0000-4000-8000-0000000000XX, ou ex.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaço 31 com as salas 71 e 72; obras i1 e i2 (obra de arte) e i3 (cenário); x1 (71, i1, parede, 150 cm, ordem 1, 50 lux);
--   a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): b1 admin, sala 7b, obra ib.
--   C (c0), produção só para leitura: c1 colaborador, sala 7c, obra ic, expografia xc.
-- Rodar: supabase/tests/README.md, com a migration producao_expografia na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema ex;
grant usage on schema ex to authenticated, anon;

create function ex.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ex.id(s), 'ex-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ex.id('a0'), 'EX A'), (ex.id('b0'), 'EX B'), (ex.id('c0'), 'EX C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ex.id('a0'), 'producao', 'cortesia', 20), (ex.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ex.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ex.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ex.id(o), ex.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (ex.id('a0'), ex.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (ex.id('31'), ex.id('a0'), 'EX E1', 'Museu'), (ex.id('3b'), ex.id('b0'), 'EX EB', 'Museu'), (ex.id('3c'), ex.id('c0'), 'EX EC', 'Museu');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (ex.id('71'), ex.id('a0'), ex.id('31'), 'Galeria 1'), (ex.id('72'), ex.id('a0'), ex.id('31'), 'Galeria 2'), (ex.id('7b'), ex.id('b0'), ex.id('3b'), 'SB'), (ex.id('7c'), ex.id('c0'), ex.id('3c'), 'SC');
  insert into public.producao_itens (id, organization_id, nome, categoria) values
    (ex.id('b1'), ex.id('a0'), 'EX Tela', 'obra_de_arte'), (ex.id('b2'), ex.id('a0'), 'EX Escultura', 'obra_de_arte'), (ex.id('b3'), ex.id('a0'), 'EX Bastidor', 'cenario'),
    (ex.id('bb'), ex.id('b0'), 'EX Tela B', 'obra_de_arte'), (ex.id('bc'), ex.id('c0'), 'EX Tela C', 'obra_de_arte');
  insert into public.producao_expografia (id, organization_id, sala_id, item_id, posicao, altura_instalacao_cm, ordem_montagem, luz, lux) values
    (ex.id('d1'), ex.id('a0'), ex.id('71'), ex.id('b1'), 'parede', 150, 1, 'difusa', 50),
    (ex.id('dc'), ex.id('c0'), ex.id('7c'), ex.id('bc'), 'parede', 150, 1, 'difusa', 50);
end
$dados$;

create function ex.tenta(comando text) returns text language plpgsql as $$
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

create function ex.efeito(comando text) returns text language plpgsql as $$
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

create function ex.ve(o text) returns text language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.producao_expografia where organization_id = ex.id(o || '0');
  return n::text;
end;
$$;

create function ex.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ex.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ex.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_expografia' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_expografia'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_expografia'::regclass),
          'producao_expografia_item_id_fkey=c, producao_expografia_organization_id_fkey=c, producao_expografia_sala_id_fkey=c', 'a obra na sala sai com a sala e com o item');
select ok(not has_table_privilege('anon', 'public.producao_expografia', 'select') and not has_function_privilege('authenticated', 'public.fn_producao_expografia_coerencia()', 'execute'),
          'o visitante não toca na tabela e ninguém executa a coerência');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.producao_expografia'::regclass and not tgisinternal), 3, 'três gatilhos: coerência, updated_at e histórico');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select ex.como('a2');
select is(ex.ve('a'), '1', 'colaborador lê');
select ex.como('a3');
select is(ex.ve('a'), '1', 'leitor lê');
select ex.como('a5');
select is(ex.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê (herda a sala)');
select ex.como('b1');
select is(ex.ve('a') || '|' || ex.ve('b'), '0|0', 'outra organização não lê o que é de A');
select ex.como('c1');
select is(ex.ve('c'), '1', 'produção só para leitura lê');
select ex.como(null);
select is(ex.efeito('select 1 from public.producao_expografia'), '', 'visitante não lê');
select ex.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ex.como('a2');
select is(ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'))), 'aceito', 'colaborador coloca a obra na sala');
select ex.como('a3');
select ok(ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'))) like '42501%', 'leitor não grava');
select ex.como('a5');
select ok(ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'))) like '42501%', 'o recorte sem vínculo não grava');
select ex.como('c1');
select ok(ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('c0'), ex.id('7c'), ex.id('bc'))) like '42501%', 'produção só para leitura não grava');
select ex.como('b1');
select is(ex.efeito(format('update public.producao_expografia set ordem_montagem = 9 where id = %L', ex.id('d1'))), '', 'outra organização não altera');
select ex.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b3'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('bb'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('7b'), ex.id('b2'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, posicao) values (%L, %L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'), 'varal')),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, altura_instalacao_cm) values (%L, %L, %L, 2001)', ex.id('a0'), ex.id('71'), ex.id('b2'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, ordem_montagem) values (%L, %L, %L, 1000)', ex.id('a0'), ex.id('71'), ex.id('b2'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, luz) values (%L, %L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'), 'neon')),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, lux) values (%L, %L, %L, -1)', ex.id('a0'), ex.id('71'), ex.id('b2'))),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id, notas) values (%L, %L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b2'), ' ')),
            ex.tenta(format('insert into public.producao_expografia (organization_id, sala_id, item_id) values (%L, %L, %L)', ex.id('a0'), ex.id('71'), ex.id('b1'))),
            ex.tenta(format('update public.producao_expografia set organization_id = %L where id = %L', ex.id('b0'), ex.id('d1'))),
            ex.tenta(format('update public.producao_expografia set sala_id = %L where id = %L', ex.id('72'), ex.id('d1'))),
            ex.tenta(format('update public.producao_expografia set item_id = %L where id = %L', ex.id('b2'), ex.id('d1')))],
          array['23514 item_nao_e_obra_de_arte', '23514 item_de_outra_organizacao', '23514 sala_de_outra_organizacao', '23514 producao_expografia_posicao_check', '23514 producao_expografia_altura_check',
                '23514 producao_expografia_ordem_check', '23514 producao_expografia_luz_check', '23514 producao_expografia_lux_check', '23514 producao_expografia_notas_check',
                '23505 producao_expografia_unica_key', '23514 organizacao_nao_muda', '23514 sala_nao_muda', '23514 item_nao_muda'],
          'a obra é um item de arte da organização; posição, altura, ordem, luz, lux e nota; uma obra por sala; o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_expografia set ordem_montagem = 3, instalada_em = now() where id = ex.id('d1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = ex.id('d1') and acao = 'alterou'), 'instalada_em,ordem_montagem', 'o histórico guarda a ordem e a instalação');
select ex.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_expografia' and entidade_id = ex.id('d1')) > 0, 'quem lê a obra na sala lê o histórico dela');
select ex.volta();

reset role;

-- O lugar da obra na planta (PD8.5, segundo corte): os dois juntos ou nenhum, e dentro do limite.
select is(array(select ex.tenta(c) from unnest(array[
            format('update public.producao_expografia set x_m = 2.5 where id = %L', ex.id('d1')),
            format('update public.producao_expografia set x_m = 2.5, y_m = 1.5 where id = %L', ex.id('d1')),
            format('update public.producao_expografia set x_m = 1001, y_m = 1 where id = %L', ex.id('d1'))]) as c),
          array['23514 producao_expografia_lugar_check', 'aceito', '23514 producao_expografia_lugar_check'],
          'o lugar da obra: x e y juntos ou nenhum, e dentro de 1.000 metros');

-- `ex.tenta` desfaz o que executa: para conferir a leitura, o comando vai solto.
update public.producao_expografia set x_m = 2.5, y_m = 1.5 where id = ex.id('d1');

select is((select array[x_m, y_m] from public.producao_expografia where id = ex.id('d1')), array[2.5, 1.5], 'o lugar gravado é o que se lê');

select * from finish();
rollback;
