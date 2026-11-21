-- As vendas da loja calculadas no banco (migration ticketeria_vendas_da_loja): fn_ticketeria_vendas_da_loja(loja) devolve o resumo somado, as vendas por sessão e a
-- fila dos últimos reembolsos. Só os pedidos pagos somam; o custo do Pix vale o real quando o Asaas o informou e a estimativa quando não; os ingressos válidos
-- são os não cancelados; outra loja não entra; e o navegador não chama a função. Ids 0d810000-0000-4000-8000-0000000000XX, ou tv.id('XX'), esquema `tv`. Desfeito no fim.
--   Loja 61 da organização a0: sessões 81 e 82 do evento 71; pedidos p1 (pago, 2 ingressos, custo real), p2 (pago, 1 ingresso, só a estimativa), p3 (aguardando, 3), p4 (cancelado).
--   Loja 62 da organização b0: um pedido pago que não pode aparecer na conta da 61.
-- Rodar: supabase/tests/README.md, com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_ingressos_emitidos, ticketeria_reembolsos e
-- ticketeria_vendas_da_loja na frente se não estiverem aplicadas (pela CLI, `supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

create schema tv;
grant usage on schema tv to authenticated, anon;

create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d810000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A'), (tv.id('62'), tv.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tv.id('51'), tv.id('a0'), tv.id('61'), 'Teatro A'), (tv.id('52'), tv.id('b0'), tv.id('62'), 'Teatro B');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tv.id('41'), tv.id('a0'), tv.id('51'), 'Plateia', 100), (tv.id('42'), tv.id('b0'), tv.id('52'), 'Plateia B', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (tv.id('71'), tv.id('a0'), tv.id('61'), 'Hamlet', 'publicado'), (tv.id('72'), tv.id('b0'), tv.id('62'), 'Outro', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (tv.id('81'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('82'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '11 days'),
    (tv.id('83'), tv.id('b0'), tv.id('72'), tv.id('52'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tv.id('31'), tv.id('a0'), tv.id('71'), tv.id('41'), 'Inteira', 'inteira'), (tv.id('32'), tv.id('b0'), tv.id('72'), tv.id('42'), 'Inteira B', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, preco_centavos, quantidade) values
    (tv.id('21'), tv.id('a0'), tv.id('31'), '1º lote', 5000, 50), (tv.id('22'), tv.id('b0'), tv.id('32'), '1º lote', 5000, 50);
  -- Os pedidos: total, taxa, parte do produtor, custo estimado do Pix e (quando o Asaas informou) o custo real.
  insert into public.ticketeria_pedidos (id, organization_id, loja_id, sessao_id, codigo, comprador_nome, comprador_email, situacao, total_centavos, taxa_centavos, produtor_centavos, quem_paga_taxa, reservado_ate, pago_em, meio, custo_meio_centavos, custo_meio_real_centavos) values
    (tv.id('b1'), tv.id('a0'), tv.id('61'), tv.id('81'), 'AAAAAAAA', 'Rita', 'r@teste.invalid', 'pago', 10000, 250, 9750, 'produtor', now() + interval '1 day', now(), 'pix', 199, 150),
    (tv.id('b2'), tv.id('a0'), tv.id('61'), tv.id('82'), 'AAAAAAAB', 'Caio', 'c@teste.invalid', 'pago', 5000, 125, 4875, 'produtor', now() + interval '1 day', now(), 'pix', 199, null),
    (tv.id('b3'), tv.id('a0'), tv.id('61'), tv.id('81'), 'AAAAAAAC', 'Ana', 'a@teste.invalid', 'aguardando_pagamento', 15000, 375, 14625, 'produtor', now() + interval '1 day', null, null, 0, null),
    (tv.id('b4'), tv.id('a0'), tv.id('61'), tv.id('81'), 'AAAAAAAD', 'Bia', 'b@teste.invalid', 'cancelado', 5000, 125, 4875, 'produtor', now() + interval '1 day', null, null, 0, null),
    (tv.id('c1'), tv.id('b0'), tv.id('62'), tv.id('83'), 'BBBBBBBA', 'Zé', 'z@teste.invalid', 'pago', 99900, 2500, 97400, 'produtor', now() + interval '1 day', now(), 'pix', 199, null);
  insert into public.ticketeria_pedido_itens (organization_id, pedido_id, ingresso_id, lote_id, quantidade, preco_centavos, taxa_centavos) values
    (tv.id('a0'), tv.id('b1'), tv.id('31'), tv.id('21'), 2, 5000, 125), (tv.id('a0'), tv.id('b2'), tv.id('31'), tv.id('21'), 1, 5000, 125),
    (tv.id('a0'), tv.id('b3'), tv.id('31'), tv.id('21'), 3, 5000, 125), (tv.id('b0'), tv.id('c1'), tv.id('32'), tv.id('22'), 4, 5000, 125);
end
$dados$;

-- Os ingressos emitidos (um cancelado) e um reembolso: pelo catálogo, as colunas que a função lê.
do $emitidos$
begin
  insert into public.ticketeria_ingressos_emitidos (organization_id, pedido_id, item_id, ingresso_id, sessao_id, codigo, nome, preco_centavos)
  select it.organization_id, it.pedido_id, it.id, it.ingresso_id, p.sessao_id, x.codigo, 'Inteira', 5000
  from (values (tv.id('b1'), 'TTTTTTTTT2'), (tv.id('b1'), 'TTTTTTTTT3'), (tv.id('b2'), 'TTTTTTTTT4')) as x(pedido, codigo)
  join public.ticketeria_pedido_itens it on it.pedido_id = x.pedido
  join public.ticketeria_pedidos p on p.id = x.pedido;
  update public.ticketeria_ingressos_emitidos set cancelado_em = now() where codigo = 'TTTTTTTTT2';
  insert into public.ticketeria_reembolsos (organization_id, email_id, remetente, assunto, recebido_em, pedido_id, situacao)
  values (tv.id('a0'), 'tv-email-1', 'r@teste.invalid', 'Quero o dinheiro de volta', now(), tv.id('b1'), 'recebido');
end
$emitidos$;

create function tv.v() returns jsonb language sql as $$ select public.fn_ticketeria_vendas_da_loja(tv.id('61')) $$;

select is((tv.v() ->> 'compras_pagas')::int, 2, 'só os pedidos pagos contam como compras (o aguardando e o cancelado, não)');
select is((tv.v() ->> 'vendido_centavos')::int, 15000, 'vendido: a soma dos pagos (R$ 100 + R$ 50)');
select is((tv.v() ->> 'repasse_centavos')::int, (9750 - 150) + (4875 - 199), 'repasse: a parte do produtor menos o custo do Pix, o real onde o Asaas informou e a estimativa onde não');
select is((tv.v() ->> 'ingressos')::int, 2, 'ingressos válidos: os 3 emitidos menos o cancelado');
select is((select string_agg(x ->> 'sessao_id' || ':' || (x ->> 'vendidos') || ':' || (x ->> 'receita'), ',' order by x ->> 'sessao_id') from jsonb_array_elements(tv.v() -> 'por_sessao') x),
          tv.id('81') || ':2:10000,' || tv.id('82') || ':1:5000', 'por sessão: o que os pagos venderam (a soma dos itens) e a receita; o pedido aguardando não entra');
select is((select string_agg((x ->> 'codigo') || '/' || (x ->> 'situacao'), ',') from jsonb_array_elements(tv.v() -> 'reembolsos') x), 'AAAAAAAA/recebido', 'a fila de reembolsos traz o código do pedido');
select is((public.fn_ticketeria_vendas_da_loja(tv.id('62')) ->> 'vendido_centavos')::int, 99900, 'cada loja soma só os seus pedidos');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_vendas_da_loja(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_vendas_da_loja(uuid)', 'execute'),
          'o navegador não chama a função: só o servidor, depois de conferir quem edita a Ticketeria');

select * from finish();
rollback;
