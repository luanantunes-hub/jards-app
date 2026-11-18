-- E-mail do CRM: a tabela de conexões passa a aceitar a Microsoft (Outlook, Hotmail e Microsoft 365) além do Google.
-- Só relaxa o CHECK do provedor; a tabela, a chave (user_id, provider) e a política de linha própria seguem iguais.
-- Uma pessoa pode ter as duas conexões, uma de cada provedor.

alter table public.email_connections drop constraint if exists email_connections_provider_check;
alter table public.email_connections
  add constraint email_connections_provider_check check (provider in ('google', 'microsoft'));
