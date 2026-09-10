-- Carência de 15 dias para assinaturas em past_due: o pagamento falhou, mas o
-- acesso pago (plano + créditos) só é revogado se continuar em past_due por
-- mais de 15 dias corridos. A checagem é feita em tempo real por
-- fn_org_assinatura_ativa (não depende de um novo evento do Stripe chegar
-- bem no dia 15 para "lembrar" de derrubar o acesso).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

-- fn_process_stripe_billing_event: past_due passa a preservar plano/créditos
-- (só zera em status realmente terminais: unpaid, canceled, paused,
-- incomplete, incomplete_expired) e registra desde quando o past_due começou.
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
  v_past_due_since timestamptz;
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

  -- Preserva desde quando o past_due começou (não reinicia a cada evento
  -- repetido, ex.: novas tentativas de cobrança do Stripe); limpa assim que
  -- sair de past_due, seja voltando a pagar ou indo para um status terminal.
  SELECT past_due_since INTO v_past_due_since FROM public.profiles WHERE id = v_user_id;
  IF p_subscription_status = 'past_due' THEN
    v_past_due_since := COALESCE(v_past_due_since, now());
  ELSE
    v_past_due_since := NULL;
  END IF;

  -- past_due entra na mesma lista de "ativo" aqui propositalmente: o corte
  -- real dos 15 dias de carência é decidido ao vivo por fn_org_assinatura_ativa,
  -- não neste ponto (que só roda quando um evento do Stripe chega).
  v_active := p_subscription_status IN ('active', 'trialing', 'past_due');
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
      past_due_since = v_past_due_since,
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
    -- Acumula: soma o crédito do novo período ao saldo total em vez de substituí-lo.
    creditos_totais = CASE
      WHEN NOT v_active THEN 0
      WHEN p_paid THEN public.creditos.creditos_totais + v_credit_limit
      ELSE GREATEST(public.creditos.creditos_totais, v_credit_limit)
    END,
    -- Só zera o usado quando a assinatura fica inativa (recomeço limpo na reativação).
    -- Uma renovação paga não deve apagar o consumo do período anterior.
    creditos_usados = CASE WHEN NOT v_active THEN 0 ELSE public.creditos.creditos_usados END,
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
    'organization_id', v_org_id
  );
END;
$function$;

-- fn_org_assinatura_ativa: active/trialing continua exigindo periodo_fim no
-- futuro; past_due entra numa carência de 15 dias corridos a partir de
-- past_due_since, sem exigir periodo_fim (que muitas vezes já rolou para o
-- período novo, cuja fatura foi a que falhou).
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
      AND c.creditos_totais > 0
      AND (
        (p.stripe_subscription_status IN ('active', 'trialing')
          AND (p.periodo_fim IS NULL OR p.periodo_fim > now()))
        OR (p.stripe_subscription_status = 'past_due'
          AND p.past_due_since IS NOT NULL
          AND now() - p.past_due_since <= interval '15 days')
      )
  );
$function$;

-- fn_desbloquear_empresa não checava a assinatura, só o saldo de créditos —
-- confiava que o webhook já tinha zerado o saldo quando inativo. Agora que
-- past_due preserva o saldo durante a carência, o corte dos 15 dias precisa
-- ser verificado aqui também (mesma checagem que fn_consumir_credito já faz).
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

  IF NOT public.fn_org_assinatura_ativa(p_organization_id) THEN
    RAISE EXCEPTION 'Assinatura inativa. Regularize o pagamento para continuar.';
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
