-- =============================================================
--  JARDS — Migração 010: Trigger de criação de organização no signup
--  2026-07-26
--
--  Estende o handle_new_user() existente para criar automaticamente
--  uma organização pessoal para cada novo usuário registrado,
--  adicionando-o como admin dessa organização.
-- =============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  org_id    uuid;
  org_nome  text;
begin
  -- Comportamento existente: criar profile
  insert into profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  -- Derivar nome da organização do metadata do usuário
  org_nome := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Minha Organização'
  );

  -- Criar organização pessoal
  insert into organizations (nome)
  values (org_nome)
  returning id into org_id;

  -- Adicionar usuário como admin
  insert into organization_members (organization_id, user_id, papel)
  values (org_id, new.id, 'admin');

  return new;
end;
$$;
