-- =============================================================
--  JARDS — Migração 018: Governança Comercial
--
--  Tabelas: atribuicoes, marcos_captação, comissoes
--  Funções: verificação de exclusividade, score de atividade
-- =============================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────────────

do $$ begin
  create type tipo_exclusividade as enum (
    'livre', 'exclusividade_empresa', 'exclusividade_projeto',
    'time_lock', 'relacao_pessoal', 'compartilhada'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_atribuicao as enum (
    'ativa', 'suspensa', 'expirada', 'transferida', 'cancelada'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_solicitacao as enum (
    'pendente', 'aprovada', 'negada', 'compartilhada'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type status_comissao as enum (
    'prevista', 'aprovada', 'recebida', 'paga'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type marco_status as enum (
    'pendente', 'em_andamento', 'concluido', 'cancelado'
  );
exception when duplicate_object then null;
end $$;

-- ─── TABELA: atribuicoes ────────────────────────────────────────────────────
-- Vínculo entre empresa/captador com regras de exclusividade.

create table if not exists atribuicoes (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references auth.users(id) not null,
  organization_id   uuid references organizations(id),

  empresa_crm_id    uuid references empresas_crm(id) not null,
  projeto_id        uuid references projetos_crm(id),          -- NULL = exclusividade por empresa
  captador_user_id  uuid references auth.users(id) not null,

  tipo              tipo_exclusividade not null default 'livre',
  status            status_atribuicao not null default 'ativa',

  data_inicio       date not null default current_date,
  data_fim          date,                                      -- NULL = sem prazo (time_lock)
  dias_aviso        integer default 90,                        -- dias antes de expirar para alertar

  motivo            text,                                      -- justificativa (relação pessoal)
  aprovado_por      uuid references auth.users(id),           -- quem aprovou (relação pessoal)

  ultimo_avanco     timestamptz,                               -- última atividade registrada
  dias_sem_avanco   integer generated always as (
    case when ultimo_avanco is not null
      then (extract(day from now() - ultimo_avanco))::integer
      else null end
  ) stored,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_atribuicoes_empresa     on atribuicoes(empresa_crm_id);
create index if not exists idx_atribuicoes_captador    on atribuicoes(captador_user_id);
create index if not exists idx_atribuicoes_org         on atribuicoes(organization_id);
create index if not exists idx_atribuicoes_status      on atribuicoes(status);

-- ─── TABELA: solicitacoes_transferencia ──────────────────────────────────────

create table if not exists solicitacoes_transferencia (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references auth.users(id) not null,
  organization_id   uuid references organizations(id),

  atribuicao_id     uuid references atribuicoes(id) on delete cascade,
  solicitante_id    uuid references auth.users(id) not null,
  destinatario_id   uuid references auth.users(id),            -- NULL = solicitação para coordenação

  tipo              status_solicitacao not null default 'pendente',
  motivo            text,
  resposta          text,

  created_at        timestamptz not null default now(),
  responded_at      timestamptz
);

create index if not exists idx_solicitacoes_atribuicao on solicitacoes_transferencia(atribuicao_id);
create index if not exists idx_solicitacoes_solicitante on solicitacoes_transferencia(solicitante_id);

-- ─── TABELA: marcos_captação ────────────────────────────────────────────────
-- Marcos de avanço de cada captação (critério de progressividade).

create table if not exists marcos_captação (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references auth.users(id) not null,
  organization_id   uuid references organizations(id),

  captacao_id       uuid references captacoes(id) on delete cascade,
  nome              text not null,                             -- "Primeiro contato", "Reunião", "Proposta"…
  ordem             integer not null default 0,

  status            marco_status not null default 'pendente',
  data_prevista     date,
  data_conclusao    timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_marcos_captacao on marcos_captação(captacao_id);

-- ─── TABELA: comissoes ──────────────────────────────────────────────────────
-- Pipeline financeira por captação.

create table if not exists comissoes (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid references auth.users(id) not null,
  organization_id   uuid references organizations(id),

  captacao_id       uuid references captacoes(id) on delete cascade,
  captador_user_id  uuid references auth.users(id) not null,

  percentual        numeric(5,2),                              -- ex: 8.00 = 8%
  valor             numeric(15,2),                             -- valor calculado ou informado
  status            status_comissao not null default 'prevista',

  data_prevista     date,
  data_recebimento  date,
  data_pagamento    date,

  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_comissoes_captacao  on comissoes(captacao_id);
create index if not exists idx_comissoes_captador  on comissoes(captador_user_id);
create index if not exists idx_comissoes_status    on comissoes(status);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table atribuicoes                    enable row level security;
alter table solicitacoes_transferencia     enable row level security;
alter table marcos_captação                enable row level security;
alter table comissoes                      enable row level security;

-- atribuicoes
create policy "atribuicoes: select org" on atribuicoes for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "atribuicoes: insert org" on atribuicoes for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "atribuicoes: update org" on atribuicoes for update to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "atribuicoes: delete org" on atribuicoes for delete to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- solicitacoes
create policy "solicitacoes: select org" on solicitacoes_transferencia for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "solicitacoes: insert org" on solicitacoes_transferencia for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "solicitacoes: update org" on solicitacoes_transferencia for update to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- marcos
create policy "marcos: select org" on marcos_captação for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "marcos: insert org" on marcos_captação for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "marcos: update org" on marcos_captação for update to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- comissoes
create policy "comissoes: select org" on comissoes for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "comissoes: insert org" on comissoes for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "comissoes: update org" on comissoes for update to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- ─── FUNÇÃO: verificar exclusividade ────────────────────────────────────────
-- Retorna a atribuição ativa para uma empresa/projeto, se existir.

create or replace function verificar_exclusividade(
  p_empresa_crm_id uuid,
  p_projeto_id uuid default null
)
returns table (
  id                uuid,
  captador_user_id  uuid,
  tipo              tipo_exclusividade,
  data_fim          date,
  dias_sem_avanco   integer
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.captador_user_id, a.tipo, a.data_fim, a.dias_sem_avanco
  from atribuicoes a
  where a.empresa_crm_id = p_empresa_crm_id
    and a.status = 'ativa'
    and (
      -- Exclusividade por empresa: bloqueia tudo
      a.tipo = 'exclusividade_empresa'
      -- Exclusividade por projeto: só bloqueia se o projeto é o mesmo
      or (a.tipo = 'exclusividade_projeto' and a.projeto_id = p_projeto_id)
      -- Time lock: bloqueia se não expirou
      or (a.tipo = 'time_lock' and (a.data_fim is null or a.data_fim >= current_date))
      -- Relação pessoal: bloqueia se aprovada
      or (a.tipo = 'relacao_pessoal' and a.aprovado_por is not null)
    )
  order by
    case a.tipo
      when 'exclusividade_empresa' then 1
      when 'exclusividade_projeto' then 2
      when 'time_lock' then 3
      when 'relacao_pessoal' then 4
      else 5
    end
  limit 1;
$$;

-- ─── FUNÇÃO: score de atividade ─────────────────────────────────────────────
-- Calcula o score de atividade de um captador nos últimos N dias.

create or replace function score_atividade_captador(
  p_user_id uuid,
  p_dias integer default 90
)
returns integer
language sql
security definer
set search_path = public
as $$
  with total as (
    select count(*) as cnt
    from atividades
    where captador_id = p_user_id
      and created_at >= now() - (p_dias || ' days')::interval
  ),
  feitas as (
    select count(*) as cnt
    from atividades
    where captador_id = p_user_id
      and feita = true
      and created_at >= now() - (p_dias || ' days')::interval
  )
  select case
    when t.cnt = 0 then 0
    else round((f.cnt::numeric / t.cnt::numeric) * 100)::integer
  end
  from total t, feitas f;
$$;

-- ─── TRIGGER: atualizar ultimo_avanco ───────────────────────────────────────
-- Quando uma atividade é marcada como feita, atualiza o ultimo_avanco da atribuição.

create or replace function fn_atualizar_ultimo_avanco()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.feita = true and (OLD.feita is null or OLD.feita = false) then
    update atribuicoes
    set ultimo_avanco = now()
    where captador_user_id = NEW.captador_id
      and empresa_crm_id = NEW.empresa_crm_id
      and status = 'ativa';
  end if;
  return NEW;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_atualizar_ultimo_avanco') then
    create trigger trg_atualizar_ultimo_avanco
      after update of feita on atividades
      for each row
      execute function fn_atualizar_ultimo_avanco();
  end if;
end;
$$;

-- ─── VIEW: saúde da carteira ────────────────────────────────────────────────

create or replace view v_saude_carteira as
select
  a.captador_user_id,
  a.organization_id,
  count(*) filter (where a.status = 'ativa') as ativas,
  count(*) filter (where a.status = 'ativa' and a.dias_sem_avanco > 30) as sem_atualizacao,
  count(*) filter (where a.status = 'expirada') as expiradas,
  count(*) filter (where a.status = 'ativa' and a.dias_sem_avanco > 60) as em_risco,
  count(*) filter (where a.tipo = 'compartilhada' and a.status = 'ativa') as compartilhadas
from atribuicoes a
group by a.captador_user_id, a.organization_id;
