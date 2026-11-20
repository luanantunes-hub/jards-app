-- Ticketeria: assentos marcados, etapa 1 — o mapa do setor.
--
-- Um setor pode ter "lugares numerados": uma grade de fileiras (A, B, C...) com lugares 1, 2, 3... que o produtor monta e onde bloqueia lugares que não vão à
-- venda (cadeira de som e luz, lugar da produção). Nesta etapa só se monta o mapa; a escolha dos lugares na compra e o lugar no ingresso vêm nas próximas.
--
-- ticketeria_setores ganha `numerado` (padrão falso: o setor segue como é, só com a quantidade de lugares) e `corredor_no_meio` (a tela desenha um corredor
-- no meio de cada fileira). Num setor numerado `lugares` NÃO se digita: é a contagem dos lugares não bloqueados do mapa (o banco a refaz sempre).
-- ticketeria_assentos: um por lugar do mapa (setor, fileira, número, bloqueado). Quem lê a Ticketeria lê; quem a edita grava.
--
-- Funções (quem chama precisa das regras de acesso normais: security invoker):
--   fn_ticketeria_salvar_mapa(setor, fileiras, corredor) → grava o mapa inteiro de uma vez (os lugares que continuam mantêm a identidade), liga `numerado` e
--     refaz `lugares`. fileiras = [{ nome, assentos: [{ numero, bloqueado }] }]. Recusa: setor_inexistente, setor_arquivado, mapa_invalido (formato, fileira
--     repetida, lugar repetido, mais de 60 fileiras, 80 lugares por fileira ou 5.000 no setor), mapa_sem_lugares (tudo bloqueado), setor_com_vendas (o setor
--     ainda não era numerado e tem pedido pago ou reserva no prazo para uma sessão por vir: esses ingressos não têm lugar) e lugares_excedidos (a oferta dos
--     lotes do setor não cabe nos lugares do mapa);
--   fn_ticketeria_mapa_do_setor(setor) → as fileiras e os lugares do mapa, em ordem, em um só JSON.
-- Trigger do setor: ligar `numerado` sem mapa é recusado (mapa_vazio) e `lugares` de setor numerado vem do mapa.
--
-- Expansão: colunas com valor padrão e tabela nova e vazia. Aditiva e reaplicável; sem DROP.

set local lock_timeout = '10s';

alter table public.ticketeria_setores add column if not exists numerado boolean not null default false;
alter table public.ticketeria_setores add column if not exists corredor_no_meio boolean not null default true;

create table if not exists public.ticketeria_assentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  setor_id uuid not null references public.ticketeria_setores (id) on delete cascade,
  fileira text not null,
  numero integer not null,
  bloqueado boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ticketeria_assentos_fileira_check check (fileira ~ '^[A-Z0-9]{1,4}$'),
  constraint ticketeria_assentos_numero_check check (numero between 1 and 999),
  constraint ticketeria_assentos_lugar_key unique (setor_id, fileira, numero)
);

create index if not exists ticketeria_assentos_org_idx on public.ticketeria_assentos (organization_id);

-- ─── O setor numerado ───────────────────────────────────────────────────────

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

create or replace trigger ticketeria_setores_numerado
  before insert or update of numerado, lugares on public.ticketeria_setores
  for each row execute function public.fn_ticketeria_setor_numerado();

-- ─── Salvar e ler o mapa ────────────────────────────────────────────────────

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

create or replace function public.fn_ticketeria_mapa_do_setor(p_setor uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object('nome', f.fileira, 'assentos', f.assentos) order by f.ordem, f.fileira), '[]'::jsonb)
  from (
    select a.fileira, min(a.created_at) as ordem,
      jsonb_agg(jsonb_build_object('numero', a.numero, 'bloqueado', a.bloqueado) order by a.numero) as assentos
    from public.ticketeria_assentos a where a.setor_id = p_setor group by a.fileira
  ) f;
$$;

-- ─── Regras de acesso ───────────────────────────────────────────────────────

alter table public.ticketeria_assentos enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_assentos' and policyname = 'ticketeria_assentos: le') then
    create policy "ticketeria_assentos: le" on public.ticketeria_assentos for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'ler'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_assentos' and policyname = 'ticketeria_assentos: insere') then
    create policy "ticketeria_assentos: insere" on public.ticketeria_assentos for insert to authenticated with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_assentos' and policyname = 'ticketeria_assentos: edita') then
    create policy "ticketeria_assentos: edita" on public.ticketeria_assentos for update to authenticated
      using (public.auth_ticketeria_pode(organization_id, 'editar')) with check (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_assentos' and policyname = 'ticketeria_assentos: apaga') then
    create policy "ticketeria_assentos: apaga" on public.ticketeria_assentos for delete to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke execute on function public.fn_ticketeria_setor_numerado() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) from public, anon;
revoke execute on function public.fn_ticketeria_mapa_do_setor(uuid) from public, anon;
grant execute on function public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean) to authenticated;
grant execute on function public.fn_ticketeria_mapa_do_setor(uuid) to authenticated;

revoke all on public.ticketeria_assentos from anon, authenticated;
grant select, insert, update, delete on public.ticketeria_assentos to authenticated;
