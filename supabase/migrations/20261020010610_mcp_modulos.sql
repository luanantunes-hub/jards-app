-- Conector MCP por módulo (Claude e ChatGPT): cada chave e cada autorização consentem em módulos do Jards.
--
-- Até aqui toda chave do conector falava só do CRM (a captação). Com a prestação de contas, cada chave guarda de
-- quais módulos a pessoa autorizou falar, e o servidor só entrega esses. O padrão {captacao} deixa as chaves e as
-- conexões que já existem exatamente como são: nenhuma ganha a prestação sem uma nova autorização da pessoa.
--
-- O escopo (read/write) continua nas colunas `scope`, que têm a conferência própria; o módulo é uma dimensão à parte.
-- Aditiva e reaplicável: só colunas novas com padrão e uma conferência dos valores. Quem lê é o servidor do conector
-- (service role); as políticas dessas tabelas não mudam. O código novo lê `mcp_api_keys.modulos`: aplique esta
-- migration antes de publicar o código.

alter table public.mcp_api_keys
  add column if not exists modulos text[] not null default '{captacao}';

alter table public.oauth_authorization_codes
  add column if not exists modulos text[] not null default '{captacao}';

alter table public.oauth_refresh_tokens
  add column if not exists modulos text[] not null default '{captacao}';

do $conferencias$
declare
  tabela text;
  nome text;
begin
  foreach tabela in array array['mcp_api_keys', 'oauth_authorization_codes', 'oauth_refresh_tokens'] loop
    nome := tabela || '_modulos_check';
    if not exists (
      select 1 from pg_constraint
      where conrelid = ('public.' || tabela)::regclass and conname = nome
    ) then
      execute format(
        'alter table public.%I add constraint %I check (cardinality(modulos) > 0 and modulos <@ array[''captacao'', ''prestacao'']::text[])',
        tabela, nome
      );
    end if;
  end loop;
end
$conferencias$;

comment on column public.mcp_api_keys.modulos is
  'Módulos do Jards que esta chave pode usar pelo conector (captacao, prestacao). Padrão: só a captação, como as chaves de antes dos módulos.';
comment on column public.oauth_authorization_codes.modulos is
  'Módulos que a pessoa autorizou nesta autorização; viram os módulos da chave emitida.';
comment on column public.oauth_refresh_tokens.modulos is
  'Módulos da conexão: a renovação do acesso mantém os mesmos, sem ganhar nenhum novo.';
