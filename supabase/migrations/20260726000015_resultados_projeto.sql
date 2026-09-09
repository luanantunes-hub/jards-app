-- Migration 015: resultados_projeto
-- Armazena os dados de mensuração e ROI por projeto após execução.

create table if not exists resultados_projeto (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references auth.users(id),
  organization_id      uuid references organizations(id),
  projeto_id           uuid not null references projetos_crm(id) on delete cascade,

  -- Financeiro
  valor_captado        numeric(14,2),  -- total efetivamente captado (pode ser calculado ou manual)
  valor_executado      numeric(14,2),  -- valor total gasto/executado no projeto

  -- Alcance / impacto
  publico_alcancado    integer,        -- nº de pessoas impactadas
  eventos_realizados   integer,        -- nº de apresentações / eventos
  retorno_midia_est    numeric(14,2),  -- retorno de mídia estimado (valor equivalente em publicidade)

  -- Texto
  observacoes          text,

  data_resultado       date,           -- data de referência dos resultados (ex: encerramento do projeto)

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_resultados_projeto_projeto_id  on resultados_projeto(projeto_id);
create index if not exists idx_resultados_projeto_account_id  on resultados_projeto(account_id);
create index if not exists idx_resultados_projeto_org_id      on resultados_projeto(organization_id);

create trigger trg_resultados_projeto_updated_at
  before update on resultados_projeto
  for each row execute function moddatetime(updated_at);

-- RLS
alter table resultados_projeto enable row level security;

create policy "resultados_projeto: select próprio"
  on resultados_projeto for select to authenticated
  using (account_id = auth.uid());

create policy "resultados_projeto: insert próprio"
  on resultados_projeto for insert to authenticated
  with check (account_id = auth.uid());

create policy "resultados_projeto: update próprio"
  on resultados_projeto for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "resultados_projeto: delete próprio"
  on resultados_projeto for delete to authenticated
  using (account_id = auth.uid());
