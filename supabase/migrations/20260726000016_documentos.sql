-- ─── Tabela documentos ──────────────────────────────────────────────────────
-- Armazena metadados de arquivos anexados a captações.

create table if not exists documentos (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid references auth.users(id) not null,
  organization_id uuid references organizations(id),
  captacao_id     uuid references captacoes(id) on delete cascade,
  nome            text not null,
  tipo            text,                          -- mime type: application/pdf, image/png …
  tamanho         bigint,                        -- bytes
  url             text not null,                 -- caminho no Supabase Storage
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_documentos_captacao on documentos(captacao_id);
create index if not exists idx_documentos_org      on documentos(organization_id);

-- updated_at trigger
create trigger trg_documentos_updated_at
  before update on documentos
  for each row execute function update_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table documentos enable row level security;

drop policy if exists "documentos: select org" on documentos;
create policy "documentos: select org"
  on documentos for select to authenticated
  using (organization_id = any(array(select auth_org_ids())));

drop policy if exists "documentos: insert org" on documentos;
create policy "documentos: insert org"
  on documentos for insert to authenticated
  with check (organization_id = any(array(select auth_org_ids())));

drop policy if exists "documentos: delete org" on documentos;
create policy "documentos: delete org"
  on documentos for delete to authenticated
  using (organization_id = any(array(select auth_org_ids())));

-- ─── Storage bucket ─────────────────────────────────────────────────────────
-- Bucket privado para documentos de captações.

insert into storage.buckets (id, name, public)
  values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

-- Permitir upload autenticado no bucket documentos
drop policy if exists "documentos: upload org" on storage.objects;
create policy "documentos: upload org"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select organization_id::text from organization_members where user_id = auth.uid()))
  );

-- Permitir leitura autenticada
drop policy if exists "documentos: read org" on storage.objects;
create policy "documentos: read org"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select organization_id::text from organization_members where user_id = auth.uid()))
  );

-- Permitir delete autenticado
drop policy if exists "documentos: delete org" on storage.objects;
create policy "documentos: delete org"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (storage.foldername(name))[1] = any(array(select organization_id::text from organization_members where user_id = auth.uid()))
  );
