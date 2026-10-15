-- PD0.14: arquivos da produção (a tabela producao_arquivos e as regras do bucket documentos).
--
-- Confere as duas migrations, producao_arquivos e producao_arquivos_armazenamento: o caminho
-- {organização}/producoes/{temporada}/{pasta}/{uuid}.{ext} é julgado pelo banco como pelo app; a
-- tabela segue a receita da PD0.7a (quem lê, quem escreve, leitura sem assinatura, recorte da
-- temporada) e a pasta `pessoas` só abre a quem pode `dinheiro`, na tabela e no bucket; o gatilho de
-- coerência amarra o caminho à organização, à temporada e à pasta da linha; o histórico guarda o que
-- importa sem o nome do arquivo; e, no bucket, quem não tem a produção (a captação, a prestação, o
-- captador, o proponente, outra organização, o visitante) não lê nem escreve em producoes/, o leitor
-- lê e não escreve, e a regra nova diz "não se aplica" a todo caminho que não é de producoes.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids são
-- 0d140000-0000-4000-8000-0000000000XX, e pa_teste.id('XX') os escreve:
--   organização A, com a produção em vigor (cortesia) e a prestação (cortesia):
--     a1 admin (com registro "vinculado": o admin ignora o recorte); a2 colaborador; a3 leitor;
--     a4 colaborador só com a captação; a5 captador com a produção no vínculo (o convite não deixa, o
--     banco aceitaria: tem de negar mesmo assim); a6 colaborador com o recorte "vinculado"; a7 proponente;
--     a8 colaborador que vê o dinheiro; a9 leitor que vê o dinheiro; aa colaborador só com a prestação;
--     ab leitor só com a prestação; ac colaborador com a captação e a prestação;
--   organização B, com a produção em vigor: admin b1;
--   organização C, com a produção encerrada (só para leitura): admin c1, leitor c3, colaborador c4 sem o
--     módulo, colaborador c5 que vê o dinheiro e leitor c6 que vê o dinheiro;
--   organização D, sem a produção: admin d1 (com a produção no vínculo); o super admin e1 é colaborador
--     de D só com a captação;
--   e2, de fora de todas as organizações; visitante, sem login.
-- Temporadas: 2a e 2e em A (a 2e é a do recorte), 2b em B, 2c em C, 2d em D; uma data em cada
-- (3a, 3e, 3b, 3c, 3d). Arquivos (linhas de producao_arquivos e objetos no bucket, com os mesmos caminhos):
--   R1 acordos e R2 pessoas, R3 plantas (ligada à data 3a) e R4 acordos na 2e, todos de A; R5 acordos de B;
--   R6 acordos e R7 pessoas de C; R8 acordos de D.
-- Mais 17 objetos de caminhos que NÃO são de producoes (G1 a G17: a prestação, os fornecedores, os outros
-- arquivos da organização e variações que parecem com producoes), para a regra nova provar que não se aplica.
--
-- As seções depois das ferramentas não dependem umas das outras: cada gravação delas roda dentro de uma
-- função que desfaz tudo, então o cenário fica como nasceu. Dá para rodar só algumas, com o prelúdio e as
-- seções-base (Dados, Pessoas e módulos, Arquivos e objetos e Ferramentas) na frente, ajustando o plan().
-- As duas seções "Apagar:" usam DELETE de verdade (o conector do Supabase pede uma confirmação que não consegue
-- mostrar e recusa o bloco): rode-as à parte, num banco de testes. A seção "Apagar sem apagar" confere o mesmo sem
-- DELETE: lê de pg_policies a regra de apagar da tabela e as duas do bucket e as avalia como cada pessoa.
-- A seção "O recorte por vínculo" troca auth_producao_ve_temporada dentro da transação, como a PD1.9 fará,
-- e por isso é a última.
--
-- Rodar: supabase/tests/README.md, com as migrations producao_arquivos e producao_arquivos_armazenamento
-- na frente, nessa ordem.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(234);

create schema pa_teste;
grant usage on schema pa_teste to authenticated, anon;

create function pa_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d140000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

-- ─── Dados ───────────────────────────────────────────────────────────────────

do $dados$
declare
  x text;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (pa_teste.id('f0'), 'pa-f0@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values
    (pa_teste.id('a0'), 'PA organização A'), (pa_teste.id('b0'), 'PA organização B'),
    (pa_teste.id('c0'), 'PA organização C'), (pa_teste.id('d0'), 'PA organização D');

  foreach x in array array['a', 'b', 'c', 'd'] loop
    insert into public.producao_obras (id, organization_id, tipo, titulo) values (pa_teste.id('1' || x), pa_teste.id(x || '0'), 'teatro', 'PA obra ' || x);
    insert into public.producao_temporadas (id, organization_id, obra_id, formato, lado, tipo, titulo)
    values (pa_teste.id('2' || x), pa_teste.id(x || '0'), pa_teste.id('1' || x), 'circulacao', 'circula', 'teatro', 'PA temporada ' || x);
    insert into public.producao_datas (id, organization_id, temporada_id, obra_id, data)
    values (pa_teste.id('3' || x), pa_teste.id(x || '0'), pa_teste.id('2' || x), pa_teste.id('1' || x), date '2026-11-20');
  end loop;
  -- A segunda temporada de A, a do recorte, com a data dela.
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo)
  values (pa_teste.id('2e'), pa_teste.id('a0'), 'circulacao', 'circula', 'teatro', 'PA temporada A2');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values (pa_teste.id('3e'), pa_teste.id('a0'), pa_teste.id('2e'), date '2026-12-05');
end
$dados$;

-- ─── Pessoas e módulos ───────────────────────────────────────────────────────

do $pessoas$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pa_teste.id(sufixo), 'pa-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'aa', 'ab', 'ac', 'b1', 'c1', 'c3', 'c4', 'c5', 'c6', 'd1', 'e1', 'e2']) as sufixo;

  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pa_teste.id('a0'), 'producao', 'cortesia', 20), (pa_teste.id('a0'), 'prestacao', 'cortesia', 20),
    (pa_teste.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pa_teste.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now()
  where organization_id = pa_teste.id('c0') and modulo = 'producao';

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pa_teste.id(org), pa_teste.id(pessoa), papel, modulos::text[]
  from (values
    ('a0', 'a1', 'admin', '{captacao,prestacao,producao}'), ('a0', 'a2', 'colaborador', '{producao}'),
    ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a4', 'colaborador', '{captacao}'),
    ('a0', 'a5', 'captador', '{captacao,producao}'), ('a0', 'a6', 'colaborador', '{producao}'),
    ('a0', 'a7', 'proponente', '{captacao}'), ('a0', 'a8', 'colaborador', '{producao}'),
    ('a0', 'a9', 'leitor', '{producao}'), ('a0', 'aa', 'colaborador', '{prestacao}'),
    ('a0', 'ab', 'leitor', '{prestacao}'), ('a0', 'ac', 'colaborador', '{captacao,prestacao}'),
    ('b0', 'b1', 'admin', '{captacao,producao}'),
    ('c0', 'c1', 'admin', '{captacao,producao}'), ('c0', 'c3', 'leitor', '{producao}'), ('c0', 'c4', 'colaborador', '{captacao}'),
    ('c0', 'c5', 'colaborador', '{producao}'), ('c0', 'c6', 'leitor', '{producao}'),
    ('d0', 'd1', 'admin', '{captacao,producao}'), ('d0', 'e1', 'colaborador', '{captacao}')
  ) as v(org, pessoa, papel, modulos);
  update public.profiles set jards_super_admin = true where id = pa_teste.id('e1');

  -- As funções, gravadas direto como o dono do banco: a1 e a6 com o recorte "vinculado", a8 e a9 veem o dinheiro.
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (pa_teste.id('a0'), pa_teste.id('a1'), false, 'vinculado'), (pa_teste.id('a0'), pa_teste.id('a6'), false, 'vinculado'),
    (pa_teste.id('a0'), pa_teste.id('a8'), true, 'organizacao'), (pa_teste.id('a0'), pa_teste.id('a9'), true, 'organizacao'),
    (pa_teste.id('c0'), pa_teste.id('c5'), true, 'organizacao'), (pa_teste.id('c0'), pa_teste.id('c6'), true, 'organizacao');
end
$pessoas$;

-- ─── Arquivos e objetos ──────────────────────────────────────────────────────

-- O caminho de um arquivo da produção: organização, temporada, pasta, uuid do arquivo e extensão.
create function pa_teste.caminho(org text, temporada text, pasta text, arquivo text, ext text default 'pdf') returns text language sql immutable as $$
  select pa_teste.id(org)::text || '/producoes/' || pa_teste.id(temporada)::text || '/' || pasta || '/' || pa_teste.id(arquivo)::text || '.' || ext;
$$;

do $arquivos$
declare
  a1 uuid := pa_teste.id('a1');
begin
  -- As linhas (o dono do banco passa pelas regras). R1 a R8.
  insert into public.producao_arquivos (id, organization_id, temporada_id, data_id, pasta, storage_path, nome, tipo, tamanho, sha256, enviado_por) values
    (pa_teste.id('d101'), pa_teste.id('a0'), pa_teste.id('2a'), null, 'acordos', pa_teste.caminho('a0', '2a', 'acordos', 'f101'), 'Contrato Teatro.pdf', 'application/pdf', 1000, repeat('a', 64), a1),
    (pa_teste.id('d102'), pa_teste.id('a0'), pa_teste.id('2a'), null, 'pessoas', pa_teste.caminho('a0', '2a', 'pessoas', 'f102', 'jpg'), 'Passaporte SEGREDO.jpg', 'image/jpeg', 2000, repeat('b', 64), a1),
    (pa_teste.id('d103'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.id('3a'), 'plantas', pa_teste.caminho('a0', '2a', 'plantas', 'f103'), 'Planta do palco.pdf', 'application/pdf', 3000, repeat('c', 64), a1),
    (pa_teste.id('d104'), pa_teste.id('a0'), pa_teste.id('2e'), null, 'acordos', pa_teste.caminho('a0', '2e', 'acordos', 'f104'), 'Acordo da segunda temporada.pdf', 'application/pdf', 4000, repeat('d', 64), a1),
    (pa_teste.id('d105'), pa_teste.id('b0'), pa_teste.id('2b'), null, 'acordos', pa_teste.caminho('b0', '2b', 'acordos', 'f105'), 'Acordo de B.pdf', 'application/pdf', 5000, repeat('e', 64), null),
    (pa_teste.id('d106'), pa_teste.id('c0'), pa_teste.id('2c'), null, 'acordos', pa_teste.caminho('c0', '2c', 'acordos', 'f106'), 'Acordo de C.pdf', 'application/pdf', 6000, repeat('f', 64), null),
    (pa_teste.id('d107'), pa_teste.id('c0'), pa_teste.id('2c'), null, 'pessoas', pa_teste.caminho('c0', '2c', 'pessoas', 'f107', 'jpg'), 'RG de C.jpg', 'image/jpeg', 7000, repeat('1', 64), null),
    (pa_teste.id('d108'), pa_teste.id('d0'), pa_teste.id('2d'), null, 'acordos', pa_teste.caminho('d0', '2d', 'acordos', 'f108'), 'Acordo de D.pdf', 'application/pdf', 8000, repeat('2', 64), null);

  -- Os objetos no bucket, com os mesmos caminhos das linhas.
  insert into storage.objects (bucket_id, name, owner)
  select 'documentos', storage_path, a1 from public.producao_arquivos;

end
$arquivos$;

-- ─── Ferramentas ─────────────────────────────────────────────────────────────

-- Entra como a pessoa (ou como visitante, com null) até pa_teste.volta().
create function pa_teste.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pa_teste.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pa_teste.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Roda o comando como a pessoa quem (null = o dono do banco) e desfaz. 'aceito' se passou; senão o código do
-- erro e o nome da restrição que recusou (ou a mensagem, quando não é uma restrição). As chaves entre as
-- tabelas da produção são conferidas no fim da transação: força a conferência antes de devolver.
create function pa_teste.tenta(comando text, quem text default null) returns text language plpgsql as $$
declare
  nome text;
begin
  begin
    if quem is not null then perform pa_teste.como(quem); end if;
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

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a regra barrou (erro de permissão ou
-- nenhuma linha); outro erro volta descrito, para o teste mostrar o que quebrou.
create function pa_teste.efeito(comando text) returns text language plpgsql as $$
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

-- Roda os comandos como a pessoa quem (null = o dono do banco), lê com a consulta como a pessoa leitor (null = o
-- dono) e desfaz tudo. Devolve o resultado da consulta, ou o erro.
create function pa_teste.depois(quem text, comandos text[], leitor text, consulta text) returns text language plpgsql as $$
declare
  comando text;
  resultado text;
begin
  begin
    if quem is not null then perform pa_teste.como(quem); end if;
    foreach comando in array comandos loop
      execute comando;
    end loop;
    set constraints all immediate;
    perform pa_teste.volta();
    if leitor is not null then perform pa_teste.como(leitor); end if;
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

grant execute on all functions in schema pa_teste to authenticated, anon;

-- O bucket recusa exclusão direta fora da API de arquivos; aqui a trava sai para o teste olhar só a regra de quem
-- pode apagar.
set local storage.allow_delete_query = 'true';

-- ─── Ferramentas das linhas ──────────────────────────────────────────────────

-- Base opcional: as seções que olham as linhas e as pastas (a função das pastas, quem lê e o recorte) pedem estas funções.
-- Quem lê as linhas: quantas linhas de producao_arquivos a pessoa vê e quais (R1 a R8, pelo último dígito do id).
create function pa_teste.linhas(quem text) returns text language plpgsql as $$
declare
  r text;
begin
  perform pa_teste.como(quem);
  select count(*)::text || ' ' || coalesce(string_agg('R' || right(id::text, 1), ',' order by id), '-')
  into r from public.producao_arquivos;
  perform pa_teste.volta();
  return r;
end;
$$;

-- A resposta de auth_producao_pasta_pode para a organização, nas duas pastas e nas três ações, como seis 0 e 1:
-- acordos (ler, ler_sem_assinatura, editar) e pessoas (ler, ler_sem_assinatura, editar).
create function pa_teste.pasta_pode(quem text, org text) returns text language plpgsql as $$
declare
  r text := '';
  pasta text;
  acao text;
begin
  perform pa_teste.como(quem);
  foreach pasta in array array['acordos', 'pessoas'] loop
    foreach acao in array array['ler', 'ler_sem_assinatura', 'editar'] loop
      r := r || case when public.auth_producao_pasta_pode(pa_teste.id(org), pasta, acao) then '1' else '0' end;
    end loop;
  end loop;
  perform pa_teste.volta();
  return r;
end;
$$;

-- ─── Ferramentas do bucket ───────────────────────────────────────────────────

-- Base opcional: as seções do bucket (quem lê, envia e troca; o que não é de producoes/; o recorte) pedem estas funções, que as outras seções dispensam.
-- O nome de um objeto irmão de x, para o teste de envio: troca o uuid do arquivo; o que não tem o formato leva .novo.
create function pa_teste.irmao(x text) returns text language sql immutable as $$
  select case when x ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$'
              then regexp_replace(x, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)$', '0d140000-0000-4000-8000-00000000ffff\1')
              else x || '.novo' end;
$$;

-- O que quem está logado faz com o objeto x do bucket: le (select), envia (insere um irmão dele) e troca (update).
-- O apagar fica na seção Apagar.
create function pa_teste.ops(x text) returns text language plpgsql as $$
declare
  r text[] := '{}';
begin
  if pa_teste.efeito(format($c$select 1 from storage.objects where bucket_id = 'documentos' and name = %L$c$, x)) = 'sim' then r := array_append(r, 'le'); end if;
  if pa_teste.efeito(format($c$insert into storage.objects (bucket_id, name) values ('documentos', %L)$c$, pa_teste.irmao(x))) = 'sim' then r := array_append(r, 'envia'); end if;
  if pa_teste.efeito(format($c$update storage.objects set metadata = metadata where bucket_id = 'documentos' and name = %L$c$, x)) = 'sim' then r := array_append(r, 'troca'); end if;
  return array_to_string(r, ',');
end;
$$;

-- O que a pessoa faz nas duas pastas de uma organização: acordos (a comum) e pessoas (a sensível), separadas por " / ".
create function pa_teste.ops_producao(quem text, org text, temporada text, acordos text, pessoas text) returns text language plpgsql as $$
declare
  r text;
begin
  perform pa_teste.como(quem);
  r := pa_teste.ops(pa_teste.caminho(org, temporada, 'acordos', acordos)) || ' / ' || pa_teste.ops(pa_teste.caminho(org, temporada, 'pessoas', pessoas, 'jpg'));
  perform pa_teste.volta();
  return r;
end;
$$;

-- ─── O catálogo: a tabela, as regras e os privilégios ────────────────────────

select is((select relrowsecurity from pg_class where oid = 'public.producao_arquivos'::regclass),
          true, 'a tabela tem a segurança por linha ligada');
select is((select array_agg(cmd || ' ' || policyname order by cmd, policyname collate "C") from pg_policies
           where schemaname = 'public' and tablename = 'producao_arquivos'),
          array['DELETE producao_arquivos: apaga', 'INSERT producao_arquivos: insere', 'SELECT producao_arquivos: le',
                'SELECT producao_arquivos: leitura sem assinatura', 'UPDATE producao_arquivos: edita'],
          'cinco regras: as duas de leitura (a normal e a leitura sem assinatura) e as de inserir, alterar e apagar');
select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename = 'producao_arquivos'
             and (roles <> '{authenticated}' or permissive <> 'PERMISSIVE' or cmd = 'ALL' or qual = 'true' or with_check = 'true')),
          0, 'nenhuma regra é para o visitante, restritiva, para todos os comandos ou aberta (using true)');
select is((select count(*)::int from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p
           where has_table_privilege('anon', 'public.producao_arquivos', p)),
          0, 'o visitante não tem privilégio nenhum na tabela');
select is((select array_agg(p order by p collate "C") from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) as p
           where has_table_privilege('authenticated', 'public.producao_arquivos', p)),
          array['delete', 'insert', 'select'], 'quem está logado lê, insere e apaga (pelas regras) e não tem o update da tabela inteira');
select is((select array_agg(attname::text order by attname::text collate "C") from pg_attribute
           where attrelid = 'public.producao_arquivos'::regclass and attnum > 0 and not attisdropped
             and has_column_privilege('authenticated', 'public.producao_arquivos', attname, 'update')),
          array['data_id', 'nome'], 'quem está logado altera só o nome e a data (privilégio por coluna)');
select is((select count(*)::int from pg_attribute
           where attrelid = 'public.producao_arquivos'::regclass and attnum > 0 and not attisdropped
             and has_column_privilege('anon', 'public.producao_arquivos', attname, 'update')),
          0, 'o visitante não altera coluna nenhuma');
select is((select array_agg(proname::text || ' ' || provolatile::text || ' ' || prosecdef::text || ' ' || coalesce(proconfig::text, '-') order by proname::text collate "C")
           from pg_proc where pronamespace = 'public'::regnamespace
             and proname in ('fn_producao_caminho_partes', 'auth_producao_pasta_pode', 'fn_producao_arquivo_coerencia')),
          array['auth_producao_pasta_pode s false {"search_path=public, pg_temp"}', 'fn_producao_arquivo_coerencia v true {"search_path=public, pg_temp"}',
                'fn_producao_caminho_partes i false {"search_path=public, pg_temp"}'],
          'as três funções: o caminho é imutável, a das pastas é estável e roda com a permissão de quem consulta, a de coerência roda com a do dono; todas com o caminho de busca fixo');
select is((select array_agg(proname::text order by proname::text collate "C") from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('fn_producao_caminho_partes', 'auth_producao_pasta_pode', 'fn_producao_arquivo_coerencia')
             and has_function_privilege('authenticated', p.oid, 'execute')),
          array['auth_producao_pasta_pode', 'fn_producao_caminho_partes'],
          'quem está logado executa as duas funções que as regras e a restrição do caminho chamam, e não o gatilho');
select is((select count(*)::int from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('fn_producao_caminho_partes', 'auth_producao_pasta_pode', 'fn_producao_arquivo_coerencia')
             and (has_function_privilege('anon', p.oid, 'execute') or p.proacl is null or exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))),
          0, 'o visitante não executa nenhuma das três, e nenhuma fica executável por public');
select is((select array_agg(t.tgname::text || ' ' || t.tgtype order by t.tgname collate "C") from pg_trigger t
           where t.tgrelid = 'public.producao_arquivos'::regclass and not t.tgisinternal),
          array['producao_arquivos_coerencia 23', 'producao_arquivos_historico 29', 'producao_arquivos_updated_at 19'],
          'três gatilhos: a coerência antes de inserir e alterar, o histórico depois de inserir, alterar e apagar, e o updated_at antes de alterar');
select is((select (regexp_match(pg_get_triggerdef(t.oid), 'fn_producao_historico\((.*)\)$'))[1] from pg_trigger t where t.tgname = 'producao_arquivos_historico'),
          '''enviado_por,nome,sha256,storage_path'', ''pasta''',
          'o histórico deixa de fora o nome, o caminho, a impressão digital e quem enviou, e o rótulo de criar e apagar é a pasta');
select is((select array_agg(conname::text || ' ' || confdeltype::text || ' ' || condeferrable::text || ' ' || condeferred::text order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_arquivos'::regclass),
          array['producao_arquivos_data_id_fkey a true true', 'producao_arquivos_enviado_por_fkey n false false',
                'producao_arquivos_organization_id_fkey c false false', 'producao_arquivos_temporada_id_fkey a true true'],
          'apagar a organização leva os arquivos; temporada e data com arquivo não se apagam (conferidas no fim da transação); apagar a conta de quem enviou só zera o campo');
select is((select array_agg(indexname::text order by indexname::text collate "C") from pg_indexes where schemaname = 'public' and tablename = 'producao_arquivos'),
          array['producao_arquivos_data_idx', 'producao_arquivos_enviado_por_idx', 'producao_arquivos_org_idx', 'producao_arquivos_pkey',
                'producao_arquivos_storage_path_key', 'producao_arquivos_temporada_idx'],
          'os índices: por organização, por temporada e pasta, por data, por quem enviou, o caminho único e a chave');
select is((select coalesce(array_agg(c.conname::text order by c.conname::text collate "C"), '{}'::text[])
           from pg_constraint c
           where c.contype = 'f' and c.conrelid = 'public.producao_arquivos'::regclass
             and not exists (
               select 1 from pg_index i
               cross join lateral (select array_agg(u.k order by u.o) as inicio
                                   from unnest(i.indkey::int2[]) with ordinality as u(k, o)
                                   where u.o <= cardinality(c.conkey)) l
               where i.indrelid = c.conrelid and i.indisvalid and l.inicio @> c.conkey and c.conkey @> l.inicio)),
          '{}'::text[], 'toda chave estrangeira tem um índice que começa nas colunas dela');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_arquivos'),
          array['id', 'organization_id', 'temporada_id', 'data_id', 'pasta', 'storage_path', 'nome', 'tipo', 'tamanho', 'sha256', 'enviado_por', 'created_at', 'updated_at'],
          'colunas de producao_arquivos');
select is((select count(*)::int from pg_constraint where contype = 'c' and conrelid = 'public.producao_arquivos'::regclass),
          6, 'as seis restrições de valor estão lá: pasta, caminho, nome, tipo, tamanho e sha256');
select is((select not prosecdef and pg_get_functiondef(oid) ~ 'when ''producao_arquivos'' then exists \(select 1 from public\.producao_arquivos x where x\.id = p_entidade_id and x\.organization_id = p_org\)'
           from pg_proc where pronamespace = 'public'::regnamespace and proname = 'auth_producao_ve_historico'),
          true, 'o histórico ganhou o ramo dos arquivos, e a função segue a rodar com a permissão de quem consulta');

-- ─── O catálogo: as regras do bucket ─────────────────────────────────────────

-- O texto das oito regras novas de storage.objects, como o banco o escreve. A expressão de cada uma tem duas partes: "não se aplica"
-- (outro bucket, ou outro segundo segmento) e a permissão da produção, pela função do bucket.
create function pa_teste.regra_restritiva(acao text) returns text language sql immutable as $$
  select format('((bucket_id <> ''documentos''::text) OR (COALESCE((storage.foldername(name))[2], ''''::text) <> ''producoes''::text) OR auth_producao_arquivo_pode(name, %L::text))', acao);
$$;
create function pa_teste.regra_permissiva(acao text) returns text language sql immutable as $$
  select format('((bucket_id = ''documentos''::text) AND (COALESCE((storage.foldername(name))[2], ''''::text) = ''producoes''::text) AND auth_producao_arquivo_pode(name, %L::text))', acao);
$$;

select is((select array_agg(permissive || ' ' || cmd || ' ' || policyname order by permissive, cmd, policyname collate "C") from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'documentos: producoes%'),
          array['PERMISSIVE DELETE documentos: producoes apaga', 'PERMISSIVE INSERT documentos: producoes insere',
                'PERMISSIVE SELECT documentos: producoes le', 'PERMISSIVE UPDATE documentos: producoes altera',
                'RESTRICTIVE DELETE documentos: producoes restrita (apaga)', 'RESTRICTIVE INSERT documentos: producoes restrita (insere)',
                'RESTRICTIVE SELECT documentos: producoes restrita (le)', 'RESTRICTIVE UPDATE documentos: producoes restrita (altera)'],
          'oito regras novas no bucket: quatro permissivas e quatro restritivas, uma por comando');
select is((select count(*)::int from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'documentos: producoes%' and (roles <> '{authenticated}' or cmd = 'ALL')),
          0, 'todas só para quem está logado, e nenhuma para todos os comandos');
select is((select array_agg(policyname || ' // ' || coalesce(qual, '-') || ' // ' || coalesce(with_check, '-') order by policyname collate "C") from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'documentos: producoes restrita%'),
          array['documentos: producoes restrita (altera) // ' || pa_teste.regra_restritiva('editar') || ' // ' || pa_teste.regra_restritiva('editar'),
                'documentos: producoes restrita (apaga) // ' || pa_teste.regra_restritiva('editar') || ' // -',
                'documentos: producoes restrita (insere) // - // ' || pa_teste.regra_restritiva('editar'),
                'documentos: producoes restrita (le) // ' || pa_teste.regra_restritiva('ler') || ' // -'],
          'o texto das quatro restritivas: fora de producoes/ passam (outro bucket, outro segundo segmento); em producoes/ pedem a produção (ler para ler, editar para o resto)');
select is((select array_agg(policyname || ' // ' || coalesce(qual, '-') || ' // ' || coalesce(with_check, '-') order by policyname collate "C") from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname in ('documentos: producoes altera', 'documentos: producoes apaga', 'documentos: producoes insere', 'documentos: producoes le')),
          array['documentos: producoes altera // ' || pa_teste.regra_permissiva('editar') || ' // ' || pa_teste.regra_permissiva('editar'),
                'documentos: producoes apaga // ' || pa_teste.regra_permissiva('editar') || ' // -',
                'documentos: producoes insere // - // ' || pa_teste.regra_permissiva('editar'),
                'documentos: producoes le // ' || pa_teste.regra_permissiva('ler') || ' // -'],
          'o texto das quatro permissivas: só em producoes/ do bucket documentos, pela função do bucket (a organização vem do caminho, não da sessão)');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and policyname in ('documentos: convidado le', 'documentos: delete org', 'documentos: enviado nao muda', 'documentos: enviado nao sai',
                              'documentos: leitura sem assinatura', 'documentos: proponente desfaz envio', 'documentos: proponente envia',
                              'documentos: read org', 'documentos: update org', 'documentos: upload org')),
          10, 'as dez regras que o bucket já tinha seguem lá, com os mesmos nomes (lidas de pg_policies em 15/10/2026): a PD0.14 só acrescenta');
select is((select not prosecdef and provolatile = 's' and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute')
                  and proconfig @> array['search_path=public, pg_temp'] and proacl is not null
                  and not exists (select 1 from aclexplode(proacl) a where a.grantee = 0)
           from pg_proc where pronamespace = 'public'::regnamespace and proname = 'auth_producao_arquivo_pode'),
          true, 'a função das regras do bucket roda com a permissão de quem consulta, é estável, tem o caminho de busca fixo e o visitante não a executa');

-- ─── O caminho, lido pelo banco ──────────────────────────────────────────────

-- A mesma grade de tests/_helpers/producao-caminhos-grade.ts (tests/producao-arquivos-sql.test.ts confere que
-- os modelos, a ordem e o veredito são os mesmos): {o}, {t} e {a} são a organização, a temporada e o arquivo
-- em minúsculas, e {O}, {T} e {A} os mesmos em maiúsculas.
create function pa_teste.expande(modelo text) returns text language sql immutable as $$
  select replace(replace(replace(replace(replace(replace(modelo,
    '{o}', 'a1b2c3d4-aaaa-4bbb-8ccc-0123456789ab'), '{t}', 'b2c3d4e5-bbbb-4ccc-8ddd-123456789abc'), '{a}', 'c3d4e5f6-cccc-4ddd-8eee-23456789abcd'),
    '{O}', 'A1B2C3D4-AAAA-4BBB-8CCC-0123456789AB'), '{T}', 'B2C3D4E5-BBBB-4CCC-8DDD-123456789ABC'), '{A}', 'C3D4E5F6-CCCC-4DDD-8EEE-23456789ABCD');
$$;

select is((select count(*)::text || ' ' || coalesce(string_agg(n::text, ',' order by n) filter (where (public.fn_producao_caminho_partes(pa_teste.expande(modelo)) is not null) is distinct from valido), 'ok')
           from (values
    (1, '{o}/producoes/{t}/datas/{a}.pdf', true),
    (2, '{o}/producoes/{t}/pessoas/{a}.pdf', true),
    (3, '{o}/producoes/{t}/acordos/{a}.pdf', true),
    (4, '{o}/producoes/{t}/plantas/{a}.pdf', true),
    (5, '{o}/producoes/{t}/itens/{a}.pdf', true),
    (6, '{o}/producoes/{t}/documentos/{a}.pdf', true),
    (7, '{o}/producoes/{t}/deslocamentos/{a}.pdf', true),
    (8, '{o}/producoes/{t}/hospedagem/{a}.pdf', true),
    (9, '{o}/producoes/{t}/recebidos/{a}.pdf', true),
    (10, '{o}/producoes/{t}/acordos/{a}.jpg', true),
    (11, '{o}/producoes/{t}/acordos/{a}.jpeg', true),
    (12, '{o}/producoes/{t}/acordos/{a}.xls', true),
    (13, '{o}/producoes/{t}/acordos/{a}.xlsx', true),
    (14, '{o}/producoes/{t}/plantas/{a}.dwg', true),
    (15, '{o}/producoes/{t}/itens/{a}.tif', true),
    (16, '{o}/producoes/{t}/itens/{a}.tiff', true),
    (17, '{o}/producoes/{t}/deslocamentos/{a}.mp4', true),
    (18, '{o}/producoes/{t}/recebidos/{a}.zip', true),
    (19, '{o}/producao/{t}/acordos/{a}.pdf', false),
    (20, '{o}/Producoes/{t}/acordos/{a}.pdf', false),
    (21, '{o}/prestacoes/{t}/comprovantes/{a}.pdf', false),
    (22, '{o}/fornecedores/{t}/{a}.pdf', false),
    (23, '{o}/outros/{t}/acordos/{a}.pdf', false),
    (24, '{o}/producoes/{a}.pdf', false),
    (25, 'producoes/{t}/acordos/{a}.pdf', false),
    (26, '{O}/producoes/{t}/acordos/{a}.pdf', false),
    (27, 'a1b2c3d4-aaaa-4bbb-8ccc-0123456789a/producoes/{t}/acordos/{a}.pdf', false),
    (28, 'g1b2c3d4-aaaa-4bbb-8ccc-0123456789ab/producoes/{t}/acordos/{a}.pdf', false),
    (29, '{o}/producoes/acordos/{a}.pdf', false),
    (30, '{o}/producoes/{T}/acordos/{a}.pdf', false),
    (31, '{o}/producoes/{t}/acordos/nota.pdf', false),
    (32, '{o}/producoes/{t}/acordos/{A}.pdf', false),
    (33, '{o}/producoes/{t}/{a}.pdf', false),
    (34, '{o}/producoes/{t}//{a}.pdf', false),
    (35, '{o}/producoes/{t}/financeiro/{a}.pdf', false),
    (36, '{o}/producoes/{t}/Acordos/{a}.pdf', false),
    (37, '{o}/producoes/{t}/acordos/sub/{a}.pdf', false),
    (38, '{o}/producoes/{t}/acordos/{a}', false),
    (39, '{o}/producoes/{t}/acordos/{a}.', false),
    (40, '{o}/producoes/{t}/acordos/.pdf', false),
    (41, '{o}/producoes/{t}/acordos/{a}.PDF', false),
    (42, '{o}/producoes/{t}/acordos/{a}.html', false),
    (43, '{o}/producoes/{t}/acordos/{a}.svg', false),
    (44, '{o}/producoes/{t}/acordos/{a}.exe', false),
    (45, '{o}/producoes/{t}/acordos/{a}.js', false),
    (46, '{o}/producoes/{t}/acordos/{a}.bin', false),
    (47, '{o}/producoes/{t}/acordos/{a}.pdf.exe', false),
    (48, '{o}/producoes/{t}/acordos/{a}.p d f', false),
    (49, '{o}/producoes/{t}/acordos/{a}.pdf ', false),
    (50, '{o}/producoes/{t}/acordos/{a}.pdf?x=1', false),
    (51, '{o}/producoes/{t}/acordos/{a}.pdf#x', false),
    (52, '{o}/producoes/{t}/acordos/../pessoas/{a}.pdf', false),
    (53, '{o}/producoes/../prestacoes/{t}/comprovantes/{a}.pdf', false),
    (54, '{o}/producoes/{t}/./acordos/{a}.pdf', false),
    (55, '{o}/producoes/{t}/acordos/%2e%2e/{a}.pdf', false),
    (56, '{o}/producoes/{t}/acordos/{a}.pdf/../{a}.pdf', false),
    (57, '{o}/producoes/{t}/acordos/{a}.pdf/', false),
    (58, '/{o}/producoes/{t}/acordos/{a}.pdf', false),
    (59, '{o}//producoes/{t}/acordos/{a}.pdf', false),
    (60, '{o}\producoes\{t}\acordos\{a}.pdf', false),
    (61, ' {o}/producoes/{t}/acordos/{a}.pdf', false),
    (62, '', false)
           ) as g(n, modelo, valido)),
          '62 ok', 'o banco aceita e recusa os mesmos 62 caminhos que o app: as nove pastas, a raiz, os identificadores, as extensões, o subir de pasta e as barras');
select is(public.fn_producao_caminho_partes(pa_teste.caminho('a0', '2a', 'acordos', 'f101', 'xlsx')),
          array[pa_teste.id('a0')::text, pa_teste.id('2a')::text, 'acordos', pa_teste.id('f101')::text, 'xlsx'],
          'as partes de um caminho: organização, temporada, pasta, arquivo e extensão');
select is(public.fn_producao_caminho_partes(null), null, 'nulo não é caminho');
select is(public.fn_producao_caminho_partes(pa_teste.caminho('a0', '2a', 'acordos', 'f101') || chr(10)), null,
          'a quebra de linha no fim não passa: o $ da expressão não a perdoa, como no app');
select is((select count(*)::int from unnest(array['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp',
                                                   'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'tif', 'tiff', 'dwg', 'dxf', 'mp3', 'wav', 'm4a', 'mp4', 'mov', 'zip']) as e
           where public.fn_producao_caminho_partes(pa_teste.caminho('a0', '2a', 'acordos', 'f101', e)) is not null),
          30, 'as 30 extensões aceitas passam, em qualquer pasta');
select is((select count(*)::int from unnest(array['html', 'htm', 'xhtml', 'svg', 'js', 'mjs', 'css', 'php', 'exe', 'msi', 'bat', 'sh', 'jar', 'dll', 'apk', 'bin', 'PDF', 'Pdf', 'pdf ', 'p df', 'pdf.exe', '']) as e
           where public.fn_producao_caminho_partes(pa_teste.caminho('a0', '2a', 'acordos', 'f101', e)) is not null),
          0, 'nada que o navegador abra como página ou programa, nem extensão fora da lista');
select is((select count(*)::int from unnest(array['datas', 'pessoas', 'acordos', 'plantas', 'itens', 'documentos', 'deslocamentos', 'hospedagem', 'recebidos']) as p
           where public.fn_producao_caminho_partes(pa_teste.caminho('a0', '2a', p, 'f101')) is not null),
          9, 'as nove pastas passam');

-- ─── A pasta pessoas e a função das pastas ───────────────────────────────────

-- auth_producao_pasta_pode(org, pasta, ação) como a pessoa: seis 0 e 1, que são acordos (ler, ler_sem_assinatura,
-- editar) e pessoas (ler, ler_sem_assinatura, editar). A pasta comum pede ler ou editar; a de pessoas pede dinheiro
-- (e, para escrever, editar também). O recorte da temporada não entra aqui: é da função do arquivo e das regras.
select is(pa_teste.pasta_pode('a1', 'a0'), '101101', 'admin: as duas pastas, ler e editar');
select is(pa_teste.pasta_pode('a2', 'a0'), '101000', 'colaborador sem o dinheiro: a pasta comum, e a de pessoas nada');
select is(pa_teste.pasta_pode('a3', 'a0'), '100000', 'leitor sem o dinheiro: lê a pasta comum, não escreve, e a de pessoas nada');
select is(pa_teste.pasta_pode('a8', 'a0'), '101101', 'colaborador que vê o dinheiro: as duas pastas, ler e editar');
select is(pa_teste.pasta_pode('a9', 'a0'), '100100', 'leitor que vê o dinheiro: lê as duas pastas e não escreve em nenhuma');
select is(pa_teste.pasta_pode('a6', 'a0'), '101000', 'colaborador com o recorte "vinculado": a função só olha o papel e o dinheiro (o recorte é da temporada)');
select is(pa_teste.pasta_pode('a4', 'a0') || pa_teste.pasta_pode('a5', 'a0') || pa_teste.pasta_pode('a7', 'a0') || pa_teste.pasta_pode('aa', 'a0') || pa_teste.pasta_pode('ab', 'a0') || pa_teste.pasta_pode('ac', 'a0'),
          '000000000000000000000000000000000000',
          'sem a produção (só a captação, a prestação, o captador com a produção no vínculo e o proponente): nada em nenhuma pasta');
select is(pa_teste.pasta_pode('b1', 'a0') || pa_teste.pasta_pode('d1', 'a0') || pa_teste.pasta_pode('e2', 'a0'), '000000000000000000',
          'o admin de outra organização, o admin de uma organização sem a produção e quem é de fora: nada');
select is(pa_teste.pasta_pode('e1', 'a0'), '101101', 'super admin: passa pela produção em vigor');
select is(pa_teste.pasta_pode('e1', 'd0'), '101101', 'super admin: passa até na organização sem a produção');
select is(pa_teste.pasta_pode('c1', 'c0'), '010010', 'produção só para leitura, admin: lê as duas pastas pela leitura sem assinatura e não escreve');
select is(pa_teste.pasta_pode('c3', 'c0'), '010000', 'produção só para leitura, leitor sem o dinheiro: lê a pasta comum e a de pessoas nada');
select is(pa_teste.pasta_pode('c5', 'c0') || pa_teste.pasta_pode('c6', 'c0'), '010010010010', 'produção só para leitura, quem vê o dinheiro: lê as duas pastas, e nem o colaborador escreve');
select is(pa_teste.pasta_pode('c4', 'c0'), '000000', 'produção só para leitura, quem não tinha o módulo: nada');
select pa_teste.como('a1');
select is(public.auth_producao_pasta_pode(pa_teste.id('a0'), 'financeiro', 'ler') or public.auth_producao_pasta_pode(pa_teste.id('a0'), 'financeiro', 'editar')
          or public.auth_producao_pasta_pode(pa_teste.id('a0'), 'Acordos', 'ler') or public.auth_producao_pasta_pode(pa_teste.id('a0'), null, 'ler'),
          false, 'pasta desconhecida nega, até para o admin');
select is(public.auth_producao_pasta_pode(pa_teste.id('a0'), 'acordos', 'apagar') or public.auth_producao_pasta_pode(pa_teste.id('a0'), 'acordos', null)
          or public.auth_producao_pasta_pode(pa_teste.id('a0'), 'pessoas', 'dinheiro'),
          false, 'ação desconhecida nega, até para o admin');
select pa_teste.volta();
select pa_teste.como(null);
select throws_ok($t$select public.auth_producao_pasta_pode('0d140000-0000-4000-8000-0000000000a0', 'acordos', 'ler')$t$, '42501', null, 'visitante: não executa a função das pastas');
select throws_ok($t$select public.fn_producao_caminho_partes('x')$t$, '42501', null, 'visitante: não executa a leitura do caminho');
select pa_teste.volta();

-- ─── Quem lê as linhas ───────────────────────────────────────────────────────

-- R1 acordos, R2 pessoas, R3 plantas (com data) e R4 acordos da outra temporada são de A; R5 é de B; R6 e R7, de C; R8, de D.
select is(pa_teste.linhas('a1'), '4 R1,R2,R3,R4', 'admin (até com o registro "vinculado"): lê tudo de A, as pessoas inclusive');
select is(pa_teste.linhas('a2'), '3 R1,R3,R4', 'colaborador sem o dinheiro: lê tudo de A menos a pasta de pessoas');
select is(pa_teste.linhas('a3'), '3 R1,R3,R4', 'leitor sem o dinheiro: lê tudo de A menos a pasta de pessoas');
select is(pa_teste.linhas('a8'), '4 R1,R2,R3,R4', 'colaborador que vê o dinheiro: lê também a pasta de pessoas');
select is(pa_teste.linhas('a9'), '4 R1,R2,R3,R4', 'leitor que vê o dinheiro: lê também a pasta de pessoas');
select is(pa_teste.linhas('a4') || pa_teste.linhas('a5') || pa_teste.linhas('a6') || pa_teste.linhas('a7'), '0 -0 -0 -0 -',
          'só a captação, captador, o recorte "vinculado" (falha fechado até a PD1.9) e proponente: nada');
select is(pa_teste.linhas('aa') || pa_teste.linhas('ab') || pa_teste.linhas('ac'), '0 -0 -0 -', 'quem tem só a prestação (ou ela com a captação): nada');
select is(pa_teste.linhas('b1'), '1 R5', 'admin de B: lê o de B e nada de A');
select is(pa_teste.linhas('d1'), '0 -', 'admin de uma organização sem a produção: nada, mesmo com a produção no vínculo');
select is(pa_teste.linhas('e2'), '0 -', 'de fora de todas as organizações: nada');
select is(pa_teste.linhas('e1'), '8 R1,R2,R3,R4,R5,R6,R7,R8', 'super admin: lê as quatro organizações, até a sem a produção e a só para leitura');
select is(pa_teste.linhas('c1'), '2 R6,R7', 'produção só para leitura, admin: lê as duas linhas de C');
select is(pa_teste.linhas('c3'), '1 R6', 'produção só para leitura, leitor sem o dinheiro: lê a pasta comum e não a de pessoas');
select is(pa_teste.linhas('c4'), '0 -', 'produção só para leitura, quem não tinha o módulo: nada');
select is(pa_teste.linhas('c5') || pa_teste.linhas('c6'), '2 R6,R72 R6,R7', 'produção só para leitura, quem vê o dinheiro: lê as duas pastas');
select pa_teste.como(null);
select throws_ok($t$select count(*) from public.producao_arquivos$t$, '42501', null, 'visitante: sem permissão nem para consultar a tabela');
select pa_teste.volta();

-- ─── Quem escreve nas linhas ─────────────────────────────────────────────────

-- O que a pessoa faz em A (ou C): cinco tentativas, cada uma desfeita, que dão "ok" ou "-": inserir na pasta comum,
-- inserir na de pessoas, renomear a linha da pasta comum, renomear a de pessoas e ligar a linha comum a uma data da
-- temporada. Erro de verdade aparece escrito, em vez de "-".
create function pa_teste.escreve(quem text, org text, temporada text, linha_acordos text, linha_pessoas text, data text) returns text language plpgsql as $$
declare
  r text[] := '{}';
  a text;
  p text;
begin
  perform pa_teste.como(quem);
  a := pa_teste.caminho(org, temporada, 'acordos', 'f9ff');
  p := pa_teste.caminho(org, temporada, 'pessoas', 'f9ff', 'jpg');
  r := array_append(r, pa_teste.efeito(format($c$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'acordos', %L, 'novo.pdf', 'application/pdf', 10, repeat('a', 64))$c$, pa_teste.id(org), pa_teste.id(temporada), a)));
  r := array_append(r, pa_teste.efeito(format($c$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'pessoas', %L, 'novo.jpg', 'image/jpeg', 10, repeat('a', 64))$c$, pa_teste.id(org), pa_teste.id(temporada), p)));
  r := array_append(r, pa_teste.efeito(format($c$update public.producao_arquivos set nome = 'outro.pdf' where id = %L$c$, pa_teste.id(linha_acordos))));
  r := array_append(r, pa_teste.efeito(format($c$update public.producao_arquivos set nome = 'outro.jpg' where id = %L$c$, pa_teste.id(linha_pessoas))));
  r := array_append(r, pa_teste.efeito(format($c$update public.producao_arquivos set data_id = %L where id = %L$c$, pa_teste.id(data), pa_teste.id(linha_acordos))));
  perform pa_teste.volta();
  return array_to_string(array(select case x when 'sim' then 'ok' when '' then '-' else x end from unnest(r) as x), ',');
end;
$$;
grant execute on function pa_teste.escreve(text, text, text, text, text, text) to authenticated, anon;

select is(pa_teste.escreve('a1', 'a0', '2a', 'd101', 'd102', '3a'), 'ok,ok,ok,ok,ok', 'admin: cria, renomeia e liga a uma data, na pasta comum e na de pessoas');
select is(pa_teste.escreve('a2', 'a0', '2a', 'd101', 'd102', '3a'), 'ok,-,ok,-,ok', 'colaborador sem o dinheiro: escreve na pasta comum e nada na de pessoas (nem enxerga a linha para renomear)');
select is(pa_teste.escreve('a8', 'a0', '2a', 'd101', 'd102', '3a'), 'ok,ok,ok,ok,ok', 'colaborador que vê o dinheiro: escreve nas duas pastas');
select is(pa_teste.escreve('a3', 'a0', '2a', 'd101', 'd102', '3a'), '-,-,-,-,-', 'leitor: não escreve nada');
select is(pa_teste.escreve('a9', 'a0', '2a', 'd101', 'd102', '3a'), '-,-,-,-,-', 'leitor que vê o dinheiro: lê a pasta de pessoas e não escreve nela');
select is(pa_teste.escreve('a4', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('a5', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('a7', 'a0', '2a', 'd101', 'd102', '3a'),
          '-,-,-,-,--,-,-,-,--,-,-,-,-', 'só a captação, captador e proponente: nada');
select is(pa_teste.escreve('a6', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('aa', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('ab', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('ac', 'a0', '2a', 'd101', 'd102', '3a'),
          '-,-,-,-,--,-,-,-,--,-,-,-,--,-,-,-,-', 'o recorte "vinculado" (falha fechado) e quem tem só a prestação: nada');
select is(pa_teste.escreve('b1', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('d1', 'a0', '2a', 'd101', 'd102', '3a') || pa_teste.escreve('e2', 'a0', '2a', 'd101', 'd102', '3a'),
          '-,-,-,-,--,-,-,-,--,-,-,-,-', 'o admin de outra organização, o de uma sem a produção e quem é de fora: nada em A');
select is(pa_teste.escreve('d1', 'd0', '2d', 'd108', 'd108', '3d'), '-,-,-,-,-', 'o admin de uma organização sem a produção: nada nem na dele');
select is(pa_teste.escreve('e1', 'a0', '2a', 'd101', 'd102', '3a'), 'ok,ok,ok,ok,ok', 'super admin: escreve em A');
select is(pa_teste.escreve(null, 'a0', '2a', 'd101', 'd102', '3a'), '-,-,-,-,-', 'visitante: nada');
select is(pa_teste.escreve('c1', 'c0', '2c', 'd106', 'd107', '3c') || pa_teste.escreve('c3', 'c0', '2c', 'd106', 'd107', '3c') || pa_teste.escreve('c5', 'c0', '2c', 'd106', 'd107', '3c') || pa_teste.escreve('c6', 'c0', '2c', 'd106', 'd107', '3c'),
          '-,-,-,-,--,-,-,-,--,-,-,-,--,-,-,-,-', 'produção só para leitura (a cortesia acabou): nem o admin nem quem vê o dinheiro escrevem');
select is(pa_teste.escreve('e1', 'c0', '2c', 'd106', 'd107', '3c'), 'ok,ok,ok,ok,ok', 'super admin: escreve até na produção só para leitura, como em todas as tabelas da produção');

-- ─── A forma dos dados e a coerência ao inserir ──────────────────────────────

-- Tenta inserir uma linha de A (temporada 2a, pasta acordos) e devolve o resultado de pa_teste.tenta. Cada parâmetro
-- troca uma parte: o caminho (null = o que bate com a linha), a data, quem enviou ('omitido' = deixa o padrão,
-- 'nulo', ou o sufixo de uma pessoa) e quem insere (null = o dono do banco, que passa pelas regras).
create function pa_teste.insere(
  p_org text default 'a0', p_temporada text default '2a', p_pasta text default 'acordos', p_caminho text default null,
  p_nome text default 'novo.pdf', p_tipo text default 'application/pdf', p_tamanho bigint default 10, p_sha text default null,
  p_data text default null, p_enviado text default 'omitido', p_quem text default null) returns text language plpgsql as $$
begin
  return pa_teste.tenta(format($c$insert into public.producao_arquivos (organization_id, temporada_id, data_id, pasta, storage_path, nome, tipo, tamanho, sha256%s) values (%L, %L, %L, %L, %L, %L, %L, %s, %L%s)$c$,
    case when p_enviado = 'omitido' then '' else ', enviado_por' end,
    pa_teste.id(p_org), pa_teste.id(p_temporada), case when p_data is null then null else pa_teste.id(p_data) end, p_pasta,
    coalesce(p_caminho, pa_teste.caminho(p_org, p_temporada, p_pasta, 'f9ff')), p_nome, p_tipo, p_tamanho, coalesce(p_sha, repeat('a', 64)),
    case p_enviado when 'omitido' then '' when 'nulo' then ', null' else ', ' || quote_literal(pa_teste.id(p_enviado)) end), p_quem);
end;
$$;
grant execute on function pa_teste.insere(text, text, text, text, text, text, bigint, text, text, text, text) to authenticated, anon;

select is(pa_teste.insere(), 'aceito', 'a linha completa e coerente passa');
select is(pa_teste.insere(p_caminho => 'qualquer coisa'), '23514 caminho_invalido', 'o caminho tem de ter a forma do bucket');
select is(pa_teste.insere(p_caminho => pa_teste.caminho('a0', '2a', 'acordos', 'f9ff', 'exe')), '23514 caminho_invalido', 'a extensão tem de ser uma das aceitas');
select is(pa_teste.insere(p_caminho => pa_teste.caminho('b0', '2a', 'acordos', 'f9ff')), '23514 caminho_de_outra_organizacao', 'o caminho tem de ser da organização da linha');
select is(pa_teste.insere(p_caminho => pa_teste.caminho('a0', '2e', 'acordos', 'f9ff')), '23514 caminho_de_outra_temporada', 'o caminho tem de ser da temporada da linha');
select is(pa_teste.insere(p_caminho => pa_teste.caminho('a0', '2a', 'plantas', 'f9ff')), '23514 caminho_de_outra_pasta', 'o caminho tem de ser da pasta da linha');
select is(pa_teste.insere(p_caminho => pa_teste.caminho('a0', '2a', 'acordos', 'f101')), '23505 producao_arquivos_storage_path_key', 'o caminho de um arquivo que já tem linha não se repete');
select is(pa_teste.insere(p_temporada => '2b'), '23514 temporada_de_outra_organizacao', 'a temporada de outra organização é recusada');
select is(pa_teste.insere(p_temporada => 'ee'), '23514 temporada_de_outra_organizacao', 'a temporada que não existe é recusada com a mesma resposta');
select is(pa_teste.insere(p_data => '3b'), '23514 data_de_outra_organizacao', 'a data de outra organização é recusada');
select is(pa_teste.insere(p_data => '3e'), '23514 data_de_outra_temporada', 'a data de outra temporada da mesma organização é recusada');
select is(pa_teste.insere(p_data => '3a'), 'aceito', 'a data da mesma temporada passa');
select is(pa_teste.insere(p_enviado => 'a1'), 'aceito', 'o dono do banco, a chave de serviço ou uma rotina dizem quem enviou');
select is(pa_teste.insere(p_enviado => 'nulo'), 'aceito', 'e podem deixar sem autor');
select is(pa_teste.insere(p_quem => 'a2'), 'aceito', 'quem está logado é o autor: o padrão do campo é auth.uid()');
select is(pa_teste.insere(p_quem => 'a2', p_enviado => 'a1'), '23514 enviado_por_invalido', 'quem está logado não envia em nome de outra pessoa');
select is(pa_teste.insere(p_quem => 'a2', p_enviado => 'nulo'), '23514 enviado_por_invalido', 'nem se esconde como autor');
select is(pa_teste.insere(p_nome => '   '), '23514 producao_arquivos_nome_check', 'o nome não pode ser vazio');
select is(pa_teste.insere(p_nome => repeat('n', 256)), '23514 producao_arquivos_nome_check', 'o nome tem até 255 letras');
select is(pa_teste.insere(p_nome => repeat('n', 255)), 'aceito', 'com 255 letras passa');
select is(pa_teste.insere(p_nome => '../x.pdf'), '23514 producao_arquivos_nome_check', 'o nome não leva barra');
select is(pa_teste.insere(p_nome => 'a' || chr(92) || 'b.pdf'), '23514 producao_arquivos_nome_check', 'nem barra invertida');
select is(pa_teste.insere(p_nome => 'a' || chr(10) || 'b.pdf'), '23514 producao_arquivos_nome_check', 'nem quebra de linha ou outro caractere de controle');
select is(pa_teste.insere(p_nome => 'Relatório João 2026 (final).pdf'), 'aceito', 'o nome com acento, espaço e parênteses passa');
select is(pa_teste.insere(p_tipo => 'pdf'), '23514 producao_arquivos_tipo_check', 'o tipo é MIME: tipo/subtipo');
select is(pa_teste.insere(p_tipo => 'Application/PDF'), '23514 producao_arquivos_tipo_check', 'em minúsculas');
select is(pa_teste.insere(p_tipo => 'a/b/c'), '23514 producao_arquivos_tipo_check', 'com uma barra só');
select is(pa_teste.insere(p_tipo => ''), '23514 producao_arquivos_tipo_check', 'e não vazio');
select is(pa_teste.insere(p_tipo => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'aceito', 'o tipo comprido do Word passa');
select is(pa_teste.insere(p_tipo => 'application/octet-stream'), 'aceito', 'o tipo genérico passa');
select is(pa_teste.insere(p_tamanho => 0), '23514 producao_arquivos_tamanho_check', 'o tamanho é maior que zero');
select is(pa_teste.insere(p_tamanho => -1), '23514 producao_arquivos_tamanho_check', 'e nunca negativo');
select is(pa_teste.insere(p_sha => 'abc'), '23514 producao_arquivos_sha256_check', 'a impressão digital tem 64 dígitos hexadecimais');
select is(pa_teste.insere(p_sha => repeat('A', 64)), '23514 producao_arquivos_sha256_check', 'em minúsculas');
select is(pa_teste.insere(p_sha => repeat('a', 63)), '23514 producao_arquivos_sha256_check', 'nem um a menos');
select is(pa_teste.tenta($t$set constraints all immediate$t$ || '; ' || $t$alter table public.producao_arquivos disable trigger producao_arquivos_coerencia$t$ || '; ' ||
          format($t$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'financeiro', %L, 'x.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                 pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'))),
          '23514 producao_arquivos_pasta_check', 'sem o gatilho, a restrição ainda recusa a pasta que não é uma das nove');
select is(pa_teste.tenta($t$set constraints all immediate$t$ || '; ' || $t$alter table public.producao_arquivos disable trigger producao_arquivos_coerencia$t$ || '; ' ||
          format($t$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'acordos', 'qualquer coisa', 'x.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                 pa_teste.id('a0'), pa_teste.id('2a'))),
          '23514 producao_arquivos_storage_path_check', 'sem o gatilho, a restrição ainda recusa o caminho que não tem a forma do bucket');

-- ─── A coerência ao alterar ──────────────────────────────────────────────────

-- Só o nome e a data mudam. O dono do banco também esbarra nas travas (a chave de serviço não as burla).
select is(pa_teste.tenta(format($t$update public.producao_arquivos set organization_id = %L where id = %L$t$, pa_teste.id('b0'), pa_teste.id('d101'))), '23514 organizacao_nao_muda', 'o arquivo não muda de organização');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set temporada_id = %L where id = %L$t$, pa_teste.id('2e'), pa_teste.id('d101'))), '23514 temporada_do_arquivo_nao_muda', 'nem de temporada');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set pasta = 'plantas' where id = %L$t$, pa_teste.id('d101'))), '23514 arquivo_nao_muda', 'nem de pasta');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set storage_path = %L where id = %L$t$, pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'), pa_teste.id('d101'))), '23514 arquivo_nao_muda', 'nem de caminho');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set tipo = 'text/plain' where id = %L$t$, pa_teste.id('d101'))), '23514 arquivo_nao_muda', 'nem de tipo');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set tamanho = 5 where id = %L$t$, pa_teste.id('d101'))), '23514 arquivo_nao_muda', 'nem de tamanho');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set sha256 = repeat('9', 64) where id = %L$t$, pa_teste.id('d101'))), '23514 arquivo_nao_muda', 'nem de impressão digital');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set enviado_por = %L where id = %L$t$, pa_teste.id('a2'), pa_teste.id('d101'))), '23514 enviado_por_nao_muda', 'quem enviou não vira outra pessoa');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set enviado_por = null where id = %L$t$, pa_teste.id('d101'))), 'aceito', 'mas pode sumir (a conta foi apagada)');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set nome = 'Contrato assinado.pdf' where id = %L$t$, pa_teste.id('d101'))), 'aceito', 'o nome muda');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set data_id = %L where id = %L$t$, pa_teste.id('3a'), pa_teste.id('d101'))), 'aceito', 'a data muda, para uma da mesma temporada');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set data_id = null where id = %L$t$, pa_teste.id('d103'))), 'aceito', 'e o arquivo se solta da data');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set data_id = %L where id = %L$t$, pa_teste.id('3e'), pa_teste.id('d101'))), '23514 data_de_outra_temporada', 'a data de outra temporada é recusada');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set data_id = %L where id = %L$t$, pa_teste.id('3b'), pa_teste.id('d101'))), '23514 data_de_outra_organizacao', 'a data de outra organização também');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set nome = nome, updated_at = '2020-01-01' where id = %L$t$, pa_teste.id('d101')) || '; ' ||
                         format($t$select 1 / (case when (select updated_at from public.producao_arquivos where id = %L) > '2020-01-01' then 1 else 0 end)$t$, pa_teste.id('d101'))),
          'aceito', 'alterar atualiza o updated_at');
select pa_teste.como('a2');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set tipo = 'text/plain' where id = %L$t$, pa_teste.id('d101'))),
          '42501 permission denied for table producao_arquivos', 'o colaborador não altera o tipo: o privilégio de alterar é só do nome e da data');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set storage_path = %L where id = %L$t$, pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'), pa_teste.id('d101'))),
          '42501 permission denied for table producao_arquivos', 'nem o caminho');
select is(pa_teste.tenta(format($t$update public.producao_arquivos set enviado_por = %L where id = %L$t$, pa_teste.id('a2'), pa_teste.id('d101'))),
          '42501 permission denied for table producao_arquivos', 'nem quem enviou');
select pa_teste.volta();

-- ─── O histórico dos arquivos ────────────────────────────────────────────────

-- Quantas linhas do histórico dos arquivos a pessoa lê. A regra do histórico acompanha a da linha do arquivo:
-- quem não lê o arquivo (a pasta de pessoas, sem o dinheiro) não lê a história dele.
create function pa_teste.historico_visto(quem text) returns text language plpgsql as $$
declare
  r text;
begin
  perform pa_teste.como(quem);
  select count(*)::text into r from public.producao_historico where entidade = 'producao_arquivos';
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.historico_visto(text) to authenticated, anon;

select is((select count(*)::text || ' ' || count(quem) || ' ' || string_agg(depois, ',' order by depois) from public.producao_historico where entidade = 'producao_arquivos' and acao = 'criou'),
          '8 0 acordos,acordos,acordos,acordos,acordos,pessoas,pessoas,plantas',
          'cada arquivo do cenário deixou uma linha "criou", com a pasta no rótulo e sem autor (o dono do banco não tem usuário)');
select is((select count(*)::int from public.producao_historico where entidade = 'producao_arquivos' and (antes ~ 'SEGREDO' or depois ~ 'SEGREDO' or campo = 'nome')),
          0, 'o nome do arquivo (na pasta pessoas, o de uma pessoa) não aparece no histórico');
select is(pa_teste.depois('a2',
            array[format($t$insert into public.producao_arquivos (id, organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, %L, 'acordos', %L, 'Rider.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                         pa_teste.id('d1ff'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'))],
            'a2',
            format($t$select acao || '/' || coalesce(campo, '-') || '/' || coalesce(antes, '-') || '/' || coalesce(depois, '-') || '/' || (quem = %L)::text from public.producao_historico where entidade = 'producao_arquivos' and entidade_id = %L$t$, pa_teste.id('a2'), pa_teste.id('d1ff'))),
          'criou/-/-/acordos/true', 'enviar um arquivo deixa uma linha só, com a pasta no rótulo e quem enviou; quem lê o arquivo lê a história dele');
select is(pa_teste.depois('a2',
            array[format($t$update public.producao_arquivos set nome = 'Outro nome.pdf' where id = %L$t$, pa_teste.id('d101'))],
            'a2',
            format($t$select count(*) from public.producao_historico where entidade_id = %L and acao = 'alterou'$t$, pa_teste.id('d101'))),
          '0', 'renomear não deixa linha: o nome está fora do histórico (e o updated_at, que muda a cada gravação, não é história)');
select is(pa_teste.depois('a2',
            array[format($t$update public.producao_arquivos set data_id = %L where id = %L$t$, pa_teste.id('3a'), pa_teste.id('d101'))],
            'a2',
            format($t$select acao || '/' || campo || '/' || coalesce(antes, '-') || '/' || coalesce(depois, '-') from public.producao_historico where entidade_id = %L and acao = 'alterou'$t$, pa_teste.id('d101'))),
          'alterou/data_id/-/' || pa_teste.id('3a')::text, 'ligar o arquivo a uma data fica no histórico, de onde para onde');
select is(pa_teste.depois('a2',
            array[format($t$update public.producao_arquivos set data_id = null where id = %L$t$, pa_teste.id('d103'))],
            'a2',
            format($t$select acao || '/' || campo || '/' || coalesce(antes, '-') || '/' || coalesce(depois, '-') from public.producao_historico where entidade_id = %L and acao = 'alterou'$t$, pa_teste.id('d103'))),
          'alterou/data_id/' || pa_teste.id('3a')::text || '/-', 'soltar o arquivo da data também');
select is(pa_teste.depois('a8',
            array[format($t$insert into public.producao_arquivos (id, organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, %L, 'pessoas', %L, 'Passaporte SEGREDO-2.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                         pa_teste.id('d1fe'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'pessoas', 'f9fe')),
                  format($t$update public.producao_arquivos set nome = 'Passaporte SEGREDO-3.pdf' where id = %L$t$, pa_teste.id('d1fe'))],
            null,
            format($t$select count(*) || ' ' || (select count(*) from public.producao_historico where antes ~ 'SEGREDO' or depois ~ 'SEGREDO' or campo = 'nome') from public.producao_historico where entidade_id = %L$t$, pa_teste.id('d1fe'))),
          '1 0', 'o arquivo da pasta de pessoas, enviado e renomeado: uma linha só (criou), e o nome dele não está em lugar nenhum do histórico');
select is(pa_teste.historico_visto('a1') || ',' || pa_teste.historico_visto('a8') || ',' || pa_teste.historico_visto('a9') || ',' || pa_teste.historico_visto('e1'), '4,4,4,8',
          'o admin e quem vê o dinheiro leem a história dos quatro arquivos de A, a de pessoas inclusive; o super admin, a das quatro organizações');
select is(pa_teste.historico_visto('a2') || ',' || pa_teste.historico_visto('a3'), '3,3', 'o colaborador e o leitor sem o dinheiro leem a história dos arquivos de A, menos a da pasta de pessoas');
select is(pa_teste.historico_visto('a4') || ',' || pa_teste.historico_visto('a5') || ',' || pa_teste.historico_visto('a6') || ',' || pa_teste.historico_visto('a7') || ',' || pa_teste.historico_visto('aa') || ',' || pa_teste.historico_visto('d1') || ',' || pa_teste.historico_visto('e2'),
          '0,0,0,0,0,0,0', 'sem a produção, captador, recorte "vinculado", proponente, prestação, organização sem a produção e quem é de fora: nada');
select is(pa_teste.historico_visto('b1') || ',' || pa_teste.historico_visto('c1') || ',' || pa_teste.historico_visto('c3') || ',' || pa_teste.historico_visto('c5'), '1,2,1,2',
          'cada organização lê a sua; com a produção só para leitura, o admin e quem vê o dinheiro leem a história das duas pastas e o leitor sem o dinheiro só a da comum');
select pa_teste.como('a1');
select is(public.auth_producao_ve_historico(pa_teste.id('a0'), 'producao_arquivos', pa_teste.id('d101')), true, 'a função da regra: o admin vê o histórico do arquivo');
select is(public.auth_producao_ve_historico(pa_teste.id('a0'), 'producao_arquivos', pa_teste.id('f0f0')), false, 'e o de um arquivo que não existe, não');
select is(public.auth_producao_ve_historico(pa_teste.id('b0'), 'producao_arquivos', pa_teste.id('d101')), false, 'nem com a organização trocada');
select pa_teste.volta();
select pa_teste.como('a2');
select is(public.auth_producao_ve_historico(pa_teste.id('a0'), 'producao_arquivos', pa_teste.id('d102')), false, 'o colaborador sem o dinheiro não vê o histórico do arquivo da pasta de pessoas');
select pa_teste.volta();

-- ─── O bucket: quem lê, envia e troca em producoes/ ──────────────────────────

-- pa_teste.ops_producao(pessoa, organização, temporada, arquivo da pasta acordos, arquivo da pasta pessoas) devolve o que a
-- pessoa faz com os dois objetos, "acordos / pessoas", cada um com le (select), envia (insere um irmão dele) e troca (update).
-- O apagar fica na seção Apagar. Antes das regras novas, todo membro da organização fazia tudo isto em producoes/.
select is(pa_teste.ops_producao('a1', 'a0', '2a', 'f101', 'f102'), 'le,envia,troca / le,envia,troca', 'admin: lê, envia e troca, na pasta comum e na de pessoas');
select is(pa_teste.ops_producao('a2', 'a0', '2a', 'f101', 'f102'), 'le,envia,troca / ', 'colaborador sem o dinheiro: mexe na pasta comum e em nada na de pessoas');
select is(pa_teste.ops_producao('a8', 'a0', '2a', 'f101', 'f102'), 'le,envia,troca / le,envia,troca', 'colaborador que vê o dinheiro: mexe nas duas pastas');
select is(pa_teste.ops_producao('a3', 'a0', '2a', 'f101', 'f102'), 'le / ', 'leitor sem o dinheiro: lê a pasta comum, não escreve, e nada na de pessoas');
select is(pa_teste.ops_producao('a9', 'a0', '2a', 'f101', 'f102'), 'le / le', 'leitor que vê o dinheiro: lê as duas pastas e não escreve em nenhuma');
select is(pa_teste.ops_producao('a4', 'a0', '2a', 'f101', 'f102'), ' / ', 'colaborador só com a captação: nada (hoje, antes das regras novas, ele lê, envia, troca e apaga)');
select is(pa_teste.ops_producao('aa', 'a0', '2a', 'f101', 'f102') || pa_teste.ops_producao('ab', 'a0', '2a', 'f101', 'f102') || pa_teste.ops_producao('ac', 'a0', '2a', 'f101', 'f102'),
          ' /  /  / ', 'quem tem só a prestação (colaborador, leitor, e com a captação): nada');
select is(pa_teste.ops_producao('a5', 'a0', '2a', 'f101', 'f102') || pa_teste.ops_producao('a7', 'a0', '2a', 'f101', 'f102'), ' /  / ',
          'captador (mesmo com a produção no vínculo) e proponente: nada');
select is(pa_teste.ops_producao('a6', 'a0', '2a', 'f101', 'f102'), ' / ', 'recorte "só onde está vinculado": falha fechado, nada até a PD1.9');
select is(pa_teste.ops_producao('b1', 'a0', '2a', 'f101', 'f102') || pa_teste.ops_producao('d1', 'a0', '2a', 'f101', 'f102') || pa_teste.ops_producao('e2', 'a0', '2a', 'f101', 'f102'),
          ' /  /  / ', 'o admin de outra organização, o de uma sem a produção e quem é de fora: nada em A');
select is(pa_teste.ops_producao('e1', 'a0', '2a', 'f101', 'f102'), 'le,envia,troca / le,envia,troca', 'super admin: mexe em tudo de A, sem ser da organização');
select is(pa_teste.ops_producao(null, 'a0', '2a', 'f101', 'f102'), ' / ', 'visitante: nada');
select pa_teste.como(null);
select throws_ok($t$select public.auth_producao_arquivo_pode('x', 'ler')$t$, '42501', null, 'visitante: não executa a função do bucket');
select pa_teste.volta();
select is(pa_teste.ops_producao('b1', 'b0', '2b', 'f105', 'f105'), 'le,envia,troca / envia',
          'o admin de B mexe no que é de B (a pasta de pessoas de B só aceita o envio: não há objeto para ler ou trocar)');
select is(pa_teste.ops_producao('d1', 'd0', '2d', 'f108', 'f108'), ' / ', 'o admin de uma organização sem a produção: nada nem na dele');
select is(pa_teste.ops_producao('c1', 'c0', '2c', 'f106', 'f107'), 'le / le', 'produção só para leitura, admin: lê as duas pastas e não escreve');
select is(pa_teste.ops_producao('c3', 'c0', '2c', 'f106', 'f107'), 'le / ', 'produção só para leitura, leitor sem o dinheiro: lê a pasta comum e nada na de pessoas');
select is(pa_teste.ops_producao('c5', 'c0', '2c', 'f106', 'f107') || pa_teste.ops_producao('c6', 'c0', '2c', 'f106', 'f107'), 'le / lele / le',
          'produção só para leitura, quem vê o dinheiro: lê as duas pastas e não escreve');
select is(pa_teste.ops_producao('c4', 'c0', '2c', 'f106', 'f107'), ' / ', 'produção só para leitura, quem não tinha o módulo: nada');
select is(pa_teste.ops_producao('e1', 'c0', '2c', 'f106', 'f107'), 'le,envia,troca / le,envia,troca', 'super admin: mexe até na produção só para leitura');
select is(pa_teste.ops_producao('a1', 'b0', '2a', 'f101', 'f102'), ' / ', 'o caminho tem de ser da organização do admin: o de A com a organização de B no lugar não é de ninguém');

-- Caminho dentro de producoes/ que não tem a forma do bucket: ninguém envia, nem o admin nem o super admin.
create function pa_teste.mal_formados(quem text) returns text language plpgsql as $$
declare
  o text := pa_teste.id('a0')::text;
  t text := pa_teste.id('2a')::text;
  u text := pa_teste.id('f9ff')::text;
  nome text;
  r text := '';
begin
  perform pa_teste.como(quem);
  foreach nome in array array[
    o || '/producoes/x.pdf', o || '/producoes/' || t || '/financeiro/' || u || '.pdf', o || '/producoes/' || t || '/acordos/' || u || '.html',
    o || '/producoes/' || t || '/acordos/../pessoas/' || u || '.pdf', o || '/producoes/' || t || '/acordos/sub/' || u || '.pdf',
    o || '/producoes/' || t || '/acordos/' || u, o || '/producoes/' || t || '/Acordos/' || u || '.pdf', upper(o) || '/producoes/' || t || '/acordos/' || u || '.pdf',
    o || '/producoes/' || t || '/acordos/' || u || '.pdf/'] loop
    r := r || pa_teste.efeito(format($c$insert into storage.objects (bucket_id, name) values ('documentos', %L)$c$, nome));
  end loop;
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.mal_formados(text) to authenticated, anon;

select is(pa_teste.mal_formados('a1') || pa_teste.mal_formados('e1'), '', 'caminho de producoes/ fora da forma (pasta desconhecida, extensão fora da lista, subir de pasta, segmento a mais, maiúscula): ninguém envia, nem o admin nem o super admin');

-- ─── O bucket: o que não é de producoes/ segue como antes ────────────────────

-- Os arquivos que não são de producoes/ (a prestação, os fornecedores, os outros da organização e os nomes que parecem com producoes/) respondem
-- como antes das regras novas, para quem tem e para quem não tem a produção. G1 a G17 são os objetos do cenário que o provam.

-- Uma prestação e um fornecedor de A, para a prestação e os fornecedores terem o que proteger no bucket, e os objetos G1 a G17.
do $prestacao$
begin
  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por)
  values (pa_teste.id('51'), 'PA prestação A', pa_teste.id('a0'), pa_teste.id('a1'));
  insert into public.prestacao_fornecedores (id, organization_id, tipo_pessoa, documento, nome)
  values (pa_teste.id('52'), pa_teste.id('a0'), 'pj', '11222333000181', 'PA fornecedor');
end
$prestacao$;

-- Os 17 nomes que NÃO são de producoes/ (G1 a G17): a prestação, os fornecedores, os outros arquivos da organização e
-- variações que parecem com producoes/. pa_teste.g(n) devolve o Gn.
create or replace function pa_teste.nomes_g() returns text[] language sql immutable as $$
  select array[
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/comprovantes/' || pa_teste.id('f201') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/envio/' || pa_teste.id('f202') || '.pdf',
    pa_teste.id('a0')::text || '/fornecedores/' || pa_teste.id('52') || '/' || pa_teste.id('f203') || '.pdf',
    pa_teste.id('a0')::text || '/outros/' || pa_teste.id('f204') || '.pdf',
    pa_teste.id('a0')::text || '/contratos/' || pa_teste.id('f2a1') || '/' || pa_teste.id('f205') || '.pdf',
    pa_teste.id('a0')::text || '/entregas/' || pa_teste.id('f2a2') || '/' || pa_teste.id('f206') || '.pdf',
    pa_teste.id('a0')::text || '/producao/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f207') || '.pdf',
    pa_teste.id('a0')::text || '/Producoes/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f208') || '.pdf',
    pa_teste.id('a0')::text || '/x/producoes/' || pa_teste.id('f209') || '.pdf',
    pa_teste.id('a0')::text || '/producoes',
    pa_teste.id('b0')::text || '/prestacoes/' || pa_teste.id('53') || '/comprovantes/' || pa_teste.id('f211') || '.pdf',
    'prestacoes/' || pa_teste.id('51') || '/' || pa_teste.id('f212') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/producoes/' || pa_teste.id('f213') || '.pdf',
    pa_teste.id('a0')::text || '/' || pa_teste.id('f214') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/atividades/' || pa_teste.id('f2a3') || '/' || pa_teste.id('f215') || '.jpg',
    pa_teste.id('a0')::text || '/fornecedores/' || pa_teste.id('52') || '/producoes/' || pa_teste.id('f216') || '.pdf',
    pa_teste.id('a0')::text || '/producoes-extra/' || pa_teste.id('f217') || '.pdf'
  ];
$$;
create or replace function pa_teste.g(n integer) returns text language sql immutable as $$ select (pa_teste.nomes_g())[n]; $$;

-- G1 a G17: nada disto é de producoes.
insert into storage.objects (bucket_id, name, owner) select 'documentos', n, pa_teste.id('a1') from unnest(pa_teste.nomes_g()) as n;


-- As pastas de fora de producoes/ respondem como antes, para quem tem e para quem não tem a produção: nada disto é novo.
-- (pa_teste.ops_de(pessoa, nome) é o que a pessoa faz com o objeto: le, envia, troca. pa_teste.g(n) é o nome Gn do cenário.)
create function pa_teste.ops_de(quem text, nome text) returns text language plpgsql as $$
declare
  r text;
begin
  perform pa_teste.como(quem);
  r := pa_teste.ops(nome);
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.ops_de(text, text) to authenticated, anon;

select is(pa_teste.ops_de('a4', pa_teste.g(4)) || '/' || pa_teste.ops_de('a4', pa_teste.g(5)) || '/' || pa_teste.ops_de('a4', pa_teste.g(6)),
          'le,envia,troca/le,envia,troca/le,envia,troca', 'os arquivos da organização fora de producoes/ (outros, contratos, entregas) seguem abertos a todo membro, como antes');
select is(pa_teste.ops_de('a4', pa_teste.g(7)) || '/' || pa_teste.ops_de('a4', pa_teste.g(8)) || '/' || pa_teste.ops_de('a4', pa_teste.g(9)) || '/' || pa_teste.ops_de('a4', pa_teste.g(10)) || '/' || pa_teste.ops_de('a4', pa_teste.g(17)),
          'le,envia,troca/le,envia,troca/le,envia,troca/le,envia,troca/le,envia,troca',
          'os nomes que parecem com producoes/ (producao, Producoes, x/producoes, o objeto {org}/producoes, producoes-extra) não são dela: seguem como antes');
select is(pa_teste.ops_de('a4', pa_teste.g(1)) || '/' || pa_teste.ops_de('a4', pa_teste.g(2)) || '/' || pa_teste.ops_de('a4', pa_teste.g(3)) || '/' || pa_teste.ops_de('a4', pa_teste.g(13)),
          '///', 'a prestação e os fornecedores seguem fechados a quem não tem o módulo da prestação');
select is(pa_teste.ops_de('aa', pa_teste.g(1)) || '/' || pa_teste.ops_de('aa', pa_teste.g(2)) || '/' || pa_teste.ops_de('aa', pa_teste.g(3)) || '/' || pa_teste.ops_de('aa', pa_teste.g(15)),
          'le,envia,troca/le,envia,troca/le,envia,troca/le,envia,troca', 'o colaborador da prestação segue lendo e escrevendo nos arquivos da prestação e dos fornecedores, como antes');
select is(pa_teste.ops_de('ab', pa_teste.g(1)) || '/' || pa_teste.ops_de('ab', pa_teste.g(3)),
          'le/le', 'o leitor da prestação segue só lendo');
select is(pa_teste.ops_de('a2', pa_teste.g(1)) || '/' || pa_teste.ops_de('a2', pa_teste.g(3)) || '/' || pa_teste.ops_de('a2', pa_teste.g(4)),
          '//le,envia,troca', 'quem só tem a produção segue sem a prestação e com os outros arquivos da organização, como antes');
select is(pa_teste.ops_de('a1', pa_teste.g(11)) || '/' || pa_teste.ops_de('a1', pa_teste.g(12)) || '/' || pa_teste.ops_de('e2', pa_teste.g(4)),
          '//', 'a prestação de outra organização, o formato antigo sem organização e quem é de fora: nada, como antes');


-- ─── O bucket: a regra nova não se aplica fora de producoes/ ─────────────────

-- Os 17 nomes G1 a G17 (a mesma função da seção anterior; aqui só a grade usa os nomes, sem objetos).
-- Os 17 nomes que NÃO são de producoes/ (G1 a G17): a prestação, os fornecedores, os outros arquivos da organização e
-- variações que parecem com producoes/. pa_teste.g(n) devolve o Gn.
create or replace function pa_teste.nomes_g() returns text[] language sql immutable as $$
  select array[
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/comprovantes/' || pa_teste.id('f201') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/envio/' || pa_teste.id('f202') || '.pdf',
    pa_teste.id('a0')::text || '/fornecedores/' || pa_teste.id('52') || '/' || pa_teste.id('f203') || '.pdf',
    pa_teste.id('a0')::text || '/outros/' || pa_teste.id('f204') || '.pdf',
    pa_teste.id('a0')::text || '/contratos/' || pa_teste.id('f2a1') || '/' || pa_teste.id('f205') || '.pdf',
    pa_teste.id('a0')::text || '/entregas/' || pa_teste.id('f2a2') || '/' || pa_teste.id('f206') || '.pdf',
    pa_teste.id('a0')::text || '/producao/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f207') || '.pdf',
    pa_teste.id('a0')::text || '/Producoes/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f208') || '.pdf',
    pa_teste.id('a0')::text || '/x/producoes/' || pa_teste.id('f209') || '.pdf',
    pa_teste.id('a0')::text || '/producoes',
    pa_teste.id('b0')::text || '/prestacoes/' || pa_teste.id('53') || '/comprovantes/' || pa_teste.id('f211') || '.pdf',
    'prestacoes/' || pa_teste.id('51') || '/' || pa_teste.id('f212') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/producoes/' || pa_teste.id('f213') || '.pdf',
    pa_teste.id('a0')::text || '/' || pa_teste.id('f214') || '.pdf',
    pa_teste.id('a0')::text || '/prestacoes/' || pa_teste.id('51') || '/atividades/' || pa_teste.id('f2a3') || '/' || pa_teste.id('f215') || '.jpg',
    pa_teste.id('a0')::text || '/fornecedores/' || pa_teste.id('52') || '/producoes/' || pa_teste.id('f216') || '.pdf',
    pa_teste.id('a0')::text || '/producoes-extra/' || pa_teste.id('f217') || '.pdf'
  ];
$$;
create or replace function pa_teste.g(n integer) returns text language sql immutable as $$ select (pa_teste.nomes_g())[n]; $$;

-- A expressão de uma regra nova do bucket, lida de pg_policies e avaliada sobre um objeto (bucket, nome) como a pessoa
-- logada: o que o banco avalia em cada operação, sem precisar de uma linha em storage.objects.
create or replace function pa_teste.avalia(politica text, bucket text, nome text) returns text language plpgsql as $$
declare
  expr text;
  r text;
begin
  select coalesce(qual, with_check) into expr from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = politica;
  if expr is null then return 'sem regra'; end if;
  execute format('select (%s)::text from (select %L::text as bucket_id, %L::text as name) o', expr, bucket, nome) into r;
  return coalesce(r, 'nulo');
exception when others then
  return 'erro ' || sqlstate || ' ' || sqlerrm;
end;
$$;

-- Os nomes que NÃO são de producoes/ (G1 a G17 do cenário, mais variações e outros buckets): a prestação, os fornecedores,
-- os outros arquivos da organização, a raiz parecida (producao, Producoes, producoes-extra), producoes como terceiro ou
-- quarto segmento, o objeto chamado só {org}/producoes, o formato antigo sem organização, nome vazio e nulo.
create table pa_teste.grade_bucket (bucket text, nome text);
insert into pa_teste.grade_bucket
select 'documentos', n from unnest(pa_teste.nomes_g()) as n
union all select 'documentos', ''
union all select 'documentos', null
union all select 'documentos', 'producoes/x.pdf'
union all select 'documentos', '/' || pa_teste.caminho('a0', '2a', 'acordos', 'f101')
union all select 'documentos', 'x/' || pa_teste.caminho('a0', '2a', 'acordos', 'f101')
union all select 'avatars', pa_teste.caminho('a0', '2a', 'acordos', 'f101')
union all select 'avatars', pa_teste.caminho('a0', '2a', 'pessoas', 'f102', 'jpg')
union all select 'logos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')
union all select 'propostas', pa_teste.caminho('a0', '2a', 'pessoas', 'f102', 'jpg');
grant select on pa_teste.grade_bucket to authenticated, anon;

-- Como a pessoa: as quatro regras restritivas dão verdadeiro e as quatro permissivas dão falso em todos os nomes da grade.
create function pa_teste.nao_se_aplica(quem text) returns text language plpgsql as $$
declare
  r text;
begin
  perform pa_teste.como(quem);
  select count(*)::text || ' ' || coalesce(string_agg(x.politica || ' em ' || coalesce(x.nome, '(nulo)') || ': ' || x.resultado, '; ') filter (where x.resultado <> x.esperado), 'ok')
  into r
  from (select p.politica, p.esperado, g.nome, pa_teste.avalia(p.politica, g.bucket, g.nome) as resultado
        from (values ('documentos: producoes restrita (le)', 'true'), ('documentos: producoes restrita (insere)', 'true'),
                     ('documentos: producoes restrita (altera)', 'true'), ('documentos: producoes restrita (apaga)', 'true'),
                     ('documentos: producoes le', 'false'), ('documentos: producoes insere', 'false'),
                     ('documentos: producoes altera', 'false'), ('documentos: producoes apaga', 'false')) as p(politica, esperado)
        cross join pa_teste.grade_bucket g) x;
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.nao_se_aplica(text) to authenticated, anon;

select is((select count(*)::int from pa_teste.grade_bucket), 26, 'a grade tem 26 nomes: 17 do cenário, 5 variações (vazio, nulo, sem organização, barra na frente) e 4 de outros buckets');
select is(pa_teste.nao_se_aplica('a1'), '208 ok', 'admin: as restritivas passam e as permissivas não concedem em nenhum dos 26 nomes (8 regras, 208 conferências)');
select is(pa_teste.nao_se_aplica('a4'), '208 ok', 'colaborador só com a captação: o mesmo');
select is(pa_teste.nao_se_aplica('aa'), '208 ok', 'colaborador só com a prestação: o mesmo');
select is(pa_teste.nao_se_aplica('ab'), '208 ok', 'leitor só com a prestação: o mesmo');
select is(pa_teste.nao_se_aplica('a5'), '208 ok', 'captador: o mesmo');
select is(pa_teste.nao_se_aplica('e1'), '208 ok', 'super admin: o mesmo');
select is(pa_teste.nao_se_aplica('e2'), '208 ok', 'quem é de fora: o mesmo');
-- E nos nomes de producoes/ a regra se aplica: o mesmo olhar mostra a diferença entre quem tem a produção e quem não tem.
select pa_teste.como('a4');
select is(pa_teste.avalia('documentos: producoes restrita (le)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes restrita (insere)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes le', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')),
          'false false false', 'em producoes/, quem só tem a captação: a restritiva barra e a permissiva não concede');
select pa_teste.volta();
select pa_teste.como('a2');
select is(pa_teste.avalia('documentos: producoes restrita (le)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes le', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes restrita (le)', 'documentos', pa_teste.caminho('a0', '2a', 'pessoas', 'f102', 'jpg')) || ' ' ||
          pa_teste.avalia('documentos: producoes insere', 'documentos', pa_teste.caminho('a0', '2a', 'pessoas', 'f9ff', 'jpg')),
          'true true false false', 'em producoes/, o colaborador sem o dinheiro: a pasta comum passa, a de pessoas não (nem para ler nem para enviar)');
select pa_teste.volta();
select pa_teste.como('a3');
select is(pa_teste.avalia('documentos: producoes restrita (le)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes restrita (insere)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f9ff')) || ' ' ||
          pa_teste.avalia('documentos: producoes restrita (altera)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')) || ' ' ||
          pa_teste.avalia('documentos: producoes restrita (apaga)', 'documentos', pa_teste.caminho('a0', '2a', 'acordos', 'f101')),
          'true false false false', 'em producoes/, o leitor: lê e não envia, não troca e não apaga');
select pa_teste.volta();

-- ─── Apagar sem apagar: o que as regras de apagar deixam fazer ───────────────

-- O apagar de verdade está nas duas seções Apagar (que usam DELETE). Esta confere o mesmo sem apagar nada: lê de pg_policies a regra de
-- apagar e a avalia como a pessoa. Na tabela, o DELETE alcança as linhas que passam pela regra de apagar e pelas de leitura; um SELECT com a
-- expressão da regra de apagar no WHERE devolve exatamente essas linhas. No bucket, o DELETE passa quando uma regra permissiva deixa e
-- todas as restritivas deixam; aqui as duas regras novas são avaliadas sobre o nome do objeto.

-- A expressão de uma regra do bucket, lida de pg_policies e avaliada sobre um objeto (bucket, nome) como a pessoa logada. A seção
-- "a regra nova não se aplica" a define igual; as duas usam create or replace, para rodarem em qualquer ordem.
create or replace function pa_teste.avalia(politica text, bucket text, nome text) returns text language plpgsql as $$
declare
  expr text;
  r text;
begin
  select coalesce(qual, with_check) into expr from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = politica;
  if expr is null then return 'sem regra'; end if;
  execute format('select (%s)::text from (select %L::text as bucket_id, %L::text as name) o', expr, bucket, nome) into r;
  return coalesce(r, 'nulo');
exception when others then
  return 'erro ' || sqlstate || ' ' || sqlerrm;
end;
$$;

-- As linhas (R1 a R8) que a pessoa apagaria: as que passam pela regra de apagar da tabela, lida de pg_policies, e que ela enxerga.
create function pa_teste.apagaveis(quem text) returns text language plpgsql as $$
declare
  expr text;
  r text;
begin
  select qual into expr from pg_policies where schemaname = 'public' and tablename = 'producao_arquivos' and policyname = 'producao_arquivos: apaga';
  perform pa_teste.como(quem);
  execute format($f$select coalesce(string_agg('R' || right(id::text, 1), ',' order by id), '-') from public.producao_arquivos where %s$f$, expr) into r;
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.apagaveis(text) to authenticated, anon;

-- Para cada nome da lista, "1" se a regra nova permissiva de apagar e a restritiva deixam a pessoa apagar o objeto, "0" se não. Com os caminhos
-- dos oito objetos R1 a R8 (os mesmos das linhas), pa_teste.apagaria_r devolve oito caracteres, um por objeto.
create function pa_teste.apagaria(quem text, nomes text[]) returns text language plpgsql as $$
declare
  nome text;
  r text := '';
begin
  perform pa_teste.como(quem);
  foreach nome in array nomes loop
    r := r || case when pa_teste.avalia('documentos: producoes apaga', 'documentos', nome) = 'true'
                    and pa_teste.avalia('documentos: producoes restrita (apaga)', 'documentos', nome) = 'true' then '1' else '0' end;
  end loop;
  perform pa_teste.volta();
  return r;
end;
$$;
grant execute on function pa_teste.apagaria(text, text[]) to authenticated, anon;

create function pa_teste.apagaria_r(quem text) returns text language sql as $$
  select pa_teste.apagaria(quem, array[pa_teste.caminho('a0', '2a', 'acordos', 'f101'), pa_teste.caminho('a0', '2a', 'pessoas', 'f102', 'jpg'),
                                       pa_teste.caminho('a0', '2a', 'plantas', 'f103'), pa_teste.caminho('a0', '2e', 'acordos', 'f104'),
                                       pa_teste.caminho('b0', '2b', 'acordos', 'f105'), pa_teste.caminho('c0', '2c', 'acordos', 'f106'),
                                       pa_teste.caminho('c0', '2c', 'pessoas', 'f107', 'jpg'), pa_teste.caminho('d0', '2d', 'acordos', 'f108')]);
$$;
grant execute on function pa_teste.apagaria_r(text) to authenticated, anon;

-- No bucket: R1 a R8 na ordem acordos/pessoas/plantas/acordos da 2e (A), acordos de B, acordos e pessoas de C, acordos de D.
select is(pa_teste.apagaria_r('a1'), '11110000', 'bucket, apagar: o admin apaga os quatro de A (as duas pastas), e nada de fora');
select is(pa_teste.apagaria_r('a2'), '10110000', 'bucket, apagar: o colaborador sem o dinheiro apaga da pasta comum e não da de pessoas');
select is(pa_teste.apagaria_r('a8'), '11110000', 'bucket, apagar: o colaborador que vê o dinheiro apaga as duas pastas');
select is(pa_teste.apagaria_r('a3') || pa_teste.apagaria_r('a9'), '0000000000000000', 'bucket, apagar: os dois leitores (com e sem o dinheiro) não apagam');
select is(pa_teste.apagaria_r('a4') || pa_teste.apagaria_r('a5') || pa_teste.apagaria_r('a6') || pa_teste.apagaria_r('a7')
          || pa_teste.apagaria_r('aa') || pa_teste.apagaria_r('ab') || pa_teste.apagaria_r('ac'), repeat('0', 56),
          'bucket, apagar: a captação, o captador, o recorte "vinculado", o proponente e a prestação não apagam nada em producoes/ (antes das regras novas, apagavam)');
select is(pa_teste.apagaria_r('b1'), '00001000', 'bucket, apagar: o admin de B apaga o de B e nada de A');
select is(pa_teste.apagaria_r('c1') || pa_teste.apagaria_r('c5') || pa_teste.apagaria_r('d1') || pa_teste.apagaria_r('e2'), repeat('0', 32),
          'bucket, apagar: a produção só para leitura (admin e quem vê o dinheiro), uma organização sem a produção e quem é de fora não apagam');
select is(pa_teste.apagaria_r('e1'), '11111111', 'bucket, apagar: o super admin apaga em todas as organizações');
select is(pa_teste.apagaria('a1', array[pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('f301') || '.pdf',
                                       pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('2a') || '/financeiro/' || pa_teste.id('f302') || '.pdf',
                                       pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f303') || '.html'])
          || pa_teste.apagaria('e1', array[pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('f301') || '.pdf',
                                          pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('2a') || '/financeiro/' || pa_teste.id('f302') || '.pdf',
                                          pa_teste.id('a0')::text || '/producoes/' || pa_teste.id('2a') || '/acordos/' || pa_teste.id('f303') || '.html']),
          '000000', 'bucket, apagar: nome de producoes/ fora da forma (sem temporada, pasta desconhecida, extensão fora da lista) ninguém apaga, nem o admin nem o super admin');

-- Na tabela: as linhas R1 a R8 que cada pessoa apagaria.
select is(pa_teste.apagaveis('a1'), 'R1,R2,R3,R4', 'tabela, apagar: o admin alcança as quatro linhas de A (as duas pastas)');
select is(pa_teste.apagaveis('a2'), 'R1,R3,R4', 'tabela, apagar: o colaborador sem o dinheiro alcança a pasta comum e não a de pessoas');
select is(pa_teste.apagaveis('a8'), 'R1,R2,R3,R4', 'tabela, apagar: o colaborador que vê o dinheiro alcança as duas pastas');
select is(pa_teste.apagaveis('a3') || pa_teste.apagaveis('a9') || pa_teste.apagaveis('a4') || pa_teste.apagaveis('a6') || pa_teste.apagaveis('a5'), '-----',
          'tabela, apagar: os leitores (com e sem o dinheiro), a captação, o recorte "vinculado" e o captador não alcançam nenhuma linha');
select is(pa_teste.apagaveis('b1'), 'R5', 'tabela, apagar: o admin de B alcança só a linha de B');
select is(pa_teste.apagaveis('c1') || pa_teste.apagaveis('c5') || pa_teste.apagaveis('d1') || pa_teste.apagaveis('e2'), '----',
          'tabela, apagar: a produção só para leitura (admin e quem vê o dinheiro), uma organização sem a produção e quem é de fora não alcançam nenhuma');
select is(pa_teste.apagaveis('e1'), 'R1,R2,R3,R4,R5,R6,R7,R8', 'tabela, apagar: o super admin alcança as oito');

-- ─── Apagar: histórico, temporada, data, organização e conta ─────────────────

-- Estas verificações usam DELETE. O conector do Supabase pode pedir confirmação ou recusá-las: rode as seções Apagar à parte
-- (com o prelúdio, as seções-base e as migrations na frente), ajustando o plan().
-- O histórico de quem apaga: uma linha só, com a pasta no rótulo e quem apagou; o registro apagado deixa de ter histórico legível.
select is(pa_teste.depois('a2', array[format($t$delete from public.producao_arquivos where id = %L$t$, pa_teste.id('d101'))], null,
            format($t$select acao || '/' || coalesce(antes, '-') || '/' || coalesce(depois, '-') || '/' || (quem = %L)::text from public.producao_historico where entidade_id = %L and acao = 'apagou'$t$, pa_teste.id('a2'), pa_teste.id('d101'))),
          'apagou/acordos/-/true', 'apagar um arquivo deixa uma linha só, com a pasta no antes e quem apagou');
select is(pa_teste.depois('a2', array[format($t$delete from public.producao_arquivos where id = %L$t$, pa_teste.id('d101'))], 'a2',
            format($t$select count(*) from public.producao_historico where entidade_id = %L$t$, pa_teste.id('d101'))),
          '0', 'apagado o arquivo, quem o lia deixa de ler a história dele pelo navegador (ela segue guardada)');

-- Temporada e data com arquivo não se apagam; a recusa vem no fim da transação e some quando o arquivo sai antes.
select is(pa_teste.tenta($t$do $x$ begin
            insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values ('0d140000-0000-4000-8000-0000000000e3', '0d140000-0000-4000-8000-0000000000a0', 'circulacao', 'circula', 'teatro', 'PA temporada com arquivo');
            insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256)
              values ('0d140000-0000-4000-8000-0000000000a0', '0d140000-0000-4000-8000-0000000000e3', 'acordos',
                      '0d140000-0000-4000-8000-0000000000a0/producoes/0d140000-0000-4000-8000-0000000000e3/acordos/0d140000-0000-4000-8000-00000000f9ff.pdf', 'x.pdf', 'application/pdf', 10, repeat('a', 64));
            delete from public.producao_temporadas where id = '0d140000-0000-4000-8000-0000000000e3';
          end $x$$t$), '23503 producao_arquivos_temporada_id_fkey', 'a temporada com arquivo não se apaga');
select is(pa_teste.tenta($t$do $x$ begin
            insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values ('0d140000-0000-4000-8000-0000000000e3', '0d140000-0000-4000-8000-0000000000a0', 'circulacao', 'circula', 'teatro', 'PA temporada com arquivo');
            insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256)
              values ('0d140000-0000-4000-8000-0000000000a0', '0d140000-0000-4000-8000-0000000000e3', 'acordos',
                      '0d140000-0000-4000-8000-0000000000a0/producoes/0d140000-0000-4000-8000-0000000000e3/acordos/0d140000-0000-4000-8000-00000000f9ff.pdf', 'x.pdf', 'application/pdf', 10, repeat('a', 64));
            delete from public.producao_temporadas where id = '0d140000-0000-4000-8000-0000000000e3';
            delete from public.producao_arquivos where temporada_id = '0d140000-0000-4000-8000-0000000000e3';
          end $x$$t$), 'aceito', 'a temporada se apaga junto com os arquivos dela, na mesma transação, em qualquer ordem');
select is(pa_teste.tenta(format($t$do $x$ begin
            insert into public.producao_datas (id, organization_id, temporada_id, data) values (%1$L, %2$L, %3$L, date '2026-12-20');
            insert into public.producao_arquivos (organization_id, temporada_id, data_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%2$L, %3$L, %1$L, 'acordos', %4$L, 'x.pdf', 'application/pdf', 10, repeat('a', 64));
            delete from public.producao_datas where id = %1$L;
          end $x$$t$, pa_teste.id('e4'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'))),
          '23503 producao_arquivos_data_id_fkey', 'a data com arquivo não se apaga');
select is(pa_teste.tenta(format($t$do $x$ begin
            insert into public.producao_datas (id, organization_id, temporada_id, data) values (%1$L, %2$L, %3$L, date '2026-12-20');
            insert into public.producao_arquivos (organization_id, temporada_id, data_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%2$L, %3$L, %1$L, 'acordos', %4$L, 'x.pdf', 'application/pdf', 10, repeat('a', 64));
            delete from public.producao_arquivos where data_id = %1$L;
            delete from public.producao_datas where id = %1$L;
          end $x$$t$, pa_teste.id('e4'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'))),
          'aceito', 'a data se apaga depois dos arquivos dela');

-- Apagar a organização inteira (o apagamento de uma organização apaga as filhas em ordem de gatilho, pai antes do filho):
-- os arquivos e o histórico saem com ela, sem travar nas chaves da temporada e da data, e as outras organizações ficam.
select is(pa_teste.depois(null, array[
            format($t$insert into public.organizations (id, nome) values (%L, 'PA organização Z')$t$, pa_teste.id('e0')),
            format($t$insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (%L, %L, 'circulacao', 'circula', 'teatro', 'z')$t$, pa_teste.id('e5'), pa_teste.id('e0')),
            format($t$insert into public.producao_datas (id, organization_id, temporada_id, data) values (%L, %L, %L, '2026-12-01')$t$, pa_teste.id('e6'), pa_teste.id('e0'), pa_teste.id('e5')),
            format($t$insert into public.producao_arquivos (id, organization_id, temporada_id, data_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, %L, %L, 'acordos', %L, 'z.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                   pa_teste.id('d1e0'), pa_teste.id('e0'), pa_teste.id('e5'), pa_teste.id('e6'), pa_teste.caminho('e0', 'e5', 'acordos', 'f9ff')),
            format($t$delete from public.organizations where id = %L$t$, pa_teste.id('e0'))],
            null,
            format($t$select (select count(*) from public.producao_arquivos where organization_id = %1$L) || ' ' || (select count(*) from public.producao_historico where organization_id = %1$L) || ' ' || (select count(*) from public.producao_arquivos where organization_id = %2$L)$t$, pa_teste.id('e0'), pa_teste.id('a0'))),
          '0 0 4', 'apagar a organização inteira, com arquivos e histórico, passa e leva as linhas dela sem mexer nas das outras');
-- Apagar a conta de quem enviou só zera o campo, e a linha e o histórico ficam.
select is(pa_teste.depois(null, array[
            format($t$insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (%L, 'pa-f1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now())$t$, pa_teste.id('f1')),
            format($t$insert into public.producao_arquivos (id, organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256, enviado_por) values (%L, %L, %L, 'acordos', %L, 'x.pdf', 'application/pdf', 10, repeat('a', 64), %L)$t$,
                   pa_teste.id('d1f1'), pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9f1'), pa_teste.id('f1')),
            format($t$delete from auth.users where id = %L$t$, pa_teste.id('f1'))],
            null,
            format($t$select (select (enviado_por is null)::text from public.producao_arquivos where id = %1$L) || ' ' || (select count(*) from public.producao_historico where entidade_id = %1$L)$t$, pa_teste.id('d1f1'))),
          'true 1', 'apagar a conta de quem enviou zera o campo, e a linha e a história (a de "criou") ficam, sem linha nova');

-- ─── Apagar: linhas, objetos e o recorte ─────────────────────────────────────

-- O que a pessoa apaga das duas linhas (acordos e pessoas) e dos dois objetos do bucket, cada um "ok" ou "-".
create function pa_teste.apaga(quem text, org text, temporada text, linha_acordos text, linha_pessoas text, f_acordos text, f_pessoas text) returns text language plpgsql as $$
declare
  r text[] := '{}';
begin
  perform pa_teste.como(quem);
  r := array_append(r, pa_teste.efeito(format($c$delete from public.producao_arquivos where id = %L$c$, pa_teste.id(linha_acordos))));
  r := array_append(r, pa_teste.efeito(format($c$delete from public.producao_arquivos where id = %L$c$, pa_teste.id(linha_pessoas))));
  r := array_append(r, pa_teste.efeito(format($c$delete from storage.objects where bucket_id = 'documentos' and name = %L$c$, pa_teste.caminho(org, temporada, 'acordos', f_acordos))));
  r := array_append(r, pa_teste.efeito(format($c$delete from storage.objects where bucket_id = 'documentos' and name = %L$c$, pa_teste.caminho(org, temporada, 'pessoas', f_pessoas, 'jpg'))));
  perform pa_teste.volta();
  return array_to_string(array(select case x when 'sim' then 'ok' when '' then '-' else x end from unnest(r) as x), ',');
end;
$$;
grant execute on function pa_teste.apaga(text, text, text, text, text, text, text) to authenticated, anon;

select is(pa_teste.apaga('a1', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), 'ok,ok,ok,ok', 'admin: apaga as duas linhas e os dois objetos');
select is(pa_teste.apaga('a2', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), 'ok,-,ok,-', 'colaborador sem o dinheiro: apaga o da pasta comum e nada da de pessoas');
select is(pa_teste.apaga('a8', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), 'ok,ok,ok,ok', 'colaborador que vê o dinheiro: apaga os dois');
select is(pa_teste.apaga('a3', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('a9', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), '-,-,-,--,-,-,-', 'os leitores não apagam nada, nem o que veem');
select is(pa_teste.apaga('a4', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('a5', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('a7', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'),
          '-,-,-,--,-,-,--,-,-,-', 'só a captação, captador e proponente não apagam nada (antes das regras novas, apagavam os objetos)');
select is(pa_teste.apaga('a6', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('aa', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('ab', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('ac', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'),
          '-,-,-,--,-,-,--,-,-,--,-,-,-', 'o recorte "vinculado" e quem tem só a prestação não apagam nada');
select is(pa_teste.apaga('b1', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga('d1', 'a0', '2a', 'd101', 'd102', 'f101', 'f102') || pa_teste.apaga(null, 'a0', '2a', 'd101', 'd102', 'f101', 'f102'),
          '-,-,-,--,-,-,--,-,-,-', 'outra organização, uma sem a produção e o visitante não apagam nada de A');
select is(pa_teste.apaga('e1', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), 'ok,ok,ok,ok', 'super admin: apaga tudo de A');
select is(pa_teste.apaga('c1', 'c0', '2c', 'd106', 'd107', 'f106', 'f107') || pa_teste.apaga('c5', 'c0', '2c', 'd106', 'd107', 'f106', 'f107'), '-,-,-,--,-,-,-',
          'produção só para leitura: nem o admin nem quem vê o dinheiro apagam');
select is(pa_teste.apaga('e1', 'c0', '2c', 'd106', 'd107', 'f106', 'f107'), 'ok,ok,ok,ok', 'super admin: apaga até na produção só para leitura');

-- O recorte por vínculo, no apagar: a6 só apaga o que é da temporada em que está (a troca é a da seção O recorte por vínculo).
create table if not exists pa_teste.vinculos (user_id uuid not null, temporada_id uuid not null);
insert into pa_teste.vinculos select pa_teste.id('a6'), pa_teste.id('2a') where not exists (select 1 from pa_teste.vinculos);

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
                 select 1 from pa_teste.vinculos v where v.user_id = auth.uid() and v.temporada_id = p_temporada_id)))
  );
$$;

select is(pa_teste.apaga('a6', 'a0', '2a', 'd101', 'd102', 'f101', 'f102'), 'ok,-,ok,-', 'vinculado: apaga o que é da temporada dele e da pasta comum (a linha e o objeto)');
select is(pa_teste.apaga('a6', 'a0', '2e', 'd104', 'd104', 'f104', 'f104'), '-,-,-,-', 'vinculado: não apaga nada da temporada de outra pessoa');

-- ─── O recorte por vínculo ───────────────────────────────────────────────────

-- Troca auth_producao_ve_temporada dentro da transação (a PD1.9 fará o mesmo, com producao_vinculos) e liga a6 à temporada 2a. A tabela e o
-- bucket têm de acompanhar sem que ninguém mexa em suas regras. A seção Apagar repete a troca (é idempotente) para provar o apagar.
create table if not exists pa_teste.vinculos (user_id uuid not null, temporada_id uuid not null);
insert into pa_teste.vinculos select pa_teste.id('a6'), pa_teste.id('2a') where not exists (select 1 from pa_teste.vinculos);

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
                 select 1 from pa_teste.vinculos v where v.user_id = auth.uid() and v.temporada_id = p_temporada_id)))
  );
$$;

select is(pa_teste.linhas('a6'), '2 R1,R3', 'vinculado: lê os arquivos da temporada dele (menos a pasta de pessoas, que pede o dinheiro) e nada da outra');
select is(pa_teste.linhas('a1'), '4 R1,R2,R3,R4', 'admin com o registro "vinculado": continua lendo tudo');
select is(pa_teste.linhas('a2'), '3 R1,R3,R4', 'colaborador sem recorte: continua lendo as duas temporadas');
select pa_teste.como('a6');
select is(pa_teste.efeito(format($t$update public.producao_arquivos set nome = 'outro.pdf' where id = %L$t$, pa_teste.id('d101'))), 'sim', 'vinculado: renomeia o arquivo da temporada dele');
select is(pa_teste.efeito(format($t$update public.producao_arquivos set nome = 'outro.pdf' where id = %L$t$, pa_teste.id('d104'))), '', 'vinculado: não renomeia o da temporada de outra pessoa');
select is(pa_teste.efeito(format($t$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'acordos', %L, 'novo.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                                  pa_teste.id('a0'), pa_teste.id('2a'), pa_teste.caminho('a0', '2a', 'acordos', 'f9ff'))), 'sim', 'vinculado: cria arquivo na temporada dele');
select is(pa_teste.efeito(format($t$insert into public.producao_arquivos (organization_id, temporada_id, pasta, storage_path, nome, tipo, tamanho, sha256) values (%L, %L, 'acordos', %L, 'novo.pdf', 'application/pdf', 10, repeat('a', 64))$t$,
                                  pa_teste.id('a0'), pa_teste.id('2e'), pa_teste.caminho('a0', '2e', 'acordos', 'f9ff'))), '', 'vinculado: não cria arquivo na temporada de outra pessoa');
select pa_teste.volta();
select is(pa_teste.ops_producao('a6', 'a0', '2a', 'f101', 'f102'), 'le,envia,troca / ', 'vinculado, no bucket: mexe na pasta comum da temporada dele e em nada na de pessoas');
select is(pa_teste.ops_producao('a6', 'a0', '2e', 'f104', 'f104'), ' / ', 'vinculado, no bucket: não lê, não envia nem troca na temporada de outra pessoa');
select is(pa_teste.ops_producao('a2', 'a0', '2e', 'f104', 'f104'), 'le,envia,troca / ', 'colaborador sem recorte, no bucket: mexe na outra temporada (e na pasta de pessoas dela, sem o dinheiro, em nada)');

select * from finish();
rollback;
