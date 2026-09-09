-- Aumenta os créditos concedidos por plano: básico 30 -> 100, profissional 70 -> 200.
-- Mantém os identificadores internos 'basico_30'/'basico_70' como rótulos opacos
-- (não representam mais o número literal de créditos).

CREATE OR REPLACE FUNCTION public.fn_process_stripe_billing_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_invoice_id text,
  p_price_id text,
  p_plan text,
  p_subscription_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_paid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_user_id uuid := p_user_id;
  v_org_id uuid;
  v_plan_profile text;
  v_plan_credits text;
  v_credit_limit integer;
  v_active boolean;
  v_inserted integer;
BEGIN
  IF p_event_id IS NULL OR p_event_id = '' THEN
    RAISE EXCEPTION 'Stripe event id ausente';
  END IF;

  IF p_subscription_status NOT IN (
    'inactive', 'trialing', 'active', 'past_due', 'unpaid',
    'paused', 'canceled', 'incomplete', 'incomplete_expired'
  ) THEN
    RAISE EXCEPTION 'Status de assinatura invalido: %', p_subscription_status;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE stripe_customer_id = p_customer_id
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Perfil Stripe nao encontrado para customer %', p_customer_id;
  END IF;

  -- renewal_key impede que invoice.paid e invoice.payment_succeeded da mesma
  -- fatura renovem o saldo duas vezes.
  INSERT INTO public.stripe_billing_events (
    stripe_event_id, event_type, stripe_invoice_id, renewal_key, user_id,
    stripe_customer_id, stripe_subscription_id
  ) VALUES (
    p_event_id, p_event_type, p_invoice_id,
    CASE WHEN p_paid AND p_invoice_id IS NOT NULL THEN p_invoice_id ELSE NULL END,
    v_user_id, p_customer_id, p_subscription_id
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('processed', false, 'duplicate', true);
  END IF;

  v_active := p_subscription_status IN ('active', 'trialing');
  v_plan_profile := CASE
    WHEN p_plan IN ('basico', 'profissional') THEN p_plan
    ELSE 'gratuito'
  END;
  v_plan_credits := CASE WHEN p_plan = 'profissional' THEN 'basico_70' ELSE 'basico_30' END;
  v_credit_limit := CASE WHEN p_plan = 'profissional' THEN 200 WHEN p_plan = 'basico' THEN 100 ELSE 0 END;

  UPDATE public.profiles
  SET plano = CASE WHEN v_active THEN v_plan_profile::public.plano_tipo ELSE 'gratuito'::public.plano_tipo END,
      stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
      stripe_subscription_id = CASE
        WHEN p_subscription_status IN ('canceled', 'incomplete_expired') THEN NULL
        ELSE COALESCE(p_subscription_id, stripe_subscription_id)
      END,
      stripe_price_id = CASE WHEN v_active THEN p_price_id ELSE stripe_price_id END,
      periodo_fim = p_period_end,
      stripe_subscription_status = p_subscription_status,
      stripe_last_event_at = now(),
      updated_at = now()
  WHERE id = v_user_id;

  -- A linha de creditos existente e a fonte canonica da organizacao cobrada.
  SELECT organization_id INTO v_org_id
  FROM public.creditos
  WHERE account_id = v_user_id
  ORDER BY created_at
  LIMIT 1;

  IF v_org_id IS NULL THEN
    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = v_user_id AND papel = 'admin'
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organizacao de billing nao encontrada para usuario %', v_user_id;
  END IF;

  INSERT INTO public.creditos (
    account_id, organization_id, plano, creditos_totais, creditos_usados,
    usuarios_extras, periodo_inicio, periodo_fim, ultima_renovacao_em, suspenso_em
  ) VALUES (
    v_user_id, v_org_id, v_plan_credits,
    CASE WHEN v_active THEN v_credit_limit ELSE 0 END,
    0, 0, p_period_start, p_period_end,
    CASE WHEN p_paid THEN now() ELSE NULL END,
    CASE WHEN v_active THEN NULL ELSE now() END
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    account_id = v_user_id,
    plano = CASE WHEN v_active THEN v_plan_credits ELSE public.creditos.plano END,
    creditos_totais = CASE
      WHEN NOT v_active THEN 0
      WHEN p_paid THEN v_credit_limit
      ELSE GREATEST(public.creditos.creditos_totais, v_credit_limit)
    END,
    creditos_usados = CASE WHEN p_paid OR NOT v_active THEN 0 ELSE public.creditos.creditos_usados END,
    periodo_inicio = COALESCE(p_period_start, public.creditos.periodo_inicio),
    periodo_fim = COALESCE(p_period_end, public.creditos.periodo_fim),
    ultima_renovacao_em = CASE WHEN p_paid THEN now() ELSE public.creditos.ultima_renovacao_em END,
    suspenso_em = CASE WHEN v_active THEN NULL ELSE COALESCE(public.creditos.suspenso_em, now()) END,
    updated_at = now();

  RETURN jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'active', v_active,
    'plan', v_plan_profile,
    'credits', CASE WHEN v_active THEN v_credit_limit ELSE 0 END,
    'organization_id', v_org_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_solicitar_pesquisa_empresa(p_organization_id uuid, p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
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
  VALUES (auth.uid(), p_organization_id, 'basico_30', 100, 0, 0)
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

ALTER TABLE public.creditos ALTER COLUMN creditos_totais SET DEFAULT 100;

-- Aplica o novo limite imediatamente para assinantes ativos (não suspensos),
-- em vez de esperar o próximo evento de billing da Stripe.
UPDATE public.creditos SET creditos_totais = 200, updated_at = now()
WHERE plano = 'basico_70' AND suspenso_em IS NULL;

UPDATE public.creditos SET creditos_totais = 100, updated_at = now()
WHERE plano = 'basico_30' AND suspenso_em IS NULL;
