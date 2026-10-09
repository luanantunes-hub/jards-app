-- Convite da primeira versão da prestação de contas: teste grátis de 45 dias.
--
-- Cenário criado e desfeito dentro da transação: a organização A, só com a
-- captação (o administrador, uma colaboradora e um captador), e a
-- organização B, que já tem o contrato da prestação. Rodar como o
-- prestacao_rls.test.sql (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

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

-- O administrador de A aceita: dois membros, sete vagas e 45 dias.
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select is(public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0'),
  jsonb_build_object('membros', 2, 'vagas', 7, 'ate', (now() at time zone 'America/Sao_Paulo')::date + 45),
  'convite: o aceite começa o teste para a equipe');
select throws_ok($t$select public.fn_prestacao_aceitar_convite_gratuito('f4000000-0000-4000-8000-0000000000a0')$t$,
  'P0001', 'ja_contratado', 'convite: o segundo aceite não começa outro teste');

set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is(public.auth_tem_modulo('f4000000-0000-4000-8000-0000000000a0', 'prestacao'), true,
  'convite: durante o teste, a colaboradora usa a prestação');
reset role;

select is((select array[status, cortesia_ate::text, vagas_cortesia::text, cortesia_por::text, teste_gratis::text]
           from public.organization_modulos
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao'),
  array['cortesia', ((now() at time zone 'America/Sao_Paulo')::date + 45)::text, '7',
        'f4000000-0000-4000-8000-0000000000a1', 'true'],
  'convite: o contrato é uma cortesia de 45 dias marcada como teste, com quem aceitou');
select ok((select 'prestacao' = any(modulos_ativos) from public.organizations where id = 'f4000000-0000-4000-8000-0000000000a0'),
  'convite: a prestação entra nos módulos ativos da organização');
select is((select array_agg(papel || ':' || ('prestacao' = any(modulos_acesso))::text order by papel)
           from public.organization_members where organization_id = 'f4000000-0000-4000-8000-0000000000a0'),
  array['admin:true', 'captador:false', 'colaborador:true'],
  'convite: o captador fica de fora');
select is((select count(*)::integer from public.admin_audit_logs
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and metadata ->> 'origem' = 'convite_gratuito'),
  1, 'convite: o aceite fica no log de auditoria');

-- Faltando 5 dias, a rotina avisa o administrador com o texto do teste.
update public.organization_modulos set cortesia_ate = (now() at time zone 'America/Sao_Paulo')::date + 5
where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao';
select public.fn_prestacao_cortesias_diaria();
select is((select array_agg(event_key order by event_key) from public.notification_events
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0'
             and event_key in ('modulo_teste_fim', 'modulo_cortesia_fim', 'modulo_teste_encerrado')),
  array['modulo_teste_fim'], 'teste: 7 dias antes, só o administrador recebe o aviso do teste');
select is((select payload ->> 'recipient_id' from public.notification_events
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and event_key = 'modulo_teste_fim'),
  'f4000000-0000-4000-8000-0000000000a1', 'teste: o aviso vai para quem administra');

-- Passado o último dia, a rotina encerra o teste e a prestação fica só para leitura.
update public.organization_modulos set cortesia_ate = (now() at time zone 'America/Sao_Paulo')::date - 1
where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao';
select public.fn_prestacao_cortesias_diaria();
select is((select array[status, teste_gratis::text] from public.organization_modulos
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao'),
  array['cancelado', 'true'], 'teste: no fim, o contrato é encerrado e continua marcado como teste');
select is((select array['prestacao' = any(modulos_ativos), 'prestacao' = any(modulos_leitura)]
           from public.organizations where id = 'f4000000-0000-4000-8000-0000000000a0'),
  array[false, true], 'teste: no fim, a prestação passa para os módulos só de leitura');
select is((select count(*)::integer from public.notification_events
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and event_key = 'modulo_teste_encerrado'),
  1, 'teste: o administrador é avisado de que o teste terminou');
select is((select count(*)::integer from public.admin_audit_logs
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and metadata ->> 'origem' = 'rotina'
             and (metadata ->> 'teste_gratis')::boolean),
  1, 'teste: o encerramento fica no log de auditoria');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f4000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
select is(public.auth_tem_modulo('f4000000-0000-4000-8000-0000000000a0', 'prestacao'), false,
  'teste: depois do fim, a colaboradora não edita');
select is(public.auth_le_modulo_sem_assinatura('f4000000-0000-4000-8000-0000000000a0', 'prestacao'), true,
  'teste: depois do fim, a colaboradora continua lendo');
reset role;

-- A assinatura desmarca o teste; a cortesia do suporte não é teste.
update public.organization_modulos set status = 'ativo', encerrado_em = null
where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao';
select is((select teste_gratis from public.organization_modulos
           where organization_id = 'f4000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao'),
  false, 'teste: a assinatura encerra a marca do teste');
select is((select teste_gratis from public.organization_modulos
           where organization_id = 'f4000000-0000-4000-8000-0000000000b0' and modulo = 'prestacao'),
  false, 'teste: contrato que não veio do convite não é teste');

select * from finish();
rollback;
