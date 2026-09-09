-- Permite registrar a resposta da pergunta de principal forma de seleção
-- independentemente da resposta sobre o edital funcionar.
ALTER TABLE public.edital_votos
  ADD COLUMN IF NOT EXISTS principal_selecao BOOLEAN;

-- Um usuário pode responder apenas uma das perguntas. NULL significa que
-- ainda não respondeu à pergunta "Esse edital funciona?".
ALTER TABLE public.edital_votos
  ALTER COLUMN funciona DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_votar_edital_principal(
  p_edital_id UUID,
  p_valor BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO public.edital_votos (edital_id, user_id, funciona, principal_selecao)
  VALUES (p_edital_id, auth.uid(), NULL, p_valor)
  ON CONFLICT (edital_id, user_id)
  DO UPDATE SET principal_selecao = EXCLUDED.principal_selecao;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_votar_edital_principal(UUID, BOOLEAN) TO authenticated;
