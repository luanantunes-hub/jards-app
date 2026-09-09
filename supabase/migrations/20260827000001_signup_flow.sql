-- Cadastro público: perfil completo e organização inicial.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text;

update public.profiles as profile
set
  full_name = coalesce(
    profile.full_name,
    users.raw_user_meta_data->>'full_name',
    users.raw_user_meta_data->>'name'
  ),
  email = coalesce(profile.email, users.email)
from auth.users as users
where profile.id = users.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  new_org_name text;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = coalesce(excluded.email, profiles.email);

  if not exists (
    select 1
    from public.organization_members
    where user_id = new.id
  ) then
    new_org_name := coalesce(
      nullif(trim(new.raw_user_meta_data->>'organization_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Minha organização'
    );

    insert into public.organizations (nome)
    values (new_org_name)
    returning id into new_org_id;

    insert into public.organization_members (organization_id, user_id, papel)
    values (new_org_id, new.id, 'admin');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
