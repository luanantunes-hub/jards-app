-- Ticketeria: o PRODUTOR paga as taxas (decisão do dono em 19/11/2026, que substitui, no mesmo dia, o valor fixo de R$ 1,35 e depois os
-- 2,5% pagos pelo comprador). O produtor define o preço; o comprador paga exatamente esse preço, sem nada somado. Do preço saem a taxa do
-- Jards (2,5%) e o custo do meio de pagamento do Asaas; o produtor recebe o que sobra.
--   Exemplo: ingresso de R$ 50 no Pix = o comprador paga R$ 50,00; o Jards fica com R$ 1,25 (2,5%); o Asaas fica com R$ 1,99; o produtor
--   recebe R$ 46,76. Cortesia e gratuito: nada cobrado.
--
-- O que muda em relação à T5 (parte 2):
--   - a regra padrão de `ticketeria_taxas` (tabela só de inserção; vale a de `vigente_desde` mais recente) passa a ser 250 pontos-base,
--     fixo zero, paga o PRODUTOR (a T4 já sabia: total = preço, produtor = preço − taxa). Continua configurável por loja;
--   - o custo do meio (`ticketeria_custos_meio`, valores provisórios do Asaas) deixa de ser somado ao total do comprador: sai da parte do
--     produtor. No cartão é percentual SOBRE O TOTAL PAGO, que agora é o preço: custo = ceil(total × percentual) + fixo (arredondado para
--     cima, para o Jards nunca ficar no prejuízo de um centavo). O argumento da função mantém o nome antigo (`p_liquido_centavos`), porque
--     o Postgres não deixa renomear parâmetro num create or replace; agora ele é o total pago pelo comprador;
--   - `fn_ticketeria_definir_meio` devolve o que o comprador paga (= o total do pedido, nada a mais), o custo e o que o produtor recebe
--     líquido; um meio cujo custo come toda a parte do produtor (ingresso baratíssimo) fica indisponível (`meio_indisponivel`);
--   - `fn_ticketeria_confirmar_pagamento` confere o valor pago contra o TOTAL do pedido; o razão grava o que chega líquido do custo:
--     psp_a_receber = total − custo; produtor = −(parte do produtor − custo); plataforma = −taxa. Soma zero.
-- Em devolução (arrependimento, D5), o Asaas pode não devolver o custo dele: QUEM ARCA com isso ainda não está decidido (pergunta
-- aberta ao dono no plano; a decisão anterior, de o Jards cobrir, foi tomada com o comprador pagando o meio). É da T7.
-- Sem dinheiro real: nada vai à produção antes do parecer jurídico e das respostas do Asaas.
--
-- Expansão: uma linha de dados e três funções trocadas (create or replace, mesmas assinaturas e mesmas permissões). Sem DROP; reaplicável.

set local lock_timeout = '10s';

insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga)
select null, 250, 0, 'produtor'
where not exists (
  select 1 from public.ticketeria_taxas t
  where t.loja_id is null and t.percentual_bps = 250 and t.fixo_centavos = 0 and t.quem_paga = 'produtor'
);

-- O custo, em centavos, de cobrar `p_liquido_centavos` (agora: o TOTAL que o comprador paga) pelo meio escolhido: a regra mais recente em
-- vigor da faixa de parcelas, percentual sobre o total (para cima) mais o fixo. A mesma conta de lib/ticketeria/pagamento/custo-meio.ts.
create or replace function public.fn_ticketeria_custo_do_meio(p_provedor text, p_meio text, p_parcelas integer, p_liquido_centavos bigint)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_regra record;
begin
  select c.percentual_bps, c.fixo_centavos into v_regra
  from public.ticketeria_custos_meio c
  where c.provedor = p_provedor and c.meio = p_meio and coalesce(p_parcelas, 1) between c.parcelas_de and c.parcelas_ate and c.vigente_desde <= now()
  order by c.vigente_desde desc, c.created_at desc
  limit 1;
  if not found then
    raise exception 'meio_indisponivel' using errcode = 'check_violation';
  end if;
  return ceil((p_liquido_centavos::numeric * v_regra.percentual_bps) / 10000)::bigint + v_regra.fixo_centavos;
end;
$$;

create or replace function public.fn_ticketeria_definir_meio(p_pedido uuid, p_meio text, p_parcelas integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido record;
  v_max integer;
  v_custo bigint;
  v_parcelas integer;
begin
  select * into v_pedido from public.ticketeria_pedidos p where p.id = p_pedido for update;
  if v_pedido.id is null then
    raise exception 'pedido_inexistente' using errcode = 'check_violation';
  end if;
  if v_pedido.situacao <> 'aguardando_pagamento' then
    raise exception 'pedido_nao_aguarda' using errcode = 'check_violation';
  end if;
  if v_pedido.reservado_ate <= now() then
    raise exception 'reserva_expirada' using errcode = 'check_violation';
  end if;
  if p_meio not in ('pix', 'cartao') or v_pedido.total_centavos <= 0 then
    raise exception 'meio_indisponivel' using errcode = 'check_violation';
  end if;
  v_parcelas := case when p_meio = 'cartao' then coalesce(p_parcelas, 1) end;
  if p_meio = 'pix' and p_parcelas is not null then
    raise exception 'parcelas_indisponiveis' using errcode = 'check_violation';
  end if;
  if p_meio = 'cartao' then
    select l.parcelas_max into v_max from public.ticketeria_lojas l where l.id = v_pedido.loja_id;
    if v_parcelas < 1 or v_parcelas > v_max then
      raise exception 'parcelas_indisponiveis' using errcode = 'check_violation';
    end if;
  end if;
  v_custo := public.fn_ticketeria_custo_do_meio('asaas', p_meio, v_parcelas, v_pedido.total_centavos);
  -- O custo sai da parte do produtor: se ele comer tudo (ingresso baratíssimo), o meio não serve para este pedido.
  if v_custo > v_pedido.produtor_centavos then
    raise exception 'meio_indisponivel' using errcode = 'check_violation';
  end if;
  update public.ticketeria_pedidos set meio = p_meio, parcelas = v_parcelas, custo_meio_centavos = v_custo where id = p_pedido;
  return jsonb_build_object('pedido_id', p_pedido, 'meio', p_meio, 'parcelas', v_parcelas, 'total_centavos', v_pedido.total_centavos,
    'custo_meio_centavos', v_custo, 'a_pagar_centavos', v_pedido.total_centavos, 'produtor_recebe_centavos', v_pedido.produtor_centavos - v_custo);
end;
$$;

create or replace function public.fn_ticketeria_confirmar_pagamento(p_pedido uuid, p_provedor text, p_ref text, p_valor_centavos bigint)
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
  -- Pago depois do prazo da reserva: só vale se os lugares ainda couberem (os lotes travados durante a conta).
  if v_pedido.reservado_ate <= now() then
    for v_item in select i.lote_id, sum(i.quantidade) as quantidade from public.ticketeria_pedido_itens i where i.pedido_id = p_pedido group by i.lote_id loop
      select l.id, l.quantidade into v_lote from public.ticketeria_lotes l where l.id = v_item.lote_id for update;
      if public.fn_ticketeria_ocupados(v_pedido.sessao_id, v_item.lote_id, p_pedido) + v_item.quantidade > v_lote.quantidade then
        raise exception 'reserva_expirada_sem_lugar' using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  update public.ticketeria_pedidos set situacao = 'pago', pago_em = now(), provedor = p_provedor, provedor_ref = p_ref where id = p_pedido;

  insert into public.ticketeria_transacoes (organization_id, loja_id, pedido_id, tipo, descricao)
  values (v_pedido.organization_id, v_pedido.loja_id, p_pedido, 'pagamento', 'Pedido ' || v_pedido.codigo)
  returning id into v_transacao;
  -- O que chega líquido do custo do meio: o provedor guarda o custo dele; o resto é do produtor (já sem o custo) e do Jards (a taxa).
  insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos)
  select v_pedido.organization_id, v_transacao, conta, valor from (values
    ('psp_a_receber', v_pedido.total_centavos - v_pedido.custo_meio_centavos),
    ('produtor', -(v_pedido.produtor_centavos - v_pedido.custo_meio_centavos)),
    ('plataforma', -v_pedido.taxa_centavos)
  ) as x(conta, valor)
  where valor <> 0;
  return 'pago';
end;
$$;
