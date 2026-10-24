-- Assistente de IA na prestação de contas: a regra de "quem edita", as tabelas do assistente e o canal "assistente".
--
-- Confere a migration assistente_prestacao:
--  * fn_mcp_prestacao_pode (o servidor do conector pergunta, em nome da pessoa que autorizou o assistente, se ela edita a
--    prestação) dá a mesma resposta que auth_prestacao_pode, que é a regra do app, para cada papel, função e situação do módulo;
--  * a equipe lê o que o assistente fez e a caixa de entrada dos arquivos; ninguém de fora lê, e ninguém logado escreve;
--  * o link de envio de arquivos só o servidor enxerga;
--  * as conferências das três tabelas; o canal "assistente" nas despesas e nas evidências; e o aviso à equipe.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado):
--   organização A, com o módulo da prestação em vigor: admin, preparador, revisor, responsável, leitor, visualizador
--     (o nome antigo de colaborador), colaborador sem o módulo e captador com o módulo;
--   organização B, com a prestação só para leitura (sem assinatura): admin;
--   organização C, sem o módulo: admin com acesso aos dois módulos;
--   uma pessoa sem vínculo nenhum.
--   Uma prestação em cada organização.
--
-- Rodar: supabase/tests/README.md. Com a migration na frente, o teste roda sobre ela antes de ela ser aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(71);

-- ─── Cenário ────────────────────────────────────────────────────────────────

do $cenario$
declare
  org_a uuid := 'f8000000-0000-4000-8000-0000000000a0';
  org_b uuid := 'f8000000-0000-4000-8000-0000000000b0';
  org_c uuid := 'f8000000-0000-4000-8000-0000000000c0';
  admin_a uuid := 'f8000000-0000-4000-8000-0000000000a1';
  pa uuid := 'f8000000-0000-4000-8000-0000000001a0';
  pb uuid := 'f8000000-0000-4000-8000-0000000001b0';
  pc uuid := 'f8000000-0000-4000-8000-0000000001c0';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select id, 'ass-' || id || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array[
    'f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000000a2', 'f8000000-0000-4000-8000-0000000000a3',
    'f8000000-0000-4000-8000-0000000000a4', 'f8000000-0000-4000-8000-0000000000a5', 'f8000000-0000-4000-8000-0000000000a6',
    'f8000000-0000-4000-8000-0000000000a7', 'f8000000-0000-4000-8000-0000000000a8', 'f8000000-0000-4000-8000-0000000000b1',
    'f8000000-0000-4000-8000-0000000000c1', 'f8000000-0000-4000-8000-0000000000d1'
  ]::uuid[]) as id;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova. Ela fica: não tem o módulo da prestação
  -- e não muda nenhum caso abaixo.

  insert into public.organizations (id, nome) values (org_a, 'ASS organização A'), (org_b, 'ASS organização B'), (org_c, 'ASS organização C');
  insert into public.organization_modulos (organization_id, modulo, status) values (org_a, 'prestacao', 'ativo');
  -- B está sem assinatura: a prestação está na lista de leitura, como a cobrança deixa.
  update public.organizations set modulos_ativos = '{captacao}', modulos_leitura = '{prestacao}' where id = org_b;

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao) values
    (org_a, admin_a, 'admin', '{captacao,prestacao}', null),
    (org_a, 'f8000000-0000-4000-8000-0000000000a2', 'colaborador', '{prestacao}', 'preparador'),
    (org_a, 'f8000000-0000-4000-8000-0000000000a3', 'colaborador', '{prestacao}', 'revisor'),
    (org_a, 'f8000000-0000-4000-8000-0000000000a4', 'colaborador', '{prestacao}', 'responsavel'),
    (org_a, 'f8000000-0000-4000-8000-0000000000a5', 'leitor', '{prestacao}', null),
    (org_a, 'f8000000-0000-4000-8000-0000000000a6', 'colaborador', '{captacao}', null),
    (org_a, 'f8000000-0000-4000-8000-0000000000a7', 'captador', '{prestacao}', null),
    (org_a, 'f8000000-0000-4000-8000-0000000000a8', 'visualizador', '{prestacao}', null),
    (org_b, 'f8000000-0000-4000-8000-0000000000b1', 'admin', '{captacao,prestacao}', null),
    (org_c, 'f8000000-0000-4000-8000-0000000000c1', 'admin', '{captacao,prestacao}', null);

  insert into public.prestacoes_contas (id, titulo, organization_id, criado_por) values
    (pa, 'ASS prestação A', org_a, admin_a),
    (pb, 'ASS prestação B', org_b, 'f8000000-0000-4000-8000-0000000000b1'),
    (pc, 'ASS prestação C', org_c, 'f8000000-0000-4000-8000-0000000000c1');

  -- O que o assistente fez e recebeu em A e em B.
  insert into public.assistente_acoes (prestacao_id, usuario_id, plataforma, ferramenta, acao, tabela, registro_id, resumo) values
    (pa, admin_a, 'claude', 'registrar_despesas', 'criar', 'prestacao_comprovantes', 'f8000000-0000-4000-8000-0000000005a0', 'Registrou a despesa NF 1'),
    (pb, 'f8000000-0000-4000-8000-0000000000b1', 'chatgpt', 'rodar_verificacoes', 'verificar', null, null, 'Rodou a verificação');
  insert into public.assistente_arquivos (prestacao_id, usuario_id, plataforma, origem, destino, situacao, nome_arquivo, storage_path, expira_em) values
    (pa, admin_a, 'claude', 'url_assinada', 'despesa', 'aguardando', 'nf1.pdf',
     org_a || '/prestacoes/' || pa || '/comprovantes/f8000000-0000-4000-8000-000000000ca0.pdf', now() + interval '1 day');
  insert into public.assistente_sessoes_envio (prestacao_id, usuario_id, plataforma, token_hash, destino, expira_em) values
    (pa, admin_a, 'claude', encode(extensions.digest('segredo-do-link', 'sha256'), 'hex'), 'despesa', now() + interval '15 minutes');
end
$cenario$;

-- A função é só do servidor. Para compará-la com a do app, cada pessoa pergunta as duas na mesma consulta; o direito de
-- executar vale só dentro desta transação, que é desfeita.
grant execute on function public.fn_mcp_prestacao_pode(uuid, uuid, text) to authenticated;

-- ─── Quem edita: o servidor responde como o app ─────────────────────────────

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), true, 'admin edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'admin: editar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'avaliar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'avaliar'), 'admin: avaliar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'decidir'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'decidir'), 'admin: decidir, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001b0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001b0', 'editar'), 'admin de A em B: igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001b0', 'editar'), false, 'admin de A não edita a prestação de B');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001c0', 'editar'), false, 'admin de A não edita a prestação de C');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a2","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a2', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), true, 'preparador edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a2', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'preparador: editar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a2', 'f8000000-0000-4000-8000-0000000001a0', 'avaliar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'avaliar'), 'preparador: avaliar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a2', 'f8000000-0000-4000-8000-0000000001a0', 'decidir'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'decidir'), 'preparador: decidir, igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a3","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a3', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), true, 'revisor edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a3', 'f8000000-0000-4000-8000-0000000001a0', 'avaliar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'avaliar'), 'revisor: avaliar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a3', 'f8000000-0000-4000-8000-0000000001a0', 'decidir'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'decidir'), 'revisor: decidir, igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a4","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a4', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), true, 'responsável edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a4', 'f8000000-0000-4000-8000-0000000001a0', 'avaliar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'avaliar'), 'responsável: avaliar, igual ao app');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a4', 'f8000000-0000-4000-8000-0000000001a0', 'decidir'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'decidir'), 'responsável: decidir, igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a5', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), false, 'leitor não edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a5', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'leitor: editar, igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a6', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), false, 'colaborador sem o módulo não edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a6', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'sem o módulo: igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a7","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a7', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), false, 'captador não edita, mesmo com o módulo');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a7', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'captador: igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a8","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a8', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), true, 'visualizador (nome antigo de colaborador) edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a8', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'visualizador: igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000b1', 'f8000000-0000-4000-8000-0000000001b0', 'editar'), false, 'organização só com leitura: nem o admin edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000b1', 'f8000000-0000-4000-8000-0000000001b0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001b0', 'editar'), 'só leitura: igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000c1","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000c1', 'f8000000-0000-4000-8000-0000000001c0', 'editar'), false, 'organização sem o módulo: o admin não edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000c1', 'f8000000-0000-4000-8000-0000000001c0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001c0', 'editar'), 'sem o módulo na organização: igual ao app');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
set local role authenticated;
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000d1', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), false, 'sem vínculo nenhum: não edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000d1', 'f8000000-0000-4000-8000-0000000001a0', 'editar'), public.auth_prestacao_pode('f8000000-0000-4000-8000-0000000001a0', 'editar'), 'sem vínculo: igual ao app');
reset role;

-- Prestação que não existe, ação desconhecida e o navegador sem o direito de executar.
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001ff', 'editar'), false, 'prestação que não existe: não edita');
select is(public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'apagar'), false, 'ação desconhecida: não pode');
select is(public.fn_mcp_prestacao_pode(null, 'f8000000-0000-4000-8000-0000000001a0', 'editar'), false, 'sem pessoa: não pode');
revoke execute on function public.fn_mcp_prestacao_pode(uuid, uuid, text) from authenticated;
set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_mcp_prestacao_pode('f8000000-0000-4000-8000-0000000000a1', 'f8000000-0000-4000-8000-0000000001a0', 'editar')$t$, '42501', null, 'o navegador não executa a função do conector');
reset role;

-- ─── Quem lê e quem escreve nas tabelas do assistente ───────────────────────

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.assistente_acoes), 1, 'admin: lê as ações do assistente da própria prestação (e só dela)');
select is((select count(*)::integer from public.assistente_arquivos), 1, 'admin: lê a caixa de entrada da própria prestação');
select throws_ok($t$select count(*) from public.assistente_sessoes_envio$t$, '42501', null, 'admin: não lê os links de envio, só o servidor');
select throws_ok($t$insert into public.assistente_acoes (prestacao_id, ferramenta, acao, resumo) values ('f8000000-0000-4000-8000-0000000001a0', 'x', 'criar', 'x')$t$, '42501', null, 'admin: não grava ação do assistente');
select throws_ok($t$update public.assistente_acoes set resumo = 'outro'$t$, '42501', null, 'admin: não altera ação do assistente');
select throws_ok($t$delete from public.assistente_acoes$t$, '42501', null, 'admin: não apaga ação do assistente');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, nome_arquivo, storage_path, expira_em) values ('f8000000-0000-4000-8000-0000000001a0', 'texto', 'despesa', 'x', 'x', now())$t$, '42501', null, 'admin: não grava na caixa de entrada');
select throws_ok($t$insert into public.assistente_sessoes_envio (prestacao_id, token_hash, destino, expira_em) values ('f8000000-0000-4000-8000-0000000001a0', repeat('a', 64), 'despesa', now())$t$, '42501', null, 'admin: não cria link de envio');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a5","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.assistente_acoes), 1, 'leitor: lê as ações do assistente');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a6","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.assistente_acoes), 0, 'colaborador sem o módulo: não lê as ações do assistente');
select is((select count(*)::integer from public.assistente_arquivos), 0, 'colaborador sem o módulo: não lê a caixa de entrada');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000b1","role":"authenticated"}';
set local role authenticated;
select is((select array_agg(resumo)::text from public.assistente_acoes), '{"Rodou a verificação"}', 'organização só com leitura: lê as próprias ações, não as de A');
select is((select count(*)::integer from public.assistente_arquivos), 0, 'organização só com leitura: a caixa de entrada de A não aparece');
reset role;

set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
set local role authenticated;
select is((select count(*)::integer from public.assistente_acoes) + (select count(*)::integer from public.assistente_arquivos), 0, 'sem vínculo: não lê nada');
reset role;

-- ─── As conferências das tabelas (o servidor escreve) ───────────────────────

select lives_ok($t$insert into public.assistente_acoes (prestacao_id, plataforma, ferramenta, acao, resumo) values ('f8000000-0000-4000-8000-0000000001a0', 'claude', 'registrar_despesas', 'criar', 'Registrou a despesa NF 2')$t$, 'ação: aceita o registro de uma despesa');
select throws_ok($t$insert into public.assistente_acoes (prestacao_id, plataforma, ferramenta, acao, resumo) values ('f8000000-0000-4000-8000-0000000001a0', 'gemini', 'x', 'criar', 'x')$t$, '23514', null, 'ação: plataforma desconhecida é recusada');
select throws_ok($t$insert into public.assistente_acoes (prestacao_id, ferramenta, acao, resumo) values ('f8000000-0000-4000-8000-0000000001a0', 'x', 'apagar_tudo', 'x')$t$, '23514', null, 'ação: tipo de ação desconhecido é recusado');
select throws_ok($t$insert into public.assistente_acoes (prestacao_id, ferramenta, acao, resumo) values ('f8000000-0000-4000-8000-0000000001a0', 'x', 'criar', '')$t$, '23514', null, 'ação: sem resumo é recusada');

select lives_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, situacao, nome_arquivo, sha256, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'chatgpt', 'despesa', 'recebido', 'nf2.pdf', repeat('a', 64), 'a/b/c.pdf', now() + interval '1 day')$t$, 'arquivo: aceita o que chegou');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, situacao, nome_arquivo, sha256, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'pagina', 'despesa', 'recebido', 'nf2-de-novo.pdf', repeat('a', 64), 'a/b/d.pdf', now() + interval '1 day')$t$, '23505', null, 'arquivo: o mesmo conteúdo não entra duas vezes na prestação');
select lives_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, situacao, nome_arquivo, sha256, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'pagina', 'evidencia', 'recebido', 'foto.jpg', repeat('a', 64), 'a/b/e.jpg', now() + interval '1 day')$t$, 'arquivo: o mesmo conteúdo pode ser despesa e evidência');
select lives_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, situacao, nome_arquivo, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'url_assinada', 'despesa', 'aguardando', 'a.pdf', 'a/b/f.pdf', now() + interval '1 day'),
         ('f8000000-0000-4000-8000-0000000001a0', 'url_assinada', 'despesa', 'aguardando', 'b.pdf', 'a/b/g.pdf', now() + interval '1 day')$t$, 'arquivo: vários ainda por chegar convivem');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, nome_arquivo, sha256, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'texto', 'despesa', 'x', 'não é um hash', 'a/b/h.pdf', now())$t$, '23514', null, 'arquivo: impressão digital mal formada é recusada');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, nome_arquivo, tamanho_bytes, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'texto', 'despesa', 'x', 15728641, 'a/b/i.pdf', now())$t$, '23514', null, 'arquivo: acima de 15 MB é recusado');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, nome_arquivo, storage_path, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'email', 'despesa', 'x', 'a/b/j.pdf', now())$t$, '23514', null, 'arquivo: origem desconhecida é recusada');
select throws_ok($t$insert into public.assistente_arquivos (prestacao_id, origem, destino, nome_arquivo, storage_path, registro_tabela, expira_em)
  values ('f8000000-0000-4000-8000-0000000001a0', 'texto', 'despesa', 'x', 'a/b/k.pdf', 'organizations', now())$t$, '23514', null, 'arquivo: só vira despesa ou evidência');

select throws_ok($t$insert into public.assistente_sessoes_envio (prestacao_id, token_hash, destino, expira_em) values ('f8000000-0000-4000-8000-0000000001a0', 'curto', 'despesa', now())$t$, '23514', null, 'link de envio: só guarda o hash do código');
select throws_ok($t$insert into public.assistente_sessoes_envio (prestacao_id, token_hash, destino, max_arquivos, expira_em) values ('f8000000-0000-4000-8000-0000000001a0', repeat('b', 64), 'despesa', 11, now())$t$, '23514', null, 'link de envio: até 10 arquivos por link');
select throws_ok($t$insert into public.assistente_sessoes_envio (prestacao_id, token_hash, destino, expira_em) values ('f8000000-0000-4000-8000-0000000001a0', encode(extensions.digest('segredo-do-link', 'sha256'), 'hex'), 'despesa', now())$t$, '23505', null, 'link de envio: dois links não têm o mesmo código');

-- ─── O canal "assistente" ───────────────────────────────────────────────────

select lives_ok($t$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path, canal) values ('f8000000-0000-4000-8000-0000000001a0', 'assistente.pdf', 'f8000000-0000-4000-8000-0000000000a0/prestacoes/f8000000-0000-4000-8000-0000000001a0/comprovantes/f8000000-0000-4000-8000-000000000ca1.pdf', 'assistente')$t$, 'a despesa aceita o canal assistente');
select throws_ok($t$insert into public.prestacao_comprovantes (prestacao_id, nome_arquivo, storage_path, canal) values ('f8000000-0000-4000-8000-0000000001a0', 'x.pdf', 'x', 'telepatia')$t$, '23514', null, 'a despesa continua recusando canal desconhecido');
select lives_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, url, canal) values ('f8000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/foto', 'assistente')$t$, 'a evidência aceita o canal assistente');
select throws_ok($t$insert into public.prestacao_evidencias (prestacao_id, tipo, url, canal) values ('f8000000-0000-4000-8000-0000000001a0', 'link', 'https://exemplo.org/foto', 'email')$t$, '23514', null, 'a evidência continua recusando o canal e-mail');

-- ─── O aviso à equipe ───────────────────────────────────────────────────────

set local role service_role;
select public.fn_prestacao_avisar_assistente('f8000000-0000-4000-8000-0000000001a0', 'Despesa registrada pelo assistente', 'Confira e avalie.', 'ass-1');
select public.fn_prestacao_avisar_assistente('f8000000-0000-4000-8000-0000000001a0', 'Despesa registrada pelo assistente', 'Confira e avalie.', 'ass-1');
reset role;
select is((select array_agg(link) from public.notificacoes where dedupe_key = 'prestacao_assistente:ass-1'),
  array['/prestacoes/f8000000-0000-4000-8000-0000000001a0/comprovantes'], 'aviso: leva aos comprovantes, e repetir a mesma ação não duplica');
set local request.jwt.claims = '{"sub":"f8000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
set local role authenticated;
select throws_ok($t$select public.fn_prestacao_avisar_assistente('f8000000-0000-4000-8000-0000000001a0', 'x', 'x', 'ass-2')$t$, '42501', null, 'aviso: o navegador não dispara');
reset role;
select lives_ok($t$select public.fn_prestacao_avisar_assistente('f8000000-0000-4000-8000-0000000001ff', 'x', 'x', 'ass-3')$t$, 'aviso: prestação que não existe não faz nada');

select * from finish();
rollback;
