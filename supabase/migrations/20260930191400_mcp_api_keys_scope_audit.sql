-- Fecha os gaps identificados na revisão de segurança do MCP/Custom GPT:
-- chaves sem expiração, sem escopo de permissão e sem trilha de auditoria.

ALTER TABLE public.mcp_api_keys
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'read' CHECK (scope IN ('read', 'write')),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN public.mcp_api_keys.scope IS
  'read: só consulta. write: também pode criar contatos/tarefas. Padrão read (mínimo privilégio).';
COMMENT ON COLUMN public.mcp_api_keys.expires_at IS
  'Chave para de funcionar depois dessa data. NULL = sem expiração (desencorajado; a UI sempre sugere um prazo).';

-- Trilha de auditoria: uma linha por chamada autenticada em /api/mcp/*. Permite
-- responder "quem acessou o quê, quando" — hoje só existia last_used_at.
CREATE TABLE IF NOT EXISTS public.mcp_api_key_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_id uuid NOT NULL REFERENCES public.mcp_api_keys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status integer,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.mcp_api_key_usage.status IS
  'Registrado no momento da autenticação (antes da rota rodar), não o status HTTP final — suficiente para "quem acessou o quê, quando"; NULL quando não informado.';

CREATE INDEX IF NOT EXISTS idx_mcp_api_key_usage_key ON public.mcp_api_key_usage(key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_api_key_usage_user ON public.mcp_api_key_usage(user_id, created_at DESC);

ALTER TABLE public.mcp_api_key_usage ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mcp_api_key_usage' AND policyname = 'mcp_api_key_usage: select own'
  ) THEN
    EXECUTE 'CREATE POLICY "mcp_api_key_usage: select own" ON public.mcp_api_key_usage FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
END
$policy$;

-- Sem policy de INSERT: só o backend (service role) grava, a partir da chamada
-- já autenticada em authenticateMcpRequest.

-- Cron de limpeza não existe neste banco; linhas antigas de auditoria são
-- inofensivas (só leitura), mas se crescer demais considerar pg_cron ou uma
-- rotina de purge (> 180 dias) mais adiante.
