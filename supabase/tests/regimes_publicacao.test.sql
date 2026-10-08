-- P6.3: rascunho, aprovação e publicação dos regimes.
--
-- Cenário criado e desfeito dentro da transação: duas pessoas da equipe
-- Jards (super admin), uma pessoa comum e uma proposta da IA para o regime
-- da Lei Rouanet. Rodar como o prestacao_rls.test.sql (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'regimes-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002',
                    'f2000000-0000-4000-8000-000000000003']::uuid[]) as id;
  update public.profiles set jards_super_admin = true
  where id in ('f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002');

  insert into public.normas_documentos (id, fonte_id, chave, publicado_em, orgao, tipo_ato, titulo, texto, hash, situacao, regimes)
  values ('f2000000-0000-4000-8000-0000000000d1', (select id from public.normas_fontes where codigo = 'dou_secao1'),
          'dou:regimes-teste-1', current_date, 'Ministério da Cultura', 'Instrução Normativa', 'IN MinC 40/2026',
          'No período improrrogável de 90 (noventa) dias.', 'sha-teste', 'conferido', array['rouanet_in29_2026']);
  insert into public.prestacao_regime_propostas (id, documento_id, regime_id, regime_codigo, classificacao)
  values ('f2000000-0000-4000-8000-0000000000a1', 'f2000000-0000-4000-8000-0000000000d1',
          (select id from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado'),
          'rouanet_in29_2026', 'altera_regra'),
         ('f2000000-0000-4000-8000-0000000000a2', 'f2000000-0000-4000-8000-0000000000d1',
          (select id from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado'),
          'rouanet_in29_2026', 'informativo');
end
$cenario$;

-- A versão seguinte da Rouanet, com o prazo final de 90 dias.
create temp table versao_teste on commit drop as
select versao as publicada,
       jsonb_set(jsonb_set(parametros, '{versao}', to_jsonb(versao + 1)), '{prazos,prestacaoFinal,quantidade}', '90') as seguinte,
       jsonb_set(jsonb_set(parametros, '{versao}', to_jsonb(versao + 2)), '{prazos,prestacaoFinal,quantidade}', '120') as depois
from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado';
grant select on versao_teste to authenticated, service_role;

-- ─── Ninguém escreve direto ─────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$update public.prestacao_regimes set nome = 'x' where codigo = 'rouanet_in29_2026'$t$, '42501', null,
  'super admin: não muda regime direto na tabela');
select throws_ok($t$insert into public.prestacao_regimes (codigo, versao, nome, area, mecanismo, esfera, orgao, norma_referencia, parametros)
  values ('x', 1, 'x', 'outro', 'x', 'federal', 'x', 'x', '{}')$t$, '42501', null, 'super admin: não cria regime direto na tabela');
select throws_ok($t$select public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select seguinte from versao_teste), 'f2000000-0000-4000-8000-000000000001')$t$,
  '42501', null, 'super admin: rascunho só pela rota, com a chave de serviço');
select throws_ok($t$select public.fn_regime_rascunho_aprovar(gen_random_uuid(), 'f2000000-0000-4000-8000-000000000001')$t$,
  '42501', null, 'super admin: aprovação só pela rota');
reset role;

-- ─── Rascunho ───────────────────────────────────────────────────────────────

set local role service_role;
select throws_ok($t$select public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select seguinte from versao_teste), 'f2000000-0000-4000-8000-000000000003')$t$,
  '42501', 'sem_permissao', 'quem não é da equipe Jards não faz rascunho');
select throws_ok($t$select public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select depois from versao_teste), 'f2000000-0000-4000-8000-000000000001')$t$,
  '22023', 'versao_invalida', 'o rascunho é a versão seguinte à publicada');
select throws_ok($t$select public.fn_regime_rascunho_salvar('lie_p10_2026', (select seguinte from versao_teste), 'f2000000-0000-4000-8000-000000000001')$t$,
  '22023', 'versao_invalida', 'o rascunho é do mesmo regime');
select lives_ok($t$select set_config('teste.rascunho', public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select seguinte from versao_teste),
  'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-0000000000a1', '{}', 'Prazo final da IN 40.')::text, true)$t$,
  'a equipe leva a proposta ao rascunho');
select is((select array[status, versao::text, (parametros->'prazos'->'prestacaoFinal'->>'quantidade'), notas, exige_segunda_aprovacao::text]
           from public.prestacao_regimes where id = current_setting('teste.rascunho')::uuid),
  array['rascunho', ((select publicada from versao_teste) + 1)::text, '90', 'Prazo final da IN 40.', 'false'], 'o rascunho guarda a versão seguinte');
select is((select status from public.prestacao_regime_propostas where id = 'f2000000-0000-4000-8000-0000000000a1'), 'aceita',
  'a proposta levada ao rascunho fica aceita');
select lives_ok($t$select public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select seguinte from versao_teste),
  'f2000000-0000-4000-8000-000000000002', null, array['orcamento.tetos[codigo=administracao]'])$t$,
  'outra mudança entra no mesmo rascunho');
select is((select array[count(*)::text, bool_and(exige_segunda_aprovacao)::text, max(array_to_string(regras_de_bloqueio, ','))]
           from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'rascunho'),
  array['1', 'true', 'orcamento.tetos[codigo=administracao]'], 'um rascunho por regime, que agora pede segunda aprovação');
reset role;

-- Quem lê: a equipe vê o rascunho; a pessoa comum, só o publicado.
set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'rascunho'), 0,
  'pessoa comum: não vê o rascunho');
reset role;
set local request.jwt.claims = '{"sub":"f2000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'rascunho'), 1,
  'super admin: vê o rascunho');
reset role;

-- ─── Aprovação ──────────────────────────────────────────────────────────────

set local role service_role;
select is(public.fn_regime_rascunho_aprovar(current_setting('teste.rascunho')::uuid, 'f2000000-0000-4000-8000-000000000001'),
  'aguardando_segunda', 'regra de bloqueio: a primeira aprovação não publica');
select ok(exists (select 1 from public.notification_events
                  where dedupe_key = 'regime_aprovacao:' || current_setting('teste.rascunho') || ':f2000000-0000-4000-8000-000000000002'),
  'a outra pessoa da equipe é avisada');
select throws_ok($t$select public.fn_regime_rascunho_aprovar(current_setting('teste.rascunho')::uuid, 'f2000000-0000-4000-8000-000000000001')$t$,
  '22023', 'ja_aprovou', 'a mesma pessoa não aprova duas vezes');
select is(public.fn_regime_rascunho_aprovar(current_setting('teste.rascunho')::uuid, 'f2000000-0000-4000-8000-000000000002'),
  'publicado', 'a segunda pessoa publica');
select is((select array_agg(status || ':' || versao order by versao) from public.prestacao_regimes
           where codigo = 'rouanet_in29_2026' and versao >= (select publicada from versao_teste)),
  array['obsoleto:' || (select publicada from versao_teste), 'publicado:' || ((select publicada from versao_teste) + 1)],
  'a versão anterior fica obsoleta e a nova, publicada');
select is((select array[status, publicado_por::text, jsonb_array_length(aprovacoes)::text] from public.prestacao_regimes
           where id = current_setting('teste.rascunho')::uuid),
  array['publicado', 'f2000000-0000-4000-8000-000000000002', '2'], 'quem publicou e as duas aprovações ficam registrados');
select is((select status from public.prestacao_regime_propostas where id = 'f2000000-0000-4000-8000-0000000000a1'), 'publicada',
  'a proposta fica publicada');

-- Sem regra de bloqueio, uma aprovação publica.
select lives_ok($t$select set_config('teste.outro', public.fn_regime_rascunho_salvar('rouanet_in29_2026', (select depois from versao_teste),
  'f2000000-0000-4000-8000-000000000001')::text, true)$t$, 'rascunho da versão seguinte');
select lives_ok($t$select public.fn_regime_rascunho_descartar(current_setting('teste.outro')::uuid, 'f2000000-0000-4000-8000-000000000001')$t$,
  'descartar o rascunho');
select is((select count(*)::integer from public.prestacao_regimes where id = current_setting('teste.outro')::uuid), 0,
  'o rascunho descartado some');

-- ─── Rejeitar proposta ──────────────────────────────────────────────────────

select throws_ok($t$select public.fn_regime_proposta_rejeitar('f2000000-0000-4000-8000-0000000000a2', 'f2000000-0000-4000-8000-000000000001', 'não')$t$,
  '22023', 'motivo_obrigatorio', 'rejeitar pede o motivo');
select lives_ok($t$select public.fn_regime_proposta_rejeitar('f2000000-0000-4000-8000-0000000000a2', 'f2000000-0000-4000-8000-000000000001',
  'Informativo: nada muda no regime.')$t$, 'a equipe rejeita a proposta');
reset role;

select * from finish();
rollback;
