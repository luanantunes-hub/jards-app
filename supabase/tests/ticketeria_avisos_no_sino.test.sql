-- Ticketeria: os avisos do sino (fn_ticketeria_avisar, fn_ticketeria_moeda, gatilhos de pedido pago e de reembolso que termina): quem recebe (editores
-- com a ticketeria; não o leitor nem quem não tem o módulo nem outra organização), um aviso por pessoa e por fato, a categoria 'ticketeria' e o link.
-- Ids 0d770000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81, ingresso 31 (R$ 60).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_reembolsos e a ticketeria_avisos_no_sino, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

create schema tv;
create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d770000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tv.id(s), 'tv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  -- a1 admin e a2 colaborador (recebem); a3 leitor e a4 admin sem o módulo (não recebem); b1 é da outra organização.
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tv.id(o), tv.id(p), papel, acesso from (values
    ('a0', 'a1', 'admin', '{ticketeria}'::text[]), ('a0', 'a2', 'colaborador', '{ticketeria}'::text[]),
    ('a0', 'a3', 'leitor', '{ticketeria}'::text[]), ('a0', 'a4', 'admin', '{}'::text[]), ('b0', 'b1', 'admin', '{ticketeria}'::text[])
  ) as v(o, p, papel, acesso);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tv.id('51'), tv.id('a0'), tv.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tv.id('41'), tv.id('a0'), tv.id('51'), 'Plateia', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tv.id('71'), tv.id('a0'), tv.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tv.id('81'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tv.id('31'), tv.id('a0'), tv.id('71'), tv.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tv.id('21'), tv.id('a0'), tv.id('31'), '1º lote', 0, 6000, 10);
end
$dados$;

create function tv.avisos(chave text, quem text) returns int language sql as $$
  select count(*)::int from public.notificacoes where event_key = chave and user_id = tv.id(quem);
$$;

select is(public.fn_ticketeria_moeda(12000), 'R$ 120,00', 'a moeda: reais e centavos');
select is(public.fn_ticketeria_moeda(5), 'R$ 0,05', 'a moeda: centavos com zero à esquerda');

create temp table pedido as
  select (public.fn_ticketeria_reservar(tv.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tv.id('31'), 'quantidade', 2)), 'Rita Teste', 'rita@teste.invalid', 15) ->> 'pedido_id')::uuid as id;

select is((select count(*)::int from public.notificacoes where categoria = 'ticketeria'), 0, 'reservar não avisa ninguém');

update public.ticketeria_pedidos set situacao = 'pago', pago_em = now() where id = (select id from pedido);

select is(tv.avisos('ticketeria_venda_paga', 'a1'), 1, 'o admin com a ticketeria recebe o aviso da venda');
select is(tv.avisos('ticketeria_venda_paga', 'a2'), 1, 'o colaborador também');
select is(tv.avisos('ticketeria_venda_paga', 'a3') + tv.avisos('ticketeria_venda_paga', 'a4') + tv.avisos('ticketeria_venda_paga', 'b1'), 0, 'o leitor, quem não tem o módulo e a outra organização não recebem');
select is((select titulo || ' | ' || mensagem from public.notificacoes where event_key = 'ticketeria_venda_paga' and user_id = tv.id('a1')), 'Venda paga | R$ 120,00 · 2 ingressos · Hamlet', 'título e mensagem');
select is((select link from public.notificacoes where event_key = 'ticketeria_venda_paga' and user_id = tv.id('a1')), '/ingressos/vendas?compra=' || (select id from pedido), 'o link abre a compra em Vendas');
select is((select categoria from public.notificacoes where event_key = 'ticketeria_venda_paga' and user_id = tv.id('a1')), 'ticketeria', 'a categoria é ticketeria');

update public.ticketeria_pedidos set updated_at = now() where id = (select id from pedido);
update public.ticketeria_pedidos set situacao = 'pago', pago_em = now() where id = (select id from pedido);
select is(tv.avisos('ticketeria_venda_paga', 'a1'), 1, 'pago de novo não duplica o aviso');

-- Reembolso por e-mail.
insert into public.ticketeria_reembolsos (email_id, remetente, assunto, recebido_em, pedido_id, organization_id, situacao, valor_centavos)
values ('e-1', 'rita@teste.invalid', 'Reembolso', now(), (select id from pedido), tv.id('a0'), 'estornando', 12000),
       ('e-2', 'rita@teste.invalid', 'Reembolso', now(), (select id from pedido), tv.id('a0'), 'estornando', null),
       ('e-3', 'sem-org@teste.invalid', 'Reembolso', now(), null, null, 'estornando', 500);
select is((select count(*)::int from public.notificacoes where event_key like 'ticketeria_reembolso%'), 0, 'receber o pedido de reembolso não avisa; só o fim dele');

update public.ticketeria_reembolsos set situacao = 'estornado' where email_id = 'e-1';
update public.ticketeria_reembolsos set situacao = 'falhou' where email_id = 'e-2';
update public.ticketeria_reembolsos set situacao = 'falhou' where email_id = 'e-3';

select is(tv.avisos('ticketeria_reembolso_feito', 'a1') + tv.avisos('ticketeria_reembolso_feito', 'a2'), 2, 'reembolso feito: avisa quem edita');
select is((select mensagem from public.notificacoes where event_key = 'ticketeria_reembolso_feito' and user_id = tv.id('a1')), 'R$ 120,00 · rita@teste.invalid', 'a mensagem tem o valor e o remetente');
select is((select prioridade from public.notificacoes where event_key = 'ticketeria_reembolso_falhou' and user_id = tv.id('a1')), 'alta', 'reembolso que falhou é prioridade alta');
select is((select count(*)::int from public.notificacoes where event_key like 'ticketeria_reembolso%' and user_id in (tv.id('a3'), tv.id('a4'), tv.id('b1'))), 0, 'o reembolso sem organização não avisa ninguém; os de fora continuam sem aviso');

select * from finish();
rollback;
