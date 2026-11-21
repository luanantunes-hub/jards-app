-- As vendas da loja calculadas no banco (a tela de Vendas do produtor).
--
-- Antes, a rota lia TODOS os pedidos da loja (sem limite, e o banco corta a leitura em 1.000 linhas sem avisar: uma loja com 1.018 pedidos já perdia os 18 mais
-- antigos nos totais) e, em seguida, os itens, os ingressos emitidos e os reembolsos de todos eles, em lotes um depois do outro, só para somar no servidor.
-- fn_ticketeria_vendas_da_loja devolve já somado, numa leitura só: o que o resumo e a tabela de sessões mostram e a fila dos 50 últimos reembolsos. A lista
-- de compras passa a ser paginada pela rota (30 por vez), e os ingressos de cada compra só são lidos para as compras da página.
--
-- Mesma conta de lib/ticketeria/vendas.ts (montarVendas): só os pedidos PAGOS entram no vendido, no repasse (a parte do produtor menos o custo do Pix, o real
-- quando o Asaas já o informou) e nas vendas por sessão (a soma dos itens); os ingressos válidos são os emitidos não cancelados de todos os pedidos da loja.
-- Interna: só a chave de serviço (a rota, depois de conferir quem edita a Ticketeria da organização) a chama. Só uma função nova: sem DROP, aditiva e reaplicável.

set local lock_timeout = '10s';

create or replace function public.fn_ticketeria_vendas_da_loja(p_loja uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with pagos as (
    select p.id, p.sessao_id, p.total_centavos, p.produtor_centavos - coalesce(p.custo_meio_real_centavos, p.custo_meio_centavos) as repasse
    from public.ticketeria_pedidos p
    where p.loja_id = p_loja and p.situacao = 'pago'
  ),
  por_sessao as (
    select pg.sessao_id, sum(pg.total_centavos)::bigint as receita,
           coalesce(sum((select sum(it.quantidade) from public.ticketeria_pedido_itens it where it.pedido_id = pg.id)), 0)::bigint as vendidos
    from pagos pg
    group by pg.sessao_id
  )
  select jsonb_build_object(
    'compras_pagas', (select count(*) from pagos),
    'vendido_centavos', (select coalesce(sum(total_centavos), 0) from pagos),
    'repasse_centavos', (select coalesce(sum(repasse), 0) from pagos),
    'ingressos', (select count(*) from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id where p.loja_id = p_loja and i.cancelado_em is null),
    'por_sessao', coalesce((select jsonb_agg(jsonb_build_object('sessao_id', s.sessao_id, 'vendidos', s.vendidos, 'receita', s.receita)) from por_sessao s), '[]'::jsonb),
    'reembolsos', coalesce((
      select jsonb_agg(x) from (
        select r.id, r.pedido_id, pd.codigo, r.remetente, r.recebido_em, r.situacao, r.valor_centavos, r.origem
        from public.ticketeria_reembolsos r join public.ticketeria_pedidos pd on pd.id = r.pedido_id
        where pd.loja_id = p_loja
        order by r.recebido_em desc limit 50
      ) x), '[]'::jsonb)
  );
$$;

revoke execute on function public.fn_ticketeria_vendas_da_loja(uuid) from public, anon, authenticated;
