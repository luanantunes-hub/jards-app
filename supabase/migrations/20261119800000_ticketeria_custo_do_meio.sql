-- T5 (parte 2) da Ticketeria: o custo do meio de pagamento, pago pelo COMPRADOR (decisão do dono, 19/11/2026), a taxa fixa do Jards e o
-- parcelamento escolhido pelo produtor. Plano: docs/acoes-futuras/estudos/plano-modulo-ticketeria.md.
--
-- Decisões que esta migration obedece:
--   - a taxa do Jards é um VALOR FIXO por ingresso pago (provisório: R$ 1,35), por loja, paga pelo comprador; cortesia e gratuito, zero.
--     A tabela `ticketeria_taxas` da T4 já aceita isso: aqui só entra a regra padrão (percentual zero, fixo 135, paga o comprador);
--   - o custo do meio de pagamento (Asaas: Pix R$ 1,99; cartão à vista 2,99% + R$ 0,49; de 2 a 6 parcelas 3,49% + R$ 0,49) é pago pelo
--     comprador, na hora de pagar, por cima do preço e da taxa do Jards, de modo que o produtor receba o preço cheio. No cartão o custo é
--     percentual SOBRE O TOTAL PAGO, então o total sai "por dentro": total_pago = (líquido + fixo) / (1 - percentual), arredondado para cima;
--   - os custos moram numa tabela (`ticketeria_custos_meio`), não no código: mudam com contrato e promoção. Os valores gravados aqui são
--     PROVISÓRIOS, os que o dono passou, e o super admin os troca sem migration (uma linha nova, com `vigente_desde`);
--   - o parcelamento é OPCIONAL e o produtor escolhe: `ticketeria_lojas.parcelas_max` (1 = só à vista; até 6, as faixas que a tabela cobre).
--
-- Como o pedido fecha: `total_centavos` continua sendo o que é do produtor mais a taxa do Jards (a T4 inteira segue valendo);
-- `custo_meio_centavos` é o que o comprador paga a mais pelo meio escolhido; o comprador paga `total_centavos + custo_meio_centavos`.
-- O razão grava o que chega ao Jards líquido do custo (produtor + taxa); o custo do meio não é dinheiro do Jards nem do produtor.
-- A devolução do custo em cancelamento (o Jards cobre, decisão do dono) é da T7.
--
-- Funções (só o servidor, pela chave de serviço): fn_ticketeria_custo_do_meio (a conta), fn_ticketeria_definir_meio (o comprador escolhe Pix
-- ou cartão e as parcelas; grava o custo e devolve o valor a pagar) e fn_ticketeria_confirmar_pagamento (trocada, mesma assinatura: agora
-- confere o valor com o custo do meio e exige o meio escolhido).
-- Erros (check_violation): meio_indisponivel, parcelas_indisponiveis, pedido_inexistente, pedido_nao_aguarda, reserva_expirada,
-- meio_nao_escolhido, valor_divergente.
--
-- Expansão: colunas novas com padrão, uma tabela nova, funções novas, uma função trocada (create or replace) e as duas regras iniciais.
-- Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Colunas novas ──────────────────────────────────────────────────────────

alter table public.ticketeria_lojas add column if not exists parcelas_max integer not null default 1;
alter table public.ticketeria_pedidos add column if not exists meio text;
alter table public.ticketeria_pedidos add column if not exists parcelas integer;
alter table public.ticketeria_pedidos add column if not exists custo_meio_centavos bigint not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_lojas'::regclass and conname = 'ticketeria_lojas_parcelas_max_check') then
    alter table public.ticketeria_lojas add constraint ticketeria_lojas_parcelas_max_check check (parcelas_max between 1 and 6);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_pedidos'::regclass and conname = 'ticketeria_pedidos_meio_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_meio_check check (meio is null or meio in ('pix', 'cartao'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_pedidos'::regclass and conname = 'ticketeria_pedidos_parcelas_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_parcelas_check check ((meio = 'cartao') = (parcelas is not null) and (parcelas is null or parcelas between 1 and 6));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.ticketeria_pedidos'::regclass and conname = 'ticketeria_pedidos_custo_meio_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_custo_meio_check check ((meio is null and custo_meio_centavos = 0) or (meio is not null and custo_meio_centavos > 0));
  end if;
end
$$;

-- ─── A tabela dos custos ────────────────────────────────────────────────────

create table if not exists public.ticketeria_custos_meio (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'asaas',
  meio text not null,
  parcelas_de integer not null,
  parcelas_ate integer not null,
  percentual_bps integer not null default 0,
  fixo_centavos integer not null default 0,
  vigente_desde timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticketeria_custos_meio_provedor_check check (provedor ~ '^[a-z0-9_]{1,40}$'),
  constraint ticketeria_custos_meio_meio_check check (meio in ('pix', 'cartao')),
  constraint ticketeria_custos_meio_parcelas_check check (parcelas_de between 1 and 12 and parcelas_ate between parcelas_de and 12 and (meio = 'cartao' or (parcelas_de = 1 and parcelas_ate = 1))),
  constraint ticketeria_custos_meio_percentual_check check (percentual_bps between 0 and 2000),
  constraint ticketeria_custos_meio_fixo_check check (fixo_centavos between 0 and 10000)
);

create index if not exists ticketeria_custos_meio_busca_idx on public.ticketeria_custos_meio (provedor, meio, vigente_desde desc);
create index if not exists ticketeria_custos_meio_criado_por_idx on public.ticketeria_custos_meio (criado_por) where criado_por is not null;

alter table public.ticketeria_custos_meio enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_custos_meio' and policyname = 'ticketeria_custos_meio: super admin le') then
    create policy "ticketeria_custos_meio: super admin le" on public.ticketeria_custos_meio for select to authenticated using (public.is_jards_super_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_custos_meio' and policyname = 'ticketeria_custos_meio: super admin insere') then
    create policy "ticketeria_custos_meio: super admin insere" on public.ticketeria_custos_meio for insert to authenticated with check (public.is_jards_super_admin());
  end if;
end
$$;

-- ─── A conta do custo ───────────────────────────────────────────────────────

-- O custo, em centavos, de cobrar `p_liquido_centavos` (o que tem de sobrar para o produtor e o Jards) pelo meio escolhido. A regra é a
-- mais recente em vigor da faixa de parcelas. Total pago = (líquido + fixo) * 10000 / (10000 - percentual), arredondado PARA CIMA
-- (para o líquido nunca ficar abaixo do devido); o custo é o total pago menos o líquido. A mesma conta de lib/ticketeria/pagamento/custo-meio.ts.
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
  return ceil(((p_liquido_centavos + v_regra.fixo_centavos)::numeric * 10000) / (10000 - v_regra.percentual_bps))::bigint - p_liquido_centavos;
end;
$$;

-- O comprador escolhe como paga: grava o meio, as parcelas e o custo, e devolve o que ele paga. Só enquanto o pedido aguarda o pagamento
-- e a reserva está no prazo. Pix não tem parcelas; o cartão vai de 1 até o máximo que a loja oferece.
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
  update public.ticketeria_pedidos set meio = p_meio, parcelas = v_parcelas, custo_meio_centavos = v_custo where id = p_pedido;
  return jsonb_build_object('pedido_id', p_pedido, 'meio', p_meio, 'parcelas', v_parcelas, 'total_centavos', v_pedido.total_centavos,
    'custo_meio_centavos', v_custo, 'a_pagar_centavos', v_pedido.total_centavos + v_custo);
end;
$$;

-- A confirmação da T4, agora com o custo do meio: o valor pago é total + custo, e o meio tem de ter sido escolhido (pedido de valor
-- zero já nasce pago e nunca chega aqui). O razão segue igual: o que chega líquido (produtor + taxa do Jards).
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
  if p_valor_centavos is distinct from v_pedido.total_centavos + v_pedido.custo_meio_centavos then
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
  insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos)
  select v_pedido.organization_id, v_transacao, conta, valor from (values
    ('psp_a_receber', v_pedido.total_centavos),
    ('produtor', -v_pedido.produtor_centavos),
    ('plataforma', -v_pedido.taxa_centavos)
  ) as x(conta, valor)
  where valor <> 0;
  return 'pago';
end;
$$;

revoke execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) to service_role;
revoke execute on function public.fn_ticketeria_custo_do_meio(text, text, integer, bigint) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_definir_meio(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_custo_do_meio(text, text, integer, bigint) to service_role;
grant execute on function public.fn_ticketeria_definir_meio(uuid, text, integer) to service_role;

revoke all on public.ticketeria_custos_meio from anon, authenticated;
grant select, insert on public.ticketeria_custos_meio to authenticated;

-- ─── As regras iniciais (PROVISÓRIAS, as que o dono passou em 19/11/2026) ───

insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga)
select null, 0, 135, 'comprador'
where not exists (select 1 from public.ticketeria_taxas t where t.loja_id is null);

insert into public.ticketeria_custos_meio (provedor, meio, parcelas_de, parcelas_ate, percentual_bps, fixo_centavos)
select v.provedor, v.meio, v.de, v.ate, v.bps, v.fixo from (values
  ('asaas', 'pix', 1, 1, 0, 199),
  ('asaas', 'cartao', 1, 1, 299, 49),
  ('asaas', 'cartao', 2, 6, 349, 49)
) as v(provedor, meio, de, ate, bps, fixo)
where not exists (select 1 from public.ticketeria_custos_meio c);

comment on table public.ticketeria_custos_meio is 'Custo do meio de pagamento (Pix, cartão por faixa de parcelas) que o comprador paga. Valores do contrato com o provedor: só o super admin grava; a regra em vigor é a mais recente.';
comment on column public.ticketeria_lojas.parcelas_max is 'Até quantas parcelas o produtor oferece no cartão (1 = só à vista; máximo 6, as faixas de custo cadastradas).';
comment on column public.ticketeria_pedidos.custo_meio_centavos is 'O custo do meio de pagamento que o comprador paga a mais. O comprador paga total_centavos + custo_meio_centavos.';
