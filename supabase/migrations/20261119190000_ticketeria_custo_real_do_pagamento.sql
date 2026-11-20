-- Ticketeria: o razão passa a gravar o CUSTO REAL que o Asaas descontou de cada pagamento, e não só a estimativa da tabela (decisão do
-- dono em 19/11/2026, depois de ver, no teste do sandbox e na página Taxas da conta, que as taxas reais são promocionais até 19/02/2027:
-- Pix R$ 0,99 em vez de R$ 1,99; cartão à vista 1,99% + R$ 0,49 em vez de 2,99% + R$ 0,49; e que mudam por plano e por conta).
--
-- O aviso de pagamento do Asaas traz o valor líquido (`netValue`). O custo real = valor pago − valor líquido. A tabela
-- `ticketeria_custos_meio` e `custo_meio_centavos` (a estimativa escolhida na hora de pagar) seguem existindo: servem à tela do produtor,
-- que mostra uma estimativa de quanto ele recebe antes de vender. O que vale no razão é o custo real, quando o provedor o informa;
-- sem ele (o provedor de mentira, por exemplo), vale a estimativa.
--
-- O que muda:
--   - coluna nova `ticketeria_pedidos.custo_meio_real_centavos` (nula até o pagamento; zero é permitido: cobrança grátis da promoção);
--   - função nova `fn_ticketeria_confirmar_pagamento_real(pedido, provedor, ref, valor, liquido)` (só o servidor): é a confirmação da T5,
--     mais o líquido. Confere 0 ≤ custo real ≤ parte do produtor (`liquido_invalido`, que o código trata como estorno, como o valor divergente);
--     grava o custo real no pedido e o razão com ele: psp_a_receber = total − custo real; produtor = −(parte do produtor − custo real);
--     plataforma = −taxa. Soma zero;
--   - a função de 4 argumentos continua, com a mesma assinatura e as mesmas permissões, e agora só chama a nova sem líquido (usa a
--     estimativa). Duas funções com nomes diferentes, e não uma com argumento a mais, para não criar duas versões da mesma função (o
--     PostgREST recusa) nem precisar de DROP.
-- Sem dinheiro real: nada vai à produção antes do parecer jurídico e das respostas do Asaas.
--
-- Expansão: uma coluna nova (nula) com regra, uma função nova e uma função trocada (create or replace). Sem DROP; reaplicável.

set local lock_timeout = '10s';

alter table public.ticketeria_pedidos add column if not exists custo_meio_real_centavos bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_pedidos'::regclass and conname = 'ticketeria_pedidos_custo_meio_real_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_custo_meio_real_check check (custo_meio_real_centavos is null or custo_meio_real_centavos >= 0);
  end if;
end
$$;

create or replace function public.fn_ticketeria_confirmar_pagamento_real(p_pedido uuid, p_provedor text, p_ref text, p_valor_centavos bigint, p_liquido_centavos bigint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido record;
  v_item record;
  v_lote record;
  v_transacao uuid;
  v_custo bigint;
begin
  select * into v_pedido from public.ticketeria_pedidos p where p.id = p_pedido for update;
  if v_pedido.id is null then
    raise exception 'pedido_inexistente' using errcode = 'check_violation';
  end if;
  if v_pedido.situacao = 'pago' then
    return 'ja_pago';
  end if;
  if v_pedido.situacao = 'cancelado' then
    raise exception 'pedido_cancelado' using errcode = 'check_violation';
  end if;
  if v_pedido.meio is null then
    raise exception 'meio_nao_escolhido' using errcode = 'check_violation';
  end if;
  if p_valor_centavos is distinct from v_pedido.total_centavos then
    raise exception 'valor_divergente' using errcode = 'check_violation';
  end if;
  -- O custo que vale no razão: o real (valor pago − líquido), quando o provedor o informa; senão, a estimativa da hora de pagar.
  if p_liquido_centavos is null then
    v_custo := v_pedido.custo_meio_centavos;
  else
    v_custo := p_valor_centavos - p_liquido_centavos;
    if v_custo < 0 or v_custo > v_pedido.produtor_centavos then
      raise exception 'liquido_invalido' using errcode = 'check_violation';
    end if;
  end if;
  -- Pago depois do prazo da reserva: só vale se os lugares ainda couberem (os lotes travados durante a conta).
  if v_pedido.reservado_ate <= now() then
    for v_item in select i.lote_id, sum(i.quantidade) as quantidade from public.ticketeria_pedido_itens i where i.pedido_id = p_pedido group by i.lote_id loop
      select l.id, l.quantidade into v_lote from public.ticketeria_lotes l where l.id = v_item.lote_id for update;
      if public.fn_ticketeria_ocupados(v_pedido.sessao_id, v_item.lote_id, p_pedido) + v_item.quantidade > v_lote.quantidade then
        raise exception 'reserva_expirada_sem_lugar' using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  update public.ticketeria_pedidos
  set situacao = 'pago', pago_em = now(), provedor = p_provedor, provedor_ref = p_ref,
      custo_meio_real_centavos = case when p_liquido_centavos is null then null else v_custo end
  where id = p_pedido;

  insert into public.ticketeria_transacoes (organization_id, loja_id, pedido_id, tipo, descricao)
  values (v_pedido.organization_id, v_pedido.loja_id, p_pedido, 'pagamento', 'Pedido ' || v_pedido.codigo)
  returning id into v_transacao;
  insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos)
  select v_pedido.organization_id, v_transacao, conta, valor from (values
    ('psp_a_receber', v_pedido.total_centavos - v_custo),
    ('produtor', -(v_pedido.produtor_centavos - v_custo)),
    ('plataforma', -v_pedido.taxa_centavos)
  ) as x(conta, valor)
  where valor <> 0;
  return 'pago';
end;
$$;

-- A confirmação de 4 argumentos (a que a rota do aviso e os testes já chamam) vira a nova, sem líquido: vale a estimativa.
create or replace function public.fn_ticketeria_confirmar_pagamento(p_pedido uuid, p_provedor text, p_ref text, p_valor_centavos bigint)
returns text
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.fn_ticketeria_confirmar_pagamento_real(p_pedido, p_provedor, p_ref, p_valor_centavos, null);
$$;

revoke execute on function public.fn_ticketeria_confirmar_pagamento_real(uuid, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_confirmar_pagamento_real(uuid, text, text, bigint, bigint) to service_role;
revoke execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) to service_role;
