ALTER TABLE public.projetos_crm
  ADD COLUMN IF NOT EXISTS fase TEXT NOT NULL DEFAULT 'planejamento'
    CHECK (fase IN ('planejamento','captacao','execucao','prestacao','concluido')),
  ADD COLUMN IF NOT EXISTS ponto_focal_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mecanismo TEXT,
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS data_fim DATE,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS abrangencia TEXT,
  ADD COLUMN IF NOT EXISTS areas_culturais TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS valor_garantido NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_garantido >= 0),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibilidade TEXT NOT NULL DEFAULT 'equipe' CHECK (visibilidade IN ('equipe','restrita')),
  ADD COLUMN IF NOT EXISTS status_operacional TEXT NOT NULL DEFAULT 'ativo' CHECK (status_operacional IN ('ativo','pausado','arquivado'));

ALTER TABLE public.projetos_crm DROP CONSTRAINT IF EXISTS projetos_crm_periodo_valido;
ALTER TABLE public.projetos_crm ADD CONSTRAINT projetos_crm_periodo_valido
  CHECK (data_fim IS NULL OR data_inicio IS NULL OR data_fim >= data_inicio);

CREATE INDEX IF NOT EXISTS idx_projetos_crm_ponto_focal ON public.projetos_crm(ponto_focal_id);
CREATE INDEX IF NOT EXISTS idx_projetos_crm_fase ON public.projetos_crm(organization_id, fase);

CREATE TABLE IF NOT EXISTS public.projeto_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(projeto_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.projeto_recursos_proprios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','confirmado','recebido')),
  previsao DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projeto_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  evento TEXT NOT NULL,
  descricao TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projeto_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  conteudo TEXT NOT NULL CHECK (length(trim(conteudo)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_recursos_proprios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_comentarios ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['projeto_membros','projeto_recursos_proprios','projeto_historico','projeto_comentarios'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING (EXISTS (SELECT 1 FROM public.projetos_crm p WHERE p.id = projeto_id AND (p.account_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()))))', table_name || '_select_project', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.projetos_crm p WHERE p.id = projeto_id AND (p.account_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid())))) WITH CHECK (EXISTS (SELECT 1 FROM public.projetos_crm p WHERE p.id = projeto_id AND (p.account_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()))))', table_name || '_manage_project', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_membros, public.projeto_recursos_proprios, public.projeto_historico, public.projeto_comentarios TO authenticated;

CREATE OR REPLACE FUNCTION public.log_projeto_structural_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF ROW(OLD.nome, OLD.fase, OLD.ponto_focal_id, OLD.valor_alvo, OLD.valor_garantido, OLD.status_operacional, OLD.data_inicio, OLD.data_fim)
     IS DISTINCT FROM
     ROW(NEW.nome, NEW.fase, NEW.ponto_focal_id, NEW.valor_alvo, NEW.valor_garantido, NEW.status_operacional, NEW.data_inicio, NEW.data_fim) THEN
    INSERT INTO public.projeto_historico(projeto_id, user_id, evento, descricao, dados)
    VALUES (NEW.id, auth.uid(), 'projeto_atualizado', 'Dados estruturais do projeto atualizados', jsonb_build_object(
      'antes', jsonb_build_object('nome', OLD.nome, 'fase', OLD.fase, 'ponto_focal_id', OLD.ponto_focal_id, 'objetivo', OLD.valor_alvo, 'garantido', OLD.valor_garantido, 'status', OLD.status_operacional, 'inicio', OLD.data_inicio, 'fim', OLD.data_fim),
      'depois', jsonb_build_object('nome', NEW.nome, 'fase', NEW.fase, 'ponto_focal_id', NEW.ponto_focal_id, 'objetivo', NEW.valor_alvo, 'garantido', NEW.valor_garantido, 'status', NEW.status_operacional, 'inicio', NEW.data_inicio, 'fim', NEW.data_fim)
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_projeto_structural_history ON public.projetos_crm;
CREATE TRIGGER trg_projeto_structural_history AFTER UPDATE ON public.projetos_crm
FOR EACH ROW EXECUTE FUNCTION public.log_projeto_structural_change();
