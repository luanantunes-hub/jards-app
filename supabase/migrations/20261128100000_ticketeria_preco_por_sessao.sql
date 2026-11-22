-- Ticketeria: PREÇO POR SESSÃO (plano, seção 11, fase P0).
--
-- Antes: o preço vivia só no lote do ingresso (ticketeria_lotes.preco_centavos), e o ingresso é do evento: todas as sessões de um evento cobravam o mesmo
-- valor. Agora cada sessão pode ter um preço próprio para um lote; sem preço da sessão, vale o do lote, como sempre.
--
--   - ticketeria_precos_da_sessao: o preço de UM lote numa sessão (único por sessão e lote). Só lotes do mesmo evento da sessão e da mesma organização;
--     a categoria manda como no lote (gratuito e cortesia = 0; os outros, mais que 0). A meia NÃO tem preço próprio por sessão: o lote da meia é o
--     espelho da inteira (espelho_de), e na sessão ela vale a metade do preço da inteira naquela sessão (arredondada, nunca abaixo de 1 centavo: a
--     mesma conta do espelho). Quem põe o preço na inteira da sessão põe, sem querer, o da meia;
--   - ticketeria_precos_historico: cada mudança de preço de sessão (de quanto, para quanto, quando e quem). Só se escreve pelo gatilho; ninguém altera;
--   - ticketeria_pedido_itens.preco_base_centavos: o preço do lote no momento da compra (nulo nos pedidos antigos). O preço cobrado segue em preco_centavos;
--   - fn_ticketeria_preco_do_lote(lote, sessão): o preço que vale (o da sessão; senão a metade do da inteira; senão o do lote). Só o servidor a chama;
--   - fn_ticketeria_reservar: a MESMA função (mesma assinatura, create or replace, sem DROP e sem sobrecarga: PGRST203), trocando só de onde vem o preço do lote
--     (agora fn_ticketeria_preco_do_lote) e gravando o preço-base no item. A taxa, o cupom, o estoque e o resto seguem iguais: a taxa já sai do preço que vale.
--
-- Aditiva e reaplicável: não apaga nem renomeia nada. O site publicado, que roda o código anterior, continua vendendo pelo preço do lote.

-- ─── O preço de um lote numa sessão ──────────────────────────────────────────
create table if not exists public.ticketeria_precos_da_sessao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  lote_id uuid not null references public.ticketeria_lotes (id) on delete cascade,
  preco_centavos integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_precos_da_sessao_unico unique (sessao_id, lote_id),
  constraint ticketeria_precos_da_sessao_preco_check check (preco_centavos between 0 and 10000000)
);
create index if not exists ticketeria_precos_da_sessao_org_idx on public.ticketeria_precos_da_sessao (organization_id);
create index if not exists ticketeria_precos_da_sessao_lote_idx on public.ticketeria_precos_da_sessao (lote_id);

create table if not exists public.ticketeria_precos_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  lote_id uuid not null references public.ticketeria_lotes (id) on delete cascade,
  preco_anterior_centavos integer,
  preco_novo_centavos integer,
  motivo text not null default 'manual',
  por uuid references auth.users (id) on delete set null,
  quando timestamptz not null default clock_timestamp(),
  constraint ticketeria_precos_historico_motivo_check check (motivo in ('manual'))
);
create index if not exists ticketeria_precos_historico_org_idx on public.ticketeria_precos_historico (organization_id);
create index if not exists ticketeria_precos_historico_sessao_idx on public.ticketeria_precos_historico (sessao_id, quando desc);

alter table public.ticketeria_pedido_itens add column if not exists preco_base_centavos integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ticketeria_pedido_itens_preco_base_check') then
    alter table public.ticketeria_pedido_itens add constraint ticketeria_pedido_itens_preco_base_check check (preco_base_centavos is null or preco_base_centavos >= 0);
  end if;
end $$;

-- ─── Coerência do preço da sessão ────────────────────────────────────────────
create or replace function public.fn_ticketeria_preco_sessao_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao_org uuid;
  v_sessao_evento uuid;
  v_ingresso_org uuid;
  v_ingresso_evento uuid;
  v_categoria text;
  v_espelho uuid;
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.sessao_id is distinct from old.sessao_id or new.lote_id is distinct from old.lote_id) then
    raise exception 'preco_da_sessao_nao_muda_de_lugar' using errcode = 'check_violation';
  end if;
  select s.organization_id, s.evento_id into v_sessao_org, v_sessao_evento from public.ticketeria_sessoes s where s.id = new.sessao_id;
  select i.organization_id, i.evento_id, i.categoria, l.espelho_de into v_ingresso_org, v_ingresso_evento, v_categoria, v_espelho
    from public.ticketeria_lotes l join public.ticketeria_ingressos i on i.id = l.ingresso_id where l.id = new.lote_id;
  if v_sessao_org is null or v_ingresso_org is null or v_sessao_org <> new.organization_id or v_ingresso_org <> new.organization_id then
    raise exception 'preco_da_sessao_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  if v_sessao_evento <> v_ingresso_evento then
    raise exception 'lote_de_outro_evento' using errcode = 'check_violation';
  end if;
  if v_espelho is not null then
    raise exception 'meia_acompanha_a_inteira' using errcode = 'check_violation';
  end if;
  if not public.fn_ticketeria_preco_combina(v_categoria, new.preco_centavos) then
    raise exception 'preco_incoerente' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_ticketeria_preco_sessao_historico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticketeria_precos_historico (organization_id, sessao_id, lote_id, preco_anterior_centavos, preco_novo_centavos, por)
    values (new.organization_id, new.sessao_id, new.lote_id, null, new.preco_centavos, auth.uid());
  elsif tg_op = 'UPDATE' then
    if new.preco_centavos is distinct from old.preco_centavos then
      insert into public.ticketeria_precos_historico (organization_id, sessao_id, lote_id, preco_anterior_centavos, preco_novo_centavos, por)
      values (new.organization_id, new.sessao_id, new.lote_id, old.preco_centavos, new.preco_centavos, auth.uid());
    end if;
  else
    insert into public.ticketeria_precos_historico (organization_id, sessao_id, lote_id, preco_anterior_centavos, preco_novo_centavos, por)
    values (old.organization_id, old.sessao_id, old.lote_id, old.preco_centavos, null, auth.uid());
  end if;
  return null;
end;
$$;

create or replace trigger ticketeria_precos_da_sessao_coerencia
  before insert or update on public.ticketeria_precos_da_sessao
  for each row execute function public.fn_ticketeria_preco_sessao_coerencia();
create or replace trigger ticketeria_precos_da_sessao_historico
  after insert or update or delete on public.ticketeria_precos_da_sessao
  for each row execute function public.fn_ticketeria_preco_sessao_historico();
create or replace trigger ticketeria_precos_da_sessao_updated_at
  before update on public.ticketeria_precos_da_sessao
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── O preço que vale para um lote numa sessão ───────────────────────────────
create or replace function public.fn_ticketeria_preco_do_lote(p_lote uuid, p_sessao uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select p.preco_centavos from public.ticketeria_precos_da_sessao p where p.lote_id = l.id and p.sessao_id = p_sessao),
    (select greatest(1, round(p.preco_centavos / 2.0)::integer) from public.ticketeria_precos_da_sessao p where p.lote_id = l.espelho_de and p.sessao_id = p_sessao),
    l.preco_centavos)
  from public.ticketeria_lotes l where l.id = p_lote;
$$;

-- ─── Acesso: quem edita a Ticketeria da organização escreve; quem a lê, lê; o histórico só se lê ─────────────────────────
alter table public.ticketeria_precos_da_sessao enable row level security;
alter table public.ticketeria_precos_historico enable row level security;

do $$
declare
  v_tabela text := 'ticketeria_precos_da_sessao';
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': le') then
    execute format('create policy %I on public.%I for select to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': le', v_tabela, 'ler');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': insere') then
    execute format('create policy %I on public.%I for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': insere', v_tabela, 'editar');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': edita') then
    execute format('create policy %I on public.%I for update to authenticated using (public.auth_ticketeria_pode(organization_id, %L)) with check (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': edita', v_tabela, 'editar', 'editar');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': apaga') then
    execute format('create policy %I on public.%I for delete to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': apaga', v_tabela, 'editar');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_precos_historico' and policyname = 'ticketeria_precos_historico: le') then
    create policy "ticketeria_precos_historico: le" on public.ticketeria_precos_historico for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
end $$;

revoke all on public.ticketeria_precos_da_sessao, public.ticketeria_precos_historico from anon, authenticated;
grant select, insert, update, delete on public.ticketeria_precos_da_sessao to authenticated;
grant select on public.ticketeria_precos_historico to authenticated;

revoke execute on function public.fn_ticketeria_preco_sessao_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_preco_sessao_historico() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_preco_do_lote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_preco_do_lote(uuid, uuid) to service_role;

comment on table public.ticketeria_precos_da_sessao is 'O preço de um lote numa sessão. Sem linha, vale o preço do lote; a meia vale a metade da inteira da sessão. Plano da Ticketeria, seção 11 (P0).';
comment on table public.ticketeria_precos_historico is 'Cada mudança de preço de sessão: de quanto, para quanto, quando e quem. Escrita só pelo gatilho; ninguém altera.';
comment on column public.ticketeria_pedido_itens.preco_base_centavos is 'O preço do lote no momento da compra (nulo nos pedidos antigos). O preço cobrado é preco_centavos.';

-- ─── A reserva: a mesma função, com o preço que vale ─────────────────────────
CREATE OR REPLACE FUNCTION public.fn_ticketeria_reservar(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_lugares_setor integer;
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

    -- O setor é o estoque: trava a linha dele (antes dos lotes, sempre nessa ordem) e confere o balde de lugares da sessão.
    select s.lugares into v_lugares_setor from public.ticketeria_setores s where s.id = v_ingresso.setor_id for update;

    -- Os lotes em sequência, cada um travado durante a conta.
    for v_lote in
      select l.id, public.fn_ticketeria_preco_do_lote(l.id, p_sessao) as preco_centavos, l.preco_centavos as preco_base_centavos,
             l.quantidade, l.vendas_inicio, l.vendas_fim
      from public.ticketeria_lotes l where l.ingresso_id = v_ingresso.id
      order by l.ordem, l.created_at, l.id
      for update
    loop
      exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now(); -- a janela ainda não abriu: segura os seguintes
      continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now(); -- a janela fechou: vale o seguinte
      -- O que sobra é o menor entre o teto do lote e o que resta no balde do setor (tudo o que já foi pedido na sessão, deste pedido também).
      v_livres := least(v_lote.quantidade - public.fn_ticketeria_ocupados(v_sessao.id, v_lote.id, v_pedido),
                        v_lugares_setor - public.fn_ticketeria_ocupados_do_setor(v_sessao.id, v_ingresso.setor_id));
      continue when v_livres <= 0; -- esgotado nesta sessão: vale o seguinte
      v_tirar := least(v_livres, v_restante)::integer;
      v_taxa_unit := public.fn_ticketeria_taxa_do_ingresso(v_lote.preco_centavos, v_taxa.percentual_bps, v_taxa.fixo_centavos, v_taxa.quem_paga);
      insert into public.ticketeria_pedido_itens (organization_id, pedido_id, ingresso_id, lote_id, quantidade, preco_centavos, preco_base_centavos, taxa_centavos)
      values (v_sessao.organization_id, v_pedido, v_ingresso.id, v_lote.id, v_tirar, v_lote.preco_centavos, v_lote.preco_base_centavos, v_taxa_unit);
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
$function$;
