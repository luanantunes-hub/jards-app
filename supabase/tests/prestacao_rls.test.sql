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

select plan(67);

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

  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por) values
    (pa, 'RLS prestação A', org_a, admin_a),
    ('f0000000-0000-4000-8000-0000000001b0', 'RLS prestação B', org_b, 'f0000000-0000-4000-8000-0000000000b1'),
    ('f0000000-0000-4000-8000-0000000001c0', 'RLS prestação C', org_c, 'f0000000-0000-4000-8000-0000000000c1');

  insert into public.prestacao_orcamento_versoes (id, prestacao_id, tipo, ativa, criado_por) values
    ('f0000000-0000-4000-8000-0000000002a0', pa, 'aprovada', true, admin_a),
    ('f0000000-0000-4000-8000-0000000002a1', pa, 'solicitada', false, admin_a);
  insert into public.prestacao_orcamento_nos (id, versao_id, prestacao_id, nome, valor_total) values
    ('f0000000-0000-4000-8000-0000000003a0', 'f0000000-0000-4000-8000-0000000002a0', pa, 'RLS nó', 100);
  insert into public.prestacao_itens (id, prestacao_id, rubrica) values
    ('f0000000-0000-4000-8000-0000000004a0', pa, 'RLS item');
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
  insert into public.prestacao_distribuicao (id, prestacao_id, tipo) values
    ('f0000000-0000-4000-8000-0000000009a0', pa, 'gratuito');
  insert into public.prestacao_divulgacao (id, prestacao_id, tipo) values
    ('f0000000-0000-4000-8000-000000000aa0', pa, 'cartaz');
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

  insert into storage.objects (bucket_id, name, owner) values
    ('documentos', org_a || '/prestacoes/' || pa || '/comprovantes/f0000000-0000-4000-8000-000000000ca0.pdf', admin_a),
    ('documentos', org_a || '/outros/f0000000-0000-4000-8000-000000000cb0.pdf', admin_a);
end
$cenario$;

-- ─── Sondas ─────────────────────────────────────────────────────────────────

create schema rls_teste;
grant usage on schema rls_teste to authenticated, anon;

-- Ordem fixa das tabelas nas respostas.
create function rls_teste.todas() returns text[] language sql immutable as $$
  select array[
    'prestacoes_contas', 'prestacao_status_log', 'prestacao_orcamento_versoes',
    'prestacao_orcamento_nos', 'prestacao_itens', 'prestacao_comprovantes',
    'prestacao_atividades', 'prestacao_atividade_evidencias', 'prestacao_relatorio',
    'prestacao_distribuicao', 'prestacao_divulgacao', 'prestacao_alteracoes',
    'prestacao_contas_bancarias', 'prestacao_extrato_importacoes', 'prestacao_lancamentos',
    'prestacao_fornecedores'
  ];
$$;

-- Organização da prestação de teste (…01a0 é de …00a0), sem ler a prestação:
-- quem não a vê ainda precisa ter a leitura dos fornecedores testada.
create function rls_teste.org_da(p uuid) returns uuid language sql immutable as $$
  select overlay(p::text placing '0000000000' from 25 for 10)::uuid;
$$;

-- O que quem edita cria e altera direto: tudo, menos o histórico de status, a
-- importação e os lançamentos do extrato, que só as funções do banco escrevem.
create function rls_teste.editaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(array_remove(rls_teste.todas(),
    'prestacao_status_log'), 'prestacao_extrato_importacoes'), 'prestacao_lancamentos');
$$;

-- O que quem edita apaga: também a importação (desfaz o arquivo e leva os
-- lançamentos dela); o lançamento sozinho e o histórico, não.
create function rls_teste.apagaveis() returns text[] language sql immutable as $$
  select array_remove(array_remove(rls_teste.todas(), 'prestacao_status_log'), 'prestacao_lancamentos');
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
    rls_teste.efeito(format('select 1 from public.prestacao_itens where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_comprovantes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_atividades where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_atividade_evidencias e join public.prestacao_atividades a on a.id = e.atividade_id where a.prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_relatorio where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_distribuicao where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_divulgacao where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_alteracoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_contas_bancarias where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_extrato_importacoes where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_lancamentos where prestacao_id = %L', p)),
    rls_teste.efeito(format('select 1 from public.prestacao_fornecedores where organization_id = %L', rls_teste.org_da(p)))
  ]);
$$;

create function rls_teste.insere() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$insert into public.prestacoes_contas (titulo, organization_id) values ('RLS nova', 'f0000000-0000-4000-8000-0000000000a0')$c$),
    rls_teste.efeito($c$insert into public.prestacao_status_log (prestacao_id, status_novo) values ('f0000000-0000-4000-8000-0000000001a0', 'rascunho')$c$),
    rls_teste.efeito($c$insert into public.prestacao_orcamento_versoes (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'solicitada')$c$),
    rls_teste.efeito($c$insert into public.prestacao_orcamento_nos (versao_id, prestacao_id, nome) values ('f0000000-0000-4000-8000-0000000002a0', 'f0000000-0000-4000-8000-0000000001a0', 'RLS novo')$c$),
    rls_teste.efeito($c$insert into public.prestacao_itens (prestacao_id, rubrica) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS novo')$c$),
    rls_teste.efeito($c$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000001a0', 'novo.pdf', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/comprovantes/f0000000-0000-4000-8000-000000000cc0.pdf')$c$),
    rls_teste.efeito($c$insert into public.prestacao_atividades (prestacao_id, titulo, data_realizacao) values ('f0000000-0000-4000-8000-0000000001a0', 'RLS nova', current_date)$c$),
    rls_teste.efeito($c$insert into public.prestacao_atividade_evidencias (atividade_id, nome_arquivo, storage_path) values ('f0000000-0000-4000-8000-0000000006a0', 'nova.jpg', 'f0000000-0000-4000-8000-0000000000a0/prestacoes/f0000000-0000-4000-8000-0000000001a0/evidencias/f0000000-0000-4000-8000-000000000ec0.jpg')$c$),
    rls_teste.efeito($c$insert into public.prestacao_relatorio (prestacao_id, secao) values ('f0000000-0000-4000-8000-0000000001a0', 'rls nova')$c$),
    rls_teste.efeito($c$insert into public.prestacao_distribuicao (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'pago')$c$),
    rls_teste.efeito($c$insert into public.prestacao_divulgacao (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'folder')$c$),
    rls_teste.efeito($c$insert into public.prestacao_alteracoes (prestacao_id, versao_id, numero) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000002a0', 2)$c$),
    rls_teste.efeito($c$insert into public.prestacao_contas_bancarias (prestacao_id, tipo) values ('f0000000-0000-4000-8000-0000000001a0', 'captacao')$c$),
    rls_teste.efeito($c$insert into public.prestacao_extrato_importacoes (prestacao_id, conta_id, formato) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000010a0', 'ofx')$c$),
    rls_teste.efeito($c$insert into public.prestacao_lancamentos (prestacao_id, conta_id, data, natureza, valor, chave) values ('f0000000-0000-4000-8000-0000000001a0', 'f0000000-0000-4000-8000-0000000010a0', current_date, 'credito', 5, 'rls-2')$c$),
    rls_teste.efeito($c$insert into public.prestacao_fornecedores (organization_id, tipo_pessoa, documento, nome) values ('f0000000-0000-4000-8000-0000000000a0', 'pj', '00000000000191', 'RLS novo')$c$)
  ]);
$$;

create function rls_teste.altera() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$update public.prestacoes_contas set titulo = titulo where id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$update public.prestacao_status_log set comentario = comentario where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$update public.prestacao_orcamento_versoes set nome = nome where id = 'f0000000-0000-4000-8000-0000000002a1'$c$),
    rls_teste.efeito($c$update public.prestacao_orcamento_nos set nome = nome where id = 'f0000000-0000-4000-8000-0000000003a0'$c$),
    rls_teste.efeito($c$update public.prestacao_itens set rubrica = rubrica where id = 'f0000000-0000-4000-8000-0000000004a0'$c$),
    rls_teste.efeito($c$update public.prestacao_comprovantes set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000005a0'$c$),
    rls_teste.efeito($c$update public.prestacao_atividades set titulo = titulo where id = 'f0000000-0000-4000-8000-0000000006a0'$c$),
    rls_teste.efeito($c$update public.prestacao_atividade_evidencias set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000007a0'$c$),
    rls_teste.efeito($c$update public.prestacao_relatorio set secao = secao where id = 'f0000000-0000-4000-8000-0000000008a0'$c$),
    rls_teste.efeito($c$update public.prestacao_distribuicao set tipo = tipo where id = 'f0000000-0000-4000-8000-0000000009a0'$c$),
    rls_teste.efeito($c$update public.prestacao_divulgacao set tipo = tipo where id = 'f0000000-0000-4000-8000-000000000aa0'$c$),
    rls_teste.efeito($c$update public.prestacao_alteracoes set justificativa = justificativa where id = 'f0000000-0000-4000-8000-000000000ba0'$c$),
    rls_teste.efeito($c$update public.prestacao_contas_bancarias set apelido = apelido where id = 'f0000000-0000-4000-8000-0000000010a0'$c$),
    rls_teste.efeito($c$update public.prestacao_extrato_importacoes set nome_arquivo = nome_arquivo where id = 'f0000000-0000-4000-8000-0000000011a0'$c$),
    rls_teste.efeito($c$update public.prestacao_lancamentos set historico = historico where id = 'f0000000-0000-4000-8000-0000000012a0'$c$),
    rls_teste.efeito($c$update public.prestacao_fornecedores set observacoes = observacoes where id = 'f0000000-0000-4000-8000-0000000013a0'$c$)
  ]);
$$;

create function rls_teste.apaga() returns text[] language sql as $$
  select rls_teste.resumo(rls_teste.todas(), array[
    rls_teste.efeito($c$delete from public.prestacoes_contas where id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_status_log where prestacao_id = 'f0000000-0000-4000-8000-0000000001a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_orcamento_versoes where id = 'f0000000-0000-4000-8000-0000000002a1'$c$),
    rls_teste.efeito($c$delete from public.prestacao_orcamento_nos where id = 'f0000000-0000-4000-8000-0000000003a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_itens where id = 'f0000000-0000-4000-8000-0000000004a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_comprovantes where id = 'f0000000-0000-4000-8000-0000000005a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_atividades where id = 'f0000000-0000-4000-8000-0000000006a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_atividade_evidencias where id = 'f0000000-0000-4000-8000-0000000007a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_relatorio where id = 'f0000000-0000-4000-8000-0000000008a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_distribuicao where id = 'f0000000-0000-4000-8000-0000000009a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_divulgacao where id = 'f0000000-0000-4000-8000-000000000aa0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_alteracoes where id = 'f0000000-0000-4000-8000-000000000ba0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_contas_bancarias where id = 'f0000000-0000-4000-8000-0000000010a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_extrato_importacoes where id = 'f0000000-0000-4000-8000-0000000011a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_lancamentos where id = 'f0000000-0000-4000-8000-0000000012a0'$c$),
    rls_teste.efeito($c$delete from public.prestacao_fornecedores where id = 'f0000000-0000-4000-8000-0000000013a0'$c$)
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

grant execute on all functions in schema rls_teste to authenticated, anon;

-- O bucket recusa exclusão direta fora da API de arquivos; aqui a trava sai
-- para o teste olhar só a regra de quem pode apagar.
set local storage.allow_delete_query = 'true';

-- ─── Organização A: admin ───────────────────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'admin: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'admin: cria em tudo, menos no histórico e no extrato (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'admin: altera tudo, menos o histórico e o extrato');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'admin: apaga tudo, menos o histórico e o lançamento avulso');
select is(rls_teste.arquivos(), array['le', 'envia', 'troca', 'apaga'], 'admin: lê, envia, troca e apaga arquivos da prestação');
reset role;

-- ─── Organização A: colaborador preparador ──────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'colaborador: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'colaborador: cria em tudo, menos no histórico e no extrato (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'colaborador: altera tudo, menos o histórico e o extrato');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'colaborador: apaga tudo, menos o histórico e o lançamento avulso');
select is(rls_teste.arquivos(), array['le', 'envia', 'troca', 'apaga'], 'colaborador: lê, envia, troca e apaga arquivos da prestação');
reset role;

-- ─── Organização A: colaborador revisor ─────────────────────────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), rls_teste.todas(), 'revisor: vê tudo da prestação');
select is(rls_teste.insere(), rls_teste.editaveis(), 'revisor: cria em tudo, menos no histórico e no extrato (só pelas funções)');
select is(rls_teste.altera(), rls_teste.editaveis(), 'revisor: altera tudo, menos o histórico e o extrato');
select is(rls_teste.apaga(), rls_teste.apagaveis(), 'revisor: apaga tudo, menos o histórico e o lançamento avulso');
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
reset role;

-- ─── Organização A: colaborador sem o módulo da prestação ───────────────────

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(rls_teste.ve('f0000000-0000-4000-8000-0000000001a0'), '{}'::text[], 'sem o módulo: não vê a prestação');
select is(rls_teste.insere(), '{}'::text[], 'sem o módulo: não cria nada');
select is(rls_teste.altera(), '{}'::text[], 'sem o módulo: não altera nada');
select is(rls_teste.apaga(), '{}'::text[], 'sem o módulo: não apaga nada');
select is(rls_teste.arquivos(), '{}'::text[], 'sem o módulo: não mexe nos arquivos da prestação');
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

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select lives_ok($t$select public.fn_prestacao_mudar_status('f0000000-0000-4000-8000-0000000001a0', 'enviado', null)$t$,
  'admin: envia a prestação');

-- ─── Fornecedores: a consulta pública só pela função ────────────────────────

select throws_ok($t$update public.prestacao_fornecedores set situacao_cadastral = 'ATIVA' where id = 'f0000000-0000-4000-8000-0000000013a0'$t$,
  '42501', null, 'quem edita: não grava a situação da Receita na mão');
select throws_ok($t$insert into public.prestacao_fornecedores (organization_id, documento, sancoes_situacao) values ('f0000000-0000-4000-8000-0000000000a0', '00000000000191', 'nada_consta')$t$,
  '42501', null, 'quem edita: não cria fornecedor com sanção já consultada');
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

select * from finish();
rollback;
