-- T4 da Ticketeria: o núcleo de pagamento (D4 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md), ainda SEM dinheiro
-- real: nenhum provedor de verdade está ligado, e a taxa da plataforma é zero enquanto o dono não decidir o valor (seção 7).
--
-- ticketeria_taxas: a regra da taxa do Jards por ingresso (porcentagem em pontos-base + valor fixo) e quem a paga (o comprador, por
-- cima do preço, ou o produtor, descontada do preço). Por loja, ou a padrão da plataforma (loja nula); vale a mais recente já em vigor.
-- Só o super admin grava. Sem regra nenhuma, a taxa é zero. Ingresso de preço zero não paga taxa.
-- ticketeria_pedidos e ticketeria_pedido_itens: o pedido do comprador numa sessão (nome e e-mail, os dados mínimos de D6), com a
-- reserva dos lugares até `reservado_ate`, os itens por lote com o preço e a taxa de cada ingresso, e os totais: o que o comprador
-- paga (`total_centavos`) = o que é do produtor (`produtor_centavos`) + a taxa do Jards (`taxa_centavos`).
-- ticketeria_transacoes e ticketeria_partidas: o livro-razão de partidas dobradas (o desenho do pgledger, MIT): cada transação tem
-- duas ou mais partidas com sinal que somam zero, e nada se altera nem se apaga depois de gravado (D3: o Jards não guarda saldo; o
-- razão registra o que o provedor recebeu e de quem é). Contas: psp_a_receber (o que o provedor recebeu do comprador, positivo),
-- produtor (o que é do produtor, negativo: o Jards deve repassar pelo split) e plataforma (a taxa do Jards, negativo).
-- ticketeria_notificacoes_provedor: os avisos que o provedor manda (webhooks), um por id externo: o mesmo aviso duas vezes não faz
-- nada duas vezes. Só o servidor grava.
--
-- Funções (só o servidor as chama, pela chave de serviço; o navegador não executa nenhuma):
--   fn_ticketeria_taxa_vigente(loja) → a regra em vigor;
--   fn_ticketeria_reservar(sessão, itens, nome, e-mail, minutos) → cria o pedido: evento publicado, sessão por vir e não cancelada,
--     ingresso público do local da sessão, limite por pedido, e os lugares tirados do lote da vez (os lotes seguem em sequência; o
--     seguinte abre quando o anterior esgota nesta sessão ou a janela dele fecha; um lote cuja janela ainda não abriu segura os
--     seguintes), com o lote travado durante a conta. Pedido de valor zero (gratuito) já nasce pago, sem razão;
--   fn_ticketeria_confirmar_pagamento(pedido, provedor, referência, valor) → marca pago e grava o razão, uma vez só ('pago' ou
--     'ja_pago'); confere o valor; a reserva vencida só vira paga se os lugares ainda couberem.
-- Erros (check_violation, com o nome): sessao_indisponivel, evento_nao_publicado, itens_invalidos, ingresso_indisponivel,
-- ingresso_de_outro_local, limite_por_pedido, esgotado, comprador_invalido, pedido_inexistente, pedido_cancelado, valor_divergente,
-- reserva_expirada_sem_lugar, razao_desequilibrado, razao_imutavel.
--
-- Acesso: o pedido tem dado pessoal e o razão é dinheiro: lê quem EDITA a ticketeria da organização (não o leitor). Ninguém logado
-- escreve; as taxas, só o super admin.
-- Expansão: tabelas novas e vazias, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Tabelas ────────────────────────────────────────────────────────────────

create table if not exists public.ticketeria_taxas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references public.ticketeria_lojas (id) on delete cascade,
  percentual_bps integer not null default 0,
  fixo_centavos integer not null default 0,
  quem_paga text not null default 'comprador',
  vigente_desde timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ticketeria_taxas_percentual_check check (percentual_bps between 0 and 3000),
  constraint ticketeria_taxas_fixo_check check (fixo_centavos between 0 and 10000),
  constraint ticketeria_taxas_quem_paga_check check (quem_paga in ('comprador', 'produtor'))
);

create index if not exists ticketeria_taxas_loja_idx on public.ticketeria_taxas (loja_id, vigente_desde desc);
create index if not exists ticketeria_taxas_criado_por_idx on public.ticketeria_taxas (criado_por) where criado_por is not null;

create table if not exists public.ticketeria_pedidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  codigo text not null,
  comprador_nome text not null,
  comprador_email text not null,
  situacao text not null default 'aguardando_pagamento',
  total_centavos bigint not null,
  taxa_centavos bigint not null,
  produtor_centavos bigint not null,
  quem_paga_taxa text not null,
  reservado_ate timestamptz not null,
  provedor text,
  provedor_ref text,
  pago_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_pedidos_codigo_key unique (codigo),
  constraint ticketeria_pedidos_codigo_check check (codigo ~ '^[A-HJ-NP-Z2-9]{8}$'),
  constraint ticketeria_pedidos_nome_check check (char_length(btrim(comprador_nome)) between 1 and 120),
  constraint ticketeria_pedidos_email_check check (char_length(comprador_email) <= 254 and comprador_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint ticketeria_pedidos_situacao_check check (situacao in ('aguardando_pagamento', 'pago', 'cancelado')),
  constraint ticketeria_pedidos_valores_check check (total_centavos >= 0 and taxa_centavos >= 0 and produtor_centavos >= 0 and total_centavos = taxa_centavos + produtor_centavos),
  constraint ticketeria_pedidos_quem_paga_check check (quem_paga_taxa in ('comprador', 'produtor')),
  constraint ticketeria_pedidos_pago_check check ((situacao = 'pago') = (pago_em is not null)),
  constraint ticketeria_pedidos_provedor_check check (provedor is null or provedor ~ '^[a-z0-9_]{1,40}$'),
  constraint ticketeria_pedidos_ref_check check (provedor_ref is null or char_length(provedor_ref) between 1 and 200)
);

create index if not exists ticketeria_pedidos_org_idx on public.ticketeria_pedidos (organization_id, created_at desc);
create index if not exists ticketeria_pedidos_loja_idx on public.ticketeria_pedidos (loja_id);
create index if not exists ticketeria_pedidos_sessao_idx on public.ticketeria_pedidos (sessao_id, situacao);

create table if not exists public.ticketeria_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pedido_id uuid not null references public.ticketeria_pedidos (id) on delete cascade,
  ingresso_id uuid not null references public.ticketeria_ingressos (id) on delete no action,
  lote_id uuid not null references public.ticketeria_lotes (id) on delete no action,
  quantidade integer not null,
  preco_centavos integer not null,
  taxa_centavos integer not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_pedido_itens_quantidade_check check (quantidade between 1 and 50),
  constraint ticketeria_pedido_itens_valores_check check (preco_centavos >= 0 and taxa_centavos >= 0)
);

create index if not exists ticketeria_pedido_itens_org_idx on public.ticketeria_pedido_itens (organization_id);
create index if not exists ticketeria_pedido_itens_pedido_idx on public.ticketeria_pedido_itens (pedido_id);
create index if not exists ticketeria_pedido_itens_lote_idx on public.ticketeria_pedido_itens (lote_id);
create index if not exists ticketeria_pedido_itens_ingresso_idx on public.ticketeria_pedido_itens (ingresso_id);

create table if not exists public.ticketeria_transacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  pedido_id uuid references public.ticketeria_pedidos (id) on delete cascade,
  tipo text not null,
  descricao text,
  created_at timestamptz not null default now(),
  constraint ticketeria_transacoes_tipo_check check (tipo in ('pagamento', 'estorno', 'repasse', 'ajuste')),
  constraint ticketeria_transacoes_descricao_check check (descricao is null or char_length(descricao) <= 300)
);

-- Um pagamento por pedido: confirmar duas vezes não grava duas vezes.
create unique index if not exists ticketeria_transacoes_pagamento_key on public.ticketeria_transacoes (pedido_id) where tipo = 'pagamento';
create index if not exists ticketeria_transacoes_org_idx on public.ticketeria_transacoes (organization_id, created_at desc);
create index if not exists ticketeria_transacoes_loja_idx on public.ticketeria_transacoes (loja_id);

create table if not exists public.ticketeria_partidas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transacao_id uuid not null references public.ticketeria_transacoes (id) on delete cascade,
  conta text not null,
  valor_centavos bigint not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_partidas_conta_check check (conta in ('psp_a_receber', 'produtor', 'plataforma')),
  constraint ticketeria_partidas_valor_check check (valor_centavos <> 0)
);

create index if not exists ticketeria_partidas_org_idx on public.ticketeria_partidas (organization_id);
create index if not exists ticketeria_partidas_transacao_idx on public.ticketeria_partidas (transacao_id);

create table if not exists public.ticketeria_notificacoes_provedor (
  id uuid primary key default gen_random_uuid(),
  provedor text not null,
  id_externo text not null,
  tipo text not null,
  pedido_id uuid references public.ticketeria_pedidos (id) on delete set null,
  payload jsonb not null,
  resultado text,
  recebida_em timestamptz not null default now(),
  processada_em timestamptz,
  constraint ticketeria_notificacoes_provedor_key unique (provedor, id_externo),
  constraint ticketeria_notificacoes_provedor_check check (provedor ~ '^[a-z0-9_]{1,40}$'),
  constraint ticketeria_notificacoes_id_check check (char_length(id_externo) between 1 and 200),
  constraint ticketeria_notificacoes_tipo_check check (char_length(tipo) between 1 and 80),
  constraint ticketeria_notificacoes_resultado_check check (resultado is null or char_length(resultado) <= 200)
);

create index if not exists ticketeria_notificacoes_pedido_idx on public.ticketeria_notificacoes_provedor (pedido_id) where pedido_id is not null;

-- ─── O razão: equilibrado e imutável ────────────────────────────────────────

-- Cada transação, no fim da gravação: duas ou mais partidas que somam zero.
create or replace function public.fn_ticketeria_razao_equilibrio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transacao uuid := coalesce(new.transacao_id, old.transacao_id);
  v_soma bigint;
  v_partidas integer;
begin
  if not exists (select 1 from public.ticketeria_transacoes t where t.id = v_transacao) then
    return null; -- a transação saiu junto (apagamento da organização)
  end if;
  select coalesce(sum(p.valor_centavos), 0), count(*) into v_soma, v_partidas from public.ticketeria_partidas p where p.transacao_id = v_transacao;
  if v_soma <> 0 or v_partidas < 2 then
    raise exception 'razao_desequilibrado' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

-- O razão não muda nem se apaga; só sai junto com a organização inteira.
create or replace function public.fn_ticketeria_razao_imutavel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old;
  end if;
  raise exception 'razao_imutavel' using errcode = 'check_violation';
end;
$$;

create or replace constraint trigger ticketeria_partidas_equilibrio
  after insert or update or delete on public.ticketeria_partidas
  deferrable initially deferred
  for each row execute function public.fn_ticketeria_razao_equilibrio();
create or replace trigger ticketeria_partidas_imutavel
  before update or delete on public.ticketeria_partidas
  for each row execute function public.fn_ticketeria_razao_imutavel();
create or replace trigger ticketeria_transacoes_imutavel
  before update or delete on public.ticketeria_transacoes
  for each row execute function public.fn_ticketeria_razao_imutavel();
create or replace trigger ticketeria_pedidos_updated_at
  before update on public.ticketeria_pedidos
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── A taxa ─────────────────────────────────────────────────────────────────

-- A regra em vigor para a loja: a mais recente da loja já em vigor; senão, a padrão da plataforma; senão, zero.
create or replace function public.fn_ticketeria_taxa_vigente(p_loja uuid)
returns table (percentual_bps integer, fixo_centavos integer, quem_paga text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.percentual_bps, r.fixo_centavos, r.quem_paga from (
    select t.percentual_bps, t.fixo_centavos, t.quem_paga, 0 as prioridade, t.vigente_desde
    from public.ticketeria_taxas t where t.loja_id = p_loja and t.vigente_desde <= now()
    union all
    select t.percentual_bps, t.fixo_centavos, t.quem_paga, 1, t.vigente_desde
    from public.ticketeria_taxas t where t.loja_id is null and t.vigente_desde <= now()
    union all
    select 0, 0, 'comprador', 2, '-infinity'::timestamptz
  ) r
  order by r.prioridade, r.vigente_desde desc
  limit 1;
$$;

-- A taxa de UM ingresso: porcentagem do preço (arredondada ao centavo) mais o fixo; zero no ingresso de preço zero; quando o produtor
-- paga, nunca passa do preço. A mesma conta de lib/ticketeria/pagamento/taxa.ts (os testes conferem os mesmos casos).
create or replace function public.fn_ticketeria_taxa_do_ingresso(p_preco integer, p_percentual_bps integer, p_fixo integer, p_quem_paga text)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_preco <= 0 then 0
    when p_quem_paga = 'produtor' then least(p_preco, (round(p_preco::numeric * p_percentual_bps / 10000) + p_fixo)::integer)
    else (round(p_preco::numeric * p_percentual_bps / 10000) + p_fixo)::integer
  end;
$$;

-- ─── Estoque ────────────────────────────────────────────────────────────────

-- Quantos lugares de um lote numa sessão já estão vendidos ou reservados (reserva ainda no prazo), fora o pedido p_fora.
create or replace function public.fn_ticketeria_ocupados(p_sessao uuid, p_lote uuid, p_fora uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(i.quantidade), 0)
  from public.ticketeria_pedido_itens i
  join public.ticketeria_pedidos p on p.id = i.pedido_id
  where i.lote_id = p_lote and p.sessao_id = p_sessao and p.id is distinct from p_fora
    and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()));
$$;

-- ─── Reservar ───────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_reservar(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_evento record;
  v_taxa record;
  v_pedido uuid := gen_random_uuid();
  v_codigo text;
  v_item jsonb;
  v_ingresso record;
  v_lote record;
  v_pedidos jsonb := '[]'::jsonb;
  v_restante integer;
  v_livres bigint;
  v_tirar integer;
  v_taxa_unit integer;
  v_total bigint := 0;
  v_taxa_total bigint := 0;
  v_produtor bigint := 0;
  v_vistos uuid[] := '{}';
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  -- A sessão e o evento.
  select s.id, s.organization_id, s.evento_id, s.local_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    raise exception 'sessao_indisponivel' using errcode = 'check_violation';
  end if;
  select e.id, e.loja_id, e.situacao into v_evento from public.ticketeria_eventos e where e.id = v_sessao.evento_id;
  if v_evento.situacao <> 'publicado' then
    raise exception 'evento_nao_publicado' using errcode = 'check_violation';
  end if;
  -- O comprador e o prazo da reserva.
  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 120 or p_email is null or char_length(p_email) > 254
     or btrim(lower(p_email)) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'comprador_invalido' using errcode = 'check_violation';
  end if;
  if p_minutos is null or p_minutos not between 1 and 60 then
    raise exception 'itens_invalidos' using errcode = 'check_violation';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 10 then
    raise exception 'itens_invalidos' using errcode = 'check_violation';
  end if;

  select * into v_taxa from public.fn_ticketeria_taxa_vigente(v_evento.loja_id);

  -- Um código curto, sem letras que se confundem (I, O, 0, 1).
  loop
    v_codigo := (select string_agg(substr(v_alfabeto, 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 8));
    exit when not exists (select 1 from public.ticketeria_pedidos p where p.codigo = v_codigo);
  end loop;

  insert into public.ticketeria_pedidos (id, organization_id, loja_id, sessao_id, codigo, comprador_nome, comprador_email, situacao,
    total_centavos, taxa_centavos, produtor_centavos, quem_paga_taxa, reservado_ate)
  values (v_pedido, v_sessao.organization_id, v_evento.loja_id, v_sessao.id, v_codigo, btrim(p_nome), btrim(lower(p_email)), 'aguardando_pagamento',
    0, 0, 0, v_taxa.quem_paga, now() + make_interval(mins => p_minutos));

  for v_item in select * from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_item) <> 'object' or (v_item ->> 'ingresso_id') is null or (v_item ->> 'quantidade') !~ '^[0-9]{1,3}$' then
      raise exception 'itens_invalidos' using errcode = 'check_violation';
    end if;
    select i.id, i.evento_id, i.setor_id, i.publico, i.arquivado, i.limite_por_pedido, s.local_id
      into v_ingresso
      from public.ticketeria_ingressos i join public.ticketeria_setores s on s.id = i.setor_id
      where i.id = (v_item ->> 'ingresso_id')::uuid;
    if v_ingresso.id is null or v_ingresso.evento_id <> v_evento.id or not v_ingresso.publico or v_ingresso.arquivado then
      raise exception 'ingresso_indisponivel' using errcode = 'check_violation';
    end if;
    if v_ingresso.local_id <> v_sessao.local_id then
      raise exception 'ingresso_de_outro_local' using errcode = 'check_violation';
    end if;
    if v_ingresso.id = any(v_vistos) then
      raise exception 'itens_invalidos' using errcode = 'check_violation';
    end if;
    v_vistos := v_vistos || v_ingresso.id;
    v_restante := (v_item ->> 'quantidade')::integer;
    if v_restante < 1 or v_restante > v_ingresso.limite_por_pedido then
      raise exception 'limite_por_pedido' using errcode = 'check_violation';
    end if;

    -- Os lotes em sequência, cada um travado durante a conta.
    for v_lote in
      select l.id, l.preco_centavos, l.quantidade, l.vendas_inicio, l.vendas_fim
      from public.ticketeria_lotes l where l.ingresso_id = v_ingresso.id
      order by l.ordem, l.created_at, l.id
      for update
    loop
      exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now(); -- a janela ainda não abriu: segura os seguintes
      continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now(); -- a janela fechou: vale o seguinte
      v_livres := v_lote.quantidade - public.fn_ticketeria_ocupados(v_sessao.id, v_lote.id, v_pedido);
      continue when v_livres <= 0; -- esgotado nesta sessão: vale o seguinte
      v_tirar := least(v_livres, v_restante)::integer;
      v_taxa_unit := public.fn_ticketeria_taxa_do_ingresso(v_lote.preco_centavos, v_taxa.percentual_bps, v_taxa.fixo_centavos, v_taxa.quem_paga);
      insert into public.ticketeria_pedido_itens (organization_id, pedido_id, ingresso_id, lote_id, quantidade, preco_centavos, taxa_centavos)
      values (v_sessao.organization_id, v_pedido, v_ingresso.id, v_lote.id, v_tirar, v_lote.preco_centavos, v_taxa_unit);
      if v_taxa.quem_paga = 'comprador' then
        v_total := v_total + (v_lote.preco_centavos + v_taxa_unit)::bigint * v_tirar;
        v_produtor := v_produtor + v_lote.preco_centavos::bigint * v_tirar;
      else
        v_total := v_total + v_lote.preco_centavos::bigint * v_tirar;
        v_produtor := v_produtor + (v_lote.preco_centavos - v_taxa_unit)::bigint * v_tirar;
      end if;
      v_taxa_total := v_taxa_total + v_taxa_unit::bigint * v_tirar;
      v_restante := v_restante - v_tirar;
      exit when v_restante = 0;
    end loop;
    if v_restante > 0 then
      raise exception 'esgotado' using errcode = 'check_violation';
    end if;
  end loop;

  update public.ticketeria_pedidos
  set total_centavos = v_total, taxa_centavos = v_taxa_total, produtor_centavos = v_produtor,
      situacao = case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
      pago_em = case when v_total = 0 then now() end
  where id = v_pedido;

  return jsonb_build_object('pedido_id', v_pedido, 'codigo', v_codigo, 'total_centavos', v_total, 'taxa_centavos', v_taxa_total,
    'produtor_centavos', v_produtor, 'situacao', case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
    'reservado_ate', now() + make_interval(mins => p_minutos));
end;
$$;

-- ─── Confirmar o pagamento ──────────────────────────────────────────────────

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

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_taxas enable row level security;
alter table public.ticketeria_pedidos enable row level security;
alter table public.ticketeria_pedido_itens enable row level security;
alter table public.ticketeria_transacoes enable row level security;
alter table public.ticketeria_partidas enable row level security;
alter table public.ticketeria_notificacoes_provedor enable row level security;

do $$
declare
  v_tabela text;
begin
  -- Pedido (dado pessoal) e razão (dinheiro): lê quem edita a ticketeria da organização. Ninguém logado escreve.
  foreach v_tabela in array array['ticketeria_pedidos', 'ticketeria_pedido_itens', 'ticketeria_transacoes', 'ticketeria_partidas'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': le', v_tabela, 'editar');
    end if;
  end loop;
  -- A taxa: a loja vê a dela; o super admin vê e grava todas (inclusive a padrão).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_taxas' and policyname = 'ticketeria_taxas: le') then
    create policy "ticketeria_taxas: le" on public.ticketeria_taxas for select to authenticated
      using (public.is_jards_super_admin() or exists (select 1 from public.ticketeria_lojas l where l.id = ticketeria_taxas.loja_id and public.auth_ticketeria_pode(l.organization_id, 'editar')));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_taxas' and policyname = 'ticketeria_taxas: super admin insere') then
    create policy "ticketeria_taxas: super admin insere" on public.ticketeria_taxas for insert to authenticated with check (public.is_jards_super_admin());
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_razao_equilibrio() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_razao_imutavel() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_taxa_vigente(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_taxa_do_ingresso(integer, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_ocupados(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reservar(uuid, jsonb, text, text, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_taxa_vigente(uuid) to service_role;
grant execute on function public.fn_ticketeria_taxa_do_ingresso(integer, integer, integer, text) to service_role;
grant execute on function public.fn_ticketeria_reservar(uuid, jsonb, text, text, integer) to service_role;
grant execute on function public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint) to service_role;

revoke all on public.ticketeria_taxas, public.ticketeria_pedidos, public.ticketeria_pedido_itens, public.ticketeria_transacoes,
  public.ticketeria_partidas, public.ticketeria_notificacoes_provedor from anon, authenticated;
grant select on public.ticketeria_pedidos, public.ticketeria_pedido_itens, public.ticketeria_transacoes, public.ticketeria_partidas to authenticated;
grant select, insert on public.ticketeria_taxas to authenticated;

comment on table public.ticketeria_taxas is 'Regra da taxa do Jards por ingresso (pontos-base + fixo; quem paga). Por loja ou padrão (loja nula). Só o super admin grava. Sem regra, zero.';
comment on table public.ticketeria_pedidos is 'Pedido do comprador numa sessão (nome e e-mail), com a reserva e os totais: total = produtor + taxa. Só o servidor grava.';
comment on table public.ticketeria_pedido_itens is 'Item do pedido: quantos ingressos de um lote, com o preço e a taxa de cada um.';
comment on table public.ticketeria_transacoes is 'Transação do livro-razão (pagamento, estorno, repasse, ajuste). Imutável.';
comment on table public.ticketeria_partidas is 'Partida do razão: conta e valor com sinal. Cada transação soma zero. Imutável.';
comment on table public.ticketeria_notificacoes_provedor is 'Aviso do provedor de pagamento (webhook), um por id externo: idempotente. Só o servidor grava.';
