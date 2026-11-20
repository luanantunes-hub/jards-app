-- Ticketeria: PEDIR O REEMBOLSO PELA PÁGINA DO PEDIDO (decisão do dono em 20/11/2026; complementa o reembolso por e-mail, D15, que continua como reserva).
--
-- O botão "Pedir reembolso" de /pedido/{id} NÃO estorna na hora: ele manda um LINK DE CONFIRMAÇÃO ao e-mail da compra, e o estorno só sai quando o comprador abre o link e confirma.
-- O estorno usa o MESMO motor do reembolso por e-mail (conferir pedido pago, prazo de 7 dias, nenhum ingresso usado, reivindicar uma vez só, cadeado do Asaas, devolução no razão).
--
-- Regras (as notas do dono):
--   - o prazo de 7 dias conta do momento do PEDIDO na página (a hora do clique, gravada em `pedido_em`), conferindo que a compra tem no máximo 7 dias nessa hora;
--   - o link vale por pouco tempo: até 48 horas depois do pedido E nunca além dos 7 dias da compra (`expira_em`): confirmar não estende o direito;
--   - o link é de USO ÚNICO e só o hash dele (sha256) fica no banco; um link novo invalida os anteriores; link inválido, vencido, usado ou de outro pedido recebe a MESMA resposta;
--   - nada de login, conta ou senha: o link, que só chega ao e-mail da compra, é a prova;
--   - para ninguém usar o botão como metralhadora de e-mails: um link a cada 10 minutos e no máximo 5 por dia por pedido.
--
-- O que entra:
--   - `ticketeria_reembolsos.origem` ('email' ou 'pagina'): de onde veio o pedido de reembolso (a fila do Jards mostra);
--   - `ticketeria_reembolso_links`: um registro por link enviado (só o servidor lê e grava; nenhuma regra de acesso);
--   - `fn_ticketeria_reembolso_link_pedir` (confere a elegibilidade, limita e grava o hash), `_link_ver` (o link ainda vale? não gasta nada) e `_link_consumir` (gasta o link,
--     uma vez só, e abre o registro do reembolso na fila com origem 'pagina', para o motor seguir de onde o e-mail seguiria).
-- Sem dinheiro real. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_reembolsos add column if not exists origem text not null default 'email';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_reembolsos_origem_check') then
    alter table public.ticketeria_reembolsos add constraint ticketeria_reembolsos_origem_check check (origem in ('email', 'pagina'));
  end if;
end
$$;

create table if not exists public.ticketeria_reembolso_links (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.ticketeria_pedidos (id) on delete cascade,
  token_hash text not null,
  pedido_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  invalidado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_reembolso_links_hash_key unique (token_hash),
  constraint ticketeria_reembolso_links_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint ticketeria_reembolso_links_prazo_check check (expira_em > pedido_em)
);

create index if not exists ticketeria_reembolso_links_pedido_idx on public.ticketeria_reembolso_links (pedido_id, created_at desc);

alter table public.ticketeria_reembolso_links enable row level security;
revoke all on public.ticketeria_reembolso_links from public, anon, authenticated;

-- ─── Pedir o link: confere, limita e grava o hash ───────────────────────────

create or replace function public.fn_ticketeria_reembolso_link_pedir(p_pedido uuid, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_p public.ticketeria_pedidos%rowtype;
  v_expira timestamptz;
  v_id uuid;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash_invalido' using errcode = 'check_violation';
  end if;
  -- A linha do pedido fica travada: dois cliques juntos não furam o limite.
  select * into v_p from public.ticketeria_pedidos where id = p_pedido for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado');
  end if;
  if v_p.reembolsado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_reembolsado');
  end if;
  if v_p.situacao <> 'pago' or v_p.pago_em is null or v_p.provedor is distinct from 'asaas' or coalesce(v_p.provedor_ref, '') = '' or v_p.total_centavos <= 0 then
    return jsonb_build_object('ok', false, 'motivo', 'nao_elegivel');
  end if;
  if now() - v_p.pago_em > interval '7 days' then
    return jsonb_build_object('ok', false, 'motivo', 'fora_do_prazo');
  end if;
  if exists (select 1 from public.ticketeria_ingressos_emitidos e where e.pedido_id = v_p.id and e.usado_em is not null) then
    return jsonb_build_object('ok', false, 'motivo', 'ingresso_usado');
  end if;
  if exists (select 1 from public.ticketeria_reembolsos r where r.pedido_id = v_p.id and r.situacao = 'estornando') then
    return jsonb_build_object('ok', false, 'motivo', 'em_andamento');
  end if;
  if exists (select 1 from public.ticketeria_reembolso_links l where l.pedido_id = v_p.id and l.created_at > now() - interval '10 minutes') then
    return jsonb_build_object('ok', false, 'motivo', 'aguarde');
  end if;
  if (select count(*) from public.ticketeria_reembolso_links l where l.pedido_id = v_p.id and l.created_at > now() - interval '24 hours') >= 5 then
    return jsonb_build_object('ok', false, 'motivo', 'muitos_pedidos');
  end if;

  -- Um link novo invalida os que ainda não foram usados.
  update public.ticketeria_reembolso_links set invalidado_em = now() where pedido_id = v_p.id and usado_em is null and invalidado_em is null;
  v_expira := least(now() + interval '48 hours', v_p.pago_em + interval '7 days');
  insert into public.ticketeria_reembolso_links (pedido_id, token_hash, pedido_em, expira_em) values (v_p.id, p_hash, now(), v_expira) returning id into v_id;
  return jsonb_build_object('ok', true, 'link_id', v_id, 'email', v_p.comprador_email, 'nome', v_p.comprador_nome, 'codigo', v_p.codigo, 'expira_em', v_expira, 'pago_em', v_p.pago_em);
end;
$$;

-- ─── Ver se o link ainda vale (a página de confirmação; não gasta o link) ───

create or replace function public.fn_ticketeria_reembolso_link_ver(p_pedido uuid, p_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_l public.ticketeria_reembolso_links%rowtype;
  v_p public.ticketeria_pedidos%rowtype;
begin
  select * into v_l from public.ticketeria_reembolso_links where token_hash = p_hash and pedido_id = p_pedido;
  if not found or v_l.usado_em is not null or v_l.invalidado_em is not null or v_l.expira_em <= now() then
    return jsonb_build_object('valido', false);
  end if;
  select * into v_p from public.ticketeria_pedidos where id = v_l.pedido_id;
  if v_p.situacao <> 'pago' or v_p.reembolsado_em is not null then
    return jsonb_build_object('valido', false);
  end if;
  return jsonb_build_object('valido', true, 'codigo', v_p.codigo, 'total_centavos', v_p.total_centavos, 'expira_em', v_l.expira_em);
end;
$$;

-- ─── Gastar o link (uma vez só) e abrir o registro do reembolso na fila ─────

create or replace function public.fn_ticketeria_reembolso_link_consumir(p_pedido uuid, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_l public.ticketeria_reembolso_links%rowtype;
  v_p public.ticketeria_pedidos%rowtype;
  v_email_id text;
begin
  update public.ticketeria_reembolso_links
  set usado_em = now()
  where token_hash = p_hash and pedido_id = p_pedido and usado_em is null and invalidado_em is null and expira_em > now()
  returning * into v_l;
  if v_l.id is null then
    return null;
  end if;
  select * into v_p from public.ticketeria_pedidos where id = v_l.pedido_id;
  v_email_id := 'pagina:' || v_l.id::text;
  -- O mesmo registro que um e-mail abriria: o motor o encontra em "recebido" e segue (conferir, reivindicar, estornar, concluir). O remetente é o e-mail da compra: o link só chegou a ele.
  insert into public.ticketeria_reembolsos (email_id, remetente, assunto, codigo_lido, recebido_em, pedido_id, organization_id, origem)
  values (v_email_id, lower(btrim(v_p.comprador_email)), 'reembolso - ' || v_p.codigo, v_p.codigo, v_l.pedido_em, v_p.id, v_p.organization_id, 'pagina')
  on conflict (email_id) do nothing;
  return jsonb_build_object('email_id', v_email_id, 'remetente', lower(btrim(v_p.comprador_email)), 'assunto', 'reembolso - ' || v_p.codigo, 'recebido_em', v_l.pedido_em);
end;
$$;

revoke execute on function public.fn_ticketeria_reembolso_link_pedir(uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_link_ver(uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_link_consumir(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reembolso_link_pedir(uuid, text) to service_role;
grant execute on function public.fn_ticketeria_reembolso_link_ver(uuid, text) to service_role;
grant execute on function public.fn_ticketeria_reembolso_link_consumir(uuid, text) to service_role;
