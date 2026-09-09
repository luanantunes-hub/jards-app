CREATE OR REPLACE FUNCTION public.fn_set_atividade_concluida(
  p_atividade_id UUID,
  p_feita BOOLEAN,
  p_data_realizada DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_result JSONB;
BEGIN
  SELECT account_id INTO v_owner
  FROM public.atividades
  WHERE id = p_atividade_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Atividade não encontrada';
  END IF;

  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para atualizar esta atividade' USING ERRCODE = '42501';
  END IF;

  UPDATE public.atividades
  SET feita = p_feita,
      data_realizada = CASE WHEN p_feita THEN COALESCE(p_data_realizada, CURRENT_DATE) ELSE NULL END
  WHERE id = p_atividade_id
  RETURNING jsonb_build_object(
    'id', id,
    'feita', feita,
    'data_realizada', data_realizada
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_set_atividade_concluida(UUID, BOOLEAN, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_set_atividade_concluida(UUID, BOOLEAN, DATE) TO authenticated;
