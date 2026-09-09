-- RPC: fn_receita_empresa
-- Retorna receita total, receitavigente, próxima renovação para uma empresa

CREATE OR REPLACE FUNCTION fn_receita_empresa(p_empresa_crm_id uuid)
RETURNS TABLE (
  receita_total numeric,
  receita_vigente numeric,
  proxima_renovacao date,
  n_contratos integer,
  n_contas integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    coalesce(sum(c.valor), 0)::numeric as receita_total,
    coalesce(sum(c.valor) FILTER (WHERE c.status = 'vigente'), 0)::numeric as receita_vigente,
    min(c.proxima_renovacao)::date as proxima_renovacao,
    count(c.id)::integer as n_contratos,
    (SELECT count(*)::integer FROM contas_patrocinio WHERE empresa_crm_id = p_empresa_crm_id) as n_contas
  FROM contratos c
  JOIN contas_patrocinio cp ON cp.id = c.conta_patrocinio_id
  WHERE cp.empresa_crm_id = p_empresa_crm_id
    AND c.status IN ('assinado', 'vigente', 'renovado');
END;
$$;
