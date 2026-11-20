-- PD1.12: a folha do dia para a pessoa da equipe, com login (producao_acessos_equipe e fn_equipe_*).
--
-- O que prova: quem convida e revoga (administrador, colaborador, leitor, outra organização); que a pessoa
-- convidada NÃO é membro e não lê nenhuma tabela da produção; que ela só liga a conta com o e-mail
-- confirmado; que vê só as datas em que está escalada, só os blocos que lhe cabem (os de todos e os do grupo
-- dela), os cartões da data e nada de outra pessoa; que responde só à própria escala; que convite revogado,
-- visitante e estranho não veem nada. Ids 0d1e0000-0000-4000-8000-0000000000XX, ou ae.id('XX'). Desfeito no fim.
--   A (a0), cortesia: temporadas T1 (21) e T2 (22); datas D1 (41, de T1), D2 (42, de T2), D3 (43, de T1,
--   cancelada); pessoas P1 (51, grupo Técnica em T1), P2 (52), P3 (53), P4 (54); escalas: P1 em D1 (61) e
--   D2 (62), P2 em D1 (63), P1 em D3 (64), P4 em D1 (65); blocos de D1: B1 de todos (71), B2 só da Técnica (72),
--   B3 só do Elenco (73); cartão de viagem de D1; cachê de P1 (que não pode aparecer).
--   Pessoas: a1 admin, a2 colaborador, a3 leitor, b1 admin de B. Contas convidadas: g1 (e-mail de P1), g2 (de P2),
--   gx (de P3, e-mail NÃO confirmado), g4 (sem convite).
--   B (b0): temporada (2b), data (4b), pessoa (5b); b1 admin.
-- Rodar: supabase/tests/README.md, com a migration producao_acesso_equipe na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(37);

create schema ae;
grant usage on schema ae to authenticated, anon;

create function ae.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d1e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ae.id(s), 'ae-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, case when s = 'd3' then null else now() end
  from unnest(array['a1', 'a2', 'a3', 'b1', 'd1', 'd2', 'd3', 'd4']) as s;
  insert into public.organizations (id, nome) values (ae.id('a0'), 'AE A'), (ae.id('b0'), 'AE B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ae.id('a0'), 'producao', 'cortesia', 20), (ae.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ae.id(o), ae.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ae.id('21'), ae.id('a0'), 'circulacao', 'circula', 'teatro', 'AE T1'), (ae.id('22'), ae.id('a0'), 'circulacao', 'circula', 'teatro', 'AE T2'),
    (ae.id('2b'), ae.id('b0'), 'circulacao', 'circula', 'teatro', 'AE TB');
  insert into public.producao_datas (id, organization_id, temporada_id, data, situacao) values
    (ae.id('41'), ae.id('a0'), ae.id('21'), date '2026-12-05', 'confirmada'), (ae.id('42'), ae.id('a0'), ae.id('22'), date '2026-12-12', 'confirmada'),
    (ae.id('43'), ae.id('a0'), ae.id('21'), date '2026-12-19', 'cancelada'), (ae.id('4b'), ae.id('b0'), ae.id('2b'), date '2026-12-05', 'confirmada');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (ae.id('51'), ae.id('a0'), 'AE Ana'), (ae.id('52'), ae.id('a0'), 'AE Bia'), (ae.id('53'), ae.id('a0'), 'AE Caio'),
    (ae.id('54'), ae.id('a0'), 'AE Dani'), (ae.id('5b'), ae.id('b0'), 'AE Pessoa B');
  insert into public.producao_vinculos (id, organization_id, pessoa_id, temporada_id, funcao, grupo) values
    (ae.id('81'), ae.id('a0'), ae.id('51'), ae.id('21'), 'Luz', 'Técnica');
  insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values (ae.id('81'), ae.id('a0'), 777777);
  insert into public.producao_escalas (id, organization_id, pessoa_id, data_id, funcao, chamada, saida) values
    (ae.id('61'), ae.id('a0'), ae.id('51'), ae.id('41'), 'Luz', timestamptz '2026-12-05 12:00-03', timestamptz '2026-12-06 01:00-03'),
    (ae.id('62'), ae.id('a0'), ae.id('51'), ae.id('42'), 'Luz', null, null),
    (ae.id('63'), ae.id('a0'), ae.id('52'), ae.id('41'), 'Som', null, null),
    (ae.id('64'), ae.id('a0'), ae.id('51'), ae.id('43'), 'Luz', null, null),
    (ae.id('65'), ae.id('a0'), ae.id('54'), ae.id('41'), 'Atriz', null, null);
  insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo, titulo, visivel_para) values
    (ae.id('71'), ae.id('a0'), ae.id('41'), date '2026-12-05', timestamptz '2026-12-05 09:00-03', 'carga', 'Carga', null),
    (ae.id('72'), ae.id('a0'), ae.id('41'), date '2026-12-05', timestamptz '2026-12-05 14:00-03', 'montagem', 'Montagem da luz', array['Técnica']),
    (ae.id('73'), ae.id('a0'), ae.id('41'), date '2026-12-05', timestamptz '2026-12-05 18:00-03', 'ensaio', 'Aquecimento do elenco', array['Elenco']);
  insert into public.producao_cartoes_dia (organization_id, data_id, tipo, titulo, localizador) values
    (ae.id('a0'), ae.id('41'), 'viagem', 'Van da companhia', 'LOC-SO-DELA');
  -- Os convites, gravados direto (como o dono do banco); quem convida pelo app passa pelas regras.
  insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values
    (ae.id('a0'), ae.id('51'), 'ae-d1@teste.invalid'), (ae.id('a0'), ae.id('52'), 'ae-d2@teste.invalid'), (ae.id('a0'), ae.id('53'), 'ae-d3@teste.invalid');
end
$dados$;

create function ae.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'AE000', message = 'aceito';
  exception
    when sqlstate 'AE000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function ae.efeito(comando text) returns text language plpgsql as $$
declare linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'AE000', message = linhas::text;
  exception
    when sqlstate 'AE000' then return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then return '';
    when others then return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

create function ae.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ae.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ae.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_acessos_equipe'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'a tabela: cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_acessos_equipe'::regclass)
          and not has_table_privilege('anon', 'public.producao_acessos_equipe', 'select'), 'a tabela tem segurança por linha e o visitante não a toca');
select ok(not has_function_privilege('anon', 'public.fn_equipe_aceitar()', 'execute') and not has_function_privilege('anon', 'public.fn_equipe_minhas_datas()', 'execute')
          and not has_function_privilege('anon', 'public.fn_equipe_folha(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_equipe_responder(uuid, text)', 'execute'),
          'o visitante não executa nenhuma das quatro funções');
select ok(has_function_privilege('authenticated', 'public.fn_equipe_aceitar()', 'execute') and has_function_privilege('authenticated', 'public.fn_equipe_folha(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_acesso_equipe_coerencia()', 'execute'), 'quem está logado executa as funções; a coerência ninguém chama');

-- ─── Quem convida ───────────────────────────────────────────────────────────

select ae.como('a2');
select is(ae.tenta(format('insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values (%L, %L, %L)', ae.id('a0'), ae.id('54'), 'ae-g5@teste.invalid')),
          'aceito', 'colaborador convida');
select is((select count(*)::int from public.producao_acessos_equipe), 3, 'colaborador lê os convites da organização');
select ae.como('a3');
select ok(ae.tenta(format('insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values (%L, %L, %L)', ae.id('a0'), ae.id('54'), 'ae-g5@teste.invalid')) like '42501%', 'leitor não convida');
select is(ae.efeito(format('update public.producao_acessos_equipe set revogado_em = now() where pessoa_id = %L', ae.id('52'))), '', 'leitor não revoga');
select ae.como('b1');
select is((select count(*)::int from public.producao_acessos_equipe), 0, 'outra organização não lê os convites');
select ok(ae.tenta(format('insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values (%L, %L, %L)', ae.id('b0'), ae.id('51'), 'ae-g5@teste.invalid')) = '23514 pessoa_de_outra_organizacao',
          'convite com pessoa de outra organização é recusado');
select ae.como('a1');
select is(ae.efeito(format('update public.producao_acessos_equipe set revogado_em = now() where pessoa_id = %L', ae.id('53'))), 'sim', 'administrador revoga');
select ae.volta();
select is(array[
            ae.tenta(format('insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values (%L, %L, %L)', ae.id('a0'), ae.id('51'), 'ae-outro@teste.invalid')),
            ae.tenta(format('insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values (%L, %L, %L)', ae.id('a0'), ae.id('54'), 'AE-Maiuscula@teste.invalid')),
            ae.tenta(format('update public.producao_acessos_equipe set pessoa_id = %L where pessoa_id = %L', ae.id('54'), ae.id('51')))],
          array['23505 producao_acessos_equipe_pessoa_key', '23514 producao_acessos_equipe_email_check', '23514 pessoa_nao_muda'],
          'um convite por pessoa, e-mail em minúsculas, a pessoa do convite não muda');
update public.producao_acessos_equipe set revogado_em = null where pessoa_id = ae.id('53');

-- ─── Ligar a conta ──────────────────────────────────────────────────────────

select ae.como('d1');
select is(public.fn_equipe_aceitar(), 1, 'g1 liga a conta ao convite do e-mail dele');
select is(public.fn_equipe_aceitar(), 0, 'e ligar de novo não liga nada');
select ae.como('d2');
select is(public.fn_equipe_aceitar(), 1, 'g2 também');
select ae.como('d3');
select is(public.fn_equipe_aceitar(), 0, 'e-mail não confirmado não liga nada');
select ae.como('d4');
select is(public.fn_equipe_aceitar(), 0, 'sem convite não liga nada');
select ae.como(null);
select ok(ae.tenta('select public.fn_equipe_aceitar()') like '42501%', 'o visitante nem executa');

-- ─── O que a pessoa convidada vê ────────────────────────────────────────────

select ae.como('d1');
select is((select count(*)::int from public.fn_equipe_minhas_datas()), 3, 'g1 vê as três datas em que está escalada (a cancelada também, para mostrar o que mudou)');
select is((select string_agg(distinct data_id::text, ',') from public.fn_equipe_minhas_datas() where data_id in (ae.id('41'), ae.id('42'))), ae.id('41')::text || ',' || ae.id('42')::text, 'as datas são as dela');
select is((select jsonb_array_length(public.fn_equipe_folha(ae.id('41'))->'blocos')), 2, 'a folha de g1 traz o bloco de todos e o do grupo dela, não o do elenco');
select is((select jsonb_array_length(public.fn_equipe_folha(ae.id('41'))->'cartoes')), 1, 'e o cartão de viagem da data');
select ok(public.fn_equipe_folha(ae.id('41'))::text !~ '(AE Bia|AE Dani|AE Caio|777777)', 'a folha não traz outra pessoa nem o cachê');
select is(public.fn_equipe_folha(ae.id('4b')), null, 'a folha de uma data de outra organização é nula');
select is((select count(*)::int from public.producao_escalas) + (select count(*)::int from public.producao_pessoas) + (select count(*)::int from public.producao_acessos_equipe)
          + (select count(*)::int from public.producao_blocos) + (select count(*)::int from public.producao_vinculos_valores), 0,
          'g1 não lê nenhuma tabela da produção: não é membro');
select ae.como('d2');
select is((select jsonb_array_length(public.fn_equipe_folha(ae.id('41'))->'blocos')), 1, 'g2, sem grupo, só vê o bloco de todos');
select is(public.fn_equipe_folha(ae.id('42')), null, 'g2 não está escalado em D2: nada');
select ae.como('d4');
select is(public.fn_equipe_folha(ae.id('41')), null, 'quem não tem convite não vê folha');

-- ─── Responder ──────────────────────────────────────────────────────────────

select ae.como('d1');
select is(public.fn_equipe_responder(ae.id('61'), 'confirmada'), true, 'g1 confirma a própria escala');
select is(public.fn_equipe_responder(ae.id('63'), 'confirmada'), false, 'g1 não responde pela escala de outra pessoa');
select is(public.fn_equipe_responder(ae.id('64'), 'confirmada'), false, 'nem por uma data cancelada');
select ok(ae.tenta(format('select public.fn_equipe_responder(%L, %L)', ae.id('61'), 'talvez')) like '23514%', 'resposta fora da lista é recusada');
select ok(ae.efeito(format('update public.producao_escalas set confirmacao = %L where id = %L', 'recusada', ae.id('63'))) = '', 'e não escreve direto na tabela');
select ae.volta();
select is((select confirmacao from public.producao_escalas where id = ae.id('61')), 'confirmada', 'a resposta ficou gravada');
select is((select confirmacao from public.producao_escalas where id = ae.id('63')), 'pendente', 'a de outra pessoa não mudou');

-- ─── Revogar ────────────────────────────────────────────────────────────────

update public.producao_acessos_equipe set revogado_em = now() where pessoa_id = ae.id('51');
select ae.como('d1');
select is((select count(*)::int from public.fn_equipe_minhas_datas()), 0, 'convite revogado: g1 não vê mais nenhuma data');
select is(public.fn_equipe_folha(ae.id('41')), null, 'nem a folha');
select ae.volta();

select * from finish();
rollback;
