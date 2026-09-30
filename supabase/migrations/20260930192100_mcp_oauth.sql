-- OAuth 2.0 (authorization code + refresh) para a Custom GPT do Jards.
--
-- Por quê: uma Action com autenticação "API Key" guarda UMA chave, usada por
-- qualquer pessoa que use aquela GPT — se a GPT for compartilhada com o time,
-- todo mundo herda o acesso de quem configurou a chave. Com OAuth, cada
-- pessoa loga na própria conta Jards na hora de autorizar a GPT, e ganha o
-- próprio token, escopado só às organizações dela. O client_id/secret da
-- "aplicação ChatGPT" (fixos, via env vars) autenticam só a troca de código
-- por token — quem realmente é o usuário é decidido no /oauth/authorize,
-- atrás do login normal do Jards.

ALTER TABLE public.mcp_api_keys
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'personal' CHECK (source IN ('personal', 'oauth')),
  ADD COLUMN IF NOT EXISTS oauth_client_id text;

COMMENT ON COLUMN public.mcp_api_keys.source IS
  'personal: gerada manualmente em /configuracoes/mcp. oauth: emitida pelo fluxo OAuth da Custom GPT (token de acesso de curta duração).';

-- Código de autorização — de uso único, expira em minutos.
CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('read', 'write')),
  code_challenge text,
  code_challenge_method text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_user ON public.oauth_authorization_codes(user_id);

-- Refresh token — rotacionado a cada uso (o antigo é revogado ao emitir um novo).
CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('read', 'write')),
  access_key_id uuid REFERENCES public.mcp_api_keys(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_user ON public.oauth_refresh_tokens(user_id);

ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Sem policies de SELECT/INSERT para authenticated/anon: estas tabelas só são
-- lidas/escritas pelo backend (service role) nas rotas /api/mcp/oauth/*. Um
-- usuário pode ver/revogar os tokens OAuth que emitiu através da lista normal
-- de chaves em mcp_api_keys (que já tem policy própria), não direto aqui.
