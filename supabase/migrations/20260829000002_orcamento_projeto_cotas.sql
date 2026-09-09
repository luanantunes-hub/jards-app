-- Orçamento de captação do projeto.
-- Mantém separado de prestacao_itens: um é planejamento/composição da proposta,
-- o outro é execução e comprovação da prestação de contas.

create table if not exists projeto_orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  projeto_id      uuid not null references projetos_crm(id) on delete cascade,
  organization_id uuid not null references organizations(id),

  rubrica         text not null,
  descricao       text,
  valor           numeric(15,2) not null default 0 check (valor >= 0),
  origem          text not null default 'manual' check (origem in ('manual', 'csv')),
  ordem           integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists projeto_orcamento_rateios (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references projeto_orcamento_itens(id) on delete cascade,
  cota_id         uuid not null references cotas_patrocinio(id) on delete cascade,
  valor           numeric(15,2) not null check (valor > 0),
  created_at      timestamptz not null default now(),

  constraint projeto_orcamento_rateio_unico unique (item_id, cota_id)
);

create index if not exists idx_projeto_orcamento_itens_projeto
  on projeto_orcamento_itens(projeto_id, ordem);
create index if not exists idx_projeto_orcamento_itens_org
  on projeto_orcamento_itens(organization_id);
create index if not exists idx_projeto_orcamento_rateios_item
  on projeto_orcamento_rateios(item_id);
create index if not exists idx_projeto_orcamento_rateios_cota
  on projeto_orcamento_rateios(cota_id);

alter table projeto_orcamento_itens enable row level security;
alter table projeto_orcamento_rateios enable row level security;

create policy "projeto_orcamento_itens: select org" on projeto_orcamento_itens
  for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));
create policy "projeto_orcamento_itens: insert org" on projeto_orcamento_itens
  for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));
create policy "projeto_orcamento_itens: update org" on projeto_orcamento_itens
  for update to authenticated
  using (organization_id = any(array(select auth_org_ids())))
  with check (organization_id = any(array(select auth_org_ids())));
create policy "projeto_orcamento_itens: delete org" on projeto_orcamento_itens
  for delete to authenticated
  using (organization_id = any(array(select auth_org_ids())));

create policy "projeto_orcamento_rateios: select org" on projeto_orcamento_rateios
  for select to authenticated
  using (exists (
    select 1 from projeto_orcamento_itens i
    where i.id = item_id
      and i.organization_id = any(array(select auth_org_ids()))
  ));
create policy "projeto_orcamento_rateios: insert org" on projeto_orcamento_rateios
  for insert to authenticated
  with check (exists (
    select 1 from projeto_orcamento_itens i
    join cotas_patrocinio c on c.id = cota_id
    where i.id = item_id
      and i.organization_id = any(array(select auth_org_ids()))
      and c.projeto_id = i.projeto_id
      and c.organization_id = i.organization_id
  ));
create policy "projeto_orcamento_rateios: update org" on projeto_orcamento_rateios
  for update to authenticated
  using (exists (
    select 1 from projeto_orcamento_itens i
    where i.id = item_id
      and i.organization_id = any(array(select auth_org_ids()))
  ))
  with check (exists (
    select 1 from projeto_orcamento_itens i
    join cotas_patrocinio c on c.id = cota_id
    where i.id = item_id
      and i.organization_id = any(array(select auth_org_ids()))
      and c.projeto_id = i.projeto_id
      and c.organization_id = i.organization_id
  ));
create policy "projeto_orcamento_rateios: delete org" on projeto_orcamento_rateios
  for delete to authenticated
  using (exists (
    select 1 from projeto_orcamento_itens i
    where i.id = item_id
      and i.organization_id = any(array(select auth_org_ids()))
  ));

create or replace function update_projeto_orcamento_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projeto_orcamento_updated_at on projeto_orcamento_itens;
create trigger trg_projeto_orcamento_updated_at
  before update on projeto_orcamento_itens
  for each row execute function update_projeto_orcamento_updated_at();
