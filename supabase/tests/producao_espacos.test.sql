-- PD0.9: espaços e salas da produção.
--
-- Confere a migration producao_espacos: quem lê, cria, altera e apaga cada uma das
-- duas tabelas (administrador, colaborador, leitor, quem não tem o módulo, captador,
-- proponente, outra organização, super admin e visitante); a produção só para leitura
-- depois que a cortesia acaba; o recorte "só onde está vinculado" (que falha fechado
-- até a PD1.9, e que aqui se simula para provar que a sala o acompanha); a coerência
-- (espaço, sala, data e bloco na mesma organização, e a sala sempre do espaço da data);
-- a forma dos dados; as formas difíceis (a lona de circo como espaço de datas em cidades
-- diferentes, a rua sem sala, o centro cultural com duas salas, o festival em vários
-- espaços); e o que acontece ao apagar (espaço com datas e sala em uso não se apagam,
-- a sala sai com o espaço, a organização inteira se apaga).
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são 0d090000-0000-4000-8000-0000000000XX, e pz_teste.id('XX') os escreve.
-- Seção "Dados", sem pessoas:
--   organizações A, B, C e D (a0 a d0); em cada uma uma temporada (2x), dois espaços (o
--   7x, com as salas 8x e 6x e a data 3x, que tem o bloco 4x na sala 8x; e o 5x, vazio, que
--   a sonda de apagar usa), e a sala livre 6x, que a sonda de apagar usa também. A tem
--   mais: a lona (91, espaço móvel), o centro cultural (92) com as salas 93 e 94, e as
--   empresas 61 (A) e 62 (B).
-- Seção "Pessoas e módulos":
--   A, com a produção em vigor (cortesia): a1 admin (com registro "vinculado": o admin
--     ignora o recorte); a2 colaborador; a3 leitor; a4 colaborador sem o módulo produção;
--     a5 captador, com a produção no vínculo (o convite não deixa, o banco aceitaria: tem
--     de negar mesmo assim); a6 colaborador com o recorte "vinculado"; a7 proponente;
--   B, com a produção em vigor: admin b1;
--   C, com a produção encerrada (só para leitura): admin c1, colaborador c2, leitor c3 e
--     colaborador c4 sem o módulo;
--   D, sem a produção: admin d1; o super admin e1 é colaborador de D só com a captação;
--   e2, de fora de todas as organizações; o visitante, sem login.
--
-- Cada pessoa é descrita por uma linha: o que consegue fazer em cada tabela (l ler,
-- c criar, u alterar, d apagar). As seções depois das sondas não dependem umas das
-- outras, menos a última (o recorte por vínculo, que troca auth_producao_ve_espaco
-- dentro da transação): dá para rodar só algumas, com o prelúdio e as seções-base de que
-- precisam (Dados, Pessoas e módulos, Ferramentas, Efeito, Sondas e Entrar e sair) na
-- frente, ajustando o plan().
--
-- Rodar: supabase/tests/README.md, com a migration producao_espacos na frente.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(110);

create schema pz_teste;
grant usage on schema pz_teste to authenticated, anon;

create function pz_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d090000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- ─── Dados ──────────────────────────────────────────────────────────────────

-- Gravados direto, como o dono do banco: a regra de acesso não vale para ele, os
-- gatilhos de coerência valem.
do $dados$
begin
  -- Uma conta de teste é a dona das empresas. O cadastro também cria uma organização
  -- pessoal para cada pessoa nova: ela fica e não muda nenhum caso (tudo olha só A a D).
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (pz_teste.id('f0'), 'pz-f0@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values
    (pz_teste.id('a0'), 'PZ organização A'), (pz_teste.id('b0'), 'PZ organização B'),
    (pz_teste.id('c0'), 'PZ organização C'), (pz_teste.id('d0'), 'PZ organização D');
  insert into public.empresas_crm (id, account_id, nome, organization_id) values
    (pz_teste.id('61'), pz_teste.id('f0'), 'PZ empresa A', pz_teste.id('a0')),
    (pz_teste.id('62'), pz_teste.id('f0'), 'PZ empresa B', pz_teste.id('b0'));

  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo)
  select pz_teste.id('2' || x), pz_teste.id(x || '0'), 'circulacao', 'circula', 'teatro', 'PZ temporada ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_espacos (id, organization_id, nome, tipo)
  select pz_teste.id('7' || x), pz_teste.id(x || '0'), 'PZ espaço ' || x, 'teatro' from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_espacos (id, organization_id, nome, tipo)
  select pz_teste.id('5' || x), pz_teste.id(x || '0'), 'PZ espaço vazio ' || x, 'galeria' from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_salas (id, organization_id, espaco_id, nome)
  select pz_teste.id('8' || x), pz_teste.id(x || '0'), pz_teste.id('7' || x), 'PZ sala ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_salas (id, organization_id, espaco_id, nome)
  select pz_teste.id('6' || x), pz_teste.id(x || '0'), pz_teste.id('7' || x), 'PZ sala livre ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_datas (id, organization_id, temporada_id, espaco_id, sala_id, data)
  select pz_teste.id('3' || x), pz_teste.id(x || '0'), pz_teste.id('2' || x), pz_teste.id('7' || x), pz_teste.id('8' || x), date '2026-11-20' from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo, sala_id)
  select pz_teste.id('4' || x), pz_teste.id(x || '0'), pz_teste.id('3' || x), date '2026-11-20', timestamptz '2026-11-20 20:00-03', 'sessao', pz_teste.id('8' || x) from unnest(array['a', 'b', 'c', 'd']) as x;

  insert into public.producao_espacos (id, organization_id, nome, tipo, movel, proprio) values
    (pz_teste.id('91'), pz_teste.id('a0'), 'PZ Lona', 'circo', true, true),
    (pz_teste.id('92'), pz_teste.id('a0'), 'PZ Centro Cultural', 'centro-cultural', false, false);
  insert into public.producao_salas (id, organization_id, espaco_id, nome, capacidade) values
    (pz_teste.id('93'), pz_teste.id('a0'), pz_teste.id('92'), 'PZ Sala 1', 120),
    (pz_teste.id('94'), pz_teste.id('a0'), pz_teste.id('92'), 'PZ Sala 2', 60);
end
$dados$;

-- ─── Pessoas e módulos ──────────────────────────────────────────────────────

do $pessoas$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pz_teste.id(sufixo), 'pz-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1', 'c1', 'c2', 'c3', 'c4', 'd1', 'e1', 'e2']) as sufixo;

  -- A e B com a produção por cortesia; C com a produção ativa e depois encerrada
  -- (o contrato a passa de modulos_ativos para modulos_leitura); D sem contrato.
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pz_teste.id('a0'), 'producao', 'cortesia', 20), (pz_teste.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pz_teste.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = pz_teste.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pz_teste.id(org), pz_teste.id(pessoa), papel, modulos::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a4', 'colaborador', '{captacao}'),
    ('a0', 'a5', 'captador', '{captacao,producao}'), ('a0', 'a6', 'colaborador', '{producao}'),
    ('a0', 'a7', 'proponente', '{captacao}'),
    ('b0', 'b1', 'admin', '{captacao,producao}'),
    ('c0', 'c1', 'admin', '{captacao,producao}'), ('c0', 'c2', 'colaborador', '{producao}'),
    ('c0', 'c3', 'leitor', '{producao}'), ('c0', 'c4', 'colaborador', '{captacao}'),
    ('d0', 'd1', 'admin', '{captacao,producao}'), ('d0', 'e1', 'colaborador', '{captacao}')
  ) as v(org, pessoa, papel, modulos);
  update public.profiles set jards_super_admin = true where id = pz_teste.id('e1');

  -- O recorte "só onde está vinculado", gravado direto, como o dono do banco.
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (pz_teste.id('a0'), pz_teste.id('a1'), false, 'vinculado'), (pz_teste.id('a0'), pz_teste.id('a6'), false, 'vinculado');
end
$pessoas$;

-- ─── Ferramentas ────────────────────────────────────────────────────────────

-- Roda o comando e desfaz. 'aceito' se passou; senão o código do erro e o nome da
-- restrição que recusou (ou a mensagem, quando não é uma restrição). As chaves entre
-- espaço, sala, data e bloco são conferidas no fim da transação: força a conferência
-- aqui, para o comando ser aceito ou recusado como seria no commit.
create function pz_teste.tenta(comando text) returns text language plpgsql as $$
declare
  nome text;
begin
  begin
    execute comando;
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
create function pz_teste.depois(comandos text[], consulta text) returns text language plpgsql as $$
declare
  comando text;
  resultado text;
begin
  begin
    foreach comando in array comandos loop
      execute comando;
    end loop;
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

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a regra
-- barrou (erro de permissão ou nenhuma linha); outro erro volta descrito.
create function pz_teste.efeito(comando text) returns text language plpgsql as $$
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
create function pz_teste.sonda(tabela text, o text) returns text language plpgsql as $$
declare
  org uuid := pz_teste.id(o || '0');
  inserir text;
  apagar text;
begin
  inserir := case tabela
    when 'producao_espacos' then
      format('insert into public.producao_espacos (organization_id, nome, tipo) values (%L, %L, %L)', org, 'x', 'teatro')
    when 'producao_salas' then
      format('insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, %L)', org, pz_teste.id('7' || o), 'x')
  end;
  -- Espaço com datas e sala em uso o banco não apaga: a sonda apaga o vazio e a sala livre.
  apagar := case tabela
    when 'producao_espacos' then format('delete from public.producao_espacos where id = %L', pz_teste.id('5' || o))
    else format('delete from public.producao_salas where id = %L', pz_teste.id('6' || o))
  end;
  return coalesce(nullif(concat_ws('',
    case when pz_teste.efeito(format('select 1 from public.%I where organization_id = %L', tabela, org)) = 'sim' then 'l' end,
    case when pz_teste.efeito(inserir) = 'sim' then 'c' end,
    case when pz_teste.efeito(format('update public.%I set updated_at = updated_at where organization_id = %L', tabela, org)) = 'sim' then 'u' end,
    case when pz_teste.efeito(apagar) = 'sim' then 'd' end), ''), '-');
end;
$$;

-- A linha da pessoa logada na organização o: as duas tabelas, espaços e salas.
create function pz_teste.perfil(o text) returns text language sql as $$
  select 'espacos=' || pz_teste.sonda('producao_espacos', o) || ' salas=' || pz_teste.sonda('producao_salas', o);
$$;

create function pz_teste.tudo() returns text language sql immutable as $$ select 'espacos=lcud salas=lcud'; $$;
create function pz_teste.leitura() returns text language sql immutable as $$ select 'espacos=l salas=l'; $$;
create function pz_teste.nada() returns text language sql immutable as $$ select 'espacos=- salas=-'; $$;

-- ─── Entrar e sair ──────────────────────────────────────────────────────────

-- Entra como a pessoa (ou como visitante, com null) até pz_teste.volta().
create function pz_teste.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pz_teste.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pz_teste.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── O catálogo: regras e privilégios ───────────────────────────────────────

select is((select array_agg(relname::text order by relname collate "C") from pg_class
           where oid in ('public.producao_espacos'::regclass, 'public.producao_salas'::regclass) and relrowsecurity),
          array['producao_espacos', 'producao_salas'], 'as duas tabelas têm a segurança por linha ligada');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_espacos'),
          array['DELETE producao_espacos: apaga', 'INSERT producao_espacos: insere', 'SELECT producao_espacos: le',
                'SELECT producao_espacos: leitura sem assinatura', 'UPDATE producao_espacos: edita'],
          'producao_espacos: uma regra de cada comando, e a leitura sem assinatura');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_salas'),
          array['DELETE producao_salas: apaga', 'INSERT producao_salas: insere', 'SELECT producao_salas: le',
                'SELECT producao_salas: leitura sem assinatura', 'UPDATE producao_salas: edita'],
          'producao_salas: uma regra de cada comando, e a leitura sem assinatura');
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename in ('producao_espacos', 'producao_salas')
             and (roles <> '{authenticated}' or permissive <> 'PERMISSIVE' or cmd = 'ALL'
                  or qual = 'true' or with_check = 'true')),
          0, 'nenhuma regra é para todos os comandos, para o visitante, restritiva ou aberta (using true)');
select is((select count(*)::int from unnest(array['public.producao_espacos', 'public.producao_salas']) as t
           where has_table_privilege('anon', t, 'select') or has_table_privilege('anon', t, 'insert')
              or has_table_privilege('anon', t, 'update') or has_table_privilege('anon', t, 'delete')
              or has_table_privilege('anon', t, 'truncate') or has_table_privilege('anon', t, 'references') or has_table_privilege('anon', t, 'trigger')),
          0, 'o visitante não tem privilégio em nenhuma das duas, tabela por tabela');
select is((select count(*)::int from unnest(array['public.producao_espacos', 'public.producao_salas']) as t
           where has_table_privilege('authenticated', t, 'select') and has_table_privilege('authenticated', t, 'insert')
             and has_table_privilege('authenticated', t, 'update') and has_table_privilege('authenticated', t, 'delete')
             and not has_table_privilege('authenticated', t, 'truncate') and not has_table_privilege('authenticated', t, 'references')
             and not has_table_privilege('authenticated', t, 'trigger')),
          2, 'quem está logado lê, insere, altera e apaga (as regras decidem), e não limpa nem referencia a tabela');

-- ─── O catálogo: funções e gatilhos ─────────────────────────────────────────

select is((select count(*)::int from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('fn_producao_espaco_coerencia', 'fn_producao_sala_coerencia', 'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia')
             and proconfig @> array['search_path=public, pg_temp'] and prosecdef),
          4, 'as quatro funções de coerência (duas novas, duas estendidas) têm o search_path fixo e rodam com a permissão do dono');
select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('fn_producao_espaco_coerencia', 'fn_producao_sala_coerencia', 'fn_producao_data_coerencia', 'fn_producao_bloco_coerencia')
             and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
                  or p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
          0, 'ninguém de fora do banco executa as quatro, e nenhuma fica executável por public (as estendidas mantêm o que a PD0.8 revogou)');
-- (O gatilho do histórico, da PD0.10, liga nas mesmas tabelas e é conferido em producao_historico.test.sql.)
select is((select array_agg(tgname::text || ' ' || tgtype order by tgname collate "C") from pg_trigger
           where not tgisinternal and tgname not like '%\_historico' and tgrelid in ('public.producao_espacos'::regclass, 'public.producao_salas'::regclass)),
          array['producao_espacos_coerencia 23', 'producao_espacos_updated_at 19', 'producao_salas_coerencia 23', 'producao_salas_updated_at 19'],
          'cada tabela nova tem um gatilho de coerência (antes de inserir ou alterar) e um de atualização (antes de alterar)');
select is((select array_agg(t.tgname::text || ': ' || (select string_agg(a.attname, ', ' order by a.attnum)
                                                          from pg_attribute a where a.attrelid = t.tgrelid and a.attnum = any (t.tgattr::int2[]))
                            order by t.tgname collate "C")
           from pg_trigger t
           where not t.tgisinternal and t.tgname in ('producao_espacos_coerencia', 'producao_salas_coerencia', 'producao_datas_coerencia', 'producao_blocos_coerencia')),
          array['producao_blocos_coerencia: organization_id, data_id, sala_id',
                'producao_datas_coerencia: organization_id, temporada_id, obra_id, espaco_id, sala_id, fuso, contratante_empresa_id',
                'producao_espacos_coerencia: organization_id, empresa_id',
                'producao_salas_coerencia: organization_id, espaco_id'],
          'os gatilhos de coerência olham as colunas que ligam a tabela ao pai, e os da data e do bloco passaram a olhar o espaço e a sala');

-- ─── O catálogo: chaves, restrições e colunas ───────────────────────────────

select is((select array_agg(conname::text || ' ' || confdeltype::text || ' ' || condeferrable::text || ' ' || condeferred::text order by conname::text collate "C")
           from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_espacos'::regclass, 'public.producao_salas'::regclass)),
          array['producao_espacos_empresa_id_fkey n false false', 'producao_espacos_organization_id_fkey c false false',
                'producao_salas_espaco_id_fkey c false false', 'producao_salas_organization_id_fkey c false false'],
          'ao apagar: a sala vai com o espaço, a empresa só se desliga e a organização leva tudo');
select is((select array_agg(conname::text || ' ' || confdeltype::text || ' ' || condeferrable::text || ' ' || condeferred::text order by conname::text collate "C")
           from pg_constraint
           where contype = 'f' and conname in ('producao_datas_espaco_id_fkey', 'producao_datas_sala_id_fkey', 'producao_blocos_sala_id_fkey')),
          array['producao_blocos_sala_id_fkey a true true', 'producao_datas_espaco_id_fkey a true true', 'producao_datas_sala_id_fkey a true true'],
          'as três chaves novas recusam apagar o espaço e a sala que a data e o bloco usam, e são conferidas no fim da transação');
select is((select coalesce(array_agg(c.conname::text order by c.conname::text collate "C"), '{}'::text[])
           from pg_constraint c
           where c.contype = 'f' and (c.conrelid in ('public.producao_espacos'::regclass, 'public.producao_salas'::regclass)
                                      or c.conname in ('producao_datas_espaco_id_fkey', 'producao_datas_sala_id_fkey', 'producao_blocos_sala_id_fkey'))
             and not exists (
               select 1 from pg_index i
               cross join lateral (select array_agg(u.k order by u.o) as inicio
                                   from unnest(i.indkey::int2[]) with ordinality as u(k, o)
                                   where u.o <= cardinality(c.conkey)) l
               where i.indrelid = c.conrelid and i.indisvalid and l.inicio @> c.conkey and c.conkey @> l.inicio)),
          '{}'::text[], 'toda chave estrangeira nova tem um índice que começa nas colunas dela');
select is((select array_agg(conrelid::regclass::text || ' ' || n order by conrelid::regclass::text collate "C")
           from (select conrelid, count(*)::int as n from pg_constraint where contype = 'c'
                 and conrelid in ('public.producao_espacos'::regclass, 'public.producao_salas'::regclass)
                 group by conrelid) x),
          array['producao_espacos 9', 'producao_salas 2'], 'as restrições de valor de cada tabela estão todas lá');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_espacos'),
          array['id', 'organization_id', 'nome', 'tipo', 'proprio', 'movel', 'empresa_id', 'endereco', 'uf', 'municipio_ibge',
                'latitude', 'longitude', 'capacidade', 'arquivado', 'created_at', 'updated_at'], 'colunas de producao_espacos');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_salas'),
          array['id', 'organization_id', 'espaco_id', 'nome', 'capacidade', 'arquivada', 'created_at', 'updated_at'], 'colunas de producao_salas');
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name in ('producao_espacos', 'producao_salas')
             and column_name ~* '(valor|cache|custo|preco|pago|pagamento|dinheiro|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|pix|cpf|cnpj|telefone|celular|email|nascimento|responsavel)'),
          0, 'nenhuma coluna de dinheiro nem de dado pessoal nas duas tabelas');

-- ─── Quem acessa o quê: organização A ───────────────────────────────────────

select pz_teste.como('a1');
select is(pz_teste.perfil('a'), pz_teste.tudo(), 'admin: lê, cria, altera e apaga espaços e salas, até com o recorte "vinculado" no registro');
select is(array[pz_teste.perfil('b'), pz_teste.perfil('c'), pz_teste.perfil('d')], array[pz_teste.nada(), pz_teste.nada(), pz_teste.nada()],
          'admin de uma organização: nada nas outras três');
select pz_teste.volta();
select pz_teste.como('a2');
select is(pz_teste.perfil('a'), pz_teste.tudo(), 'colaborador: lê, cria, altera e apaga');
select is((select count(*)::int from public.producao_espacos), 4, 'colaborador: lê os 4 espaços da organização dele, e só eles');
select is((select count(*)::int from public.producao_salas), 4, 'colaborador: lê as 4 salas da organização dele, e só elas');
select throws_ok($t$select public.fn_producao_sala_coerencia()$t$, '42501', null, 'colaborador: não chama a função do gatilho');
select pz_teste.volta();
select pz_teste.como('a3');
select is(pz_teste.perfil('a'), pz_teste.leitura(), 'leitor: lê e não escreve nada');
select pz_teste.volta();
select pz_teste.como('a4');
select is(pz_teste.perfil('a'), pz_teste.nada(), 'colaborador sem o módulo produção: nada');
select pz_teste.volta();
select pz_teste.como('a5');
select is(pz_teste.perfil('a'), pz_teste.nada(), 'captador: nada, mesmo com a produção no vínculo');
select pz_teste.volta();
select pz_teste.como('a6');
select is(pz_teste.perfil('a'), pz_teste.nada(), 'recorte "só onde está vinculado": falha fechado, não lê nem escreve nada até a PD1.9');
select pz_teste.volta();
select pz_teste.como('a7');
select is(pz_teste.perfil('a'), pz_teste.nada(), 'proponente: nada');
select pz_teste.volta();

-- ─── Quem acessa o quê: as outras organizações ──────────────────────────────

select pz_teste.como('b1');
select is(array[pz_teste.perfil('b'), pz_teste.perfil('a')], array[pz_teste.tudo(), pz_teste.nada()], 'admin de B: tudo em B e nada em A');
select pz_teste.volta();

-- C: a cortesia acabou, a produção ficou só para leitura.
select pz_teste.como('c1');
select is(pz_teste.perfil('c'), pz_teste.leitura(), 'só leitura: o admin lê tudo e não escreve nada');
select pz_teste.volta();
select pz_teste.como('c2');
select is(pz_teste.perfil('c'), pz_teste.leitura(), 'só leitura: o colaborador lê e não escreve');
select pz_teste.volta();
select pz_teste.como('c3');
select is(pz_teste.perfil('c'), pz_teste.leitura(), 'só leitura: o leitor lê');
select pz_teste.volta();
select pz_teste.como('c4');
select is(pz_teste.perfil('c'), pz_teste.nada(), 'só leitura: quem não tinha o módulo não lê');
select pz_teste.volta();

-- D: sem a produção.
select pz_teste.como('d1');
select is(array[pz_teste.perfil('d'), pz_teste.perfil('a')], array[pz_teste.nada(), pz_teste.nada()],
          'organização sem o módulo: nem o admin com a produção no vínculo lê ou escreve');
select pz_teste.volta();

-- ─── Quem acessa o quê: super admin, gente de fora e visitante ──────────────

select pz_teste.como('e1');
select is(array[pz_teste.perfil('a'), pz_teste.perfil('b'), pz_teste.perfil('c'), pz_teste.perfil('d')],
          array[pz_teste.tudo(), pz_teste.tudo(), pz_teste.tudo(), pz_teste.tudo()],
          'super admin: passa em qualquer organização, até sem o módulo ou com ele só para leitura');
select pz_teste.volta();
select pz_teste.como('e2');
select is(pz_teste.perfil('a'), pz_teste.nada(), 'pessoa de fora de todas as organizações: nada');
select pz_teste.volta();
select pz_teste.como(null);
select is(pz_teste.perfil('a'), pz_teste.nada(), 'visitante: nada');
select throws_ok($t$select count(*) from public.producao_espacos$t$, '42501', null, 'visitante: sem permissão nem para consultar a tabela de espaços');
select throws_ok($t$select count(*) from public.producao_salas$t$, '42501', null, 'visitante: sem permissão nem para consultar a tabela de salas');
select pz_teste.volta();

-- ─── Coerência: espaço e sala ───────────────────────────────────────────────

-- Como o dono do banco: o gatilho vale para todo mundo.
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, empresa_id) values (%L, 'x', 'teatro', %L)$t$,
                                pz_teste.id('a0'), pz_teste.id('62'))),
          '23514 empresa_de_outra_organizacao', 'um espaço com a empresa de outra organização é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, empresa_id) values (%L, 'x', 'teatro', %L)$t$,
                                pz_teste.id('a0'), pz_teste.id('61'))),
          'aceito', 'o espaço com a empresa da própria organização passa');
select is(pz_teste.tenta(format($t$update public.producao_espacos set empresa_id = %L where id = %L$t$, pz_teste.id('62'), pz_teste.id('7a'))),
          '23514 empresa_de_outra_organizacao', 'mudar o espaço para a empresa de outra organização é recusado');
select is(pz_teste.tenta(format($t$update public.producao_espacos set organization_id = %L where id = %L$t$, pz_teste.id('b0'), pz_teste.id('7a'))),
          '23514 organizacao_nao_muda', 'o espaço não muda de organização');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, 'x')$t$,
                                pz_teste.id('a0'), pz_teste.id('7b'))),
          '23514 espaco_de_outra_organizacao', 'uma sala num espaço de outra organização é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, gen_random_uuid(), 'x')$t$,
                                pz_teste.id('a0'))),
          '23514 espaco_de_outra_organizacao', 'uma sala num espaço que não existe recebe a mesma recusa, sem dizer se existe');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, 'x')$t$,
                                pz_teste.id('a0'), pz_teste.id('7a'))),
          'aceito', 'a sala no espaço da própria organização passa');
select ok(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, nome) values (%L, 'x')$t$, pz_teste.id('a0')))
          ~ '^23502 .*"espaco_id"', 'sala sem espaço: quem recusa é a tabela');
select is(pz_teste.tenta(format($t$update public.producao_salas set espaco_id = %L where id = %L$t$, pz_teste.id('92'), pz_teste.id('8a'))),
          '23514 espaco_da_sala_nao_muda', 'a sala não muda de espaço, nem dentro da organização');
select is(pz_teste.tenta(format($t$update public.producao_salas set organization_id = %L where id = %L$t$, pz_teste.id('b0'), pz_teste.id('8a'))),
          '23514 organizacao_nao_muda', 'a sala não muda de organização');

-- ─── Coerência: a data e o bloco ────────────────────────────────────────────

select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('7b'))),
          '23514 espaco_de_outra_organizacao', 'uma data com o espaço de outra organização é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, data) values (%L, %L, gen_random_uuid(), '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'))),
          '23514 espaco_de_outra_organizacao', 'uma data com um espaço que não existe recebe a mesma recusa');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('7a'), pz_teste.id('8b'))),
          '23514 sala_de_outra_organizacao', 'uma data com a sala de outra organização é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('7a'), pz_teste.id('93'))),
          '23514 sala_de_outro_espaco', 'uma data com a sala de outro espaço da mesma organização é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, sala_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('8a'))),
          '23514 sala_de_outro_espaco', 'uma data sem espaço não tem sala');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('92'), pz_teste.id('93'))),
          'aceito', 'a data com o espaço e a sala dele passa');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('5a'))),
          'aceito', 'a data num espaço sem salas passa: a sala é opcional');
select is(pz_teste.tenta(format($t$update public.producao_datas set espaco_id = %L where id = %L$t$, pz_teste.id('92'), pz_teste.id('3a'))),
          '23514 sala_de_outro_espaco', 'mudar o espaço da data sem tirar a sala dela é recusado');
select is(pz_teste.tenta(format($t$update public.producao_datas set espaco_id = %L, sala_id = %L where id = %L$t$, pz_teste.id('92'), pz_teste.id('93'), pz_teste.id('3a'))),
          '23514 bloco_em_sala_de_outro_espaco', 'mudar o espaço da data deixando um bloco na sala do espaço de antes é recusado');
select is(pz_teste.depois(array[
            format($t$update public.producao_blocos set sala_id = null where id = %L$t$, pz_teste.id('4a')),
            format($t$update public.producao_datas set espaco_id = %L, sala_id = %L where id = %L$t$, pz_teste.id('92'), pz_teste.id('93'), pz_teste.id('3a')),
            format($t$update public.producao_blocos set sala_id = %L where id = %L$t$, pz_teste.id('94'), pz_teste.id('4a'))],
            format($t$select (select espaco_id = %L from public.producao_datas where id = %L)::text || ' ' || (select sala_id = %L from public.producao_blocos where id = %L)::text$t$,
                   pz_teste.id('92'), pz_teste.id('3a'), pz_teste.id('94'), pz_teste.id('4a'))),
          'true true', 'tirada a sala do bloco, a data muda de espaço, e o bloco passa para uma sala do espaço novo');
select is(pz_teste.tenta(format($t$update public.producao_datas set sala_id = %L where id = %L$t$, pz_teste.id('93'), pz_teste.id('3a'))),
          '23514 sala_de_outro_espaco', 'mudar só a sala da data para a de outro espaço é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', %L)$t$,
                                pz_teste.id('a0'), pz_teste.id('3a'), pz_teste.id('8b'))),
          '23514 sala_de_outra_organizacao', 'um bloco com a sala de outra organização é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', %L)$t$,
                                pz_teste.id('a0'), pz_teste.id('3a'), pz_teste.id('93'))),
          '23514 sala_de_outro_espaco', 'um bloco com a sala de outro espaço, mesmo da organização, é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao', %L)$t$,
                                pz_teste.id('a0'), pz_teste.id('3a'), pz_teste.id('6a'))),
          'aceito', 'o bloco com outra sala do espaço da data passa');
select is(pz_teste.tenta(format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo) values (%L, %L, '2026-11-20', '2026-11-20 22:00-03', 'sessao')$t$,
                                pz_teste.id('a0'), pz_teste.id('3a'))),
          'aceito', 'o bloco sem sala passa, mesmo numa data que tem sala');
select is(pz_teste.tenta(format($t$update public.producao_blocos set sala_id = %L where id = %L$t$, pz_teste.id('94'), pz_teste.id('4a'))),
          '23514 sala_de_outro_espaco', 'mudar o bloco para a sala de outro espaço é recusado');
select is(pz_teste.tenta(format($t$do $x$ begin
                                insert into public.producao_datas (id, organization_id, temporada_id, espaco_id, data) values (%L, %L, %L, %L, '2026-12-11');
                                update public.producao_blocos set data_id = %L where id = %L;
                              end $x$$t$, pz_teste.id('f1'), pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('92'), pz_teste.id('f1'), pz_teste.id('4a'))),
          '23514 sala_de_outro_espaco', 'mudar o bloco para a data de outro espaço, que não tem a sala dele, é recusado');

-- Como a pessoa do navegador: o gatilho vem antes da regra de acesso.
select pz_teste.como('a1');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, data) values (%L, %L, %L, '2026-12-10')$t$,
                                pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('7b'))),
          '23514 espaco_de_outra_organizacao', 'o admin de A não põe uma data de A no espaço de B');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, 'x')$t$,
                                pz_teste.id('b0'), pz_teste.id('7b'))),
          '42501 new row violates row-level security policy for table "producao_salas"',
          'nem escreve na organização B, com o espaço de B: a regra de acesso barra');
select pz_teste.volta();

-- ─── A forma do espaço e da sala ────────────────────────────────────────────

select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo) values (%L, '   ', 'teatro')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_nome_check', 'espaço sem nome é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo) values (%L, 'x', '  ')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_tipo_check', 'tipo vazio é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo) values (%L, 'x', %L)$t$, pz_teste.id('a0'), repeat('t', 41))),
          '23514 producao_espacos_tipo_check', 'tipo com mais de 40 letras é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo) values (%L, 'x', 'arena-de-eventos')$t$, pz_teste.id('a0'))),
          'aceito', 'um tipo de espaço que o catálogo ainda não tem entra: tipo é do código, não do banco');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, endereco) values (%L, 'x', 'teatro', '  ')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_endereco_check', 'endereço só de espaços é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, uf) values (%L, 'x', 'teatro', 'sp')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_uf_check', 'UF em minúscula é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, municipio_ibge) values (%L, 'x', 'teatro', '3550308')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_municipio_ibge_check', 'município sem UF é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, uf, municipio_ibge) values (%L, 'x', 'teatro', 'SP', '35503')$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_municipio_ibge_check', 'código de município com menos de 7 dígitos é recusado');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, latitude, longitude) values (%L, 'x', 'teatro', 91, 10)$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_latitude_check', 'latitude fora de -90 a 90 é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, latitude, longitude) values (%L, 'x', 'teatro', 10, -181)$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_longitude_check', 'longitude fora de -180 a 180 é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, latitude) values (%L, 'x', 'teatro', -23.55)$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_coordenadas_check', 'coordenada só com a latitude é recusada: as duas ou nenhuma');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, capacidade) values (%L, 'x', 'teatro', -1)$t$, pz_teste.id('a0'))),
          '23514 producao_espacos_capacidade_check', 'capacidade negativa é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_espacos (organization_id, nome, tipo, proprio, movel, empresa_id, endereco, uf, municipio_ibge, latitude, longitude, capacidade, arquivado)
                                   values (%L, 'Teatro completo', 'teatro', true, false, %L, 'Rua Augusta, 100 - Consolação', 'SP', '3550308', -23.550520, -46.633308, 450, false)$t$,
                                pz_teste.id('a0'), pz_teste.id('61'))),
          'aceito', 'espaço completo passa');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, '  ')$t$, pz_teste.id('a0'), pz_teste.id('7a'))),
          '23514 producao_salas_nome_check', 'sala sem nome é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome, capacidade) values (%L, %L, 'x', -5)$t$, pz_teste.id('a0'), pz_teste.id('7a'))),
          '23514 producao_salas_capacidade_check', 'capacidade de sala negativa é recusada');
select is(pz_teste.tenta(format($t$insert into public.producao_salas (organization_id, espaco_id, nome, capacidade, arquivada) values (%L, %L, 'Sala Preta', 80, true)$t$, pz_teste.id('a0'), pz_teste.id('7a'))),
          'aceito', 'sala completa passa');

-- ─── Formas difíceis ────────────────────────────────────────────────────────

-- O aceite do plano: a lona (espaço móvel) é o lugar de datas em cidades diferentes.
select is(pz_teste.depois(array[
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (%L, %L, 'circulacao', 'circula', 'circo', 'Circulação da lona')$t$, pz_teste.id('e5'), pz_teste.id('a0')),
            format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, uf, municipio_ibge, data) values (%L, %L, %L, 'SP', '3550308', '2026-12-01')$t$, pz_teste.id('a0'), pz_teste.id('e5'), pz_teste.id('91')),
            format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, uf, municipio_ibge, data) values (%L, %L, %L, 'RJ', '3304557', '2026-12-10')$t$, pz_teste.id('a0'), pz_teste.id('e5'), pz_teste.id('91'))],
            format($t$select string_agg(d.uf || ':' || d.municipio_ibge, ',' order by d.data) || ' ' || bool_and(e.movel)::text from public.producao_datas d join public.producao_espacos e on e.id = d.espaco_id where e.id = %L$t$, pz_teste.id('91'))),
          'SP:3550308,RJ:3304557 true', 'a lona (espaço móvel) é o lugar de duas datas, em São Paulo e no Rio de Janeiro');
select is(pz_teste.tenta(format($t$insert into public.producao_datas (organization_id, temporada_id, uf, municipio_ibge, data) values (%L, %L, 'MG', '3106200', '2026-12-12')$t$, pz_teste.id('a0'), pz_teste.id('2a'))),
          'aceito', 'espetáculo de rua: a data tem só a UF e o município, sem espaço nem sala');
select is(pz_teste.depois(array[
            format($t$insert into public.producao_datas (id, organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, %L, '2026-12-14')$t$, pz_teste.id('f2'), pz_teste.id('a0'), pz_teste.id('2a'), pz_teste.id('92'), pz_teste.id('93')),
            format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-12-14', '2026-12-14 19:00-03', 'sessao', %L)$t$, pz_teste.id('a0'), pz_teste.id('f2'), pz_teste.id('93')),
            format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-12-14', '2026-12-14 21:00-03', 'sessao', %L)$t$, pz_teste.id('a0'), pz_teste.id('f2'), pz_teste.id('94'))],
            format($t$select count(distinct sala_id) || ' salas' from public.producao_blocos where data_id = %L$t$, pz_teste.id('f2'))),
          '2 salas', 'centro cultural: uma data no espaço com blocos em duas salas dele');
select is(pz_teste.depois(array[
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (%L, %L, 'edicao', 'recebe', 'festival', 'Festival')$t$, pz_teste.id('e6'), pz_teste.id('a0')),
            format($t$insert into public.producao_datas (organization_id, temporada_id, espaco_id, data) select %L, %L, id, date '2027-01-10' from public.producao_espacos where id in (%L, %L, %L)$t$,
                   pz_teste.id('a0'), pz_teste.id('e6'), pz_teste.id('7a'), pz_teste.id('92'), pz_teste.id('91'))],
            format($t$select count(distinct espaco_id) || ' espaços' from public.producao_datas where temporada_id = %L$t$, pz_teste.id('e6'))),
          '3 espaços', 'festival: a temporada tem datas em espaços diferentes, entre eles a lona');

-- ─── Apagar ─────────────────────────────────────────────────────────────────

select is(left(pz_teste.tenta(format($t$delete from public.producao_espacos where id = %L$t$, pz_teste.id('7a'))), 5), '23503',
          'espaço com datas não se apaga: arquiva-se');
select is(left(pz_teste.tenta(format($t$delete from public.producao_salas where id = %L$t$, pz_teste.id('8a'))), 5), '23503',
          'sala usada por uma data e por um bloco não se apaga');
select is(pz_teste.tenta(format($t$delete from public.producao_salas where id = %L$t$, pz_teste.id('6a'))),
          'aceito', 'a sala que nada usa se apaga');
select is(pz_teste.tenta(format($t$delete from public.producao_espacos where id = %L$t$, pz_teste.id('5a'))),
          'aceito', 'o espaço vazio se apaga');
select is(pz_teste.depois(array[format($t$delete from public.producao_espacos where id = %L$t$, pz_teste.id('92'))],
                          format($t$select (select count(*) from public.producao_espacos where id = %1$L) || ' ' || (select count(*) from public.producao_salas where espaco_id = %1$L)$t$, pz_teste.id('92'))),
          '0 0', 'apagar o espaço leva as salas dele, se nada as usa');
select is(left(pz_teste.tenta(format($t$delete from public.producao_blocos where id = %L$t$, pz_teste.id('4a')) || format($t$; delete from public.producao_salas where id = %L$t$, pz_teste.id('8a'))), 5), '23503',
          'sem o bloco, a sala ainda é da data e não se apaga');
select is(pz_teste.tenta(format($t$with d as (delete from public.producao_datas where espaco_id = %L) delete from public.producao_espacos where id = %L$t$, pz_teste.id('7b'), pz_teste.id('7b'))),
          'aceito', 'as datas e o espaço saem no mesmo comando');
select is(pz_teste.depois(array[
            format($t$delete from public.producao_espacos where organization_id = %L$t$, pz_teste.id('c0')),
            format($t$delete from public.producao_salas where organization_id = %L$t$, pz_teste.id('c0')),
            format($t$delete from public.producao_datas where organization_id = %L$t$, pz_teste.id('c0'))],
          format($t$select (select count(*) from public.producao_espacos where organization_id = %1$L) || ' ' || (select count(*) from public.producao_salas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_datas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_blocos where organization_id = %1$L)$t$, pz_teste.id('c0'))),
          '0 0 0 0', 'as tabelas de uma organização saem na mesma transação, do pai para o filho: a ordem em que o apagamento da organização as apaga');
select is(pz_teste.depois(array[
            format($t$insert into public.organizations (id, nome) values (%L, 'PZ organização Z')$t$, pz_teste.id('e0')),
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (%L, %L, 'circulacao', 'circula', 'teatro', 'z')$t$, pz_teste.id('e7'), pz_teste.id('e0')),
            format($t$insert into public.producao_espacos (id, organization_id, nome, tipo) values (%L, %L, 'z', 'teatro')$t$, pz_teste.id('e8'), pz_teste.id('e0')),
            format($t$insert into public.producao_salas (id, organization_id, espaco_id, nome) values (%L, %L, %L, 'z')$t$, pz_teste.id('e9'), pz_teste.id('e0'), pz_teste.id('e8')),
            format($t$insert into public.producao_datas (id, organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, %L, '2026-12-01')$t$, pz_teste.id('ea'), pz_teste.id('e0'), pz_teste.id('e7'), pz_teste.id('e8'), pz_teste.id('e9')),
            format($t$insert into public.producao_blocos (organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, '2026-12-01', '2026-12-01 20:00-03', 'sessao', %L)$t$, pz_teste.id('e0'), pz_teste.id('ea'), pz_teste.id('e9')),
            format($t$delete from public.organizations where id = %L$t$, pz_teste.id('e0'))],
          format($t$select (select count(*) from public.producao_espacos where organization_id = %1$L) || ' ' || (select count(*) from public.producao_salas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_datas where organization_id = %1$L) || ' ' || (select count(*) from public.producao_blocos where organization_id = %1$L)$t$, pz_teste.id('e0'))),
          '0 0 0 0', 'apagar a organização inteira, com espaço, sala, data e bloco ligados entre si, passa e leva tudo');
select is(pz_teste.depois(array[format($t$update public.producao_espacos set empresa_id = %L where id = %L$t$, pz_teste.id('61'), pz_teste.id('7a')),
                                format($t$delete from public.empresas_crm where id = %L$t$, pz_teste.id('61'))],
                          format($t$select (empresa_id is null)::text || ' ' || count(*) over () from public.producao_espacos where id = %L$t$, pz_teste.id('7a'))),
          'true 1', 'apagar a empresa desliga o espaço, sem apagá-lo');

-- ─── Atualização ────────────────────────────────────────────────────────────

select is(pz_teste.depois(array[
            format($t$insert into public.producao_espacos (id, organization_id, nome, tipo, updated_at) values (%L, %L, 'antes', 'teatro', '2020-01-01')$t$, pz_teste.id('f3'), pz_teste.id('a0')),
            format($t$update public.producao_espacos set nome = 'depois' where id = %L$t$, pz_teste.id('f3')),
            format($t$insert into public.producao_salas (id, organization_id, espaco_id, nome, updated_at) values (%L, %L, %L, 'antes', '2020-01-01')$t$, pz_teste.id('f4'), pz_teste.id('a0'), pz_teste.id('f3')),
            format($t$update public.producao_salas set nome = 'depois' where id = %L$t$, pz_teste.id('f4'))],
            format($t$select ((select updated_at from public.producao_espacos where id = %L) > '2020-01-01')::text || ' ' || ((select updated_at from public.producao_salas where id = %L) > '2020-01-01')::text$t$, pz_teste.id('f3'), pz_teste.id('f4'))),
          'true true', 'alterar um espaço ou uma sala atualiza o updated_at');

-- ─── O recorte por vínculo: preparo ─────────────────────────────────────────

-- Este é o último cenário: troca auth_producao_ve_espaco dentro da transação (a PD1.9
-- fará o mesmo, com producao_vinculos) e liga a6 ao espaço 7a e ao centro cultural 92. A
-- sala tem de acompanhar sem que ninguém mexa em suas regras.
create table pz_teste.vinculos (user_id uuid not null, espaco_id uuid not null);
insert into pz_teste.vinculos values (pz_teste.id('a6'), pz_teste.id('7a')), (pz_teste.id('a6'), pz_teste.id('92'));

create or replace function public.auth_producao_ve_espaco(p_org uuid, p_espaco_id uuid)
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
                 select 1 from pz_teste.vinculos v where v.user_id = auth.uid() and v.espaco_id = p_espaco_id)))
  );
$$;

-- ─── O recorte por vínculo: leitura ─────────────────────────────────────────

select pz_teste.como('a6');
select is((select array_agg(nome order by nome collate "C") from public.producao_espacos),
          array['PZ Centro Cultural', 'PZ espaço a'], 'vinculado: vê só os espaços em que está');
select is((select array_agg(nome order by nome collate "C") from public.producao_salas),
          array['PZ Sala 1', 'PZ Sala 2', 'PZ sala a', 'PZ sala livre a'], 'vinculado: vê as salas desses espaços, e só elas');
select pz_teste.volta();
select pz_teste.como('a1');
select is((select count(*)::int from public.producao_espacos), 4, 'admin com o registro "vinculado": continua vendo os 4 espaços da organização');
select pz_teste.volta();
select pz_teste.como('a2');
select is((select count(*)::int from public.producao_salas), 4, 'colaborador sem recorte: continua vendo as 4 salas');
select pz_teste.volta();

-- ─── O recorte por vínculo: escrita ─────────────────────────────────────────

select pz_teste.como('a6');
select is(pz_teste.efeito(format($t$update public.producao_espacos set nome = nome where id = %L$t$, pz_teste.id('7a'))), 'sim', 'vinculado: altera o espaço dele');
select is(pz_teste.efeito(format($t$update public.producao_espacos set nome = nome where id = %L$t$, pz_teste.id('91'))), '', 'vinculado: não altera o espaço de que não faz parte');
select is(pz_teste.efeito(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, 'x')$t$, pz_teste.id('a0'), pz_teste.id('92'))),
          'sim', 'vinculado: cria sala no espaço dele');
select is(pz_teste.efeito(format($t$insert into public.producao_salas (organization_id, espaco_id, nome) values (%L, %L, 'x')$t$, pz_teste.id('a0'), pz_teste.id('91'))),
          '', 'vinculado: não cria sala no espaço de outra pessoa');
select is(pz_teste.efeito(format($t$update public.producao_salas set nome = nome where id = %L$t$, pz_teste.id('93'))), 'sim', 'vinculado: altera a sala do espaço dele');
select is(pz_teste.efeito($t$insert into public.producao_espacos (organization_id, nome, tipo) values (pz_teste.id('a0'), 'x', 'teatro')$t$),
          '', 'vinculado: não cria espaço novo, que ainda não é de ninguém (ele não o veria)');
select is(pz_teste.efeito(format($t$delete from public.producao_salas where id = %L$t$, pz_teste.id('6a'))), 'sim', 'vinculado: apaga a sala livre do espaço dele');
select pz_teste.volta();

select * from finish();
rollback;
