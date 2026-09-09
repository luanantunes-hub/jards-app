-- =============================================================
--  JARDS — Migração 003: Expansão CRM
--  2026-07-21
--
--  CAMADA 1 (Pública) — novas tabelas de BI por empresa:
--    tipologias, investimentos_anuais, investimentos_trimestres
--
--  CAMADA 2 (Privada) — CRM completo:
--    projetos_crm, empresas_crm
--    + alter: captacoes, contatos
--    atividades, notas, editais_user
--    desbloqueios, copy_templates
--    sequencias_template, sequencias_passo
-- =============================================================


-- =============================================================
--  CAMADA 1 — BI PÚBLICO
-- =============================================================

-- ─────────────────────────────────────────────
--  TIPOLOGIAS
--  Score de afinidade cultural por empresa (0–100 cada eixo)
-- ─────────────────────────────────────────────
create table if not exists tipologias (
  id              uuid primary key default gen_random_uuid(),
  empresa_pub_id  uuid unique not null references empresas(id) on delete cascade,

  musica              numeric(5,2) default 0,
  audiovisual         numeric(5,2) default 0,
  artes_cenicas       numeric(5,2) default 0,
  artes_visuais       numeric(5,2) default 0,
  artes_integradas    numeric(5,2) default 0,
  humanidades         numeric(5,2) default 0,
  patrimonio_cultural numeric(5,2) default 0,
  impacto             numeric(5,2) default 0,
  visibilidade        numeric(5,2) default 0,
  institucional       numeric(5,2) default 0
);

-- ─────────────────────────────────────────────
--  INVESTIMENTOS ANUAIS
--  Histórico de aporte anual por empresa (2020-2025)
-- ─────────────────────────────────────────────
create table if not exists investimentos_anuais (
  id              uuid primary key default gen_random_uuid(),
  empresa_pub_id  uuid not null references empresas(id) on delete cascade,

  nome        text,             -- nome do programa / linha de investimento
  ano_2020    numeric(15,2) default 0,
  ano_2021    numeric(15,2) default 0,
  ano_2022    numeric(15,2) default 0,
  ano_2023    numeric(15,2) default 0,
  ano_2024    numeric(15,2) default 0,
  ano_2025    numeric(15,2) default 0,
  diferenca   numeric(15,2) default 0  -- variação entre último e penúltimo ano
);

-- ─────────────────────────────────────────────
--  INVESTIMENTOS TRIMESTRES
--  Breakdown mensal/trimestral por empresa
-- ─────────────────────────────────────────────
create table if not exists investimentos_trimestres (
  id              uuid primary key default gen_random_uuid(),
  empresa_pub_id  uuid unique not null references empresas(id) on delete cascade,

  t1  numeric(15,2) default 0,
  t2  numeric(15,2) default 0,
  t3  numeric(15,2) default 0,
  t4  numeric(15,2) default 0,

  janeiro    numeric(15,2) default 0,
  fevereiro  numeric(15,2) default 0,
  marco      numeric(15,2) default 0,
  abril      numeric(15,2) default 0,
  maio       numeric(15,2) default 0,
  junho      numeric(15,2) default 0,
  julho      numeric(15,2) default 0,
  agosto     numeric(15,2) default 0,
  setembro   numeric(15,2) default 0,
  outubro    numeric(15,2) default 0,
  novembro   numeric(15,2) default 0,
  dezembro   numeric(15,2) default 0
);


-- =============================================================
--  CAMADA 2 — CRM PRIVADO
-- =============================================================

-- ─────────────────────────────────────────────
--  PROJETOS CRM
--  Projetos culturais/esportivos do captador
--  que serão apresentados a potenciais patrocinadores
-- ─────────────────────────────────────────────
create table if not exists projetos_crm (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  nome        text not null,
  nome_key    text,             -- normalizado (lowercase, sem acento) para busca
  descricao   text,
  valor_alvo  numeric(15,2),

  -- Proponente
  proponente_nome   text,
  proponente_cidade text,
  proponente_estado char(2),

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  EMPRESAS CRM
--  Empresas que o captador adicionou ao seu pipeline
--  Pode (ou não) vincular à base pública via empresa_pub_id
-- ─────────────────────────────────────────────
create table if not exists empresas_crm (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references auth.users(id) on delete cascade,

  empresa_pub_id  uuid references empresas(id),   -- nullable: vínculo com base pública

  nome        text not null,
  nome_key    text,
  setor       text,
  domain_key  text,
  ordem       int default 0,

  -- Status no pipeline desta conta (espelha captacoes.status do lead principal)
  status        text check (status in (
    'prospeccao','primeiro_contato','proposta_enviada',
    'em_negociacao','aprovado','recusado','renovacao'
  )),

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  ALTER CAPTACOES — campos CRM extras
-- ─────────────────────────────────────────────
alter table captacoes
  add column if not exists projeto_id        uuid references projetos_crm(id),
  add column if not exists empresa_crm_id    uuid references empresas_crm(id),
  add column if not exists prioridade        text check (prioridade in ('alta','media','baixa')),
  add column if not exists meio_contato      text check (meio_contato in (
                                               'email','telefone','linkedin','reuniao','indicacao','outro'
                                             )),
  add column if not exists retorno           text,   -- livre: resumo do retorno do contato
  add column if not exists proxima_prospeccao date;

-- ─────────────────────────────────────────────
--  ALTER CONTATOS — campos CRM extras
-- ─────────────────────────────────────────────
alter table contatos
  add column if not exists empresa_crm_id  uuid references empresas_crm(id),
  add column if not exists linkedin_url    text,
  add column if not exists telefone        text,
  add column if not exists telefone_2      text,
  add column if not exists score           int default 0,
  add column if not exists origem          text check (origem in (
                                             'jards','proprio','indicacao','linkedin','outro'
                                           ));

-- ─────────────────────────────────────────────
--  ATIVIDADES
--  Ações de outreach: emails enviados, ligações, reuniões
--  Separadas de tarefas (que são itens internos de to-do)
-- ─────────────────────────────────────────────
create table if not exists atividades (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  empresa_crm_id  uuid references empresas_crm(id),
  projeto_id      uuid references projetos_crm(id),
  captacao_id     uuid references captacoes(id),
  contato_id      uuid references contatos(id),

  nome        text not null,
  nome_key    text,

  tipo        text check (tipo in (
                'email','telefone','linkedin','reuniao','evento','outro'
              )),
  prioridade  text check (prioridade in ('alta','media','baixa')),

  data_inicio    timestamptz,
  data_prevista  timestamptz,
  data_realizada timestamptz,
  feita          boolean default false,

  nota  text,
  copy  text,   -- texto usado no contato

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  NOTAS
--  Notas polimórficas — vinculadas a qualquer entidade CRM
--  Apenas um FK deve ser preenchido por registro
-- ─────────────────────────────────────────────
create table if not exists notas (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  conteudo    text not null,
  timestamp   timestamptz default now(),

  -- FK polimórfico (somente um por vez)
  empresa_pub_id  uuid references empresas(id),
  empresa_crm_id  uuid references empresas_crm(id),
  contato_id      uuid references contatos(id),
  captacao_id     uuid references captacoes(id),
  atividade_id    uuid references atividades(id),
  edital_user_id  uuid,   -- referência circular resolvida abaixo via trigger

  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  EDITAIS USER
--  Editais que o captador está monitorando / inscrevendo
--  Separados da tabela pública `editais` (que vem da curadoria Jards)
-- ─────────────────────────────────────────────
create table if not exists editais_user (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  edital_pub_id   uuid references editais(id),       -- edital da base pública (opcional)
  empresa_pub_id  uuid references empresas(id),
  empresa_crm_id  uuid references empresas_crm(id),
  projeto_id      uuid references projetos_crm(id),
  contato_id      uuid references contatos(id),

  titulo          text,
  valor           numeric(15,2),
  site            text,

  data_abertura   date,
  data_fechamento date,
  data_resultado  date,

  status      text default 'interesse' check (status in (
                'interesse','inscrito','em_analise','aprovado','reprovado','cancelado'
              )),
  prioridade  text check (prioridade in ('alta','media','baixa')),
  observacoes text,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Agora adiciona FK em notas para editais_user (evita dependência circular no CREATE)
alter table notas
  add constraint notas_edital_user_fk
  foreign key (edital_user_id) references editais_user(id) on delete set null;

-- ─────────────────────────────────────────────
--  DESBLOQUEIOS
--  Rastreia quais empresas públicas o usuário desbloqueou
--  (modelo freemium com créditos)
-- ─────────────────────────────────────────────
create table if not exists desbloqueios (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  empresa_pub_id  uuid not null references empresas(id),

  created_at  timestamptz default now(),

  unique (account_id, empresa_pub_id)
);

-- ─────────────────────────────────────────────
--  COPY TEMPLATES
--  Modelos de mensagens de outreach por projeto
-- ─────────────────────────────────────────────
create table if not exists copy_templates (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  projeto_id  uuid references projetos_crm(id),

  nome        text not null,
  texto       text,
  meio_contato text check (meio_contato in (
                 'email','telefone','linkedin','reuniao','outro'
               )),
  ativo       boolean default true,
  tags        text[],

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  SEQUENCIAS TEMPLATE
--  Templates de cadência de prospecção
-- ─────────────────────────────────────────────
create table if not exists sequencias_template (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references auth.users(id) on delete cascade,

  projeto_id  uuid references projetos_crm(id),

  nome          text not null,
  descricao     text,
  ativo         boolean default true,
  padrao_global boolean default false,   -- disponível para todos os projetos da conta

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
--  SEQUENCIAS PASSO
--  Passos dentro de uma cadência
-- ─────────────────────────────────────────────
create table if not exists sequencias_passo (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references auth.users(id) on delete cascade,

  sequencia_id  uuid not null references sequencias_template(id) on delete cascade,

  titulo        text,
  ordem         int not null default 1,
  offset_dias   int default 0,           -- dias após o passo anterior
  tipo_contato  text check (tipo_contato in (
                  'email','telefone','linkedin','reuniao','outro'
                )),
  copy_sugerida text,
  nota_sugerida text,
  ativo         boolean default true,

  created_at    timestamptz default now()
);


-- =============================================================
--  ÍNDICES
-- =============================================================

-- Públicos BI
create index on tipologias (empresa_pub_id);
create index on investimentos_anuais (empresa_pub_id);

-- CRM privado
create index on projetos_crm (account_id);
create index on empresas_crm (account_id);
create index on empresas_crm (account_id, empresa_pub_id);
create index on atividades   (account_id);
create index on atividades   (account_id, feita);
create index on atividades   (account_id, data_prevista);
create index on notas        (account_id);
create index on notas        (empresa_crm_id);
create index on notas        (captacao_id);
create index on editais_user (account_id);
create index on editais_user (account_id, status);
create index on desbloqueios (account_id);
create index on desbloqueios (account_id, empresa_pub_id);
create index on copy_templates     (account_id);
create index on sequencias_template (account_id);
create index on sequencias_passo    (sequencia_id);


-- =============================================================
--  TRIGGERS — updated_at
-- =============================================================

create trigger trg_projetos_crm_updated_at
  before update on projetos_crm
  for each row execute function update_updated_at();

create trigger trg_empresas_crm_updated_at
  before update on empresas_crm
  for each row execute function update_updated_at();

create trigger trg_atividades_updated_at
  before update on atividades
  for each row execute function update_updated_at();

create trigger trg_editais_user_updated_at
  before update on editais_user
  for each row execute function update_updated_at();

create trigger trg_copy_templates_updated_at
  before update on copy_templates
  for each row execute function update_updated_at();

create trigger trg_sequencias_template_updated_at
  before update on sequencias_template
  for each row execute function update_updated_at();
