ALTER TABLE public.campos_resposta ALTER COLUMN account_id SET DEFAULT auth.uid();
ALTER TABLE public.respostas_modelo ALTER COLUMN account_id SET DEFAULT auth.uid();
ALTER TABLE public.respostas_inscricao ALTER COLUMN account_id SET DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.perguntas_projeto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos_crm(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES public.campos_resposta(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, campo_id)
);

ALTER TABLE public.perguntas_projeto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perguntas_projeto_own" ON public.perguntas_projeto;
CREATE POLICY "perguntas_projeto_own" ON public.perguntas_projeto FOR ALL
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

INSERT INTO public.perguntas_projeto (account_id, projeto_id, campo_id)
SELECT DISTINCT rm.account_id, rm.projeto_id, rm.campo_id FROM public.respostas_modelo rm
ON CONFLICT (projeto_id, campo_id) DO NOTHING;

INSERT INTO public.perguntas_projeto (account_id, projeto_id, campo_id)
SELECT DISTINCT ri.account_id, eu.projeto_id, ri.campo_id
FROM public.respostas_inscricao ri
JOIN public.editais_user eu ON eu.id = ri.inscricao_id
WHERE eu.projeto_id IS NOT NULL
ON CONFLICT (projeto_id, campo_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_perguntas_projeto(p_projeto_id uuid, p_busca text DEFAULT '')
RETURNS TABLE (campo_id uuid, campo_nome text, modelo_texto text, tem_modelo boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT cr.id, cr.nome, rm.conteudo, rm.id IS NOT NULL
  FROM public.perguntas_projeto pp
  JOIN public.campos_resposta cr ON cr.id = pp.campo_id
  LEFT JOIN public.respostas_modelo rm ON rm.projeto_id = pp.projeto_id AND rm.campo_id = pp.campo_id
  WHERE pp.projeto_id = p_projeto_id
    AND pp.account_id = auth.uid()
    AND (coalesce(trim(p_busca), '') = '' OR cr.nome ILIKE '%' || trim(p_busca) || '%')
  ORDER BY cr.nome
  LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.adicionar_pergunta_inscricao(p_inscricao_id uuid, p_projeto_id uuid, p_campo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_modelo text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projetos_crm WHERE id = p_projeto_id AND account_id = v_uid) THEN RAISE EXCEPTION 'Projeto não encontrado ou sem acesso'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.editais_user WHERE id = p_inscricao_id AND projeto_id = p_projeto_id AND account_id = v_uid) THEN RAISE EXCEPTION 'Inscrição não encontrada ou não vinculada ao projeto'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.campos_resposta WHERE id = p_campo_id AND account_id = v_uid) THEN RAISE EXCEPTION 'Pergunta não encontrada'; END IF;
  INSERT INTO public.perguntas_projeto(account_id, projeto_id, campo_id) VALUES (v_uid, p_projeto_id, p_campo_id) ON CONFLICT (projeto_id, campo_id) DO NOTHING;
  SELECT conteudo INTO v_modelo FROM public.respostas_modelo WHERE projeto_id = p_projeto_id AND campo_id = p_campo_id;
  INSERT INTO public.respostas_inscricao(account_id, inscricao_id, campo_id, conteudo, updated_at)
  VALUES (v_uid, p_inscricao_id, p_campo_id, coalesce(v_modelo, ''), now())
  ON CONFLICT (inscricao_id, campo_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.criar_pergunta_inscricao(p_inscricao_id uuid, p_projeto_id uuid, p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_campo_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF coalesce(trim(p_nome), '') = '' THEN RAISE EXCEPTION 'Informe a pergunta'; END IF;
  INSERT INTO public.campos_resposta(account_id, nome) VALUES (v_uid, trim(p_nome))
  ON CONFLICT (account_id, nome_key) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_campo_id;
  PERFORM public.adicionar_pergunta_inscricao(p_inscricao_id, p_projeto_id, v_campo_id);
  RETURN v_campo_id;
END $$;

CREATE OR REPLACE FUNCTION public.get_registros_inscricao(p_inscricao_id uuid, p_projeto_id uuid)
RETURNS TABLE (campo_id uuid, campo_nome text, conteudo text, modelo_texto text, tem_modelo boolean)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT cr.id, cr.nome, ri.conteudo, rm.conteudo, rm.id IS NOT NULL
  FROM public.respostas_inscricao ri
  JOIN public.campos_resposta cr ON cr.id = ri.campo_id
  LEFT JOIN public.respostas_modelo rm ON rm.campo_id = ri.campo_id AND rm.projeto_id = p_projeto_id
  WHERE ri.inscricao_id = p_inscricao_id AND ri.account_id = auth.uid()
  ORDER BY ri.updated_at DESC, cr.nome;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perguntas_projeto TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_perguntas_projeto(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adicionar_pergunta_inscricao(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_pergunta_inscricao(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_registros_inscricao(uuid, uuid) TO authenticated;
