-- Captadores externos nao consomem licencas pagas. Somente administradores e
-- visualizadores contam na capacidade de usuarios internos da organizacao.

CREATE OR REPLACE FUNCTION public.add_organization_member_with_seat(
  target_org uuid,
  target_user uuid,
  target_role text DEFAULT 'captador'
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
  IF target_role NOT IN ('admin', 'captador', 'visualizador') THEN
    RAISE EXCEPTION 'Papel de membro invalido.' USING errcode = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org AND user_id = target_user
  ) THEN
    RAISE EXCEPTION 'Este usuario ja faz parte da equipe.' USING errcode = '23505';
  END IF;

  -- Captadores pertencem ao fluxo operacional externo e nao usam assento.
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
  IF target_role NOT IN ('admin', 'captador', 'visualizador') THEN
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

  -- Convites de captadores nao reservam assentos pagos.
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
