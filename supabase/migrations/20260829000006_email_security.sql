-- Conexões OAuth de e-mail: tokens acessíveis somente por service_role.
CREATE TABLE IF NOT EXISTS public.email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  provider_account_email TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[],
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_user
  ON public.email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_org
  ON public.email_connections(organization_id);

DROP TRIGGER IF EXISTS trg_email_connections_updated_at ON public.email_connections;
CREATE TRIGGER trg_email_connections_updated_at
  BEFORE UPDATE ON public.email_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_connections FROM PUBLIC, anon, authenticated;

-- Mensagens sincronizadas podem ser lidas apenas pelo usuário proprietário.
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  thread_id TEXT,
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  snippet TEXT,
  body_text TEXT,
  sent_at TIMESTAMPTZ,
  direction TEXT CHECK (direction IS NULL OR direction IN ('inbound', 'outbound')),
  contato_id UUID REFERENCES public.contatos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_emails_user_sent
  ON public.emails(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_user_contato_sent
  ON public.emails(user_id, contato_id, sent_at DESC);

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emails: select own" ON public.emails;
CREATE POLICY "emails: select own"
  ON public.emails FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.emails FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.emails TO authenticated;
