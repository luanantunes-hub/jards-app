-- Convite da primeira versão gratuita da prestação de contas.
--
-- Cenário criado e desfeito dentro da transação: a organização A, só com a
-- captação (o administrador, uma colaboradora e um captador), e a
-- organização B, que já tem o contrato da prestação. Rodar como o
-- prestacao_rls.test.sql (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

do $cenario$
declare
  org_a uuid := 'f4000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f4000000-0000-4000-8000-0000000000b0';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'convite-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['f4000000-0000-4000-8000-0000000000a1', 'f4000000-0000-4000-8000-0000000000a2',
                    'f4000000-0000-4000-8000-0000000000a3', 'f4000000-0000-4000-8000-0000000000b1']::uuid[]) as id;

  insert into public.organizations (id, nome) values (org_a, 'Convite organização A'), (org_b, 'Convite organização B');
  insert into public.organization_modulos (organization_id, modulo, status) values (org_b, 'prestacao', 'ativo');
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (org_a, 'f4000000-0000-4000-8000-0000000000a1', 'admin', '{captacao}'),
    (org_a, 'f4000000-0000-4000-8000-0000000000a2', 'colaborador', '{captacao}'),
    (org_a, 'f4000000-0000-4000-8000-0000000000a3', 'captador', '{captacao}'),
    (org_b, 'f4000000-0000-4000-8000-0000000000b1', 'admin', '{captacao,prestacao}');
end
$cenario$;

set local role authenticated;

-- Sem sessão, nada.
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0')$t$,
  '42501', 'nao_autenticado', 'convite: sem sessão, ninguém aceita');

-- A colaboradora não aceita pela equipe.
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0')$t$,
  '42501', 'sem_permissao', 'convite: só o administrador aceita pela equipe');
select is(public.auth_tem_modulo('f4000000-0000-4000-8000-0000000000a0', 'prestacao'), false,
  'convite: antes do aceite, a colaboradora não usa a prestação');

-- O administrador de B não aceita por A.
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0')$t$,
  '42501', 'sem_permissao', 'convite: o administrador de outra organização não aceita');
-- Quem já tem o contrato segue pela assinatura.
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000b0')$t$,
  'P0001', 'ja_contratado', 'convite: quem já tem o módulo não recebe o convite');

-- O administrador de A aceita: dois membros e sete vagas.
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is(public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0'),
  '{"membros": 2, "vagas": 7}'::jsonb, 'convite: o aceite libera a equipe');
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0')$t$,
  'P0001', 'ja_contratado', 'convite: o segundo aceite não cria outro contrato');

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is(public.auth_tem_modulo('f4000000-0000-4000-8000-0000000000a0', 'prestacao'), true,
  'convite: depois do aceite, a colaboradora usa a prestação');
reset role;

select is((select array[status, coalesce(cortesia_ate::text, '-'), vagas_cortesia::text, cortesia_por::text]
           from public.organization_modulos
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao'),
  array['cortesia', '-', '7', 'f4000000-0000-4000-8000-0000000000a1'],
  'convite: o contrato é uma cortesia sem data de fim, com quem aceitou');
select ok((select 'prestacao' = any(modulos_ativos) from public.organizations where id = 'f4000000-0000-4000-8000-0000000000a0'),
  'convite: a prestação entra nos módulos ativos da organização');
select is((select array_agg(papel || ':' || ('prestacao' = any(modulos_acesso))::text order by papel)
           from public.organization_members where organization_id = 'f4000000-0000-4000-8000-0000000000a0'),
  array['admin:true', 'captador:false', 'colaborador:true'],
  'convite: o captador fica de fora');
select is((select count(*)::integer from public.admin_audit_logs
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and metadata ->> 'origem' = 'convite_gratuito'),
  1, 'convite: o aceite fica no log de auditoria');

select * from finish();
rollback;
