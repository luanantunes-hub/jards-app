-- Relatórios de sustentabilidade enviados na página pública do patrocinador.
-- O bucket é público porque os documentos são abertos a partir de um link direto na interface.

create table if not exists public.relatorios_sustentabilidade (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  storage_path text not null unique,
  url text not null,
  tamanho_bytes bigint,
  tipo_arquivo text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.relatorios_sustentabilidade
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_relatorios_sustentabilidade_empresa
  on public.relatorios_sustentabilidade (empresa_id, updated_at desc);

alter table public.relatorios_sustentabilidade enable row level security;

drop policy if exists "relatorios sustentabilidade: leitura autenticada" on public.relatorios_sustentabilidade;
create policy "relatorios sustentabilidade: leitura autenticada"
  on public.relatorios_sustentabilidade for select to authenticated using (true);

drop policy if exists "relatorios sustentabilidade: insercao autenticada" on public.relatorios_sustentabilidade;
create policy "relatorios sustentabilidade: insercao autenticada"
  on public.relatorios_sustentabilidade for insert to authenticated with check (uploaded_by = auth.uid());

drop policy if exists "relatorios sustentabilidade: atualizacao autenticada" on public.relatorios_sustentabilidade;
create policy "relatorios sustentabilidade: atualizacao autenticada"
  on public.relatorios_sustentabilidade for update to authenticated using (true) with check (true);

drop policy if exists "relatorios sustentabilidade: exclusao autenticada" on public.relatorios_sustentabilidade;
create policy "relatorios sustentabilidade: exclusao autenticada"
  on public.relatorios_sustentabilidade for delete to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relatorios-sustentabilidade',
  'relatorios-sustentabilidade',
  true,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "relatorios sustentabilidade storage: leitura" on storage.objects;
create policy "relatorios sustentabilidade storage: leitura"
  on storage.objects for select to authenticated
  using (bucket_id = 'relatorios-sustentabilidade');

drop policy if exists "relatorios sustentabilidade storage: insercao" on storage.objects;
create policy "relatorios sustentabilidade storage: insercao"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'relatorios-sustentabilidade');

drop policy if exists "relatorios sustentabilidade storage: atualizacao" on storage.objects;
create policy "relatorios sustentabilidade storage: atualizacao"
  on storage.objects for update to authenticated
  using (bucket_id = 'relatorios-sustentabilidade')
  with check (bucket_id = 'relatorios-sustentabilidade');

drop policy if exists "relatorios sustentabilidade storage: exclusao" on storage.objects;
create policy "relatorios sustentabilidade storage: exclusao"
  on storage.objects for delete to authenticated
  using (bucket_id = 'relatorios-sustentabilidade');
