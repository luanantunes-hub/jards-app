-- Dados de aquisição e onboarding dos novos usuários.

alter table public.profiles
  add column if not exists onde_conheceu text,
  add column if not exists cargo_funcao text,
  add column if not exists tipo_organizacao text,
  add column if not exists tamanho_equipe text,
  add column if not exists objetivo_principal text,
  add column if not exists onboarding_completed boolean not null default true;

-- Contas já existentes não devem ser interrompidas pelo novo onboarding.
update public.profiles
set onboarding_completed = true
where onboarding_completed is distinct from true;

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
  insert into public.profiles (id, full_name, email, onde_conheceu, onboarding_completed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    new.raw_user_meta_data->>'onde_conheceu',
    false
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    email = coalesce(excluded.email, profiles.email),
    onde_conheceu = coalesce(excluded.onde_conheceu, profiles.onde_conheceu);

  if not exists (
    select 1 from public.organization_members where user_id = new.id
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
