-- P1.10, P6.1 e P6.2: quem lê e confere os atos e as páginas guardados pelo
-- vigia normativo, quem cadastra as fontes e quem lê as propostas da IA.
--
-- Cenário criado e desfeito dentro da transação: um super admin, uma pessoa
-- comum, um ato guardado, uma versão de página com cópia no bucket e as
-- execuções das coletas. Rodar como o prestacao_rls.test.sql
-- (supabase/tests/README.md).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(49);

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
  insert into public.agente_execucoes (id, agente, referencia, situacao, lidos, novos, fontes_sem_resposta)
  values ('f1000000-0000-4000-8000-0000000000e3', 'vigia_paginas', current_date, 'ok', 3, 1, '{}'),
         ('f1000000-0000-4000-8000-0000000000e4', 'vigia_paginas', current_date, 'ok', 3, 0, array['Manual do STR (planilhas)']),
         ('f1000000-0000-4000-8000-0000000000e5', 'vigia_paginas', current_date, 'ok', 3, 0, '{}');
  insert into public.normas_documentos (id, fonte_id, chave, publicado_em, orgao, tipo_ato, titulo, texto, hash, motivos,
                                        situacao, formato, arquivo, execucao_id)
  values ('f1000000-0000-4000-8000-0000000000d2', (select id from public.normas_fontes where codigo = 'planalto_lc_222'),
          'fonte:normas-teste-2', current_date, 'Presidência da República', 'Página', 'Lcp 222', 'Art. 1º Texto novo.',
          'sha-pagina', array['texto mudou em 1 trecho (1 linha nova)'], 'novo', 'html',
          'normas-teste/2026-10-10-sha.html', 'f1000000-0000-4000-8000-0000000000e3');
  insert into storage.objects (bucket_id, name) values ('normas', 'normas-teste/2026-10-10-sha.html');
  insert into public.prestacao_regime_propostas (id, documento_id, regime_id, regime_codigo, classificacao, resumo)
  values ('f1000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000d1',
          (select id from public.prestacao_regimes where codigo = 'pronon_pronas_lxxxvi_a_2025' and status = 'publicado'),
          'pronon_pronas_lxxxvi_a_2025', 'informativo', 'Prorroga a dedução até 2031.');
end
$cenario$;

select ok((select ativa from public.normas_fontes where codigo = 'dou_secao1'), 'a seção 1 do Diário Oficial é vigiada');
select is((select count(*)::integer from public.normas_fontes where tipo in ('pagina', 'arquivo') and ativa), 16,
  'as páginas e os arquivos citados pelos regimes são vigiados');
select is((select count(*)::integer from public.normas_fontes f, unnest(f.regimes) r(codigo)
           where not exists (select 1 from public.prestacao_regimes p where p.codigo = r.codigo)), 0,
  'toda fonte aponta para regimes que existem');
select is((select configuracao->'recorte'->>'de' from public.normas_fontes where codigo = 'saude_prc5_anexo_lxxxvi'), 'ANEXO LXXXVI',
  'a PRC 5 é lida só a partir do Anexo LXXXVI');

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
select is((select count(*)::integer from public.normas_fontes), 0, 'pessoa comum: não lê as fontes');
select throws_ok($t$select public.fn_normas_fonte_salvar(null, '{"nome": "Página", "url": "https://www.gov.br/x/y"}')$t$,
  '42501', 'sem_permissao', 'pessoa comum: não cadastra fontes');
select throws_ok($t$select public.fn_agente_paginas_disparar()$t$, '42501', null, 'pessoa comum: não dispara a coleta das páginas');
select is((select count(*)::integer from public.prestacao_regime_propostas), 0, 'pessoa comum: não lê as propostas');
select throws_ok($t$select * from public.fn_regime_prestacoes_afetadas('rouanet_in29_2026')$t$, '42501', null,
  'pessoa comum: não conta as prestações afetadas');
select is((select count(*)::integer from storage.objects where bucket_id = 'normas'), 0, 'pessoa comum: não lê as cópias');
reset role;

-- ─── Super admin ────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select is((select titulo from public.normas_documentos where id = 'f1000000-0000-4000-8000-0000000000d1'), 'LEI Nº 99.999, DE TESTE',
  'super admin: lê os atos guardados');
select ok((select count(*) from public.agente_execucoes where id in ('f1000000-0000-4000-8000-0000000000e1', 'f1000000-0000-4000-8000-0000000000e2')) = 2,
  'super admin: lê as coletas');
select throws_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'conferido', 'x')$t$,
  '22023', 'regimes_obrigatorios', 'ato do Diário que afeta um regime precisa dizer qual');
select throws_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'conferido', 'x', array['nao_existe'])$t$,
  '22023', 'regime_inexistente', 'o regime escolhido precisa existir');
select lives_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'conferido', ' Muda a dedução do PRONON. ',
  array['pronon_pronas_lxxxvi_a_2025'])$t$, 'super admin: confere o ato');
select is((select array[situacao, nota, (conferido_por = 'f1000000-0000-4000-8000-000000000001')::text] from public.normas_documentos
           where id = 'f1000000-0000-4000-8000-0000000000d1'),
  array['conferido', 'Muda a dedução do PRONON.', 'true'], 'a conferência guarda quem, quando e a nota');
select is((select regimes from public.normas_documentos where id = 'f1000000-0000-4000-8000-0000000000d1'),
  array['pronon_pronas_lxxxvi_a_2025'], 'e os regimes que o ato afeta');
select lives_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d2', 'conferido')$t$,
  'super admin: confere a mudança de página');
select is((select regimes from public.normas_documentos where id = 'f1000000-0000-4000-8000-0000000000d2'),
  array['lie_p10_2026', 'lie_p424_2020'], 'a mudança de página afeta os regimes da fonte');
select is((select resumo from public.prestacao_regime_propostas where id = 'f1000000-0000-4000-8000-0000000000a1'),
  'Prorroga a dedução até 2031.', 'super admin: lê as propostas');
select throws_ok($t$insert into public.prestacao_regime_propostas (documento_id, regime_id, regime_codigo, classificacao)
  values ('f1000000-0000-4000-8000-0000000000d1', (select id from public.prestacao_regimes limit 1), 'x', 'informativo')$t$,
  '42501', null, 'super admin: propostas só pela função, com a chave de serviço');
select throws_ok($t$select public.fn_normas_documento_conferir('f1000000-0000-4000-8000-0000000000d1', 'aprovado')$t$,
  '22023', 'situacao_invalida', 'só novo, conferido ou descartado');
select throws_ok($t$update public.normas_documentos set situacao = 'descartado'$t$, '42501', null,
  'super admin: muda a situação só pela função');
select is((select count(*)::integer from storage.objects where bucket_id = 'normas' and name = 'normas-teste/2026-10-10-sha.html'), 1,
  'super admin: lê a cópia guardada');

-- Cadastro de fontes.
select lives_ok($t$select set_config('teste.fonte', public.fn_normas_fonte_salvar(null, jsonb_build_object(
  'nome', 'Manual do proponente', 'url', 'https://www.gov.br/cultura/pt-br/manual.pdf', 'tipo', 'arquivo',
  'orgao', 'Ministério da Cultura', 'area', 'cultura', 'regimes', jsonb_build_array('rouanet_in29_2026'),
  'frequencia_dias', 14))::text, true)$t$, 'super admin: inclui uma fonte');
select is((select array[tipo, orgao, area, frequencia_dias::text, array_to_string(regimes, ','), left(codigo, 8)]
           from public.normas_fontes where id = current_setting('teste.fonte')::uuid),
  array['arquivo', 'Ministério da Cultura', 'cultura', '14', 'rouanet_in29_2026', 'arquivo_'], 'a fonte guarda o que foi informado');
select throws_ok($t$select public.fn_normas_fonte_salvar(null, '{"nome": "Repetida", "url": "https://www.gov.br/cultura/pt-br/manual.pdf"}')$t$,
  '23505', 'url_repetida', 'o mesmo endereço não entra duas vezes');
select throws_ok($t$select public.fn_normas_fonte_salvar(null, '{"nome": "Sem endereço", "url": "javascript:alert(1)"}')$t$,
  '22023', 'url_invalida', 'só endereço http ou https');
select throws_ok($t$select public.fn_normas_fonte_salvar(null, '{"nome": "Regime", "url": "https://www.gov.br/a/b", "regimes": ["nao_existe"]}')$t$,
  '22023', 'regime_inexistente', 'regime precisa existir');
select throws_ok($t$insert into public.normas_fontes (codigo, nome, tipo, url) values ('x', 'x', 'pagina', 'https://x.y')$t$,
  '42501', null, 'super admin: grava fontes só pela função');
reset role;
update public.normas_fontes set ultimo_hash = 'hash-antigo', falhas_seguidas = 2 where id = current_setting('teste.fonte')::uuid;
set local role authenticated;
select lives_ok($t$select public.fn_normas_fonte_salvar(current_setting('teste.fonte')::uuid, jsonb_build_object(
  'nome', 'Manual do proponente', 'url', 'https://www.gov.br/cultura/pt-br/manual.pdf', 'tipo', 'arquivo',
  'frequencia_dias', 14, 'recorte_de', 'CAPÍTULO V', 'ativa', false))$t$, 'super admin: edita a fonte');
select is((select array[configuracao->'recorte'->>'de', coalesce(ultimo_hash, 'sem hash'), ativa::text, falhas_seguidas::text]
           from public.normas_fontes where id = current_setting('teste.fonte')::uuid),
  array['CAPÍTULO V', 'sem hash', 'false', '2'], 'trocar o recorte zera o hash: a próxima coleta é a referência');
select lives_ok($t$select public.fn_normas_fonte_salvar((select id from public.normas_fontes where codigo = 'dou_secao1'),
  '{"nome": "x", "url": "https://x.y", "ativa": false}')$t$, 'super admin: pausa o Diário Oficial');
select is((select array[ativa::text, nome, url] from public.normas_fontes where codigo = 'dou_secao1'),
  array['false', 'Diário Oficial da União, seção 1 (INLABS)', 'https://inlabs.in.gov.br'], 'do Diário, só a pausa muda');
reset role;

-- ─── Avisos ─────────────────────────────────────────────────────────────────

update public.normas_documentos set situacao = 'novo' where id = 'f1000000-0000-4000-8000-0000000000d1';
set local role service_role;
select ok(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e1') >= 1, 'coleta com ato novo: o super admin é avisado');
select is(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e2'), 0, 'coleta sem ato novo: nenhum aviso');
select ok(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e3') >= 1, 'página mudou: o super admin é avisado');
select ok(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e4') >= 1, 'fonte sem resposta há 3 coletas: o super admin é avisado');
select is(public.fn_normas_avisar('f1000000-0000-4000-8000-0000000000e5'), 0, 'coleta de páginas sem mudança: nenhum aviso');
select ok((select prestacoes >= 0 and organizacoes >= 0 from public.fn_regime_prestacoes_afetadas('rouanet_in29_2026')),
  'a chave de serviço conta as prestações em andamento do regime');
reset role;
select is((select payload->>'title' from public.notification_events where dedupe_key like 'normas_vigia:f1000000-0000-4000-8000-0000000000e3:%' limit 1),
  'Páginas dos órgãos: 1 mudança para conferir', 'o aviso diz quantas páginas mudaram');

select is((select array_agg(schedule || ' ' || command order by jobname) from cron.job where jobname like 'jards-agente-normativo%'),
  array['7 11 * * * select public.fn_agente_normativo_disparar(false);', '7 14 * * * select public.fn_agente_normativo_disparar(true);'],
  'a coleta roda às 8h07 e tenta de novo às 11h07');
select is((select schedule || ' ' || command from cron.job where jobname = 'jards-agente-paginas'),
  '37 12 * * * select public.fn_agente_paginas_disparar();', 'as páginas vencidas são coletadas às 9h37');

select * from finish();
rollback;
