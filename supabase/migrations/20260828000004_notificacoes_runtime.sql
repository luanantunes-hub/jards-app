CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  organization_id UUID,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON public.notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_unread ON public.notificacoes(user_id, lida) WHERE lida = FALSE;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select_own" ON public.notificacoes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notificacoes_update_own" ON public.notificacoes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
REVOKE INSERT ON public.notificacoes FROM authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificar_atividade_concluida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_nome TEXT;
  v_captador_responsavel UUID;
  v_organization_id UUID;
  v_account_id UUID;
  v_responsavel_nome TEXT;
BEGIN
  IF NEW.feita = TRUE AND COALESCE(OLD.feita, FALSE) = FALSE THEN
    SELECT e.nome, c.captador_id, c.organization_id, c.account_id
      INTO v_empresa_nome, v_captador_responsavel, v_organization_id, v_account_id
    FROM public.captacoes c
    LEFT JOIN public.empresas_crm e ON e.id = c.empresa_crm_id
    WHERE c.id = NEW.captacao_id;

    SELECT full_name INTO v_responsavel_nome
    FROM public.profiles
    WHERE id = NEW.responsavel_id;

    IF v_captador_responsavel IS NOT NULL AND v_captador_responsavel IS DISTINCT FROM NEW.responsavel_id THEN
      INSERT INTO public.notificacoes (account_id, organization_id, user_id, tipo, titulo, mensagem, link)
      VALUES (
        COALESCE(v_account_id, NEW.account_id), v_organization_id, v_captador_responsavel,
        'atividade_concluida', 'Atividade concluída',
        COALESCE(v_responsavel_nome, 'Um membro') || ' concluiu uma atividade na captação de ' || COALESCE(v_empresa_nome, 'uma empresa'),
        '/captacoes/' || NEW.captacao_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
