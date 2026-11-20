-- Bucket privado para anexos de e-mail: a pessoa sobe o arquivo na própria pasta (user_id), antes de enviar.
insert into storage.buckets (id, name, public)
  values ('email-anexos', 'email-anexos', false)
  on conflict (id) do nothing;

drop policy if exists "email-anexos: upload próprio" on storage.objects;
create policy "email-anexos: upload próprio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'email-anexos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "email-anexos: leitura própria" on storage.objects;
create policy "email-anexos: leitura própria"
  on storage.objects for select to authenticated
  using (bucket_id = 'email-anexos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "email-anexos: exclusão própria" on storage.objects;
create policy "email-anexos: exclusão própria"
  on storage.objects for delete to authenticated
  using (bucket_id = 'email-anexos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Agendados levam só o caminho e os metadados; o conteúdo é baixado do Storage na hora de enviar.
alter table email_agendados add column if not exists anexos jsonb not null default '[]';
