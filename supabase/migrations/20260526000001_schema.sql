-- =============================================================
--  JARDS — Schema Supabase
--  Migração 001: Schema inicial
--
--  CAMADA 1 → Pública (todos os usuários logados)
--    empresas, editais, responsaveis
--
--  CAMADA 2 → Privada (isolada por account_id = auth.uid())
--    captacoes, editais_inscritos, contatos, tarefas
-- =============================================================


-- ─────────────────────────────────────────────
--  EXTENSÕES
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- =============================================================
--  CAMADA 1 — DADOS PÚBLICOS
-- =============================================================

-- ─────────────────────────────────────────────
--  EMPRESAS
--  Fonte: export_todos-os-campos (1.716 linhas)
-- ─────────────────────────────────────────────
create table if not exists empresas (
  id              uuid primary key default gen_random_uuid(),
  bubble_id       text unique,           -- ID original do Bubble (migração)

  -- Identificação
  nome            text not null,
  nome_uppercase  text,
  setor           text,
  cidade          text,
  estado          char(2),

  -- Contato público
  site            text,
  email_geral     text,
  telefone        text,
  logo_url        text,

  -- Descrição / curadoria (texto gerado pelo time Jards)
  descricao       text,

  -- BI: janela de patrocínio por trimestre (sim/não no Bubble)
  trimestre_1     boolean default false,
  trimestre_2     boolean default false,
  trimestre_3     boolean default false,
  trimestre_4     boolean default false,

  -- BI: aporte estimado (campo "aporte_novo" no Bubble)
  aporte_estimado numeric(15,2),

  -- Controle interno
  tem_detalhe     boolean default false, -- campo "detalhe" no Bubble
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
--  EDITAIS
--  Extraídos dos campos inline da tabela empresas no Bubble
--  (edital_titulo, edital_abertura, edital_fechamento, edital_acesso)
--  Separados aqui para suportar múltiplos editais por empresa no futuro
-- ─────────────────────────────────────────────
create table if not exists editais (
  id              uuid primary key default gen_random_uuid(),

  empresa_id      uuid not null references empresas(id) on delete cascade,

  titulo          text,
  data_abertura   date,
  data_fechamento date,
  url_acesso      text,

  ativo           boolean default true,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
--  RESPONSÁVEIS
--  Fonte: export_All-respons-veis (1.911 linhas)
--  Ligam à empresa pelo bubble_id da empresa
-- ─────────────────────────────────────────────
create table if not exists responsaveis (
  id              uuid primary key default gen_random_uuid(),
  bubble_id       text unique,           -- ID original do Bubble (migração)

  empresa_id      uuid not null references empresas(id) on delete cascade,

  nome            text not null,
  cargo           text,
  email           text,
  linkedin_url    text,
  ordem           int default 1,         -- ordenação na UI ("Ordem" no Bubble)

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);


-- =============================================================
--  CAMADA 2 — DADOS PRIVADOS (por conta de usuário)
-- =============================================================

-- ─────────────────────────────────────────────
--  CAPTAÇÕES
--  Pipeline de cada captador — nunca exposto a outras contas
-- ─────────────────────────────────────────────
create table if not exists captacoes (
  id                uuid primary key default gen_random_uuid(),
  account_id        uuid not null references auth.users(id) on delete cascade,

  empresa_id        uuid references empresas(id),   -- empresa alvo (pública)
  edital_id         uuid references editais(id),    -- edital alvo (público)

  titulo            text,
  lei               text check (lei in ('rouanet','esporte','audiovisual','outros')),
  valor_solicitado  numeric(15,2),
  valor_aprovado    numeric(15,2),

  -- Kanban
  status            text default 'prospeccao' check (status in (
                      'prospeccao','primeiro_contato','proposta_enviada',
                      'em_negociacao','aprovado','recusado','renovacao'
                    )),

  data_previsao     date,
  notas             text,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────────
--  EDITAIS INSCRITOS
--  Editais públicos em que o usuário inscreveu um projeto
-- ─────────────────────────────────────────────
create table if not exists editais_inscritos (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references auth.users(id) on delete cascade,

  edital_id       uuid references editais(id),
  captacao_id     uuid references captacoes(id),

  status          text default 'inscrito' check (status in (
                    'inscrito','em_analise','aprovado','reprovado','cancelado'
                  )),
  data_inscricao  date,
  notas           text,

  created_at      timestamptz default now()
);

-- ─────────────────────────────────────────────
--  CONTATOS
--  Agenda pessoal do captador
--  Pode apontar para um responsável público (responsavel_id)
--  ou ser um contato totalmente independente
-- ─────────────────────────────────────────────
create table if not exists contatos (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references auth.users(id) on delete cascade,

  responsavel_id      uuid references responsaveis(id),  -- nullable
  empresa_id          uuid references empresas(id),

  -- Campos livres (usados quando não há vínculo com responsável público)
  nome                text,
  cargo               text,
  email               text,

  notas               text,
  ultima_interacao    timestamptz,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ─────────────────────────────────────────────
--  TAREFAS
--  Atividades ligadas a captações e/ou contatos
-- ─────────────────────────────────────────────
create table if not exists tarefas (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references auth.users(id) on delete cascade,

  captacao_id     uuid references captacoes(id),
  responsavel_id  uuid references responsaveis(id),

  titulo          text not null,
  tipo            text default 'tarefa' check (tipo in (
                    'email','ligacao','reuniao','documento','followup','tarefa'
                  )),
  status          text default 'pendente' check (status in (
                    'pendente','em_andamento','concluida','cancelada'
                  )),

  data_prazo      timestamptz,
  data_conclusao  timestamptz,

  created_at      timestamptz default now()
);


-- =============================================================
--  ÍNDICES (performance)
-- =============================================================

-- Públicos
create index on empresas (estado);
create index on empresas (setor);
create index on empresas (nome_uppercase);
create index on editais (empresa_id);
create index on editais (ativo);
create index on responsaveis (empresa_id);

-- Privados — sempre filtrados por account_id primeiro
create index on captacoes (account_id);
create index on captacoes (account_id, status);
create index on captacoes (empresa_id);
create index on editais_inscritos (account_id);
create index on contatos (account_id);
create index on tarefas (account_id);
create index on tarefas (account_id, status);


-- =============================================================
--  TRIGGERS — updated_at automático
-- =============================================================

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_empresas_updated_at
  before update on empresas
  for each row execute function update_updated_at();

create trigger trg_editais_updated_at
  before update on editais
  for each row execute function update_updated_at();

create trigger trg_responsaveis_updated_at
  before update on responsaveis
  for each row execute function update_updated_at();

create trigger trg_captacoes_updated_at
  before update on captacoes
  for each row execute function update_updated_at();

create trigger trg_contatos_updated_at
  before update on contatos
  for each row execute function update_updated_at();
