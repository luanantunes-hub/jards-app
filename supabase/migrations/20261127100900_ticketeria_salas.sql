-- Salas: um espaço pode ter mais de uma sala (um cinema com 2, 4 ou 6; um centro cultural com teatro e sala menor), cada uma com o seu nome e, mais adiante, o seu mapa.
-- Desenho: docs/acoes-futuras/estudos/ticketeria-mapa-de-assentos-avancado.md (seção 5.5, fase M0). O Luan decidiu em 22/11/2026.
--
--   Espaço (ticketeria_locais)  →  Sala (ticketeria_salas, nova)  →  Setor  →  Lugar
--
-- ticketeria_salas: nome (único dentro do espaço), ordem, arquivado. Todo espaço tem pelo menos uma sala ativa: os espaços que já existem ganham a "Sala única"
--   e os novos a ganham de um gatilho (quem tem uma sala só nunca vê a palavra "sala" na tela). Não se arquiva nem se apaga a última sala ativa (sala_unica).
-- ticketeria_setores.sala_id e ticketeria_sessoes.sala_id: o setor e a sessão são de uma sala (do mesmo espaço e da mesma organização: sala_incoerente). Sem
--   dizer a sala, entra a primeira sala ativa do espaço: tudo o que já grava setor ou sessão sem falar em sala (o Começar, a tela de sessões) continua funcionando.
-- A venda passa a conferir a SALA, e não o espaço: o ingresso (pelo setor) tem de ser da sala da sessão. fn_ticketeria_reservar (que as versões com cupom e com
--   lugares chamam), fn_ticketeria_espera_entrar e fn_ticketeria_mapa_da_sessao. Com uma sala só por espaço o resultado é o mesmo de antes.
--
-- Preencher a sala das sessões e dos setores que já existem não dispara aviso nenhum: o gatilho de webhook de sessão só olha a coluna cancelada_em. O updated_at
-- das linhas se renova (é o que o gatilho de updated_at faz em qualquer atualização).
-- Pendente, à parte, e só com o "sim" do Luan (é um DROP): o nome do setor é único por ESPAÇO (ticketeria_setores_nome_key); com várias salas, duas delas poderão ter
-- um setor "Plateia" cada uma. Esta migration já cria a unicidade por SALA (ticketeria_setores_sala_nome_key); a antiga sai numa migration própria.
-- Expansão: tabela nova, colunas novas e create or replace; sem DROP; aditiva e reaplicável.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_salas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  local_id uuid not null references public.ticketeria_locais (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  arquivado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticketeria_salas_nome_key unique (local_id, nome),
  constraint ticketeria_salas_nome_check check (char_length(btrim(nome)) between 1 and 120),
  constraint ticketeria_salas_ordem_check check (ordem between 0 and 1000)
);

create index if not exists ticketeria_salas_org_idx on public.ticketeria_salas (organization_id);
create index if not exists ticketeria_salas_local_idx on public.ticketeria_salas (local_id, ordem);

alter table public.ticketeria_salas enable row level security;

do $$
declare
  v_tabela text := 'ticketeria_salas';
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
end
$$;

revoke all on public.ticketeria_salas from anon, authenticated;
grant select, insert, update, delete on public.ticketeria_salas to authenticated;

comment on table public.ticketeria_salas is 'Sala de um espaço (um cinema tem várias). Todo espaço tem ao menos uma sala ativa; o setor e a sessão são de uma sala.';

-- Os espaços que já existem ganham a sala padrão.
insert into public.ticketeria_salas (organization_id, local_id, nome, ordem)
select lo.organization_id, lo.id, 'Sala única', 0 from public.ticketeria_locais lo
where not exists (select 1 from public.ticketeria_salas sa where sa.local_id = lo.id);

alter table public.ticketeria_setores add column if not exists sala_id uuid references public.ticketeria_salas (id);
alter table public.ticketeria_sessoes add column if not exists sala_id uuid references public.ticketeria_salas (id);

create index if not exists ticketeria_setores_sala_idx on public.ticketeria_setores (sala_id);
create index if not exists ticketeria_sessoes_sala_idx on public.ticketeria_sessoes (sala_id);

-- O nome do setor também é único dentro da sala (a unicidade antiga, por espaço, sai à parte, com o "sim" do Luan).
create unique index if not exists ticketeria_setores_sala_nome_key on public.ticketeria_setores (sala_id, nome);

-- ─── Os gatilhos ────────────────────────────────────────────────────────────

create or replace function public.fn_ticketeria_sala_nova_do_local()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.ticketeria_salas (organization_id, local_id, nome, ordem) values (new.organization_id, new.id, 'Sala única', 0)
  on conflict (local_id, nome) do nothing;
  return new;
end;
$$;

create or replace trigger ticketeria_locais_sala_padrao
  after insert on public.ticketeria_locais
  for each row execute function public.fn_ticketeria_sala_nova_do_local();

create or replace function public.fn_ticketeria_sala_coerencia()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sala record;
begin
  -- Sem sala dita, ou trocou de espaço sem trocar de sala: entra a primeira sala ativa do espaço.
  if new.sala_id is not null and tg_op = 'UPDATE' and new.local_id is distinct from old.local_id and new.sala_id is not distinct from old.sala_id then
    new.sala_id := null;
  end if;
  if new.sala_id is null then
    select sa.id into new.sala_id from public.ticketeria_salas sa
      where sa.local_id = new.local_id and sa.organization_id = new.organization_id and not sa.arquivado order by sa.ordem, sa.created_at, sa.id limit 1;
    if new.sala_id is null then
      raise exception 'sala_ausente' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  select sa.local_id, sa.organization_id, sa.arquivado into v_sala from public.ticketeria_salas sa where sa.id = new.sala_id;
  if v_sala.local_id is null or v_sala.local_id <> new.local_id or v_sala.organization_id <> new.organization_id then
    raise exception 'sala_incoerente' using errcode = 'check_violation';
  end if;
  if v_sala.arquivado and (tg_op = 'INSERT' or new.sala_id is distinct from old.sala_id) then
    raise exception 'sala_arquivada' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_setores_sala_coerencia
  before insert or update of organization_id, local_id, sala_id on public.ticketeria_setores
  for each row execute function public.fn_ticketeria_sala_coerencia();
create or replace trigger ticketeria_sessoes_sala_coerencia
  before insert or update of organization_id, local_id, sala_id on public.ticketeria_sessoes
  for each row execute function public.fn_ticketeria_sala_coerencia();

-- A sala é do espaço e da organização dele, e não muda de espaço; a última sala ativa não se arquiva nem se apaga.
create or replace function public.fn_ticketeria_sala_guarda()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    -- Apagar o espaço leva as salas junto (o espaço já não existe nesse ponto): vale.
    if exists (select 1 from public.ticketeria_locais lo where lo.id = old.local_id) and not old.arquivado
       and not exists (select 1 from public.ticketeria_salas sa where sa.local_id = old.local_id and sa.id <> old.id and not sa.arquivado) then
      raise exception 'sala_unica' using errcode = 'check_violation';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' or new.local_id is distinct from old.local_id or new.organization_id is distinct from old.organization_id then
    if tg_op = 'UPDATE' then
      raise exception 'sala_nao_muda_de_espaco' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from public.ticketeria_locais lo where lo.id = new.local_id and lo.organization_id = new.organization_id) then
      raise exception 'espaco_de_outra_organizacao' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.arquivado and not old.arquivado
     and not exists (select 1 from public.ticketeria_salas sa where sa.local_id = new.local_id and sa.id <> new.id and not sa.arquivado) then
    raise exception 'sala_unica' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace trigger ticketeria_salas_guarda
  before insert or update or delete on public.ticketeria_salas
  for each row execute function public.fn_ticketeria_sala_guarda();
create or replace trigger ticketeria_salas_updated_at
  before update on public.ticketeria_salas
  for each row execute function public.fn_ticketeria_updated_at();

revoke execute on function public.fn_ticketeria_sala_nova_do_local() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_sala_coerencia() from public, anon, authenticated;
revoke execute on function public.fn_ticketeria_sala_guarda() from public, anon, authenticated;

-- O que já existe vai para a sala padrão do seu espaço (o gatilho de coerência acima preenche; o update só o dispara).
update public.ticketeria_setores st set sala_id = (select sa.id from public.ticketeria_salas sa where sa.local_id = st.local_id order by sa.ordem, sa.created_at, sa.id limit 1) where st.sala_id is null;
update public.ticketeria_sessoes se set sala_id = (select sa.id from public.ticketeria_salas sa where sa.local_id = se.local_id order by sa.ordem, sa.created_at, sa.id limit 1) where se.sala_id is null;

alter table public.ticketeria_setores alter column sala_id set not null;
alter table public.ticketeria_sessoes alter column sala_id set not null;

comment on column public.ticketeria_setores.sala_id is 'A sala do setor (do mesmo espaço). Sem dizer, entra a primeira sala ativa do espaço.';
comment on column public.ticketeria_sessoes.sala_id is 'A sala da sessão (do mesmo espaço). Sem dizer, entra a primeira sala ativa do espaço. A venda confere que o setor do ingresso é desta sala.';

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
  select s.id, s.organization_id, s.evento_id, s.local_id, s.sala_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
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
    select i.id, i.evento_id, i.setor_id, i.publico, i.arquivado, i.limite_por_pedido, s.local_id, s.sala_id
      into v_ingresso
      from public.ticketeria_ingressos i join public.ticketeria_setores s on s.id = i.setor_id
      where i.id = (v_item ->> 'ingresso_id')::uuid;
    if v_ingresso.id is null or v_ingresso.evento_id <> v_evento.id or not v_ingresso.publico or v_ingresso.arquivado then
      raise exception 'ingresso_indisponivel' using errcode = 'check_violation';
    end if;
    if v_ingresso.sala_id <> v_sessao.sala_id then
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

CREATE OR REPLACE FUNCTION public.fn_ticketeria_espera_entrar(p_sessao uuid, p_ingresso uuid, p_nome text, p_email text, p_quantidade integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sessao record;
  v_evento record;
  v_ingresso record;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  delete from public.ticketeria_espera e using public.ticketeria_sessoes s where s.id = e.sessao_id and s.inicio < now() - interval '1 day';

  select s.id, s.organization_id, s.evento_id, s.local_id, s.sala_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    raise exception 'sessao_indisponivel' using errcode = 'check_violation';
  end if;
  select e.situacao into v_evento from public.ticketeria_eventos e where e.id = v_sessao.evento_id;
  if v_evento.situacao is distinct from 'publicado' then
    raise exception 'evento_nao_publicado' using errcode = 'check_violation';
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, s.local_id, s.sala_id into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores s on s.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or not v_ingresso.publico or v_ingresso.arquivado then
    raise exception 'ingresso_indisponivel' using errcode = 'check_violation';
  end if;
  if v_ingresso.sala_id <> v_sessao.sala_id then
    raise exception 'ingresso_de_outro_local' using errcode = 'check_violation';
  end if;
  if p_nome is null or char_length(btrim(p_nome)) not between 1 and 120 or char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'comprador_invalido' using errcode = 'check_violation';
  end if;
  if p_quantidade is null or p_quantidade not between 1 and 50 then
    raise exception 'quantidade_invalida' using errcode = 'check_violation';
  end if;
  if public.fn_ticketeria_livres(p_sessao, p_ingresso) > 0 then
    raise exception 'ainda_ha_lugar' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.ticketeria_espera e where e.sessao_id = p_sessao and e.ingresso_id = p_ingresso and e.email = v_email) then
    return 'ja_na_lista';
  end if;
  if (select count(*) from public.ticketeria_espera e where e.sessao_id = p_sessao) >= 500 then
    raise exception 'lista_cheia' using errcode = 'check_violation';
  end if;
  insert into public.ticketeria_espera (organization_id, sessao_id, ingresso_id, nome, email, quantidade)
  values (v_sessao.organization_id, p_sessao, p_ingresso, btrim(p_nome), v_email, p_quantidade)
  on conflict (sessao_id, ingresso_id, email) do nothing
  returning id into v_id;
  return case when v_id is null then 'ja_na_lista' else 'entrou' end;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ticketeria_mapa_da_sessao(p_sessao uuid, p_ingresso uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_sessao record;
  v_ingresso record;
begin
  select s.evento_id, s.local_id, s.sala_id, s.inicio, s.cancelada_em into v_sessao from public.ticketeria_sessoes s where s.id = p_sessao;
  if v_sessao.evento_id is null or v_sessao.cancelada_em is not null or v_sessao.inicio <= now() then
    return null;
  end if;
  select i.id, i.evento_id, i.publico, i.arquivado, st.id as setor_id, st.nome as setor, st.numerado, st.corredor_no_meio, st.local_id, st.sala_id
    into v_ingresso
    from public.ticketeria_ingressos i join public.ticketeria_setores st on st.id = i.setor_id where i.id = p_ingresso;
  if v_ingresso.id is null or v_ingresso.evento_id <> v_sessao.evento_id or v_ingresso.sala_id <> v_sessao.sala_id or not v_ingresso.publico or v_ingresso.arquivado or not v_ingresso.numerado then
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
$function$;
