-- PD7.7 (primeiro corte): mapa da plateia (producao_setores e producao_setor_cotas).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para leitura e
-- visitante), a forma dos dados, a coerência (o setor é da sala da sessão) e a soma das cotas de um setor numa sessão, que não passa dos
-- lugares do setor (só confere quando o número aumenta), e o histórico.
-- Ids 0d3c0000-0000-4000-8000-0000000000XX, ou pl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaço 31 com as salas 71 e 72; pauta 81 na sala 71 (sessões 91 e 92) e pauta 82 na sala 72 (sessão 93); setores s1 (sala 71,
--   100 lugares), s2 (sala 71, 50) e s3 (sala 72, 30); cotas k1 (91, s1, venda, 60) e k2 (91, s1, patrocinador, 20); a2 colaborador, a3 leitor, a5
--   colaborador com o recorte "vinculado" e sem vínculo.  B (b0): b1 admin, sala 7b, setor sb, sessão 9b.
--   C (c0), produção só para leitura: c1 colaborador, sala 7c, setor sc, sessão 9c, cota kc.
-- Rodar: supabase/tests/README.md, com a migration producao_plateia na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema pl;
grant usage on schema pl to authenticated, anon;

create function pl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pl.id(s), 'pl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (pl.id('a0'), 'PL A'), (pl.id('b0'), 'PL B'), (pl.id('c0'), 'PL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pl.id('a0'), 'producao', 'cortesia', 20), (pl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = pl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pl.id(o), pl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (pl.id('a0'), pl.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (pl.id('31'), pl.id('a0'), 'PL E1', 'Teatro'), (pl.id('3b'), pl.id('b0'), 'PL EB', 'Teatro'), (pl.id('3c'), pl.id('c0'), 'PL EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (pl.id('71'), pl.id('a0'), pl.id('31'), 'S1'), (pl.id('72'), pl.id('a0'), pl.id('31'), 'S2'), (pl.id('7b'), pl.id('b0'), pl.id('3b'), 'SB'), (pl.id('7c'), pl.id('c0'), pl.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (pl.id('81'), pl.id('a0'), pl.id('71'), 'Festival', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (pl.id('82'), pl.id('a0'), pl.id('72'), 'Outra sala', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (pl.id('8b'), pl.id('b0'), pl.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (pl.id('8c'), pl.id('c0'), pl.id('7c'), 'Pauta C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (pl.id('91'), pl.id('a0'), pl.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (pl.id('92'), pl.id('a0'), pl.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (pl.id('93'), pl.id('a0'), pl.id('82'), date '2026-12-05', time '18:00', time '20:00'),
    (pl.id('9b'), pl.id('b0'), pl.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (pl.id('9c'), pl.id('c0'), pl.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_setores (id, organization_id, sala_id, nome, lugares) values
    (pl.id('b1'), pl.id('a0'), pl.id('71'), 'Plateia baixa', 100), (pl.id('b2'), pl.id('a0'), pl.id('71'), 'Balcão', 50), (pl.id('b3'), pl.id('a0'), pl.id('72'), 'Outra sala', 30),
    (pl.id('bb'), pl.id('b0'), pl.id('7b'), 'Plateia', 40), (pl.id('bc'), pl.id('c0'), pl.id('7c'), 'Plateia', 40);
  insert into public.producao_setor_cotas (id, organization_id, sessao_id, setor_id, categoria, lugares) values
    (pl.id('d1'), pl.id('a0'), pl.id('91'), pl.id('b1'), 'venda', 60), (pl.id('d2'), pl.id('a0'), pl.id('91'), pl.id('b1'), 'patrocinador', 20),
    (pl.id('dc'), pl.id('c0'), pl.id('9c'), pl.id('bc'), 'venda', 10);
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

-- Quantas linhas a pessoa lê de cada tabela da organização: setores e cotas.
create function pl.ve(o text) returns text language plpgsql as $$
declare s bigint; c bigint;
begin
  select count(*) into s from public.producao_setores where organization_id = pl.id(o || '0');
  select count(*) into c from public.producao_setor_cotas where organization_id = pl.id(o || '0');
  return s || '|' || c;
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_setores', 'producao_setor_cotas') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_setores'::regclass, 'public.producao_setor_cotas'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_setores'::regclass, 'public.producao_setor_cotas'::regclass)),
          'producao_setor_cotas.producao_setor_cotas_organization_id_fkey=c, producao_setor_cotas.producao_setor_cotas_sessao_id_fkey=c, producao_setor_cotas.producao_setor_cotas_setor_id_fkey=c, '
          || 'producao_setores.producao_setores_organization_id_fkey=c, producao_setores.producao_setores_sala_id_fkey=c',
          'o setor sai com a sala e leva as cotas; a cota sai com a sessão');
select ok(not has_table_privilege('anon', 'public.producao_setores', 'select') and not has_function_privilege('authenticated', 'public.fn_producao_setor_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_setor_cota_coerencia()', 'execute'), 'o visitante não toca nas tabelas e ninguém executa as coerências');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.producao_setores'::regclass, 'public.producao_setor_cotas'::regclass) and not tgisinternal), 6, 'seis gatilhos: coerência, updated_at e histórico nas duas');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select pl.como('a2');
select is(pl.ve('a'), '3|2', 'colaborador lê setores e cotas');
select pl.como('a3');
select is(pl.ve('a'), '3|2', 'leitor lê');
select pl.como('a5');
select is(pl.ve('a'), '0|0', 'o recorte "vinculado" sem vínculo não lê (herdam a sala e a sessão)');
select pl.como('b1');
select is(pl.ve('a') || '/' || pl.ve('b'), '0|0/1|0', 'outra organização só lê o que é dela');
select pl.como('c1');
select is(pl.ve('c'), '1|1', 'produção só para leitura lê');
select pl.como(null);
select is(pl.efeito('select 1 from public.producao_setores'), '', 'visitante não lê');
select pl.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select pl.como('a2');
select is(pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 20)', pl.id('a0'), pl.id('71'), 'Camarote')), 'aceito', 'colaborador cria o setor');
select pl.como('a3');
select ok(pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 20)', pl.id('a0'), pl.id('71'), 'Camarote')) like '42501%', 'leitor não grava');
select pl.como('a5');
select ok(pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 20)', pl.id('a0'), pl.id('71'), 'Camarote')) like '42501%', 'o recorte sem vínculo não grava');
select pl.como('c1');
select ok(pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 20)', pl.id('c0'), pl.id('7c'), 'Camarote')) like '42501%', 'produção só para leitura não grava');
select pl.como('b1');
select is(pl.efeito(format('update public.producao_setor_cotas set lugares = 1 where id = %L', pl.id('d1'))), '', 'outra organização não altera');
select pl.volta();

-- ─── A soma das cotas de um setor ───────────────────────────────────────────
-- s1 tem 100 lugares; na sessão 91 há venda 60 e patrocinador 20 (80 de 100).

select is(array[
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 20)', pl.id('a0'), pl.id('91'), pl.id('b1'), 'gratuidade')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 21)', pl.id('a0'), pl.id('91'), pl.id('b1'), 'gratuidade')),
            pl.tenta(format('update public.producao_setor_cotas set lugares = 85 where id = %L', pl.id('d1'))),
            pl.tenta(format('update public.producao_setor_cotas set lugares = 10 where id = %L', pl.id('d2'))),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 100)', pl.id('a0'), pl.id('92'), pl.id('b1'), 'venda')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 51)', pl.id('a0'), pl.id('91'), pl.id('b2'), 'venda'))],
          array['aceito', '23514 lugares_excedidos', '23514 lugares_excedidos', 'aceito', 'aceito', '23514 lugares_excedidos'],
          'a soma cabe até 100 (80 + 20); 21 não cabe; aumentar a venda para 85 não cabe; diminuir cabe; a conta é por sessão; outro setor tem os lugares dele');

-- ─── O setor é da sala da sessão ────────────────────────────────────────────

select is(array[
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('91'), pl.id('b3'), 'venda')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('93'), pl.id('b1'), 'venda')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('91'), pl.id('bb'), 'venda')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('9b'), pl.id('b1'), 'venda'))],
          array['23514 setor_de_outra_sala', '23514 setor_de_outra_sala', '23514 setor_de_outra_sala', '23514 sessao_de_outra_organizacao'],
          'setor de outra sala (da mesma organização ou de outra) e sessão de outra organização são recusados');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 10)', pl.id('a0'), pl.id('71'), ' ')),
            pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 0)', pl.id('a0'), pl.id('71'), 'Novo')),
            pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares, ordem) values (%L, %L, %L, 10, 1000)', pl.id('a0'), pl.id('71'), 'Novo')),
            pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 10)', pl.id('a0'), pl.id('71'), ' plateia BAIXA ')),
            pl.tenta(format('insert into public.producao_setores (organization_id, sala_id, nome, lugares) values (%L, %L, %L, 10)', pl.id('a0'), pl.id('7b'), 'Novo')),
            pl.tenta(format('update public.producao_setores set organization_id = %L where id = %L', pl.id('b0'), pl.id('b1'))),
            pl.tenta(format('update public.producao_setores set sala_id = %L where id = %L', pl.id('72'), pl.id('b1'))),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('91'), pl.id('b2'), 'plateia')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 0)', pl.id('a0'), pl.id('91'), pl.id('b2'), 'venda')),
            pl.tenta(format('insert into public.producao_setor_cotas (organization_id, sessao_id, setor_id, categoria, lugares) values (%L, %L, %L, %L, 1)', pl.id('a0'), pl.id('91'), pl.id('b1'), 'venda')),
            pl.tenta(format('update public.producao_setor_cotas set organization_id = %L where id = %L', pl.id('b0'), pl.id('d1'))),
            pl.tenta(format('update public.producao_setor_cotas set sessao_id = %L where id = %L', pl.id('92'), pl.id('d1'))),
            pl.tenta(format('update public.producao_setor_cotas set setor_id = %L where id = %L', pl.id('b2'), pl.id('d1')))],
          array['23514 producao_setores_nome_check', '23514 producao_setores_lugares_check', '23514 producao_setores_ordem_check', '23505 producao_setores_nome_idx', '23514 sala_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 sala_nao_muda', '23514 producao_setor_cotas_categoria_check', '23514 producao_setor_cotas_lugares_check', '23505 producao_setor_cotas_unica_key',
                '23514 organizacao_nao_muda', '23514 sessao_nao_muda', '23514 setor_nao_muda'],
          'setor (nome, lugares, ordem, nome único na sala, sala da organização), cota (categoria, lugares, uma por categoria) e o que não muda');

-- ─── Reduzir o setor não trava a edição ─────────────────────────────────────

update public.producao_setores set lugares = 70 where id = pl.id('b1');
select is(array[
            pl.tenta(format('update public.producao_setor_cotas set lugares = 50 where id = %L', pl.id('d1'))),
            pl.tenta(format('update public.producao_setor_cotas set lugares = 21 where id = %L', pl.id('d2'))),
            pl.tenta(format('delete from public.producao_setor_cotas where id = %L', pl.id('d2')))],
          array['aceito', '23514 lugares_excedidos', 'aceito'], 'reduzir o setor abaixo do que já está pintado deixa diminuir e apagar, e só recusa aumentar de novo');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_setor_cotas set lugares = 55 where id = pl.id('d1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = pl.id('d1') and acao = 'alterou'), 'lugares', 'o histórico guarda os lugares da cota');
select pl.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_setor_cotas' and entidade_id = pl.id('d1')) > 0
          and (select count(*) from public.producao_historico where entidade = 'producao_setores' and entidade_id = pl.id('b1')) > 0, 'quem lê o setor e a cota lê o histórico deles');
select pl.volta();

select * from finish();
rollback;
