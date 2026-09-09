-- Completa o subsistema de créditos em bancos onde a migration inicial não foi aplicada.

CREATE TABLE IF NOT EXISTS public.config_org (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  visibilidade_captacoes text NOT NULL DEFAULT 'admin_only'
    CHECK (visibilidade_captacoes IN ('admin_only', 'team_shared')),
  acesso_contatos text NOT NULL DEFAULT 'team_with_credits'
    CHECK (acesso_contatos IN ('admin_only', 'team_with_credits')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE TABLE IF NOT EXISTS public.historico_creditos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id),
  tipo text NOT NULL DEFAULT 'visualizacao_contato',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_org ON public.config_org(organization_id);
CREATE INDEX IF NOT EXISTS idx_historico_creditos_org
  ON public.historico_creditos(organization_id, created_at);

ALTER TABLE public.config_org ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_creditos ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_org' AND policyname = 'config_org: select'
  ) THEN
    EXECUTE 'CREATE POLICY "config_org: select" ON public.config_org FOR SELECT TO authenticated USING (organization_id = ANY(ARRAY(SELECT public.auth_org_ids())))';
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.fn_creditos_disponiveis(p_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_totais integer;
  v_usados integer;
BEGIN
  SELECT creditos_totais, creditos_usados
    INTO v_totais, v_usados
  FROM public.creditos
  WHERE organization_id = p_organization_id;

  RETURN GREATEST(COALESCE(v_totais, 0) - COALESCE(v_usados, 0), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_consumir_credito(
  p_organization_id uuid,
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_acesso_contatos text;
  v_disponiveis integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  SELECT acesso_contatos
    INTO v_acesso_contatos
  FROM public.config_org
  WHERE organization_id = p_organization_id;

  IF COALESCE(v_acesso_contatos, 'team_with_credits') = 'admin_only' THEN
    RETURN true;
  END IF;

  v_disponiveis := public.fn_creditos_disponiveis(p_organization_id);
  IF v_disponiveis <= 0 THEN
    RAISE EXCEPTION 'Sem créditos disponíveis. Faça upgrade do plano.';
  END IF;

  UPDATE public.creditos
  SET creditos_usados = creditos_usados + 1,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.historico_creditos (organization_id, user_id, empresa_id, tipo)
  VALUES (p_organization_id, auth.uid(), p_empresa_id, 'visualizacao_contato');

  RETURN true;
END;
$function$;

GRANT SELECT ON public.config_org, public.historico_creditos TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_creditos_disponiveis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_consumir_credito(uuid, uuid) TO authenticated;
