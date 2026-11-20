-- Ticketeria: o INGRESSO EMITIDO (passo C2 da T5). Quando um pedido vira pago, cada ingresso comprado vira uma linha com o seu código, que o comprador
-- mostra na porta. Até aqui o banco só tinha o pedido e os itens (quantidade por lote); não havia o ingresso de cada pessoa.
--
-- O que entra:
--   - `ticketeria_ingressos_emitidos`: um por ingresso comprado (código de 10 letras e números sem O, 0, I, 1, L; único). Guarda o nome do ingresso e
--     o preço no momento da compra, e `usado_em` (a conferência na porta vem depois) e `cancelado_em` (reembolso). Lê quem EDITA a Ticketeria da
--     organização; ninguém logado escreve;
--   - `fn_ticketeria_emitir_ingressos(pedido)`: emite os ingressos de um pedido pago, uma vez só (idempotente: se já há, não faz nada);
--   - um gatilho no pedido: ao virar pago (inclusive o gratuito, que já nasce pago), emite sozinho. Nenhum caminho de pagamento precisa lembrar;
--   - `ticketeria_pedidos.ingressos_enviados_em` e as funções `fn_ticketeria_reivindicar_envio` / `fn_ticketeria_liberar_envio`: o e-mail com os
--     ingressos sai uma vez só (quem pega a vaga manda; se o envio falha, devolve a vaga e a próxima tentativa manda);
--   - `fn_ticketeria_ingressos_do_pedido(pedido)`: o que o e-mail e a página do comprador mostram (evento, dia e hora no fuso do local, local, os códigos).
-- Todas só do servidor. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_ingressos_emitidos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pedido_id uuid not null references public.ticketeria_pedidos (id) on delete cascade,
  item_id uuid not null references public.ticketeria_pedido_itens (id) on delete cascade,
  ingresso_id uuid not null references public.ticketeria_ingressos (id) on delete restrict,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete restrict,
  codigo text not null,
  nome text not null,
  preco_centavos integer not null,
  usado_em timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_ingressos_emitidos_codigo_key unique (codigo),
  constraint ticketeria_ingressos_emitidos_codigo_check check (codigo ~ '^[A-HJ-NP-Z2-9]{10}$'),
  constraint ticketeria_ingressos_emitidos_preco_check check (preco_centavos >= 0)
);

create index if not exists ticketeria_ingressos_emitidos_pedido_idx on public.ticketeria_ingressos_emitidos (pedido_id);
create index if not exists ticketeria_ingressos_emitidos_sessao_idx on public.ticketeria_ingressos_emitidos (sessao_id);
create index if not exists ticketeria_ingressos_emitidos_org_idx on public.ticketeria_ingressos_emitidos (organization_id);

alter table public.ticketeria_pedidos add column if not exists ingressos_enviados_em timestamptz;

alter table public.ticketeria_ingressos_emitidos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_ingressos_emitidos' and policyname = 'ticketeria_ingressos_emitidos: le') then
    create policy "ticketeria_ingressos_emitidos: le" on public.ticketeria_ingressos_emitidos for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_ingressos_emitidos from public, anon, authenticated;
grant select on public.ticketeria_ingressos_emitidos to authenticated;

-- ─── Emitir ─────────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_emitir_ingressos(p_pedido uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido public.ticketeria_pedidos%rowtype;
  v_item record;
  v_codigo text;
  v_n integer := 0;
  v_i integer;
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select * into v_pedido from public.ticketeria_pedidos where id = p_pedido for update;
  if not found then
    raise exception 'pedido_inexistente' using errcode = 'check_violation';
  end if;
  if v_pedido.situacao <> 'pago' then
    raise exception 'pedido_nao_pago' using errcode = 'check_violation';
  end if;
  -- Uma vez só: se já há ingresso emitido deste pedido, não faz nada.
  if exists (select 1 from public.ticketeria_ingressos_emitidos where pedido_id = p_pedido) then
    return 0;
  end if;
  for v_item in
    select it.id, it.ingresso_id, it.quantidade, it.preco_centavos, i.nome
    from public.ticketeria_pedido_itens it join public.ticketeria_ingressos i on i.id = it.ingresso_id
    where it.pedido_id = p_pedido
    order by it.created_at, it.id
  loop
    for v_i in 1..v_item.quantidade loop
      loop
        v_codigo := (select string_agg(substr(v_alfabeto, 1 + floor(random() * 32)::integer, 1), '') from generate_series(1, 10));
        exit when not exists (select 1 from public.ticketeria_ingressos_emitidos e where e.codigo = v_codigo);
      end loop;
      insert into public.ticketeria_ingressos_emitidos (organization_id, pedido_id, item_id, ingresso_id, sessao_id, codigo, nome, preco_centavos)
      values (v_pedido.organization_id, p_pedido, v_item.id, v_item.ingresso_id, v_pedido.sessao_id, v_codigo, v_item.nome, v_item.preco_centavos);
      v_n := v_n + 1;
    end loop;
  end loop;
  return v_n;
end;
$$;

create or replace function public.fn_ticketeria_emitir_ao_pagar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_ticketeria_emitir_ingressos(new.id);
  return new;
end;
$$;

create or replace trigger ticketeria_pedidos_emitir_ao_pagar
  after insert or update of situacao on public.ticketeria_pedidos
  for each row when (new.situacao = 'pago')
  execute function public.fn_ticketeria_emitir_ao_pagar();

-- ─── O envio por e-mail, uma vez só ─────────────────────────────────────────

create or replace function public.fn_ticketeria_reivindicar_envio(p_pedido uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.ticketeria_pedidos set ingressos_enviados_em = now()
  where id = p_pedido and situacao = 'pago' and ingressos_enviados_em is null
  returning id into v_id;
  return v_id is not null;
end;
$$;

create or replace function public.fn_ticketeria_liberar_envio(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.ticketeria_pedidos set ingressos_enviados_em = null where id = p_pedido;
end;
$$;

-- ─── O que o e-mail e a página do comprador mostram ─────────────────────────
-- Sem o e-mail do comprador (a página é aberta por quem tem o link do pedido). Nulo se o pedido não existe ou não está pago.

create or replace function public.fn_ticketeria_ingressos_do_pedido(p_pedido uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ped public.ticketeria_pedidos%rowtype;
  v_ev record;
begin
  select * into v_ped from public.ticketeria_pedidos where id = p_pedido and situacao = 'pago';
  if not found then
    return null;
  end if;
  select e.titulo as evento, s.inicio, l.nome as local_nome, l.cidade, l.uf, l.fuso, s.cancelada_em
    into v_ev
    from public.ticketeria_sessoes s
    join public.ticketeria_eventos e on e.id = s.evento_id
    join public.ticketeria_locais l on l.id = s.local_id
    where s.id = v_ped.sessao_id;
  return jsonb_build_object(
    'pedido_id', v_ped.id, 'codigo', v_ped.codigo, 'comprador_nome', v_ped.comprador_nome,
    'evento', v_ev.evento, 'inicio', v_ev.inicio, 'fuso', v_ev.fuso, 'local', v_ev.local_nome, 'cidade', v_ev.cidade, 'uf', v_ev.uf, 'sessao_cancelada', v_ev.cancelada_em is not null,
    'ingressos', coalesce((select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome, 'preco_centavos', x.preco_centavos, 'usado', x.usado_em is not null, 'cancelado', x.cancelado_em is not null) order by x.created_at, x.id)
                           from public.ticketeria_ingressos_emitidos x where x.pedido_id = v_ped.id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.fn_ticketeria_emitir_ingressos(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_emitir_ao_pagar() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reivindicar_envio(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_liberar_envio(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_ingressos_do_pedido(uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_emitir_ingressos(uuid) to service_role;
grant execute on function public.fn_ticketeria_reivindicar_envio(uuid) to service_role;
grant execute on function public.fn_ticketeria_liberar_envio(uuid) to service_role;
grant execute on function public.fn_ticketeria_ingressos_do_pedido(uuid) to service_role;
