-- Clientes OAuth registrados dinamicamente (RFC 7591) por assistentes que falam MCP, como o Claude.
-- Cada pessoa autoriza com a própria conta; o cliente em si é público (sem segredo) e protegido
-- por PKCE. O ChatGPT segue com o cliente fixo das variáveis de ambiente e não passa por aqui.
-- Só o backend (chave de serviço) lê e grava: sem acesso para anon nem authenticated.

create table if not exists public.oauth_clients (
  client_id     text primary key,
  client_name   text not null,
  redirect_uris text[] not null,
  created_at    timestamptz not null default now(),
  check (cardinality(redirect_uris) between 1 and 5)
);

alter table public.oauth_clients enable row level security;
revoke all on public.oauth_clients from anon, authenticated;

comment on table public.oauth_clients is
  'Clientes OAuth públicos registrados via /api/mcp/oauth/register (assistentes MCP, ex. Claude). Escrita e leitura só pelo backend.';
