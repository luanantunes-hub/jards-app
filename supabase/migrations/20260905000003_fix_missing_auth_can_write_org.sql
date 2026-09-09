-- auth_can_write_org nunca existiu de fato no banco (a migração
-- 20260830080000_team_access_roles.sql que a criava nunca foi aplicada),
-- mas fn_renovar_captacao/fn_renovar_inscricao dependem dela desde que
-- foram criadas. Recria usando o vocabulário de papéis que realmente
-- existe hoje (admin/captador/visualizador) — sem tocar na renomeação
-- de papéis nem nas políticas RLS amplas, que são uma decisão maior e
-- separada (ver 20260830080000_team_access_roles.sql, ainda pendente).

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
      AND member.papel IN ('admin', 'captador')
  );
$function$;

REVOKE ALL ON FUNCTION public.auth_can_write_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_can_write_org(uuid) TO authenticated, service_role;
