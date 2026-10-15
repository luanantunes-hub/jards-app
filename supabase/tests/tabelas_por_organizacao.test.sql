-- PD0.4b: as tabelas centrais por organização.
--
-- Confere a migration producao_tabelas_por_organizacao: a equipe da organização
-- passa a ler e editar projetos, atividades, negociações, contatos e inscrições
-- dos colegas; captador e proponente seguem só com o que criaram; só o admin
-- apaga o que é de outra pessoa; ninguém grava na organização de outro inquilino;
-- e o super admin não ganha leitura de outras organizações.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A, só com a captação: admin (quem criou as linhas), colaborador,
--     captador, proponente e leitor;
--   organização B, só com a prestação: admin e colaborador, e o super admin como
--     colaborador;
--   organização C, com as duas: admin, colaborador só com a prestação e
--     colaborador com a captação;
--   visitante sem login.
-- Cada organização tem uma linha nas cinco tabelas, criada pelo admin dela.
--
-- As sondas em rls_teste rodam com a permissão de quem está logado e desfazem
-- cada escrita na hora.
--
-- Rodar: supabase/tests/README.md. Com a migration na frente, os testes rodam
-- sobre ela antes de ela ser aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- ─── Cenário ────────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f3000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f3000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f3000000-0000-4000-8000-0000000000c0';
  admin_a uuid := 'f3000000-0000-4000-8000-0000000000a1';
  admin_b uuid := 'f3000000-0000-4000-8000-0000000000b1';
  admin_c uuid := 'f3000000-0000-4000-8000-0000000000c1';
  org uuid;
  admin uuid;
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'ci-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array[
    'f3000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000a2',
    'f3000000-0000-4000-8000-0000000000a3', 'f3000000-0000-4000-8000-0000000000a4',
    'f3000000-0000-4000-8000-0000000000a5', 'f3000000-0000-4000-8000-0000000000b1',
    'f3000000-0000-4000-8000-0000000000b2', 'f3000000-0000-4000-8000-0000000000b3',
    'f3000000-0000-4000-8000-0000000000c1', 'f3000000-0000-4000-8000-0000000000c2',
    'f3000000-0000-4000-8000-0000000000c3'
  ]::uuid[]) as id;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: as sondas olham só A, B e C.

  insert into public.organizations (id, nome) values
    (org_a, 'CI organização A'), (org_b, 'CI organização B'), (org_c, 'CI organização C');
  -- B só com a prestação (a captação sai de modulos_ativos); C com as duas.
  insert into public.organization_modulos (organization_id, modulo, status) values
    (org_b, 'prestacao', 'ativo'), (org_c, 'prestacao', 'ativo');
  perform public.fn_aplicar_modulo_ativo(org_b, 'captacao', false);

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (org_a, admin_a, 'admin', '{captacao}'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a2', 'colaborador', '{captacao}'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a3', 'captador', '{captacao}'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a4', 'proponente', '{captacao}'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a5', 'leitor', '{captacao}'),
    (org_b, admin_b, 'admin', '{prestacao}'),
    (org_b, 'f3000000-0000-4000-8000-0000000000b2', 'colaborador', '{prestacao}'),
    (org_b, 'f3000000-0000-4000-8000-0000000000b3', 'colaborador', '{prestacao}'),
    (org_c, admin_c, 'admin', '{captacao,prestacao}'),
    (org_c, 'f3000000-0000-4000-8000-0000000000c2', 'colaborador', '{prestacao}'),
    (org_c, 'f3000000-0000-4000-8000-0000000000c3', 'colaborador', '{captacao}');
  -- O super admin é o colaborador …00b3 de B.
  update public.profiles set jards_super_admin = true where id = 'f3000000-0000-4000-8000-0000000000b3';

  -- Uma linha em cada tabela, em cada organização, criada pelo admin dela.
  foreach org in array array[org_a, org_b, org_c] loop
    admin := case org when org_a then admin_a when org_b then admin_b else admin_c end;
    insert into public.projetos_crm (account_id, organization_id, nome) values (admin, org, 'CI projeto');
    insert into public.atividades (account_id, organization_id, nome) values (admin, org, 'CI atividade');
    insert into public.captacoes (account_id, organization_id, titulo) values (admin, org, 'CI negociação');
    insert into public.contatos (account_id, organization_id, nome) values (admin, org, 'CI contato');
    insert into public.editais_user (account_id, organization_id) values (admin, org);
  end loop;
end
$cenario$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

create schema rls_teste;
grant usage on schema rls_teste to authenticated, anon;

-- Ordem fixa das tabelas nas respostas.
create function rls_teste.todas() returns text[] language sql immutable as $$
  select array['projetos_crm', 'atividades', 'captacoes', 'contatos', 'editais_user'];
$$;

-- As duas compartilhadas entre módulos: quem tem qualquer módulo as vê.
create function rls_teste.compartilhadas() returns text[] language sql immutable as $$
  select array['projetos_crm', 'atividades'];
$$;

-- Roda o comando e desfaz. 'sim' se leu ou atingiu alguma linha; '' se a
-- regra barrou (erro de permissão ou nenhuma linha); outro erro volta
-- descrito, para o teste mostrar o que quebrou.
create function rls_teste.efeito(comando text) returns text language plpgsql as $$
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

-- Nomes das tabelas em que o comando teve efeito; erros aparecem como "tabela: erro".
create function rls_teste.resumo(tabelas text[], resultados text[]) returns text[] language sql immutable as $$
  select coalesce(array_agg(case when r = 'sim' then t else t || ': ' || r end order by n), '{}')
  from unnest(tabelas, resultados) with ordinality as x(t, r, n)
  where r <> '';
$$;

-- Em quais tabelas quem está logado vê linhas da organização p.
create function rls_teste.ve(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format('select 1 from public.projetos_crm where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.atividades where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.captacoes where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.contatos where organization_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.editais_user where organization_id = %L', p))
  ]);
$$;

-- Em quais tabelas quem está logado cria uma linha na organização p (a regra
-- antiga: account_id é quem está logado). O projeto entra arquivado para não
-- esbarrar no limite do plano gratuito.
create function rls_teste.insere(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format($q$insert into public.projetos_crm (account_id, organization_id, nome, status_operacional) values (auth.uid(), %L, 'CI novo', 'arquivado')$q$, p)),
    rls_teste.efeito(format($q$insert into public.atividades (account_id, organization_id, nome) values (auth.uid(), %L, 'CI nova')$q$, p)),
    rls_teste.efeito(format($q$insert into public.captacoes (account_id, organization_id) values (auth.uid(), %L)$q$, p)),
    rls_teste.efeito(format($q$insert into public.contatos (account_id, organization_id) values (auth.uid(), %L)$q$, p)),
    rls_teste.efeito(format($q$insert into public.editais_user (account_id, organization_id) values (auth.uid(), %L)$q$, p))
  ]);
$$;

-- Em quais tabelas quem está logado altera as linhas da organização p, de
-- quem as tiver criado (atualiza uma coluna para o valor que ela já tem).
create function rls_teste.altera(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format('update public.projetos_crm set nome = nome where organization_id = %L', p)),
    rls_teste.efeito(format('update public.atividades set prioridade = prioridade where organization_id = %L', p)),
    rls_teste.efeito(format('update public.captacoes set titulo = titulo where organization_id = %L', p)),
    rls_teste.efeito(format('update public.contatos set nome = nome where organization_id = %L', p)),
    rls_teste.efeito(format('update public.editais_user set observacoes = observacoes where organization_id = %L', p))
  ]);
$$;

-- Em quais tabelas quem está logado apaga as linhas da organização p.
create function rls_teste.apaga(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format('delete from public.projetos_crm where organization_id = %L', p)),
    rls_teste.efeito(format('delete from public.atividades where organization_id = %L', p)),
    rls_teste.efeito(format('delete from public.captacoes where organization_id = %L', p)),
    rls_teste.efeito(format('delete from public.contatos where organization_id = %L', p)),
    rls_teste.efeito(format('delete from public.editais_user where organization_id = %L', p))
  ]);
$$;

-- ─── A regra no banco ───────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies
           where schemaname = 'public'
             and tablename in ('captacoes', 'contatos', 'editais_user', 'projetos_crm', 'atividades')
             and policyname in (tablename || ': select equipe', tablename || ': update equipe', tablename || ': delete admin')
             and permissive = 'PERMISSIVE' and roles::text = '{authenticated}'),
          15, 'as 5 tabelas têm as regras por organização: ler, alterar e apagar (admin)');

select is((select count(*)::int from pg_policies
           where schemaname = 'public' and tablename in ('projetos_crm', 'atividades') and permissive = 'RESTRICTIVE'
             and policyname in (tablename || ': insere so na propria organizacao', tablename || ': altera so na propria organizacao')),
          4, 'projetos e atividades têm a guarda de escrita na própria organização');

select is((select count(*)::int from (
             select account_id from public.projetos_crm where organization_id is null
             union all select account_id from public.atividades where organization_id is null) x
           where (select count(*) from public.organization_members m where m.user_id = x.account_id) = 1),
          0, 'nenhum projeto nem atividade de conta com uma só organização ficou sem organização');

select ok(not has_function_privilege('anon', 'public.auth_org_ids_equipe(text, text)', 'execute'),
          'o visitante não executa auth_org_ids_equipe');
select ok(has_function_privilege('authenticated', 'public.auth_org_ids_equipe(text, text)', 'execute'),
          'quem está logado executa auth_org_ids_equipe');

-- ─── Organização A (só a captação) ──────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'admin: vê as cinco tabelas da organização');
select is(rls_teste.insere('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'admin: cria nas cinco');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'admin: altera nas cinco');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'admin: apaga nas cinco');
select is(rls_teste.efeito($q$insert into public.projetos_crm (account_id, organization_id, nome, status_operacional) values (auth.uid(), 'f3000000-0000-4000-8000-0000000000b0', 'CI invasor', 'arquivado')$q$),
          '', 'admin de A: não grava um projeto na organização B');
select is(rls_teste.efeito($q$update public.atividades set organization_id = 'f3000000-0000-4000-8000-0000000000b0' where organization_id = 'f3000000-0000-4000-8000-0000000000a0'$q$),
          '', 'admin de A: não muda uma atividade para a organização B');
select is(rls_teste.efeito($q$insert into public.projetos_crm (account_id, nome, status_operacional) values (auth.uid(), 'CI sem organização', 'arquivado')$q$),
          'sim', 'admin de A: ainda cria projeto sem organização (app antigo; a contração tira isso)');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'colaborador: vê o que o admin criou, nas cinco tabelas');
select is(rls_teste.insere('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'colaborador: cria nas cinco');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'colaborador: altera o que o admin criou');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'colaborador: não apaga o que é de outra pessoa');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'captador: não vê o que é dos outros');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'captador: não altera o que é dos outros');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'proponente: não vê o que é dos outros');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), rls_teste.todas(), 'leitor: vê as cinco tabelas');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'leitor: não altera o que é de outra pessoa');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'leitor: não apaga o que é de outra pessoa');
reset role;

-- ─── Organização B (só a prestação) ─────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'admin só com a prestação: vê projetos e atividades, não o comercial');
select is(rls_teste.insere('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'admin só com a prestação: cria projeto e atividade');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'admin só com a prestação: altera projeto e atividade');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'admin só com a prestação: apaga projeto e atividade');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000b2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'colaborador só com a prestação: vê o projeto e a atividade do admin');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'colaborador só com a prestação: altera projeto e atividade');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000b0'), '{}'::text[], 'colaborador só com a prestação: não apaga o que é de outra pessoa');
reset role;

-- O super admin é colaborador de B e não ganha nada além do que a equipe de B já vê.
set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000b3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000b0'), rls_teste.compartilhadas(), 'super admin: vê o que a equipe da organização dele vê');
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'super admin: não ganha leitura das outras organizações');
reset role;

-- ─── Organização C (as duas) ────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000c0'), rls_teste.todas(), 'admin com captação e prestação: vê tudo');
select is(rls_teste.apaga('f3000000-0000-4000-8000-0000000000c0'), rls_teste.todas(), 'admin com captação e prestação: apaga nas cinco');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000c2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000c0'), rls_teste.compartilhadas(), 'colaborador sem a captação, numa organização que a tem: vê só projetos e atividades');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000c0'), rls_teste.compartilhadas(), 'colaborador sem a captação: altera só projetos e atividades');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000c3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000c0'), rls_teste.todas(), 'colaborador com a captação, na mesma organização: vê as cinco');
select is(rls_teste.altera('f3000000-0000-4000-8000-0000000000c0'), rls_teste.todas(), 'colaborador com a captação: altera as cinco');
reset role;

-- ─── Visitante ──────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is(rls_teste.ve('f3000000-0000-4000-8000-0000000000a0'), '{}'::text[], 'visitante: não vê nada');
reset role;

select * from finish();
rollback;
