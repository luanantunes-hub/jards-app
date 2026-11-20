-- Ticketeria: assentos marcados, etapa 2 — a compra com escolha de lugares.
--
-- Num setor com lugares numerados (etapa 1) a pessoa escolhe o tipo de ingresso (Inteira, Meia...) e depois os lugares no mapa; os tipos do mesmo setor dividem os
-- mesmos lugares. O lugar fica reservado com o pedido pelo mesmo prazo de hoje (15 minutos); pago, vira o lugar do ingresso; vencido, cancelado ou reembolsado, volta
-- para a venda. Um lugar é por SESSÃO (a mesma poltrona pode estar vendida numa sessão e livre em outra). O preço segue vindo do lote da vez.
--
-- ticketeria_pedido_assentos: um por lugar do pedido (pedido, sessão, ingresso, lugar). Guarda também fileira e número (o lugar pode sair do mapa depois sem apagar a história).
-- ticketeria_ingressos_emitidos ganha `assento_rotulo` ("Plateia · Fileira C · lugar 7"): o lugar impresso no ingresso, que não muda se o mapa mudar.
--
-- Funções (só o servidor as chama, pela chave de serviço):
--   fn_ticketeria_lugares_livres_do_setor(sessão, setor) → quantos lugares do mapa ainda estão livres na sessão (não bloqueados, sem pedido pago nem reserva no prazo);
--   fn_ticketeria_mapa_da_sessao(sessão, ingresso) → o mapa do setor do ingresso para quem compra (livre ou ocupado; o bloqueado aparece como ocupado), ou nulo se o
--     ingresso não é de setor numerado ou não está à venda na sessão;
--   fn_ticketeria_reservar_com_lugares(sessão, itens, nome, e-mail, minutos, código, lugares) → reserva (com cupom, se houver) e prende os lugares na MESMA transação: se
--     um lugar falha, nada fica reservado. lugares = [{ ingresso_id, assentos: [{ fileira, numero }] }]. Erros: lugares_obrigatorios, lugares_quantidade, ingresso_sem_mapa,
--     lugares_invalidos, lugar_indisponivel (não existe ou está bloqueado), lugar_ocupado;
--   fn_ticketeria_lugares_aos_ingressos(pedido) → põe o lugar em cada ingresso emitido do pedido (na ordem), uma vez só.
-- fn_ticketeria_emitir_ingressos e fn_ticketeria_ingressos_do_pedido passam a cuidar do lugar; fn_ticketeria_livres (lista de espera) leva os lugares em conta;
-- fn_ticketeria_salvar_mapa recusa tirar ou bloquear um lugar vendido para sessão por vir (lugar_vendido); o gatilho do setor recusa desligar "numerado" com lugares
-- vendidos (setor_com_lugares_vendidos). fn_ticketeria_mapa_do_setor passa a ordenar as fileiras A..Z, AA..AZ.
--
-- Expansão: tabela nova e vazia, coluna anulável, funções novas e substituídas (mesma assinatura). Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_pedido_assentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pedido_id uuid not null references public.ticketeria_pedidos (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  ingresso_id uuid not null references public.ticketeria_ingressos (id) on delete no action,
  assento_id uuid references public.ticketeria_assentos (id) on delete set null,
  fileira text not null,
  numero integer not null,
  created_at timestamptz not null default now(),
  constraint ticketeria_pedido_assentos_lugar_key unique (pedido_id, fileira, numero)
);

create index if not exists ticketeria_pedido_assentos_org_idx on public.ticketeria_pedido_assentos (organization_id);
create index if not exists ticketeria_pedido_assentos_assento_idx on public.ticketeria_pedido_assentos (assento_id, sessao_id) where assento_id is not null;
create index if not exists ticketeria_pedido_assentos_ingresso_idx on public.ticketeria_pedido_assentos (ingresso_id);
create index if not exists ticketeria_pedido_assentos_sessao_idx on public.ticketeria_pedido_assentos (sessao_id);

alter table public.ticketeria_ingressos_emitidos add column if not exists assento_rotulo text;

alter table public.ticketeria_pedido_assentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_pedido_assentos' and policyname = 'ticketeria_pedido_assentos: le') then
    create policy "ticketeria_pedido_assentos: le" on public.ticketeria_pedido_assentos for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

-- ─── Lugares livres e o mapa da sessão ──────────────────────────────────────

create or replace function public.fn_ticketeria_lugares_livres_do_setor(p_sessao uuid, p_setor uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.ticketeria_assentos a
  where a.setor_id = p_setor and not a.bloqueado
    and not exists (
      select 1 from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
      where pa.assento_id = a.id and pa.sessao_id = p_sessao and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
    );
$$;

create or replace function public.fn_ticketeria_mapa_da_sessao(p_sessao uuid, p_ingresso uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sessao record;
  v_ingresso record;
begin
  select s.evento_id, s.local_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.evento_id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    return null;
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, st.id as setor_id, st.nome as setor, st.numerado, st.corredor_no_meio, st.local_id
    into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or v_ingresso.local_id <> v_sessao.local_id or not v_ingresso.publico or v_ingresso.arquivado or not v_ingresso.numerado then
    return null;
  end if;
  return jsonb_build_object('setor', v_ingresso.setor, 'corredor', v_ingresso.corredor_no_meio, 'fileiras', coalesce((
    select jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by length(f.fileira), f.fileira)
    from (
      select a.fileira,
        jsonb_agg(jsonb_build_object('numero', a.numero, 'estado', case when a.bloqueado or o.assento_id is not null then 'ocupado' else 'livre' end) order by a.numero) as assentos
      from public.ticketeria_assentos a
      left join (
        select pa.assento_id from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
        where pa.sessao_id = p_sessao and pa.assento_id is not null and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
      ) o on o.assento_id = a.id
      where a.setor_id = v_ingresso.setor_id
      group by a.fileira
    ) f
  ), '[]'::jsonb));
end;
$$;

-- A lista de espera e a vitrine: o que se consegue comprar agora num ingresso de setor numerado não passa dos lugares livres.
create or replace function public.fn_ticketeria_livres(p_sessao uuid, p_ingresso uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lote record;
  v_total bigint := 0;
  v_livres bigint;
  v_setor uuid;
begin
  for v_lote in select l.id, l.quantidade, l.vendas_inicio, l.vendas_fim from public.ticketeria_lotes l where l.ingresso_id = p_ingresso order by l.ordem, l.created_at, l.id loop
    exit when v_lote.vendas_inicio is not null and v_lote.vendas_inicio > now();
    continue when v_lote.vendas_fim is not null and v_lote.vendas_fim <= now();
    v_livres := v_lote.quantidade - public.fn_ticketeria_ocupados(p_sessao, v_lote.id);
    if v_livres > 0 then v_total := v_total + v_livres; end if;
  end loop;
  select st.id into v_setor from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso and st.numerado;
  if v_setor is not null then
    v_total := least(v_total, public.fn_ticketeria_lugares_livres_do_setor(p_sessao, v_setor));
  end if;
  return v_total;
end;
$$;

-- ─── O lugar no ingresso ────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_lugares_aos_ingressos(p_pedido uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_linhas integer;
begin
  with lugares as (
    select pa.ingresso_id, st.nome || ' · Fileira ' || pa.fileira || ' · lugar ' || pa.numero as rotulo,
      row_number() over (partition by pa.ingresso_id order by length(pa.fileira), pa.fileira, pa.numero) as rn
    from public.ticketeria_pedido_assentos pa
    join public.ticketeria_ingressos i on i.id = pa.ingresso_id join public.ticketeria_setores st on st.id = i.setor_id
    where pa.pedido_id = p_pedido
  ), emitidos as (
    select e.id, e.ingresso_id, row_number() over (partition by e.ingresso_id order by e.created_at, e.id) as rn
    from public.ticketeria_ingressos_emitidos e where e.pedido_id = p_pedido
  )
  update public.ticketeria_ingressos_emitidos e set assento_rotulo = l.rotulo
  from emitidos x join lugares l on l.ingresso_id = x.ingresso_id and l.rn = x.rn
  where e.id = x.id and e.assento_rotulo is null;
  get diagnostics v_linhas = row_count;
  return v_linhas;
end;
$$;

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
  perform public.fn_ticketeria_lugares_aos_ingressos(p_pedido);
  return v_n;
end;
$$;

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
    'ingressos', coalesce((select jsonb_agg(jsonb_build_object('codigo', x.codigo, 'nome', x.nome, 'assento', x.assento_rotulo, 'preco_centavos', x.preco_centavos, 'usado', x.usado_em is not null, 'cancelado', x.cancelado_em is not null) order by x.created_at, x.id)
                           from public.ticketeria_ingressos_emitidos x where x.pedido_id = v_ped.id), '[]'::jsonb)
  );
end;
$$;

-- ─── Reservar com lugares ───────────────────────────────────────────────────

create or replace function public.fn_ticketeria_reservar_com_lugares(p_sessao uuid, p_itens jsonb, p_nome text, p_email text, p_minutos integer, p_codigo text, p_lugares jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reserva jsonb;
  v_pedido uuid;
  v_entrada jsonb;
  v_ingresso_id uuid;
  v_setor record;
  v_quantidade bigint;
  v_chaves text[] := '{}';
  v_ids uuid[] := '{}';
  v_chave text;
  v_lugar jsonb;
  v_assento record;
  v_org uuid;
  v_vistos uuid[] := '{}';
begin
  if p_lugares is not null and jsonb_typeof(p_lugares) <> 'array' then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;
  v_reserva := public.fn_ticketeria_reservar_com_cupom(p_sessao, p_itens, p_nome, p_email, p_minutos, p_codigo);
  v_pedido := (v_reserva ->> 'pedido_id')::uuid;
  select organization_id into v_org from public.ticketeria_pedidos where id = v_pedido;

  -- Todo ingresso de setor numerado do pedido pede os lugares dele, na quantidade certa; ingresso de setor comum não leva lugar.
  for v_ingresso_id, v_quantidade in select it.ingresso_id, sum(it.quantidade) from public.ticketeria_pedido_itens it where it.pedido_id = v_pedido group by it.ingresso_id loop
    select st.id, st.numerado into v_setor from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = v_ingresso_id;
    select e into v_entrada from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) e where (e ->> 'ingresso_id') = v_ingresso_id::text limit 1;
    if v_setor.numerado then
      if v_entrada is null then
        raise exception 'lugares_obrigatorios' using errcode = 'check_violation';
      end if;
      if jsonb_typeof(v_entrada -> 'assentos') is distinct from 'array' or jsonb_array_length(v_entrada -> 'assentos') <> v_quantidade then
        raise exception 'lugares_quantidade' using errcode = 'check_violation';
      end if;
      v_vistos := v_vistos || v_ingresso_id;
    elsif v_entrada is not null then
      raise exception 'ingresso_sem_mapa' using errcode = 'check_violation';
    end if;
  end loop;
  -- Entrada para ingresso que não está no pedido, ou repetida.
  if exists (select 1 from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) e where not ((e ->> 'ingresso_id') = any(select x::text from unnest(v_vistos) x))) then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;
  if (select count(*) from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb))) <> coalesce(array_length(v_vistos, 1), 0) then
    raise exception 'lugares_invalidos' using errcode = 'check_violation';
  end if;

  -- Os lugares: existem no setor do ingresso, não estão bloqueados, não se repetem.
  for v_entrada in select * from jsonb_array_elements(coalesce(p_lugares, '[]'::jsonb)) loop
    v_ingresso_id := (v_entrada ->> 'ingresso_id')::uuid;
    for v_lugar in select * from jsonb_array_elements(v_entrada -> 'assentos') loop
      if jsonb_typeof(v_lugar) <> 'object' or upper(btrim(coalesce(v_lugar ->> 'fileira', ''))) !~ '^[A-Z0-9]{1,4}$' or (v_lugar ->> 'numero') !~ '^[0-9]{1,3}$' then
        raise exception 'lugares_invalidos' using errcode = 'check_violation';
      end if;
      select a.id into v_assento from public.ticketeria_assentos a join public.ticketeria_ingressos i on i.setor_id = a.setor_id
        where i.id = v_ingresso_id and a.fileira = upper(btrim(v_lugar ->> 'fileira')) and a.numero = (v_lugar ->> 'numero')::integer and not a.bloqueado;
      if v_assento.id is null then
        raise exception 'lugar_indisponivel' using errcode = 'check_violation';
      end if;
      if v_assento.id = any(v_ids) then
        raise exception 'lugares_invalidos' using errcode = 'check_violation';
      end if;
      v_ids := v_ids || v_assento.id;
    end loop;
  end loop;

  if coalesce(array_length(v_ids, 1), 0) > 0 then
    -- Trava os lugares (sempre na mesma ordem) e confere que ninguém os pegou.
    perform 1 from public.ticketeria_assentos a where a.id = any(v_ids) order by a.id for update;
    if exists (
      select 1 from public.ticketeria_pedido_assentos pa join public.ticketeria_pedidos p on p.id = pa.pedido_id
      where pa.assento_id = any(v_ids) and pa.sessao_id = p_sessao and pa.pedido_id <> v_pedido
        and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
    ) then
      raise exception 'lugar_ocupado' using errcode = 'check_violation';
    end if;
    insert into public.ticketeria_pedido_assentos (organization_id, pedido_id, sessao_id, ingresso_id, assento_id, fileira, numero)
    select v_org, v_pedido, p_sessao, (e ->> 'ingresso_id')::uuid, a.id, a.fileira, a.numero
    from jsonb_array_elements(p_lugares) e
    cross join lateral jsonb_array_elements(e -> 'assentos') l
    join public.ticketeria_ingressos i on i.id = (e ->> 'ingresso_id')::uuid
    join public.ticketeria_assentos a on a.setor_id = i.setor_id and a.fileira = upper(btrim(l ->> 'fileira')) and a.numero = (l ->> 'numero')::integer;
    -- Pedido que já nasceu pago (gratuito ou cupom de 100%): os ingressos já foram emitidos, agora ganham o lugar.
    perform public.fn_ticketeria_lugares_aos_ingressos(v_pedido);
  end if;
  return v_reserva;
end;
$$;

-- ─── Mapa do setor: ordem das fileiras e lugares vendidos ───────────────────

create or replace function public.fn_ticketeria_mapa_do_setor(p_setor uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by length(f.fileira), f.fileira), '[]'::jsonb)
  from (
    select a.fileira, jsonb_agg(jsonb_build_object('numero', a.numero, 'bloqueado', a.bloqueado) order by a.numero) as assentos
    from public.ticketeria_assentos a where a.setor_id = p_setor group by a.fileira
  ) f;
$$;

-- Lugar de pedido pago ou reserva no prazo, de sessão por vir, que o mapa novo tiraria ou bloquearia.
create or replace function public.fn_ticketeria_lugar_vendido_no_mapa(p_setor uuid, p_fileiras jsonb)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ticketeria_assentos a
    join public.ticketeria_pedido_assentos pa on pa.assento_id = a.id
    join public.ticketeria_pedidos p on p.id = pa.pedido_id
    join public.ticketeria_sessoes s on s.id = pa.sessao_id
    where a.setor_id = p_setor and s.inicio > now() and s.cancelada_em is null
      and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
      and not exists (
        select 1 from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
        where upper(btrim(f ->> 'nome')) = a.fileira and (x ->> 'numero')::integer = a.numero and coalesce((x ->> 'bloqueado')::boolean, false) = false
      )
  );
$$;

create or replace function public.fn_ticketeria_salvar_mapa(p_setor uuid, p_fileiras jsonb, p_corredor boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_setor record;
  v_fileira jsonb;
  v_assento jsonb;
  v_nome text;
  v_nomes text[] := '{}';
  v_numeros integer[];
  v_numero integer;
  v_total integer := 0;
  v_livres bigint;
  v_bloqueados bigint;
  v_evento uuid;
begin
  select s.id, s.organization_id, s.numerado, s.arquivado into v_setor from public.ticketeria_setores s where s.id = p_setor;
  if v_setor.id is null then
    raise exception 'setor_inexistente' using errcode = 'P0002';
  end if;
  if v_setor.arquivado then
    raise exception 'setor_arquivado' using errcode = 'check_violation';
  end if;
  if p_fileiras is null or jsonb_typeof(p_fileiras) <> 'array' or jsonb_array_length(p_fileiras) not between 1 and 60 then
    raise exception 'mapa_invalido' using errcode = 'check_violation';
  end if;
  for v_fileira in select * from jsonb_array_elements(p_fileiras) loop
    if jsonb_typeof(v_fileira) <> 'object' or jsonb_typeof(v_fileira -> 'assentos') is distinct from 'array' or jsonb_array_length(v_fileira -> 'assentos') not between 1 and 80 then
      raise exception 'mapa_invalido' using errcode = 'check_violation';
    end if;
    v_nome := upper(btrim(coalesce(v_fileira ->> 'nome', '')));
    if v_nome !~ '^[A-Z0-9]{1,4}$' or v_nome = any(v_nomes) then
      raise exception 'mapa_invalido' using errcode = 'check_violation';
    end if;
    v_nomes := v_nomes || v_nome;
    v_numeros := '{}';
    for v_assento in select * from jsonb_array_elements(v_fileira -> 'assentos') loop
      if jsonb_typeof(v_assento) <> 'object' or (v_assento ->> 'numero') !~ '^[0-9]{1,3}$' or jsonb_typeof(v_assento -> 'bloqueado') not in ('boolean', 'null') then
        raise exception 'mapa_invalido' using errcode = 'check_violation';
      end if;
      v_numero := (v_assento ->> 'numero')::integer;
      if v_numero not between 1 and 999 or v_numero = any(v_numeros) then
        raise exception 'mapa_invalido' using errcode = 'check_violation';
      end if;
      v_numeros := v_numeros || v_numero;
      v_total := v_total + 1;
    end loop;
  end loop;
  if v_total > 5000 then
    raise exception 'mapa_invalido' using errcode = 'check_violation';
  end if;

  -- Um setor que ainda não era numerado e já vendeu para uma sessão por vir: os ingressos vendidos não têm lugar.
  if not v_setor.numerado and exists (
    select 1 from public.ticketeria_pedido_itens pi
    join public.ticketeria_ingressos i on i.id = pi.ingresso_id
    join public.ticketeria_pedidos p on p.id = pi.pedido_id
    join public.ticketeria_sessoes s on s.id = p.sessao_id
    where i.setor_id = p_setor and s.inicio > now() and s.cancelada_em is null
      and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
  ) then
    raise exception 'setor_com_vendas' using errcode = 'check_violation';
  end if;
  -- Um lugar vendido para uma sessão por vir não sai do mapa nem se bloqueia.
  if public.fn_ticketeria_lugar_vendido_no_mapa(p_setor, p_fileiras) then
    raise exception 'lugar_vendido' using errcode = 'check_violation';
  end if;

  -- Os lugares que sumiram do mapa saem; os outros mantêm a identidade (e só mudam o bloqueio).
  delete from public.ticketeria_assentos a
  where a.setor_id = p_setor and not exists (
    select 1 from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
    where upper(btrim(f ->> 'nome')) = a.fileira and (x ->> 'numero')::integer = a.numero
  );
  insert into public.ticketeria_assentos (organization_id, setor_id, fileira, numero, bloqueado)
  select v_setor.organization_id, p_setor, upper(btrim(f ->> 'nome')), (x ->> 'numero')::integer, coalesce((x ->> 'bloqueado')::boolean, false)
  from jsonb_array_elements(p_fileiras) f, jsonb_array_elements(f -> 'assentos') x
  on conflict (setor_id, fileira, numero) do update set bloqueado = excluded.bloqueado;

  select count(*) filter (where not a.bloqueado), count(*) filter (where a.bloqueado) into v_livres, v_bloqueados from public.ticketeria_assentos a where a.setor_id = p_setor;
  if v_livres = 0 then
    raise exception 'mapa_sem_lugares' using errcode = 'check_violation';
  end if;

  update public.ticketeria_setores set numerado = true, corredor_no_meio = coalesce(p_corredor, true), lugares = v_livres::integer where id = p_setor;

  -- A oferta dos lotes de cada evento neste setor tem de caber nos lugares do mapa.
  for v_evento in select distinct i.evento_id from public.ticketeria_ingressos i where i.setor_id = p_setor and not i.arquivado loop
    perform public.fn_ticketeria_conferir_lugares(v_evento, p_setor);
  end loop;

  return jsonb_build_object('lugares', v_livres, 'bloqueados', v_bloqueados, 'fileiras', jsonb_array_length(p_fileiras));
end;
$$;

-- O gatilho do setor: numerado sem mapa é recusado, `lugares` vem do mapa, e desligar "numerado" com lugares vendidos para sessão por vir também.
create or replace function public.fn_ticketeria_setor_numerado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total bigint;
  v_livres bigint;
begin
  if tg_op = 'UPDATE' and old.numerado and not new.numerado and exists (
    select 1 from public.ticketeria_pedido_assentos pa
    join public.ticketeria_pedidos p on p.id = pa.pedido_id
    join public.ticketeria_sessoes s on s.id = pa.sessao_id
    join public.ticketeria_ingressos i on i.id = pa.ingresso_id
    where i.setor_id = new.id and s.inicio > now() and s.cancelada_em is null
      and (p.situacao = 'pago' or (p.situacao = 'aguardando_pagamento' and p.reservado_ate > now()))
  ) then
    raise exception 'setor_com_lugares_vendidos' using errcode = 'check_violation';
  end if;
  if new.numerado then
    select count(*), count(*) filter (where not a.bloqueado) into v_total, v_livres from public.ticketeria_assentos a where a.setor_id = new.id;
    if v_total = 0 then
      raise exception 'mapa_vazio' using errcode = 'check_violation';
    end if;
    if v_livres = 0 then
      raise exception 'mapa_sem_lugares' using errcode = 'check_violation';
    end if;
    new.lugares := v_livres;
  end if;
  return new;
end;
$$;

-- ─── Permissões ─────────────────────────────────────────────────────────────

revoke execute on function public.fn_ticketeria_lugares_livres_do_setor(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_livres(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_lugares_aos_ingressos(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_emitir_ingressos(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_ingressos_do_pedido(uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_mapa_do_setor(uuid) from public, anon;
revoke execute on function public.fn_ticketeria_lugar_vendido_no_mapa(uuid, jsonb) from public, anon;
revoke execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) from public, anon;
revoke execute on function public.fn_ticketeria_setor_numerado() from public, anon, authenticated;
grant execute on function public.fn_ticketeria_lugares_livres_do_setor(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_mapa_da_sessao(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_livres(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_lugares_aos_ingressos(uuid) to service_role;
grant execute on function public.fn_ticketeria_emitir_ingressos(uuid) to service_role;
grant execute on function public.fn_ticketeria_ingressos_do_pedido(uuid) to service_role;
grant execute on function public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb) to service_role;
grant execute on function public.fn_ticketeria_mapa_do_setor(uuid) to authenticated;
grant execute on function public.fn_ticketeria_lugar_vendido_no_mapa(uuid, jsonb) to authenticated;
grant execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) to authenticated;

revoke all on public.ticketeria_pedido_assentos from anon, authenticated;
grant select on public.ticketeria_pedido_assentos to authenticated;
