-- P0.8: quem lê, cria, altera e apaga cada parte da prestação de contas.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A, com o módulo da prestação:
--     admin (captação e prestação), colaborador preparador, colaborador
--     revisor, leitor, colaborador sem o módulo da prestação, captador;
--   organização B, com o módulo: admin;
--   organização C, sem o módulo: admin com acesso aos dois módulos;
--   visitante sem login.
-- A prestação de A tem uma linha em cada tabela e dois arquivos no bucket
-- (um da prestação e um fora dela); A tem um fornecedor, que é da
-- organização e não de uma prestação.
--
-- As sondas em rls_teste rodam com a permissão de quem está logado e dizem
-- em quais tabelas a pessoa vê, cria, altera ou apaga; cada escrita é
-- desfeita na hora, então uma sonda não interfere na seguinte.
--
-- Rodar: supabase/tests/README.md.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(197);

-- ─── Cenário ────────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f0000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f0000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f0000000-0000-4000-8000-0000000000c0';
  admin_a uuid := 'f0000000-0000-4000-8000-0000000000a1';
  pa uuid := 'f0000000-0000-4000-8000-0000000001a0';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  select id, 'rls-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb
  from unnest(array[
    'f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000a2',
    'f0000000-0000-4000-8000-0000000000a3', 'f0000000-0000-4000-8000-0000000000a4',
    'f0000000-0000-4000-8000-0000000000a5', 'f0000000-0000-4000-8000-0000000000a6',
    'f0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-0000000000c1'
  ]::uuid[]) as id;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova. Ela
  -- fica: não tem o módulo da prestação e não muda nenhum caso abaixo.

  insert into public.organizations (id, nome) values
    (org_a, 'RLS organização A'), (org_b, 'RLS organização B'), (org_c, 'RLS organização C');
  insert into public.organization_modulos (organization_id, modulo, status) values
    (org_a, 'prestacao', 'ativo'), (org_b, 'prestacao', 'ativo');

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao) values
    (org_a, admin_a, 'admin', '{captacao,prestacao}', null),
    (org_a, 'f0000000-0000-4000-8000-0000000000a2', 'colaborador', '{prestacao}', 'preparador'),
    (org_a, 'f0000000-0000-4000-8000-0000000000a3', 'colaborador', '{prestacao}', 'revisor'),
    (org_a, 'f0000000-0000-4000-8000-0000000000a4', 'leitor', '{prestacao}', null),
    (org_a, 'f0000000-0000-4000-8000-0000000000a5', 'colaborador', '{captacao}', null),
    (org_a, 'f0000000-0000-4000-8000-0000000000a6', 'captador', '{captacao}', null),
    (org_b, 'f0000000-0000-4000-8000-0000000000b1', 'admin', '{captacao,prestacao}', null),
    (org_c, 'f0000000-0000-4000-8000-0000000000c1', 'admin', '{captacao,prestacao}', null);

  -- A prestação de A é da Rouanet: o checklist de envio (P4.1) confere os itens no regime.
  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por, regime_id) values
    (pa, 'RLS prestação A', org_a, admin_a,
     (select id from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado' order by versao desc limit 1)),
    ('f0000000-0000-4000-8000-0000000001b0', 'RLS prestação B', org_b, 'f0000000-0000-4000-8000-0000000000b1', null),
    ('f0000000-0000-4000-8000-0000000001c0', 'RLS prestação C', org_c, 'f0000000-0000-4000-8000-0000000000c1', null);

  insert into public.prestacao_orcamento_versoes (id, prestacao_id, tipo, ativa, criado_por) values
    ('f0000000-0000-4000-8000-0000000002a0', pa, 'aprovada', true, admin_a),
    ('f0000000-0000-4000-8000-0000000002a1', pa, 'solicitada', false, admin_a);
  insert into public.prestacao_orcamento_nos (id, versao_id, prestacao_id, nome, valor_total) values
    ('f0000000-0000-4000-8000-0000000003a0', 'f0000000-0000-4000-8000-0000000002a0', pa, 'RLS nó', 100);
  insert into public.prestacao_comprovantes (id, prestacao_id, nome_arquivo, storage_path) values
    ('f0000000-0000-4000-8000-0000000005a0', pa, 'rls.pdf',
     org_a || '/prestacoes/' || pa || '/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf');
  insert into public.prestacao_atividades (id, prestacao_id, titulo, data_realizacao) values
    ('f0000000-0000-4000-8000-0000000006a0', pa, 'RLS atividade', current_date);
  insert into public.prestacao_atividade_evidencias (id, atividade_id, nome_arquivo, storage_path) values
    ('f0000000-0000-4000-8000-0000000007a0', 'f0000000-0000-4000-8000-0000000006a0', 'rls.jpg',
     org_a || '/prestacoes/' || pa || '/evidencias/f0000000-0000-4000-8000-000000000ea0.jpg');
  insert into public.prestacao_relatorio (id, prestacao_id, secao) values
    ('f0000000-0000-4000-8000-0000000008a0', pa, 'rls');
  insert into public.prestacao_distribuicao (id, prestacao_id, produto, categoria, quantidade) values
    ('f0000000-0000-4000-8000-0000000009a0', pa, 'RLS produto', 'social', 10);
  insert into public.prestacao_pecas (id, prestacao_id, tipo, titulo) values
    ('f0000000-0000-4000-8000-000000000aa0', pa, 'cartaz', 'RLS cartaz');
  insert into public.prestacao_alteracoes (id, prestacao_id, versao_id, numero) values
    ('f0000000-0000-4000-8000-000000000ba0', pa, 'f0000000-0000-4000-8000-0000000002a0', 1);
  insert into public.prestacao_contas_bancarias (id, prestacao_id, tipo, banco, agencia, conta) values
    ('f0000000-0000-4000-8000-0000000010a0', pa, 'movimento', '001', '1234-5', '98765-4');
  insert into public.prestacao_extrato_importacoes (id, prestacao_id, conta_id, formato) values
    ('f0000000-0000-4000-8000-0000000011a0', pa, 'f0000000-0000-4000-8000-0000000010a0', 'csv');
  insert into public.prestacao_lancamentos (id, prestacao_id, conta_id, importacao_id, data, natureza, valor, historico, chave) values
    ('f0000000-0000-4000-8000-0000000012a0', pa, 'f0000000-0000-4000-8000-0000000010a0',
     'f0000000-0000-4000-8000-0000000011a0', current_date, 'debito', 10, 'RLS tarifa', 'rls-1');
  insert into public.prestacao_fornecedores (id, organization_id, tipo_pessoa, documento, nome) values
    ('f0000000-0000-4000-8000-0000000013a0', org_a, 'pj', '11222333000181', 'RLS fornecedor');
  insert into public.prestacao_fornecedor_documentos (id, fornecedor_id, tipo, nome_arquivo, storage_path) values
    ('f0000000-0000-4000-8000-0000000014a0', 'f0000000-0000-4000-8000-0000000013a0', 'cartao_cnpj', 'cartao.pdf',
     org_a || '/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014a0.pdf');
  insert into public.prestacao_pagamentos (id, despesa_id, forma, data, valor) values
    ('f0000000-0000-4000-8000-0000000015a0', 'f0000000-0000-4000-8000-0000000005a0', 'pix', current_date, 10);
  insert into public.prestacao_verificacoes (id, prestacao_id, chave, check_codigo, severidade, resultado, entidade_tipo, entidade_id, mensagem) values
    ('f0000000-0000-4000-8000-0000000016a0', pa, 'RLS:alerta', 'DOC_PJ_SEM_NF', 'alerta', 'revisar', 'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'RLS alerta'),
    ('f0000000-0000-4000-8000-0000000016b0', pa, 'RLS:bloqueio', 'DEBITO_SEM_COMPROVANTE', 'bloqueio', 'nao_conforme', 'lancamento', 'f0000000-0000-4000-8000-0000000012a0', 'RLS bloqueio'),
    ('f0000000-0000-4000-8000-0000000016c0', pa, 'RLS:sumiu', 'DESPESA_SEM_VALOR', 'alerta', 'nao_calculavel', 'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'RLS sumiu');
  insert into public.prestacao_metas (id, prestacao_id, descricao, unidade, previsto) values
    ('f0000000-0000-4000-8000-0000000017a0', pa, 'RLS meta', 'oficinas', 6);
  insert into public.prestacao_locais (id, prestacao_id, uf, municipio) values
    ('f0000000-0000-4000-8000-0000000018a0', pa, 'SP', 'São Paulo');
  insert into public.prestacao_evidencias (id, prestacao_id, tipo, atividade_id, nome_arquivo, storage_path) values
    ('f0000000-0000-4000-8000-0000000019a0', pa, 'foto', 'f0000000-0000-4000-8000-0000000006a0', 'rls.jpg',
     org_a || '/prestacoes/' || pa || '/evidencias/f0000000-0000-4000-8000-000000000ef0.jpg');
  insert into public.prestacao_bens (id, prestacao_id, tipo, descricao) values
    ('f0000000-0000-4000-8000-0000000021a0', pa, 'movel', 'RLS bem');
  insert into public.prestacao_envio_checklist (id, prestacao_id, etapa, tipo, codigo, situacao) values
    ('f0000000-0000-4000-8000-0000000022a0', pa, 'final', 'condicao', 'etapas_lancadas', 'pronto');
  insert into public.prestacao_envio_arquivos (id, prestacao_id, etapa, codigo, storage_path, nome_arquivo) values
    ('f0000000-0000-4000-8000-0000000023a0', pa, 'final', 'recolhimento_fnc',
     org_a || '/prestacoes/' || pa || '/envio/f0000000-0000-4000-8000-000000000da0.pdf', 'gru.pdf');
  insert into public.prestacao_devolucoes (id, prestacao_id, motivo, valor_principal) values
    ('f0000000-0000-4000-8000-0000000024a0', pa, 'saldo', 123.45);
  -- Um envio parcial antigo, já reaberto e fora da guarda: aparece, mas não trava nada.
  insert into public.prestacao_envios (id, prestacao_id, etapa, versao, enviado_em, retrato, retrato_sha256, guarda_ate,
                                       situacao, reaberto_em, motivo_reabertura) values
    ('f0000000-0000-4000-8000-0000000025a0', pa, 'parcial', 1, '2020-01-01', '{}', repeat('0', 64), '2020-12-31',
     'reaberto', now(), 'Envio antigo do cenário de teste.');
  insert into public.prestacao_envio_itens (envio_id, prestacao_id, tabela, registro_id) values
    ('f0000000-0000-4000-8000-0000000025a0', pa, 'prestacao_devolucoes', 'f0000000-0000-4000-8000-0000000024a0');
  -- Depois do envio (P4.7): uma diligência já respondida, uma decisão, uma glosa e um recurso.
  insert into public.prestacao_diligencias (id, prestacao_id, recebida_em, descricao, situacao, respondida_em) values
    ('f0000000-0000-4000-8000-0000000026a0', pa, current_date - 10, 'RLS diligência respondida', 'respondida', current_date - 5);
  insert into public.prestacao_decisoes (id, prestacao_id, resultado, registrada_em, documento_path) values
    ('f0000000-0000-4000-8000-0000000027a0', pa, 'aprovada_ressalvas', current_date - 2,
     org_a || '/prestacoes/' || pa || '/pos-envio/f0000000-0000-4000-8000-000000000ab0.pdf');
  insert into public.prestacao_glosas (id, prestacao_id, decisao_id, despesa_id, descricao, valor) values
    ('f0000000-0000-4000-8000-0000000028a0', pa, 'f0000000-0000-4000-8000-0000000027a0', 'f0000000-0000-4000-8000-0000000005a0', 'RLS glosa', 10);
  insert into public.prestacao_recursos (id, prestacao_id, decisao_id, protocolado_em) values
    ('f0000000-0000-4000-8000-0000000029a0', pa, 'f0000000-0000-4000-8000-0000000027a0', current_date);

  insert into storage.objects (bucket_id, name, owner) values
    ('documentos', org_a || '/prestacoes/' || pa || '/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf', admin_a),
    ('documentos', org_a || '/outros/f0000000-0000-4000-8000-000000000cb0.pdf', admin_a),
    ('documentos', org_a || '/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014a0.pdf', admin_a),
    ('documentos', org_a || '/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014e0.pdf', admin_a);
end
$cenario$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

create schema rls_teste;
grant usage on schema rls_teste to authenticated, anon;

-- Ordem fixa das tabelas nas respostas.
create function rls_teste.todas() returns text[] language sql immutable as $$
  select array[
    'prestacoes_contas', 'prestacao_status_log', 'prestacao_orcamento_versoes',
    'prestacao_orcamento_nos', 'prestacao_comprovantes',
    'prestacao_atividades', 'prestacao_atividade_evidencias', 'prestacao_relatorio',
    'prestacao_distribuicao', 'prestacao_pecas', 'prestacao_alteracoes',
    'prestacao_contas_bancarias', 'prestacao_extrato_importacoes', 'prestacao_lancamentos',
    'prestacao_fornecedores', 'prestacao_fornecedor_documentos', 'prestacao_pagamentos',
    'prestacao_verificacoes', 'prestacao_metas', 'prestacao_locais', 'prestacao_evidencias',
    'prestacao_bens', 'prestacao_envio_checklist', 'prestacao_envio_arquivos', 'prestacao_devolucoes',
    'prestacao_envios', 'prestacao_envio_itens', 'prestacao_diligencias', 'prestacao_decisoes', 'prestacao_glosas',
    'prestacao_recursos'
  ];
$$;

-- Organização da prestação de teste (…01a0 é de …00a0), sem ler a prestação:
-- quem não a vê ainda precisa ter a leitura dos fornecedores testada.
create function rls_teste.org_da(p uuid) returns uuid language sql immutable as $$
  select overlay(p::text placing '0000000000' from 25 for 10)::uuid;
$$;

-- O que quem edita cria e altera direto: tudo, menos o histórico de status, a
-- importação e os lançamentos do extrato, as verificações e os envios, que só
-- as funções do banco escrevem.
create function rls_teste.editaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(rls_teste.todas(),
    'prestacao_status_log'), 'prestacao_extrato_importacoes'), 'prestacao_lancamentos'), 'prestacao_verificacoes'),
    'prestacao_envios'), 'prestacao_envio_itens');
$$;

-- O que quem edita apaga: também a importação (desfaz o arquivo e leva os
-- lançamentos dela); o lançamento sozinho, o histórico, a verificação e o
-- envio, não.
create function rls_teste.apagaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(array_remove(array_remove(array_remove(rls_teste.todas(), 'prestacao_status_log'), 'prestacao_lancamentos'),
    'prestacao_verificacoes'), 'prestacao_envios'), 'prestacao_envio_itens');
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

-- Em quais tabelas quem está logado vê dados da prestação p. Sem permissão
-- na tabela (o visitante não tem nem a de leitura em algumas) conta como não ver.
create function rls_teste.ve(p uuid) returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito(format('select 1 from public.prestacoes_contas where id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_status_log where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_orcamento_versoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_orcamento_nos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_comprovantes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_atividades where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_atividade_evidencias e join public.prestacao_atividades a on a.id = e.atividade_id where a.prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_relatorio where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_distribuicao where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_pecas where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_alteracoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_contas_bancarias where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_extrato_importacoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_lancamentos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_fornecedores where organization_id = %L', rls_teste.org_da(p))),
    rls_teste.efeito(format('select 1 from public.prestacao_fornecedor_documentos where organization_id = %L', rls_teste.org_da(p))),
    rls_teste.efeito(format('select 1 from public.prestacao_pagamentos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_verificacoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_metas where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_locais where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_evidencias where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_bens where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_envio_checklist where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_envio_arquivos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_devolucoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_envios where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_envio_itens where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_diligencias where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_decisoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_glosas where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_recursos where prestacao_id = %L', p))
  ]);
$$;

create function rls_teste.insere() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$insert into public.prestacoes_contas (titulo, organization_id) values ('RLS nova', 'f0000000-0000-4000-8000-0000000000a0')$c$),
    rls_teste.efeito($c$insert into public.prestacao_status_log (prestacao_id, status_novo) values ('f0000000-0000-4000-8000-0000000001a0', 'rascunho')$c$),
    rls_teste.efeito($c$insert into public.prestacao_orcamento_versoes (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'solicitada')$c$),
    rls_teste.efeito($c$insert into public.prestacao_orcamento_nos (versao_id, prestacao_id, nome) values ('f0000000-0000-4000-8000-0000000002a0', 'f0000000-0000-4000-8000-0000000001a0', 'RLS novo')$c$),
    rls_teste.efeito($c$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'novo.pdf', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000cc0.pdf')$c$),
    rls_teste.efeito($c$insert into public.prestacao_atividades (prestacao_id, titulo, data_realizacao) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS nova', current_date)$c$),
    rls_teste.efeito($c$insert into public.prestacao_atividade_evidencias (atividade_id, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000006a0', 'nova.jpg', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/evidencias/f0000000-0000-4000-8000-000000000ec0.jpg')$c$),
    rls_teste.efeito($c$insert into public.prestacao_relatorio (prestacao_id, secao) values ('f0000000-0000-4000-8000-0000000001a0', 'rls nova')$c$),
    rls_teste.efeito($c$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS novo', 'social', 5)$c$),
    rls_teste.efeito($c$insert into public.prestacao_pecas (prestacao_id, tipo, titulo) values ('f0000000-0000-4000-8000-0000000001a0', 'folder', 'RLS folder')$c$),
    rls_teste.efeito($c$insert into public.prestacao_alteracoes (prestacao_id, versao_id, numero) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000002a0', 2)$c$),
    rls_teste.efeito($c$insert into public.prestacao_contas_bancarias (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'captacao')$c$),
    rls_teste.efeito($c$insert into public.prestacao_extrato_importacoes (prestacao_id, conta_id, formato) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000010a0', 'ofx')$c$),
    rls_teste.efeito($c$insert into public.prestacao_lancamentos (prestacao_id, conta_id, data, natureza, valor, chave) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000010a0', current_date, 'credito', 5, 'rls-2')$c$),
    rls_teste.efeito($c$insert into public.prestacao_fornecedores (organization_id, tipo_pessoa, documento, nome) values ('f0000000-0000-4000-8000-0000000000a0', 'pj', '00000000000191', 'RLS novo')$c$),
    rls_teste.efeito($c$insert into public.prestacao_fornecedor_documentos (fornecedor_id, tipo, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000013a0', 'outro', 'novo.pdf', 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014b0.pdf')$c$),
    rls_teste.efeito($c$insert into public.prestacao_pagamentos (despesa_id, forma, data, valor) values ('f0000000-0000-4000-8000-0000000005a0', 'ted', current_date, 5)$c$),
    rls_teste.efeito($c$insert into public.prestacao_verificacoes (prestacao_id, chave, check_codigo, severidade, resultado, entidade_tipo, mensagem) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS:nova', 'X', 'info', 'revisar', 'prestacao', 'x')$c$),
    rls_teste.efeito($c$insert into public.prestacao_metas (prestacao_id, descricao, previsto) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS nova meta', 1)$c$),
    rls_teste.efeito($c$insert into public.prestacao_locais (prestacao_id, uf, municipio) values ('f0000000-0000-4000-8000-0000000001a0', 'RJ', 'Rio de Janeiro')$c$),
    rls_teste.efeito($c$insert into public.prestacao_evidencias (prestacao_id, tipo, url) values ('f0000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/rls')$c$),
    rls_teste.efeito($c$insert into public.prestacao_bens (prestacao_id, tipo, descricao) values ('f0000000-0000-4000-8000-0000000001a0', 'equipamento', 'RLS novo bem')$c$),
    rls_teste.efeito($c$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao, justificativa) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'documento', 'bens', 'nao_se_aplica', 'Nenhum bem comprado.')$c$),
    rls_teste.efeito($c$insert into public.prestacao_envio_arquivos (prestacao_id, etapa, codigo, storage_path, nome_arquivo) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'relatorio_objeto', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000dd0.pdf', 'relatorio.pdf')$c$),
    rls_teste.efeito($c$insert into public.prestacao_devolucoes (prestacao_id, motivo, valor_principal) values ('f0000000-0000-4000-8000-0000000001a0', 'rendimento', 10)$c$),
    rls_teste.efeito($c$insert into public.prestacao_envios (prestacao_id, etapa, versao, enviado_em, retrato, retrato_sha256) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 9, current_date, '{}', repeat('0', 64))$c$),
    rls_teste.efeito($c$insert into public.prestacao_envio_itens (envio_id, prestacao_id, tabela, registro_id) values ('f0000000-0000-4000-8000-0000000025a0', 'f0000000-0000-4000-8000-0000000001a0', 'prestacao_comprovantes', 'f0000000-0000-4000-8000-0000000005a0')$c$),
    rls_teste.efeito($c$insert into public.prestacao_diligencias (prestacao_id, recebida_em, descricao, situacao, respondida_em) values ('f0000000-0000-4000-8000-0000000001a0', current_date, 'RLS nova diligência', 'respondida', current_date)$c$),
    rls_teste.efeito($c$insert into public.prestacao_decisoes (prestacao_id, resultado, registrada_em, documento_path) values ('f0000000-0000-4000-8000-0000000001a0', 'aprovada', current_date, 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/pos-envio/f0000000-0000-4000-8000-000000000ab1.pdf')$c$),
    rls_teste.efeito($c$insert into public.prestacao_glosas (prestacao_id, descricao, valor) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS nova glosa', 5)$c$),
    rls_teste.efeito($c$insert into public.prestacao_recursos (prestacao_id, decisao_id, protocolado_em) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000027a0', current_date)$c$)
  ]);
$$;

create function rls_teste.altera() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$update public.prestacoes_contas set titulo = titulo where id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$update public.prestacao_status_log set comentario = comentario where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$update public.prestacao_orcamento_versoes set nome = nome where id = 'f0000000-0000-4000-8000-0000000002a1'$c$),
    rls_teste.efeito($c$update public.prestacao_orcamento_nos set nome = nome where id = 'f0000000-0000-4000-8000-0000000003a0'$c$),
    rls_teste.efeito($c$update public.prestacao_comprovantes set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000005a0'$c$),
    rls_teste.efeito($c$update public.prestacao_atividades set titulo = titulo where id = 'f0000000-0000-4000-8000-0000000006a0'$c$),
    rls_teste.efeito($c$update public.prestacao_atividade_evidencias set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000007a0'$c$),
    rls_teste.efeito($c$update public.prestacao_relatorio set secao = secao where id = 'f0000000-0000-4000-8000-0000000008a0'$c$),
    rls_teste.efeito($c$update public.prestacao_distribuicao set produto = produto where id = 'f0000000-0000-4000-8000-0000000009a0'$c$),
    rls_teste.efeito($c$update public.prestacao_pecas set titulo = titulo where id = 'f0000000-0000-4000-8000-000000000aa0'$c$),
    rls_teste.efeito($c$update public.prestacao_alteracoes set justificativa = justificativa where id = 'f0000000-0000-4000-8000-000000000ba0'$c$),
    rls_teste.efeito($c$update public.prestacao_contas_bancarias set apelido = apelido where id = 'f0000000-0000-4000-8000-0000000010a0'$c$),
    rls_teste.efeito($c$update public.prestacao_extrato_importacoes set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000011a0'$c$),
    rls_teste.efeito($c$update public.prestacao_lancamentos set historico = historico where id = 'f0000000-0000-4000-8000-0000000012a0'$c$),
    rls_teste.efeito($c$update public.prestacao_fornecedores set observacoes = observacoes where id = 'f0000000-0000-4000-8000-0000000013a0'$c$),
    rls_teste.efeito($c$update public.prestacao_fornecedor_documentos set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000014a0'$c$),
    rls_teste.efeito($c$update public.prestacao_pagamentos set observacao = observacao where id = 'f0000000-0000-4000-8000-0000000015a0'$c$),
    rls_teste.efeito($c$update public.prestacao_verificacoes set status = 'dispensada' where id = 'f0000000-0000-4000-8000-0000000016a0'$c$),
    rls_teste.efeito($c$update public.prestacao_metas set descricao = descricao where id = 'f0000000-0000-4000-8000-0000000017a0'$c$),
    rls_teste.efeito($c$update public.prestacao_locais set espaco = espaco where id = 'f0000000-0000-4000-8000-0000000018a0'$c$),
    rls_teste.efeito($c$update public.prestacao_evidencias set descricao = descricao where id = 'f0000000-0000-4000-8000-0000000019a0'$c$),
    rls_teste.efeito($c$update public.prestacao_bens set descricao = descricao where id = 'f0000000-0000-4000-8000-0000000021a0'$c$),
    rls_teste.efeito($c$update public.prestacao_envio_checklist set justificativa = justificativa where id = 'f0000000-0000-4000-8000-0000000022a0'$c$),
    rls_teste.efeito($c$update public.prestacao_envio_arquivos set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000023a0'$c$),
    rls_teste.efeito($c$update public.prestacao_devolucoes set descricao = descricao where id = 'f0000000-0000-4000-8000-0000000024a0'$c$),
    rls_teste.efeito($c$update public.prestacao_envios set protocolo = protocolo where id = 'f0000000-0000-4000-8000-0000000025a0'$c$),
    rls_teste.efeito($c$update public.prestacao_envio_itens set storage_path = storage_path where envio_id = 'f0000000-0000-4000-8000-0000000025a0'$c$),
    rls_teste.efeito($c$update public.prestacao_diligencias set resposta = resposta where id = 'f0000000-0000-4000-8000-0000000026a0'$c$),
    rls_teste.efeito($c$update public.prestacao_decisoes set resumo = resumo where id = 'f0000000-0000-4000-8000-0000000027a0'$c$),
    rls_teste.efeito($c$update public.prestacao_glosas set observacoes = observacoes where id = 'f0000000-0000-4000-8000-0000000028a0'$c$),
    rls_teste.efeito($c$update public.prestacao_recursos set pedido = pedido where id = 'f0000000-0000-4000-8000-0000000029a0'$c$)
  ]);
$$;

create function rls_teste.apaga() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$delete from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_status_log where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_orcamento_versoes where id = 'f0000000-0000-4000-8000-0000000002a1'$c$),
    rls_teste.efeito($c$delete from public.prestacao_orcamento_nos where id = 'f0000000-0000-4000-8000-0000000003a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_comprovantes where id = 'f0000000-0000-4000-8000-0000000005a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_atividades where id = 'f0000000-0000-4000-8000-0000000006a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_atividade_evidencias where id = 'f0000000-0000-4000-8000-0000000007a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_relatorio where id = 'f0000000-0000-4000-8000-0000000008a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_distribuicao where id = 'f0000000-0000-4000-8000-0000000009a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_pecas where id = 'f0000000-0000-4000-8000-000000000aa0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_alteracoes where id = 'f0000000-0000-4000-8000-000000000ba0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_contas_bancarias where id = 'f0000000-0000-4000-8000-0000000010a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_extrato_importacoes where id = 'f0000000-0000-4000-8000-0000000011a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_lancamentos where id = 'f0000000-0000-4000-8000-0000000012a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_fornecedores where id = 'f0000000-0000-4000-8000-0000000013a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_fornecedor_documentos where id = 'f0000000-0000-4000-8000-0000000014a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_pagamentos where id = 'f0000000-0000-4000-8000-0000000015a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_verificacoes where id = 'f0000000-0000-4000-8000-0000000016a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_metas where id = 'f0000000-0000-4000-8000-0000000017a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_locais where id = 'f0000000-0000-4000-8000-0000000018a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_evidencias where id = 'f0000000-0000-4000-8000-0000000019a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_bens where id = 'f0000000-0000-4000-8000-0000000021a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_envio_checklist where id = 'f0000000-0000-4000-8000-0000000022a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_envio_arquivos where id = 'f0000000-0000-4000-8000-0000000023a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_devolucoes where id = 'f0000000-0000-4000-8000-0000000024a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_envios where id = 'f0000000-0000-4000-8000-0000000025a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_envio_itens where envio_id = 'f0000000-0000-4000-8000-0000000025a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_diligencias where id = 'f0000000-0000-4000-8000-0000000026a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_decisoes where id = 'f0000000-0000-4000-8000-0000000027a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_glosas where id = 'f0000000-0000-4000-8000-0000000028a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_recursos where id = 'f0000000-0000-4000-8000-0000000029a0'$c$)
  ]);
$$;

-- O que quem está logado faz com o arquivo da prestação de A no bucket.
create function rls_teste.arquivos() returns text[] language sql as $$
  select rls_teste.resumo(array['le', 'envia', 'troca', 'apaga'], array[
    rls_teste.efeito($c$select 1 from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf'$c$),
    rls_teste.efeito($c$insert into storage.objects (bucket_id, name) values ('documentos', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000cd0.pdf')$c$),
    rls_teste.efeito($c$update storage.objects set metadata = metadata where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf'$c$),
    rls_teste.efeito($c$delete from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf'$c$)
  ]);
$$;

-- O que quem está logado faz na pasta de fornecedores da organização A: …14a0
-- é o comprovante registrado na tabela; …14e0 é um arquivo solto na pasta.
create function rls_teste.arquivos_fornecedor() returns text[] language sql as $$
  select rls_teste.resumo(array['le', 'envia', 'troca', 'troca registrado', 'apaga', 'apaga registrado'], array[
    rls_teste.efeito($c$select 1 from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014a0.pdf'$c$),
    rls_teste.efeito($c$insert into storage.objects (bucket_id, name) values ('documentos', 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014c0.pdf')$c$),
    rls_teste.efeito($c$update storage.objects set metadata = metadata where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014e0.pdf'$c$),
    rls_teste.efeito($c$update storage.objects set metadata = metadata where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014a0.pdf'$c$),
    rls_teste.efeito($c$delete from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014e0.pdf'$c$),
    rls_teste.efeito($c$delete from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014a0.pdf'$c$)
  ]);
$$;

grant execute on all functions in schema rls_teste to authenticated, anon;

-- O bucket recusa exclusão direta fora da API de arquivos; aqui a trava sai
-- para o teste olhar só a regra de quem pode apagar.
set local storage.allow_delete_query = 'true';

-- ─── Organização A: admin ───────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'admin: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'admin: cria em tudo, menos no histórico, no extrato e nas verificações (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'admin: altera tudo, menos o histórico, o extrato e as verificações');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'admin: apaga tudo, menos o histórico, o lançamento avulso e as verificações');
select is(rls_teste.arquivos(), array['le', 'envia', 'troca', 'apaga'], 'admin: lê, envia, troca e apaga arquivos da prestação');
select is(rls_teste.arquivos_fornecedor(), array['le', 'envia', 'troca', 'apaga'], 'admin: lê, anexa e mexe no arquivo solto, mas não no comprovante registrado');
reset role;

-- ─── Organização A: colaborador preparador ──────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'colaborador: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'colaborador: cria em tudo, menos no histórico, no extrato e nas verificações (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'colaborador: altera tudo, menos o histórico, o extrato e as verificações');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'colaborador: apaga tudo, menos o histórico, o lançamento avulso e as verificações');
select is(rls_teste.arquivos(), array['le', 'envia', 'troca', 'apaga'], 'colaborador: lê, envia, troca e apaga arquivos da prestação');
reset role;

-- ─── Organização A: colaborador revisor ─────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'revisor: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'revisor: cria em tudo, menos no histórico, no extrato e nas verificações (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'revisor: altera tudo, menos o histórico, o extrato e as verificações');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'revisor: apaga tudo, menos o histórico, o lançamento avulso e as verificações');
select is(rls_teste.arquivos(), array['le', 'envia', 'troca', 'apaga'], 'revisor: lê, envia, troca e apaga arquivos da prestação');
reset role;

-- ─── Organização A: leitor ──────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'leitor: vê tudo da prestação');
select is(rls_teste.insere(), '{}'::text[], 'leitor: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'leitor: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'leitor: não apaga nada');
select is(rls_teste.arquivos(), array['le'], 'leitor: só lê os arquivos da prestação');
select is(rls_teste.arquivos_fornecedor(), array['le'], 'leitor: só lê os comprovantes de fornecedor');
reset role;

-- ─── Organização A: colaborador sem o módulo da prestação ───────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'sem o módulo: não vê a prestação');
select is(rls_teste.insere(), '{}'::text[], 'sem o módulo: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'sem o módulo: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'sem o módulo: não apaga nada');
select is(rls_teste.arquivos(), '{}'::text[], 'sem o módulo: não mexe nos arquivos da prestação');
select is(rls_teste.arquivos_fornecedor(), '{}'::text[], 'sem o módulo: não vê os comprovantes de fornecedor');
select ok(exists (select 1 from storage.objects where bucket_id = 'documentos'
  and name = 'f0000000-0000-4000-8000-0000000000a0/outros/f0000000-0000-4000-8000-000000000cb0.pdf'),
  'sem o módulo: continua lendo os outros arquivos da organização');
reset role;

-- ─── Organização A: captador ────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'captador: não vê a prestação');
select is(rls_teste.insere(), '{}'::text[], 'captador: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'captador: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'captador: não apaga nada');
select is(rls_teste.arquivos(), '{}'::text[], 'captador: não mexe nos arquivos da prestação');
reset role;

-- ─── Organização B: admin ───────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'outra organização: não vê a prestação de A');
select is(rls_teste.insere(), '{}'::text[], 'outra organização: não cria nada em A');
select is(rls_teste.altera(), '{}'::text[], 'outra organização: não altera nada de A');
select is(rls_teste.apaga(), '{}'::text[], 'outra organização: não apaga nada de A');
select is(rls_teste.arquivos(), '{}'::text[], 'outra organização: não mexe nos arquivos de A');
select is(rls_teste.arquivos_fornecedor(), '{}'::text[], 'outra organização: não vê os comprovantes de fornecedor de A');
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001b0'), array['prestacoes_contas', 'prestacao_status_log'],
  'outra organização: vê a própria prestação');
reset role;

-- ─── Organização C, sem o módulo: admin ─────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'organização sem o módulo: não vê a prestação de A');
select is(rls_teste.insere(), '{}'::text[], 'organização sem o módulo: não cria nada em A');
select is(rls_teste.altera(), '{}'::text[], 'organização sem o módulo: não altera nada de A');
select is(rls_teste.apaga(), '{}'::text[], 'organização sem o módulo: não apaga nada de A');
select is(rls_teste.arquivos(), '{}'::text[], 'organização sem o módulo: não mexe nos arquivos de A');
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001c0'), '{}'::text[],
  'organização sem o módulo: não vê nem a própria prestação');
reset role;

-- ─── Visitante ──────────────────────────────────────────────────────────────

set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'visitante: não vê a prestação');
select is(rls_teste.insere(), '{}'::text[], 'visitante: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'visitante: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'visitante: não apaga nada');
select is(rls_teste.arquivos(), '{}'::text[], 'visitante: não mexe nos arquivos');
select is(rls_teste.efeito('select 1 from public.prestacao_regimes'), '', 'visitante: não lê os regimes');
reset role;

-- ─── Status, avaliação e regimes pelas funções ──────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$update public.prestacoes_contas set status = 'revisao_interna' where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  '42501', null, 'colaborador: não muda o status direto na tabela');
select lives_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'revisao_interna', null)$t$,
  'colaborador: manda para a revisão interna pela função');
select throws_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'enviado', null)$t$,
  '42501', null, 'preparador: não envia (decidir é do responsável ou do admin)');
select throws_ok($t$select public.fn_prestacao_avaliar_comprovante('f0000000-0000-4000-8000-0000000005a0', 'aceito')$t$,
  '42501', null, 'preparador: não avalia comprovante');
select throws_ok($t$update public.prestacao_comprovantes set status = 'aceito' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  '42501', null, 'colaborador: não aceita comprovante direto na tabela');
select ok((select count(*) from public.prestacao_regimes where status = 'publicado') > 0,
  'quem está logado lê os regimes publicados');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_avaliar_comprovante('f0000000-0000-4000-8000-0000000005a0', 'aceito')$t$,
  'revisor: avalia comprovante');
select lives_ok($t$select public.fn_prestacao_extrato_importar('f0000000-0000-4000-8000-0000000010a0',
    '{"formato":"csv","hash_arquivo":"rls-hash"}',
    '[{"data":"2026-09-01","natureza":"debito","valor":10,"historico":"x","chave":"rls-3"},{"data":"2026-09-01","natureza":"debito","valor":10,"historico":"RLS tarifa","chave":"rls-1"}]')$t$,
  'quem edita importa extrato pela função (o lançamento repetido fica de fora)');
select throws_ok($t$select public.fn_prestacao_extrato_importar('f0000000-0000-4000-8000-0000000010a0',
    '{"formato":"csv","hash_arquivo":"rls-hash"}', '[{"data":"2026-09-02","natureza":"credito","valor":1,"chave":"rls-4"}]')$t$,
  '23505', null, 'o mesmo arquivo não entra duas vezes');
select throws_ok($t$select public.fn_prestacao_extrato_importar('f0000000-0000-4000-8000-0000000010a0',
    '{"formato":"csv"}', '[{"data":"2026-09-01","natureza":"debito","valor":10,"chave":"rls-3"}]')$t$,
  'P0001', 'extrato_sem_novos', 'arquivo sem lançamento novo é recusado');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'rascunho', null)$t$,
  '42501', null, 'leitor: não muda o status');
select throws_ok($t$select public.fn_prestacao_extrato_importar('f0000000-0000-4000-8000-0000000010a0',
    '{"formato":"csv"}', '[{"data":"2026-09-05","natureza":"credito","valor":1,"chave":"rls-5"}]')$t$,
  '42501', null, 'leitor: não importa extrato');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'rascunho', null)$t$,
  'P0002', null, 'outra organização: a função nem encontra a prestação');
select throws_ok($t$select public.fn_prestacao_extrato_importar('f0000000-0000-4000-8000-0000000010a0',
    '{"formato":"csv"}', '[{"data":"2026-09-05","natureza":"credito","valor":1,"chave":"rls-6"}]')$t$,
  'P0002', null, 'outra organização: a função de importar nem encontra a conta');
reset role;

-- Enviar pede uma verificação e nenhum bloqueio aberto (o cenário traz um).
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'enviado', null)$t$,
  'P0001', 'verificacao_pendente', 'admin: não envia a prestação que nunca foi verificada');
reset role;
update public.prestacoes_contas set verificada_em = now() where id = 'f0000000-0000-4000-8000-0000000001a0';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'enviado', null)$t$,
  'P0001', 'bloqueios_abertos', 'admin: não envia com bloqueio aberto nas verificações');
reset role;
-- Sem o bloqueio (resolvido só aqui; volta a abrir logo depois para os casos das verificações).
update public.prestacao_verificacoes set status = 'resolvida' where id = 'f0000000-0000-4000-8000-0000000016b0';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'enviado', null)$t$,
  'admin: envia a prestação');
reset role;
update public.prestacao_verificacoes set status = 'aberta' where id = 'f0000000-0000-4000-8000-0000000016b0';
update public.prestacoes_contas set verificada_em = null where id = 'f0000000-0000-4000-8000-0000000001a0';
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;

-- ─── Fornecedores: a consulta pública só pela função ────────────────────────

select throws_ok($t$update public.prestacao_fornecedores set situacao_cadastral = 'ATIVA' where id = 'f0000000-0000-4000-8000-0000000013a0'$t$,
  '42501', null, 'quem edita: não grava a situação da Receita na mão');
select throws_ok($t$insert into public.prestacao_fornecedores (organization_id, documento, sancoes_situacao) values ('f0000000-0000-4000-8000-0000000000a0', '00000000000191', 'nada_consta')$t$,
  '42501', null, 'quem edita: não cria fornecedor com sanção já consultada');
select throws_ok($t$insert into public.prestacao_fornecedor_documentos (fornecedor_id, origem, tipo, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000013a0', 'consulta', 'certidao_tcu', 'falsa.pdf', 'f0000000-0000-4000-8000-0000000000a0/fornecedores/f0000000-0000-4000-8000-0000000013a0/f0000000-0000-4000-8000-0000000014d0.pdf')$t$,
  '42501', null, 'quem edita: não cria comprovante como se viesse da consulta');
reset role;

-- A função grava a consulta (aqui, como dono do banco); quem edita troca o documento.
update public.prestacao_fornecedores
   set razao_social = 'RLS RAZAO', sancoes_situacao = 'nada_consta', cnpj_consultado_em = now()
 where id = 'f0000000-0000-4000-8000-0000000013a0';
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
update public.prestacao_fornecedores set documento = '00000000000191' where id = 'f0000000-0000-4000-8000-0000000013a0';
reset role;
select is(
  (select array[razao_social, sancoes_situacao, cnpj_consultado_em::text] from public.prestacao_fornecedores
    where id = 'f0000000-0000-4000-8000-0000000013a0'),
  array[null, null, null]::text[],
  'trocar o documento apaga a consulta do documento anterior');

-- ─── Despesa (P2.4): fornecedor da organização, chave, retenções e CNAEs ───

-- Um fornecedor da organização B, para a despesa de A tentar usar.
insert into public.prestacao_fornecedores (id, organization_id, tipo_pessoa, documento, nome) values
  ('f0000000-0000-4000-8000-0000000013b0', 'f0000000-0000-4000-8000-0000000000b0', 'pj', '11444777000161', 'RLS fornecedor B');

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$update public.prestacao_comprovantes
    set fornecedor_id = 'f0000000-0000-4000-8000-0000000013a0', valor_extraido = 100, iss = 5, inss = 11,
        chave_acesso = '52060433009911002506550120000007800267301615'
  where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'quem edita: liga a despesa a um fornecedor da organização, com chave e retenções');
select is((select valor_liquido from public.prestacao_comprovantes where id = 'f0000000-0000-4000-8000-0000000005a0'),
  84.00::numeric, 'o valor líquido é o bruto menos as retenções');
select throws_ok($t$update public.prestacao_comprovantes set fornecedor_id = 'f0000000-0000-4000-8000-0000000013b0' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  '23514', 'fornecedor_de_outra_organizacao', 'a despesa não usa fornecedor de outra organização');
select throws_ok($t$update public.prestacao_comprovantes set iss = 200 where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  '23514', null, 'as retenções não passam do valor do documento');
select throws_ok($t$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path, chave_acesso) values
    ('f0000000-0000-4000-8000-0000000001a0', 'repetida.pdf',
     'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000cf0.pdf',
     '52060433009911002506550120000007800267301615')$t$,
  '23505', null, 'a mesma chave de acesso não entra duas vezes na prestação');
select throws_ok($t$update public.prestacao_orcamento_nos set cnaes_aceitos = array['9001-9/01'] where id = 'f0000000-0000-4000-8000-0000000003a0'$t$,
  '23514', null, 'o CNAE aceito fica só com os algarismos');
select lives_ok($t$update public.prestacao_orcamento_nos set cnaes_aceitos = array['90', '7420001'] where id = 'f0000000-0000-4000-8000-0000000003a0'$t$,
  'quem edita: define os CNAEs aceitos do item');
select lives_ok($t$select public.fn_prestacao_orcamento_copiar_versao('f0000000-0000-4000-8000-0000000002a0', 'readequada', 'RLS cópia')$t$,
  'quem edita: copia a versão do orçamento');
select is(
  (select n.cnaes_aceitos from public.prestacao_orcamento_nos n
     join public.prestacao_orcamento_versoes v on v.id = n.versao_id
    where v.nome = 'RLS cópia' and n.origem_no_id = 'f0000000-0000-4000-8000-0000000003a0'),
  array['90', '7420001'], 'copiar a versão leva os CNAEs aceitos');

-- ─── Pagamentos (P2.5): prestação vem da despesa, lançamento da mesma prestação ─
select lives_ok($t$update public.prestacao_pagamentos set lancamento_id = 'f0000000-0000-4000-8000-0000000012a0' where id = 'f0000000-0000-4000-8000-0000000015a0'$t$,
  'quem edita: liga o pagamento a um lançamento da prestação');
select throws_ok($t$update public.prestacao_pagamentos set valor = 0 where id = 'f0000000-0000-4000-8000-0000000015a0'$t$,
  '23514', null, 'pagamento tem valor positivo');
reset role;
-- Uma despesa da prestação B, para A tentar pagar.
insert into public.prestacao_comprovantes (id, prestacao_id, nome_arquivo, storage_path) values
  ('f0000000-0000-4000-8000-0000000005b0', 'f0000000-0000-4000-8000-0000000001b0', 'rls-b.pdf',
   'f0000000-0000-4000-8000-0000000000b0/prestacoes/f0000000-0000-4000-8000-0000000001b0/comprovantes/f0000000-0000-4000-8000-000000000cb1.pdf');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$insert into public.prestacao_pagamentos (despesa_id, forma, data, valor) values ('f0000000-0000-4000-8000-0000000005b0', 'pix', current_date, 1)$t$,
  '42501', null, 'outra organização: não lança pagamento na despesa de B');
reset role;

-- ─── Metas e locais (P3.1): vínculos da mesma prestação e justificativas ────
-- Uma meta da prestação B, para A tentar ligar.
insert into public.prestacao_metas (id, prestacao_id, descricao, previsto) values
  ('f0000000-0000-4000-8000-0000000017b0', 'f0000000-0000-4000-8000-0000000001b0', 'RLS meta B', 1);
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$update public.prestacao_atividades set meta_id = 'f0000000-0000-4000-8000-0000000017a0', local_id = 'f0000000-0000-4000-8000-0000000018a0' where id = 'f0000000-0000-4000-8000-0000000006a0'$t$,
  'quem edita: liga a atividade a uma meta e a um local da prestação');
select throws_ok($t$update public.prestacao_atividades set meta_id = 'f0000000-0000-4000-8000-0000000017b0' where id = 'f0000000-0000-4000-8000-0000000006a0'$t$,
  '23514', 'meta_de_outra_prestacao', 'a atividade não usa meta de outra prestação');
select throws_ok($t$update public.prestacao_atividades set status_realizacao = 'nao_realizado' where id = 'f0000000-0000-4000-8000-0000000006a0'$t$,
  '23514', null, 'atividade não realizada pede justificativa');
select throws_ok($t$update public.prestacao_metas set no_id = 'f0000000-0000-4000-8000-0000000003a0' where id = 'f0000000-0000-4000-8000-0000000017a0'$t$,
  '23514', 'no_invalido', 'a meta liga a um agrupador do orçamento, não a um item');
select throws_ok($t$insert into public.prestacao_locais (prestacao_id, uf, municipio, status) values ('f0000000-0000-4000-8000-0000000001a0', 'SP', 'Santos', 'nao_realizado')$t$,
  '23514', null, 'local não realizado pede justificativa');
select throws_ok($t$update public.prestacao_locais set status = 'outras_fontes', justificativa = repeat('x', 501) where id = 'f0000000-0000-4000-8000-0000000018a0'$t$,
  '23514', null, 'a justificativa do local tem até 500 caracteres, como no Salic');
select throws_ok($t$insert into public.prestacao_locais (prestacao_id, municipio) values ('f0000000-0000-4000-8000-0000000001a0', 'Santos')$t$,
  '23514', null, 'local no Brasil pede UF e município');

-- ─── Evidências (P3.2): arquivo ou link, vínculos e pasta da própria prestação ─
select lives_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, url, requisitos, local_id) values ('f0000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/video', array['acessibilidade', 'democratizacao'], 'f0000000-0000-4000-8000-0000000018a0')$t$,
  'quem edita: registra um link como evidência de acessibilidade, ligado ao local');
select throws_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'foto')$t$,
  '23514', null, 'evidência tem arquivo ou link');
select throws_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, url, meta_id) values ('f0000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/x', 'f0000000-0000-4000-8000-0000000017b0')$t$,
  '23514', 'meta_de_outra_prestacao', 'a evidência não usa meta de outra prestação');
select throws_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'foto', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000ef1.jpg')$t$,
  '23514', 'caminho_invalido', 'o arquivo da evidência fica na pasta de evidências da prestação');
select throws_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, url, requisitos) values ('f0000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/y', array['qualquer'])$t$,
  '23514', null, 'requisito fora da lista é recusado');

-- ─── Distribuição (P3.4): categoria do regime, preço e meia só onde há venda ─
select lives_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade, quantidade_meia, preco, beneficiario_documento) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'popular', 100, 40, 50, null)$t$,
  'quem edita: registra a venda a preço popular com a meia-entrada');
select throws_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'venda', 100)$t$,
  '23514', null, 'venda pede o preço do ingresso inteiro');
select throws_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade, preco) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'social', 10, 20)$t$,
  '23514', null, 'cota gratuita não tem preço');
select throws_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade, quantidade_meia, preco) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'venda', 10, 11, 80)$t$,
  '23514', null, 'a meia-entrada é parte da quantidade');
select throws_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'cortesia', 10)$t$,
  '23514', null, 'categoria fora do regime é recusada');
select throws_ok($t$insert into public.prestacao_distribuicao (prestacao_id, produto, categoria, quantidade, beneficiario_documento) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS show', 'educativo', 10, '12.345.678/0001-95')$t$,
  '23514', null, 'o documento de quem recebe é guardado só com letras e números');

-- ─── Bens (P3.5): item e despesa da prestação, cotações e pasta bens ────────
select lives_ok($t$update public.prestacao_orcamento_nos set bem_permanente = true where id = 'f0000000-0000-4000-8000-0000000003a0'$t$,
  'quem edita: marca o item como bem permanente');
select throws_ok($t$insert into public.prestacao_orcamento_nos (versao_id, prestacao_id, tipo, nome, bem_permanente) values ('f0000000-0000-4000-8000-0000000002a0', 'f0000000-0000-4000-8000-0000000001a0', 'etapa', 'RLS etapa bem', true)$t$,
  '23514', null, 'só item da planilha é bem permanente');
select lives_ok($t$insert into public.prestacao_bens (id, prestacao_id, no_id, despesa_id, tipo, descricao, cotacoes, destinacao, doacao_storage_path) values ('f0000000-0000-4000-8000-0000000020a0', 'f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000003a0', 'f0000000-0000-4000-8000-0000000005a0', 'equipamento', 'RLS projetor', '[{"fornecedor":"Loja A","valor":100,"data":"2026-09-01","storage_path":"f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/bens/f0000000-0000-4000-8000-000000000ba1.pdf"},{"fornecedor":"Loja B","valor":120,"data":null}]', 'doacao', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/bens/f0000000-0000-4000-8000-000000000ba2.pdf')$t$,
  'quem edita: registra o bem com o item, a despesa, duas cotações e o termo de doação');
select throws_ok($t$insert into public.prestacao_bens (prestacao_id, despesa_id, tipo, descricao) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000005b0', 'movel', 'RLS bem B')$t$,
  '23514', 'despesa_de_outra_prestacao', 'o bem não usa despesa de outra prestação');
select throws_ok($t$insert into public.prestacao_bens (prestacao_id, tipo, descricao, cotacoes) values ('f0000000-0000-4000-8000-0000000001a0', 'movel', 'RLS quatro', '[{"fornecedor":"A","valor":1},{"fornecedor":"B","valor":1},{"fornecedor":"C","valor":1},{"fornecedor":"D","valor":1}]')$t$,
  '23514', null, 'até três cotações');
select throws_ok($t$insert into public.prestacao_bens (prestacao_id, tipo, descricao, cotacoes) values ('f0000000-0000-4000-8000-0000000001a0', 'movel', 'RLS cotação', '[{"fornecedor":"A","valor":"cem"}]')$t$,
  '23514', 'cotacao_invalida', 'a cotação tem fornecedor e valor numérico');
select throws_ok($t$insert into public.prestacao_bens (prestacao_id, tipo, descricao, aceite_storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'movel', 'RLS aceite', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000ba3.pdf')$t$,
  '23514', 'caminho_invalido', 'o aceite fica na pasta bens da prestação');
-- Ativar outra versão leva o bem e a meta para os nós correspondentes.
select lives_ok($t$insert into public.prestacao_orcamento_nos (id, versao_id, prestacao_id, tipo, nome) values ('f0000000-0000-4000-8000-0000000003a2', 'f0000000-0000-4000-8000-0000000002a0', 'f0000000-0000-4000-8000-0000000001a0', 'etapa', 'RLS etapa')$t$,
  'quem edita: cria um agrupador');
select lives_ok($t$update public.prestacao_metas set no_id = 'f0000000-0000-4000-8000-0000000003a2' where id = 'f0000000-0000-4000-8000-0000000017a0'$t$,
  'quem edita: liga a meta ao agrupador');
select lives_ok($t$select public.fn_prestacao_orcamento_copiar_versao('f0000000-0000-4000-8000-0000000002a0', 'readequada', 'RLS cópia bens')$t$,
  'quem edita: copia a versão com o bem permanente');
select is(
  (select n.bem_permanente from public.prestacao_orcamento_nos n
     join public.prestacao_orcamento_versoes v on v.id = n.versao_id
    where v.nome = 'RLS cópia bens' and n.origem_no_id = 'f0000000-0000-4000-8000-0000000003a0'),
  true, 'copiar a versão leva a marca de bem permanente');
select lives_ok($t$select public.fn_prestacao_orcamento_ativar_versao((select id from public.prestacao_orcamento_versoes where nome = 'RLS cópia bens'))$t$,
  'quem decide: ativa a versão copiada');
select is((select n.origem_no_id from public.prestacao_bens b join public.prestacao_orcamento_nos n on n.id = b.no_id where b.id = 'f0000000-0000-4000-8000-0000000020a0'),
  'f0000000-0000-4000-8000-0000000003a0'::uuid, 'ativar a versão leva o bem para o item correspondente');
select is((select n.origem_no_id from public.prestacao_metas m join public.prestacao_orcamento_nos n on n.id = m.no_id where m.id = 'f0000000-0000-4000-8000-0000000017a0'),
  'f0000000-0000-4000-8000-0000000003a2'::uuid, 'ativar a versão leva a meta para o agrupador correspondente');

-- ─── Peças (P3.6): aprovação com datas, período e amostra na pasta pecas ────
select lives_ok($t$insert into public.prestacao_pecas (prestacao_id, tipo, titulo, meio, veiculacao_inicio, veiculacao_fim, marcas, aprovacao_status, aprovacao_protocolo, aprovacao_enviada_em, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'rede_social', 'RLS post', 'Instagram', '2026-08-01', '2026-08-10', array['Ministério da Cultura', 'Lei de Incentivo à Cultura (Lei Rouanet)'], 'enviada', '01400.000123/2026-11', '2026-07-20', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/pecas/f0000000-0000-4000-8000-000000000aa1.png')$t$,
  'quem edita: registra a peça com as marcas, o envio para aprovação e a amostra');
select throws_ok($t$insert into public.prestacao_pecas (prestacao_id, tipo, titulo, aprovacao_status) values ('f0000000-0000-4000-8000-0000000001a0', 'cartaz', 'RLS sem data', 'enviada')$t$,
  '23514', null, 'peça enviada tem a data do envio');
select throws_ok($t$insert into public.prestacao_pecas (prestacao_id, tipo, titulo, aprovacao_status, aprovacao_enviada_em) values ('f0000000-0000-4000-8000-0000000001a0', 'cartaz', 'RLS sem decisão', 'aprovada', '2026-07-20')$t$,
  '23514', null, 'peça aprovada tem a data da decisão');
select throws_ok($t$insert into public.prestacao_pecas (prestacao_id, tipo, titulo, veiculacao_inicio, veiculacao_fim) values ('f0000000-0000-4000-8000-0000000001a0', 'cartaz', 'RLS período', '2026-08-10', '2026-08-01')$t$,
  '23514', null, 'a veiculação não termina antes de começar');
select throws_ok($t$insert into public.prestacao_pecas (prestacao_id, tipo, titulo, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'cartaz', 'RLS pasta', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/bens/f0000000-0000-4000-8000-000000000aa2.png')$t$,
  '23514', 'caminho_invalido', 'a amostra fica na pasta pecas da prestação');

-- ─── Checklist de envio (P4.1): item do regime, motivo e pasta envio ────────
select lives_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'documento', 'relatorio_objeto', 'pronto')$t$,
  'quem edita: marca um documento do regime como pronto');
select throws_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao, justificativa) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'documento', 'comprovantes_despesa', 'nao_se_aplica', 'Não houve despesa.')$t$,
  '23514', 'obrigatorio_nao_se_dispensa', 'documento obrigatório não aceita "não se aplica"');
select throws_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao, justificativa) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'condicao', 'aportes_validados', 'nao_se_aplica', 'Sem aporte no período.')$t$,
  '23514', 'obrigatorio_nao_se_dispensa', 'condição que bloqueia o envio não aceita "não se aplica"');
select throws_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao, justificativa) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'documento', 'cotacoes', 'nao_se_aplica', ' ')$t$,
  '23514', null, '"não se aplica" pede o motivo');
select throws_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao) values ('f0000000-0000-4000-8000-0000000001a0', 'parcial', 'documento', 'relatorio_objeto', 'pronto')$t$,
  '23514', 'item_fora_do_regime', 'a Rouanet não tem documento de prestação parcial');
select throws_ok($t$insert into public.prestacao_envio_checklist (prestacao_id, etapa, tipo, codigo, situacao) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'documento', 'rp', 'pronto')$t$,
  '23514', 'item_fora_do_regime', 'documento de outro regime é recusado');
select lives_ok($t$insert into public.prestacao_envio_arquivos (prestacao_id, etapa, codigo, storage_path, nome_arquivo, mime_type, tamanho_bytes) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'aceitacao_obra', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000db0.pdf', 'termo.pdf', 'application/pdf', 1024)$t$,
  'quem edita: anexa o termo de aceitação ao documento');
select throws_ok($t$insert into public.prestacao_envio_arquivos (prestacao_id, etapa, codigo, storage_path, nome_arquivo) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'aceitacao_obra', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/pecas/f0000000-0000-4000-8000-000000000dc0.pdf', 'termo.pdf')$t$,
  '23514', 'caminho_invalido', 'o arquivo do envio fica na pasta envio da prestação');
select throws_ok($t$insert into public.prestacao_envio_arquivos (prestacao_id, etapa, codigo, storage_path, nome_arquivo) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 'etapas_lancadas', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000de0.pdf', 'print.pdf')$t$,
  '23514', 'item_fora_do_regime', 'arquivo só em documento do regime, não em condição');

-- ─── Devoluções (P4.4): atualização com data-base, pagamento completo, pasta devolucoes ─
select lives_ok($t$insert into public.prestacao_devolucoes (prestacao_id, motivo, valor_principal, indice, data_base, atualizado_ate, fator, valor_atualizado, gru_unidade_gestora, gru_codigo, gru_referencia, competencia, vencimento, situacao, pago_em, valor_pago, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'glosa', 1000, 'poupanca', '2026-01-10', '2026-10-07', 1.0612345678, 1061.23, '340034', '019473', '269999', '10/2026', '2026-10-27', 'paga', '2026-10-07', 1061.23, 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/devolucoes/f0000000-0000-4000-8000-000000000fa0.pdf')$t$,
  'quem edita: registra a devolução atualizada pela poupança, com a guia e o pagamento');
select throws_ok($t$insert into public.prestacao_devolucoes (prestacao_id, motivo, valor_principal, indice) values ('f0000000-0000-4000-8000-0000000001a0', 'glosa', 100, 'poupanca')$t$,
  '23514', null, 'atualização pede a data-base');
select throws_ok($t$insert into public.prestacao_devolucoes (prestacao_id, motivo, valor_principal, situacao) values ('f0000000-0000-4000-8000-0000000001a0', 'saldo', 100, 'paga')$t$,
  '23514', null, 'devolução paga tem a data e o valor pagos');
select throws_ok($t$insert into public.prestacao_devolucoes (prestacao_id, motivo, valor_principal, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'saldo', 100, 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000fb0.pdf')$t$,
  '23514', 'caminho_invalido', 'o comprovante fica na pasta devolucoes da prestação');
reset role;

-- ─── Verificações (P2.7): o servidor grava; as pessoas decidem pela função ──
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_verificacoes_sincronizar('f0000000-0000-4000-8000-0000000001a0', '[]')$t$,
  '42501', null, 'quem usa o app: não sincroniza verificações (só o servidor)');
select throws_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016a0', 'justificada', ' ')$t$,
  '23514', 'justificativa_obrigatoria', 'justificar pede texto');
select lives_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016a0', 'justificada', 'Dispensa legal anexada ao documento.')$t$,
  'preparador: justifica um alerta');
select throws_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016b0', 'justificada', 'Explicação qualquer.')$t$,
  '23514', 'bloqueio_nao_se_justifica', 'bloqueio não se justifica');
select throws_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016b0', 'dispensada', 'Débito estornado no dia seguinte.')$t$,
  '42501', null, 'preparador: não dispensa (é do revisor)');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016b0', 'dispensada', 'Débito estornado no dia seguinte.')$t$,
  'revisor: dispensa com o motivo');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016a0', 'aberta')$t$,
  '42501', null, 'leitor: não decide verificação');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_verificacao_decidir('f0000000-0000-4000-8000-0000000016a0', 'aberta')$t$,
  'P0002', null, 'outra organização: a função nem encontra a verificação');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$update public.prestacoes_contas set verificada_em = now() where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  '42501', null, 'quem edita: não grava a hora da verificação na mão');
reset role;

-- O servidor manda o alerta justificado de novo (com outro texto), um achado
-- novo que a despesa já justifica e deixa de mandar o "sumiu" e o bloqueio dispensado.
set local role service_role;
select lives_ok($t$select public.fn_prestacao_verificacoes_sincronizar('f0000000-0000-4000-8000-0000000001a0', '[
    {"chave":"RLS:alerta","codigo":"DOC_PJ_SEM_NF","severidade":"alerta","resultado":"revisar","entidade_tipo":"despesa","entidade_id":"f0000000-0000-4000-8000-0000000005a0","mensagem":"RLS alerta, texto novo"},
    {"chave":"RLS:nova","codigo":"DESPESA_SEM_ITEM","severidade":"alerta","resultado":"nao_calculavel","entidade_tipo":"despesa","entidade_id":"f0000000-0000-4000-8000-0000000005a0","mensagem":"RLS nova","justificativa":"Já explicado na despesa."}
  ]')$t$,
  'o servidor sincroniza as verificações');
reset role;
select is(
  (select array_agg(chave || '=' || status order by chave) from public.prestacao_verificacoes
    where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'),
  array['RLS:alerta=justificada', 'RLS:bloqueio=dispensada', 'RLS:nova=justificada', 'RLS:sumiu=resolvida'],
  'sincronizar: a decisão das pessoas fica, a justificativa da despesa vale e o que sumiu se resolve');
select ok((select verificada_em is not null from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'),
  'sincronizar grava a hora da verificação');

-- ─── Leitura por IA (P2.10b): chamadas só do servidor; motivos na despesa ──
set local role service_role;
select lives_ok($t$insert into public.prestacao_ia_chamadas (organization_id, prestacao_id, funcao, modelo, sucesso, tokens_entrada, tokens_saida)
    values ('f0000000-0000-4000-8000-0000000000a0', 'f0000000-0000-4000-8000-0000000001a0', 'extrair-comprovante', 'modelo-teste', true, 10, 5)$t$,
  'o servidor registra a chamada à IA');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select 1 from public.prestacao_ia_chamadas$t$,
  '42501', null, 'admin: não lê as chamadas à IA (só o servidor)');
select throws_ok($t$insert into public.prestacao_ia_chamadas (funcao, modelo, sucesso) values ('extrair-comprovante', 'x', true)$t$,
  '42501', null, 'admin: não grava chamada à IA');
select lives_ok($t$update public.prestacao_comprovantes set motivos_ia = '[]' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'quem edita: descarta os motivos da leitura por IA');
select throws_ok($t$update public.prestacao_comprovantes set motivos_ia = '{"codigo":"DOC_ILEGIVEL"}' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  '23514', null, 'motivos da IA são uma lista');
reset role;

-- ─── Envio registrado (P4.6): retrato, travas, guarda e reabertura ──────────
-- A prestação de A está enviada, verificada e sem bloqueio aberto.
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date, 'X', '{"arquivos":[]}')$t$,
  '42501', null, 'preparador: não registra o envio (decidir é do responsável ou do admin)');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date + 1)$t$,
  'P0001', 'envio_data_invalida', 'o envio não tem data futura');
select throws_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date, null, '{"arquivos":{}}')$t$,
  'P0001', 'manifesto_invalido', 'o manifesto traz a lista de arquivos');
select lives_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date, 'PRONAC 269999, protocolo 123', '{"arquivos":[{"arquivo":"comprovantes/001.pdf","sha256":"ab"}]}', 'Enviado pelo Salic')$t$,
  'admin: registra o envio final, com o protocolo e o manifesto');
select is((select array[status::text, data_envio::text] from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'),
  array['enviado', current_date::text], 'o envio final deixa a prestação enviada, com a data do envio');
select is((select array[versao::text, jsonb_array_length(retrato -> 'despesas')::text,
                        (retrato_sha256 = encode(extensions.digest(convert_to(retrato::text, 'UTF8'), 'sha256'), 'hex'))::text]
             from public.prestacao_envios where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final'),
  array['1', '1', 'true'], 'o retrato traz a despesa e o SHA-256 dele confere');
select ok(exists (select 1 from public.prestacao_envio_itens where tabela = 'prestacao_comprovantes'
                   and registro_id = 'f0000000-0000-4000-8000-0000000005a0' and storage_path like '%/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf'),
  'o arquivo da despesa entra na lista do que foi enviado');
select throws_ok($t$update public.prestacao_comprovantes set nome_arquivo = 'outro.pdf' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'P0001', 'enviado_travado', 'a despesa enviada não muda enquanto o envio vale');
select throws_ok($t$delete from public.prestacao_pagamentos where id = 'f0000000-0000-4000-8000-0000000015a0'$t$,
  'P0001', 'enviado_guardado', 'o pagamento enviado não sai');
select lives_ok($t$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'nova.pdf', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c90.pdf')$t$,
  'uma despesa nova entra depois do envio');
select is(rls_teste.arquivos(), array['le', 'envia'], 'admin: o arquivo enviado não sai nem é trocado no bucket');
select throws_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date)$t$,
  'P0001', 'envio_vigente', 'não há dois envios valendo na mesma etapa');
select throws_ok($t$insert into public.prestacao_envios (prestacao_id, etapa, versao, enviado_em, retrato, retrato_sha256) values ('f0000000-0000-4000-8000-0000000001a0', 'final', 9, current_date, '{}', repeat('0', 64))$t$,
  '42501', null, 'admin: não grava envio direto na tabela');
select throws_ok($t$delete from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  'P0001', 'enviado_guardado', 'a prestação com envio em guarda não é apagada');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_reabrir_envio((select id from public.prestacao_envios where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final'), 'Diligência pediu a nota corrigida.')$t$,
  '42501', null, 'preparador: não reabre o envio');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_reabrir_envio((select id from public.prestacao_envios where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final'), 'curto')$t$,
  'P0001', 'reabertura_sem_motivo', 'reabrir pede o motivo');
select lives_ok($t$select public.fn_prestacao_reabrir_envio((select id from public.prestacao_envios where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final'), 'Diligência pediu a nota fiscal corrigida.')$t$,
  'admin: reabre o envio com o motivo');
select is((select status::text from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'),
  'ajuste_solicitado', 'reabrir devolve a prestação para ajuste');
select lives_ok($t$update public.prestacao_comprovantes set nome_arquivo = 'corrigida.pdf' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'reaberto: a despesa enviada volta a mudar');
select throws_ok($t$delete from public.prestacao_comprovantes where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'P0001', 'enviado_guardado', 'reaberto: a despesa enviada continua guardada');
select lives_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'final', current_date, 'Protocolo 124')$t$,
  'admin: registra a correção');
select is((select array_agg(versao || ':' || situacao order by versao) from public.prestacao_envios
            where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final'),
  array['1:reaberto', '2:vigente'], 'a correção vira a versão 2; a primeira fica reaberta no histórico');
reset role;
select throws_ok($t$update public.prestacao_envios set retrato = '{}' where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and etapa = 'final' and versao = 1$t$,
  'P0001', 'envio_imutavel', 'nem o dono do banco reescreve o retrato');

-- ─── Depois do envio (P4.7): prazos do regime, atividades, trava e guarda ───
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$insert into public.prestacao_diligencias (prestacao_id, recebida_em, descricao) values ('f0000000-0000-4000-8000-0000000001a0', '2026-11-03', 'RLS análise preditiva')$t$,
  'quem edita: registra a diligência recebida');
reset role;
select is((select array[numero::text, prazo::text, prazo_regime::text] from public.prestacao_diligencias where descricao = 'RLS análise preditiva'),
  array['2', '2026-11-23', '2026-11-23'], 'a diligência ganha o número e o prazo do regime (20 dias corridos na Rouanet)');
select ok(exists (select 1 from public.atividades a join public.prestacao_diligencias d on d.atividade_id = a.id
                   where d.descricao = 'RLS análise preditiva' and a.regra_origem = 'prestacao_diligencia'
                     and a.data_prevista::date = '2026-11-23' and not coalesce(a.feita, false)),
  'a diligência aberta vira atividade com o prazo');
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_registrar_envio('f0000000-0000-4000-8000-0000000001a0', 'parcial', current_date)$t$,
  'P0001', 'diligencia_aberta', 'diligência aberta trava o próximo envio');
select lives_ok($t$update public.prestacao_diligencias set situacao = 'respondida', respondida_em = '2026-11-10', resposta = 'Notas reenviadas.' where descricao = 'RLS análise preditiva'$t$,
  'quem edita: registra a resposta da diligência');
reset role;
select ok(exists (select 1 from public.atividades a join public.prestacao_diligencias d on d.atividade_id = a.id
                   where d.descricao = 'RLS análise preditiva' and coalesce(a.feita, false)),
  'responder conclui a atividade da diligência');
-- Um envio guardado até a decisão, para a decisão fechar a guarda.
insert into public.prestacao_envios (id, prestacao_id, etapa, versao, enviado_em, retrato, retrato_sha256, guarda_marco,
                                     situacao, reaberto_em, motivo_reabertura) values
  ('f0000000-0000-4000-8000-0000000025b0', 'f0000000-0000-4000-8000-0000000001a0', 'parcial', 3, '2026-01-01', '{}', repeat('0', 64),
   'registro_decisao', 'reaberto', now(), 'Envio do cenário guardado até a decisão.');
set local role authenticated;
select throws_ok($t$insert into public.prestacao_decisoes (prestacao_id, resultado, registrada_em) values ('f0000000-0000-4000-8000-0000000001a0', 'reprovada', '2026-10-20')$t$,
  '23502', null, 'a decisão traz o documento');
select throws_ok($t$insert into public.prestacao_decisoes (prestacao_id, resultado, registrada_em, documento_path) values ('f0000000-0000-4000-8000-0000000001a0', 'reprovada', '2026-10-20', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000ab2.pdf')$t$,
  '23514', 'caminho_invalido', 'o documento da decisão fica na pasta pos-envio da prestação');
select lives_ok($t$insert into public.prestacao_decisoes (id, prestacao_id, resultado, registrada_em, ciencia_em, valor_glosado, documento_path) values ('f0000000-0000-4000-8000-0000000027b0', 'f0000000-0000-4000-8000-0000000001a0', 'reprovada', '2026-10-20', '2026-10-22', 100, 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/pos-envio/f0000000-0000-4000-8000-000000000ab3.pdf')$t$,
  'quem edita: registra a decisão com o documento');
reset role;
select is((select array[prazo_recurso::text, prazo_devolucao::text] from public.prestacao_decisoes where id = 'f0000000-0000-4000-8000-0000000027b0'),
  array['2026-11-23', '2026-11-09'], 'recurso em 30 dias da ciência (do sábado para segunda) e devolução em 20 dias do registro');
select is((select guarda_ate::text from public.prestacao_envios where id = 'f0000000-0000-4000-8000-0000000025b0'),
  '2031-10-20', 'a decisão fecha a guarda dos envios que contam dela');
select ok(exists (select 1 from public.atividades a join public.prestacao_decisoes d on d.atividade_id = a.id
                   where d.id = 'f0000000-0000-4000-8000-0000000027b0' and a.regra_origem = 'prestacao_recurso' and not coalesce(a.feita, false)),
  'o prazo de recurso vira atividade');
set local role authenticated;
select lives_ok($t$insert into public.prestacao_recursos (prestacao_id, decisao_id, protocolado_em, pedido) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000027b0', '2026-11-10', 'Reconsideração da glosa.')$t$,
  'quem edita: registra o recurso');
reset role;
select ok(exists (select 1 from public.atividades a join public.prestacao_decisoes d on d.atividade_id = a.id
                   where d.id = 'f0000000-0000-4000-8000-0000000027b0' and coalesce(a.feita, false)),
  'registrar o recurso conclui a atividade do prazo');
set local role authenticated;
select throws_ok($t$insert into public.prestacao_glosas (prestacao_id, despesa_id, descricao, valor) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000005b0', 'RLS glosa de B', 10)$t$,
  '23514', 'vinculo_de_outra_prestacao', 'a glosa não usa despesa de outra prestação');
select lives_ok($t$insert into public.prestacao_glosas (prestacao_id, decisao_id, despesa_id, descricao, valor, data_base) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000027b0', 'f0000000-0000-4000-8000-0000000005a0', 'RLS nota sem identificação', 100, '2026-03-01')$t$,
  'quem edita: registra a glosa da despesa, com a data-base');
select lives_ok($t$insert into public.prestacao_devolucoes (id, prestacao_id, motivo, valor_principal, vencimento) values ('f0000000-0000-4000-8000-0000000024b0', 'f0000000-0000-4000-8000-0000000001a0', 'glosa', 100, '2026-11-09')$t$,
  'quem edita: registra a devolução da glosa com o vencimento');
reset role;
select ok(exists (select 1 from public.atividades a join public.prestacao_devolucoes d on d.atividade_id = a.id
                   where d.id = 'f0000000-0000-4000-8000-0000000024b0' and a.regra_origem = 'prestacao_devolucao'
                     and a.data_prevista::date = '2026-11-09' and not coalesce(a.feita, false)),
  'a GRU a pagar vira atividade com o vencimento');
set local role authenticated;
select lives_ok($t$update public.prestacao_devolucoes set situacao = 'paga', pago_em = '2026-11-05', valor_pago = 100 where id = 'f0000000-0000-4000-8000-0000000024b0'$t$,
  'quem edita: registra o pagamento da GRU');
reset role;
select ok(exists (select 1 from public.atividades a join public.prestacao_devolucoes d on d.atividade_id = a.id
                   where d.id = 'f0000000-0000-4000-8000-0000000024b0' and coalesce(a.feita, false)),
  'pagar a GRU conclui a atividade');
select throws_ok($t$update public.prestacao_envios set guarda_ate = '2027-01-01' where id = 'f0000000-0000-4000-8000-0000000025b0'$t$,
  'P0001', 'envio_imutavel', 'a guarda só cresce, nunca diminui');

select * from finish();
rollback;
