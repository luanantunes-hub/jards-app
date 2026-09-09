-- Migration 005: cotas_patrocinio + propostas + proposta_visualizacoes
-- Fase A: Proposta / Pitch Deck

-- ─────────────────────────────────────────────
--  COTAS DE PATROCINIO
--  Pacotes de patrocínio vinculados a um projeto
-- ─────────────────────────────────────────────
create table if not exists cotas_patrocinio (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos_crm(id) on delete cascade,
  organization_id uuid not null references organizations(id),

  nome            text not null,               -- "Cota Master", "Cota Ouro", etc.
  valor           numeric(15,2) not null default 0,
  contrapartidas  text[] not null default '{}', -- array de strings: ["Logo em materiais", "Receivers no evento"]
  ordem           int not null default 0,       -- ordenação de exibição no deck

  status          text not null default 'disponivel'
                  check (status in ('disponivel', 'reservada', 'vendida')),
  captacao_id     uuid references captacoes(id), -- se vendida/reservada, qual negociação a ocupa

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- garante que só uma captação "segure" a mesma cota por vez
create unique index if not exists idx_cotas_captacao_unica
  on cotas_patrocinio (captacao_id) where captacao_id is not null;

create index if not exists idx_cotas_patrocinio_projeto on cotas_patrocinio(projeto_id);
create index if not exists idx_cotas_patrocinio_org     on cotas_patrocinio(organization_id);
create index if not exists idx_cotas_patrocinio_status  on cotas_patrocinio(status);

-- ─────────────────────────────────────────────
--  PROPOSTAS (DECK)
--  Deck estruturado com slides tipados
-- ─────────────────────────────────────────────
create table if not exists propostas (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos_crm(id) on delete cascade,
  captacao_id     uuid references captacoes(id), -- opcional: ligada a uma negociação específica
  organization_id uuid not null references organizations(id),

  titulo          text not null,

  -- Slides tipados (schema explícito, não jsonb livre)
  slide_capa      jsonb not null default '{}',   -- {titulo, subtitulo, imagem_url}
  slide_historia  jsonb not null default '{}',   -- {texto, imagens: []}
  slide_numeros   jsonb not null default '{}',   -- {alcance, publico, edicoes_anteriores, roi_medio}
  slide_contato   jsonb not null default '{}',   -- {nome, email, telefone, whatsapp}
  -- slide_cotas: renderiza direto de cotas_patrocinio via projeto_id

  status          text not null default 'rascunho'
                  check (status in ('rascunho','enviada','visualizada','aceita','recusada','expirada','arquivada')),

  -- Link público
  -- PostgreSQL aceita hex/base64/escape em encode(); "base64url" não existe.
  -- Hex é URL-safe e mantém entropia suficiente para o slug público.
  slug            text not null unique default encode(gen_random_bytes(12), 'hex'),
  expira_em       date,
  primeira_visualizacao timestamptz,
  ultima_visualizacao   timestamptz,
  total_visualizacoes   int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_propostas_projeto on propostas(projeto_id);
create index if not exists idx_propostas_org     on propostas(organization_id);
create index if not exists idx_propostas_slug    on propostas(slug);
create index if not exists idx_propostas_status  on propostas(status);

-- ─────────────────────────────────────────────
--  PROPOSTA_VISUALIZACOES (tracking granular)
-- ─────────────────────────────────────────────
create table if not exists proposta_visualizacoes (
  id               uuid primary key default gen_random_uuid(),
  proposta_id      uuid not null references propostas(id) on delete cascade,
  visualizado_em   timestamptz not null default now(),
  duracao_segundos int,          -- preenchido via beacon no unload
  ip_hash          text,         -- hash, não IP cru — só pra distinguir sessões
  user_agent       text
);

create index if not exists idx_proposta_views_proposta on proposta_visualizacoes(proposta_id);
create index if not exists idx_proposta_views_time     on proposta_visualizacoes(visualizado_em);

-- ─────────────────────────────────────────────
--  RLS — organization-scoped
-- ─────────────────────────────────────────────
alter table cotas_patrocinio enable row level security;
alter table propostas enable row level security;
alter table proposta_visualizacoes enable row level security;

-- cotas_patrocinio: org-based
create policy "cotas_patrocinio: select org" on cotas_patrocinio
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "cotas_patrocinio: insert org" on cotas_patrocinio
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "cotas_patrocinio: update org" on cotas_patrocinio
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "cotas_patrocinio: delete org" on cotas_patrocinio
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

-- propostas: org-based
create policy "propostas: select org" on propostas
  for select to authenticated using (organization_id = any(array(select auth_org_ids())));
create policy "propostas: insert org" on propostas
  for insert to authenticated with check (organization_id = any(array(select auth_org_ids())));
create policy "propostas: update org" on propostas
  for update to authenticated using (organization_id = any(array(select auth_org_ids()))) with check (organization_id = any(array(select auth_org_ids())));
create policy "propostas: delete org" on propostas
  for delete to authenticated using (organization_id = any(array(select auth_org_ids())));

-- proposta_visualizacoes: anyone can insert (public tracking), owner can select
create policy "proposta_visualizacoes: insert anon" on proposta_visualizacoes
  for insert to anon with check (true);
create policy "proposta_visualizacoes: insert auth" on proposta_visualizacoes
  for insert to authenticated with check (true);
create policy "proposta_visualizacoes: select org" on proposta_visualizacoes
  for select to authenticated using (
    proposta_id in (
      select id from propostas where organization_id = any(array(select auth_org_ids()))
    )
  );

-- ─────────────────────────────────────────────
--  Triggers: updated_at
-- ─────────────────────────────────────────────
create or replace function update_cotas_patrocinio_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_cotas_patrocinio_updated_at
  before update on cotas_patrocinio
  for each row execute function update_cotas_patrocinio_updated_at();

create or replace function update_propostas_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_propostas_updated_at
  before update on propostas
  for each row execute function update_propostas_updated_at();

-- ─────────────────────────────────────────────
--  RPC: fn_proposta_publica
--  Acesso público por slug — única forma não-autenticada
-- ─────────────────────────────────────────────
create or replace function fn_proposta_publica(p_slug text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_proposta propostas%rowtype;
  v_result jsonb;
begin
  select * into v_proposta from propostas where slug = p_slug;

  if not found then
    return null;
  end if;

  -- Bloquear propostas expiradas
  if v_proposta.expira_em is not null and v_proposta.expira_em < current_date then
    return jsonb_build_object('expirada', true);
  end if;

  -- Bloquear propostas arquivadas
  if v_proposta.status = 'arquivada' then
    return jsonb_build_object('arquivada', true);
  end if;

  -- Registrar visualização
  insert into proposta_visualizacoes (proposta_id) values (v_proposta.id);

  -- Atualizar contadores
  update propostas
  set total_visualizacoes = total_visualizacoes + 1,
      primeira_visualizacao = coalesce(primeira_visualizacao, now()),
      ultima_visualizacao = now(),
      status = case when status = 'enviada' then 'visualizada' else status end
  where id = v_proposta.id;

  -- Montar payload público (cotas SEM contagem agregada — só status individual)
  select jsonb_build_object(
    'titulo', v_proposta.titulo,
    'slide_capa', v_proposta.slide_capa,
    'slide_historia', v_proposta.slide_historia,
    'slide_numeros', v_proposta.slide_numeros,
    'slide_contato', v_proposta.slide_contato,
    'cotas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', c.nome,
        'valor', c.valor,
        'contrapartidas', c.contrapartidas,
        'status', c.status
      ) order by c.ordem), '[]'::jsonb)
      from cotas_patrocinio c
      where c.projeto_id = v_proposta.projeto_id
    )
  ) into v_result;

  return v_result;
end;
$$;
