-- Papéis coerentes para usuários internos.
-- Captador permanece apenas para compatibilidade com acessos externos.

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_papel_check;

UPDATE public.organization_members
SET papel = 'colaborador'
WHERE papel = 'visualizador';

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_papel_check
  CHECK (papel IN ('admin', 'colaborador', 'leitor', 'captador'));

ALTER TABLE public.organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_role_check;

UPDATE public.organization_invitations
SET role = 'colaborador'
WHERE role = 'visualizador';

ALTER TABLE public.organization_invitations
  ALTER COLUMN role SET DEFAULT 'colaborador',
  ADD CONSTRAINT organization_invitations_role_check
  CHECK (role IN ('admin', 'colaborador', 'leitor', 'captador'));

CREATE OR REPLACE FUNCTION public.auth_can_write_org(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members member
    WHERE member.organization_id = target_org
      AND member.user_id = auth.uid()
      AND member.papel IN ('admin', 'colaborador', 'captador')
  );
$function$;

REVOKE ALL ON FUNCTION public.auth_can_write_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_can_write_org(uuid) TO authenticated, service_role;

-- Uma política restritiva complementa as políticas existentes: leitores
-- continuam vendo dados da organização, mas não podem alterá-los diretamente.
DO $block$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT namespace.nspname AS schema_name, relation.relname AS table_name
    FROM pg_class relation
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN pg_attribute attribute ON attribute.attrelid = relation.oid
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND relation.relrowsecurity
      AND attribute.attname = 'organization_id'
      AND NOT attribute.attisdropped
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 'team role: insert', target_table.schema_name, target_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 'team role: update', target_table.schema_name, target_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 'team role: delete', target_table.schema_name, target_table.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.auth_can_write_org(organization_id))',
      'team role: insert', target_table.schema_name, target_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.auth_can_write_org(organization_id)) WITH CHECK (public.auth_can_write_org(organization_id))',
      'team role: update', target_table.schema_name, target_table.table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.auth_can_write_org(organization_id))',
      'team role: delete', target_table.schema_name, target_table.table_name
    );
  END LOOP;
END;
$block$;

CREATE OR REPLACE FUNCTION public.add_organization_member_with_seat(
  target_org uuid,
  target_user uuid,
  target_role text DEFAULT 'colaborador'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  member_id uuid;
  capacity integer;
  used_seats integer;
BEGIN
  IF target_role NOT IN ('admin', 'colaborador', 'leitor', 'captador') THEN
    RAISE EXCEPTION 'Papel de membro invalido.' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org AND user_id = target_user
  ) THEN
    RAISE EXCEPTION 'Este usuario ja faz parte da equipe.' USING errcode = '23505';
  END IF;

  IF target_role <> 'captador' THEN
    SELECT 1 + coalesce(seats.purchased_seats, 0)
      INTO capacity
    FROM (SELECT 1) seed
    LEFT JOIN public.organization_seats seats ON seats.organization_id = target_org;

    SELECT
      (SELECT count(*) FROM public.organization_members
       WHERE organization_id = target_org AND papel <> 'captador')
      +
      (SELECT count(*) FROM public.organization_invitations
       WHERE organization_id = target_org AND status = 'pending' AND role <> 'captador')
      INTO used_seats;

    IF used_seats >= capacity THEN
      RAISE EXCEPTION 'Nao ha assentos disponiveis nesta organizacao.' USING errcode = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, papel)
  VALUES (target_org, target_user, target_role)
  RETURNING id INTO member_id;
  RETURN member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_organization_invitation(
  target_org uuid,
  target_email text,
  target_role text,
  inviter uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
  capacity integer;
  used_seats integer;
BEGIN
  IF normalized_email = '' OR position('@' IN normalized_email) = 0 THEN
    RAISE EXCEPTION 'E-mail invalido.' USING errcode = '22023';
  END IF;
  IF target_role NOT IN ('admin', 'colaborador', 'leitor', 'captador') THEN
    RAISE EXCEPTION 'Papel de membro invalido.' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.organization_members member
    JOIN public.profiles profile ON profile.id = member.user_id
    WHERE member.organization_id = target_org AND lower(profile.email) = normalized_email
  ) THEN
    RAISE EXCEPTION 'Este usuario ja faz parte da equipe.' USING errcode = '23505';
  END IF;

  IF target_role <> 'captador' THEN
    SELECT 1 + coalesce(seats.purchased_seats, 0)
      INTO capacity
    FROM (SELECT 1) seed
    LEFT JOIN public.organization_seats seats ON seats.organization_id = target_org;

    SELECT
      (SELECT count(*) FROM public.organization_members
       WHERE organization_id = target_org AND papel <> 'captador')
      +
      (SELECT count(*) FROM public.organization_invitations
       WHERE organization_id = target_org AND status = 'pending' AND role <> 'captador')
      INTO used_seats;

    IF used_seats >= capacity THEN
      RAISE EXCEPTION 'Nao ha assentos disponiveis nesta organizacao.' USING errcode = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.organization_invitations (organization_id, email, role, status, invited_by)
  VALUES (target_org, normalized_email, target_role, 'pending', inviter)
  RETURNING id INTO invitation_id;
  RETURN invitation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_organization_member_with_seat(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_organization_invitation(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_organization_member_with_seat(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_organization_invitation(uuid, text, text, uuid) TO service_role;
