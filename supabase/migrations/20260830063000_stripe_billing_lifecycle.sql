-- Ciclo de billing Stripe: estado da assinatura, renovacao idempotente de
-- creditos e suspensao imediata em caso de inadimplencia/cancelamento.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_last_event_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_stripe_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stripe_subscription_status_check CHECK (
    stripe_subscription_status IN (
      'inactive', 'trialing', 'active', 'past_due', 'unpaid',
      'paused', 'canceled', 'incomplete', 'incomplete_expired'
    )
  );

-- Preserva assinaturas existentes quando a migration entrar em um banco vivo.
UPDATE public.profiles
SET stripe_subscription_status = CASE
  WHEN plano::text <> 'gratuito'
    AND (periodo_fim IS NULL OR periodo_fim > now()) THEN 'active'
  ELSE 'inactive'
END
WHERE stripe_subscription_status = 'inactive';

ALTER TABLE public.creditos
  ADD COLUMN IF NOT EXISTS periodo_inicio timestamptz,
  ADD COLUMN IF NOT EXISTS periodo_fim timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_renovacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS suspenso_em timestamptz;

CREATE TABLE IF NOT EXISTS public.stripe_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  stripe_invoice_id text,
  renewal_key text UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_billing_events_customer
  ON public.stripe_billing_events(stripe_customer_id, processed_at DESC);

ALTER TABLE public.stripe_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_billing_events FROM anon, authenticated;

-- O saldo e controlado exclusivamente pelo servidor/RPC. Um admin da
-- organizacao nao pode se conceder creditos via PostgREST.
DROP POLICY IF EXISTS "creditos: update admin" ON public.creditos;

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
  v_credit_limit := CASE WHEN p_plan = 'profissional' THEN 70 WHEN p_plan = 'basico' THEN 30 ELSE 0 END;

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

REVOKE ALL ON FUNCTION public.fn_process_stripe_billing_event(
  text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_process_stripe_billing_event(
  text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_org_assinatura_ativa(p_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.creditos c
    JOIN public.profiles p ON p.id = c.account_id
    WHERE c.organization_id = p_organization_id
      AND p.plano::text <> 'gratuito'
      AND p.stripe_subscription_status IN ('active', 'trialing')
      AND (p.periodo_fim IS NULL OR p.periodo_fim > now())
      AND c.creditos_totais > 0
  );
$function$;

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
  IF NOT public.fn_org_assinatura_ativa(p_organization_id) THEN
    RETURN 0;
  END IF;

  SELECT creditos_totais, creditos_usados INTO v_totais, v_usados
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
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  IF NOT public.fn_org_assinatura_ativa(p_organization_id) THEN
    RAISE EXCEPTION 'Assinatura inativa. Regularize o pagamento para continuar.';
  END IF;

  SELECT acesso_contatos INTO v_acesso_contatos
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
  SET creditos_usados = creditos_usados + 1, updated_at = now()
  WHERE organization_id = p_organization_id;

  INSERT INTO public.historico_creditos (organization_id, user_id, empresa_id, tipo)
  VALUES (p_organization_id, auth.uid(), p_empresa_id, 'visualizacao_contato');

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_org_assinatura_ativa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_assinatura_ativa(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_creditos_disponiveis(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_consumir_credito(uuid, uuid) TO authenticated;
