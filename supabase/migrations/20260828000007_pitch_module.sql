CREATE TABLE IF NOT EXISTS public.pitch_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'comercial', patrocinador_alvo TEXT, status TEXT NOT NULL DEFAULT 'rascunho', tema TEXT NOT NULL DEFAULT 'jards', versao INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pitch_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), deck_id UUID NOT NULL REFERENCES public.pitch_decks(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, titulo TEXT NOT NULL, conteudo TEXT, dados JSONB NOT NULL DEFAULT '{}', notas TEXT, ordem INTEGER NOT NULL DEFAULT 0, ativo BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pitch_argumentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE, deck_id UUID REFERENCES public.pitch_decks(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL, ideia_central TEXT, evidencia TEXT, versao_15s TEXT, versao_30s TEXT, versao_90s TEXT, perfil TEXT, dominio INTEGER NOT NULL DEFAULT 0 CHECK (dominio BETWEEN 0 AND 5), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pitch_objecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE, deck_id UUID REFERENCES public.pitch_decks(id) ON DELETE SET NULL,
  categoria TEXT NOT NULL, objecao TEXT NOT NULL, interpretacao TEXT, pergunta_diagnostico TEXT, resposta_curta TEXT, resposta_aprofundada TEXT, evidencias TEXT, frequencia INTEGER NOT NULL DEFAULT 0, resultado TEXT, created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pitch_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id UUID NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE, deck_id UUID REFERENCES public.pitch_decks(id) ON DELETE CASCADE,
  slide_id UUID REFERENCES public.pitch_slides(id) ON DELETE SET NULL, objecao_id UUID REFERENCES public.pitch_objecoes(id) ON DELETE SET NULL, tipo TEXT NOT NULL DEFAULT 'pergunta_resposta', frente TEXT NOT NULL, verso TEXT NOT NULL, dominio INTEGER NOT NULL DEFAULT 0, proxima_revisao DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.pitch_card_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), card_id UUID NOT NULL REFERENCES public.pitch_cards(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(), avaliacao TEXT NOT NULL CHECK (avaliacao IN ('nao_lembrei','quase','lembrei')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['pitch_decks','pitch_argumentos','pitch_objecoes','pitch_cards'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.projetos_crm p WHERE p.id = projeto_id AND (p.account_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid())))) WITH CHECK (EXISTS (SELECT 1 FROM public.projetos_crm p WHERE p.id = projeto_id AND (p.account_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = p.organization_id AND om.user_id = auth.uid()))))', t || '_project_access', t);
  END LOOP;
END $$;
ALTER TABLE public.pitch_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pitch_slides_deck_access" ON public.pitch_slides FOR ALL USING (EXISTS (SELECT 1 FROM public.pitch_decks d JOIN public.projetos_crm p ON p.id=d.projeto_id WHERE d.id=deck_id AND (p.account_id=auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id=p.organization_id AND om.user_id=auth.uid())))) WITH CHECK (EXISTS (SELECT 1 FROM public.pitch_decks d JOIN public.projetos_crm p ON p.id=d.projeto_id WHERE d.id=deck_id AND (p.account_id=auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id=p.organization_id AND om.user_id=auth.uid()))));
ALTER TABLE public.pitch_card_revisoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pitch_card_revisoes_own" ON public.pitch_card_revisoes FOR ALL USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_decks, public.pitch_slides, public.pitch_argumentos, public.pitch_objecoes, public.pitch_cards, public.pitch_card_revisoes TO authenticated;
