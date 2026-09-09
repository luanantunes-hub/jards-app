-- Pedidos de pesquisa para empresas públicas que ainda não possuem detalhe.

CREATE TABLE IF NOT EXISTS public.solicitacoes_pesquisa_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_pesquisa', 'concluida', 'cancelada')),
  prioridade smallint NOT NULL DEFAULT 1 CHECK (prioridade BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  UNIQUE (organization_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_pesquisa_status
  ON public.solicitacoes_pesquisa_empresa(status, prioridade DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_pesquisa_org
  ON public.solicitacoes_pesquisa_empresa(organization_id, created_at DESC);

ALTER TABLE public.solicitacoes_pesquisa_empresa ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'solicitacoes_pesquisa_empresa'
      AND policyname = 'solicitacoes pesquisa: select org'
  ) THEN
    EXECUTE 'CREATE POLICY "solicitacoes pesquisa: select org" ON public.solicitacoes_pesquisa_empresa FOR SELECT TO authenticated USING (organization_id = ANY(ARRAY(SELECT public.auth_org_ids())))';
  END IF;
END
$policy$;

CREATE OR REPLACE FUNCTION public.fn_solicitar_pesquisa_empresa(
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
  v_tem_detalhe boolean;
  v_solicitacao public.solicitacoes_pesquisa_empresa%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  SELECT tem_detalhe
    INTO v_tem_detalhe
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF COALESCE(v_tem_detalhe, false) THEN
    RAISE EXCEPTION 'Esta empresa já possui informações detalhadas';
  END IF;

  -- Garante o saldo padrão para organizações recém-criadas antes do bloqueio.
  INSERT INTO public.creditos (
    account_id,
    organization_id,
    plano,
    creditos_totais,
    creditos_usados,
    usuarios_extras
  )
  VALUES (auth.uid(), p_organization_id, 'basico_30', 30, 0, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  -- Serializa a cobrança por organização e impede consumo duplicado.
  SELECT creditos_totais, creditos_usados
    INTO v_total, v_usados
  FROM public.creditos
  WHERE organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo de créditos não encontrado';
  END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_pesquisa_empresa
  WHERE organization_id = p_organization_id
    AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF FOUND AND v_solicitacao.status <> 'cancelada' THEN
    RETURN jsonb_build_object(
      'sucesso', true,
      'consumiu_credito', false,
      'ja_solicitada', true,
      'solicitacao_id', v_solicitacao.id,
      'status', v_solicitacao.status
    );
  END IF;

  IF v_usados >= v_total THEN
    RAISE EXCEPTION 'Sem créditos disponíveis. Faça upgrade do plano.';
  END IF;

  INSERT INTO public.solicitacoes_pesquisa_empresa (
    organization_id,
    empresa_id,
    solicitante_id,
    status,
    prioridade,
    updated_at,
    concluida_em
  )
  VALUES (
    p_organization_id,
    p_empresa_id,
    auth.uid(),
    'pendente',
    1,
    now(),
    NULL
  )
  ON CONFLICT (organization_id, empresa_id)
  DO UPDATE SET
    solicitante_id = EXCLUDED.solicitante_id,
    status = 'pendente',
    prioridade = 1,
    updated_at = now(),
    concluida_em = NULL
  RETURNING * INTO v_solicitacao;

  UPDATE public.creditos
  SET creditos_usados = creditos_usados + 1,
      updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.historico_creditos (organization_id, user_id, empresa_id, tipo)
  VALUES (p_organization_id, auth.uid(), p_empresa_id, 'pesquisa_empresa');

  RETURN jsonb_build_object(
    'sucesso', true,
    'consumiu_credito', true,
    'ja_solicitada', false,
    'solicitacao_id', v_solicitacao.id,
    'status', v_solicitacao.status
  );
END;
$function$;

GRANT SELECT ON public.solicitacoes_pesquisa_empresa TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_solicitar_pesquisa_empresa(uuid, uuid) TO authenticated;
