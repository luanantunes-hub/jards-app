-- Migration: Score de Atividade do Captador
-- Calcula pontuação baseada em ações recentes

-- Função para calcular score de atividade de um captador
-- Pontuação: ações nos últimos 30 dias (cada ação = 10 pontos)
-- Máximo: 100 pontos (10 ações)
CREATE OR REPLACE FUNCTION fn_calcular_score_atividade(
  p_user_id UUID,
  p_organization_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_total_acoes INTEGER;
  v_score INTEGER;
BEGIN
  -- Conta ações concluídas nos últimos 30 dias
  SELECT COUNT(*) INTO v_total_acoes
  FROM atividades a
  JOIN captacoes c ON c.id = a.captacao_id
  WHERE a.responsavel_id = p_user_id
    AND c.organization_id = p_organization_id
    AND a.concluida = true
    AND a.data_conclusao >= NOW() - INTERVAL '30 days';

  -- Cada ação = 10 pontos, máximo 100
  v_score := LEAST(v_total_acoes * 10, 100);

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para calcular métricas do captador
CREATE OR REPLACE FUNCTION fn_metricas_captador(
  p_user_id UUID,
  p_organization_id UUID
) RETURNS TABLE (
  total_captações BIGINT,
  captações_ativas BIGINT,
  captações_ganhas BIGINT,
  captações_perdidas BIGINT,
  score_atividade INTEGER,
  empresas_atribuidas BIGINT,
  empresas_em_risco BIGINT,
  dias_sem_avanco INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total de captações
    (SELECT COUNT(*) FROM captacoes WHERE captador_id = p_user_id AND organization_id = p_organization_id)::BIGINT,
    -- Captações ativas (em andamento)
    (SELECT COUNT(*) FROM captacoes WHERE captador_id = p_user_id AND organization_id = p_organization_id AND status IN ('agendada', 'em_andamento'))::BIGINT,
    -- Captações ganhas
    (SELECT COUNT(*) FROM captacoes WHERE captador_id = p_user_id AND organization_id = p_organization_id AND status = 'ganha')::BIGINT,
    -- Captações perdidas
    (SELECT COUNT(*) FROM captacoes WHERE captador_id = p_user_id AND organization_id = p_organization_id AND status = 'perdida')::BIGINT,
    -- Score de atividade
    fn_calcular_score_atividade(p_user_id, p_organization_id),
    -- Empresas com exclusividade ativa
    (SELECT COUNT(*) FROM atribuicoes WHERE captador_user_id = p_user_id AND organization_id = p_organization_id AND status = 'ativa')::BIGINT,
    -- Empresas em risco (sem avanço > 60 dias)
    (SELECT COUNT(*) FROM atribuicoes WHERE captador_user_id = p_user_id AND organization_id = p_organization_id AND status = 'ativa' AND ultimo_avanco < NOW() - INTERVAL '60 days')::BIGINT,
    -- Dias médios sem avanco
    (SELECT COALESCE(AVG(EXTRACT(DAY FROM NOW() - ultimo_avanco))::INTEGER, 0) FROM atribuicoes WHERE captador_user_id = p_user_id AND organization_id = p_organization_id AND status = 'ativa')::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para as funções (não precisa de RLS para funções SECURITY DEFINER, mas criamos grants)
GRANT EXECUTE ON FUNCTION fn_calcular_score_atividade TO authenticated;
GRANT EXECUTE ON FUNCTION fn_metricas_captador TO authenticated;
