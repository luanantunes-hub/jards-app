-- Ticketeria: a Porta melhor, etapa A — buscar pelo nome, desfazer uma entrada e o relatório da sessão.
--
-- ticketeria_porta_desfeitas: o registro de cada entrada desfeita (o ingresso, a hora e quem o leu antes, e quem desfez e quando). Quem edita a Ticketeria lê; só o servidor grava.
--
-- Funções (só o servidor as chama, pela chave de serviço; a rota confere quem edita a Ticketeria da loja). Todas exigem que a sessão seja da loja (sessao_inexistente):
--   fn_ticketeria_porta_buscar(loja, sessão, termo) → até 15 ingressos da sessão cujo comprador tem TODAS as palavras do termo (sem diferença de maiúsculas e de acentos; termo de menos de
--     2 letras não busca), com o código, o ingresso, o lugar, o comprador e a situação (nao_entrou, entrou ou cancelado);
--   fn_ticketeria_porta_desfazer(loja, sessão, código, usuário) → tira a marca de usado do ingresso (uma entrada marcada por engano) e registra: desfeita, nao_usado, cancelado,
--     outra_sessao ou nao_encontrado (ingresso de outra loja também);
--   fn_ticketeria_porta_relatorio(loja, sessão) → ingressos válidos, entraram, cancelados, por tipo de ingresso e por faixa de meia hora (no fuso do local);
--   fn_ticketeria_porta_lista(loja, sessão) → todos os ingressos da sessão (comprador, ingresso, lugar, situação e hora) para baixar.
--
-- Expansão: tabela nova e vazia, funções novas. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_porta_desfeitas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ingresso_emitido_id uuid not null references public.ticketeria_ingressos_emitidos (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  usado_em timestamptz not null,
  usado_por uuid,
  desfeito_por uuid,
  created_at timestamptz not null default now()
);

create index if not exists ticketeria_porta_desfeitas_org_idx on public.ticketeria_porta_desfeitas (organization_id, created_at desc);
create index if not exists ticketeria_porta_desfeitas_ingresso_idx on public.ticketeria_porta_desfeitas (ingresso_emitido_id);
create index if not exists ticketeria_porta_desfeitas_sessao_idx on public.ticketeria_porta_desfeitas (sessao_id);

alter table public.ticketeria_porta_desfeitas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_porta_desfeitas' and policyname = 'ticketeria_porta_desfeitas: le') then
    create policy "ticketeria_porta_desfeitas: le" on public.ticketeria_porta_desfeitas for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_porta_desfeitas from anon, authenticated;
grant select on public.ticketeria_porta_desfeitas to authenticated;

-- ─── Buscar ─────────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_porta_buscar(p_loja uuid, p_sessao uuid, p_termo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_termo text := btrim(coalesce(p_termo, ''));
  v_palavras text[];
  v_achados jsonb;
  v_total bigint;
begin
  select s.id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  if char_length(v_termo) < 2 then
    return jsonb_build_object('fuso', v_sessao.fuso, 'achados', '[]'::jsonb, 'mais', false);
  end if;
  -- Cada palavra do termo, sem acento e em minúsculas, com os curingas do LIKE escapados.
  select array_agg(replace(replace(replace(lower(public.unaccent(w)), '\', '\\'), '%', '\%'), '_', '\_')) into v_palavras
  from regexp_split_to_table(v_termo, '\s+') w where w <> '';
  with achados as (
    select i.codigo, i.nome as ingresso, i.assento_rotulo, p.comprador_nome, i.usado_em, i.cancelado_em, i.created_at, i.id
    from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id
    where i.sessao_id = p_sessao
      and not exists (select 1 from unnest(v_palavras) w where lower(public.unaccent(p.comprador_nome)) not like '%' || w || '%' escape '\')
  )
  select count(*) into v_total from achados;
  select coalesce(jsonb_agg(jsonb_build_object(
      'codigo', x.codigo, 'ingresso', x.ingresso, 'assento', x.assento_rotulo, 'comprador', x.comprador_nome, 'usado_em', x.usado_em,
      'situacao', case when x.cancelado_em is not null then 'cancelado' when x.usado_em is not null then 'entrou' else 'nao_entrou' end
    ) order by x.comprador_nome, x.ingresso, x.created_at, x.id), '[]'::jsonb) into v_achados
  from (
    select i.codigo, i.nome as ingresso, i.assento_rotulo, p.comprador_nome, i.usado_em, i.cancelado_em, i.created_at, i.id
    from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id
    where i.sessao_id = p_sessao
      and not exists (select 1 from unnest(v_palavras) w where lower(public.unaccent(p.comprador_nome)) not like '%' || w || '%' escape '\')
    order by p.comprador_nome, i.nome, i.created_at, i.id
    limit 15
  ) x;
  return jsonb_build_object('fuso', v_sessao.fuso, 'achados', v_achados, 'mais', v_total > 15);
end;
$$;

-- ─── Desfazer uma entrada ───────────────────────────────────────────────────

create or replace function public.fn_ticketeria_porta_desfazer(p_loja uuid, p_sessao uuid, p_codigo text, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_sessao record;
  v_ing public.ticketeria_ingressos_emitidos%rowtype;
  v_comprador text;
  v_restantes bigint;
begin
  select s.id, e.loja_id into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  select * into v_ing from public.ticketeria_ingressos_emitidos where codigo = v_codigo for update;
  if v_ing.id is null or (select e.loja_id from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id where s.id = v_ing.sessao_id) <> p_loja then
    return jsonb_build_object('tipo', 'nao_encontrado', 'codigo', v_codigo);
  end if;
  if v_ing.sessao_id <> p_sessao then
    return jsonb_build_object('tipo', 'outra_sessao', 'codigo', v_codigo);
  end if;
  if v_ing.cancelado_em is not null then
    return jsonb_build_object('tipo', 'cancelado', 'codigo', v_codigo, 'ingresso', v_ing.nome);
  end if;
  if v_ing.usado_em is null then
    return jsonb_build_object('tipo', 'nao_usado', 'codigo', v_codigo, 'ingresso', v_ing.nome);
  end if;
  insert into public.ticketeria_porta_desfeitas (organization_id, ingresso_emitido_id, sessao_id, usado_em, usado_por, desfeito_por)
  values (v_ing.organization_id, v_ing.id, v_ing.sessao_id, v_ing.usado_em, v_ing.usado_por, p_usuario);
  update public.ticketeria_ingressos_emitidos set usado_em = null, usado_por = null where id = v_ing.id;
  select comprador_nome into v_comprador from public.ticketeria_pedidos where id = v_ing.pedido_id;
  select count(*) into v_restantes from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null and usado_em is null;
  return jsonb_build_object('tipo', 'desfeita', 'codigo', v_codigo, 'ingresso', v_ing.nome, 'comprador', v_comprador, 'restantes', v_restantes);
end;
$$;

-- ─── Relatório e lista ──────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_porta_relatorio(p_loja uuid, p_sessao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
begin
  select s.id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  return jsonb_build_object(
    'fuso', v_sessao.fuso,
    'validos', (select count(*) from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null),
    'entraram', (select count(*) from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is null and usado_em is not null),
    'cancelados', (select count(*) from public.ticketeria_ingressos_emitidos where sessao_id = p_sessao and cancelado_em is not null),
    'por_ingresso', coalesce((
      select jsonb_agg(jsonb_build_object('nome', x.nome, 'validos', x.validos, 'entraram', x.entraram) order by x.nome)
      from (
        select i.nome, count(*) as validos, count(*) filter (where i.usado_em is not null) as entraram
        from public.ticketeria_ingressos_emitidos i where i.sessao_id = p_sessao and i.cancelado_em is null group by i.nome
      ) x
    ), '[]'::jsonb),
    'por_horario', coalesce((
      select jsonb_agg(jsonb_build_object('faixa', to_char(x.faixa, 'HH24:MI'), 'entradas', x.entradas) order by x.faixa)
      from (
        select date_bin('30 minutes', i.usado_em at time zone v_sessao.fuso, timestamp '2000-01-01 00:00') as faixa, count(*) as entradas
        from public.ticketeria_ingressos_emitidos i where i.sessao_id = p_sessao and i.cancelado_em is null and i.usado_em is not null group by 1
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.fn_ticketeria_porta_lista(p_loja uuid, p_sessao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
begin
  select s.id, e.loja_id, l.fuso into v_sessao
  from public.ticketeria_sessoes s join public.ticketeria_eventos e on e.id = s.evento_id join public.ticketeria_locais l on l.id = s.local_id
  where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.loja_id <> p_loja then
    raise exception 'sessao_inexistente' using errcode = 'check_violation';
  end if;
  return jsonb_build_object('fuso', v_sessao.fuso, 'ingressos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'comprador', x.comprador_nome, 'ingresso', x.nome, 'assento', x.assento_rotulo, 'usado_em', x.usado_em,
      'situacao', case when x.cancelado_em is not null then 'cancelado' when x.usado_em is not null then 'entrou' else 'nao_entrou' end
    ) order by x.comprador_nome, x.nome, x.assento_rotulo, x.created_at, x.id)
    from (
      select i.nome, i.assento_rotulo, i.usado_em, i.cancelado_em, i.created_at, i.id, p.comprador_nome
      from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id
      where i.sessao_id = p_sessao order by p.comprador_nome, i.nome, i.assento_rotulo, i.created_at, i.id limit 20000
    ) x
  ), '[]'::jsonb));
end;
$$;

revoke execute on function public.fn_ticketeria_porta_buscar(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_desfazer(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_relatorio(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_porta_lista(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_porta_buscar(uuid, uuid, text) to service_role;
grant execute on function public.fn_ticketeria_porta_desfazer(uuid, uuid, text, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_relatorio(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_porta_lista(uuid, uuid) to service_role;
