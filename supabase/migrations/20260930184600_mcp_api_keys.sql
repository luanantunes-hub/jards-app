-- Chaves de API pessoais para integrações externas (MCP/Custom GPT). Cada
-- usuário gera/revoga as próprias chaves; o backend nunca vê a chave em texto
-- puro de novo depois de criada, só o hash.

CREATE TABLE IF NOT EXISTS public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_user ON public.mcp_api_keys(user_id);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mcp_api_keys' AND policyname = 'mcp_api_keys: select own'
  ) THEN
    EXECUTE 'CREATE POLICY "mcp_api_keys: select own" ON public.mcp_api_keys FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'mcp_api_keys' AND policyname = 'mcp_api_keys: delete own'
  ) THEN
    EXECUTE 'CREATE POLICY "mcp_api_keys: delete own" ON public.mcp_api_keys FOR DELETE TO authenticated USING (user_id = auth.uid())';
  END IF;
END
$policy$;

-- Sem policy de INSERT: chaves só são criadas pelo backend (service role) via
-- app/api/mcp/keys, depois de confirmar a sessão do usuário — evita que
-- alguém grave um key_hash arbitrário direto pelo client.

-- Variante de fn_desbloquear_empresa para chamadas autenticadas por API key
-- (sem auth.uid(), já que quem chama é o backend do Next via service role).
-- Reaplica exatamente a mesma checagem de posse e a mesma trava de saldo.
CREATE OR REPLACE FUNCTION public.fn_desbloquear_empresa_as(
  p_user_id uuid,
  p_organization_id uuid,
  p_empresa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_total integer;
  v_usados integer;
  v_desbloqueio_id uuid;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  SELECT creditos_totais, creditos_usados
    INTO v_total, v_usados
  FROM public.creditos
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo de créditos não encontrado';
  END IF;

  INSERT INTO public.desbloqueios (account_id, organization_id, empresa_pub_id)
  VALUES (p_user_id, p_organization_id, p_empresa_id)
  ON CONFLICT (organization_id, empresa_pub_id)
    WHERE organization_id IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_desbloqueio_id;

  IF v_desbloqueio_id IS NULL THEN
    RETURN jsonb_build_object('sucesso', true, 'consumiu_credito', false);
  END IF;

  IF v_usados >= v_total THEN
    RAISE EXCEPTION 'Sem créditos disponíveis. Faça upgrade do plano.';
  END IF;

  UPDATE public.creditos
  SET creditos_usados = creditos_usados + 1,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.historico_creditos (organization_id, user_id, empresa_id, tipo)
  VALUES (p_organization_id, p_user_id, p_empresa_id, 'desbloqueio_empresa');

  RETURN jsonb_build_object('sucesso', true, 'consumiu_credito', true);
END;
$function$;

-- Só o service role chama esta variante (o Next resolve p_user_id a partir da
-- API key já validada) — não expõe para clients autenticados via anon key.
REVOKE ALL ON FUNCTION public.fn_desbloquear_empresa_as(uuid, uuid, uuid) FROM PUBLIC, authenticated, anon;
