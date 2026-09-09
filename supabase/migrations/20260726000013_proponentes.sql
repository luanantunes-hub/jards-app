-- Migration 013: tabela proponentes
-- Cria tabela proponentes e adiciona FK proponente_id em projetos_crm.
-- Faz backfill dos dados texto já existentes em proponente_nome/cidade/estado.

-- ── Tabela ──────────────────────────────────────────────────────────────────
create table if not exists proponentes (
  id               uuid primary key default gen_random_uuid(),
  account_id       uuid not null references auth.users(id),
  organization_id  uuid references organizations(id),
  nome             text not null,
  nome_key         text,              -- lowercase sem acentos, para busca
  cnpj             text,
  tipo             text,              -- "oscip" | "associacao" | "empresa" | "pessoa_fisica" | "outro"
  cidade           text,
  estado           char(2),
  email            text,
  telefone         text,
  site             text,
  descricao        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_proponentes_account_id     on proponentes(account_id);
create index if not exists idx_proponentes_org_id         on proponentes(organization_id);
create index if not exists idx_proponentes_nome_key       on proponentes(nome_key);

-- updated_at trigger
create trigger trg_proponentes_updated_at
  before update on proponentes
  for each row execute function moddatetime(updated_at);

-- ── FK em projetos_crm ───────────────────────────────────────────────────────
alter table projetos_crm
  add column if not exists proponente_id uuid references proponentes(id);

create index if not exists idx_projetos_crm_proponente_id on projetos_crm(proponente_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table proponentes enable row level security;

-- Políticas baseadas em account_id (mesma lógica pré-org, compatível antes de 012 ser aplicada)
create policy "proponentes: select próprio"
  on proponentes for select to authenticated
  using (account_id = auth.uid());

create policy "proponentes: insert próprio"
  on proponentes for insert to authenticated
  with check (account_id = auth.uid());

create policy "proponentes: update próprio"
  on proponentes for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "proponentes: delete próprio"
  on proponentes for delete to authenticated
  using (account_id = auth.uid());

-- ── Backfill: converte texto existente em registros normalizados ─────────────
do $$
declare
  rec record;
  new_id uuid;
begin
  for rec in
    select distinct
      account_id,
      organization_id,
      proponente_nome,
      proponente_cidade,
      proponente_estado
    from projetos_crm
    where proponente_nome is not null
      and proponente_id is null
  loop
    -- evita duplicar se mesmo nome já existe para este account
    select id into new_id
    from proponentes
    where account_id = rec.account_id
      and nome = rec.proponente_nome
    limit 1;

    if new_id is null then
      insert into proponentes (account_id, organization_id, nome, nome_key, cidade, estado)
      values (
        rec.account_id,
        rec.organization_id,
        rec.proponente_nome,
        lower(unaccent(rec.proponente_nome)),
        rec.proponente_cidade,
        rec.proponente_estado
      )
      returning id into new_id;
    end if;

    update projetos_crm
    set proponente_id = new_id
    where account_id       = rec.account_id
      and proponente_nome  = rec.proponente_nome
      and proponente_id is null;
  end loop;
end;
$$;
