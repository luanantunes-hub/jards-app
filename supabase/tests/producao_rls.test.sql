-- PD0.8: o esqueleto da produção (obra, temporada, data e bloco).
--
-- Confere a migration producao_esqueleto: quem lê, cria, altera e apaga cada uma
-- das quatro tabelas (administrador, colaborador, leitor, quem não tem o módulo,
-- captador, proponente, outra organização, super admin e visitante), a produção
-- só para leitura depois que a cortesia acaba, o recorte "só onde está vinculado"
-- (que falha fechado até a PD1.9, e que aqui se simula para provar que a obra e
-- o bloco o acompanham), a coerência entre pai e filho (uma data numa temporada
-- de outra organização é recusada), a forma dos dados, as formas difíceis do
-- esqueleto e o que acontece ao apagar.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são 0d080000-0000-4000-8000-0000000000XX, e pe_teste.id('XX') os escreve.
-- Seção "Dados", sem pessoas:
--   organizações A, B, C e D (a0 a d0); em cada uma uma obra (1x), uma temporada
--   com ela (2x), uma data (3x), um bloco (4x), e ainda uma obra (5x) e uma
--   temporada (6x) vazias, que a sonda de apagar usa (as outras têm filhos e o
--   banco não as apaga). A tem mais: duas obras (71 sem temporada, 72 da
--   temporada 81), a temporada 82 (festival, sem obra) e as datas 91, 92 e 93
--   (esta, uma opção); os projetos 51 (A), 52 (B) e 53 (antigo, sem
--   organização) e as empresas 61 (A) e 62 (B).
-- Seção "Pessoas e módulos":
--   A, com a produção em vigor (cortesia): a1 admin (com registro "vinculado":
--     o admin ignora o recorte); a2 colaborador; a3 leitor; a4 colaborador sem
--     o módulo produção; a5 captador, com a produção no vínculo (o convite não
--     deixa, o banco aceitaria: tem de negar mesmo assim); a6 colaborador com o
--     recorte "vinculado"; a7 proponente;
--   B, com a produção em vigor: admin b1 e colaborador b2;
--   C, com a produção encerrada (só para leitura): admin c1, colaborador c2,
--     leitor c3 e colaborador c4 sem o módulo;
--   D, sem a produção: admin d1; o super admin e1 é colaborador de D só com a
--     captação;
--   e2, de fora de todas as organizações; o visitante, sem login.
--
-- Cada pessoa é descrita por uma linha: o que consegue fazer em cada tabela
-- (l ler, c criar, u alterar, d apagar). As seções depois das sondas não
-- dependem umas das outras, menos a última (o recorte por vínculo, que troca
-- auth_producao_ve_temporada dentro da transação): dá para rodar só algumas,
-- com o prelúdio e as seções-base de que precisam (Dados, Pessoas e módulos,
-- Ferramentas, Efeito, Sondas e Entrar e sair) na frente, ajustando o plan().
--
-- Rodar: supabase/tests/README.md, com a migration producao_esqueleto na frente.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(154);

create schema pe_teste;
grant usage on schema pe_teste to authenticated, anon;

create function pe_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d080000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- ─── Dados ──────────────────────────────────────────────────────────────────

-- Gravados direto, como o dono do banco: a regra de acesso não vale para ele,
-- os gatilhos de coerência valem.
do $dados$
begin
  -- Uma conta de teste é a dona dos projetos e das empresas. O cadastro também
  -- cria uma organização pessoal para cada pessoa nova, com a captação: ela
  -- fica e não muda nenhum caso, porque tudo olha só A a D.
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (pe_teste.id('f0'), 'pe-f0@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());

  insert into public.organizations (id, nome) values
    (pe_teste.id('a0'), 'PE organização A'), (pe_teste.id('b0'), 'PE organização B'),
    (pe_teste.id('c0'), 'PE organização C'), (pe_teste.id('d0'), 'PE organização D');

  -- O projeto antigo (sem organização) conta na organização pessoal da conta,
  -- não no limite de 1 projeto do plano gratuito de A e de B.
  insert into public.projetos_crm (id, account_id, nome, organization_id) values
    (pe_teste.id('51'), pe_teste.id('f0'), 'PE projeto A', pe_teste.id('a0')),
    (pe_teste.id('52'), pe_teste.id('f0'), 'PE projeto B', pe_teste.id('b0')),
    (pe_teste.id('53'), pe_teste.id('f0'), 'PE projeto antigo sem organização', null);
  insert into public.empresas_crm (id, account_id, nome, organization_id) values
    (pe_teste.id('61'), pe_teste.id('f0'), 'PE empresa A', pe_teste.id('a0')),
    (pe_teste.id('62'), pe_teste.id('f0'), 'PE empresa B', pe_teste.id('b0'));

  insert into public.producao_obras (id, organization_id, tipo, titulo)
  select pe_teste.id('1' || x), pe_teste.id(x || '0'), 'teatro', 'PE obra ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_obras (id, organization_id, tipo, titulo)
  select pe_teste.id('5' || x), pe_teste.id(x || '0'), 'teatro', 'PE obra vazia ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_obras (id, organization_id, tipo, titulo) values
    (pe_teste.id('71'), pe_teste.id('a0'), 'show', 'PE obra A sem temporada'),
    (pe_teste.id('72'), pe_teste.id('a0'), 'danca', 'PE obra A da segunda temporada');
  insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo)
  select pe_teste.id('2' || x), pe_teste.id(x || '0'), pe_teste.id('1' || x), 'circulacao', 'circula', 'teatro', 'PE temporada ' || x
  from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo)
  select pe_teste.id('6' || x), pe_teste.id(x || '0'), 'unica', 'recebe', 'teatro', 'PE temporada vazia ' || x
  from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo) values
    (pe_teste.id('81'), pe_teste.id('a0'), pe_teste.id('72'), 'temporada', 'recebe', 'danca', 'PE temporada A da segunda obra'),
    (pe_teste.id('82'), pe_teste.id('a0'), null, 'edicao', 'recebe', 'festival', 'PE festival A');
  insert into public.producao_datas (id, organization_id, temporada_id, obra_id, data)
  select pe_teste.id('3' || x), pe_teste.id(x || '0'), pe_teste.id('2' || x), pe_teste.id('1' || x), date '2026-11-20'
  from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_datas (id, organization_id, temporada_id, obra_id, data) values
    (pe_teste.id('91'), pe_teste.id('a0'), pe_teste.id('81'), pe_teste.id('72'), date '2026-12-05'),
    (pe_teste.id('92'), pe_teste.id('a0'), pe_teste.id('82'), pe_teste.id('71'), date '2026-12-06');
  insert into public.producao_datas (id, organization_id, temporada_id, data, situacao, opcao_ordem, opcao_ate) values
    (pe_teste.id('93'), pe_teste.id('a0'), pe_teste.id('81'), date '2026-12-07', 'opcao', 1, date '2026-11-30');
  insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo)
  select pe_teste.id('4' || x), pe_teste.id(x || '0'), pe_teste.id('3' || x), date '2026-11-20', timestamptz '2026-11-20 20:00-03', 'sessao'
  from unnest(array['a', 'b', 'c', 'd']) as x;
end
$dados$;

-- ─── Pessoas e módulos ──────────────────────────────────────────────────────

do $pessoas$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pe_teste.id(sufixo), 'pe-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1', 'b2', 'c1', 'c2', 'c3', 'c4', 'd1', 'e1', 'e2']) as sufixo;

  -- A e B com a produção por cortesia; C com a produção ativa e depois encerrada
  -- (o contrato a passa de modulos_ativos para modulos_leitura); D sem contrato.
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pe_teste.id('a0'), 'producao', 'cortesia', 20), (pe_teste.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pe_teste.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = pe_teste.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pe_teste.id(org), pe_teste.id(pessoa), papel, modulos::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a4', 'colaborador', '{captacao}'),
    ('a0', 'a5', 'captador', '{captacao,producao}'), ('a0', 'a6', 'colaborador', '{producao}'),
    ('a0', 'a7', 'proponente', '{captacao}'),
    ('b0', 'b1', 'admin', '{captacao,producao}'), ('b0', 'b2', 'colaborador', '{captacao,producao}'),
    ('c0', 'c1', 'admin', '{captacao,producao}'), ('c0', 'c2', 'colaborador', '{producao}'),
    ('c0', 'c3', 'leitor', '{producao}'), ('c0', 'c4', 'colaborador', '{captacao}'),
    ('d0', 'd1', 'admin', '{captacao,producao}'), ('d0', 'e1', 'colaborador', '{captacao}')
  ) as v(org, pessoa, papel, modulos);
  update public.profiles set jards_super_admin = true where id = pe_teste.id('e1');

  -- O recorte "só onde está vinculado", gravado direto, como o dono do banco.
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (pe_teste.id('a0'), pe_teste.id('a1'), false, 'vinculado'), (pe_teste.id('a0'), pe_teste.id('a6'), false, 'vinculado');
end
$pessoas$;

-- ─── Ferramentas ────────────────────────────────────────────────────────────

-- Roda o comando e desfaz. 'aceito' se passou; senão o código do erro e o nome
-- da restrição que recusou (ou a mensagem, quando não é uma restrição).
create function pe_teste.tenta(comando text) returns text language plpgsql as $$
declare
  nome text;
begin
  begin
    execute comando;
    -- As chaves entre obra, temporada e data são conferidas no fim da transação: força a
    -- conferência aqui, para o comando ser aceito ou recusado como seria no commit.
    set constraints all immediate;
    raise exception using errcode = 'RLS00', message = 'aceito';
  exception
    when sqlstate 'RLS00' then
      return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

-- Roda os comandos em ordem, devolve o resultado da consulta e desfaz tudo.
create function pe_teste.depois(comandos text[], consulta text) returns text language plpgsql as $$
declare
  comando text;
  resultado text;
begin
  begin
    foreach comando in array comandos loop
      execute comando;
    end loop;
    -- Idem: as chaves adiadas são conferidas depois do último comando.
    set constraints all immediate;
    execute consulta into resultado;
    raise exception using errcode = 'RLS00', message = coalesce(resultado, '(nulo)');
  exception
    when sqlstate 'RLS00' then
      return sqlerrm;
  end;
end;
$$;

-- ─── Efeito ─────────────────────────────────────────────────────────────────

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a
-- regra barrou (erro de permissão ou nenhuma linha); outro erro volta
-- descrito, para o teste mostrar o que quebrou.
create function pe_teste.efeito(comando text) returns text language plpgsql as $$
declare
  linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'RLS00', message = linhas::text;
  exception
    when sqlstate 'RLS00' then
      return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then
      return '';
    when others then
      return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

-- O que quem está logado faz numa tabela da organização o (a, b, c ou d): l, c, u, d ou '-'.
create function pe_teste.sonda(tabela text, o text) returns text language plpgsql as $$
declare
  org uuid := pe_teste.id(o || '0');
  inserir text;
  apagar text;
begin
  inserir := case tabela
    when 'producao_obras' then
      format('insert into public.producao_obras (organization_id, tipo, titulo) values (%L, %L, %L)', org, 'teatro', 'x')
    when 'producao_temporadas' then
      format('insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, %L, %L, %L, %L)',
             org, 'circulacao', 'circula', 'teatro', 'x')
    when 'producao_datas' then
      format('insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, %L)',
             org, pe_teste.id('2' || o), date '2026-12-01')
    when 'producao_blocos' then
      format('insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, %L, %L, %L)',
             org, pe_teste.id('3' || o), date '2026-11-20', timestamptz '2026-11-20 20:00-03', 'sessao')
  end;
  -- Obra e temporada com filhos o banco não apaga: a sonda apaga as vazias.
  apagar := case tabela
    when 'producao_obras' then format('delete from public.producao_obras where id = %L', pe_teste.id('5' || o))
    when 'producao_temporadas' then format('delete from public.producao_temporadas where id = %L', pe_teste.id('6' || o))
    else format('delete from public.%I where organization_id = %L', tabela, org)
  end;
  return coalesce(nullif(concat_ws('',
    case when pe_teste.efeito(format('select 1 from public.%I where organization_id = %L', tabela, org)) = 'sim' then 'l' end,
    case when pe_teste.efeito(inserir) = 'sim' then 'c' end,
    case when pe_teste.efeito(format('update public.%I set updated_at = updated_at where organization_id = %L', tabela, org)) = 'sim' then 'u' end,
    case when pe_teste.efeito(apagar) = 'sim' then 'd' end), ''), '-');
end;
$$;

-- A linha da pessoa logada na organização o: as quatro tabelas, na ordem do plano.
create function pe_teste.perfil(o text) returns text language sql as $$
  select 'obras=' || pe_teste.sonda('producao_obras', o) || ' temporadas=' || pe_teste.sonda('producao_temporadas', o)
      || ' datas=' || pe_teste.sonda('producao_datas', o) || ' blocos=' || pe_teste.sonda('producao_blocos', o);
$$;

create function pe_teste.tudo() returns text language sql immutable as $$
  select 'obras=lcud temporadas=lcud datas=lcud blocos=lcud';
$$;
create function pe_teste.leitura() returns text language sql immutable as $$
  select 'obras=l temporadas=l datas=l blocos=l';
$$;
create function pe_teste.nada() returns text language sql immutable as $$
  select 'obras=- temporadas=- datas=- blocos=-';
$$;

-- ─── Entrar e sair ──────────────────────────────────────────────────────────

-- Entra como a pessoa (ou como visitante, com null) até pe_teste.volta().
create function pe_teste.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pe_teste.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pe_teste.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── O catálogo: regras e privilégios ───────────────────────────────────────

select is((select array_agg(relname::text order by relname collate "C") from pg_class
           where oid in ('public.producao_obras'::regclass, 'public.producao_temporadas'::regclass,
                         'public.producao_datas'::regclass, 'public.producao_blocos'::regclass) and relrowsecurity),
          array['producao_blocos', 'producao_datas', 'producao_obras', 'producao_temporadas'],
          'as quatro tabelas têm a segurança por linha ligada');

select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_obras'),
          array['DELETE producao_obras: apaga', 'INSERT producao_obras: insere', 'SELECT producao_obras: le',
                'SELECT producao_obras: leitura sem assinatura', 'UPDATE producao_obras: edita'],
          'producao_obras: uma regra de cada comando, e a leitura sem assinatura');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_temporadas'),
          array['DELETE producao_temporadas: apaga', 'INSERT producao_temporadas: insere', 'SELECT producao_temporadas: le',
                'SELECT producao_temporadas: leitura sem assinatura', 'UPDATE producao_temporadas: edita'],
          'producao_temporadas: uma regra de cada comando, e a leitura sem assinatura');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_datas'),
          array['DELETE producao_datas: apaga', 'INSERT producao_datas: insere', 'SELECT producao_datas: le',
                'SELECT producao_datas: leitura sem assinatura', 'UPDATE producao_datas: edita'],
          'producao_datas: uma regra de cada comando, e a leitura sem assinatura');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_blocos'),
          array['DELETE producao_blocos: apaga', 'INSERT producao_blocos: insere', 'SELECT producao_blocos: le',
                'SELECT producao_blocos: leitura sem assinatura', 'UPDATE producao_blocos: edita'],
          'producao_blocos: uma regra de cada comando, e a leitura sem assinatura');

select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename in ('producao_obras', 'producao_temporadas', 'producao_datas', 'producao_blocos')
             and (roles <> '{authenticated}' or permissive <> 'PERMISSIVE' or cmd = 'ALL'
                  or qual = 'true' or with_check = 'true')),
          0, 'nenhuma regra é para todos os comandos, para o visitante, restritiva ou aberta (using true)');

select is((select count(*)::int from unnest(array['public.producao_obras', 'public.producao_temporadas', 'public.producao_datas', 'public.producao_blocos']) as t
           where has_table_privilege('anon', t, 'select') or has_table_privilege('anon', t, 'insert')
              or has_table_privilege('anon', t, 'update') or has_table_privilege('anon', t, 'delete')
              or has_table_privilege('anon', t, 'truncate') or has_table_privilege('anon', t, 'references') or has_table_privilege('anon', t, 'trigger')),
          0, 'o visitante não tem privilégio em nenhuma das quatro, tabela por tabela');
select is((select count(*)::int from unnest(array['public.producao_obras', 'public.producao_temporadas', 'public.producao_datas', 'public.producao_blocos']) as t
           where has_table_privilege('authenticated', t, 'select') and has_table_privilege('authenticated', t, 'insert')
             and has_table_privilege('authenticated', t, 'update') and has_table_privilege('authenticated', t, 'delete')
             and not has_table_privilege('authenticated', t, 'truncate') and not has_table_privilege('authenticated', t, 'references')
             and not has_table_privilege('authenticated', t, 'trigger')),
          4, 'quem está logado lê, insere, altera e apaga (as regras decidem), e não limpa nem referencia a tabela');

-- ─── O catálogo: funções e gatilhos ─────────────────────────────────────────

select is((select count(*)::int from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('fn_producao_updated_at', 'fn_producao_obra_coerencia', 'fn_producao_temporada_coerencia',
                             'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia', 'auth_producao_ve_obra')
             and proconfig @> array['search_path=public, pg_temp']),
          6, 'as seis funções da entrega têm o search_path fixo');
select is((select array_agg(proname::text order by proname::text collate "C") from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('fn_producao_updated_at', 'fn_producao_obra_coerencia', 'fn_producao_temporada_coerencia',
                             'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia', 'auth_producao_ve_obra') and prosecdef),
          array['auth_producao_ve_obra', 'fn_producao_bloco_coerencia', 'fn_producao_data_coerencia',
                'fn_producao_obra_coerencia', 'fn_producao_temporada_coerencia'],
          'a coerência e o recorte da obra rodam com a permissão do dono; só a data de atualização roda com a de quem grava');
select is((select array_agg(proname::text order by proname::text collate "C") from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('fn_producao_updated_at', 'fn_producao_obra_coerencia', 'fn_producao_temporada_coerencia',
                             'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia', 'auth_producao_ve_obra')
             and has_function_privilege('authenticated', oid, 'execute')),
          array['auth_producao_ve_obra'], 'quem está logado executa só o recorte da obra, que as regras chamam; os gatilhos ninguém chama');
select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('fn_producao_updated_at', 'fn_producao_obra_coerencia', 'fn_producao_temporada_coerencia',
                               'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia', 'auth_producao_ve_obra')
             and (has_function_privilege('anon', p.oid, 'execute')
                  or p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
          0, 'o visitante não executa nenhuma das seis, e nenhuma fica executável por public');

select is((select array_agg(tgname::text || ' ' || tgtype order by tgname collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_obras'::regclass, 'public.producao_temporadas'::regclass,
                                                  'public.producao_datas'::regclass, 'public.producao_blocos'::regclass)),
          array['producao_blocos_coerencia 23', 'producao_blocos_updated_at 19', 'producao_datas_coerencia 23',
                'producao_datas_updated_at 19', 'producao_obras_coerencia 23', 'producao_obras_updated_at 19',
                'producao_temporadas_coerencia 23', 'producao_temporadas_updated_at 19'],
          'cada tabela tem um gatilho de coerência (antes de inserir ou alterar) e um de atualização (antes de alterar)');
select is((select array_agg(t.tgname::text || ': ' || (select string_agg(a.attname, ', ' order by a.attnum)
                                                          from pg_attribute a where a.attrelid = t.tgrelid and a.attnum = any (t.tgattr::int2[]))
                            order by t.tgname collate "C")
           from pg_trigger t
           where not t.tgisinternal and t.tgname like '%\_coerencia'),
          array['producao_blocos_coerencia: organization_id, data_id',
                'producao_datas_coerencia: organization_id, temporada_id, obra_id, fuso, contratante_empresa_id',
                'producao_obras_coerencia: organization_id, projeto_id, companhia_empresa_id',
                'producao_temporadas_coerencia: organization_id, projeto_id, obra_id'],
          'os gatilhos de coerência olham as colunas que ligam a tabela ao pai');

-- ─── O catálogo: chaves, restrições e colunas ───────────────────────────────

select is((select array_agg(conname::text || ' ' || confdeltype::text order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_obras'::regclass, 'public.producao_temporadas'::regclass,
                                                'public.producao_datas'::regclass, 'public.producao_blocos'::regclass)),
          array['producao_blocos_data_id_fkey c', 'producao_blocos_organization_id_fkey c',
                'producao_datas_contratante_empresa_id_fkey n', 'producao_datas_obra_id_fkey a',
                'producao_datas_organization_id_fkey c', 'producao_datas_temporada_id_fkey a',
                'producao_obras_companhia_empresa_id_fkey n', 'producao_obras_organization_id_fkey c',
                'producao_obras_projeto_id_fkey n', 'producao_temporadas_obra_id_fkey a',
                'producao_temporadas_organization_id_fkey c', 'producao_temporadas_projeto_id_fkey n',
                'producao_temporadas_responsavel_fkey n'],
          'ao apagar: o bloco vai com a data; temporada e obra com filhos são recusadas; projeto, empresa e responsável só se desligam');
select is((select confdelsetcols from pg_constraint where conname = 'producao_temporadas_responsavel_fkey'),
          array[(select attnum from pg_attribute where attrelid = 'public.producao_temporadas'::regclass and attname = 'responsavel_id')]::int2[],
          'sair da organização desliga só o responsável, não a organização da temporada');
select is((select coalesce(array_agg(c.conname::text order by c.conname::text collate "C"), '{}'::text[])
           from pg_constraint c
           where c.contype = 'f' and c.conrelid in ('public.producao_obras'::regclass, 'public.producao_temporadas'::regclass,
                                                    'public.producao_datas'::regclass, 'public.producao_blocos'::regclass)
             and not exists (
               select 1 from pg_index i
               cross join lateral (select array_agg(u.k order by u.o) as inicio
                                   from unnest(i.indkey::int2[]) with ordinality as u(k, o)
                                   where u.o <= cardinality(c.conkey)) l
               where i.indrelid = c.conrelid and i.indisvalid and l.inicio @> c.conkey and c.conkey @> l.inicio)),
          '{}'::text[], 'toda chave estrangeira tem um índice que começa nas colunas dela');

select is((select array_agg(conrelid::regclass::text || ' ' || n order by conrelid::regclass::text collate "C")
           from (select conrelid, count(*)::int as n from pg_constraint where contype = 'c'
                 and conrelid in ('public.producao_obras'::regclass, 'public.producao_temporadas'::regclass,
                                  'public.producao_datas'::regclass, 'public.producao_blocos'::regclass)
                 group by conrelid) x),
          array['producao_blocos 7', 'producao_datas 8', 'producao_obras 4', 'producao_temporadas 6'],
          'as restrições de valor de cada tabela estão todas lá');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_obras'),
          array['id', 'organization_id', 'projeto_id', 'tipo', 'titulo', 'descricao', 'duracao_min', 'classificacao', 'icone', 'cor',
                'companhia_empresa_id', 'companhia_nome', 'arquivada', 'created_at', 'updated_at'], 'colunas de producao_obras');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_temporadas'),
          array['id', 'organization_id', 'projeto_id', 'obra_id', 'formato', 'lado', 'tipo', 'titulo', 'inicio', 'fim', 'situacao',
                'responsavel_id', 'created_at', 'updated_at'], 'colunas de producao_temporadas');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_datas'),
          array['id', 'organization_id', 'temporada_id', 'obra_id', 'tipo', 'data', 'data_fim', 'situacao', 'opcao_ordem', 'opcao_ate',
                'espaco_id', 'sala_id', 'uf', 'municipio_ibge', 'fuso', 'contratante_empresa_id', 'created_at', 'updated_at'],
          'colunas de producao_datas');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_blocos'),
          array['id', 'organization_id', 'data_id', 'dia', 'inicio', 'fim', 'exibicao', 'tipo', 'titulo', 'sala_id', 'confirmado',
                'visivel_para', 'capacidade', 'ordem', 'notas', 'created_at', 'updated_at'], 'colunas de producao_blocos');
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name in ('producao_obras', 'producao_temporadas', 'producao_datas', 'producao_blocos')
             and column_name ~* '(valor|cache|custo|preco|pago|pagamento|dinheiro|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|pix|cpf|cnpj)'),
          0, 'nenhuma coluna de dinheiro nem de dado pessoal nas quatro tabelas');

-- ─── Quem acessa o quê: organização A ───────────────────────────────────────

select pe_teste.como('a1');
select is(pe_teste.perfil('a'), pe_teste.tudo(), 'admin: lê, cria, altera e apaga as quatro tabelas, até com o recorte "vinculado" no registro');
select is(array[pe_teste.perfil('b'), pe_teste.perfil('c'), pe_teste.perfil('d')], array[pe_teste.nada(), pe_teste.nada(), pe_teste.nada()],
          'admin de uma organização: nada nas outras três');
select pe_teste.volta();
select pe_teste.como('a2');
select is(pe_teste.perfil('a'), pe_teste.tudo(), 'colaborador: lê, cria, altera e apaga');
select is((select count(*)::int from public.producao_obras), 4, 'colaborador: lê as 4 obras da organização dele, e só elas');
select is((select count(*)::int from public.producao_blocos), 1, 'colaborador: lê os blocos pela data, e só os da organização dele');
select throws_ok($t$select public.fn_producao_data_coerencia()$t$, '42501', null, 'colaborador: não chama a função do gatilho');
select pe_teste.volta();
select pe_teste.como('a3');
select is(pe_teste.perfil('a'), pe_teste.leitura(), 'leitor: lê e não escreve nada');
select pe_teste.volta();
select pe_teste.como('a4');
select is(pe_teste.perfil('a'), pe_teste.nada(), 'colaborador sem o módulo produção: nada');
select pe_teste.volta();
select pe_teste.como('a5');
select is(pe_teste.perfil('a'), pe_teste.nada(), 'captador: nada, mesmo com a produção no vínculo');
select pe_teste.volta();
select pe_teste.como('a6');
select is(pe_teste.perfil('a'), pe_teste.nada(), 'recorte "só onde está vinculado": falha fechado, não lê nem escreve nada até a PD1.9');
select pe_teste.volta();
select pe_teste.como('a7');
select is(pe_teste.perfil('a'), pe_teste.nada(), 'proponente: nada');
select pe_teste.volta();

-- ─── Quem acessa o quê: as outras organizações ──────────────────────────────

select pe_teste.como('b1');
select is(array[pe_teste.perfil('b'), pe_teste.perfil('a')], array[pe_teste.tudo(), pe_teste.nada()], 'admin de B: tudo em B e nada em A');
select pe_teste.volta();
select pe_teste.como('b2');
select is(array[pe_teste.perfil('b'), pe_teste.perfil('a')], array[pe_teste.tudo(), pe_teste.nada()], 'colaborador de B: tudo em B e nada em A');
select pe_teste.volta();

-- C: a cortesia acabou, a produção ficou só para leitura.
select pe_teste.como('c1');
select is(pe_teste.perfil('c'), pe_teste.leitura(), 'só leitura: o admin lê tudo e não escreve nada');
select pe_teste.volta();
select pe_teste.como('c2');
select is(pe_teste.perfil('c'), pe_teste.leitura(), 'só leitura: o colaborador lê e não escreve');
select pe_teste.volta();
select pe_teste.como('c3');
select is(pe_teste.perfil('c'), pe_teste.leitura(), 'só leitura: o leitor lê');
select pe_teste.volta();
select pe_teste.como('c4');
select is(pe_teste.perfil('c'), pe_teste.nada(), 'só leitura: quem não tinha o módulo não lê');
select pe_teste.volta();

-- D: sem a produção.
select pe_teste.como('d1');
select is(array[pe_teste.perfil('d'), pe_teste.perfil('a')], array[pe_teste.nada(), pe_teste.nada()],
          'organização sem o módulo: nem o admin com a produção no vínculo lê ou escreve');
select pe_teste.volta();

-- ─── Quem acessa o quê: super admin, gente de fora e visitante ──────────────

select pe_teste.como('e1');
select is(array[pe_teste.perfil('a'), pe_teste.perfil('b'), pe_teste.perfil('c'), pe_teste.perfil('d')],
          array[pe_teste.tudo(), pe_teste.tudo(), pe_teste.tudo(), pe_teste.tudo()],
          'super admin: passa em qualquer organização, até sem o módulo ou com ele só para leitura');
select pe_teste.volta();
select pe_teste.como('e2');
select is(pe_teste.perfil('a'), pe_teste.nada(), 'pessoa de fora de todas as organizações: nada');
select pe_teste.volta();
select pe_teste.como(null);
select is(pe_teste.perfil('a'), pe_teste.nada(), 'visitante: nada');
select throws_ok($t$select count(*) from public.producao_datas$t$, '42501', null, 'visitante: sem permissão nem para consultar a tabela');
select throws_ok($t$select public.auth_producao_ve_obra(pe_teste.id('a0'), pe_teste.id('1a'))$t$, '42501', null,
                 'visitante: não executa o recorte da obra');
select pe_teste.volta();

-- ─── Coerência entre pai e filho ────────────────────────────────────────────

-- Como o dono do banco: o gatilho vale para todo mundo.
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2b'))),
          '23514 temporada_de_outra_organizacao', 'uma data numa temporada de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'a data na temporada da própria organização passa');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, gen_random_uuid(), '2026-12-10')$t$,
                                pe_teste.id('a0'))),
          '23514 temporada_de_outra_organizacao', 'uma data numa temporada que não existe recebe a mesma recusa, sem dizer se existe');
select ok(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, data) values (%L, '2026-12-10')$t$, pe_teste.id('a0')))
          ~ '^23502 .*"temporada_id"', 'data sem temporada: quem recusa é a tabela');
select ok(pe_teste.tenta(format($t$insert into public.producao_datas (temporada_id, data) values (%L, '2026-12-10')$t$, pe_teste.id('2a')))
          ~ '^23502 .*"organization_id"', 'data sem organização: quem recusa é a tabela');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, obra_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'), pe_teste.id('1b'))),
          '23514 obra_de_outra_organizacao', 'uma data com a obra de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, contratante_empresa_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'), pe_teste.id('62'))),
          '23514 empresa_de_outra_organizacao', 'uma data com o contratante de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, obra_id, contratante_empresa_id, data) values (%L, %L, %L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'), pe_teste.id('72'), pe_teste.id('61'))),
          'aceito', 'a data com a obra e o contratante da própria organização passa');
select is(pe_teste.tenta(format($t$update public.producao_datas set temporada_id = %L where id = %L$t$, pe_teste.id('2b'), pe_teste.id('3a'))),
          '23514 temporada_de_outra_organizacao', 'mudar a data para a temporada de outra organização é recusado');
select is(pe_teste.tenta(format($t$update public.producao_datas set temporada_id = %L where id = %L$t$, pe_teste.id('81'), pe_teste.id('3a'))),
          'aceito', 'mudar a data para outra temporada da mesma organização passa');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, '2026-11-20', '2026-11-20 20:00-03', 'sessao')$t$,
                                pe_teste.id('a0'), pe_teste.id('3b'))),
          '23514 data_de_outra_organizacao', 'um bloco numa data de outra organização é recusado');
select is(pe_teste.tenta(format($t$update public.producao_blocos set data_id = %L where id = %L$t$, pe_teste.id('3b'), pe_teste.id('4a'))),
          '23514 data_de_outra_organizacao', 'mudar o bloco para a data de outra organização é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, obra_id, formato, lado, tipo, titulo) values (%L, %L, 'turne', 'circula', 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('1b'))),
          '23514 obra_de_outra_organizacao', 'uma temporada com a obra de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, projeto_id, formato, lado, tipo, titulo) values (%L, %L, 'turne', 'circula', 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('52'))),
          '23514 projeto_de_outra_organizacao', 'uma temporada com o projeto de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, projeto_id, formato, lado, tipo, titulo) values (%L, %L, 'turne', 'circula', 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('53'))),
          '23514 projeto_de_outra_organizacao', 'o projeto antigo, sem organização, não se liga a temporada nenhuma');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, projeto_id, obra_id, formato, lado, tipo, titulo) values (%L, %L, %L, 'turne', 'circula', 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('51'), pe_teste.id('1a'))),
          'aceito', 'a temporada com o projeto e a obra da própria organização passa');
select is(pe_teste.tenta(format($t$update public.producao_temporadas set obra_id = %L where id = %L$t$, pe_teste.id('1b'), pe_teste.id('2a'))),
          '23514 obra_de_outra_organizacao', 'mudar a temporada para a obra de outra organização é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, projeto_id, tipo, titulo) values (%L, %L, 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('52'))),
          '23514 projeto_de_outra_organizacao', 'uma obra com o projeto de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, companhia_empresa_id, tipo, titulo) values (%L, %L, 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('62'))),
          '23514 empresa_de_outra_organizacao', 'uma obra com a companhia de outra organização é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, projeto_id, companhia_empresa_id, companhia_nome, tipo, titulo) values (%L, %L, %L, 'Cia. Convidada', 'show', 'x')$t$,
                                pe_teste.id('a0'), pe_teste.id('51'), pe_teste.id('61'))),
          'aceito', 'a obra com o projeto e a companhia da própria organização passa (o nome pode ficar junto)');
select is(pe_teste.tenta(format($t$update public.producao_obras set organization_id = %L where id = %L$t$, pe_teste.id('b0'), pe_teste.id('1a'))),
          '23514 organizacao_nao_muda', 'a obra não muda de organização');
select is(pe_teste.tenta(format($t$update public.producao_temporadas set organization_id = %L where id = %L$t$, pe_teste.id('b0'), pe_teste.id('2a'))),
          '23514 organizacao_nao_muda', 'a temporada não muda de organização');
select is(pe_teste.tenta(format($t$update public.producao_datas set organization_id = %L where id = %L$t$, pe_teste.id('b0'), pe_teste.id('3a'))),
          '23514 organizacao_nao_muda', 'a data não muda de organização');
select is(pe_teste.tenta(format($t$update public.producao_blocos set organization_id = %L where id = %L$t$, pe_teste.id('b0'), pe_teste.id('4a'))),
          '23514 organizacao_nao_muda', 'o bloco não muda de organização');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, fuso, data) values (%L, %L, 'Nope/Zone', '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 fuso_invalido', 'um fuso que o banco não conhece é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, fuso, data) values (%L, %L, 'America/Manaus', '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'o fuso de outro estado passa');

-- ─── Coerência vista pelas pessoas ──────────────────────────────────────────

select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, responsavel_id) values (%L, 'turne', 'circula', 'show', 'x', %L)$t$,
                                pe_teste.id('a0'), pe_teste.id('a2'))),
          'aceito', 'o responsável é um membro da organização');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, responsavel_id) values (%L, 'turne', 'circula', 'show', 'x', %L)$t$,
                                pe_teste.id('a0'), pe_teste.id('e2'))),
          '23503 producao_temporadas_responsavel_fkey', 'o responsável precisa ser membro da organização');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, responsavel_id) values (%L, 'turne', 'circula', 'show', 'x', %L)$t$,
                                pe_teste.id('a0'), pe_teste.id('b1'))),
          '23503 producao_temporadas_responsavel_fkey', 'o responsável de outra organização também é recusado');
select is(pe_teste.depois(array[format($t$update public.producao_temporadas set responsavel_id = %L where id = %L$t$, pe_teste.id('a2'), pe_teste.id('2a')),
                                format($t$delete from public.organization_members where organization_id = %L and user_id = %L$t$, pe_teste.id('a0'), pe_teste.id('a2'))],
                          format($t$select (responsavel_id is null)::text || ' ' || organization_id::text from public.producao_temporadas where id = %L$t$, pe_teste.id('2a'))),
          'true ' || pe_teste.id('a0')::text, 'quem sai da organização deixa de ser o responsável, e a temporada continua na organização');

-- Como a pessoa do navegador: o gatilho vem antes da regra de acesso.
select pe_teste.como('a1');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-10')$t$,
                                pe_teste.id('a0'), pe_teste.id('2b'))),
          '23514 temporada_de_outra_organizacao', 'o admin de A não põe uma data de A na temporada de B');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-10')$t$,
                                pe_teste.id('b0'), pe_teste.id('2b'))),
          '42501 new row violates row-level security policy for table "producao_datas"',
          'nem escreve na organização B, com a temporada de B: a regra de acesso barra');
select is(pe_teste.tenta(format($t$update public.producao_datas set organization_id = %L, temporada_id = %L where id = %L$t$,
                                pe_teste.id('b0'), pe_teste.id('2b'), pe_teste.id('3a'))),
          '23514 organizacao_nao_muda', 'nem muda uma data de A para B');
select pe_teste.volta();

-- ─── A forma dos dados: obra e temporada ────────────────────────────────────

select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo) values (%L, 'musica-popular', 'x')$t$, pe_teste.id('a0'))),
          'aceito', 'um tipo de obra que o catálogo ainda não tem entra: tipo é do código, não do banco');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo) values (%L, '  ', 'x')$t$, pe_teste.id('a0'))),
          '23514 producao_obras_tipo_check', 'tipo vazio é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo) values (%L, %L, 'x')$t$, pe_teste.id('a0'), repeat('t', 41))),
          '23514 producao_obras_tipo_check', 'tipo com mais de 40 letras é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo) values (%L, 'show', '   ')$t$, pe_teste.id('a0'))),
          '23514 producao_obras_titulo_check', 'obra sem título é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo, duracao_min) values (%L, 'show', 'x', 0)$t$, pe_teste.id('a0'))),
          '23514 producao_obras_duracao_check', 'duração de zero minuto é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo, cor) values (%L, 'show', 'x', 'azul')$t$, pe_teste.id('a0'))),
          '23514 producao_obras_cor_check', 'cor que não é #RRGGBB é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_obras (organization_id, tipo, titulo, cor, icone, classificacao, duracao_min, descricao) values (%L, 'show', 'x', '#1A2b3C', 'music', '12', 90, 'texto')$t$, pe_teste.id('a0'))),
          'aceito', 'obra completa passa');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, 'residencia', 'recebe', 'danca', 'x')$t$, pe_teste.id('a0'))),
          'aceito', 'um formato novo do catálogo entra sem mexer no banco');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, 'turne', 'ambos', 'show', 'x')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_lado_check', 'lado que não é circula nem recebe é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, situacao) values (%L, 'turne', 'circula', 'show', 'x', 'confirmada')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_situacao_check', 'situação de temporada desconhecida é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, inicio, fim) values (%L, 'turne', 'circula', 'show', 'x', '2026-12-10', '2026-12-01')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_periodo_check', 'temporada que termina antes de começar é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, '', 'circula', 'show', 'x')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_formato_check', 'formato vazio é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, 'turne', 'circula', '', 'x')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_tipo_check', 'temporada sem tipo é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (%L, 'turne', 'circula', 'show', '  ')$t$, pe_teste.id('a0'))),
          '23514 producao_temporadas_titulo_check', 'temporada sem título é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo, inicio) values (%L, 'turne', 'circula', 'show', 'x', '2026-12-10')$t$, pe_teste.id('a0'))),
          'aceito', 'temporada só com a data de início passa: o fim vem depois');

-- ─── A forma dos dados: data ────────────────────────────────────────────────

select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, tipo, data) values (%L, %L, 'show', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_tipo_check', 'tipo de data fora dos nove do plano é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, situacao, data) values (%L, %L, 'confirmado', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_situacao_check', 'situação de data desconhecida é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, data, data_fim) values (%L, %L, '2026-12-10', '2026-12-09')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_periodo_check', 'período que termina antes de começar é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, situacao, opcao_ordem, opcao_ate, data) values (%L, %L, 'opcao', 2, '2026-11-30', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'opção guarda a ordem na fila e o prazo');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, situacao, opcao_ordem, data) values (%L, %L, 'confirmada', 2, '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_opcao_check', 'data confirmada não guarda a ordem da opção');
select is(pe_teste.tenta(format($t$update public.producao_datas set situacao = 'confirmada' where id = %L$t$, pe_teste.id('93'))),
          '23514 producao_datas_opcao_check', 'confirmar uma opção sem limpar a ordem e o prazo é recusado');
select is(pe_teste.tenta(format($t$update public.producao_datas set situacao = 'confirmada', opcao_ordem = null, opcao_ate = null where id = %L$t$, pe_teste.id('93'))),
          'aceito', 'confirmar a opção limpando a ordem e o prazo passa');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, situacao, opcao_ordem, data) values (%L, %L, 'opcao', 0, '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_opcao_ordem_check', 'ordem da opção abaixo de 1 é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, uf, data) values (%L, %L, 'sp', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_uf_check', 'UF em minúscula é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, municipio_ibge, data) values (%L, %L, '3550308', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_municipio_ibge_check', 'município sem UF é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, uf, municipio_ibge, data) values (%L, %L, 'SP', '35503', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_municipio_ibge_check', 'código de município com menos de 7 dígitos é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, uf, municipio_ibge, data) values (%L, %L, 'SP', '3550308', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'UF e município do IBGE passam');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, fuso, data) values (%L, %L, 'BRT', '2026-12-10')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          '23514 producao_datas_fuso_check', 'sigla de fuso não é nome de fuso: a tabela recusa');

-- ─── A forma dos dados: bloco ───────────────────────────────────────────────

select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, tipo, exibicao) values (%L, %L, '2026-11-20', 'sessao', 'visivel')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_exibicao_check', 'exibição da hora desconhecida é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, tipo) values (%L, %L, '2026-11-20', 'sessao')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_hora_check', 'bloco de hora exata sem hora é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, tipo, exibicao) values (%L, %L, '2026-11-20', 'montagem', 'a_definir')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          'aceito', 'bloco com a hora a definir passa sem hora');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, fim, tipo, exibicao) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'montagem', 'a_definir')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_periodo_check', 'bloco com fim e sem início é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, fim, tipo) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', '2026-11-20 21:00-03', 'sessao')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_periodo_check', 'bloco que termina antes de começar é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, capacidade) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', -1)$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_capacidade_check', 'capacidade negativa é recusada');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, visivel_para) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', '{}')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_visivel_para_check', 'lista de grupos vazia é recusada: nulo quer dizer todos');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', '')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_tipo_check', 'bloco sem tipo é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, titulo) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', '   ')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          '23514 producao_blocos_titulo_check', 'bloco com título só de espaços é recusado');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, exibicao, visivel_para) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', 'oculta', '{equipe,tecnica}')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          'aceito', 'hora oculta (guardada, mas fora das folhas) e bloco visível só para alguns grupos passam');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'leitura_de_mesa')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          'aceito', 'um tipo de bloco que o catálogo ainda não tem entra: tipo é do código, não do banco');

-- ─── Formas difíceis do esqueleto ───────────────────────────────────────────

select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, uf, municipio_ibge, data) values (%L, %L, 'MG', '3106200', '2026-12-12')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'espetáculo de rua: a data tem só a UF e o município, sem espaço nem sala');
select is(pe_teste.depois(array[
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo, inicio, fim) values (%L, %L, 'unica', 'recebe', 'exposicao', 'Período expositivo', '2026-12-01', '2027-02-28')$t$, pe_teste.id('e5'), pe_teste.id('a0')),
            format($t$insert into public.producao_datas (organization_id, temporada_id, tipo, data, data_fim) values (%L, %L, 'visitacao', '2026-12-01', '2027-02-28')$t$, pe_teste.id('a0'), pe_teste.id('e5')),
            format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) select %L, id, date '2027-01-15', timestamptz '2027-01-15 10:00-03', 'visitacao' from public.producao_datas where temporada_id = %L$t$, pe_teste.id('a0'), pe_teste.id('e5'))],
            format($t$select count(*) from public.producao_blocos b join public.producao_datas d on d.id = b.data_id where d.temporada_id = %L and d.data_fim = '2027-02-28'$t$, pe_teste.id('e5'))),
          '1', 'exposição: uma data com período de visitação e blocos em dias dentro dele');
select is(pe_teste.depois(array[
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (%L, %L, 'filmagem', 'circula', 'audiovisual', 'Filmagem')$t$, pe_teste.id('e6'), pe_teste.id('a0')),
            format($t$insert into public.producao_datas (organization_id, temporada_id, tipo, situacao, data) select %L, %L, 'filmagem', 'confirmada', date '2027-03-01' + n from generate_series(0, 4) as n$t$, pe_teste.id('a0'), pe_teste.id('e6'))],
            format($t$select count(*) || ' diárias' from public.producao_datas where temporada_id = %L and tipo = 'filmagem'$t$, pe_teste.id('e6'))),
          '5 diárias', 'filmagem: cinco diárias confirmadas em dias seguidos');
select is(pe_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, fim, tipo) values (%L, %L, '2026-11-20', '2026-11-20 23:30-03', '2026-11-21 01:00-03', 'sessao')$t$, pe_teste.id('a0'), pe_teste.id('3a'))),
          'aceito', 'bloco que passa da meia-noite: continua no dia em que começou e termina no seguinte');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, tipo, data) values (%L, %L, 'viagem', '2026-12-13')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'dia de viagem: sem obra, sem lugar e sem blocos');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, obra_id, data) values (%L, %L, %L, '2026-12-14')$t$, pe_teste.id('a0'), pe_teste.id('82'), pe_teste.id('72'))),
          'aceito', 'festival: a temporada sem obra recebe datas de obras diferentes');
select is(pe_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, gen_random_uuid(), gen_random_uuid(), '2026-12-15')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'aceito', 'espaço e sala são uuid soltos até a PD0.9 (a lona de circo, espaço móvel, espera essa entrega)');

-- ─── Apagar ─────────────────────────────────────────────────────────────────

select is(left(pe_teste.tenta(format($t$delete from public.producao_temporadas where id = %L$t$, pe_teste.id('2a'))), 5), '23503',
          'temporada com datas não se apaga');
select is(left(pe_teste.tenta(format($t$delete from public.producao_obras where id = %L$t$, pe_teste.id('1a'))), 5), '23503',
          'obra com temporadas e datas não se apaga: arquiva-se');
select is(left(pe_teste.tenta(format($t$delete from public.producao_obras where id = %L$t$, pe_teste.id('71'))), 5), '23503',
          'obra só com uma data também não se apaga');
select is(pe_teste.depois(array[format($t$delete from public.producao_datas where temporada_id = %L$t$, pe_teste.id('2c')),
                                format($t$delete from public.producao_temporadas where id = %L$t$, pe_teste.id('2c'))],
                          format($t$select (select count(*) from public.producao_temporadas where id = %L) || ' ' || (select count(*) from public.producao_blocos where organization_id = %L)$t$, pe_teste.id('2c'), pe_teste.id('c0'))),
          '0 0', 'esvaziada a temporada (as datas levam os blocos), ela se apaga');
select is(pe_teste.tenta(format($t$with d as (delete from public.producao_datas where temporada_id = %L) delete from public.producao_temporadas where id = %L$t$, pe_teste.id('2d'), pe_teste.id('2d'))),
          'aceito', 'as datas e a temporada saem no mesmo comando');
select is(pe_teste.depois(array[
            format($t$delete from public.producao_obras where organization_id = %L$t$, pe_teste.id('b0')),
            format($t$delete from public.producao_temporadas where organization_id = %L$t$, pe_teste.id('b0')),
            format($t$delete from public.producao_datas where organization_id = %L$t$, pe_teste.id('b0'))],
          format($t$select (select count(*) from public.producao_obras where organization_id = %1$L) || ' ' || (select count(*) from public.producao_temporadas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_datas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_blocos where organization_id = %1$L)$t$, pe_teste.id('b0'))),
          '0 0 0 0', 'as tabelas de uma organização saem na mesma transação, do pai para o filho: a ordem em que o apagamento da organização as apaga');
select is(pe_teste.depois(array[format($t$delete from public.producao_datas where id = %L$t$, pe_teste.id('3b'))],
                          format($t$select count(*) from public.producao_blocos where data_id = %L$t$, pe_teste.id('3b'))),
          '0', 'apagar a data apaga os blocos dela');
select is(pe_teste.depois(array[format($t$update public.producao_obras set projeto_id = %L where id = %L$t$, pe_teste.id('51'), pe_teste.id('1a')),
                                format($t$update public.producao_temporadas set projeto_id = %L where id = %L$t$, pe_teste.id('51'), pe_teste.id('2a')),
                                format($t$delete from public.projetos_crm where id = %L$t$, pe_teste.id('51'))],
                          format($t$select (select projeto_id is null from public.producao_obras where id = %L)::text || ' ' || (select projeto_id is null from public.producao_temporadas where id = %L)::text$t$, pe_teste.id('1a'), pe_teste.id('2a'))),
          'true true', 'apagar o projeto desliga a obra e a temporada, sem apagá-las');
select is(pe_teste.depois(array[format($t$update public.producao_obras set companhia_empresa_id = %L where id = %L$t$, pe_teste.id('61'), pe_teste.id('1a')),
                                format($t$update public.producao_datas set contratante_empresa_id = %L where id = %L$t$, pe_teste.id('61'), pe_teste.id('3a')),
                                format($t$delete from public.empresas_crm where id = %L$t$, pe_teste.id('61'))],
                          format($t$select (select companhia_empresa_id is null from public.producao_obras where id = %L)::text || ' ' || (select contratante_empresa_id is null from public.producao_datas where id = %L)::text$t$, pe_teste.id('1a'), pe_teste.id('3a'))),
          'true true', 'apagar a empresa desliga a companhia e o contratante, sem apagar a obra nem a data');

-- ─── Atualização ────────────────────────────────────────────────────────────

select is(pe_teste.depois(array[
            format($t$insert into public.producao_obras (id, organization_id, tipo, titulo, updated_at) values (%L, %L, 'show', 'antes', '2020-01-01')$t$, pe_teste.id('f1'), pe_teste.id('a0')),
            format($t$update public.producao_obras set titulo = 'depois' where id = %L$t$, pe_teste.id('f1')),
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo, updated_at) values (%L, %L, 'turne', 'circula', 'show', 'antes', '2020-01-01')$t$, pe_teste.id('f2'), pe_teste.id('a0')),
            format($t$update public.producao_temporadas set titulo = 'depois' where id = %L$t$, pe_teste.id('f2'))],
            format($t$select ((select updated_at from public.producao_obras where id = %L) > '2020-01-01')::text || ' ' || ((select updated_at from public.producao_temporadas where id = %L) > '2020-01-01')::text$t$, pe_teste.id('f1'), pe_teste.id('f2'))),
          'true true', 'alterar uma obra ou uma temporada atualiza o updated_at');
select is(pe_teste.depois(array[
            format($t$insert into public.producao_datas (id, organization_id, temporada_id, data, updated_at) values (%L, %L, %L, '2026-12-20', '2020-01-01')$t$, pe_teste.id('f3'), pe_teste.id('a0'), pe_teste.id('2a')),
            format($t$update public.producao_datas set uf = 'RJ' where id = %L$t$, pe_teste.id('f3')),
            format($t$insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo, updated_at) values (%L, %L, %L, '2026-12-20', '2026-12-20 20:00-03', 'sessao', '2020-01-01')$t$, pe_teste.id('f4'), pe_teste.id('a0'), pe_teste.id('f3')),
            format($t$update public.producao_blocos set confirmado = true where id = %L$t$, pe_teste.id('f4'))],
            format($t$select ((select updated_at from public.producao_datas where id = %L) > '2020-01-01')::text || ' ' || ((select updated_at from public.producao_blocos where id = %L) > '2020-01-01')::text$t$, pe_teste.id('f3'), pe_teste.id('f4'))),
          'true true', 'alterar uma data ou um bloco atualiza o updated_at');

-- ─── O recorte por vínculo: preparo ─────────────────────────────────────────

-- Este é o último cenário: troca auth_producao_ve_temporada dentro da transação
-- (a PD1.9 fará o mesmo, com producao_vinculos) e liga a6 às temporadas 2a e 82.
-- A obra e o bloco têm de acompanhar sem que ninguém mexa em suas regras.
create table pe_teste.vinculos (user_id uuid not null, temporada_id uuid not null);
insert into pe_teste.vinculos values (pe_teste.id('a6'), pe_teste.id('2a')), (pe_teste.id('a6'), pe_teste.id('82'));

create or replace function public.auth_producao_ve_temporada(p_org uuid, p_temporada_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_jards_super_admin() or exists (
    select 1 from public.auth_producao_ficha(p_org) ficha
    where public.auth_producao_papel_permite(ficha.papel, ficha.dinheiro, ficha.alcada, 'ler')
      and (ficha.papel = 'admin' or ficha.escopo = 'organizacao'
           or (ficha.escopo = 'vinculado' and exists (
                 select 1 from pe_teste.vinculos v where v.user_id = auth.uid() and v.temporada_id = p_temporada_id)))
  );
$$;

-- ─── O recorte por vínculo: leitura ─────────────────────────────────────────

select pe_teste.como('a6');
select is((select array_agg(titulo order by titulo collate "C") from public.producao_temporadas),
          array['PE festival A', 'PE temporada a'], 'vinculado: vê só as temporadas em que está');
select is((select array_agg(id::text order by id::text) from public.producao_datas),
          array[pe_teste.id('3a')::text, pe_teste.id('92')::text], 'vinculado: vê só as datas dessas temporadas');
select is((select array_agg(id::text) from public.producao_blocos), array[pe_teste.id('4a')::text],
          'vinculado: vê só os blocos dessas datas');
select is((select array_agg(titulo order by titulo collate "C") from public.producao_obras),
          array['PE obra A sem temporada', 'PE obra a'], 'vinculado: vê as obras que essas temporadas e datas usam, e só elas');
select pe_teste.volta();
select pe_teste.como('a1');
select is((select count(*)::int from public.producao_obras), 4, 'admin com o registro "vinculado": continua vendo as 4 obras da organização');
select pe_teste.volta();
select pe_teste.como('a2');
select is((select count(*)::int from public.producao_temporadas), 4, 'colaborador sem recorte: continua vendo as 4 temporadas');
select pe_teste.volta();

-- ─── O recorte por vínculo: escrita ─────────────────────────────────────────

select pe_teste.como('a6');
select is(pe_teste.efeito(format($t$update public.producao_datas set uf = uf where id = %L$t$, pe_teste.id('3a'))), 'sim', 'vinculado: altera a data da temporada dele');
select is(pe_teste.efeito(format($t$update public.producao_datas set uf = uf where id = %L$t$, pe_teste.id('91'))), '', 'vinculado: não altera a data de outra temporada');
select is(pe_teste.efeito(format($t$update public.producao_blocos set confirmado = confirmado where id = %L$t$, pe_teste.id('4a'))), 'sim', 'vinculado: altera o bloco da data dele');
select is(pe_teste.efeito(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-30')$t$, pe_teste.id('a0'), pe_teste.id('2a'))),
          'sim', 'vinculado: cria data na temporada dele');
select is(pe_teste.efeito(format($t$insert into public.producao_datas (organization_id, temporada_id, data) values (%L, %L, '2026-12-30')$t$, pe_teste.id('a0'), pe_teste.id('81'))),
          '', 'vinculado: não cria data na temporada de outra pessoa');
select is(pe_teste.efeito(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, '2026-12-05', '2026-12-05 20:00-03', 'sessao')$t$, pe_teste.id('a0'), pe_teste.id('91'))),
          '', 'vinculado: não cria bloco na data de outra temporada');
select is(pe_teste.efeito($t$insert into public.producao_temporadas (organization_id, formato, lado, tipo, titulo) values (pe_teste.id('a0'), 'turne', 'circula', 'show', 'x')$t$),
          '', 'vinculado: não cria temporada (ainda não é de ninguém, então ele não a veria)');
select is(pe_teste.efeito($t$insert into public.producao_obras (organization_id, tipo, titulo) values (pe_teste.id('a0'), 'show', 'x')$t$),
          '', 'vinculado: não cria obra nova, que ainda não é de temporada nenhuma');
select is(pe_teste.efeito(format($t$update public.producao_obras set titulo = titulo where id = %L$t$, pe_teste.id('1a'))), 'sim', 'vinculado: altera a obra da temporada dele');
select is(pe_teste.efeito(format($t$update public.producao_obras set titulo = titulo where id = %L$t$, pe_teste.id('72'))), '', 'vinculado: não altera a obra que ele não vê');
select is(pe_teste.efeito(format($t$update public.producao_datas set temporada_id = %L where id = %L$t$, pe_teste.id('81'), pe_teste.id('3a'))),
          '', 'vinculado: não passa a data dele para a temporada de outra pessoa (a regra confere também o destino)');
select is(pe_teste.efeito(format($t$update public.producao_blocos set data_id = %L where id = %L$t$, pe_teste.id('91'), pe_teste.id('4a'))),
          '', 'vinculado: não passa o bloco dele para a data de outra temporada');
select pe_teste.volta();

select * from finish();
rollback;
