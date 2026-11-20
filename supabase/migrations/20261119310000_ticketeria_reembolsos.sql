-- Ticketeria: o REEMBOLSO POR E-MAIL (passo D da T5; decisão D15 do plano). O comprador manda um e-mail com o assunto "reembolso - código do ingresso"; o sistema lê o
-- pedido, confere (remetente, prazo de 7 dias, ingresso não usado) e, estando tudo certo, estorna sozinho, sem aprovação manual. Este arquivo é a parte do banco.
--
-- O que entra:
--   - `ticketeria_reembolsos`: UMA linha por e-mail recebido (o id do e-mail no Resend é único: o mesmo e-mail duas vezes não estorna duas vezes), com o que foi lido, a situação
--     (`recebido` → `estornando` → `estornado`, ou o motivo de não estornar) e o valor. É também a FILA do Jards: o que não é atendido sozinho fica aqui, com o motivo. Lê quem edita a
--     Ticketeria da organização do pedido; ninguém logado escreve;
--   - `ticketeria_pedidos.reembolsado_em`: quando o pedido foi reembolsado. Um pedido reembolsado volta a `cancelado` (a restrição do pedido exige `pago_em` nulo fora de `pago`): os
--     lugares voltam à venda e o repasse deixa de contar a venda. A data do pagamento fica no livro-razão e no registro do reembolso;
--   - `fn_ticketeria_reembolso_registrar`, `_reivindicar`, `_marcar`, `_autorizar_estorno` e `_concluir`: os passos, todos só do servidor, e `fn_ticketeria_pedido_para_reembolso`
--     (acha o pedido pelo código do pedido ou de um ingresso). O estorno só começa para quem reivindicou (uma vez só); `concluir` faz tudo junto, numa transação: cancela o pedido,
--     cancela os ingressos emitidos e grava a devolução no livro-razão (que precisa fechar em zero);
--   - `_autorizar_estorno` registra a ORDEM do cadeado (`PIX_REFUND`, com o valor): o Asaas pergunta ao Jards antes de estornar um Pix, e sem ordem o Jards recusa.
-- Sem dinheiro real. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_reembolsos (
  id uuid primary key default gen_random_uuid(),
  email_id text not null,
  remetente text not null,
  assunto text not null,
  codigo_lido text,
  recebido_em timestamptz not null,
  pedido_id uuid references public.ticketeria_pedidos (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  situacao text not null default 'recebido',
  motivo text,
  valor_centavos bigint,
  pago_em timestamptz,
  estorno_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_reembolsos_email_key unique (email_id),
  constraint ticketeria_reembolsos_situacao_check check (situacao in ('recebido', 'estornando', 'estornado', 'fora_do_prazo', 'remetente_diferente', 'nao_encontrado', 'ja_reembolsado', 'nao_elegivel', 'falhou')),
  constraint ticketeria_reembolsos_email_id_check check (char_length(email_id) between 1 and 200),
  constraint ticketeria_reembolsos_assunto_check check (char_length(assunto) <= 300),
  constraint ticketeria_reembolsos_valor_check check (valor_centavos is null or valor_centavos > 0)
);

create index if not exists ticketeria_reembolsos_pedido_idx on public.ticketeria_reembolsos (pedido_id);
create index if not exists ticketeria_reembolsos_org_idx on public.ticketeria_reembolsos (organization_id, created_at desc);
create index if not exists ticketeria_reembolsos_fila_idx on public.ticketeria_reembolsos (situacao) where situacao not in ('estornado', 'ja_reembolsado');

alter table public.ticketeria_pedidos add column if not exists reembolsado_em timestamptz;

alter table public.ticketeria_reembolsos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_reembolsos' and policyname = 'ticketeria_reembolsos: le') then
    create policy "ticketeria_reembolsos: le" on public.ticketeria_reembolsos for select to authenticated
      using (organization_id is not null and public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_reembolsos from public, anon, authenticated;
grant select on public.ticketeria_reembolsos to authenticated;

-- ─── Registrar o e-mail recebido (uma vez só por e-mail) ────────────────────

create or replace function public.fn_ticketeria_reembolso_registrar(p_email_id text, p_remetente text, p_assunto text, p_codigo text, p_recebido_em timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_situacao text;
begin
  insert into public.ticketeria_reembolsos (email_id, remetente, assunto, codigo_lido, recebido_em)
  values (p_email_id, lower(btrim(p_remetente)), left(coalesce(p_assunto, ''), 300), nullif(upper(btrim(coalesce(p_codigo, ''))), ''), p_recebido_em)
  on conflict (email_id) do nothing
  returning id, situacao into v_id, v_situacao;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'novo', true, 'situacao', v_situacao);
  end if;
  select id, situacao into v_id, v_situacao from public.ticketeria_reembolsos where email_id = p_email_id;
  return jsonb_build_object('id', v_id, 'novo', false, 'situacao', v_situacao);
end;
$$;

-- ─── Achar o pedido pelo código (do pedido, com 8 letras, ou de um ingresso, com 10) ──

create or replace function public.fn_ticketeria_pedido_para_reembolso(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_pedido public.ticketeria_pedidos%rowtype;
begin
  if v_codigo ~ '^[A-HJ-NP-Z2-9]{8}$' then
    select * into v_pedido from public.ticketeria_pedidos where codigo = v_codigo;
  elsif v_codigo ~ '^[A-HJ-NP-Z2-9]{10}$' then
    select p.* into v_pedido from public.ticketeria_ingressos_emitidos e join public.ticketeria_pedidos p on p.id = e.pedido_id where e.codigo = v_codigo;
  end if;
  if v_pedido.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'id', v_pedido.id, 'organization_id', v_pedido.organization_id, 'loja_id', v_pedido.loja_id, 'codigo', v_pedido.codigo, 'comprador_nome', v_pedido.comprador_nome,
    'comprador_email', v_pedido.comprador_email, 'situacao', v_pedido.situacao, 'total_centavos', v_pedido.total_centavos, 'taxa_centavos', v_pedido.taxa_centavos,
    'produtor_centavos', v_pedido.produtor_centavos, 'custo_meio_centavos', coalesce(v_pedido.custo_meio_real_centavos, v_pedido.custo_meio_centavos), 'pago_em', v_pedido.pago_em,
    'provedor', v_pedido.provedor, 'provedor_ref', v_pedido.provedor_ref, 'reembolsado_em', v_pedido.reembolsado_em,
    'ingresso_usado', exists (select 1 from public.ticketeria_ingressos_emitidos e where e.pedido_id = v_pedido.id and e.usado_em is not null)
  );
end;
$$;

-- ─── Reivindicar o estorno: só um e-mail começa o estorno, uma vez só ───────

create or replace function public.fn_ticketeria_reembolso_reivindicar(p_reembolso uuid, p_pedido uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.ticketeria_reembolsos r
  set situacao = 'estornando', pedido_id = p_pedido, organization_id = (select organization_id from public.ticketeria_pedidos where id = p_pedido), updated_at = now()
  where r.id = p_reembolso and r.situacao = 'recebido'
    and not exists (select 1 from public.ticketeria_reembolsos o where o.pedido_id = p_pedido and o.id <> p_reembolso and o.situacao in ('estornando', 'estornado'))
  returning r.id into v_id;
  return v_id is not null;
end;
$$;

-- ─── Marcar o resultado de um e-mail que não vira estorno (ou que falhou) ───

create or replace function public.fn_ticketeria_reembolso_marcar(p_reembolso uuid, p_situacao text, p_motivo text, p_pedido uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_situacao not in ('fora_do_prazo', 'remetente_diferente', 'nao_encontrado', 'ja_reembolsado', 'nao_elegivel', 'falhou') then
    raise exception 'situacao_invalida' using errcode = 'check_violation';
  end if;
  update public.ticketeria_reembolsos
  set situacao = p_situacao, motivo = left(p_motivo, 300), pedido_id = coalesce(p_pedido, pedido_id),
      organization_id = coalesce((select organization_id from public.ticketeria_pedidos where id = p_pedido), organization_id), updated_at = now()
  where id = p_reembolso and situacao in ('recebido', 'estornando');
  if not found then
    raise exception 'reembolso_nao_pendente' using errcode = 'check_violation';
  end if;
end;
$$;

-- ─── A ordem do cadeado: o Asaas vai perguntar ao Jards antes de estornar o Pix ──

create or replace function public.fn_ticketeria_reembolso_autorizar_estorno(p_reembolso uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r public.ticketeria_reembolsos%rowtype;
  v_pedido public.ticketeria_pedidos%rowtype;
  v_id uuid;
begin
  select * into v_r from public.ticketeria_reembolsos where id = p_reembolso for update;
  if not found or v_r.situacao <> 'estornando' or v_r.pedido_id is null then
    raise exception 'reembolso_nao_pendente' using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.ticketeria_pedidos where id = v_r.pedido_id;
  if v_pedido.situacao <> 'pago' or v_pedido.total_centavos <= 0 then
    raise exception 'pedido_nao_pago' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_transferencias_autorizadas (tipo, valor_centavos, motivo, expira_em)
  values ('PIX_REFUND', v_pedido.total_centavos, 'Reembolso por e-mail do pedido ' || v_pedido.codigo, now() + interval '15 minutes')
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Concluir: o Asaas estornou; cancela o pedido e os ingressos e grava a devolução no razão ──

create or replace function public.fn_ticketeria_reembolso_concluir(p_reembolso uuid, p_partidas jsonb, p_estorno_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r public.ticketeria_reembolsos%rowtype;
  v_pedido public.ticketeria_pedidos%rowtype;
  v_transacao uuid;
  v_soma bigint;
begin
  select * into v_r from public.ticketeria_reembolsos where id = p_reembolso for update;
  if not found or v_r.situacao <> 'estornando' or v_r.pedido_id is null then
    raise exception 'reembolso_nao_pendente' using errcode = 'check_violation';
  end if;
  select * into v_pedido from public.ticketeria_pedidos where id = v_r.pedido_id for update;
  if v_pedido.situacao <> 'pago' then
    raise exception 'pedido_nao_pago' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_partidas) <> 'array' or jsonb_array_length(p_partidas) < 2 then
    raise exception 'partidas_invalidas' using errcode = 'check_violation';
  end if;
  select coalesce(sum((x ->> 'valor_centavos')::bigint), 0) into v_soma from jsonb_array_elements(p_partidas) x;
  if v_soma <> 0 then
    raise exception 'razao_desequilibrado' using errcode = 'check_violation';
  end if;

  update public.ticketeria_pedidos set situacao = 'cancelado', pago_em = null, reembolsado_em = now(), updated_at = now() where id = v_pedido.id;
  update public.ticketeria_ingressos_emitidos set cancelado_em = now() where pedido_id = v_pedido.id and cancelado_em is null;

  insert into public.ticketeria_transacoes (organization_id, loja_id, pedido_id, tipo, descricao)
  values (v_pedido.organization_id, v_pedido.loja_id, v_pedido.id, 'estorno', 'Reembolso do pedido ' || v_pedido.codigo)
  returning id into v_transacao;
  insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos)
  select v_pedido.organization_id, v_transacao, x ->> 'conta', (x ->> 'valor_centavos')::bigint from jsonb_array_elements(p_partidas) x;

  update public.ticketeria_reembolsos
  set situacao = 'estornado', valor_centavos = v_pedido.total_centavos, pago_em = v_pedido.pago_em, estorno_ref = left(p_estorno_ref, 200), updated_at = now()
  where id = p_reembolso;
  return jsonb_build_object('pedido_id', v_pedido.id, 'valor_centavos', v_pedido.total_centavos);
end;
$$;

revoke execute on function public.fn_ticketeria_reembolso_registrar(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_pedido_para_reembolso(text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_reivindicar(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_marcar(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_autorizar_estorno(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reembolso_concluir(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_reembolso_registrar(text, text, text, text, timestamptz) to service_role;
grant execute on function public.fn_ticketeria_pedido_para_reembolso(text) to service_role;
grant execute on function public.fn_ticketeria_reembolso_reivindicar(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_reembolso_marcar(uuid, text, text, uuid) to service_role;
grant execute on function public.fn_ticketeria_reembolso_autorizar_estorno(uuid) to service_role;
grant execute on function public.fn_ticketeria_reembolso_concluir(uuid, jsonb, text) to service_role;
