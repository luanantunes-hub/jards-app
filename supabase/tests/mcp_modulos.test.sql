-- Conector MCP por módulo: a coluna `modulos` das chaves e das autorizações.
--
-- Confere a migration mcp_modulos: quem grava sem informar módulos (o código de antes dos módulos, as chaves e as
-- conexões que já existem) fica só com a captação; módulo conhecido é aceito, sozinho ou junto; lista vazia, módulo
-- desconhecido e nulo são recusados nas três tabelas; e o navegador continua sem gravar nem alterar nada ali (só o
-- servidor do conector, com a chave de serviço, escreve os módulos que a pessoa autorizou).
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado): uma pessoa e as linhas de cada caso.
--
-- Rodar: supabase/tests/README.md. Com a migration na frente, o teste roda sobre ela antes de ela ser aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- ─── Cenário ────────────────────────────────────────────────────────────

do $cenario$
declare
  pessoa uuid := 'f7000000-0000-4000-8000-0000000000a1';
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  values (pessoa, 'ci-' || pessoa || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());

  -- Sem informar `modulos`: é o que o código de antes dos módulos faz.
  insert into public.mcp_api_keys (user_id, key_hash, key_prefix) values (pessoa, 'ci-mcp-padrao', 'ci');
  insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at)
  values ('ci-codigo-padrao', pessoa, 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'read', now() + interval '10 minutes');
  insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at)
  values ('ci-renovacao-padrao', pessoa, 'ci-cliente', 'read', now() + interval '90 days');
end
$cenario$;

-- ─── O que já existe e o código antigo grava continua só na captação ────────

select is((select modulos::text from public.mcp_api_keys where key_hash = 'ci-mcp-padrao'),
  '{captacao}', 'mcp_api_keys: sem informar módulos vale só a captação');
select is((select modulos::text from public.oauth_authorization_codes where code_hash = 'ci-codigo-padrao'),
  '{captacao}', 'oauth_authorization_codes: sem informar módulos vale só a captação');
select is((select modulos::text from public.oauth_refresh_tokens where token_hash = 'ci-renovacao-padrao'),
  '{captacao}', 'oauth_refresh_tokens: sem informar módulos vale só a captação');

-- ─── Módulo conhecido é aceito, sozinho ou junto ────────────────────────────

select lives_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-ambos', 'ci', '{captacao,prestacao}')$t$,
  'mcp_api_keys: aceita os dois módulos juntos');
select lives_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-so-prestacao', 'ci', '{prestacao}')$t$,
  'mcp_api_keys: aceita só a prestação');
select lives_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-ambos', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'write', now() + interval '10 minutes', '{captacao,prestacao}')$t$,
  'oauth_authorization_codes: aceita os dois módulos juntos');
select lives_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-so-prestacao', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'write', now() + interval '10 minutes', '{prestacao}')$t$,
  'oauth_authorization_codes: aceita só a prestação');
select lives_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-ambos', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'write', now() + interval '90 days', '{captacao,prestacao}')$t$,
  'oauth_refresh_tokens: aceita os dois módulos juntos');
select lives_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-so-prestacao', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'write', now() + interval '90 days', '{prestacao}')$t$,
  'oauth_refresh_tokens: aceita só a prestação');

-- ─── Lista vazia, módulo desconhecido e nulo são recusados ───────────────────

select throws_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-vazio', 'ci', '{}')$t$,
  '23514', null, 'mcp_api_keys: lista vazia é recusada');
select throws_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-estranho', 'ci', '{financeiro}')$t$,
  '23514', null, 'mcp_api_keys: módulo desconhecido é recusado');
select throws_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-misto', 'ci', '{captacao,financeiro}')$t$,
  '23514', null, 'mcp_api_keys: um módulo desconhecido junto com um conhecido também é recusado');
select throws_ok($t$insert into public.mcp_api_keys (user_id, key_hash, key_prefix, modulos)
  values ('f7000000-0000-4000-8000-0000000000a1', 'ci-mcp-nulo', 'ci', null)$t$,
  '23502', null, 'mcp_api_keys: nulo é recusado');

select throws_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-vazio', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'read', now() + interval '10 minutes', '{}')$t$,
  '23514', null, 'oauth_authorization_codes: lista vazia é recusada');
select throws_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-estranho', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'read', now() + interval '10 minutes', '{financeiro}')$t$,
  '23514', null, 'oauth_authorization_codes: módulo desconhecido é recusado');
select throws_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-misto', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'read', now() + interval '10 minutes', '{captacao,financeiro}')$t$,
  '23514', null, 'oauth_authorization_codes: um módulo desconhecido junto com um conhecido também é recusado');
select throws_ok($t$insert into public.oauth_authorization_codes (code_hash, user_id, client_id, redirect_uri, scope, expires_at, modulos)
  values ('ci-codigo-nulo', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'https://claude.ai/api/mcp/auth_callback', 'read', now() + interval '10 minutes', null)$t$,
  '23502', null, 'oauth_authorization_codes: nulo é recusado');

select throws_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-vazio', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'read', now() + interval '90 days', '{}')$t$,
  '23514', null, 'oauth_refresh_tokens: lista vazia é recusada');
select throws_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-estranho', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'read', now() + interval '90 days', '{financeiro}')$t$,
  '23514', null, 'oauth_refresh_tokens: módulo desconhecido é recusado');
select throws_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-misto', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'read', now() + interval '90 days', '{captacao,financeiro}')$t$,
  '23514', null, 'oauth_refresh_tokens: um módulo desconhecido junto com um conhecido também é recusado');
select throws_ok($t$insert into public.oauth_refresh_tokens (token_hash, user_id, client_id, scope, expires_at, modulos)
  values ('ci-renovacao-nulo', 'f7000000-0000-4000-8000-0000000000a1', 'ci-cliente', 'read', now() + interval '90 days', null)$t$,
  '23502', null, 'oauth_refresh_tokens: nulo é recusado');

-- ─── O navegador não grava nem altera os módulos ────────────────────────────

select is((select count(*)::integer from pg_policies
  where schemaname = 'public' and tablename = 'mcp_api_keys' and cmd in ('INSERT', 'UPDATE', 'ALL')),
  0, 'mcp_api_keys: nenhuma regra deixa o navegador criar ou alterar chaves (só ler e apagar as próprias)');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'oauth_authorization_codes'),
  0, 'oauth_authorization_codes: sem regra nenhuma, só o servidor do conector acessa');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'oauth_refresh_tokens'),
  0, 'oauth_refresh_tokens: sem regra nenhuma, só o servidor do conector acessa');

select * from finish();
rollback;
