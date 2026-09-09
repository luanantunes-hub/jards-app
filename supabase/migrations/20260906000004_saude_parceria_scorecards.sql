-- Scorecards configuráveis de saúde da parceria.
-- As dimensões iniciais são apenas sugestões criadas sob demanda pela interface.

create table if not exists public.saude_parceria_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conta_patrocinio_id uuid not null references public.contas_patrocinio(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 80),
  dimensao_base text check (dimensao_base is null or dimensao_base in ('relacionamento','entregas','engajamento','resultados','financeiro','renovacao')),
  peso smallint not null default 1 check (peso between 1 and 3),
  cor text not null default '#7259B5',
  icone text not null default 'Gauge',
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saude_parceria_criterios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  scorecard_id uuid not null references public.saude_parceria_scorecards(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  peso smallint not null default 2 check (peso between 1 and 3),
  nota smallint check (nota is null or nota between 1 and 5),
  observacao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_saude_scorecards_conta
  on public.saude_parceria_scorecards(conta_patrocinio_id, ativo, ordem);
create index if not exists idx_saude_criterios_scorecard
  on public.saude_parceria_criterios(scorecard_id, ativo, ordem);
create index if not exists idx_saude_scorecards_org
  on public.saude_parceria_scorecards(organization_id, conta_patrocinio_id);
create unique index if not exists uq_saude_scorecards_dimensao_base
  on public.saude_parceria_scorecards(conta_patrocinio_id, dimensao_base);

alter table public.saude_parceria_scorecards enable row level security;
alter table public.saude_parceria_criterios enable row level security;

drop policy if exists saude_parceria_scorecards_org_select on public.saude_parceria_scorecards;
drop policy if exists saude_parceria_scorecards_org_manage on public.saude_parceria_scorecards;
create policy saude_parceria_scorecards_org_select on public.saude_parceria_scorecards
  for select using (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_scorecards.organization_id and om.user_id = auth.uid()
  ));
create policy saude_parceria_scorecards_org_manage on public.saude_parceria_scorecards
  for all using (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_scorecards.organization_id and om.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_scorecards.organization_id and om.user_id = auth.uid()
  ));

drop policy if exists saude_parceria_criterios_org_select on public.saude_parceria_criterios;
drop policy if exists saude_parceria_criterios_org_manage on public.saude_parceria_criterios;
create policy saude_parceria_criterios_org_select on public.saude_parceria_criterios
  for select using (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_criterios.organization_id and om.user_id = auth.uid()
  ));
create policy saude_parceria_criterios_org_manage on public.saude_parceria_criterios
  for all using (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_criterios.organization_id and om.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.organization_members om
    where om.organization_id = saude_parceria_criterios.organization_id and om.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.saude_parceria_scorecards, public.saude_parceria_criterios to authenticated;
