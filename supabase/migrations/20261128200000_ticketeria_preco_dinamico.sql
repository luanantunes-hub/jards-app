-- Ticketeria: PREÇO DINÂMICO POR ADESÃO (plano, seção 11, fase P2, parte a: o banco). NÃO LIGADO a ninguém: nasce desligado em todo evento.
--
-- O produtor ADERE por evento (ticketeria_preco_dinamico): piso e teto sobre o preço-base, quanto o preço pode mudar por vez (passo) e de quanto em quanto tempo (intervalo). Cada sessão por vir tem um FATOR
-- (ticketeria_preco_dinamico_estado, em pontos-base: 10000 = o preço-base, 11000 = 10% acima), que um atualizador do servidor move a cada intervalo, dentro do piso e do teto, a partir da direção que o quadro de
-- precificação sugere (P1). O preço que vale (fn_ticketeria_preco_do_lote) passa a ser: o preço da sessão (P0) ou o do lote, vezes o fator, SÓ com a adesão ativa. Sem adesão ativa, nada muda: a conta é a
-- mesma de antes (o fator vale 10000).
--
--   - ticketeria_preco_dinamico: a regra do evento (uma por evento). Ativar exige o aceite (quando e qual versão do texto); o aceite é gravado por fn_ticketeria_preco_dinamico_definir com o usuário que aceitou;
--   - ticketeria_preco_dinamico_estado: o fator de cada sessão (um por sessão); só o servidor escreve;
--   - ticketeria_preco_dinamico_historico: cada mudança de fator (de quanto, para quanto, a direção e o motivo); só se escreve pela função; ninguém altera;
--   - fn_ticketeria_preco_dinamico_definir e fn_ticketeria_preco_dinamico_registrar: SÓ o servidor chama (a rota confere quem é o usuário e se a plataforma liberou o recurso). Desativar volta todos os fatores do evento a 10000;
--   - fn_ticketeria_preco_do_lote: mesma assinatura (create or replace), agora com o fator. A meia vale a metade do preço que vale da inteira (arredondada, nunca abaixo de 1 centavo); gratuito e cortesia seguem em zero.
--
-- Aditiva e reaplicável: não apaga nem renomeia nada.

-- ─── A regra do evento ───────────────────────────────────────────────────────
create table if not exists public.ticketeria_preco_dinamico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evento_id uuid not null references public.ticketeria_eventos (id) on delete cascade,
  ativo boolean not null default false,
  piso_bps integer not null default -2000,
  teto_bps integer not null default 3000,
  passo_bps integer not null default 1000,
  intervalo_minutos integer not null default 360,
  aceite_em timestamptz,
  aceite_por uuid references auth.users (id) on delete set null,
  aceite_versao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_preco_dinamico_evento_unico unique (evento_id),
  constraint ticketeria_preco_dinamico_piso_check check (piso_bps between -9000 and 0),
  constraint ticketeria_preco_dinamico_teto_check check (teto_bps between 0 and 100000),
  constraint ticketeria_preco_dinamico_passo_check check (passo_bps between 100 and 5000),
  constraint ticketeria_preco_dinamico_intervalo_check check (intervalo_minutos between 30 and 1440),
  constraint ticketeria_preco_dinamico_aceite_check check (not ativo or (aceite_em is not null and aceite_versao is not null))
);
create index if not exists ticketeria_preco_dinamico_org_idx on public.ticketeria_preco_dinamico (organization_id);

-- ─── O fator de cada sessão ──────────────────────────────────────────────────
create table if not exists public.ticketeria_preco_dinamico_estado (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  fator_bps integer not null default 10000,
  direcao text not null default 'manter',
  motivo text,
  atualizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ticketeria_preco_dinamico_estado_sessao_unico unique (sessao_id),
  constraint ticketeria_preco_dinamico_estado_fator_check check (fator_bps between 1000 and 200000),
  constraint ticketeria_preco_dinamico_estado_direcao_check check (direcao in ('subir', 'manter', 'baixar', 'sem_comparacao', 'desativado')),
  constraint ticketeria_preco_dinamico_estado_motivo_check check (motivo is null or char_length(motivo) <= 300)
);
create index if not exists ticketeria_preco_dinamico_estado_org_idx on public.ticketeria_preco_dinamico_estado (organization_id);

create table if not exists public.ticketeria_preco_dinamico_historico (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sessao_id uuid not null references public.ticketeria_sessoes (id) on delete cascade,
  fator_anterior_bps integer not null,
  fator_novo_bps integer not null,
  direcao text not null,
  motivo text,
  quando timestamptz not null default clock_timestamp(),
  constraint ticketeria_preco_dinamico_historico_direcao_check check (direcao in ('subir', 'manter', 'baixar', 'sem_comparacao', 'desativado')),
  constraint ticketeria_preco_dinamico_historico_motivo_check check (motivo is null or char_length(motivo) <= 300)
);
create index if not exists ticketeria_preco_dinamico_historico_org_idx on public.ticketeria_preco_dinamico_historico (organization_id);
create index if not exists ticketeria_preco_dinamico_historico_sessao_idx on public.ticketeria_preco_dinamico_historico (sessao_id, quando desc);

-- ─── Coerência: a regra e o fator são da mesma organização do evento e da sessão ─────────────────────
create or replace function public.fn_ticketeria_preco_dinamico_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.evento_id is distinct from old.evento_id) then
    raise exception 'preco_dinamico_nao_muda_de_lugar' using errcode = 'check_violation';
  end if;
  select e.organization_id into v_org from public.ticketeria_eventos e where e.id = new.evento_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'preco_dinamico_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.fn_ticketeria_preco_dinamico_estado_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
begin
  if tg_op = 'UPDATE' and (new.organization_id is distinct from old.organization_id or new.sessao_id is distinct from old.sessao_id) then
    raise exception 'preco_dinamico_nao_muda_de_lugar' using errcode = 'check_violation';
  end if;
  select s.organization_id into v_org from public.ticketeria_sessoes s where s.id = new.sessao_id;
  if v_org is null or v_org <> new.organization_id then
    raise exception 'preco_dinamico_de_outra_organizacao' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_preco_dinamico_coerencia
  before insert or update on public.ticketeria_preco_dinamico
  for each row execute function public.fn_ticketeria_preco_dinamico_coerencia();
create or replace trigger ticketeria_preco_dinamico_estado_coerencia
  before insert or update on public.ticketeria_preco_dinamico_estado
  for each row execute function public.fn_ticketeria_preco_dinamico_estado_coerencia();
create or replace trigger ticketeria_preco_dinamico_updated_at
  before update on public.ticketeria_preco_dinamico
  for each row execute function public.fn_ticketeria_updated_at();

-- ─── Definir a adesão (só o servidor) ────────────────────────────────────────
-- Ativar grava o aceite (quando, quem e a versão do texto). Desativar volta todos os fatores do evento a 10000 (com o registro no histórico).
create or replace function public.fn_ticketeria_preco_dinamico_definir(p_evento uuid, p_ativo boolean, p_piso integer, p_teto integer, p_passo integer, p_intervalo integer, p_aceite_versao text, p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_regra public.ticketeria_preco_dinamico;
  v_estado record;
begin
  select e.organization_id into v_org from public.ticketeria_eventos e where e.id = p_evento;
  if v_org is null then
    raise exception 'evento_nao_encontrado' using errcode = 'check_violation';
  end if;
  if p_ativo and (p_aceite_versao is null or btrim(p_aceite_versao) = '' or p_usuario is null) then
    raise exception 'aceite_obrigatorio' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_preco_dinamico (organization_id, evento_id, ativo, piso_bps, teto_bps, passo_bps, intervalo_minutos, aceite_em, aceite_por, aceite_versao)
  values (v_org, p_evento, p_ativo, p_piso, p_teto, p_passo, p_intervalo, case when p_ativo then now() end, case when p_ativo then p_usuario end, case when p_ativo then btrim(p_aceite_versao) end)
  on conflict (evento_id) do update set
    ativo = excluded.ativo, piso_bps = excluded.piso_bps, teto_bps = excluded.teto_bps, passo_bps = excluded.passo_bps, intervalo_minutos = excluded.intervalo_minutos,
    aceite_em = case when excluded.ativo then excluded.aceite_em else ticketeria_preco_dinamico.aceite_em end,
    aceite_por = case when excluded.ativo then excluded.aceite_por else ticketeria_preco_dinamico.aceite_por end,
    aceite_versao = case when excluded.ativo then excluded.aceite_versao else ticketeria_preco_dinamico.aceite_versao end
  returning * into v_regra;
  if not p_ativo then
    for v_estado in
      select e.sessao_id, e.fator_bps from public.ticketeria_preco_dinamico_estado e join public.ticketeria_sessoes s on s.id = e.sessao_id where s.evento_id = p_evento and e.fator_bps <> 10000
    loop
      insert into public.ticketeria_preco_dinamico_historico (organization_id, sessao_id, fator_anterior_bps, fator_novo_bps, direcao, motivo)
      values (v_org, v_estado.sessao_id, v_estado.fator_bps, 10000, 'desativado', 'O produtor desligou o preço dinâmico: volta ao preço-base.');
      update public.ticketeria_preco_dinamico_estado set fator_bps = 10000, direcao = 'desativado', motivo = 'O produtor desligou o preço dinâmico.', atualizado_em = now() where sessao_id = v_estado.sessao_id;
    end loop;
  end if;
  return jsonb_build_object('evento_id', v_regra.evento_id, 'ativo', v_regra.ativo, 'piso_bps', v_regra.piso_bps, 'teto_bps', v_regra.teto_bps, 'passo_bps', v_regra.passo_bps,
    'intervalo_minutos', v_regra.intervalo_minutos, 'aceite_em', v_regra.aceite_em, 'aceite_versao', v_regra.aceite_versao);
end;
$$;

-- ─── Registrar o fator de uma sessão (só o servidor) ─────────────────────────
create or replace function public.fn_ticketeria_preco_dinamico_registrar(p_sessao uuid, p_fator integer, p_direcao text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_anterior integer;
begin
  select s.organization_id into v_org from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_org is null then
    raise exception 'sessao_nao_encontrada' using errcode = 'check_violation';
  end if;
  select e.fator_bps into v_anterior from public.ticketeria_preco_dinamico_estado e where e.sessao_id = p_sessao;
  insert into public.ticketeria_preco_dinamico_estado (organization_id, sessao_id, fator_bps, direcao, motivo, atualizado_em)
  values (v_org, p_sessao, p_fator, p_direcao, left(p_motivo, 300), now())
  -- atualizado_em é a hora da última MUDANÇA de fator (o intervalo conta daí); mudar só a direção ou o motivo não o move.
  on conflict (sessao_id) do update set fator_bps = excluded.fator_bps, direcao = excluded.direcao, motivo = excluded.motivo,
    atualizado_em = case when excluded.fator_bps <> ticketeria_preco_dinamico_estado.fator_bps then now() else ticketeria_preco_dinamico_estado.atualizado_em end;
  if coalesce(v_anterior, 10000) is distinct from p_fator then
    insert into public.ticketeria_preco_dinamico_historico (organization_id, sessao_id, fator_anterior_bps, fator_novo_bps, direcao, motivo)
    values (v_org, p_sessao, coalesce(v_anterior, 10000), p_fator, p_direcao, left(p_motivo, 300));
  end if;
end;
$$;

-- ─── O preço que vale, agora com o fator (a mesma função, mesma assinatura) ──────────────────────
create or replace function public.fn_ticketeria_preco_do_lote(p_lote uuid, p_sessao uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_espelho uuid;
  v_preco integer;
  v_fator integer;
  v_proprio integer;
begin
  select l.espelho_de, l.preco_centavos into v_espelho, v_preco from public.ticketeria_lotes l where l.id = p_lote;
  if not found then
    return null;
  end if;
  -- O fator do preço dinâmico da sessão (10000 = nada muda): só vale com a adesão do evento ativa.
  select e.fator_bps into v_fator
    from public.ticketeria_preco_dinamico_estado e
    join public.ticketeria_sessoes s on s.id = e.sessao_id
    join public.ticketeria_preco_dinamico r on r.evento_id = s.evento_id and r.ativo
   where e.sessao_id = p_sessao;
  v_fator := coalesce(v_fator, 10000);

  if v_espelho is null then
    select p.preco_centavos into v_proprio from public.ticketeria_precos_da_sessao p where p.lote_id = p_lote and p.sessao_id = p_sessao;
    v_preco := coalesce(v_proprio, v_preco);
    if v_fator = 10000 or v_preco = 0 then
      return v_preco;
    end if;
    return greatest(1, round(v_preco::bigint * v_fator / 10000.0)::integer);
  end if;

  -- A meia (o lote espelha o da inteira).
  if v_fator = 10000 then
    select p.preco_centavos into v_proprio from public.ticketeria_precos_da_sessao p where p.lote_id = v_espelho and p.sessao_id = p_sessao;
    if v_proprio is not null then
      return greatest(1, round(v_proprio / 2.0)::integer);
    end if;
    return v_preco;
  end if;
  return greatest(1, round(public.fn_ticketeria_preco_do_lote(v_espelho, p_sessao) / 2.0)::integer);
end;
$$;

-- ─── Acesso: quem lê a Ticketeria lê; ninguém escreve pelo navegador (só o servidor, pelas funções) ─────────
alter table public.ticketeria_preco_dinamico enable row level security;
alter table public.ticketeria_preco_dinamico_estado enable row level security;
alter table public.ticketeria_preco_dinamico_historico enable row level security;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['ticketeria_preco_dinamico', 'ticketeria_preco_dinamico_estado', 'ticketeria_preco_dinamico_historico'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tabela and policyname = v_tabela || ': le') then
      execute format('create policy %I on public.%I for select to authenticated using (public.auth_ticketeria_pode(organization_id, %L))', v_tabela || ': le', v_tabela, 'ler');
    end if;
  end loop;
end $$;

revoke all on public.ticketeria_preco_dinamico, public.ticketeria_preco_dinamico_estado, public.ticketeria_preco_dinamico_historico from anon, authenticated;
grant select on public.ticketeria_preco_dinamico, public.ticketeria_preco_dinamico_estado, public.ticketeria_preco_dinamico_historico to authenticated;

revoke execute on function public.fn_ticketeria_preco_dinamico_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_preco_dinamico_estado_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_preco_dinamico_definir(uuid, boolean, integer, integer, integer, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_preco_dinamico_registrar(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_preco_dinamico_definir(uuid, boolean, integer, integer, integer, integer, text, uuid) to service_role;
-- fn_ticketeria_preco_do_lote foi trocada acima (create or replace): os acessos ficam como estavam (só o servidor), repetidos aqui para valer sozinhos.
revoke execute on function public.fn_ticketeria_preco_do_lote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_preco_do_lote(uuid, uuid) to service_role;
grant execute on function public.fn_ticketeria_preco_dinamico_registrar(uuid, integer, text, text) to service_role;

comment on table public.ticketeria_preco_dinamico is 'A adesão do evento ao preço dinâmico: piso, teto, passo e intervalo sobre o preço-base, e o aceite do produtor. Nasce desligada. Plano da Ticketeria, seção 11 (P2).';
comment on table public.ticketeria_preco_dinamico_estado is 'O fator de preço de cada sessão (10000 = preço-base). Só o servidor escreve.';
comment on table public.ticketeria_preco_dinamico_historico is 'Cada mudança de fator de uma sessão: de quanto, para quanto, a direção e o motivo. Escrita só pela função; ninguém altera.';
