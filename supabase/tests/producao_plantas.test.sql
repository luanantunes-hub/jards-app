-- PD2.2: o motor da planta, primeiro corte (producao_plantas e producao_planta_objetos).
--
-- Quem lê e quem grava a planta e os objetos (administrador, colaborador, leitor, o recorte "só onde está vinculado",
-- que não vê as plantas da organização, outra organização, produção só para leitura e visitante), a forma (tipo da
-- lista, tamanho da planta, rótulo, tamanho, posição e rotação do objeto), a coerência entre organizações (espaço,
-- sala, data, planta e item), as chaves (a planta leva os objetos; o resto só se solta) e o histórico, que só a
-- planta tem. Ids 0d260000-0000-4000-8000-0000000000XX, ou pl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaços 31 e 32, sala 71 (do 31), temporada 21, data 41; plantas 61 e 62; objeto 81 (na 61);
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: espaço 3b, sala 7b, temporada 2b, data 4b, item 9b, planta 6b; b1 admin.
--   C (c0), produção só para leitura: planta 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_plantas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema pl;
grant usage on schema pl to authenticated, anon;

create function pl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d260000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pl.id(s), 'pl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (pl.id('a0'), 'PL A'), (pl.id('b0'), 'PL B'), (pl.id('c0'), 'PL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pl.id('a0'), 'producao', 'cortesia', 20), (pl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = pl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pl.id(o), pl.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (pl.id('a0'), pl.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (pl.id('31'), pl.id('a0'), 'PL E1', 'Teatro'), (pl.id('32'), pl.id('a0'), 'PL E2', 'Teatro'), (pl.id('3b'), pl.id('b0'), 'PL EB', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (pl.id('71'), pl.id('a0'), pl.id('31'), 'S1'), (pl.id('7b'), pl.id('b0'), pl.id('3b'), 'SB');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (pl.id('21'), pl.id('a0'), 'circulacao', 'circula', 'teatro', 'PL T'), (pl.id('2b'), pl.id('b0'), 'circulacao', 'circula', 'teatro', 'PL TB');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (pl.id('41'), pl.id('a0'), pl.id('21'), date '2026-12-05'), (pl.id('4b'), pl.id('b0'), pl.id('2b'), date '2026-12-05');
  insert into public.producao_itens (id, organization_id, nome) values (pl.id('9b'), pl.id('b0'), 'Item da B');
  insert into public.producao_plantas (id, organization_id, nome, tipo, largura_m, profundidade_m) values
    (pl.id('61'), pl.id('a0'), 'Palco principal', 'palco', 12, 8), (pl.id('62'), pl.id('a0'), 'Camarim', 'sala', 4, 3),
    (pl.id('6b'), pl.id('b0'), 'Palco da B', 'palco', 10, 6), (pl.id('6c'), pl.id('c0'), 'Palco da C', 'palco', 10, 6);
  insert into public.producao_planta_objetos (id, organization_id, planta_id, rotulo, x_m, y_m, largura_m, profundidade_m) values
    (pl.id('81'), pl.id('a0'), pl.id('61'), 'Praticável', 2, 1.5, 2, 1);
end
$dados$;

create function pl.tenta(comando text) returns text language plpgsql as $$
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

create function pl.efeito(comando text) returns text language plpgsql as $$
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

create function pl.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using pl.id(o || '0');
  return n::text;
end;
$$;

create function pl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_plantas', 'producao_planta_objetos')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_plantas'::regclass, 'public.producao_planta_objetos'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_plantas'::regclass, 'public.producao_planta_objetos'::regclass)),
          'producao_planta_objetos.producao_planta_objetos_item_id_fkey=n, producao_planta_objetos.producao_planta_objetos_organization_id_fkey=c, producao_planta_objetos.producao_planta_objetos_planta_id_fkey=c, '
          || 'producao_plantas.producao_plantas_data_id_fkey=n, producao_plantas.producao_plantas_espaco_id_fkey=n, producao_plantas.producao_plantas_organization_id_fkey=c, producao_plantas.producao_plantas_sala_id_fkey=n',
          'a planta leva os objetos; apagar item, espaço, sala ou data só solta a ligação');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_planta_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_planta_objeto_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_plantas', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_plantas'::regclass, 'public.producao_planta_objetos'::regclass)),
          'producao_planta_objetos.producao_planta_objetos_coerencia producao_planta_objetos.producao_planta_objetos_updated_at producao_plantas.producao_plantas_coerencia '
          || 'producao_plantas.producao_plantas_historico producao_plantas.producao_plantas_updated_at', 'os gatilhos de cada tabela (só a planta tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select pl.como('a1');
select is(pl.ve('producao_plantas', 'a'), '2', 'administrador lê as plantas');
select pl.como('a2');
select is(pl.ve('producao_plantas', 'a'), '2', 'colaborador lê as plantas');
select pl.como('a3');
select is(pl.ve('producao_plantas', 'a'), '2', 'leitor lê as plantas');
select pl.como('a5');
select is(pl.ve('producao_plantas', 'a'), '0', 'o recorte "vinculado" não vê as plantas da organização');
select pl.como('b1');
select is(pl.ve('producao_plantas', 'a'), '0', 'outra organização não lê');
select pl.como('c1');
select is(pl.ve('producao_plantas', 'c'), '1', 'produção só para leitura lê');
select pl.como(null);
select is(pl.efeito('select 1 from public.producao_plantas'), '', 'visitante não lê');
select pl.como('a2');
select is(pl.ve('producao_planta_objetos', 'a'), '1', 'colaborador lê os objetos');
select pl.como('a5');
select is(pl.ve('producao_planta_objetos', 'a'), '0', 'o recorte "vinculado" não vê os objetos (não vê a planta)');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select pl.como('a2');
select is(pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 6)', pl.id('a0'), 'Palco lateral')), 'aceito', 'colaborador cria a planta');
select is(pl.efeito(format('update public.producao_plantas set largura_m = 14 where id = %L', pl.id('61'))), 'sim', 'colaborador altera a planta');
select is(pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, x_m, y_m) values (%L, %L, %L, 3, 2)', pl.id('a0'), pl.id('61'), 'Bateria')), 'aceito', 'colaborador põe um objeto na planta');
select pl.como('a3');
select ok(pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 6)', pl.id('a0'), 'x')) like '42501%', 'leitor não cria a planta');
select ok(pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo) values (%L, %L, %L)', pl.id('a0'), pl.id('61'), 'x')) like '42501%', 'leitor não põe objeto');
select pl.como('c1');
select ok(pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 6)', pl.id('c0'), 'x')) like '42501%', 'produção só para leitura não grava');
select pl.como('a5');
select ok(pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 6)', pl.id('a0'), 'x')) like '42501%', 'o recorte não grava plantas');
select pl.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 6)', pl.id('a0'), ' ')),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, tipo, largura_m, profundidade_m) values (%L, %L, %L, 9, 6)', pl.id('a0'), 'x', 'jardim')),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 0.1, 6)', pl.id('a0'), 'x')),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m) values (%L, %L, 9, 600)', pl.id('a0'), 'x')),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m, espaco_id) values (%L, %L, 9, 6, %L)', pl.id('a0'), 'x', pl.id('3b'))),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m, sala_id) values (%L, %L, 9, 6, %L)', pl.id('a0'), 'x', pl.id('7b'))),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m, espaco_id, sala_id) values (%L, %L, 9, 6, %L, %L)', pl.id('a0'), 'x', pl.id('32'), pl.id('71'))),
            pl.tenta(format('insert into public.producao_plantas (organization_id, nome, largura_m, profundidade_m, data_id) values (%L, %L, 9, 6, %L)', pl.id('a0'), 'x', pl.id('4b'))),
            pl.tenta(format('update public.producao_plantas set organization_id = %L where id = %L', pl.id('b0'), pl.id('61'))),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo) values (%L, %L, %L)', pl.id('a0'), pl.id('61'), ' ')),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, largura_m) values (%L, %L, %L, 0)', pl.id('a0'), pl.id('61'), 'x')),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, rotacao_graus) values (%L, %L, %L, 360)', pl.id('a0'), pl.id('61'), 'x')),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, x_m) values (%L, %L, %L, 2000)', pl.id('a0'), pl.id('61'), 'x')),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo) values (%L, %L, %L)', pl.id('a0'), pl.id('6b'), 'x')),
            pl.tenta(format('insert into public.producao_planta_objetos (organization_id, planta_id, rotulo, item_id) values (%L, %L, %L, %L)', pl.id('a0'), pl.id('61'), 'x', pl.id('9b'))),
            pl.tenta(format('update public.producao_planta_objetos set planta_id = %L where id = %L', pl.id('62'), pl.id('81')))],
          array['23514 producao_plantas_nome_check', '23514 producao_plantas_tipo_check', '23514 producao_plantas_largura_check', '23514 producao_plantas_profundidade_check',
                '23514 espaco_de_outra_organizacao', '23514 sala_de_outra_organizacao', '23514 sala_de_outro_espaco', '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda',
                '23514 producao_planta_objetos_rotulo_check', '23514 producao_planta_objetos_tamanho_check', '23514 producao_planta_objetos_rotacao_check', '23514 producao_planta_objetos_posicao_check',
                '23514 planta_de_outra_organizacao', '23514 item_de_outra_organizacao', '23514 planta_nao_muda'],
          'tipo e tamanho da planta, espaço, sala e data da organização, rótulo, tamanho, rotação e posição do objeto, planta e item da organização');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_plantas set nome = 'Palco principal (novo)' where id = pl.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = pl.id('61') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select pl.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_plantas' and entidade_id = pl.id('61')) > 0, 'quem lê a planta lê o histórico dela');
select pl.volta();

select * from finish();
rollback;
