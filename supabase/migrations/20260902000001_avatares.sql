-- Avatares de usuário e organização.
-- user: pasta user/<uid>/, controle do próprio usuário.
-- org:  pasta org/<orgid>/, controle apenas de admins da organização.

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.organizations
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- ── Usuário ─────────────────────────────────────────────────────────────────
drop policy if exists "avatars: user upload" on storage.objects;
drop policy if exists "avatars: user update" on storage.objects;
drop policy if exists "avatars: user delete" on storage.objects;

create policy "avatars: user upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "avatars: user update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "avatars: user delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ── Organização ─────────────────────────────────────────────────────────────
drop policy if exists "avatars: org admin upload" on storage.objects;
drop policy if exists "avatars: org admin update" on storage.objects;
drop policy if exists "avatars: org admin delete" on storage.objects;

create policy "avatars: org admin upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'org'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = (storage.foldername(name))[2]::uuid
        and om.user_id = auth.uid()
        and om.papel = 'admin'
    )
  );

create policy "avatars: org admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'org'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = (storage.foldername(name))[2]::uuid
        and om.user_id = auth.uid()
        and om.papel = 'admin'
    )
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'org'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = (storage.foldername(name))[2]::uuid
        and om.user_id = auth.uid()
        and om.papel = 'admin'
    )
  );

create policy "avatars: org admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'org'
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = (storage.foldername(name))[2]::uuid
        and om.user_id = auth.uid()
        and om.papel = 'admin'
    )
  );