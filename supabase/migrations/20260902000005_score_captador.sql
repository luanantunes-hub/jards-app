-- fn_score_captador: score composto por 4 dimensões
-- Substitui fn_calcular_score_atividade e fn_metricas_captador
--
-- D1 Conversão     35% — aprovado / (aprovado + reprovado) — neutro 50 sem histórico
-- D2 Saúde         25% — atribuições saudáveis vs em risco (penalidade ×40)
-- D3 Velocidade    25% — decaimento linear avg dias_sem_avanco / 0.9 em 90d
-- D4 Oferta        15% — proponentes ativos / 7 (calibrável)

CREATE OR REPLACE FUNCTION fn_score_captador(
  p_captador_id     UUID,
  p_organization_id UUID
)
RETURNS TABLE (
  score_total           INTEGER,
  score_conversao       INTEGER,
  score_saude_carteira  INTEGER,
  score_velocidade      INTEGER,
  score_cobertura       INTEGER,
  -- inputs brutos (para auditoria e exibição)
  total_fechadas        BIGINT,
  ganhas                BIGINT,
  perdidas              BIGINT,
  atribuicoes_ativas    BIGINT,
  atribuicoes_saudaveis BIGINT,
  empresas_em_risco     BIGINT,
  avg_dias_sem_avanco   NUMERIC,
  proponentes_ativos    BIGINT
) AS $$
DECLARE
  v_user_id     UUID;
  v_ganhas      BIGINT  := 0;
  v_perdidas    BIGINT  := 0;
  v_fechadas    BIGINT  := 0;
  v_ativas      BIGINT  := 0;
  v_saudaveis   BIGINT  := 0;
  v_em_risco    BIGINT  := 0;
  v_avg_dias    NUMERIC := 0;
  v_proponentes BIGINT  := 0;
  v_s1 INTEGER; v_s2 INTEGER;
  v_s3 INTEGER; v_s4 INTEGER;
  v_st INTEGER;
BEGIN
  -- Resolve auth user_id (para captações — FK auth.users)
  SELECT c.user_id INTO v_user_id
  FROM captadores c
  WHERE c.id = p_captador_id;

  -- ── D1: Conversão ──────────────────────────────────────────────────────────
  -- Captações com status 'aprovado' (ganhou) ou 'reprovado' (perdeu)
  -- Neutro = 50 quando sem histórico de deals encerrados
  IF v_user_id IS NOT NULL THEN
    SELECT
      COUNT(*) FILTER (WHERE status = 'aprovado'),
      COUNT(*) FILTER (WHERE status = 'reprovado'),
      COUNT(*) FILTER (WHERE status IN ('aprovado', 'reprovado'))
    INTO v_ganhas, v_perdidas, v_fechadas
    FROM captacoes
    WHERE captador_id     = v_user_id
      AND organization_id = p_organization_id;
  END IF;

  v_s1 := CASE
    WHEN v_fechadas = 0 THEN 50
    ELSE LEAST(100, ROUND(v_ganhas::NUMERIC / v_fechadas * 100))
  END;

  -- ── D2 + D3: Carteira e Velocidade ─────────────────────────────────────────
  -- Usa captador_user_id = captadores.id (FK corrigido em migration 026)
  SELECT
    COUNT(*) FILTER (WHERE status = 'ativa'),
    COUNT(*) FILTER (WHERE status = 'ativa'
      AND (ultimo_avanco IS NULL OR ultimo_avanco >= NOW() - INTERVAL '30 days')),
    COUNT(*) FILTER (WHERE status = 'ativa'
      AND ultimo_avanco < NOW() - INTERVAL '60 days'),
    COALESCE(AVG(dias_sem_avanco) FILTER (WHERE status = 'ativa'), 0)
  INTO v_ativas, v_saudaveis, v_em_risco, v_avg_dias
  FROM atribuicoes
  WHERE captador_user_id = p_captador_id
    AND organization_id  = p_organization_id;

  -- D2: saúde da carteira — penalidade 40× por empresa em risco (loss aversion)
  v_s2 := CASE
    WHEN v_ativas = 0 THEN 0
    ELSE GREATEST(0, LEAST(100, ROUND(
      (v_saudaveis::NUMERIC / v_ativas * 100)
      - (v_em_risco::NUMERIC  / v_ativas * 40)
    )))
  END;

  -- D3: velocidade — decaimento linear: 0d→100, 45d→50, 90d→0
  v_s3 := GREATEST(0, LEAST(100, ROUND(100 - (v_avg_dias / 0.9))));

  -- ── D4: Cobertura de oferta ────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_proponentes
  FROM captador_proponente
  WHERE captador_id = p_captador_id
    AND status      = 'ativo';

  -- 7 proponentes = score máximo (calibrável)
  v_s4 := LEAST(100, ROUND(v_proponentes::NUMERIC / 7.0 * 100));

  -- ── Score total ponderado ──────────────────────────────────────────────────
  v_st := ROUND(
    v_s1 * 0.35 +
    v_s2 * 0.25 +
    v_s3 * 0.25 +
    v_s4 * 0.15
  );

  RETURN QUERY SELECT
    v_st,
    v_s1, v_s2, v_s3, v_s4,
    v_fechadas, v_ganhas, v_perdidas,
    v_ativas, v_saudaveis, v_em_risco,
    v_avg_dias, v_proponentes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION fn_score_captador(UUID, UUID) TO authenticated;
