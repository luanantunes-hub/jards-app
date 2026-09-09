-- =============================================================
--  JARDS — Migração 011: Backfill de organization_id para dados existentes
--  2026-07-26
--
--  Para cada usuário que já tem registros no banco mas ainda não
--  tem uma organização (usuários criados antes da migração 010),
--  cria uma organização pessoal e popula organization_id em todos
--  os registros desse usuário.
-- =============================================================

do $$
declare
  rec     record;
  org_id  uuid;
  org_nome text;
begin
  -- Coletar todos os account_ids únicos que existem nas tabelas privadas
  for rec in
    select distinct account_id as uid from captacoes           where account_id is not null
    union
    select distinct account_id from projetos_crm              where account_id is not null
    union
    select distinct account_id from empresas_crm              where account_id is not null
    union
    select distinct account_id from editais_user              where account_id is not null
    union
    select distinct account_id from contatos                  where account_id is not null
    union
    select distinct account_id from atividades                where account_id is not null
  loop
    -- Verificar se já tem organização (do trigger, caso o user tenha se cadastrado após migração 010)
    select organization_id into org_id
    from organization_members
    where user_id = rec.uid
    limit 1;

    if org_id is null then
      -- Buscar nome do usuário para nomear a org
      select coalesce(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        split_part(email, '@', 1),
        'Minha Organização'
      ) into org_nome
      from auth.users
      where id = rec.uid;

      -- Criar organização
      insert into organizations (nome)
      values (coalesce(org_nome, 'Minha Organização'))
      returning id into org_id;

      -- Adicionar como admin
      insert into organization_members (organization_id, user_id, papel)
      values (org_id, rec.uid, 'admin');
    end if;

    -- Backfill organization_id em todas as tabelas privadas para este usuário
    update captacoes           set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update projetos_crm        set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update empresas_crm        set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update editais_user        set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update contatos            set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update atividades          set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update notas               set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update copy_templates      set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update sequencias_template set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update sequencias_passo    set organization_id = org_id where account_id = rec.uid and organization_id is null;
    update desbloqueios        set organization_id = org_id where account_id = rec.uid and organization_id is null;

  end loop;
end;
$$;
