-- PD0.10: histórico das alterações da produção.
--
-- Confere a migration producao_historico: mudar a hora de um bloco deixa uma linha por
-- campo no histórico, com quem mudou, de onde para onde; mudar um campo da lista de
-- exclusão (e o que é só controle, como updated_at) não deixa linha; criar e apagar deixam
-- uma linha só, com um rótulo curto; o texto longo é cortado; a hora sai em UTC; ninguém
-- escreve no histórico pelo navegador, e o gatilho não grava o histórico do próprio
-- histórico; quem lê o histórico é quem lê a tabela de origem (administrador, colaborador,
-- leitor, quem não tem o módulo, captador, proponente, o recorte "só onde está vinculado",
-- a produção só para leitura, outra organização, super admin e visitante); a entidade
-- apagada deixa de ser legível pelo navegador; e apagar a organização inteira, com histórico,
-- passa e leva as linhas.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são 0d100000-0000-4000-8000-0000000000XX, e ph_teste.id('XX') os escreve.
-- Seção "Dados", sem pessoas: organizações A, B, C e D (a0 a d0); em cada uma uma obra (1x),
-- uma temporada (2x), um espaço (7x) com uma sala (8x), uma data (3x) e um bloco (4x, "Passagem
-- de som" das 18h às 19h, na sala). Criados pelo dono do banco, cada registro deixa uma linha
-- "criou" sem autor: 6 por organização.
-- Seção "Pessoas e módulos":
--   A, com a produção em vigor (cortesia): a1 admin (com registro "vinculado": o admin ignora o
--     recorte); a2 colaborador, com função própria; a3 leitor; a4 colaborador sem o módulo
--     produção; a5 captador, com a produção no vínculo (o convite não deixa, o banco aceitaria:
--     tem de negar mesmo assim); a6 colaborador com o recorte "vinculado"; a7 proponente.
--     As funções de a1, a2 e a6 deixam mais 3 linhas "criou": 9 em A;
--   B, com a produção em vigor: admin b1;
--   C, com a produção encerrada (só para leitura): admin c1, leitor c3 e colaborador c4 sem o módulo;
--   D, sem a produção: admin d1; o super admin e1 é colaborador de D só com a captação;
--   e2, de fora de todas as organizações; o visitante, sem login.
--
-- As seções depois das ferramentas não dependem umas das outras: cada gravação delas roda
-- dentro de ph_teste.como_depois e é desfeita, então o cenário fica como nasceu. Dá para
-- rodar só algumas, com o prelúdio e as seções-base (Dados, Pessoas e módulos e Ferramentas)
-- na frente, ajustando o plan(). A seção "Apagar" usa DELETE (o conector
-- do Supabase pode pedir confirmação para ela): rode-a à parte.
--
-- Rodar: supabase/tests/README.md, com as migrations producao_espacos e producao_historico
-- na frente, nessa ordem.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(70);

create schema ph_teste;
grant usage on schema ph_teste to authenticated, anon;

create function ph_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d100000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- ─── Dados ──────────────────────────────────────────────────────────────────

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (ph_teste.id('f0'), 'ph-f0@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values
    (ph_teste.id('a0'), 'PH organização A'), (ph_teste.id('b0'), 'PH organização B'),
    (ph_teste.id('c0'), 'PH organização C'), (ph_teste.id('d0'), 'PH organização D');

  insert into public.producao_obras (id, organization_id, tipo, titulo)
  select ph_teste.id('1' || x), ph_teste.id(x || '0'), 'teatro', 'PH obra ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo)
  select ph_teste.id('2' || x), ph_teste.id(x || '0'), ph_teste.id('1' || x), 'circulacao', 'circula', 'teatro', 'PH temporada ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_espacos (id, organization_id, nome, tipo)
  select ph_teste.id('7' || x), ph_teste.id(x || '0'), 'PH espaço ' || x, 'teatro' from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_salas (id, organization_id, espaco_id, nome)
  select ph_teste.id('8' || x), ph_teste.id(x || '0'), ph_teste.id('7' || x), 'PH sala ' || x from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_datas (id, organization_id, temporada_id, obra_id, espaco_id, sala_id, data)
  select ph_teste.id('3' || x), ph_teste.id(x || '0'), ph_teste.id('2' || x), ph_teste.id('1' || x), ph_teste.id('7' || x), ph_teste.id('8' || x), date '2026-11-20' from unnest(array['a', 'b', 'c', 'd']) as x;
  insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, fim, tipo, titulo, sala_id)
  select ph_teste.id('4' || x), ph_teste.id(x || '0'), ph_teste.id('3' || x), date '2026-11-20', timestamptz '2026-11-20 18:00-03', timestamptz '2026-11-20 19:00-03',
         'passagem_som', 'Passagem de som', ph_teste.id('8' || x) from unnest(array['a', 'b', 'c', 'd']) as x;
end
$dados$;

-- ─── Pessoas e módulos ──────────────────────────────────────────────────────

do $pessoas$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ph_teste.id(sufixo), 'ph-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1', 'c1', 'c3', 'c4', 'd1', 'e1', 'e2']) as sufixo;

  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ph_teste.id('a0'), 'producao', 'cortesia', 20), (ph_teste.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ph_teste.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = ph_teste.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ph_teste.id(org), ph_teste.id(pessoa), papel, modulos::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a4', 'colaborador', '{captacao}'),
    ('a0', 'a5', 'captador', '{captacao,producao}'), ('a0', 'a6', 'colaborador', '{producao}'),
    ('a0', 'a7', 'proponente', '{captacao}'),
    ('b0', 'b1', 'admin', '{captacao,producao}'),
    ('c0', 'c1', 'admin', '{captacao,producao}'), ('c0', 'c3', 'leitor', '{producao}'), ('c0', 'c4', 'colaborador', '{captacao}'),
    ('d0', 'd1', 'admin', '{captacao,producao}'), ('d0', 'e1', 'colaborador', '{captacao}')
  ) as v(org, pessoa, papel, modulos);
  update public.profiles set jards_super_admin = true where id = ph_teste.id('e1');

  -- As funções, gravadas direto, como o dono do banco: a1 e a6 com o recorte "vinculado", a2 com a organização inteira.
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (ph_teste.id('a0'), ph_teste.id('a1'), false, 'vinculado'), (ph_teste.id('a0'), ph_teste.id('a6'), false, 'vinculado'),
    (ph_teste.id('a0'), ph_teste.id('a2'), false, 'organizacao');
end
$pessoas$;

-- ─── Ferramentas ────────────────────────────────────────────────────────────

-- Entra como a pessoa (ou como visitante, com null) até ph_teste.volta().
create function ph_teste.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ph_teste.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ph_teste.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Roda os comandos como a pessoa quem (null = o dono do banco), lê com a consulta como a
-- pessoa leitor (null = o dono) e desfaz tudo. Devolve o resultado da consulta, ou o erro.
-- As chaves entre as tabelas da produção são conferidas no fim da transação: força a
-- conferência antes de ler.
create function ph_teste.como_depois(quem text, comandos text[], leitor text, consulta text) returns text language plpgsql as $$
declare
  comando text;
  resultado text;
begin
  begin
    if quem is not null then perform ph_teste.como(quem); end if;
    foreach comando in array comandos loop
      execute comando;
    end loop;
    set constraints all immediate;
    perform ph_teste.volta();
    if leitor is not null then perform ph_teste.como(leitor); end if;
    execute consulta into resultado;
    raise exception using errcode = 'RLS00', message = coalesce(resultado, '(nulo)');
  exception
    when sqlstate 'RLS00' then
      return sqlerrm;
    when others then
      return 'erro ' || sqlstate || ' ' || sqlerrm;
  end;
end;
$$;

-- Roda o comando e desfaz. 'aceito' se passou; senão o código do erro e o nome da
-- restrição que recusou (ou a mensagem, quando não é uma restrição).
create function ph_teste.tenta(comando text) returns text language plpgsql as $$
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

-- ─── O catálogo: tabela, regras e privilégios ───────────────────────────────

select is((select relrowsecurity from pg_class where oid = 'public.producao_historico'::regclass),
          true, 'o histórico tem a segurança por linha ligada');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_historico'),
          array['SELECT producao_historico: le', 'SELECT producao_historico: leitura sem assinatura'],
          'só duas regras, as duas de leitura (a normal e a leitura sem assinatura): nenhuma de escrita');
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename = 'producao_historico'
             and (roles <> '{authenticated}' or permissive <> 'PERMISSIVE' or cmd <> 'SELECT' or qual = 'true')),
          0, 'nenhuma regra é para o visitante, restritiva, aberta (using true) ou de escrita');
select is((select count(*)::int from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p
           where has_table_privilege('anon', 'public.producao_historico', p)),
          0, 'o visitante não tem privilégio nenhum no histórico');
select is((select array_agg(p order by p collate "C") from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p
           where has_table_privilege('authenticated', 'public.producao_historico', p)),
          array['select'], 'quem está logado só lê o histórico: não insere, não altera, não apaga');

-- ─── O catálogo: funções e gatilhos ─────────────────────────────────────────

select is((select prosecdef and proconfig @> array['search_path=public, pg_temp', 'TimeZone=UTC'] from pg_proc
           where pronamespace = 'public'::regnamespace and proname = 'fn_producao_historico'),
          true, 'o gatilho do histórico roda com a permissão do dono, com o caminho de busca e o fuso (UTC) fixos');
select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname = 'fn_producao_historico'
             and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
                  or p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
          0, 'ninguém de fora do banco executa o gatilho, e ele não fica executável por public');
select is((select not prosecdef and proconfig @> array['search_path=public, pg_temp']
                  and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute')
                  and not exists (select 1 from aclexplode(proacl) a where a.grantee = 0)
           from pg_proc where pronamespace = 'public'::regnamespace and proname = 'auth_producao_ve_historico'),
          true, 'a função da regra roda com a permissão de quem consulta (a origem passa pelas regras dele), é executada por quem está logado e não pelo visitante');
select is((select array_agg(t.tgname::text || ' ' || t.tgtype || ' ' || (regexp_match(pg_get_triggerdef(t.oid), 'fn_producao_historico\((.*)\)$'))[1]
                            order by t.tgname collate "C")
           from pg_trigger t where not t.tgisinternal and t.tgfoid = 'public.fn_producao_historico'::regproc
             -- o dos arquivos (PD0.14) é conferido em producao_arquivos.test.sql; os da equipe (PD1.9), em producao_equipe.test.sql
             and t.tgname not in ('producao_arquivos_historico', 'producao_pessoas_historico', 'producao_vinculos_historico', 'producao_escalas_historico')),
          array['producao_blocos_historico 29 '''', ''titulo,tipo''', 'producao_datas_historico 29 '''', ''data''',
                'producao_espacos_historico 29 '''', ''nome''', 'producao_funcoes_historico 29 ''definido_por'', ''user_id''',
                'producao_obras_historico 29 '''', ''titulo''', 'producao_salas_historico 29 '''', ''nome''',
                'producao_temporadas_historico 29 '''', ''titulo'''],
          'as sete tabelas têm o gatilho (depois de inserir, alterar e apagar, por linha) com a lista de exclusão e o rótulo delas');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.producao_historico'::regclass and not tgisinternal),
          0, 'o histórico não tem gatilho de histórico nem outro: nunca grava o próprio histórico');

-- ─── O catálogo: chaves, índices e colunas ──────────────────────────────────

select is((select array_agg(conname::text || ' ' || confdeltype::text order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_historico'::regclass),
          array['producao_historico_organization_id_fkey c', 'producao_historico_quem_fkey n'],
          'apagar a organização leva o histórico; apagar a conta de quem gravou só zera o quem');
select is((select coalesce(array_agg(c.conname::text order by c.conname::text collate "C"), '{}'::text[])
           from pg_constraint c
           where c.contype = 'f' and c.conrelid = 'public.producao_historico'::regclass
             and not exists (
               select 1 from pg_index i
               cross join lateral (select array_agg(u.k order by u.o) as inicio
                                   from unnest(i.indkey::int2[]) with ordinality as u(k, o)
                                   where u.o <= cardinality(c.conkey)) l
               where i.indrelid = c.conrelid and i.indisvalid and l.inicio @> c.conkey and c.conkey @> l.inicio)),
          '{}'::text[], 'toda chave estrangeira tem um índice que começa nas colunas dela');
select is((select array_agg(indexname::text order by indexname::text collate "C") from pg_indexes
           where schemaname = 'public' and tablename = 'producao_historico'),
          array['producao_historico_entidade_idx', 'producao_historico_org_idx', 'producao_historico_pkey', 'producao_historico_quem_idx'],
          'os índices: por registro (entidade, id, quando), por organização, por autor e a chave');
select ok((select indexdef from pg_indexes where schemaname = 'public' and indexname = 'producao_historico_entidade_idx')
          ~ '\(entidade, entidade_id, quando DESC, id DESC\)$', 'o índice do registro é por entidade, id e quando (do mais novo ao mais velho)');
select is((select count(*)::int from pg_constraint where contype = 'c' and conrelid = 'public.producao_historico'::regclass),
          5, 'as restrições de valor estão todas lá');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_historico'),
          array['id', 'organization_id', 'entidade', 'entidade_id', 'acao', 'campo', 'antes', 'depois', 'quem', 'quando'], 'colunas de producao_historico');
select is((select attidentity::text from pg_attribute where attrelid = 'public.producao_historico'::regclass and attname = 'id'),
          'a', 'o id é sequencial e sempre gerado: desempata as linhas de um mesmo instante');
-- A rede de segurança: toda coluna da lista de exclusão existe na tabela (nome errado deixaria o campo entrar),
-- e nenhuma coluna com cara de sensível (dinheiro, documento, banco, saúde) fica de fora da lista.
select is((select coalesce(array_agg(problema order by problema collate "C"), '{}'::text[]) from (
             select g.tabela || ': a lista cita ' || f || ', que não é coluna' as problema
             from (select t.tgrelid::regclass::text as tabela,
                          string_to_array((regexp_match(pg_get_triggerdef(t.oid), 'fn_producao_historico\(''([^'']*)'''))[1], ',') as fora
                   from pg_trigger t where not t.tgisinternal and t.tgfoid = 'public.fn_producao_historico'::regproc) g
             cross join lateral unnest(g.fora) f
             where f <> '' and not exists (select 1 from information_schema.columns c
                                           where c.table_schema = 'public' and c.table_name = g.tabela and c.column_name = f)
             union all
             select g.tabela || ': ' || c.column_name || ' parece sensível e não está na lista'
             from (select t.tgrelid::regclass::text as tabela,
                          string_to_array((regexp_match(pg_get_triggerdef(t.oid), 'fn_producao_historico\(''([^'']*)'''))[1], ',') as fora
                   from pg_trigger t where not t.tgisinternal and t.tgfoid = 'public.fn_producao_historico'::regproc) g
             join information_schema.columns c on c.table_schema = 'public' and c.table_name = g.tabela
             where (c.column_name ~* '(valor|cache|custo|preco|pago|diaria|orcad|receita|despesa|saldo|moeda|salario|banco|passaporte|saude|alergia|restricao|documento|telefone|celular|email|nascimento)'
                    or c.column_name ~* '(^|_)(rg|cpf|cnpj|pix|cnh)(_|$)')
               and c.column_name <> all (g.fora)) x),
          '{}'::text[], 'toda coluna da lista de exclusão existe, e nenhuma coluna de aparência sensível das sete tabelas fica fora dela');

-- ─── Quem lê o histórico ────────────────────────────────────────────────────

select ph_teste.como('a1');
select is((select count(*)::int from public.producao_historico), 9, 'admin: lê o histórico dos 6 registros e das 3 funções da organização dele, e só dela');
select ph_teste.volta();
select ph_teste.como('a2');
select is((select count(*)::int from public.producao_historico), 7, 'colaborador: lê o histórico dos 6 registros e o da própria função, não o das funções dos outros');
select is((select count(*)::int from public.producao_historico where entidade = 'producao_funcoes'), 1, 'colaborador: da função, só a história da dele');
select ph_teste.volta();
select ph_teste.como('a3');
select is((select count(*)::int from public.producao_historico), 6, 'leitor: lê o histórico dos registros, e não o das funções');
select ph_teste.volta();
select ph_teste.como('a4');
select is((select count(*)::int from public.producao_historico), 0, 'colaborador sem o módulo produção: nada');
select ph_teste.volta();
select ph_teste.como('a5');
select is((select count(*)::int from public.producao_historico), 0, 'captador: nada, mesmo com a produção no vínculo');
select ph_teste.volta();
select ph_teste.como('a6');
select is((select count(*)::int from public.producao_historico), 1,
          'recorte "só onde está vinculado": falha fechado, não lê o histórico de registro nenhum (só o da própria função)');
select ph_teste.volta();
select ph_teste.como('a7');
select is((select count(*)::int from public.producao_historico), 0, 'proponente: nada');
select ph_teste.volta();
select ph_teste.como('b1');
select is((select count(*)::int from public.producao_historico), 6, 'admin de B: lê o histórico de B e nada de A');
select ph_teste.volta();
-- C: a cortesia acabou, a produção ficou só para leitura.
select ph_teste.como('c1');
select is((select count(*)::int from public.producao_historico), 6, 'só leitura: o admin lê o histórico');
select ph_teste.volta();
select ph_teste.como('c3');
select is((select count(*)::int from public.producao_historico), 6, 'só leitura: o leitor lê o histórico');
select ph_teste.volta();
select ph_teste.como('c4');
select is((select count(*)::int from public.producao_historico), 0, 'só leitura: quem não tinha o módulo não lê');
select ph_teste.volta();
select ph_teste.como('d1');
select is((select count(*)::int from public.producao_historico), 0, 'organização sem o módulo: nem o admin com a produção no vínculo lê');
select ph_teste.volta();
select ph_teste.como('e1');
select is((select count(*)::int from public.producao_historico), 27, 'super admin: lê o histórico das quatro organizações, até sem o módulo ou com ele só para leitura');
select ph_teste.volta();
select ph_teste.como('e2');
select is((select count(*)::int from public.producao_historico), 0, 'pessoa de fora de todas as organizações: nada');
select ph_teste.volta();
select ph_teste.como(null);
select throws_ok($t$select count(*) from public.producao_historico$t$, '42501', null, 'visitante: sem permissão nem para consultar o histórico');
select throws_ok($t$select public.auth_producao_ve_historico(gen_random_uuid(), 'producao_blocos', gen_random_uuid())$t$, '42501', null,
                 'visitante: não executa a função da regra');
select ph_teste.volta();

-- ─── Mudar a hora de um bloco ───────────────────────────────────────────────

-- O aceite do plano: a hora do bloco muda e a mudança aparece, campo a campo.
select is(ph_teste.como_depois('a2',
            array[format($t$update public.producao_blocos set inicio = '2026-11-20 19:30-03', fim = '2026-11-20 20:30-03' where id = %L$t$, ph_teste.id('4a'))],
            'a2',
            format($t$select string_agg(campo || ': ' || antes || ' -> ' || depois, ' | ' order by campo) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('4a'))),
          'fim: 2026-11-20T22:00:00+00:00 -> 2026-11-20T23:30:00+00:00 | inicio: 2026-11-20T21:00:00+00:00 -> 2026-11-20T22:30:00+00:00',
          'mudar a hora de um bloco aparece no histórico: uma linha por campo, de onde para onde, em UTC, e quem lê o bloco lê a história dele');
select is(ph_teste.como_depois('a2',
            array[format($t$update public.producao_blocos set inicio = '2026-11-20 19:30-03', fim = '2026-11-20 20:30-03' where id = %L$t$, ph_teste.id('4a'))],
            null,
            format($t$select bool_and(quem = %L)::text || ' ' || count(*) || ' ' || count(distinct quando) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('a2'), ph_teste.id('4a'))),
          'true 2 1', 'as duas linhas são de quem gravou (a2) e do mesmo instante');
select is(ph_teste.como_depois(null,
            array[format($t$update public.producao_blocos set inicio = '2026-11-20 17:30-03' where id = %L$t$, ph_teste.id('4a'))],
            null,
            format($t$select count(*) || ' ' || count(quem) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('4a'))),
          '1 0', 'sem usuário (o dono do banco, a chave de serviço, uma rotina) o quem é nulo, e a linha existe');
select is(ph_teste.como_depois(null,
            array[$x$select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true)$x$,
                  format($t$update public.producao_blocos set titulo = 'Outro nome' where id = %L$t$, ph_teste.id('4a'))],
            null,
            format($t$select count(*) || ' ' || count(quem) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('4a'))),
          '1 0', 'se a conta de quem grava já não existe (apagada na mesma gravação), a gravação passa e o quem fica nulo: o histórico nunca trava a gravação');
select is(ph_teste.como_depois('a2',
            array[format($t$insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo, titulo) values (%L, %L, %L, '2026-11-20', '2026-11-20 20:00-03', 'sessao', 'Sessão das 20h')$t$,
                         ph_teste.id('f1'), ph_teste.id('a0'), ph_teste.id('3a'))],
            'a2',
            format($t$select acao || '|' || coalesce(campo, '-') || '|' || coalesce(antes, '-') || '|' || coalesce(depois, '-') || '|' || (quem = %L)::text from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L$t$, ph_teste.id('a2'), ph_teste.id('f1'))),
          'criou|-|-|Sessão das 20h|true', 'criar um bloco deixa uma linha só, com o título dele no depois');
select is(ph_teste.como_depois('a2',
            array[format($t$insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo) values (%L, %L, %L, '2026-11-20', '2026-11-20 20:00-03', 'montagem')$t$,
                         ph_teste.id('f2'), ph_teste.id('a0'), ph_teste.id('3a'))],
            'a2',
            format($t$select coalesce(depois, '-') from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L$t$, ph_teste.id('f2'))),
          'montagem', 'sem título, o rótulo do bloco é o tipo');
select is(ph_teste.como_depois('a2',
            array[format($t$update public.producao_blocos set notas = repeat('x', 2000) where id = %L$t$, ph_teste.id('4a'))],
            'a2',
            format($t$select length(depois) || ' ' || coalesce(antes, 'nulo') from public.producao_historico where entidade_id = %L and campo = 'notas'$t$, ph_teste.id('4a'))),
          '500 nulo', 'o texto longo é cortado em 500 letras: o histórico não incha com notas');
select is(ph_teste.como_depois('a2',
            array[format($t$update public.producao_blocos set confirmado = true, visivel_para = '{equipe,tecnica}' where id = %L$t$, ph_teste.id('4a'))],
            'a2',
            format($t$select string_agg(campo || '=' || coalesce(antes, 'nulo') || '>' || depois, ' | ' order by campo) from public.producao_historico where entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('4a'))),
          'confirmado=false>true | visivel_para=nulo>["equipe", "tecnica"]', 'booleano, lista e nulo viram texto legível');
select is(ph_teste.como_depois('a2',
            array[format($t$update public.producao_blocos set titulo = titulo, confirmado = confirmado where id = %L$t$, ph_teste.id('4a')),
                  format($t$update public.producao_blocos set titulo = 'Passagem de som' where id = %L$t$, ph_teste.id('4a'))],
            'a2',
            format($t$select count(*) from public.producao_historico where entidade_id = %L and acao = 'alterou'$t$, ph_teste.id('4a'))),
          '0', 'gravar sem mudar nada não deixa linha (o updated_at, que muda a cada gravação, não é história)');
select is(ph_teste.como_depois('a1', array[
            format($t$update public.producao_obras set titulo = 'x' where id = %L$t$, ph_teste.id('1a')),
            format($t$update public.producao_temporadas set titulo = 'x' where id = %L$t$, ph_teste.id('2a')),
            format($t$update public.producao_datas set situacao = 'confirmada' where id = %L$t$, ph_teste.id('3a')),
            format($t$update public.producao_blocos set titulo = 'x' where id = %L$t$, ph_teste.id('4a')),
            format($t$update public.producao_espacos set nome = 'x' where id = %L$t$, ph_teste.id('7a')),
            format($t$update public.producao_salas set nome = 'x' where id = %L$t$, ph_teste.id('8a')),
            format($t$select public.fn_producao_definir_funcao(%L, %L, true, 5000, 'organizacao')$t$, ph_teste.id('a0'), ph_teste.id('a2'))],
            'a1',
            $t$select string_agg(distinct entidade, ',' order by entidade) from public.producao_historico where acao = 'alterou'$t$),
          'producao_blocos,producao_datas,producao_espacos,producao_funcoes,producao_obras,producao_salas,producao_temporadas',
          'uma mudança em cada uma das sete tabelas deixa a linha dela');

-- ─── Campo fora da lista ────────────────────────────────────────────────────

-- O segundo aceite do plano. Hoje nenhuma coluna das tabelas é sensível, então uma tabela de sonda
-- (criada e desfeita aqui) leva o mesmo gatilho com a lista "cache,documento": o que muda só nesses
-- campos, e o updated_at, não deixa linha; o que muda em mais de um grava só o que não é da lista;
-- e nenhum valor da lista aparece em lugar nenhum do histórico.
select is(ph_teste.como_depois(null, array[
            $x$create table public.producao_sonda_hist (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations (id), titulo text, hora timestamptz, cache numeric, documento text, updated_at timestamptz not null default now())$x$,
            $x$create trigger producao_sonda_hist_historico after insert or update or delete on public.producao_sonda_hist for each row execute function public.fn_producao_historico('cache,documento', 'titulo')$x$,
            format($x$insert into public.producao_sonda_hist (id, organization_id, titulo, hora, cache, documento) values (%L, %L, 'Sonda', '2026-12-01 10:00-03', 98765.43, 'SEGREDO-123')$x$, ph_teste.id('f3'), ph_teste.id('a0')),
            format($x$update public.producao_sonda_hist set cache = 11111.11 where id = %L$x$, ph_teste.id('f3')),
            format($x$update public.producao_sonda_hist set documento = 'OUTRO-SEGREDO' where id = %L$x$, ph_teste.id('f3')),
            format($x$update public.producao_sonda_hist set updated_at = now() + interval '5 days', titulo = titulo where id = %L$x$, ph_teste.id('f3')),
            format($x$update public.producao_sonda_hist set hora = '2026-12-01 11:00-03', cache = 22222.22, documento = 'MAIS-UM' where id = %L$x$, ph_teste.id('f3'))],
            null,
            $x$select (select string_agg(acao || ':' || coalesce(campo, '-') || ':' || coalesce(antes, '-') || '>' || coalesce(depois, '-'), ' | ' order by id) from public.producao_historico where entidade = 'producao_sonda_hist')
                      || ' / ' || (select count(*) from public.producao_historico where antes ~ 'SEGREDO|MAIS-UM|98765|11111|22222' or depois ~ 'SEGREDO|MAIS-UM|98765|11111|22222' or campo in ('cache', 'documento', 'updated_at'))$x$),
          'criou:-:->Sonda | alterou:hora:2026-12-01T13:00:00+00:00>2026-12-01T14:00:00+00:00 / 0',
          'mudar só um campo da lista não deixa linha, e mudar vários grava só o que não é da lista: o valor excluído não aparece em lugar nenhum');
select is(ph_teste.como_depois('a1',
            array[format($t$select public.fn_producao_definir_funcao(%L, %L, true, 5000, 'organizacao')$t$, ph_teste.id('a0'), ph_teste.id('a2'))],
            'a1',
            format($t$select string_agg(campo || ':' || coalesce(antes, '-') || '>' || depois, ' | ' order by campo) || ' ' || bool_and(quem = %L)::text from public.producao_historico where entidade = 'producao_funcoes' and acao = 'alterou'$t$, ph_teste.id('a1'))),
          'alcada:->5000.00 | dinheiro:false>true true',
          'dar a alguém o acesso ao dinheiro fica no histórico, com quem deu; o definido_por, que repete o quem, está na lista e não vira linha');

-- ─── Escrita só pelo gatilho ────────────────────────────────────────────────

select ph_teste.como('a1');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_blocos', %L, 'criou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '42501 permission denied for table producao_historico', 'o admin não insere no histórico: nem para forjar uma linha com o nome de outra pessoa');
select is(ph_teste.tenta($t$update public.producao_historico set depois = 'forjado'$t$),
          '42501 permission denied for table producao_historico', 'o admin não altera o histórico');
select is(ph_teste.tenta($t$select public.fn_producao_historico()$t$),
          '42501 permission denied for function fn_producao_historico', 'o admin não chama o gatilho do histórico');
select ph_teste.volta();
select ph_teste.como('e1');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_blocos', %L, 'criou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '42501 permission denied for table producao_historico', 'nem o super admin escreve no histórico pelo navegador');
select ph_teste.volta();
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_historico', %L, 'criou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_entidade_check', 'a tabela recusa o histórico do próprio histórico');
select is(ph_teste.como_depois(null, array[
            $x$create trigger producao_historico_historico after insert or update or delete on public.producao_historico for each row execute function public.fn_producao_historico('', 'acao')$x$,
            format($x$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_blocos', %L, 'criou')$x$, ph_teste.id('a0'), ph_teste.id('f9')),
            format($x$update public.producao_historico set depois = 'x' where entidade_id = %L$x$, ph_teste.id('f9'))],
            null,
            format($x$select count(*) from public.producao_historico where entidade_id = %L$x$, ph_teste.id('f9'))),
          '1', 'mesmo com o gatilho ligado ao histórico, ele não grava o histórico do próprio histórico (nem entra em laço)');

-- ─── A forma das linhas ─────────────────────────────────────────────────────

select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_blocos', %L, 'mudou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_acao_check', 'ação que não é criou, alterou nem apagou é recusada');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'producao_blocos', %L, 'alterou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_campo_check', 'alterou sem dizer o campo é recusado');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao, campo) values (%L, 'producao_blocos', %L, 'criou', 'titulo')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_campo_check', 'criou com campo é recusado: só a alteração tem campo');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao, campo, antes) values (%L, 'producao_blocos', %L, 'alterou', 'notas', %L)$t$, ph_teste.id('a0'), ph_teste.id('4a'), repeat('x', 501))),
          '23514 producao_historico_valores_check', 'valor com mais de 500 letras é recusado');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao, antes) values (%L, 'producao_blocos', %L, 'criou', 'x')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_forma_check', 'criou com um antes é recusado: antes não existia');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (%L, 'obras', %L, 'criou')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          '23514 producao_historico_entidade_check', 'entidade que não é tabela da produção é recusada');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao) values (gen_random_uuid(), 'producao_blocos', %L, 'criou')$t$, ph_teste.id('4a'))),
          '23503 producao_historico_organization_id_fkey', 'organização que não existe é recusada');
select is(ph_teste.tenta(format($t$insert into public.producao_historico (organization_id, entidade, entidade_id, acao, campo, antes, depois) values (%L, 'producao_pautas', %L, 'alterou', 'situacao', 'consulta', 'confirmada')$t$, ph_teste.id('a0'), ph_teste.id('4a'))),
          'aceito', 'uma tabela nova da produção entra sem mexer na tabela do histórico: a entidade é do código');

-- ─── Apagar ─────────────────────────────────────────────────────────────────

-- Estas verificações usam DELETE. O conector do Supabase pode pedir confirmação ou recusá-las: rode esta
-- seção à parte (com o prelúdio, as seções-base e as duas migrations na frente), ajustando o plan().
select is(ph_teste.como_depois('a2',
            array[format($t$delete from public.producao_blocos where id = %L$t$, ph_teste.id('4a'))],
            null,
            format($t$select acao || ':' || coalesce(antes, '-') || ':' || coalesce(depois, '-') || ':' || (quem = %L)::text from public.producao_historico where entidade = 'producao_blocos' and entidade_id = %L and acao = 'apagou'$t$, ph_teste.id('a2'), ph_teste.id('4a'))),
          'apagou:Passagem de som:-:true', 'apagar um bloco deixa uma linha só, com o título dele no antes e quem apagou');
select is(ph_teste.como_depois('a2',
            array[format($t$delete from public.producao_blocos where id = %L$t$, ph_teste.id('4a'))],
            null,
            format($t$select count(*) from public.producao_historico where entidade_id = %L$t$, ph_teste.id('4a'))),
          '2', 'o histórico do bloco apagado continua guardado (criou e apagou)');
select is(ph_teste.como_depois('a2',
            array[format($t$delete from public.producao_blocos where id = %L$t$, ph_teste.id('4a'))],
            'a2',
            format($t$select count(*) from public.producao_historico where entidade_id = %L$t$, ph_teste.id('4a'))),
          '0', 'apagado o bloco, quem o lia deixa de ler o histórico dele pelo navegador');
select is(ph_teste.como_depois('a2',
            array[format($t$delete from public.producao_blocos where id = %L$t$, ph_teste.id('4a'))],
            'e1',
            format($t$select count(*) from public.producao_historico where entidade_id = %L$t$, ph_teste.id('4a'))),
          '0', 'o suporte segue as mesmas funções: o histórico de um registro apagado também não aparece para ele no navegador');
select is(ph_teste.como_depois('a1',
            array[format($t$delete from public.producao_datas where id = %L$t$, ph_teste.id('3a'))],
            null,
            $t$select string_agg(entidade, ',' order by entidade) from public.producao_historico where acao = 'apagou'$t$),
          'producao_blocos,producao_datas', 'apagar a data apaga os blocos dela, e cada um deixa a sua linha');
select ph_teste.como('a1');
select is(ph_teste.tenta($t$delete from public.producao_historico$t$),
          '42501 permission denied for table producao_historico', 'o admin não apaga o histórico');
select ph_teste.volta();
select is(ph_teste.como_depois(null, array[
            $x$create table public.producao_sonda_hist (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations (id), titulo text, cache numeric, documento text, updated_at timestamptz not null default now())$x$,
            $x$create trigger producao_sonda_hist_historico after insert or update or delete on public.producao_sonda_hist for each row execute function public.fn_producao_historico('cache,documento', 'titulo')$x$,
            format($x$insert into public.producao_sonda_hist (id, organization_id, titulo, cache, documento) values (%L, %L, 'Sonda', 98765.43, 'SEGREDO-123')$x$, ph_teste.id('f3'), ph_teste.id('a0')),
            format($x$delete from public.producao_sonda_hist where id = %L$x$, ph_teste.id('f3'))],
            null,
            $x$select (select string_agg(acao || ':' || coalesce(antes, '-') || ':' || coalesce(depois, '-'), ' | ' order by id) from public.producao_historico where entidade = 'producao_sonda_hist')
                      || ' / ' || (select count(*) from public.producao_historico where antes ~ 'SEGREDO|98765' or depois ~ 'SEGREDO|98765')$x$),
          'criou:-:Sonda | apagou:Sonda:- / 0', 'apagar também respeita a lista: o rótulo é o título, e o valor excluído não aparece');
select is(ph_teste.como_depois(null,
            array[format($t$delete from public.organization_members where organization_id = %L and user_id = %L$t$, ph_teste.id('a0'), ph_teste.id('a2'))],
            null,
            $t$select antes from public.producao_historico where entidade = 'producao_funcoes' and acao = 'apagou'$t$),
          ph_teste.id('a2')::text, 'quem sai da organização leva a função junto, e isso fica: apagou, com a pessoa no antes');
select is(ph_teste.como_depois(null, array[
            format($t$insert into public.organizations (id, nome) values (%L, 'PH organização Z')$t$, ph_teste.id('e0')),
            format($t$insert into public.producao_obras (id, organization_id, tipo, titulo) values (%L, %L, 'teatro', 'z')$t$, ph_teste.id('e8'), ph_teste.id('e0')),
            format($t$insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo) values (%L, %L, %L, 'circulacao', 'circula', 'teatro', 'z')$t$, ph_teste.id('e3'), ph_teste.id('e0'), ph_teste.id('e8')),
            format($t$insert into public.producao_espacos (id, organization_id, nome, tipo) values (%L, %L, 'z', 'teatro')$t$, ph_teste.id('e4'), ph_teste.id('e0')),
            format($t$insert into public.producao_salas (id, organization_id, espaco_id, nome) values (%L, %L, %L, 'z')$t$, ph_teste.id('e5'), ph_teste.id('e0'), ph_teste.id('e4')),
            format($t$insert into public.producao_datas (id, organization_id, temporada_id, espaco_id, sala_id, data) values (%L, %L, %L, %L, %L, '2026-12-01')$t$, ph_teste.id('e6'), ph_teste.id('e0'), ph_teste.id('e3'), ph_teste.id('e4'), ph_teste.id('e5')),
            format($t$insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, tipo, sala_id) values (%L, %L, %L, '2026-12-01', '2026-12-01 20:00-03', 'sessao', %L)$t$, ph_teste.id('e7'), ph_teste.id('e0'), ph_teste.id('e6'), ph_teste.id('e5')),
            format($t$update public.producao_blocos set confirmado = true where id = %L$t$, ph_teste.id('e7')),
            format($t$delete from public.organizations where id = %L$t$, ph_teste.id('e0'))],
            null,
            format($t$select (select count(*) from public.producao_historico where organization_id = %1$L) || ' ' || (select count(*) from public.producao_blocos where organization_id = %1$L) || ' ' || (select count(*) from public.producao_historico where organization_id = %2$L)$t$, ph_teste.id('e0'), ph_teste.id('a0'))),
          '0 0 9', 'apagar a organização inteira, com registros e histórico, passa e leva as linhas dela, sem mexer nas das outras');

select * from finish();
rollback;
