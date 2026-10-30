-- PD1.9 e PD1.10 (parte essencial): a equipe da produção.
--
-- Confere as migrations producao_equipe e producao_equipe_recorte_da_pessoa: as quatro tabelas
-- (pessoas, vínculos, valores do vínculo e escalas) com a segurança por linha, as chaves e os
-- gatilhos; quem vê o quê (administrador, colaborador, leitor, leitor que vê o dinheiro, o recorte
-- "só onde está vinculado", o vínculo cancelado, captador, outra organização, a produção só para
-- leitura, quem é de fora e o visitante); o recorte que passa a valer pelo vínculo, mostra quem está
-- escalado na data que se vê e cai quando a pessoa é arquivada; quem grava (o dinheiro só com
-- editar e dinheiro; com o recorte, só no lugar que vê e só a pessoa que vê); a coerência entre
-- organizações e a forma dos dados; e o histórico, que deixa e-mail, telefone e dinheiro de fora.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids são
-- 0d190000-0000-4000-8000-0000000000XX, e eq.id('XX') os escreve.
--   A (a0), produção por cortesia: temporadas T1 (21) e T2 (22), o espaço E1 (31), as datas D1 (41,
--     de T1) e D2 (42, de T2); as pessoas P1 (51, conta de a5), P2 (52), P3 (53, conta de a6), P4
--     (54) e P6 (56, o diarista, sem vínculo); os vínculos V1 (61, P1 em T1, confirmado), V2 (62, P2
--     em T2), V3 (63, P3 em T1, cancelado) e V4 (64, P4 no espaço E1); os valores de V1 e V2; as
--     escalas S1 (71, P1 em D1), S2 (72, P2 em D2) e S6 (76, P6 em D1). Pessoas: a1 admin, a2
--     colaborador, a3 leitor, a4 leitor que vê o dinheiro, a5 e a6 colaboradores com o recorte
--     "vinculado", a7 captador.
--   B (b0), produção por cortesia: T (2b), espaço (3b), data (4b), pessoa (5b), vínculo (6b) e
--     escala (7b); b1 admin.
--   C (c0), produção encerrada (só para leitura): T (2c), data (4c), pessoa (5c), vínculo (6c) com
--     valor e escala (7c); c1 colaborador.
--   e2, de fora de todas; o visitante, sem login.
--
-- Rodar: supabase/tests/README.md, com as migrations producao_equipe e
-- producao_equipe_recorte_da_pessoa na frente, nessa ordem, se ainda não estiverem aplicadas. Não tem DELETE (o conector do Supabase recusa): o que acontece ao apagar é conferido
-- pelo catálogo (a ação e o adiamento de cada chave).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(61);

create schema eq;
grant usage on schema eq to authenticated, anon;

create function eq.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d190000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- ─── Dados ──────────────────────────────────────────────────────────────────

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select eq.id(s), 'eq-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1', 'c1', 'e2']) as s;

  insert into public.organizations (id, nome) values
    (eq.id('a0'), 'EQ organização A'), (eq.id('b0'), 'EQ organização B'), (eq.id('c0'), 'EQ organização C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (eq.id('a0'), 'producao', 'cortesia', 20), (eq.id('b0'), 'producao', 'cortesia', 5);
  -- C: a produção ativa e depois encerrada (o contrato a passa para modulos_leitura).
  insert into public.organization_modulos (organization_id, modulo, status) values (eq.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = eq.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select eq.id(o), eq.id(p), papel, m::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a4', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('a0', 'a6', 'colaborador', '{producao}'),
    ('a0', 'a7', 'captador', '{captacao}'), ('b0', 'b1', 'admin', '{captacao,producao}'),
    ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (eq.id('a0'), eq.id('a4'), true, 'organizacao'),
    (eq.id('a0'), eq.id('a5'), false, 'vinculado'),
    (eq.id('a0'), eq.id('a6'), false, 'vinculado');

  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (eq.id('21'), eq.id('a0'), 'circulacao', 'circula', 'teatro', 'EQ T1'),
    (eq.id('22'), eq.id('a0'), 'circulacao', 'circula', 'teatro', 'EQ T2'),
    (eq.id('2b'), eq.id('b0'), 'circulacao', 'circula', 'teatro', 'EQ TB'),
    (eq.id('2c'), eq.id('c0'), 'circulacao', 'circula', 'teatro', 'EQ TC');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (eq.id('31'), eq.id('a0'), 'EQ teatro A', 'teatro'), (eq.id('3b'), eq.id('b0'), 'EQ teatro B', 'teatro');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (eq.id('41'), eq.id('a0'), eq.id('21'), date '2026-12-01'),
    (eq.id('42'), eq.id('a0'), eq.id('22'), date '2026-12-01'),
    (eq.id('4b'), eq.id('b0'), eq.id('2b'), date '2026-12-01'),
    (eq.id('4c'), eq.id('c0'), eq.id('2c'), date '2026-12-01');

  insert into public.producao_pessoas (id, organization_id, nome, email, telefone, user_id) values
    (eq.id('51'), eq.id('a0'), 'EQ Pessoa 1', 'eq-p1@teste.invalid', '11 90000-0001', eq.id('a5')),
    (eq.id('52'), eq.id('a0'), 'EQ Pessoa 2', 'eq-p2@teste.invalid', '11 90000-0002', null),
    (eq.id('53'), eq.id('a0'), 'EQ Pessoa 3', null, null, eq.id('a6')),
    (eq.id('54'), eq.id('a0'), 'EQ Pessoa 4', null, null, null),
    (eq.id('56'), eq.id('a0'), 'EQ Diarista', null, null, null),
    (eq.id('5b'), eq.id('b0'), 'EQ Pessoa B', null, null, null),
    (eq.id('5c'), eq.id('c0'), 'EQ Pessoa C', null, null, null);
  insert into public.producao_vinculos (id, organization_id, pessoa_id, temporada_id, espaco_id, funcao, situacao) values
    (eq.id('61'), eq.id('a0'), eq.id('51'), eq.id('21'), null, 'Assistente', 'confirmada'),
    (eq.id('62'), eq.id('a0'), eq.id('52'), eq.id('22'), null, 'Luz', 'prevista'),
    (eq.id('63'), eq.id('a0'), eq.id('53'), eq.id('21'), null, 'Som', 'cancelada'),
    (eq.id('64'), eq.id('a0'), eq.id('54'), null, eq.id('31'), 'Bilheteria', 'confirmada'),
    (eq.id('6b'), eq.id('b0'), eq.id('5b'), eq.id('2b'), null, 'Luz', 'prevista'),
    (eq.id('6c'), eq.id('c0'), eq.id('5c'), eq.id('2c'), null, 'Luz', 'prevista');
  insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values
    (eq.id('61'), eq.id('a0'), 1000), (eq.id('62'), eq.id('a0'), 2000), (eq.id('6c'), eq.id('c0'), 300);
  insert into public.producao_escalas (id, organization_id, pessoa_id, data_id) values
    (eq.id('71'), eq.id('a0'), eq.id('51'), eq.id('41')), (eq.id('72'), eq.id('a0'), eq.id('52'), eq.id('42')),
    (eq.id('76'), eq.id('a0'), eq.id('56'), eq.id('41')),
    (eq.id('7b'), eq.id('b0'), eq.id('5b'), eq.id('4b')), (eq.id('7c'), eq.id('c0'), eq.id('5c'), eq.id('4c'));
end
$dados$;

-- ─── Ferramentas ────────────────────────────────────────────────────────────

-- Roda o comando e desfaz: 'aceito', ou o código do erro e o nome da restrição (ou a mensagem).
create function eq.tenta(comando text) returns text language plpgsql as $$
declare
  nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'EQ000', message = 'aceito';
  exception
    when sqlstate 'EQ000' then
      return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

-- Roda o comando e desfaz: 'sim' se atingiu alguma linha, '' se a regra barrou.
create function eq.efeito(comando text) returns text language plpgsql as $$
declare
  linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'EQ000', message = linhas::text;
  exception
    when sqlstate 'EQ000' then
      return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then
      return '';
    when others then
      return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

-- O que quem está logado vê da equipe da organização o.
create function eq.ve(o text) returns text language sql as $$
  select format('pessoas=%s vinculos=%s valores=%s escalas=%s',
    (select count(*) from public.producao_pessoas where organization_id = eq.id(o || '0')),
    (select count(*) from public.producao_vinculos where organization_id = eq.id(o || '0')),
    (select count(*) from public.producao_vinculos_valores where organization_id = eq.id(o || '0')),
    (select count(*) from public.producao_escalas where organization_id = eq.id(o || '0')));
$$;

-- O recorte de quem está logado na organização A: T1, T2, nula e o espaço E1 (::text escreve true e false; o format, t e f).
create function eq.recorte() returns text language sql as $$
  select format('%s %s %s %s',
    public.auth_producao_ve_temporada(eq.id('a0'), eq.id('21'))::text, public.auth_producao_ve_temporada(eq.id('a0'), eq.id('22'))::text,
    public.auth_producao_ve_temporada(eq.id('a0'), null)::text, public.auth_producao_ve_espaco(eq.id('a0'), eq.id('31'))::text);
$$;

create function eq.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', eq.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function eq.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_class where relrowsecurity and oid in (
             'public.producao_pessoas'::regclass, 'public.producao_vinculos'::regclass,
             'public.producao_vinculos_valores'::regclass, 'public.producao_escalas'::regclass)),
          4, 'as quatro tabelas têm a segurança por linha ligada');
select is((select count(*)::int from pg_policies where schemaname = 'public'
             and tablename in ('producao_pessoas', 'producao_vinculos', 'producao_vinculos_valores', 'producao_escalas')),
          20, 'cinco regras por tabela: ler, ler sem assinatura, inserir, alterar e apagar');
select is((select count(*)::int from pg_policies where schemaname = 'public'
             and tablename in ('producao_pessoas', 'producao_vinculos', 'producao_vinculos_valores', 'producao_escalas')
             and (qual = 'true' or with_check = 'true')),
          0, 'nenhuma regra aberta');
select is((select string_agg(conname::text || '=' || confdeltype::text || case when condeferred then ' adiada' else '' end, ', '
                             order by conname::text collate "C")
           from pg_constraint where contype = 'f' and conrelid in (
             'public.producao_pessoas'::regclass, 'public.producao_vinculos'::regclass,
             'public.producao_vinculos_valores'::regclass, 'public.producao_escalas'::regclass)),
          'producao_escalas_data_id_fkey=a adiada, producao_escalas_organization_id_fkey=c, producao_escalas_pessoa_id_fkey=a adiada, '
          'producao_pessoas_membro_fkey=n, producao_pessoas_organization_id_fkey=c, producao_vinculos_espaco_id_fkey=a adiada, '
          'producao_vinculos_organization_id_fkey=c, producao_vinculos_pessoa_id_fkey=a adiada, producao_vinculos_temporada_id_fkey=a adiada, '
          'producao_vinculos_valores_organization_id_fkey=c, producao_vinculos_valores_vinculo_id_fkey=c',
          'apagar: o que tem vínculo ou escala não se apaga (fim da transação), o valor vai com o vínculo, a conta só se desliga e a organização leva tudo');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger where not tgisinternal and tgname like '%historico'
             and tgrelid in ('public.producao_pessoas'::regclass, 'public.producao_vinculos'::regclass,
                             'public.producao_vinculos_valores'::regclass, 'public.producao_escalas'::regclass)),
          'producao_escalas_historico producao_pessoas_historico producao_vinculos_historico',
          'histórico nas três tabelas; os valores ficam sem');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_pessoa_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_vinculo_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_vinculo_valor_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_escala_coerencia()', 'execute'),
          'ninguém de fora do banco chama a coerência');
select ok(has_function_privilege('authenticated', 'public.auth_producao_ve_pessoa(uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.auth_producao_ve_pessoa(uuid, uuid)', 'execute'),
          'quem está logado executa o recorte da pessoa; o visitante não');
select ok(has_function_privilege('authenticated', 'public.auth_producao_ve_temporada(uuid, uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.auth_producao_ve_espaco(uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.auth_producao_ve_temporada(uuid, uuid)', 'execute'),
          'trocar o recorte manteve os privilégios');

-- ─── Quem vê o quê ──────────────────────────────────────────────────────────

select eq.como('a1');
select is(eq.ve('a'), 'pessoas=5 vinculos=4 valores=2 escalas=3', 'administrador: tudo, inclusive o dinheiro');
select eq.como('a2');
select is(eq.ve('a'), 'pessoas=5 vinculos=4 valores=0 escalas=3', 'colaborador: tudo, menos o dinheiro');
select eq.como('a3');
select is(eq.ve('a'), 'pessoas=5 vinculos=4 valores=0 escalas=3', 'leitor: tudo, menos o dinheiro');
select eq.como('a4');
select is(eq.ve('a'), 'pessoas=5 vinculos=4 valores=2 escalas=3', 'leitor que vê o dinheiro: tudo');
select eq.como('a5');
select is(eq.ve('a'), 'pessoas=3 vinculos=2 valores=0 escalas=2',
          'recorte por vínculo: só a temporada T1 (P1 e P3, com vínculo nela, e o diarista escalado em D1; os vínculos e as escalas dela)');
select eq.como('a6');
select is(eq.ve('a'), 'pessoas=0 vinculos=0 valores=0 escalas=0', 'vínculo cancelado não dá o recorte');
select eq.como('a7');
select is(eq.ve('a'), 'pessoas=0 vinculos=0 valores=0 escalas=0', 'captador: nada');
select eq.como('b1');
select is(eq.ve('a'), 'pessoas=0 vinculos=0 valores=0 escalas=0', 'administrador de outra organização: nada');
select eq.como('c1');
select is(eq.ve('c'), 'pessoas=1 vinculos=1 valores=0 escalas=1', 'produção só para leitura: lê, menos o dinheiro');
select eq.como('e2');
select is(eq.ve('a'), 'pessoas=0 vinculos=0 valores=0 escalas=0', 'quem é de fora: nada');
select eq.como(null);
select is(eq.efeito('select 1 from public.producao_pessoas') || eq.efeito('select 1 from public.producao_vinculos')
          || eq.efeito('select 1 from public.producao_vinculos_valores') || eq.efeito('select 1 from public.producao_escalas'),
          '', 'o visitante não lê nenhuma das quatro');

-- ─── O recorte por vínculo ──────────────────────────────────────────────────

select eq.como('a5');
select is(eq.recorte(), 'true false false false', 'a5 vê a temporada do vínculo dele, não a outra, não responde por nula nem pelo espaço');
select eq.como('a6');
select is(eq.recorte(), 'false false false false', 'a6, com o vínculo cancelado, não vê nada');
select eq.como('a2');
select is(eq.recorte(), 'true true true true', 'quem tem a organização inteira vê tudo, como antes');
select eq.volta();
update public.producao_pessoas set arquivada = true where id = eq.id('51');
select eq.como('a5');
select is(eq.recorte(), 'false false false false', 'arquivar a pessoa tira o recorte de quem é ela');
select eq.volta();
update public.producao_pessoas set arquivada = false where id = eq.id('51');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select eq.como('a2');
select is(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('a0'), 'EQ nova')),
          'aceito', 'colaborador cria pessoa');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('21'), 'Ator')),
          'aceito', 'colaborador vincula pessoa a temporada');
select ok(eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values (%L, %L, 10)',
                          eq.id('64'), eq.id('a0'))) like '42501%',
          'colaborador sem o dinheiro não grava cachê');
select is(eq.efeito(format('update public.producao_escalas set confirmacao = %L where id = %L', 'confirmada', eq.id('71'))),
          'sim', 'colaborador confirma a escala');
select eq.como('a4');
select ok(eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values (%L, %L, 10)',
                          eq.id('64'), eq.id('a0'))) like '42501%',
          'leitor que vê o dinheiro não grava cachê');
select is(eq.efeito(format('update public.producao_vinculos_valores set cache = 1 where vinculo_id = %L', eq.id('61'))),
          '', 'nem altera');
select eq.como('a1');
select is(eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache, diaria) values (%L, %L, 500, 80)',
                          eq.id('64'), eq.id('a0'))),
          'aceito', 'administrador grava cachê e diária');
select eq.como('a5');
select ok(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('a0'), 'EQ x')) like '42501%',
          'com o recorte, não cria pessoa');
select ok(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('51'), eq.id('22'), 'X')) like '42501%',
          'com o recorte, não vincula na temporada que não vê');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('51'), eq.id('21'), 'Contrarregra')),
          'aceito', 'com o recorte, vincula na temporada que vê');
select is(eq.efeito(format('update public.producao_pessoas set telefone = %L where id = %L', '1', eq.id('51'))),
          'sim', 'com o recorte, altera a pessoa que vê');
select ok(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id) values (%L, %L, %L)',
                          eq.id('a0'), eq.id('51'), eq.id('42'))) like '42501%',
          'com o recorte, não escala numa data de outra temporada');
-- P2 só tem vínculo e escala em T2: quem tem o recorte não a vê e, sabendo o id, não a traz para T1.
select ok(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('21'), 'Ator')) like '42501%',
          'com o recorte, não vincula quem não vê');
select ok(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id) values (%L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('41'))) like '42501%',
          'com o recorte, não escala quem não vê');
select is(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id) values (%L, %L, %L)',
                          eq.id('a0'), eq.id('53'), eq.id('41'))),
          'aceito', 'com o recorte, escala quem vê na data que vê');
select eq.como('a3');
select ok(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('a0'), 'EQ x')) like '42501%',
          'leitor não cria pessoa');
select is(eq.efeito(format('update public.producao_vinculos set situacao = %L where organization_id = %L', 'confirmada', eq.id('a0'))),
          '', 'leitor não altera vínculo');
select eq.como('c1');
select ok(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('c0'), 'EQ x')) like '42501%',
          'produção só para leitura não grava');
select eq.como(null);
select ok(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('a0'), 'EQ x')) like '42501%',
          'visitante não grava');
select eq.volta();

-- ─── Coerência e forma ──────────────────────────────────────────────────────

select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('5b'), eq.id('21'), 'X')),
          '23514 pessoa_de_outra_organizacao', 'vínculo com pessoa de outra organização');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('2b'), 'X')),
          '23514 temporada_de_outra_organizacao', 'vínculo com temporada de outra organização');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, espaco_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('3b'), 'X')),
          '23514 espaco_de_outra_organizacao', 'vínculo com espaço de outra organização');
select is(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id) values (%L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('4b'))),
          '23514 data_de_outra_organizacao', 'escala em data de outra organização');
select is(eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values (%L, %L, 1)',
                          eq.id('6b'), eq.id('a0'))),
          '23514 vinculo_de_outra_organizacao', 'valor de vínculo de outra organização');
select is(eq.tenta(format('update public.producao_pessoas set organization_id = %L where id = %L', eq.id('b0'), eq.id('52'))),
          '23514 organizacao_nao_muda', 'a pessoa não muda de organização');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, espaco_id, funcao) values (%L, %L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('21'), eq.id('31'), 'X')),
          '23514 producao_vinculos_lugar_check', 'o vínculo é de uma temporada ou de um espaço, não dos dois');
select is(eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                          eq.id('a0'), eq.id('51'), eq.id('21'), ' assistente ')),
          '23505 producao_vinculos_temporada_funcao_key', 'a mesma função duas vezes na mesma temporada (maiúsculas e espaços não contam)');
select is(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id) values (%L, %L, %L)',
                          eq.id('a0'), eq.id('51'), eq.id('41'))),
          '23505 producao_escalas_pessoa_data_key', 'a mesma pessoa duas vezes na mesma data');
select is(eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id, chamada, saida) values (%L, %L, %L, %L, %L)',
                          eq.id('a0'), eq.id('52'), eq.id('41'), '2026-12-01 20:00-03', '2026-12-01 19:00-03')),
          '23514 producao_escalas_periodo_check', 'a saída não vem antes da chamada');
select is(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, email) values (%L, %L, %L)', eq.id('a0'), 'EQ x', 'sem-arroba')),
          '23514 producao_pessoas_email_check', 'e-mail sem arroba');
select is(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, user_id) values (%L, %L, %L)', eq.id('a0'), 'EQ x', eq.id('e2'))),
          '23503 producao_pessoas_membro_fkey', 'a conta ligada é de um membro da organização');
select is(eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, user_id) values (%L, %L, %L)', eq.id('a0'), 'EQ x', eq.id('a5'))),
          '23505 producao_pessoas_user_key', 'uma pessoa por membro');
-- As outras restrições, uma por comando (o banco confere as de valor em ordem alfabética: cada comando quebra só uma).
select is(array[
            eq.tenta(format('insert into public.producao_pessoas (organization_id, nome) values (%L, %L)', eq.id('a0'), ' ')),
            eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, nome_artistico) values (%L, %L, %L)', eq.id('a0'), 'EQ x', ' ')),
            eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, telefone) values (%L, %L, %L)', eq.id('a0'), 'EQ x', ' ')),
            eq.tenta(format('insert into public.producao_pessoas (organization_id, nome, tipo) values (%L, %L, %L)', eq.id('a0'), 'EQ x', ' ')),
            eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao) values (%L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('21'), ' ')),
            eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao, grupo) values (%L, %L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('21'), 'X', ' ')),
            eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('21'), 'X', '2026-12-10', '2026-12-01')),
            eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, temporada_id, funcao, situacao) values (%L, %L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('21'), 'X', 'encerrada')),
            eq.tenta(format('insert into public.producao_vinculos (organization_id, pessoa_id, espaco_id, funcao) values (%L, %L, %L, %L)',
                            eq.id('a0'), eq.id('54'), eq.id('31'), 'bilheteria')),
            eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, cache) values (%L, %L, -1)', eq.id('63'), eq.id('a0'))),
            eq.tenta(format('insert into public.producao_vinculos_valores (vinculo_id, organization_id, diaria) values (%L, %L, -1)', eq.id('63'), eq.id('a0'))),
            eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id, funcao) values (%L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('41'), ' ')),
            eq.tenta(format('insert into public.producao_escalas (organization_id, pessoa_id, data_id, confirmacao) values (%L, %L, %L, %L)',
                            eq.id('a0'), eq.id('52'), eq.id('41'), 'talvez'))],
          array['23514 producao_pessoas_nome_check', '23514 producao_pessoas_nome_artistico_check', '23514 producao_pessoas_telefone_check',
                '23514 producao_pessoas_tipo_check', '23514 producao_vinculos_funcao_check', '23514 producao_vinculos_grupo_check',
                '23514 producao_vinculos_periodo_check', '23514 producao_vinculos_situacao_check', '23505 producao_vinculos_espaco_funcao_key',
                '23514 producao_vinculos_valores_cache_check', '23514 producao_vinculos_valores_diaria_check',
                '23514 producao_escalas_funcao_check', '23514 producao_escalas_confirmacao_check'],
          'em branco, ao contrário, fora da lista, repetido no espaço e negativo: nome, nome artístico, telefone, tipo, função, grupo, período, situação, cachê, diária e confirmação');

-- ─── Histórico ──────────────────────────────────────────────────────────────

select is((select count(*)::int from public.producao_historico where organization_id = eq.id('a0') and entidade = 'producao_vinculos_valores'),
          0, 'o dinheiro não vai para o histórico');
update public.producao_pessoas set nome = 'EQ Pessoa 2b', telefone = '11 90000-0099' where id = eq.id('52');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = eq.id('52') and acao = 'alterou'),
          'nome', 'mudar nome e telefone deixa só o nome no histórico');
select is((select count(*)::int from public.producao_historico where organization_id = eq.id('a0')
             and (coalesce(antes, '') || coalesce(depois, '')) ~ '(eq-p[12]@|11 90000-)'),
          0, 'e-mail e telefone não aparecem em nenhuma linha do histórico');
select eq.como('a5');
select is(format('%s %s',
            (select (count(*) > 0)::text from public.producao_historico where entidade = 'producao_pessoas' and entidade_id = eq.id('51')),
            (select count(*) from public.producao_historico where entidade = 'producao_pessoas' and entidade_id = eq.id('52'))),
          'true 0', 'com o recorte, lê o histórico da pessoa que vê e não o da outra');
select eq.como('a1');
select ok((select count(*) from public.producao_historico where entidade = 'producao_vinculos' and entidade_id = eq.id('61')) > 0,
          'o administrador lê o histórico do vínculo');
select eq.volta();

select * from finish();
rollback;
