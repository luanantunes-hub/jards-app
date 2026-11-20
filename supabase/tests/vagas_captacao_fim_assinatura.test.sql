-- Vagas da captação quando a assinatura acaba (migration vagas_captacao_fim_assinatura).
--
-- Confere que as vagas compradas da captação só contam com a assinatura em
-- vigor (atraso dentro da carência mantém, além dela suspende, o pagamento de
-- volta devolve); que o fim de vez da assinatura (canceled, incomplete_expired)
-- zera as vagas do pagador e apaga o id do item, e unpaid não; que o fim
-- atrasado de uma assinatura velha não mexe nas vagas da atual; que ninguém
-- que já ocupa a vaga sai, mas o convite novo para a captação é recusado; e
-- que o navegador segue sem executar as duas funções.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Os ids
-- são a7000000-0000-4000-8000-0000000000XX, e vc_teste.id('XX') os escreve:
--   organização A (a0): plano básico pago por a1 (sub_teste_vagas_a), 2 vagas
--     compradas e 3 pessoas na captação: a1 (admin), a2 e a3 (colaboradores);
--   organização B (b0): plano básico pago por b1 (sub_teste_vagas_b), 1 vaga
--     comprada, só o admin;
--   organização C (c0): no Gratuito (c1), com 5 vagas que sobraram de antes da
--     correção.
--
-- Rodar: supabase/tests/README.md, com a migration vagas_captacao_fim_assinatura
-- na frente se ela ainda não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

-- ─── Cenário ────────────────────────────────────────────────────────────────

create schema vc_teste;
create function vc_teste.id(sufixo text) returns uuid language sql immutable as $$
  select ('a7000000-0000-4000-8000-0000000000' || sufixo)::uuid;
$$;

/** Um evento do Stripe da assinatura de um pagador, como o webhook o entrega. */
create function vc_teste.evento(p_evento text, p_tipo text, p_pagador text, p_assinatura text, p_status text, p_pago boolean default false)
returns jsonb language sql as $$
  select public.fn_process_stripe_billing_event(
    'evt_teste_vagas_' || p_evento, p_tipo, vc_teste.id(p_pagador), 'cus_teste_vagas_' || p_pagador, p_assinatura,
    case when p_pago then 'in_teste_vagas_' || p_evento end, 'price_teste_vagas', 'basico', p_status,
    now(), now() + interval '20 days', p_pago);
$$;

create function vc_teste.vagas(p_org text) returns table (compradas integer, item text) language sql as $$
  select purchased_seats, stripe_subscription_item_id from public.organization_seats where organization_id = vc_teste.id(p_org);
$$;

do $cenario$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select vc_teste.id(sufixo), 'vc-' || sufixo || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'b1', 'c1']) as sufixo;
  -- O cadastro também cria uma organização pessoal para cada pessoa nova. Ela
  -- fica e não muda nenhum caso: as verificações olham só A, B e C.

  insert into public.organizations (id, nome) values
    (vc_teste.id('a0'), 'VC organização A'), (vc_teste.id('b0'), 'VC organização B'), (vc_teste.id('c0'), 'VC organização C');

  update public.profiles
  set plano = 'basico', stripe_subscription_status = 'active', periodo_fim = now() + interval '20 days',
      stripe_customer_id = 'cus_teste_vagas_' || right(id::text, 2),
      stripe_subscription_id = 'sub_teste_vagas_' || left(right(id::text, 2), 1)
  where id in (vc_teste.id('a1'), vc_teste.id('b1'));

  insert into public.creditos (account_id, organization_id, plano, creditos_totais) values
    (vc_teste.id('a1'), vc_teste.id('a0'), 'basico_30', 100),
    (vc_teste.id('b1'), vc_teste.id('b0'), 'basico_30', 100),
    (vc_teste.id('c1'), vc_teste.id('c0'), 'basico_30', 0);

  insert into public.organization_seats (organization_id, billing_user_id, purchased_seats, stripe_subscription_item_id) values
    (vc_teste.id('a0'), vc_teste.id('a1'), 2, 'si_teste_vagas_a'),
    (vc_teste.id('b0'), vc_teste.id('b1'), 1, 'si_teste_vagas_b'),
    (vc_teste.id('c0'), vc_teste.id('c1'), 5, null);

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values
    (vc_teste.id('a0'), vc_teste.id('a1'), 'admin', '{captacao}'),
    (vc_teste.id('a0'), vc_teste.id('a2'), 'colaborador', '{captacao}'),
    (vc_teste.id('a0'), vc_teste.id('a3'), 'colaborador', '{captacao}'),
    (vc_teste.id('b0'), vc_teste.id('b1'), 'admin', '{captacao}'),
    (vc_teste.id('c0'), vc_teste.id('c1'), 'admin', '{captacao}');
end
$cenario$;

-- ─── Vagas só com a assinatura em vigor ─────────────────────────────────────

select is(array[public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'),
                public.modulo_vagas_limite(vc_teste.id('b0'), 'captacao'),
                public.modulo_vagas_limite(vc_teste.id('c0'), 'captacao')],
          array[3, 2, 1], 'com o plano pago as compradas contam; no Gratuito, as que sobraram não');

select is(vc_teste.evento('a1', 'invoice.payment_failed', 'a1', 'sub_teste_vagas_a', 'past_due') ->> 'processed', 'true',
          'A: o pagamento falha');
select is(public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'), 3, 'A: dentro dos 15 dias de carência as vagas seguem');

update public.profiles set past_due_since = now() - interval '16 days' where id = vc_teste.id('a1');
select is(public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'), 1, 'A: passada a carência as vagas ficam suspensas');
select results_eq($$ select * from vc_teste.vagas('a0') $$, $$ values (2, 'si_teste_vagas_a') $$,
                  'A: suspensa não é apagada (o item continua na assinatura)');

select is(vc_teste.evento('a2', 'invoice.paid', 'a1', 'sub_teste_vagas_a', 'active', true) ->> 'active', 'true',
          'A: o pagamento volta');
select is(public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'), 3, 'A: com o pagamento de volta as vagas voltam');

-- ─── Assinatura velha que termina depois ────────────────────────────────────

select is((vc_teste.evento('a3', 'customer.subscription.deleted', 'a1', 'sub_velha_vagas_a', 'canceled') ->> 'vagas_encerradas')::int, 0,
          'A: o fim de uma assinatura que não é a do pagador não encerra vagas');
select results_eq($$ select * from vc_teste.vagas('a0') $$, $$ values (2, 'si_teste_vagas_a') $$,
                  'A: as vagas da assinatura atual ficam');

-- O evento velho rebaixa o plano, como já fazia antes desta migration; volta a
-- assinatura atual para conferir o fim dela.
update public.profiles
set plano = 'basico', stripe_subscription_status = 'active', stripe_subscription_id = 'sub_teste_vagas_a', periodo_fim = now() + interval '20 days'
where id = vc_teste.id('a1');
update public.creditos set creditos_totais = 100, suspenso_em = null where organization_id = vc_teste.id('a0');
select is(public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'), 3, 'A: de volta ao plano pago com 2 vagas');

-- ─── Fim da assinatura ──────────────────────────────────────────────────────

select is((vc_teste.evento('a4', 'customer.subscription.deleted', 'a1', 'sub_teste_vagas_a', 'canceled') ->> 'vagas_encerradas')::int, 1,
          'A: a assinatura termina e as vagas do pagador são encerradas');
select results_eq($$ select * from vc_teste.vagas('a0') $$, $$ values (0, null::text) $$,
                  'A: vagas compradas zeradas e sem o id do item');
select is(public.modulo_vagas_limite(vc_teste.id('a0'), 'captacao'), 1, 'A: no Gratuito sobra a vaga incluída');
select is(vc_teste.evento('a4', 'customer.subscription.deleted', 'a1', 'sub_teste_vagas_a', 'canceled') ->> 'duplicate', 'true',
          'A: o mesmo evento de novo não é processado duas vezes');
select results_eq($$ select * from vc_teste.vagas('b0') $$, $$ values (1, 'si_teste_vagas_b') $$,
                  'B: as vagas de outro pagador não mudam');

-- ─── Quem já está dentro fica ───────────────────────────────────────────────

select is(public.modulo_vagas_em_uso(vc_teste.id('a0'), 'captacao'), 3, 'A: as 3 pessoas seguem na captação');
select is((select count(*)::int from public.organization_members
           where organization_id = vc_teste.id('a0') and 'captacao' = any(modulos_acesso)), 3,
          'A: ninguém perde a captação');
select throws_ok($$ select public.fn_conferir_modulos(vc_teste.id('a0'), 'colaborador', '{captacao}', null, '{}') $$,
                 '23514', 'sem_vaga_captacao', 'A: acima do limite, o convite novo para a captação é recusado');
select lives_ok($$ select public.fn_conferir_modulos(vc_teste.id('a0'), 'captador', '{captacao}', null, '{}') $$,
                'A: captador externo, que não ocupa vaga, segue entrando');

-- ─── Unpaid suspende, incomplete_expired encerra ────────────────────────────

select is(vc_teste.evento('b1', 'customer.subscription.updated', 'b1', 'sub_teste_vagas_b', 'unpaid') ->> 'active', 'false',
          'B: a assinatura fica sem pagamento (unpaid)');
select ok((select compradas = 1 and item = 'si_teste_vagas_b' from vc_teste.vagas('b0'))
          and public.modulo_vagas_limite(vc_teste.id('b0'), 'captacao') = 1,
          'B: unpaid suspende a vaga sem apagá-la (a assinatura e o item continuam no Stripe)');
select is((vc_teste.evento('b2', 'customer.subscription.updated', 'b1', 'sub_teste_vagas_b', 'incomplete_expired') ->> 'vagas_encerradas')::int, 1,
          'B: incomplete_expired encerra as vagas');
select results_eq($$ select * from vc_teste.vagas('b0') $$, $$ values (0, null::text) $$,
                  'B: vagas compradas zeradas e sem o id do item');

-- ─── Quem executa ───────────────────────────────────────────────────────────

select ok(not has_function_privilege('authenticated', 'public.fn_process_stripe_billing_event(text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean)', 'execute')
          and not has_function_privilege('anon', 'public.fn_process_stripe_billing_event(text, text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.modulo_vagas_limite(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'public.modulo_vagas_limite(uuid, text)', 'execute'),
          'o navegador não executa a função da cobrança nem a das vagas');

select * from finish();
rollback;
