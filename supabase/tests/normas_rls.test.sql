-- P1.10: quem lê e confere os atos guardados pelo vigia normativo.
--
-- Cenário criado e desfeito dentro da transação: um super admin, uma pessoa
-- comum, um ato guardado e uma execução da coleta. Rodar como o
-- prestacao_rls.test.sql (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'normas-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002']::uuid[]) as id;
  update public.profiles set jards_super_admin = true where id = 'f1000000-0000-4000-8000-000000000001';

  insert into public.normas_documentos (id, fonte_id, chave, publicado_em, edicao, orgao, tipo_ato, titulo, texto, hash, motivos)
  values ('f1000000-0000-4000-8000-0000000000d1', (select id from public.normas_fontes where codigo = 'dou_secao1'),
          'dou:normas-teste-1', current_date, 'DO1', 'Atos do Poder Legislativo', 'Lei',
          'LEI Nº 99.999, DE TESTE', 'Altera a Lei nº 12.715 (PRONON).', 'sha-teste', array['PRONON']);
  insert into public.agente_execucoes (id, agente, fonte_id, referencia, situacao, lidos, relevantes, novos)
  values ('f1000000-0000-4000-8000-0000000000e1', 'vigia_dou', (select id from public.normas_fontes where codigo = 'dou_secao1'),
          current_date, 'ok', 400, 1, 1),
         ('f1000000-0000-4000-8000-0000000000e2', 'vigia_dou', (select id from public.normas_fontes where codigo = 'dou_secao1'),
          current_date, 'ok', 380, 0, 0);
end
$cenario$;

select ok((select ativa from public.normas_fontes where codigo = 'dou_secao1'), 'a seção 1 do Diário Oficial é vigiada');

-- ─── Pessoa comum ───────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.normas_documentos), 0, 'pessoa comum: não lê os atos guardados');
select is((select count(*)::integer from public.agente_execucoes), 0, 'pessoa comum: não lê as coletas');
select throws_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'conferido')$t$,
  '42501', 'sem_permissao', 'pessoa comum: não confere atos');
select throws_ok($t$insert into public.normas_documentos (fonte_id, chave, publicado_em, orgao, texto, hash)
  values ((select id from public.normas_fontes limit 1), 'dou:x', current_date, 'x', 'x', 'x')$t$,
  '42501', null, 'pessoa comum: não grava atos');
select throws_ok($t$select public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e1')$t$, '42501', null,
  'pessoa comum: não dispara avisos');
select throws_ok($t$select public.fn_agente_normativo_disparar()$t$, '42501', null, 'pessoa comum: não dispara a coleta');
reset role;

-- ─── Super admin ────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select is((select titulo from public.normas_documentos where id = 'f1000000-0000-4000-8000-0000000000d1'), 'LEI Nº 99.999, DE TESTE',
  'super admin: lê os atos guardados');
select ok((select count(*) from public.agente_execucoes where id in ('f1000000-0000-4000-8000-0000000000e1', 'f1000000-0000-4000-8000-0000000000e2')) = 2,
  'super admin: lê as coletas');
select lives_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'conferido', ' Muda a dedução do PRONON. ')$t$,
  'super admin: confere o ato');
select is((select array[situacao, nota, (conferido_por = 'f1000000-0000-4000-8000-000000000001')::text] from public.normas_documentos
           where id = 'f1000000-0000-4000-8000-0000000000d1'),
  array['conferido', 'Muda a dedução do PRONON.', 'true'], 'a conferência guarda quem, quando e a nota');
select throws_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'aprovado')$t$,
  '22023', 'situacao_invalida', 'só novo, conferido ou descartado');
select throws_ok($t$update public.normas_documentos set situacao = 'descartado'$t$, '42501', null,
  'super admin: muda a situação só pela função');
reset role;

-- ─── Avisos ─────────────────────────────────────────────────────────────────

update public.normas_documentos set situacao = 'novo' where id = 'f1000000-0000-4000-8000-0000000000d1';
set local role service_role;
select ok(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e1') >= 1, 'coleta com ato novo: o super admin é avisado');
select is(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e2'), 0, 'coleta sem ato novo: nenhum aviso');
reset role;

select is((select array_agg(schedule || ' ' || command order by jobname) from cron.job where jobname like 'jards-agente-normativo%'),
  array['7 11 * * * select public.fn_agente_normativo_disparar(false);', '7 14 * * * select public.fn_agente_normativo_disparar(true);'],
  'a coleta roda às 8h07 e tenta de novo às 11h07');

select * from finish();
rollback;
