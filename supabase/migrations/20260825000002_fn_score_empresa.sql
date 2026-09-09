-- RPC: fn_score_empresa
-- Calcula score da empresa baseado em: atividades, contatos, captações, tempo

CREATE OR REPLACE FUNCTION fn_score_empresa(p_empresa_crm_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  score integer := 0;
  n_atividades integer;
  n_contatos integer;
  n_captacoes integer;
  n_captacoes_ativas integer;
  n_editais integer;
  dias_desde_criacao integer;
  ultima_atividade_dias integer;
BEGIN
  -- Contar atividades (últimos 90 dias)
  SELECT count(*) INTO n_atividades
  FROM atividades
  WHERE empresa_crm_id = p_empresa_crm_id
    AND created_at >= now() - interval '90 days';

  -- Contar contatos
  SELECT count(*) INTO n_contatos
  FROM contatos
  WHERE empresa_crm_id = p_empresa_crm_id;

  -- Contar captações totais e ativas
  SELECT count(*), count(*) FILTER (WHERE status NOT IN ('recusado', 'aprovado'))
  INTO n_captacoes, n_captacoes_ativas
  FROM captacoes
  WHERE empresa_crm_id = p_empresa_crm_id;

  -- Contar editais inscritos
  SELECT count(*) INTO n_editais
  FROM editais_user
  WHERE empresa_crm_id = p_empresa_crm_id;

  -- Dias desde criação
  SELECT EXTRACT(DAY FROM now() - created_at)::int INTO dias_desde_criacao
  FROM empresas_crm
  WHERE id = p_empresa_crm_id;

  -- Dias desde última atividade
  SELECT EXTRACT(DAY FROM now() - max(created_at))::int INTO ultima_atividade_dias
  FROM atividades
  WHERE empresa_crm_id = p_empresa_crm_id;

  -- === SCORING ===

  -- Atividades recentes (max 30pts)
  score := score + LEAST(n_atividades * 3, 30);

  -- Contatos cadastrados (max 20pts)
  score := score + LEAST(n_contatos * 5, 20);

  -- Captações ativas (max 25pts)
  score := score + LEAST(n_captacoes_ativas * 8, 25);

  -- Captações totais (max 10pts)
  score := score + LEAST(n_captacoes * 2, 10);

  -- Editais inscritos (max 15pts)
  score := score + LEAST(n_editais * 5, 15);

  -- Bônus: tem atividade nos últimos 7 dias (+10)
  IF ultima_atividade_dias IS NOT NULL AND ultima_atividade_dias <= 7 THEN
    score := score + 10;
  ELSIF ultima_atividade_dias IS NOT NULL AND ultima_atividade_dias <= 30 THEN
    score := score + 5;
  END IF;

  -- Penalidade: empresa muito antiga sem atividade
  IF dias_desde_criacao > 180 AND (ultima_atividade_dias IS NULL OR ultima_atividade_dias > 60) THEN
    score := score - 10;
  END IF;

  -- Clamp 0-100
  score := GREATEST(0, LEAST(100, score));

  RETURN score;
END;
$$;
