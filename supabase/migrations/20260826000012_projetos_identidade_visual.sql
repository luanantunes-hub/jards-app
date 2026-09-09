-- Identidade visual opcional dos projetos.
alter table projetos_crm
  add column if not exists identidade_tipo text not null default 'padrao'
    check (identidade_tipo in ('padrao', 'icone', 'emoji', 'logo')),
  add column if not exists identidade_valor text,
  add column if not exists identidade_logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'projetos-identidade',
  'projetos-identidade',
  true,
  2097152,
  array['image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "projetos identidade: upload org" on storage.objects;
drop policy if exists "projetos identidade: update org" on storage.objects;
drop policy if exists "projetos identidade: delete org" on storage.objects;

create policy "projetos identidade: upload org" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'projetos-identidade'
    and (storage.foldername(name))[1] = any(array(select auth_org_ids()))
  );

create policy "projetos identidade: update org" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'projetos-identidade'
    and (storage.foldername(name))[1] = any(array(select auth_org_ids()))
  )
  with check (
    bucket_id = 'projetos-identidade'
    and (storage.foldername(name))[1] = any(array(select auth_org_ids()))
  );

create policy "projetos identidade: delete org" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'projetos-identidade'
    and (storage.foldername(name))[1] = any(array(select auth_org_ids()))
  );
