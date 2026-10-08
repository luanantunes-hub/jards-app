-- P0.8: quem lê, cria, altera e apaga cada parte da prestação de contas.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A, com o módulo da prestação:
--     admin (captação e prestação), colaborador preparador, colaborador
--     revisor, leitor, colaborador sem o módulo da prestação, captador;
--   organização B, com o módulo: admin;
--   organização C, sem o módulo: admin com acesso aos dois módulos;
--   convidado de fora (P5.3), com convite aceito só para o financeiro de A;
--   proponente da prestação de A (P5.4), membro de A sem o módulo e ligado ao
--   cadastro do proponente;
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

select plan(325);

-- ─── Cenário ────────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f0000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f0000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f0000000-0000-4000-8000-0000000000c0';
  admin_a uuid := 'f0000000-0000-4000-8000-0000000000a1';
  pa uuid := 'f0000000-0000-4000-8000-0000000001a0';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'rls-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array[
    'f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000a2',
    'f0000000-0000-4000-8000-0000000000a3', 'f0000000-0000-4000-8000-0000000000a4',
    'f0000000-0000-4000-8000-0000000000a5', 'f0000000-0000-4000-8000-0000000000a6',
    'f0000000-0000-4000-8000-0000000000b1', 'f0000000-0000-4000-8000-0000000000c1',
    'f0000000-0000-4000-8000-0000000000a7', 'f0000000-0000-4000-8000-0000000000a8'
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
    (org_c, 'f0000000-0000-4000-8000-0000000000c1', 'admin', '{captacao,prestacao}', null),
    (org_a, 'f0000000-0000-4000-8000-0000000000a8', 'proponente', '{captacao}', null);
  -- O cadastro do proponente de A, ligado à conta …00a8 (P5.4).
  insert into public.proponentes (id, account_id, organization_id, nome, user_id) values
    ('f0000000-0000-4000-8000-0000000032a0', admin_a, org_a, 'RLS Proponente', 'f0000000-0000-4000-8000-0000000000a8');

  -- A prestação de A é da Rouanet: o checklist de envio (P4.1) confere os itens no regime.
  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por, regime_id, proponente_id) values
    (pa, 'RLS prestação A', org_a, admin_a,
     (select id from public.prestacao_regimes where codigo = 'rouanet_in29_2026' and status = 'publicado' order by versao desc limit 1),
     'f0000000-0000-4000-8000-0000000032a0'),
    ('f0000000-0000-4000-8000-0000000001b0', 'RLS prestação B', org_b, 'f0000000-0000-4000-8000-0000000000b1', null, null),
    ('f0000000-0000-4000-8000-0000000001c0', 'RLS prestação C', org_c, 'f0000000-0000-4000-8000-0000000000c1', null, null);

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
  -- Relatório do patrocinador (P5.2): uma empresa do CRM de A e um link, de endereço conhecido no teste.
  insert into public.empresas_crm (id, account_id, organization_id, nome) values
    ('f0000000-0000-4000-8000-0000000031a0', admin_a, org_a, 'RLS Patrocinador');
  insert into public.prestacao_links_patrocinador (id, prestacao_id, empresa_crm_id, patrocinador, token_hash, expira_em) values
    ('f0000000-0000-4000-8000-0000000030a0', pa, 'f0000000-0000-4000-8000-0000000031a0', 'RLS Patrocinador',
     encode(extensions.digest(repeat('a', 48), 'sha256'), 'hex'), current_date + 30);
  -- Convidados (P5.3): …00a7, de fora, aceitou o convite do financeiro e já
  -- marcou a despesa; o admin de C tem um convite do objeto ainda por aceitar.
  insert into public.prestacao_convidados (id, prestacao_id, email, papel, secoes, token_hash, expira_em, user_id, aceito_em) values
    ('f0000000-0000-4000-8000-0000000040a0', pa, 'rls-f0000000-0000-4000-8000-0000000000a7@teste.invalid', 'contador', '{financeiro}',
     encode(extensions.digest(repeat('e', 48), 'sha256'), 'hex'), current_date + 30, 'f0000000-0000-4000-8000-0000000000a7', now()),
    ('f0000000-0000-4000-8000-0000000042a0', pa, 'rls-f0000000-0000-4000-8000-0000000000c1@teste.invalid', 'auditor', '{objeto}',
     encode(extensions.digest(repeat('d', 48), 'sha256'), 'hex'), current_date + 30, null, null);
  -- Um e-mail que chegou pela captura (P5.5).
  insert into public.prestacao_emails_recebidos (id, prestacao_id, resend_email_id, remetente, assunto, situacao, anexos, despesas) values
    ('f0000000-0000-4000-8000-0000000044a0', pa, 'rls-email-1', 'rls@teste.invalid', 'RLS nota', 'registrado', 1, 1);
  insert into public.prestacao_convidado_notas (id, prestacao_id, convidado_id, autor_id, entidade_tipo, entidade_id, tipo) values
    ('f0000000-0000-4000-8000-0000000041a0', pa, 'f0000000-0000-4000-8000-0000000040a0', 'f0000000-0000-4000-8000-0000000000a7',
     'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'verificado');

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
    'prestacao_recursos', 'prestacao_links_patrocinador', 'prestacao_convidados', 'prestacao_convidado_notas',
    'prestacao_emails_recebidos'
  ];
$$;

-- Organização da prestação de teste (…01a0 é de …00a0), sem ler a prestação:
-- quem não a vê ainda precisa ter a leitura dos fornecedores testada.
create function rls_teste.org_da(p uuid) returns uuid language sql immutable as $$
  select overlay(p::text placing '0000000000' from 25 for 10)::uuid;
$$;

-- O que quem edita cria e altera direto: tudo, menos o histórico de status, a
-- importação e os lançamentos do extrato, as verificações, os envios, os links
-- do patrocinador, os convidados e os e-mails recebidos, que só as funções do
-- banco e o servidor escrevem.
create function rls_teste.editaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(rls_teste.todas(),
    'prestacao_status_log'), 'prestacao_extrato_importacoes'), 'prestacao_lancamentos'), 'prestacao_verificacoes'),
    'prestacao_envios'), 'prestacao_envio_itens'), 'prestacao_links_patrocinador'), 'prestacao_convidados'), 'prestacao_convidado_notas'), 'prestacao_emails_recebidos');
$$;

-- O que quem edita apaga: também a importação (desfaz o arquivo e leva os
-- lançamentos dela); o lançamento sozinho, o histórico, a verificação e o
-- envio, não.
create function rls_teste.apagaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(rls_teste.todas(), 'prestacao_status_log'), 'prestacao_lancamentos'),
    'prestacao_verificacoes'), 'prestacao_envios'), 'prestacao_envio_itens'), 'prestacao_links_patrocinador'), 'prestacao_convidados'), 'prestacao_convidado_notas'), 'prestacao_emails_recebidos');
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
    rls_teste.efeito(format('select 1 from public.prestacao_recursos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_links_patrocinador where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_convidados where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_convidado_notas where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_emails_recebidos where prestacao_id = %L', p))
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
    rls_teste.efeito($c$insert into public.prestacao_recursos (prestacao_id, decisao_id, protocolado_em) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000027a0', current_date)$c$),
    rls_teste.efeito($c$insert into public.prestacao_links_patrocinador (prestacao_id, patrocinador, token_hash, expira_em) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS direto', repeat('b', 64), current_date + 30)$c$),
    rls_teste.efeito($c$insert into public.prestacao_convidados (prestacao_id, email, papel, secoes, token_hash, expira_em) values ('f0000000-0000-4000-8000-0000000001a0', 'rls-direto@teste.invalid', 'auditor', '{objeto}', repeat('c', 64), current_date + 30)$c$),
    rls_teste.efeito($c$insert into public.prestacao_convidado_notas (prestacao_id, convidado_id, entidade_tipo, entidade_id, tipo, texto) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000040a0', 'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'comentario', 'RLS direto')$c$),
    rls_teste.efeito($c$insert into public.prestacao_emails_recebidos (prestacao_id, resend_email_id, remetente, situacao) values ('f0000000-0000-4000-8000-0000000001a0', 'rls-direto', 'x@teste.invalid', 'sem_anexo')$c$)
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
    rls_teste.efeito($c$update public.prestacao_recursos set pedido = pedido where id = 'f0000000-0000-4000-8000-0000000029a0'$c$),
    rls_teste.efeito($c$update public.prestacao_links_patrocinador set mensagem = mensagem where id = 'f0000000-0000-4000-8000-0000000030a0'$c$),
    rls_teste.efeito($c$update public.prestacao_convidados set nome = nome where id = 'f0000000-0000-4000-8000-0000000040a0'$c$),
    rls_teste.efeito($c$update public.prestacao_convidado_notas set texto = texto where id = 'f0000000-0000-4000-8000-0000000041a0'$c$),
    rls_teste.efeito($c$update public.prestacao_emails_recebidos set detalhe = detalhe where id = 'f0000000-0000-4000-8000-0000000044a0'$c$)
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
    rls_teste.efeito($c$delete from public.prestacao_recursos where id = 'f0000000-0000-4000-8000-0000000029a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_links_patrocinador where id = 'f0000000-0000-4000-8000-0000000030a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_convidados where id = 'f0000000-0000-4000-8000-0000000040a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_convidado_notas where id = 'f0000000-0000-4000-8000-0000000041a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_emails_recebidos where id = 'f0000000-0000-4000-8000-0000000044a0'$c$)
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
select lives_ok($t$update public.prestacao_comprovantes set contrapartida = 'doacao' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  'quem edita: marca a despesa como contrapartida por doação (P7.2)');
select throws_ok($t$update public.prestacao_comprovantes set contrapartida = 'emprestimo' where id = 'f0000000-0000-4000-8000-0000000005a0'$t$,
  '23514', null, 'a contrapartida é financeira ou por doação');
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

-- P4.8: a diligência marca a análise preditiva e o que o órgão apontou; o piloto é só do admin.
set local role authenticated;
select throws_ok($t$update public.prestacao_diligencias set apontamentos = array['numero do pagamento'] where descricao = 'RLS análise preditiva'$t$,
  '23514', null, 'apontamento é código de checagem');
select lives_ok($t$update public.prestacao_diligencias set preditiva = true, apontamentos = array['PAGAMENTO_SEM_NUMERO', 'DOC_FORA_VIGENCIA'] where descricao = 'RLS análise preditiva'$t$,
  'quem edita: marca a diligência preditiva e os apontamentos');
select throws_ok($t$select count(*) from public.piloto_organizacoes$t$, '42501', null, 'conta logada não lê o piloto');
select throws_ok($t$insert into public.piloto_organizacoes (organization_id) values ('f0000000-0000-4000-8000-0000000000a0')$t$,
  '42501', null, 'conta logada não escreve no piloto');
reset role;

-- P5.1: o responsável da prestação e a carteira.
insert into public.atividades (account_id, organization_id, prestacao_id, nome, tipo, prioridade, data_prevista, responsavel_id, origem_automatica, regra_origem) values
  ('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000a0', 'f0000000-0000-4000-8000-0000000001a0', 'RLS prazo automático', 'outro', 'alta', now() + interval '10 days', 'f0000000-0000-4000-8000-0000000000a1', true, 'prestacao_diligencia');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$update public.prestacoes_contas set responsavel_id = 'f0000000-0000-4000-8000-0000000000a4' where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  '23514', 'responsavel_sem_acesso', 'o responsável não é quem só lê');
select throws_ok($t$update public.prestacoes_contas set responsavel_id = 'f0000000-0000-4000-8000-0000000000c1' where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  '23514', 'responsavel_sem_acesso', 'o responsável é da organização da prestação');
select lives_ok($t$update public.prestacoes_contas set responsavel_id = 'f0000000-0000-4000-8000-0000000000a3' where id = 'f0000000-0000-4000-8000-0000000001a0'$t$,
  'quem edita: escolhe o responsável da prestação');
reset role;
select is(public.prestacao_responsavel('f0000000-0000-4000-8000-0000000001a0'), 'f0000000-0000-4000-8000-0000000000a3'::uuid, 'o responsável escolhido recebe os prazos');
select is((select responsavel_id from public.atividades where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0' and nome = 'RLS prazo automático'), 'f0000000-0000-4000-8000-0000000000a3'::uuid,
  'as atividades automáticas abertas passam para ele');
-- Carteira de B: achado na despesa e no pagamento dela (conta uma vez), um aporte e uma despesa rejeitada.
insert into public.prestacao_contas_bancarias (id, prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000010b0', 'f0000000-0000-4000-8000-0000000001b0', 'movimento');
insert into public.prestacao_lancamentos (id, prestacao_id, conta_id, data, natureza, valor, historico, categoria, chave) values
  ('f0000000-0000-4000-8000-0000000012b0', 'f0000000-0000-4000-8000-0000000001b0', 'f0000000-0000-4000-8000-0000000010b0', current_date, 'credito', 500, 'RLS aporte', 'aporte', 'rls-b-1');
insert into public.prestacao_comprovantes (id, prestacao_id, nome_arquivo, storage_path, valor_extraido, status) values
  ('f0000000-0000-4000-8000-0000000005b1', 'f0000000-0000-4000-8000-0000000001b0', 'rls-b1.pdf',
   'f0000000-0000-4000-8000-0000000000b0/prestacoes/f0000000-0000-4000-8000-0000000001b0/comprovantes/f0000000-0000-4000-8000-000000000cb2.pdf', 200, 'aceito'),
  ('f0000000-0000-4000-8000-0000000005b2', 'f0000000-0000-4000-8000-0000000001b0', 'rls-b2.pdf',
   'f0000000-0000-4000-8000-0000000000b0/prestacoes/f0000000-0000-4000-8000-0000000001b0/comprovantes/f0000000-0000-4000-8000-000000000cb3.pdf', 50, 'rejeitado');
insert into public.prestacao_pagamentos (id, despesa_id, forma, data, valor) values
  ('f0000000-0000-4000-8000-0000000015b0', 'f0000000-0000-4000-8000-0000000005b1', 'pix', current_date, 200);
insert into public.prestacao_verificacoes (id, prestacao_id, chave, check_codigo, severidade, resultado, entidade_tipo, entidade_id, mensagem) values
  ('f0000000-0000-4000-8000-0000000016b1', 'f0000000-0000-4000-8000-0000000001b0', 'RLS-B:despesa', 'DOC_PJ_SEM_NF', 'alerta', 'revisar', 'despesa', 'f0000000-0000-4000-8000-0000000005b1', 'RLS B despesa'),
  ('f0000000-0000-4000-8000-0000000016b2', 'f0000000-0000-4000-8000-0000000001b0', 'RLS-B:pagamento', 'PAGAMENTO_SEM_NUMERO', 'alerta', 'nao_conforme', 'pagamento', 'f0000000-0000-4000-8000-0000000015b0', 'RLS B pagamento'),
  ('f0000000-0000-4000-8000-0000000016b3', 'f0000000-0000-4000-8000-0000000001b0', 'RLS-B:sem valor', 'DESPESA_SEM_VALOR', 'alerta', 'nao_calculavel', 'despesa', 'f0000000-0000-4000-8000-0000000005b2', 'RLS B sem valor');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is((select array[valor_em_risco::text, achados_em_risco::text, captado::text, executado::text] from public.prestacao_carteira where prestacao_id = 'f0000000-0000-4000-8000-0000000001b0'),
  array['200.00', '2', '500.00', '200.00'], 'carteira: risco sem repetir a despesa, captado pelos aportes, executado sem as rejeitadas');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.prestacao_carteira where prestacao_id = 'f0000000-0000-4000-8000-0000000001b0'), 0, 'carteira: outra organização não vê');
reset role;

-- P5.2: o link do patrocinador. Quem edita cria e revoga; quem tem o link lê e aceita uma vez.
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_criar_link_patrocinador('f0000000-0000-4000-8000-0000000001a0', 'RLS Novo patrocinador', 'f0000000-0000-4000-8000-0000000031a0')$t$,
  'quem edita: cria o link do patrocinador');
select throws_ok($t$select public.fn_prestacao_criar_link_patrocinador('f0000000-0000-4000-8000-0000000001a0', 'RLS Velho', null, current_date - 1)$t$,
  'P0001', 'validade_invalida', 'o link nasce com validade futura');
reset role;
select is((select count(*)::integer from public.prestacao_links_patrocinador where patrocinador = 'RLS Novo patrocinador' and expira_em = current_date + 90 and token_hash ~ '^[0-9a-f]{64}$'),
  1, 'o link guarda só o hash, com 90 dias de validade');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_criar_link_patrocinador('f0000000-0000-4000-8000-0000000001a0', 'RLS Leitor')$t$,
  '42501', 'sem_permissao', 'quem só lê não cria link');
reset role;
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is((select public.fn_relatorio_patrocinador_publico(repeat('a', 48)) ->> 'patrocinador'), 'RLS Patrocinador', 'sem login: o link abre o relatório');
select is(public.fn_relatorio_patrocinador_publico(repeat('c', 48)), null, 'sem login: link desconhecido não abre nada');
select lives_ok($t$select public.fn_relatorio_patrocinador_aceitar(repeat('a', 48), 'Maria Patrocinadora', 'Tudo certo.')$t$,
  'sem login: o patrocinador registra o aceite');
select throws_ok($t$select public.fn_relatorio_patrocinador_aceitar(repeat('a', 48), 'Outra pessoa')$t$,
  'P0001', 'ja_aceito', 'o aceite é um só');
reset role;
select ok(exists (select 1 from public.prestacao_links_patrocinador l join public.crm_interacoes i on i.id = l.interacao_id
                   where l.id = 'f0000000-0000-4000-8000-0000000030a0' and l.visualizacoes = 1
                     and i.empresa_crm_id = 'f0000000-0000-4000-8000-0000000031a0' and i.resultado = 'avancou'),
  'a visita conta e o aceite entra no histórico do patrocinador no CRM');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_revogar_link_patrocinador('f0000000-0000-4000-8000-0000000030a0')$t$,
  'quem edita: revoga o link');
reset role;
set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is((select public.fn_relatorio_patrocinador_publico(repeat('a', 48)) ->> 'situacao'), 'revogado', 'sem login: o link revogado não mostra o relatório');
reset role;

-- ─── Convidados (P5.3): convite por seção, leitura sem escrita, notas ──────
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_convidar('f0000000-0000-4000-8000-0000000001a0', ' Contadora@Exemplo.org ', 'Ana Contadora', 'contador', array['financeiro', 'financeiro'])$t$,
  'quem edita: convida a contadora para o financeiro');
select throws_ok($t$select public.fn_prestacao_convidar('f0000000-0000-4000-8000-0000000001a0', 'contadora@exemplo.org', null, 'contador', array['objeto'])$t$,
  'P0001', 'convite_existente', 'o mesmo e-mail não tem dois convites valendo na prestação');
select throws_ok($t$select public.fn_prestacao_convidar('f0000000-0000-4000-8000-0000000001a0', 'auditor@exemplo.org', null, 'auditor', array['tudo'])$t$,
  'P0001', 'secoes_invalidas', 'o convite vale para financeiro, objeto ou envio');
select throws_ok($t$select public.fn_prestacao_convidar('f0000000-0000-4000-8000-0000000001a0', 'rls-f0000000-0000-4000-8000-0000000000a2@teste.invalid', null, 'outro', array['objeto'])$t$,
  'P0001', 'ja_e_da_equipe', 'quem já é da equipe não vira convidado');
reset role;
select is((select array[email, array_to_string(secoes, ','), (expira_em - current_date)::text, (token_hash ~ '^[0-9a-f]{64}$')::text]
             from public.prestacao_convidados where nome = 'Ana Contadora'),
  array['contadora@exemplo.org', 'financeiro', '90', 'true'], 'o convite guarda o e-mail em minúsculas, as seções sem repetir, 90 dias e só o hash do link');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_convidar('f0000000-0000-4000-8000-0000000001a0', 'outra@exemplo.org')$t$,
  '42501', 'sem_permissao', 'quem só lê não convida');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a7","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), array[
    'prestacoes_contas', 'prestacao_orcamento_versoes', 'prestacao_orcamento_nos', 'prestacao_comprovantes', 'prestacao_alteracoes',
    'prestacao_contas_bancarias', 'prestacao_extrato_importacoes', 'prestacao_lancamentos', 'prestacao_fornecedores',
    'prestacao_fornecedor_documentos', 'prestacao_pagamentos', 'prestacao_devolucoes', 'prestacao_convidados', 'prestacao_convidado_notas'],
  'convidado do financeiro: lê só o financeiro, o próprio convite e as próprias notas');
select is(rls_teste.insere(), '{}'::text[], 'convidado: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'convidado: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'convidado: não apaga nada');
select is(rls_teste.arquivos(), array['le'], 'convidado do financeiro: só lê o comprovante no bucket');
select is(rls_teste.arquivos_fornecedor(), array['le'], 'convidado do financeiro: lê o comprovante do fornecedor da despesa');
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001b0'), '{}'::text[], 'convidado: não vê a prestação de outra organização');
select lives_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001a0', 'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'comentario', 'Falta o recibo do ISS.')$t$,
  'convidado: comenta a despesa');
select throws_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001a0', 'atividade', 'f0000000-0000-4000-8000-0000000006a0', 'verificado')$t$,
  '42501', 'fora_do_escopo', 'convidado do financeiro: não anota a atividade');
select throws_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001a0', 'despesa', 'f0000000-0000-4000-8000-0000000005b1', 'verificado')$t$,
  'P0002', 'entidade_inexistente', 'convidado: só anota item da própria prestação');
select throws_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001b0', 'prestacao', 'f0000000-0000-4000-8000-0000000001b0', 'comentario', 'Oi')$t$,
  '42501', 'sem_convite', 'convidado: não anota onde não foi convidado');
select is((public.fn_convidado_acesso('f0000000-0000-4000-8000-0000000001a0') -> 'secoes'), '["financeiro"]'::jsonb, 'convidado: a abertura diz as seções do convite');
reset role;
select ok((select ultimo_acesso_em is not null from public.prestacao_convidados where id = 'f0000000-0000-4000-8000-0000000040a0'),
  'a abertura conta o último acesso');

set local request.jwt.claims = '{"role":"anon"}';
set local role anon;
select is((select public.fn_convite_publico(repeat('d', 48)) ->> 'situacao'), 'pendente', 'sem login: o link mostra o convite pendente');
select is(public.fn_convite_publico(repeat('f', 48)), null, 'sem login: link desconhecido não mostra nada');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_aceitar_convite(repeat('e', 48))$t$,
  '42501', 'email_diferente', 'o convite de outro e-mail não é aceito');
select is(public.fn_prestacao_aceitar_convite(repeat('d', 48)), 'f0000000-0000-4000-8000-0000000001a0'::uuid, 'o convidado aceita o convite do próprio e-mail');
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), array[
    'prestacoes_contas', 'prestacao_atividades', 'prestacao_atividade_evidencias', 'prestacao_relatorio', 'prestacao_distribuicao',
    'prestacao_pecas', 'prestacao_metas', 'prestacao_locais', 'prestacao_evidencias', 'prestacao_bens', 'prestacao_convidados'],
  'convidado do objeto: lê só o objeto e o próprio convite');
select is(rls_teste.arquivos(), '{}'::text[], 'convidado do objeto: não lê o comprovante');
reset role;

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.prestacao_convidado_notas where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'), 2,
  'a equipe lê as notas dos convidados');
select lives_ok($t$select public.fn_prestacao_revogar_convidado('f0000000-0000-4000-8000-0000000040a0')$t$, 'quem edita: revoga o convite');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a7","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), array['prestacao_convidados'], 'convite revogado: sobra só o próprio convite');
select is(rls_teste.arquivos(), '{}'::text[], 'convite revogado: não lê mais os arquivos');
select throws_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001a0', 'despesa', 'f0000000-0000-4000-8000-0000000005a0', 'verificado')$t$,
  '42501', 'sem_convite', 'convite revogado: não anota mais');
select is((public.fn_convidado_acesso('f0000000-0000-4000-8000-0000000001a0') ->> 'situacao'), 'revogado', 'convite revogado: a abertura diz por quê');
reset role;

-- ─── Espaço do proponente (P5.4): lê a própria prestação e envia por função ─
-- Outro cliente de A, ainda sem conta ligada. A organização de teste está no
-- plano gratuito, que admite um proponente; o limite sai até o teste de criar
-- cadastro já ligado, para ele mostrar a regra do vínculo.
alter table public.proponentes disable trigger enforce_free_proponente_limit;
insert into public.proponentes (id, account_id, organization_id, nome) values
  ('f0000000-0000-4000-8000-0000000033a0', 'f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000a0', 'RLS outro cliente');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'),
  array_remove(array_remove(array_remove(array_remove(array_remove(array_remove(rls_teste.todas(),
    'prestacao_status_log'), 'prestacao_verificacoes'), 'prestacao_links_patrocinador'), 'prestacao_convidados'), 'prestacao_convidado_notas'),
    'prestacao_emails_recebidos'),
  'proponente: lê a própria prestação, menos o histórico, as verificações, os links, os convidados e os e-mails');
select is(rls_teste.insere(), '{}'::text[], 'proponente: não cria nada direto nas tabelas');
select is(rls_teste.altera(), '{}'::text[], 'proponente: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'proponente: não apaga nada');
select is(rls_teste.arquivos(), array['le', 'envia'], 'proponente: lê os arquivos e envia para a pasta de comprovantes, sem trocar nem apagar os da equipe');
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001b0'), '{}'::text[], 'proponente: não vê a prestação de outra organização');
select is(rls_teste.efeito($c$insert into storage.objects (bucket_id, name) values ('documentos', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/envio/f0000000-0000-4000-8000-000000000d80.pdf')$c$), '',
  'proponente: não envia arquivo fora das pastas de comprovantes e evidências');
select lives_ok($t$insert into storage.objects (bucket_id, name, owner) values ('documentos', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf', 'f0000000-0000-4000-8000-0000000000a8')$t$,
  'proponente: envia o arquivo da despesa para a pasta da prestação');
select lives_ok($t$select public.fn_proponente_enviar_despesa('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf', 'nota.pdf', 'nfe', 150.5, current_date - 3, 'Transporte do cenário', '987')$t$,
  'proponente: registra a despesa com o arquivo enviado');
select throws_ok($t$select public.fn_proponente_enviar_despesa('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf', 'nota.pdf', 'nfe', 10, current_date, 'De novo')$t$,
  'P0001', 'arquivo_ja_registrado', 'o mesmo arquivo não vira duas despesas');
select throws_ok($t$select public.fn_proponente_enviar_despesa('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c81.pdf', 'x.pdf', 'nfe', 10, current_date, 'Sem arquivo')$t$,
  'P0001', 'arquivo_nao_enviado', 'a despesa pede o arquivo já enviado por quem registra');
select throws_ok($t$select public.fn_proponente_enviar_despesa('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000000b0/prestacoes/f0000000-0000-4000-8000-0000000001b0/comprovantes/f0000000-0000-4000-8000-000000000c82.pdf', 'x.pdf', 'nfe', 10, current_date, 'Pasta de outra')$t$,
  'P0001', 'caminho_invalido', 'o arquivo precisa estar na pasta desta prestação');
select lives_ok($t$select public.fn_proponente_enviar_evidencia('f0000000-0000-4000-8000-0000000001a0', 'link', 'Vídeo do ensaio aberto', p_url => 'https://exemplo.org/video')$t$,
  'proponente: envia uma evidência por link');
select is((select array[jsonb_array_length(r)::text, r -> 0 ->> 'id'] from public.fn_proponente_minhas_prestacoes() r),
  array['1', 'f0000000-0000-4000-8000-0000000001a0'], 'proponente: a lista traz a prestação dele');
select throws_ok($t$select public.fn_convidado_anotar('f0000000-0000-4000-8000-0000000001a0', 'prestacao', 'f0000000-0000-4000-8000-0000000001a0', 'comentario', 'Oi')$t$,
  '42501', 'sem_convite', 'proponente sem convite não anota como convidado');
reset role;
select is((select array[canal, status::text, (enviado_por = 'f0000000-0000-4000-8000-0000000000a8')::text, valor_extraido::text] from public.prestacao_comprovantes where storage_path = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf'),
  array['proponente', 'pendente', 'true', '150.50'], 'a despesa entra em análise, marcada como enviada pelo proponente');
select ok(exists (select 1 from public.notification_events where event_key = 'prestacao_envio_proponente' and entity_id = 'f0000000-0000-4000-8000-0000000001a0'),
  'quem responde pela prestação é avisado do envio');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_proponente_enviar_evidencia('f0000000-0000-4000-8000-0000000001a0', 'link', 'Da equipe', p_url => 'https://exemplo.org/x')$t$,
  '42501', 'sem_permissao', 'quem é da equipe não envia como proponente');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
set local role authenticated;
select is(public.fn_proponente_retirar('despesa', (select id from public.prestacao_comprovantes where storage_path = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf')), 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf',
  'proponente: retira a despesa em análise e recebe o caminho do arquivo');
select is(rls_teste.efeito($c$delete from storage.objects where bucket_id = 'documentos' and name = 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c80.pdf'$c$), 'sim',
  'proponente: tira do bucket o arquivo que não virou despesa');
select throws_ok($t$update public.proponentes set user_id = 'f0000000-0000-4000-8000-0000000000a8' where id = 'f0000000-0000-4000-8000-0000000033a0'$t$,
  '42501', 'vinculo_do_proponente', 'proponente: não liga a própria conta ao cadastro de outro cliente');
select throws_ok($t$insert into public.proponentes (account_id, organization_id, nome, user_id) values ('f0000000-0000-4000-8000-0000000000a8', 'f0000000-0000-4000-8000-0000000000a0', 'RLS falso', 'f0000000-0000-4000-8000-0000000000a8')$t$,
  '42501', 'vinculo_do_proponente', 'proponente: não cria cadastro já ligado à própria conta');
reset role;
alter table public.proponentes enable trigger enforce_free_proponente_limit;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$update public.proponentes set user_id = 'f0000000-0000-4000-8000-0000000000a2' where id = 'f0000000-0000-4000-8000-0000000033a0'$t$,
  '42501', 'vinculo_do_proponente', 'colaborador: não liga conta ao cadastro do proponente (só o admin)');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$update public.proponentes set user_id = null where id = 'f0000000-0000-4000-8000-0000000032a0'$t$,
  'admin: desfaz o vínculo do cadastro com a conta');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'sem o vínculo com o cadastro do proponente, não vê mais nada');
reset role;

-- ─── Captura por e-mail (P5.5): endereço, remetentes e destino no servidor ──
update public.proponentes set user_id = 'f0000000-0000-4000-8000-0000000000a8' where id = 'f0000000-0000-4000-8000-0000000032a0';
create temporary table rls_captura (token text) on commit drop;
grant all on rls_captura to authenticated, service_role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
insert into rls_captura select public.fn_prestacao_ligar_captura_email('f0000000-0000-4000-8000-0000000001a0');
select ok((select token ~ '^[a-z0-9]{10}$' from rls_captura), 'quem edita: liga o endereço de captura da prestação');
select is(public.fn_prestacao_remetentes_captura('f0000000-0000-4000-8000-0000000001a0', array[' Contador@Exemplo.org ', 'contador@exemplo.org']), array['contador@exemplo.org'],
  'quem edita: autoriza remetentes, em minúsculas e sem repetir');
select throws_ok($t$select public.fn_prestacao_remetentes_captura('f0000000-0000-4000-8000-0000000001a0', array['contador@'])$t$, 'P0001', 'email_invalido', 'remetente precisa ser e-mail válido');
select throws_ok($t$select public.fn_prestacao_captura_destino('abcdefghij', 'x@teste.invalid')$t$, '42501', null, 'conta logada não consulta o destino da captura');
select is((select count(*)::integer from public.prestacao_emails_recebidos where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'), 1, 'a equipe lê os e-mails recebidos');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_ligar_captura_email('f0000000-0000-4000-8000-0000000001a0')$t$, '42501', 'sem_permissao', 'quem só lê não liga a captura');
reset role;
set local role service_role;
select is((select array[d ->> 'autorizado', d ->> 'quem', d ->> 'usuario_id'] from public.fn_prestacao_captura_destino((select token from rls_captura), 'RLS-f0000000-0000-4000-8000-0000000000a2@teste.invalid') d),
  array['true', 'equipe', 'f0000000-0000-4000-8000-0000000000a2'], 'destino: alguém da equipe com a prestação manda');
select is((select array[d ->> 'autorizado', d ->> 'quem'] from public.fn_prestacao_captura_destino((select token from rls_captura), 'rls-f0000000-0000-4000-8000-0000000000a8@teste.invalid') d),
  array['true', 'proponente'], 'destino: o proponente da prestação manda');
select is((select array[d ->> 'autorizado', d ->> 'quem'] from public.fn_prestacao_captura_destino((select token from rls_captura), 'contador@exemplo.org') d),
  array['true', 'autorizado'], 'destino: o remetente autorizado manda');
select is((select d ->> 'autorizado' from public.fn_prestacao_captura_destino((select token from rls_captura), 'rls-f0000000-0000-4000-8000-0000000000a5@teste.invalid') d),
  'false', 'destino: quem é da organização mas não tem a prestação não manda');
select is((select d ->> 'autorizado' from public.fn_prestacao_captura_destino((select token from rls_captura), 'estranho@exemplo.org') d),
  'false', 'destino: estranho não manda');
select is(public.fn_prestacao_captura_destino('zzzzzzzzzz', 'rls-f0000000-0000-4000-8000-0000000000a2@teste.invalid'), null, 'destino: código desconhecido não leva a nada');
select public.fn_prestacao_avisar_captura('f0000000-0000-4000-8000-0000000001a0', 'E-mail recusado na captura', 'estranho@exemplo.org mandou um recibo.', 'rls-recusado', true);
select public.fn_prestacao_avisar_captura('f0000000-0000-4000-8000-0000000001a0', 'Despesa recebida por e-mail', 'Confira e avalie.', 'rls-recebido');
reset role;
select is((select array_agg(link order by dedupe_key) from public.notificacoes where dedupe_key in ('prestacao_captura_email:rls-recebido', 'prestacao_captura_email:rls-recusado')),
  array['/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes', '/prestacoes/f0000000-0000-4000-8000-0000000001a0'],
  'aviso da captura: despesas levam aos comprovantes; recusa leva à visão geral, onde se autoriza');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_desligar_captura_email('f0000000-0000-4000-8000-0000000001a0')$t$, 'quem edita: desliga a captura');
reset role;
set local role service_role;
select is(public.fn_prestacao_captura_destino((select token from rls_captura), 'rls-f0000000-0000-4000-8000-0000000000a2@teste.invalid'), null, 'desligada, o endereço antigo não leva a nada');
reset role;
select lives_ok($t$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path, canal) values ('f0000000-0000-4000-8000-0000000001a0', 'email.pdf', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000c70.pdf', 'email')$t$,
  'a despesa aceita o canal e-mail');
select ok(public.fn_prestacao_resumo_semanal() >= 1, 'o resumo semanal sai para quem responde por prestações com pendência');
select ok(exists (select 1 from public.notification_events where event_key = 'prestacao_resumo_semanal' and organization_id = 'f0000000-0000-4000-8000-0000000000a0'),
  'a organização A recebe o resumo da semana');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.prestacao_emails_recebidos), 0, 'proponente: não lê os e-mails recebidos');
reset role;

-- ─── Cobrança do módulo (P5.6): assinatura, somente leitura e vagas ─────────
set local role service_role;
select is(public.fn_processar_cobranca_modulo('rls_evt_1', 'customer.subscription.deleted', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_velha', 'si_rls_mod', null, 0, 'canceled', null) ->> 'ignorado',
  'outra_assinatura', 'cobrança: o fim de uma assinatura que não é a do contrato não mexe nele');
select is(public.fn_processar_cobranca_modulo('rls_evt_2', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a', 'si_rls_mod', 'si_rls_vagas', 3, 'active', now() + interval '30 days') ->> 'status',
  'ativo', 'cobrança: assinatura ativa vira contrato ativo');
select is(public.fn_processar_cobranca_modulo('rls_evt_2', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a', 'si_rls_mod', 'si_rls_vagas', 3, 'active', now() + interval '30 days') ->> 'duplicate',
  'true', 'cobrança: o mesmo evento não é processado duas vezes');
select is((select array[stripe_subscription_id, stripe_item_vagas_id, vagas_compradas::text, billing_user_id::text] from public.organization_modulos
           where organization_id = 'f0000000-0000-4000-8000-0000000000a0' and modulo = 'prestacao'),
  array['sub_rls_a', 'si_rls_vagas', '3', 'f0000000-0000-4000-8000-0000000000a1'], 'cobrança: o contrato guarda a assinatura, as vagas compradas e quem paga');
select is(public.fn_processar_cobranca_modulo('rls_evt_3', 'invoice.payment_failed', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a', 'si_rls_mod', null, 3, 'past_due', now() + interval '30 days') ->> 'status',
  'atraso', 'cobrança: pagamento recusado deixa o contrato em atraso');
select ok((select om.past_due_since is not null and 'prestacao' = any(o.modulos_ativos)
           from public.organization_modulos om join public.organizations o on o.id = om.organization_id
           where om.organization_id = 'f0000000-0000-4000-8000-0000000000a0' and om.modulo = 'prestacao'),
  'cobrança: em atraso, o módulo segue ativo durante a carência');
select is(public.fn_processar_cobranca_modulo('rls_evt_4', 'invoice.payment_failed', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_nova', 'si_rls_mod', null, 0, 'incomplete', now() + interval '30 days') ->> 'ignorado',
  'pagamento_pendente', 'cobrança: primeiro pagamento pendente não muda o contrato');
select is(public.fn_processar_cobranca_modulo('rls_evt_5', 'customer.subscription.deleted', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a', 'si_rls_mod', null, 3, 'canceled', null) ->> 'status',
  'cancelado', 'cobrança: assinatura cancelada encerra o contrato');
select is((select array[array_to_string(modulos_ativos, ','), array_to_string(modulos_leitura, ',')] from public.organizations where id = 'f0000000-0000-4000-8000-0000000000a0'),
  array['captacao', 'prestacao'], 'cobrança: sem assinatura, a prestação fica só para leitura');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'somente leitura: o admin continua vendo tudo da prestação');
select is(rls_teste.insere(), '{}'::text[], 'somente leitura: ninguém cria nada');
select is(rls_teste.altera(), '{}'::text[], 'somente leitura: ninguém altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'somente leitura: ninguém apaga nada');
select is(rls_teste.arquivos(), array['le'], 'somente leitura: os arquivos são lidos, sem enviar, trocar ou apagar');
select is(public.auth_prestacao_pode('f0000000-0000-4000-8000-0000000001a0', 'editar'), false, 'somente leitura: a tela não oferece edição');
update public.organizations set modulos_ativos = '{captacao,prestacao}', modulos_leitura = '{}' where id = 'f0000000-0000-4000-8000-0000000000a0';
select throws_ok($t$select public.fn_processar_cobranca_modulo('rls_evt_x', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_x', 'si_rls_mod', null, 0, 'active', now() + interval '30 days')$t$, '42501', null,
  'cobrança: conta logada não registra assinatura');
reset role;
select is((select array[array_to_string(modulos_ativos, ','), array_to_string(modulos_leitura, ',')] from public.organizations where id = 'f0000000-0000-4000-8000-0000000000a0'),
  array['captacao', 'prestacao'], 'somente leitura: a organização não muda a própria lista de módulos');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'somente leitura: quem não usava o módulo continua sem ver');
reset role;
set local role service_role;
select is(public.fn_processar_cobranca_modulo('rls_evt_6', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a2', 'si_rls_mod', null, 0, 'active', now() + interval '30 days') ->> 'status',
  'ativo', 'cobrança: assinar de novo devolve a edição');
select is(public.fn_processar_cobranca_modulo('rls_evt_7', 'customer.subscription.deleted', 'f0000000-0000-4000-8000-0000000000a0', 'prestacao', 'f0000000-0000-4000-8000-0000000000a1', 'cus_rls_a', 'sub_rls_a', 'si_rls_mod', null, 0, 'canceled', null) ->> 'ignorado',
  'outra_assinatura', 'cobrança: o fim da assinatura antiga não derruba a nova');
reset role;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(public.auth_prestacao_pode('f0000000-0000-4000-8000-0000000001a0', 'editar'), true, 'cobrança: com a assinatura nova, o admin volta a editar');
reset role;
select ok((select count(*) from public.notification_events where event_key = 'modulo_cobranca' and organization_id = 'f0000000-0000-4000-8000-0000000000a0') >= 3,
  'cobrança: quem administra é avisado do atraso, do fim e da volta da assinatura');
update public.organization_members set modulos_acesso = '{captacao}' where organization_id = 'f0000000-0000-4000-8000-0000000000c0' and user_id = 'f0000000-0000-4000-8000-0000000000c1';
update public.organization_modulos set status = 'cortesia', cortesia_ate = current_date + 10 where organization_id = 'f0000000-0000-4000-8000-0000000000b0' and modulo = 'prestacao';
set local role service_role;
select is(public.fn_processar_cobranca_modulo('rls_evt_8', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000c0', 'prestacao', 'f0000000-0000-4000-8000-0000000000c1', 'cus_rls_c', 'sub_rls_c', 'si_rls_mod', null, 0, 'trialing', now() + interval '14 days') ->> 'status',
  'teste', 'cobrança: assinatura em teste libera o módulo para a organização sem ele');
select is(public.fn_processar_cobranca_modulo('rls_evt_9', 'customer.subscription.created', 'f0000000-0000-4000-8000-0000000000b0', 'prestacao', 'f0000000-0000-4000-8000-0000000000b1', 'cus_rls_b', 'sub_rls_b', 'si_rls_mod', null, 0, 'active', now() + interval '30 days') ->> 'status',
  'ativo', 'cobrança: a assinatura substitui a cortesia');
select is(public.fn_processar_cobranca_modulo('rls_evt_10', 'customer.subscription.deleted', 'f0000000-0000-4000-8000-0000000000b0', 'prestacao', 'f0000000-0000-4000-8000-0000000000b1', 'cus_rls_b', 'sub_rls_b', 'si_rls_mod', null, 0, 'canceled', null) ->> 'status',
  'cortesia', 'cobrança: cancelada a assinatura, volta a cortesia que ainda vale');
reset role;
select ok((select 'prestacao' = any(modulos_acesso) from public.organization_members where organization_id = 'f0000000-0000-4000-8000-0000000000c0' and user_id = 'f0000000-0000-4000-8000-0000000000c1'),
  'cobrança: quem assinou ganha o acesso ao módulo');
select lives_ok($t$insert into public.organization_seat_purchases (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo) values
  ('f0000000-0000-4000-8000-0000000056a0', 'f0000000-0000-4000-8000-0000000000a0', 'f0000000-0000-4000-8000-0000000000a1', 1, 0, 1, 'pending', 'captacao'),
  ('f0000000-0000-4000-8000-0000000056a1', 'f0000000-0000-4000-8000-0000000000a0', 'f0000000-0000-4000-8000-0000000000a1', 1, 0, 1, 'pending', 'prestacao')$t$,
  'vagas: uma compra pendente da captação e uma da prestação ao mesmo tempo');
select throws_ok($t$insert into public.organization_seat_purchases (id, organization_id, billing_user_id, quantity, previous_quantity, resulting_quantity, status, modulo) values
  ('f0000000-0000-4000-8000-0000000056a2', 'f0000000-0000-4000-8000-0000000000a0', 'f0000000-0000-4000-8000-0000000000a1', 1, 1, 2, 'pending', 'prestacao')$t$, '23505', null,
  'vagas: só uma compra pendente da prestação por vez');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and policyname like '%: leitura sem assinatura'),
  (select count(distinct tablename)::integer from pg_policies
   where schemaname = 'public' and permissive = 'PERMISSIVE' and cmd in ('ALL', 'SELECT')
     and (qual like '%can_access_prestacao(%' or qual like '%auth_tem_modulo(organization_id, ''prestacao''::text)%')),
  'somente leitura: cada tabela que a equipe lê tem a regra de leitura sem assinatura');

select * from finish();
rollback;
