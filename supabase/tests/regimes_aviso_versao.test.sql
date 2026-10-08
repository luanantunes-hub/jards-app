-- P6.4: aviso às organizações e troca de versão na prestação.
--
-- Cenário criado e desfeito dentro da transação: uma pessoa da equipe Jards,
-- a organização A com duas prestações em andamento na versão publicada da
-- Lei Rouanet (admin, quem tem a função de responsável, quem conduz uma das
-- prestações e uma pessoa que só edita), a organização B com a prestação já
-- aprovada e a organização C fora do regime. A equipe publica a versão
-- seguinte, com o prazo final de 90 dias. Rodar como o prestacao_rls.test.sql
-- (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

do $cenario$
declare
  org_a uuid := 'f3000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f3000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f3000000-0000-4000-8000-0000000000c0';
  rouanet uuid := (select id from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado');
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'aviso-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['f3000000-0000-4000-8000-000000000001',
                    'f3000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000a2',
                    'f3000000-0000-4000-8000-0000000000a3', 'f3000000-0000-4000-8000-0000000000a4',
                    'f3000000-0000-4000-8000-0000000000b1', 'f3000000-0000-4000-8000-0000000000c1']::uuid[]) as id;
  update public.profiles set jards_super_admin = true where id = 'f3000000-0000-4000-8000-000000000001';

  insert into public.organizations (id, nome) values
    (org_a, 'Aviso organização A'), (org_b, 'Aviso organização B'), (org_c, 'Aviso organização C');
  insert into public.organization_modulos (organization_id, modulo, status) values
    (org_a, 'prestacao', 'ativo'), (org_b, 'prestacao', 'ativo'), (org_c, 'prestacao', 'ativo');
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao) values
    (org_a, 'f3000000-0000-4000-8000-0000000000a1', 'admin', '{captacao,prestacao}', null),
    (org_a, 'f3000000-0000-4000-8000-0000000000a2', 'colaborador', '{prestacao}', 'preparador'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a3', 'colaborador', '{prestacao}', 'responsavel'),
    (org_a, 'f3000000-0000-4000-8000-0000000000a4', 'colaborador', '{prestacao}', 'preparador'),
    (org_b, 'f3000000-0000-4000-8000-0000000000b1', 'admin', '{captacao,prestacao}', null),
    (org_c, 'f3000000-0000-4000-8000-0000000000c1', 'admin', '{captacao,prestacao}', null);

  -- …a2 conduz a primeira prestação de A; …a4 só edita.
  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por, regime_id, responsavel_id, data_fim_execucao, status) values
    ('f3000000-0000-4000-8000-0000000001a1', 'Aviso prestação A1', org_a, 'f3000000-0000-4000-8000-0000000000a1', rouanet,
     'f3000000-0000-4000-8000-0000000000a2', date '2026-11-30', 'rascunho'),
    ('f3000000-0000-4000-8000-0000000001a2', 'Aviso prestação A2', org_a, 'f3000000-0000-4000-8000-0000000000a1', rouanet,
     null, null, 'revisao_interna'),
    ('f3000000-0000-4000-8000-0000000001b1', 'Aviso prestação B1', org_b, 'f3000000-0000-4000-8000-0000000000b1', rouanet,
     null, null, 'aprovado'),
    ('f3000000-0000-4000-8000-0000000001c1', 'Aviso prestação C1', org_c, 'f3000000-0000-4000-8000-0000000000c1',
     (select id from public.prestacao_regimes where codigo = 'generico' and status = 'publicado'), null, null, 'rascunho');
end
$cenario$;

create temp table versao_teste on commit drop as
select id as anterior, versao as publicada,
       jsonb_set(jsonb_set(parametros, '{versao}', to_jsonb(versao + 1)), '{prazos,prestacaoFinal,quantidade}', '90') as seguinte
from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado';
grant select on versao_teste to authenticated, service_role;

-- ─── Publicar avisa as organizações afetadas ────────────────────────────────

set local role service_role;
select lives_ok($t$select set_config('teste.nova', public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select seguinte from versao_teste),
  'f3000000-0000-4000-8000-000000000001')::text, true)$t$, 'rascunho da versão seguinte');
select is(public.fn_regime_rascunho_aprovar(current_setting('teste.nova')::uuid, 'f3000000-0000-4000-8000-000000000001',
  '[{"rotulo":"Prazos › Concluir os pagamentos e enviar o relatório final no Salic › quantidade","tipo":"mudou","antes":"60","depois":"90","fonte":"IN MinC 40/2026, art. 1º"}]'),
  'publicado', 'a equipe publica com o resumo do que muda');
select is((select resumo_mudancas->0->>'depois' from public.prestacao_regimes where id = current_setting('teste.nova')::uuid), '90',
  'a versão guarda o resumo');

select is((select array_agg(payload->>'recipient_id' order by payload->>'recipient_id') from public.notification_events
           where dedupe_key like 'regime_versao_nova:' || current_setting('teste.nova') || ':%'
             and organization_id in ('f3000000-0000-4000-8000-0000000000a0', 'f3000000-0000-4000-8000-0000000000b0',
                                     'f3000000-0000-4000-8000-0000000000c0')),
  array['f3000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000a2', 'f3000000-0000-4000-8000-0000000000a3'],
  'avisa quem decide em A (admin e função de responsável) e quem conduz a prestação; não avisa quem só edita, nem B (aprovada) nem C (outro regime)');
select is((select array[payload->>'title', payload->>'link', payload->>'category']
           from public.notification_events
           where dedupe_key = 'regime_versao_nova:' || current_setting('teste.nova') || ':f3000000-0000-4000-8000-0000000000a1'),
  array[(select nome from public.prestacao_regimes where id = current_setting('teste.nova')::uuid) || ': versão '
          || ((select publicada from versao_teste) + 1) || ' publicada', '/prestacoes', 'prestacao'],
  'o aviso diz a versão e leva à lista, porque são duas prestações');
select ok((select payload->>'message' from public.notification_events
           where dedupe_key = 'regime_versao_nova:' || current_setting('teste.nova') || ':f3000000-0000-4000-8000-0000000000a1')
          like '2 prestações da organização usam a versão anterior. Muda: Prazos › Concluir os pagamentos%',
  'o aviso conta as prestações e diz o que muda');
select is(public.fn_regime_avisar_versao(current_setting('teste.nova')::uuid), 0, 'repetir o aviso não avisa de novo');
reset role;

-- ─── Quem passa a prestação para a versão nova ──────────────────────────────

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a1', current_setting('teste.nova')::uuid)$t$,
  '42501', 'sem_permissao', 'quem só edita não passa a prestação para a versão nova');
select throws_ok($t$update public.prestacoes_contas set regime_id = current_setting('teste.nova')::uuid
  where id = 'f3000000-0000-4000-8000-0000000001a1'$t$,
  '42501', 'sem_permissao', 'nem gravando direto na prestação');
select lives_ok($t$update public.prestacoes_contas set regime_id = (select id from public.prestacao_regimes where codigo = 'generico' and status = 'publicado')
  where id = 'f3000000-0000-4000-8000-0000000001a2'$t$, 'trocar para outro regime continua com quem edita');
select lives_ok($t$update public.prestacoes_contas set regime_id = (select anterior from versao_teste)
  where id = 'f3000000-0000-4000-8000-0000000001a2'$t$, 'e voltar para o regime de antes também (é outro regime)');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a1', current_setting('teste.nova')::uuid)$t$,
  'P0002', 'prestacao_inexistente', 'outra organização não passa a prestação de A');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001b1', current_setting('teste.nova')::uuid)$t$,
  '22023', 'prestacao_encerrada', 'prestação aprovada fica na versão em que foi aprovada');
reset role;

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a1', (select anterior from versao_teste))$t$,
  '22023', 'versao_invalida', 'só passa para uma versão mais nova');
select lives_ok($t$select set_config('teste.troca', public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a1',
  current_setting('teste.nova')::uuid)::text, true)$t$, 'o admin passa a prestação para a versão nova');
reset role;

select is((select regime_id from public.prestacoes_contas where id = 'f3000000-0000-4000-8000-0000000001a1'),
  current_setting('teste.nova')::uuid, 'a prestação está na versão nova');
select is((select prazo_final from public.prestacoes_contas where id = 'f3000000-0000-4000-8000-0000000001a1'),
  public.prestacao_prazo_final(current_setting('teste.nova')::uuid, date '2026-11-30', null::date, null::date),
  'o prazo final é recalculado pela versão nova');
select ok((current_setting('teste.troca')::jsonb->>'prazo_final_novo')::date
          > (current_setting('teste.troca')::jsonb->>'prazo_final_anterior')::date,
  'a função devolve o prazo de antes e o de agora (90 dias em vez de 60)');
select ok((select comentario from public.prestacao_status_log
           where prestacao_id = 'f3000000-0000-4000-8000-0000000001a1' and comentario like 'Regime:%')
          like 'Regime: %, versão ' || ((select publicada from versao_teste) + 1) || ' (era a versão ' || (select publicada from versao_teste)
               || '). Prazo final pelo regime: % → %',
  'o histórico registra a versão de antes e o prazo recalculado');
select is((select usuario_id from public.prestacao_status_log
           where prestacao_id = 'f3000000-0000-4000-8000-0000000001a1' and comentario like 'Regime:%'),
  'f3000000-0000-4000-8000-0000000000a1'::uuid, 'e quem passou');

set local request.jwt.claims = '{"sub":"f3000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a1', current_setting('teste.nova')::uuid)$t$,
  '22023', 'versao_invalida', 'já na versão publicada, não há para onde passar');
select lives_ok($t$select public.fn_prestacao_passar_versao('f3000000-0000-4000-8000-0000000001a2', current_setting('teste.nova')::uuid)$t$,
  'quem tem a função de responsável também passa');
reset role;

select * from finish();
rollback;
