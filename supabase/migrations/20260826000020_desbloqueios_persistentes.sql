-- Um desbloqueio pertence à organização e é cobrado uma única vez por empresa.

ALTER TABLE public.desbloqueios
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Legado: registros anteriores eram escopados apenas por account_id.
UPDATE public.desbloqueios d
SET organization_id = m.organization_id
FROM public.organization_members m
WHERE d.organization_id IS NULL
  AND d.account_id = m.user_id;

CREATE INDEX IF NOT EXISTS idx_desbloqueios_org_empresa
  ON public.desbloqueios(organization_id, empresa_pub_id);

CREATE UNIQUE INDEX IF NOT EXISTS desbloqueios_org_empresa_unico
  ON public.desbloqueios(organization_id, empresa_pub_id)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.desbloqueios ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'desbloqueios'
      AND policyname = 'desbloqueios: select org'
  ) THEN
    EXECUTE 'CREATE POLICY "desbloqueios: select org" ON public.desbloqueios FOR SELECT TO authenticated USING (organization_id = ANY(ARRAY(SELECT public.auth_org_ids())))';
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.fn_desbloquear_empresa(
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
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  -- Trava o saldo da organização para impedir dupla cobrança em requisições concorrentes.
  SELECT creditos_totais, creditos_usados
    INTO v_total, v_usados
  FROM public.creditos
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo de créditos não encontrado';
  END IF;

  INSERT INTO public.desbloqueios (account_id, organization_id, empresa_pub_id)
  VALUES (auth.uid(), p_organization_id, p_empresa_id)
  ON CONFLICT (organization_id, empresa_pub_id)
    WHERE organization_id IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_desbloqueio_id;

  -- Já estava desbloqueada: preserva o saldo e libera o acesso.
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
  VALUES (p_organization_id, auth.uid(), p_empresa_id, 'desbloqueio_empresa');

  RETURN jsonb_build_object('sucesso', true, 'consumiu_credito', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_desbloquear_empresa(uuid, uuid) TO authenticated;
