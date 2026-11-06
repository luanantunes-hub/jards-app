-- Vagas da captação quando a assinatura acaba.
--
-- O usuário extra da captação (preço "Usuário extra — mensal — R$ 19,90") é um
-- item da mesma assinatura do plano: quando a assinatura termina no Stripe, a
-- vaga termina junto e deixa de ser cobrada. O banco não acompanhava:
-- organization_seats.purchased_seats ficava como estava e
-- modulo_vagas_limite('captacao') seguia contando 1 + as compradas, então a
-- organização voltava ao Gratuito (1 usuário) com as vagas extras de graça.
-- Conferido em 20/10/2026 (banco e Stripe, só leitura): a única assinatura que
-- já tinha tido vagas foi cancelada em 09/09/2026, e o banco ainda guardava as
-- 10 vagas dela.
--
-- O que muda (definições vigentes lidas em pg_proc em 06/11/2026):
--   fn_process_stripe_billing_event  quando a assinatura termina de vez
--     (canceled ou incomplete_expired), zera as vagas que o pagador comprou e
--     apaga o id do item. Só se a assinatura que terminou é a do pagador, ou se
--     ele já não tem nenhuma: o fim atrasado de uma assinatura velha não apaga
--     as vagas de uma nova. O resto da função é o de 20260910000002.
--   modulo_vagas_limite  a captação conta as vagas compradas só com a
--     assinatura em vigor (fn_org_assinatura_ativa), como a prestação e a
--     produção já fazem com o contrato. Cobre o que não termina a assinatura
--     (unpaid, paused, atraso além dos 15 dias de carência): a vaga fica
--     suspensa e volta sozinha quando o pagamento volta, porque o item continua
--     na assinatura. Os ramos da prestação e da produção não mudam.
--   Vagas sem assinatura que as cobre (o pagador não tem mais assinatura no
--     Stripe) voltam a zero: em 06/11/2026 era só a conta da equipe com as 10
--     vagas da assinatura cancelada em 09/09; ninguém perde acesso, porque só
--     uma pessoa usa a captação lá.
--
-- Quem já ocupa as vagas não perde o acesso (decisão do Luan, 06/11/2026): a
-- organização acima do limite só deixa de convidar (fn_conferir_modulos já
-- recusa com sem_vaga_captacao) e o administrador vê um aviso na equipe.
--
-- Sem DROP: create or replace com as mesmas assinaturas; revoke/grant repetem
-- as permissões vigentes. Reaplicável.

-- ─── Fim da assinatura zera as vagas ────────────────────────────────────────

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
  v_assinatura_anterior text;
  v_vagas_encerradas integer := 0;
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
  -- A assinatura de antes do evento diz se as vagas são da que terminou.
  SELECT past_due_since, stripe_subscription_id
    INTO v_past_due_since, v_assinatura_anterior
  FROM public.profiles WHERE id = v_user_id;
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

  -- O usuário extra é item da assinatura do pagador e termina com ela no
  -- Stripe: as vagas que ele comprou voltam a zero. Assinatura velha que
  -- termina depois de uma nova começar não mexe nas vagas da nova.
  IF p_subscription_status IN ('canceled', 'incomplete_expired')
     AND (v_assinatura_anterior IS NULL OR v_assinatura_anterior = p_subscription_id) THEN
    UPDATE public.organization_seats
    SET purchased_seats = 0,
        stripe_subscription_item_id = NULL,
        updated_at = now()
    WHERE billing_user_id = v_user_id
      AND (purchased_seats <> 0 OR stripe_subscription_item_id IS NOT NULL);
    GET DIAGNOSTICS v_vagas_encerradas = ROW_COUNT;
  END IF;

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
    'organization_id', v_org_id,
    'vagas_encerradas', v_vagas_encerradas
  );
END;
$function$;

revoke execute on function public.fn_process_stripe_billing_event(text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.fn_process_stripe_billing_event(text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean) to service_role;

-- ─── Vagas por módulo ───────────────────────────────────────────────────────
-- Igual a 20261015062658, menos o ramo da captação, que passa a exigir a
-- assinatura em vigor para contar as compradas.

create or replace function public.modulo_vagas_limite(p_org uuid, p_modulo text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_modulo
    when 'captacao' then 1 + case when public.fn_org_assinatura_ativa(p_org) then coalesce(
      (select seats.purchased_seats from public.organization_seats seats where seats.organization_id = p_org), 0) else 0 end
    when 'prestacao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'prestacao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    when 'producao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'producao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    else 0
  end;
$$;

revoke execute on function public.modulo_vagas_limite(uuid, text) from public, anon, authenticated;
grant execute on function public.modulo_vagas_limite(uuid, text) to service_role;

-- ─── Vagas que nenhuma assinatura cobre ─────────────────────────────────────
-- O item de vaga mora na assinatura do pagador: sem assinatura, nada é cobrado.

update public.organization_seats seats
set purchased_seats = 0,
    stripe_subscription_item_id = null,
    updated_at = now()
from public.profiles pagador
where pagador.id = seats.billing_user_id
  and pagador.stripe_subscription_id is null
  and (seats.purchased_seats <> 0 or seats.stripe_subscription_item_id is not null);
