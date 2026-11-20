-- Ticketeria: os cupons de desconto.
--
-- ticketeria_cupons: um código de desconto de um evento (todos os ingressos ou só um), em porcentagem do preço (1 a 100) ou em valor por
-- ingresso (em centavos), com limite de usos e validade opcionais. O código é guardado em maiúsculas, sem espaços; vale uma vez por
-- evento. Quem edita a Ticketeria da organização lê e grava (como o catálogo); o comprador nunca lê a tabela: confere o código pelo servidor.
-- ticketeria_pedidos ganha `cupom_id`, `cupom_codigo` e `desconto_centavos` (o total tirado do pedido); ticketeria_pedido_itens ganha
-- `desconto_centavos` (por ingresso). `preco_centavos` do item passa a ser o que o comprador paga por ingresso (já com desconto): os totais, a
-- taxa, o razão e os relatórios seguem certos sem mudar. Preço de tabela = preco_centavos + desconto_centavos.
--
-- Regras (D14 do plano): a taxa do Jards é calculada sobre o preço COM desconto; cupom de 100% deixa o pedido em zero e ele nasce pago
-- (ingresso gratuito, sem cobrança); desconto em valor é por ingresso e nunca passa do preço; ingresso de preço zero não recebe desconto.
--
-- Funções (só o servidor as chama, pela chave de serviço):
--   fn_ticketeria_cupom_conferir(sessão, código) → o cupom em vigor para a sessão, ou o erro: cupom_invalido, cupom_vencido, cupom_esgotado;
--   fn_ticketeria_aplicar_cupom(pedido, código) → refaz os itens e os totais do pedido com o desconto (cupom_nao_vale se nada ficou mais barato);
--   fn_ticketeria_reservar_com_cupom(sessão, itens, nome, e-mail, minutos, código) → reserva e aplica na mesma transação: se o cupom
--     falha, a reserva também não fica. fn_ticketeria_reservar (cinco argumentos) não muda.
-- Os usos contam pedidos pagos e reservas ainda no prazo. O cupom é travado durante a conta, para o limite valer com compras ao mesmo tempo.
--
-- Expansão: tabela nova e vazia, colunas com valor padrão, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

-- ─── Tabela ─────────────────────────────────────────────────────────────────

create table if not exists public.ticketeria_cupons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evento_id uuid not null references public.ticketeria_eventos (id) on delete cascade,
  ingresso_id uuid references public.ticketeria_ingressos (id) on delete cascade,
  codigo text not null,
  tipo text not null,
  valor integer not null,
  limite_usos integer,
  valido_ate timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_cupons_codigo_check check (codigo ~ '^[A-Z0-9]{3,20}$'),
  constraint ticketeria_cupons_tipo_check check (tipo in ('percentual', 'valor')),
  constraint ticketeria_cupons_valor_check check ((tipo = 'percentual' and valor between 1 and 100) or (tipo = 'valor' and valor between 1 and 10000000)),
  constraint ticketeria_cupons_limite_check check (limite_usos is null or limite_usos between 1 and 1000000)
);

create unique index if not exists ticketeria_cupons_evento_codigo_key on public.ticketeria_cupons (evento_id, codigo);
create index if not exists ticketeria_cupons_org_idx on public.ticketeria_cupons (organization_id);
create index if not exists ticketeria_cupons_ingresso_idx on public.ticketeria_cupons (ingresso_id) where ingresso_id is not null;

alter table public.ticketeria_pedidos add column if not exists cupom_id uuid references public.ticketeria_cupons (id) on delete set null;
alter table public.ticketeria_pedidos add column if not exists cupom_codigo text;
alter table public.ticketeria_pedidos add column if not exists desconto_centavos bigint not null default 0;
alter table public.ticketeria_pedido_itens add column if not exists desconto_centavos integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedidos_desconto_check') then
    alter table public.ticketeria_pedidos add constraint ticketeria_pedidos_desconto_check check (desconto_centavos >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedido_itens_desconto_check') then
    alter table public.ticketeria_pedido_itens add constraint ticketeria_pedido_itens_desconto_check check (desconto_centavos >= 0);
  end if;
end
$$;

create index if not exists ticketeria_pedidos_cupom_idx on public.ticketeria_pedidos (cupom_id) where cupom_id is not null;

-- ─── Coerência ──────────────────────────────────────────────────────────────

-- O código vai em maiúsculas e sem espaços; o evento é da organização do cupom e o ingresso (se houver) é do mesmo evento.
create or replace function public.fn_ticketeria_cupom_coerencia()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  new.codigo := upper(btrim(new.codigo));
  select e.organization_id into v_org from public.ticketeria_eventos e where e.id = new.evento_id;
  if v_org is distinct from new.organization_id then
    raise exception 'cupom_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if new.ingresso_id is not null and not exists (select 1 from public.ticketeria_ingressos i where i.id = new.ingresso_id and i.evento_id = new.evento_id) then
    raise exception 'cupom_ingresso_de_outro_evento' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_cupons_coerencia
  before insert or update on public.ticketeria_cupons
  for each row execute function public.fn_ticketeria_cupom_coerencia();

create or replace trigger ticketeria_cupons_updated_at
  before update on public.ticketeria_cupons
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Conferir ───────────────────────────────────────────────────────────────

-- Quantas vezes o cupom já foi usado: pedidos pagos e reservas ainda no prazo, fora o pedido p_fora.
create or replace function public.fn_ticketeria_cupom_usos(p_cupom uuid, p_fora uuid default null)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.ticketeria_pedidos p
  where p.cupom_id = p_cupom and p.id is distinct from p_fora
    and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()));
$$;

-- O cupom do código no evento da sessão, conferido (ativo, no prazo, com usos sobrando). Trava o cupom quando p_travar.
create or replace function public.fn_ticketeria_cupom_conferir(p_sessao uuid, p_codigo text, p_fora uuid default null, p_travar boolean default false)
returns public.ticketeria_cupons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cupom public.ticketeria_cupons;
  v_evento uuid;
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
begin
  select s.evento_id into v_evento from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_evento is null or v_codigo = '' then
    raise exception 'cupom_invalido' using errcode = 'check_violation';
  end if;
  if p_travar then
    select * into v_cupom from public.ticketeria_cupons c where c.evento_id = v_evento and c.codigo = v_codigo for update;
  else
    select * into v_cupom from public.ticketeria_cupons c where c.evento_id = v_evento and c.codigo = v_codigo;
  end if;
  if v_cupom.id is null or not v_cupom.ativo then
    raise exception 'cupom_invalido' using errcode = 'check_violation';
  end if;
  if v_cupom.valido_ate is not null and v_cupom.valido_ate <= now() then
    raise exception 'cupom_vencido' using errcode = 'check_violation';
  end if;
  if v_cupom.limite_usos is not null and public.fn_ticketeria_cupom_usos(v_cupom.id, p_fora) >= v_cupom.limite_usos then
    raise exception 'cupom_esgotado' using errcode = 'check_violation';
  end if;
  return v_cupom;
end;
$$;

-- ─── Aplicar ────────────────────────────────────────────────────────────────

-- O desconto de UM ingresso: porcentagem do preço (arredondada ao centavo) ou o valor fixo, nunca mais que o preço. A mesma conta de
-- lib/ticketeria/cupom.ts (os testes conferem os mesmos casos).
create or replace function public.fn_ticketeria_desconto_do_ingresso(p_preco integer, p_tipo text, p_valor integer)
returns integer
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_preco <= 0 then 0
    when p_tipo = 'percentual' then least(p_preco, round(p_preco::numeric * p_valor / 100)::integer)
    else least(p_preco, p_valor)
  end;
$$;

create or replace function public.fn_ticketeria_aplicar_cupom(p_pedido uuid, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido record;
  v_cupom public.ticketeria_cupons;
  v_taxa record;
  v_item record;
  v_desc integer;
  v_novo integer;
  v_taxa_unit integer;
  v_total bigint := 0;
  v_taxa_total bigint := 0;
  v_produtor bigint := 0;
  v_desconto bigint := 0;
begin
  select * into v_pedido from public.ticketeria_pedidos p where p.id = p_pedido for update;
  if v_pedido.id is null then
    raise exception 'pedido_inexistente' using errcode = 'check_violation';
  end if;
  if v_pedido.cupom_id is not null or v_pedido.situacao <> 'aguardando_pagamento' then
    raise exception 'cupom_nao_vale' using errcode = 'check_violation';
  end if;
  v_cupom := public.fn_ticketeria_cupom_conferir(v_pedido.sessao_id, p_codigo, p_pedido, true);
  select * into v_taxa from public.fn_ticketeria_taxa_vigente(v_pedido.loja_id);

  for v_item in select i.id, i.ingresso_id, i.quantidade, i.preco_centavos from public.ticketeria_pedido_itens i where i.pedido_id = p_pedido loop
    v_desc := case when v_cupom.ingresso_id is null or v_cupom.ingresso_id = v_item.ingresso_id
      then public.fn_ticketeria_desconto_do_ingresso(v_item.preco_centavos, v_cupom.tipo, v_cupom.valor) else 0 end;
    v_novo := v_item.preco_centavos - v_desc;
    v_taxa_unit := public.fn_ticketeria_taxa_do_ingresso(v_novo, v_taxa.percentual_bps, v_taxa.fixo_centavos, v_pedido.quem_paga_taxa);
    update public.ticketeria_pedido_itens set preco_centavos = v_novo, taxa_centavos = v_taxa_unit, desconto_centavos = v_desc where id = v_item.id;
    if v_pedido.quem_paga_taxa = 'comprador' then
      v_total := v_total + (v_novo + v_taxa_unit)::bigint * v_item.quantidade;
      v_produtor := v_produtor + v_novo::bigint * v_item.quantidade;
    else
      v_total := v_total + v_novo::bigint * v_item.quantidade;
      v_produtor := v_produtor + (v_novo - v_taxa_unit)::bigint * v_item.quantidade;
    end if;
    v_taxa_total := v_taxa_total + v_taxa_unit::bigint * v_item.quantidade;
    v_desconto := v_desconto + v_desc::bigint * v_item.quantidade;
  end loop;
  if v_desconto = 0 then
    raise exception 'cupom_nao_vale' using errcode = 'check_violation';
  end if;

  update public.ticketeria_pedidos
  set total_centavos = v_total, taxa_centavos = v_taxa_total, produtor_centavos = v_produtor, desconto_centavos = v_desconto,
      cupom_id = v_cupom.id, cupom_codigo = v_cupom.codigo,
      situacao = case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
      pago_em = case when v_total = 0 then now() end
  where id = p_pedido;

  return jsonb_build_object('pedido_id', p_pedido, 'codigo', v_pedido.codigo, 'total_centavos', v_total, 'taxa_centavos', v_taxa_total,
    'produtor_centavos', v_produtor, 'situacao', case when v_total = 0 then 'pago' else 'aguardando_pagamento' end,
    'reservado_ate', v_pedido.reservado_ate, 'desconto_centavos', v_desconto);
end;
$$;

create or replace function public.fn_ticketeria_reservar_com_cupom(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reserva jsonb;
begin
  v_reserva := public.fn_ticketeria_reservar(p_sessao, p_itens, p_nome, p_email, p_minutos);
  if p_codigo is null or btrim(p_codigo) = '' then
    return v_reserva || jsonb_build_object('desconto_centavos', 0);
  end if;
  return public.fn_ticketeria_aplicar_cupom((v_reserva ->> 'pedido_id')::uuid, p_codigo);
end;
$$;

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_cupons enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_cupons' and policyname = 'ticketeria_cupons: le') then
    create policy "ticketeria_cupons: le" on public.ticketeria_cupons for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_cupons' and policyname = 'ticketeria_cupons: insere') then
    create policy "ticketeria_cupons: insere" on public.ticketeria_cupons for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_cupons' and policyname = 'ticketeria_cupons: edita') then
    create policy "ticketeria_cupons: edita" on public.ticketeria_cupons for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar')) with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_cupom_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_cupom_usos(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_cupom_conferir(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_desconto_do_ingresso(integer, text, integer) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_aplicar_cupom(uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reservar_com_cupom(uuid, jsonb, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_cupom_usos(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_cupom_conferir(uuid, text, uuid, boolean) to service_role;
grant execute on function public.fn_ticketeria_desconto_do_ingresso(integer, text, integer) to service_role;
grant execute on function public.fn_ticketeria_aplicar_cupom(uuid, text) to service_role;
grant execute on function public.fn_ticketeria_reservar_com_cupom(uuid, jsonb, text, text, integer, text) to service_role;

revoke all on public.ticketeria_cupons from anon, authenticated;
grant select, insert, update on public.ticketeria_cupons to authenticated;
