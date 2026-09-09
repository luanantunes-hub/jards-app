-- Segurança do backoffice: somente superadmins Jards podem ler auditoria e
-- usuários autenticados nunca podem promover a própria conta.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jards_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.is_jards_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT profile.jards_super_admin
       FROM public.profiles AS profile
      WHERE profile.id = auth.uid()),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_jards_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_jards_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_jards_super_admin_self_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.jards_super_admin IS DISTINCT FROM OLD.jards_super_admin
     AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'jards_super_admin só pode ser alterado pelo serviço administrativo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_jards_super_admin_self_change ON public.profiles;
CREATE TRIGGER trg_prevent_jards_super_admin_self_change
BEFORE UPDATE OF jards_super_admin ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_jards_super_admin_self_change();

DO $$
BEGIN
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "admin_audit_logs: select admin" ON public.admin_audit_logs;
    DROP POLICY IF EXISTS "admin_audit_logs: select superadmin" ON public.admin_audit_logs;
    CREATE POLICY "admin_audit_logs: select superadmin"
      ON public.admin_audit_logs
      FOR SELECT TO authenticated
      USING (public.is_jards_super_admin());

    REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;
    GRANT SELECT ON public.admin_audit_logs TO authenticated;
  END IF;
END;
$$;
