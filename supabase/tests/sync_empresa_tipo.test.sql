-- fn_sync_empresa_tipo: o tipo da empresa (prospect, cliente ativo, ex-cliente) acompanha
-- as contas, negociações e inscrições da organização, quem quer que grave.
--
-- Confere a migration sync_empresa_tipo_definer: um colega que não criou a empresa
-- encerra ou abre a conta do cliente e o tipo muda; quem criou e a rotina sem usuário
-- seguem como antes; uma conta de outra organização não muda a empresa; e a função de
-- gatilho não é executável pelo navegador.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A: admin (criou as empresas), colaborador (não criou nenhuma);
--     empresa a1, cliente ativo, com uma conta ativa; empresa a2, prospect;
--   organização B: admin; empresa b1, prospect, e uma conta ATIVA da organização A
--     apontando para ela (linha de outro inquilino: não pode fazer b1 virar cliente).
-- Cada sonda roda um comando como a pessoa indicada, lê o tipo da empresa e desfaz o
-- comando na hora.
--
-- Rodar: supabase/tests/README.md. Com a migration na frente, o teste roda sobre ela
-- antes de ela ser aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

-- ─── Cenário ────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f4000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f4000000-0000-4000-8000-0000000000b0';
  admin_a uuid := 'f4000000-0000-4000-8000-0000000000a1';
  colab_a uuid := 'f4000000-0000-4000-8000-0000000000a2';
  admin_b uuid := 'f4000000-0000-4000-8000-0000000000b1';
  a1 uuid := 'f4000000-0000-4000-8000-0000000000e1';
  a2 uuid := 'f4000000-0000-4000-8000-0000000000e2';
  b1 uuid := 'f4000000-0000-4000-8000-0000000000e3';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'ci-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array[admin_a, colab_a, admin_b]) as id;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova, com a
  -- captação. Ela fica e não muda nenhum caso: as sondas olham só A e B.

  insert into public.organizations (id, nome) values (org_a, 'CI organização A'), (org_b, 'CI organização B');
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (org_a, admin_a, 'admin', '{captacao}'),
    (org_a, colab_a, 'colaborador', '{captacao}'),
    (org_b, admin_b, 'admin', '{captacao}');

  insert into public.empresas_crm (id, account_id, organization_id, nome, tipo) values
    (a1, admin_a, org_a, 'CI empresa a1', 'cliente_ativo'),
    (a2, admin_a, org_a, 'CI empresa a2', 'prospect'),
    (b1, admin_b, org_b, 'CI empresa b1', 'prospect');
  insert into public.contas_patrocinio (account_id, organization_id, empresa_crm_id, status) values
    (admin_a, org_a, a1, 'ativa'),
    -- Conta da organização A sobre a empresa da organização B.
    (admin_a, org_a, b1, 'ativa');
end
$cenario$;

-- ─── Sonda ─────────────────────────────────────────────────────────────

create schema sync_teste;
grant usage on schema sync_teste to authenticated, anon;

-- Roda o comando, lê o tipo da empresa e desfaz o comando. Erros voltam descritos.
create function sync_teste.tipo_apos(comando text, empresa uuid) returns text language plpgsql as $$
declare
  v_tipo text;
begin
  begin
    execute comando;
    select tipo into v_tipo from public.empresas_crm where id = empresa;
    raise exception using errcode = 'SYN00', message = coalesce(v_tipo, 'empresa invisível');
  exception
    when sqlstate 'SYN00' then
      return sqlerrm;
    when others then
      return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;
grant execute on function sync_teste.tipo_apos(text, uuid) to authenticated, anon;

-- ─── Um colega que não criou a empresa ────────────────────────────────────

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;

select is(
  sync_teste.tipo_apos($q$update public.contas_patrocinio set status = 'encerrada' where empresa_crm_id = 'f4000000-0000-4000-8000-0000000000e1'$q$,
    'f4000000-0000-4000-8000-0000000000e1'),
  'ex_cliente', 'colega encerra a conta do cliente: a empresa vira ex-cliente');

select is(
  sync_teste.tipo_apos($q$insert into public.contas_patrocinio (account_id, organization_id, empresa_crm_id, status) values (auth.uid(), 'f4000000-0000-4000-8000-0000000000a0', 'f4000000-0000-4000-8000-0000000000e2', 'ativa')$q$,
    'f4000000-0000-4000-8000-0000000000e2'),
  'cliente_ativo', 'colega abre conta ativa de uma empresa prospect: ela vira cliente');
reset role;

-- ─── Quem criou a empresa ─────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;

select is(
  sync_teste.tipo_apos($q$update public.contas_patrocinio set status = 'encerrada' where empresa_crm_id = 'f4000000-0000-4000-8000-0000000000e1'$q$,
    'f4000000-0000-4000-8000-0000000000e1'),
  'ex_cliente', 'quem criou a empresa encerra a conta: vira ex-cliente, como sempre');
reset role;

-- ─── Sem usuário (chave de serviço, rotinas do banco) ─────────────────────

select is(
  sync_teste.tipo_apos($q$update public.contas_patrocinio set status = 'encerrada' where empresa_crm_id = 'f4000000-0000-4000-8000-0000000000e1'$q$,
    'f4000000-0000-4000-8000-0000000000e1'),
  'ex_cliente', 'sem usuário: a conta encerrada também vira ex-cliente');

-- ─── Outra organização ────────────────────────────────────────────────────

-- A conta ativa da organização A sobre a empresa da B foi gravada no cenário, com o
-- gatilho rodando como dono: a empresa da B não pode ter virado cliente.
select is((select tipo from public.empresas_crm where id = 'f4000000-0000-4000-8000-0000000000e3'),
  'prospect', 'conta de outra organização sobre a empresa: ela segue prospect');

-- Depois a própria B grava uma negociação sobre a empresa dela: o gatilho lê só as
-- linhas da B, então a conta da A não conta.
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is(
  sync_teste.tipo_apos($q$insert into public.captacoes (account_id, organization_id, empresa_crm_id, titulo) values (auth.uid(), 'f4000000-0000-4000-8000-0000000000b0', 'f4000000-0000-4000-8000-0000000000e3', 'CI negociação')$q$,
    'f4000000-0000-4000-8000-0000000000e3'),
  'prospect', 'a organização B grava na empresa dela: a conta da A não a faz virar cliente');
reset role;

-- ─── A função ─────────────────────────────────────────────────────────────

select ok(
  (select p.prosecdef and 'search_path=public, pg_temp' = any (p.proconfig)
   from pg_proc p where p.oid = 'public.fn_sync_empresa_tipo()'::regprocedure),
  'a função roda como dono, com o caminho de busca fixo');
select ok(
  not has_function_privilege('anon', 'public.fn_sync_empresa_tipo()', 'execute')
  and not has_function_privilege('authenticated', 'public.fn_sync_empresa_tipo()', 'execute'),
  'o navegador não executa a função de gatilho');

select * from finish();
rollback;
