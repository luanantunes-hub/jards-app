-- PD7.4 (primeiro corte): borderô da sessão (producao_borderos, producao_bordero_receitas e producao_bordero_deducoes).
--
-- Quem lê e quem grava, com o DINHEIRO separado: o borderô (público e situação) herda a sessão; a receita e as deduções só leem e escrevem quem tem a
-- permissão de dinheiro (administrador, colaborador ou leitor marcados; quem não tem vê o borderô sem os valores). Também: a forma dos dados, a
-- coerência (sessão e borderô da organização), o borderô fechado, que não aceita mudança até reabrir (fechar carimba a hora, reabrir apaga), e o histórico,
-- que guarda só a situação e o público: a receita e as deduções ficam sem histórico.
-- Ids 0d3f0000-0000-4000-8000-0000000000XX, ou bd.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: sessões 91, 92 e 93; borderô br1 (91, público 120) com as receitas rc1 (Inteira, 80 × 50) e rc2 (Meia, 40 × 25) e as deduções dd1 (ISS, 5%)
--   e dd2 (taxa da casa, R$ 300 fixos); borderô br3 (93) já fechado, com a receita rc3 e a dedução dd3.  Pessoas: a1 administrador; a2 colaborador com dinheiro;
--   a3 colaborador sem dinheiro; a4 leitor com dinheiro; a5 colaborador com dinheiro e o recorte "vinculado" sem vínculo.
--   B (b0): b1 admin, sessão 9b, borderô brb com a receita rcb.  C (c0), produção só para leitura: c1 colaborador com dinheiro, sessão 9c, borderô brc, receita rcc.
-- Rodar: supabase/tests/README.md, com a migration producao_bordero na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

create schema bd;
grant usage on schema bd to authenticated, anon;

create function bd.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3f0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select bd.id(s), 'bd-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (bd.id('a0'), 'BD A'), (bd.id('b0'), 'BD B'), (bd.id('c0'), 'BD C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (bd.id('a0'), 'producao', 'cortesia', 20), (bd.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (bd.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = bd.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select bd.id(o), bd.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (bd.id('a0'), bd.id('a2'), true, 'organizacao'), (bd.id('a0'), bd.id('a3'), false, 'organizacao'), (bd.id('a0'), bd.id('a4'), true, 'organizacao'),
    (bd.id('a0'), bd.id('a5'), true, 'vinculado'), (bd.id('c0'), bd.id('c1'), true, 'organizacao');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (bd.id('31'), bd.id('a0'), 'BD E1', 'Teatro'), (bd.id('3b'), bd.id('b0'), 'BD EB', 'Teatro'), (bd.id('3c'), bd.id('c0'), 'BD EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (bd.id('71'), bd.id('a0'), bd.id('31'), 'S1'), (bd.id('7b'), bd.id('b0'), bd.id('3b'), 'SB'), (bd.id('7c'), bd.id('c0'), bd.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (bd.id('81'), bd.id('a0'), bd.id('71'), 'Festival', date '2026-12-05', date '2026-12-09', 'confirmada'),
    (bd.id('8b'), bd.id('b0'), bd.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (bd.id('8c'), bd.id('c0'), bd.id('7c'), 'Pauta C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (bd.id('91'), bd.id('a0'), bd.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (bd.id('92'), bd.id('a0'), bd.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (bd.id('93'), bd.id('a0'), bd.id('81'), date '2026-12-07', time '18:00', time '20:00'),
    (bd.id('9b'), bd.id('b0'), bd.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (bd.id('9c'), bd.id('c0'), bd.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_borderos (id, organization_id, sessao_id, publico_casa) values
    (bd.id('c1'), bd.id('a0'), bd.id('91'), 120), (bd.id('c3'), bd.id('a0'), bd.id('93'), 90), (bd.id('cb'), bd.id('b0'), bd.id('9b'), 10), (bd.id('cc'), bd.id('c0'), bd.id('9c'), 10);
  insert into public.producao_bordero_receitas (id, organization_id, bordero_id, categoria, quantidade, valor_unitario) values
    (bd.id('e1'), bd.id('a0'), bd.id('c1'), 'Inteira', 80, 50), (bd.id('e2'), bd.id('a0'), bd.id('c1'), 'Meia', 40, 25), (bd.id('e3'), bd.id('a0'), bd.id('c3'), 'Inteira', 90, 40),
    (bd.id('eb'), bd.id('b0'), bd.id('cb'), 'Inteira', 10, 30), (bd.id('ec'), bd.id('c0'), bd.id('cc'), 'Inteira', 10, 30);
  insert into public.producao_bordero_deducoes (id, organization_id, bordero_id, nome, forma, valor, beneficiario, ordem) values
    (bd.id('f1'), bd.id('a0'), bd.id('c1'), 'ISS', 'percentual', 5, 'Prefeitura', 1), (bd.id('f2'), bd.id('a0'), bd.id('c1'), 'Taxa da casa', 'fixo', 300, 'Casa', 2),
    (bd.id('f3'), bd.id('a0'), bd.id('c3'), 'ISS', 'percentual', 5, null, 1);
  update public.producao_borderos set situacao = 'fechado' where id = bd.id('c3');
end
$dados$;

create function bd.tenta(comando text) returns text language plpgsql as $$
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

create function bd.efeito(comando text) returns text language plpgsql as $$
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

-- Quantas linhas a pessoa lê de cada tabela da organização: borderôs, receitas e deduções.
create function bd.ve(o text) returns text language plpgsql as $$
declare b bigint; r bigint; d bigint;
begin
  select count(*) into b from public.producao_borderos where organization_id = bd.id(o || '0');
  select count(*) into r from public.producao_bordero_receitas where organization_id = bd.id(o || '0');
  select count(*) into d from public.producao_bordero_deducoes where organization_id = bd.id(o || '0');
  return b || '|' || r || '|' || d;
end;
$$;

create function bd.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', bd.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function bd.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_borderos', 'producao_bordero_receitas', 'producao_bordero_deducoes')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_borderos'::regclass, 'public.producao_bordero_receitas'::regclass, 'public.producao_bordero_deducoes'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_borderos'::regclass, 'public.producao_bordero_receitas'::regclass, 'public.producao_bordero_deducoes'::regclass)),
          'producao_bordero_deducoes.producao_bordero_deducoes_bordero_id_fkey=c, producao_bordero_deducoes.producao_bordero_deducoes_organization_id_fkey=c, '
          || 'producao_bordero_receitas.producao_bordero_receitas_bordero_id_fkey=c, producao_bordero_receitas.producao_bordero_receitas_organization_id_fkey=c, '
          || 'producao_borderos.producao_borderos_organization_id_fkey=c, producao_borderos.producao_borderos_sessao_id_fkey=c',
          'o borderô sai com a sessão e leva a receita e as deduções');
select ok(not has_table_privilege('anon', 'public.producao_borderos', 'select') and not has_table_privilege('anon', 'public.producao_bordero_receitas', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_bordero_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_bordero_filha_coerencia()', 'execute'), 'o visitante não toca nas tabelas e ninguém executa as coerências');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.producao_borderos'::regclass, 'public.producao_bordero_receitas'::regclass, 'public.producao_bordero_deducoes'::regclass) and not tgisinternal), 7,
          'sete gatilhos: coerência, updated_at e histórico no borderô; só coerência e updated_at na receita e nas deduções (dinheiro sem histórico)');

-- ─── Quem lê (o dinheiro à parte) ───────────────────────────────────────────

select bd.como('a1');
select is(bd.ve('a'), '2|3|3', 'administrador lê tudo');
select bd.como('a2');
select is(bd.ve('a'), '2|3|3', 'colaborador com dinheiro lê tudo');
select bd.como('a3');
select is(bd.ve('a'), '2|0|0', 'colaborador sem dinheiro lê o borderô e não vê nenhum valor');
select bd.como('a4');
select is(bd.ve('a'), '2|3|3', 'leitor com dinheiro lê os valores');
select bd.como('a5');
select is(bd.ve('a'), '0|0|0', 'o recorte "vinculado" sem vínculo não lê nada (herda a sessão)');
select bd.como('b1');
select is(bd.ve('a') || '/' || bd.ve('b'), '0|0|0/1|1|0', 'outra organização só lê o que é dela');
select bd.como('c1');
select is(bd.ve('c'), '1|1|0', 'produção só para leitura lê, com dinheiro');
select bd.como(null);
select is(bd.efeito('select 1 from public.producao_borderos'), '', 'visitante não lê');
select bd.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select bd.como('a2');
select is(bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade, valor_unitario) values (%L, %L, %L, 10, 10)', bd.id('a0'), bd.id('c1'), 'Social')), 'aceito', 'colaborador com dinheiro lança a receita');
select bd.como('a3');
select ok(bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade, valor_unitario) values (%L, %L, %L, 10, 10)', bd.id('a0'), bd.id('c1'), 'Social')) like '42501%', 'colaborador sem dinheiro não lança receita');
select is(bd.efeito(format('update public.producao_borderos set publico_casa = 130 where id = %L', bd.id('c1'))), 'sim', 'mas conta o público no borderô');
select bd.como('a4');
select ok(bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade, valor_unitario) values (%L, %L, %L, 10, 10)', bd.id('a0'), bd.id('c1'), 'Social')) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select bd.como('a5');
select ok(bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id) values (%L, %L)', bd.id('a0'), bd.id('92'))) like '42501%', 'o recorte sem vínculo não grava');
select bd.como('c1');
select ok(bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade, valor_unitario) values (%L, %L, %L, 10, 10)', bd.id('c0'), bd.id('cc'), 'Social')) like '42501%', 'produção só para leitura não grava');
select bd.como('b1');
select is(bd.efeito(format('update public.producao_bordero_receitas set quantidade = 1 where id = %L', bd.id('e1'))), '', 'outra organização não altera');
select bd.volta();

-- ─── Borderô fechado ────────────────────────────────────────────────────────

select is(array[
            bd.tenta(format('update public.producao_borderos set publico_casa = 1 where id = %L', bd.id('c3'))),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade, valor_unitario) values (%L, %L, %L, 1, 1)', bd.id('a0'), bd.id('c3'), 'Meia')),
            bd.tenta(format('update public.producao_bordero_receitas set quantidade = 1 where id = %L', bd.id('e3'))),
            bd.tenta(format('delete from public.producao_bordero_receitas where id = %L', bd.id('e3'))),
            bd.tenta(format('update public.producao_bordero_deducoes set valor = 1 where id = %L', bd.id('f3'))),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome) values (%L, %L, %L)', bd.id('a0'), bd.id('c3'), 'Outra'))],
          array['23514 bordero_fechado', '23514 bordero_fechado', '23514 bordero_fechado', '23514 bordero_fechado', '23514 bordero_fechado', '23514 bordero_fechado'],
          'depois de fechado nada muda: nem o público, nem a receita, nem as deduções');
select ok((select fechado_em is not null from public.producao_borderos where id = bd.id('c3')), 'fechar carimbou a hora');
update public.producao_borderos set situacao = 'conferido' where id = bd.id('c3');
select ok((select fechado_em is null from public.producao_borderos where id = bd.id('c3'))
          and bd.tenta(format('update public.producao_bordero_receitas set quantidade = 91 where id = %L', bd.id('e3'))) = 'aceito', 'reabrir apaga a hora e libera a edição');
update public.producao_borderos set situacao = 'fechado' where id = bd.id('c3');
select ok((select fechado_em is not null from public.producao_borderos where id = bd.id('c3')), 'fechar de novo carimba outra vez');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id, publico_casa) values (%L, %L, -1)', bd.id('a0'), bd.id('92'))),
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id, publico_casa) values (%L, %L, 100001)', bd.id('a0'), bd.id('92'))),
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id, situacao) values (%L, %L, %L)', bd.id('a0'), bd.id('92'), 'talvez')),
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id, observacao) values (%L, %L, %L)', bd.id('a0'), bd.id('92'), ' ')),
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id) values (%L, %L)', bd.id('a0'), bd.id('91'))),
            bd.tenta(format('insert into public.producao_borderos (organization_id, sessao_id) values (%L, %L)', bd.id('a0'), bd.id('9b'))),
            bd.tenta(format('update public.producao_borderos set organization_id = %L where id = %L', bd.id('b0'), bd.id('c1'))),
            bd.tenta(format('update public.producao_borderos set sessao_id = %L where id = %L', bd.id('92'), bd.id('c1'))),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria) values (%L, %L, %L)', bd.id('a0'), bd.id('c1'), ' ')),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, quantidade) values (%L, %L, %L, -1)', bd.id('a0'), bd.id('c1'), 'Nova')),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria, valor_unitario) values (%L, %L, %L, -1)', bd.id('a0'), bd.id('c1'), 'Nova')),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria) values (%L, %L, %L)', bd.id('a0'), bd.id('c1'), ' inteira ')),
            bd.tenta(format('insert into public.producao_bordero_receitas (organization_id, bordero_id, categoria) values (%L, %L, %L)', bd.id('a0'), bd.id('cb'), 'Nova')),
            bd.tenta(format('update public.producao_bordero_receitas set organization_id = %L where id = %L', bd.id('b0'), bd.id('e1'))),
            bd.tenta(format('update public.producao_bordero_receitas set bordero_id = %L where id = %L', bd.id('cb'), bd.id('e1'))),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome) values (%L, %L, %L)', bd.id('a0'), bd.id('c1'), ' ')),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome, forma) values (%L, %L, %L, %L)', bd.id('a0'), bd.id('c1'), 'x', 'misto')),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome, forma, valor) values (%L, %L, %L, %L, 101)', bd.id('a0'), bd.id('c1'), 'x', 'percentual')),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome, beneficiario) values (%L, %L, %L, %L)', bd.id('a0'), bd.id('c1'), 'x', ' ')),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome, ordem) values (%L, %L, %L, 1000)', bd.id('a0'), bd.id('c1'), 'x')),
            bd.tenta(format('insert into public.producao_bordero_deducoes (organization_id, bordero_id, nome, forma, valor) values (%L, %L, %L, %L, 5000)', bd.id('a0'), bd.id('c1'), 'x', 'fixo'))],
          array['23514 producao_borderos_publico_check', '23514 producao_borderos_publico_check', '23514 producao_borderos_situacao_check', '23514 producao_borderos_observacao_check',
                '23505 producao_borderos_sessao_key', '23514 sessao_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 sessao_nao_muda',
                '23514 producao_bordero_receitas_categoria_check', '23514 producao_bordero_receitas_quantidade_check', '23514 producao_bordero_receitas_valor_check', '23505 producao_bordero_receitas_categoria_idx',
                '23514 bordero_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 bordero_nao_muda',
                '23514 producao_bordero_deducoes_nome_check', '23514 producao_bordero_deducoes_forma_check', '23514 producao_bordero_deducoes_valor_check', '23514 producao_bordero_deducoes_beneficiario_check',
                '23514 producao_bordero_deducoes_ordem_check', 'aceito'],
          'borderô (público, situação, observação, um por sessão, sessão da organização), receita (categoria única, quantidade, valor), deduções (nome, forma, porcentagem até 100, quem recebe, ordem) e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_borderos set publico_casa = 130, situacao = 'conferido' where id = bd.id('c1');
update public.producao_bordero_receitas set quantidade = 81 where id = bd.id('e1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = bd.id('c1') and acao = 'alterou'), 'publico_casa,situacao', 'o histórico do borderô guarda o público e a situação');
select bd.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_borderos' and entidade_id = bd.id('c1')) > 0, 'quem lê o borderô lê o histórico dele, sem nenhum valor');
select bd.volta();
select is((select count(*)::int from public.producao_historico where entidade in ('producao_bordero_receitas', 'producao_bordero_deducoes')), 0, 'a receita e as deduções não têm histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
