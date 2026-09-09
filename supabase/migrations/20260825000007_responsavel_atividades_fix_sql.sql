-- Migration 007: responsavel_id + fix SQL functions quebradas
-- Adiciona responsavel_id em atividades e corrige 3 funções que referenciam colunas inexistentes

-- ─────────────────────────────────────────────
--  1. Coluna responsavel_id
-- ─────────────────────────────────────────────
alter table atividades
  add column if not exists responsavel_id uuid references profiles(id);

create index if not exists idx_atividades_responsavel on atividades(responsavel_id);

-- ─────────────────────────────────────────────
--  2. Fix: score_atividade_captador (migration 018)
--  Referenciava captador_id (não existe) → usa responsavel_id
-- ─────────────────────────────────────────────
create or replace function score_atividade_captador(
  p_user_id uuid,
  p_dias integer default 90
)
returns integer
language sql
security definer
set search_path = public
as $$
  with total as (
    select count(*) as cnt
    from atividades
    where responsavel_id = p_user_id
      and created_at >= now() - (p_dias || ' days')::interval
  ),
  feitas as (
    select count(*) as cnt
    from atividades
    where responsavel_id = p_user_id
      and feita = true
      and created_at >= now() - (p_dias || ' days')::interval
  )
  select case
    when t.cnt = 0 then 0
    else round((f.cnt::numeric / t.cnt::numeric) * 100)::integer
  end
  from total t, feitas f;
$$;

-- ─────────────────────────────────────────────
--  3. Fix: fn_calcular_score_atividade (migration 019)
--  Referenciava concluida → feita, data_conclusao → data_realizada
-- ─────────────────────────────────────────────
create or replace function fn_calcular_score_atividade(
  p_user_id UUID,
  p_organization_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_total_acoes INTEGER;
  v_score INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_acoes
  FROM atividades a
  JOIN captacoes c ON c.id = a.captacao_id
  WHERE a.responsavel_id = p_user_id
    AND c.organization_id = p_organization_id
    AND a.feita = true
    AND a.data_realizada >= NOW() - INTERVAL '30 days';

  v_score := LEAST(v_total_acoes * 10, 100);
  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
--  4. Fix: fn_notificar_atividade_concluida (migration 020)
--  Referenciava concluida → feita, responsavel_id agora existe
-- ─────────────────────────────────────────────
create or replace function fn_notificar_atividade_concluida()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_nome TEXT;
  v_captador_responsavel UUID;
  v_organization_id UUID;
  v_account_id UUID;
  v_responsavel_nome TEXT;
BEGIN
  IF NEW.feita = TRUE AND (OLD.feita IS NULL OR OLD.feita = FALSE) THEN
    SELECT
      e.nome,
      c.captador_id,
      c.organization_id,
      c.account_id
    INTO v_empresa_nome, v_captador_responsavel, v_organization_id, v_account_id
    FROM captacoes c
    LEFT JOIN empresas_crm e ON e.id = c.empresa_crm_id
    WHERE c.id = NEW.captacao_id;

    SELECT full_name INTO v_responsavel_nome
    FROM profiles
    WHERE id = NEW.responsavel_id;

    IF v_captador_responsavel IS NOT NULL AND v_captador_responsavel != NEW.responsavel_id THEN
      INSERT INTO notificacoes (account_id, organization_id, user_id, tipo, titulo, mensagem, link)
      VALUES (
        v_account_id,
        v_organization_id,
        v_captador_responsavel,
        'atividade_concluida',
        'Atividade concluída',
        COALESCE(v_responsavel_nome, 'Um membro') || ' concluiu uma atividade na captação de ' || COALESCE(v_empresa_nome, 'uma empresa'),
        '/captacoes/' || NEW.captacao_id
      );
    END IF;

    IF v_empresa_nome IS NOT NULL THEN
      INSERT INTO notificacoes (account_id, organization_id, user_id, tipo, titulo, mensagem, link)
      SELECT DISTINCT
        c.account_id,
        c.organization_id,
        c.captador_id,
        'atividade_empresa',
        'Movimentação na empresa',
        COALESCE(v_responsavel_nome, 'Um membro') || ' registrou atividade em ' || v_empresa_nome,
        '/captacoes/' || c2.id
      FROM captacoes c2
      JOIN empresas_crm e ON e.id = c2.empresa_crm_id
      JOIN captacoes c ON c.empresa_crm_id = c2.empresa_crm_id
      WHERE e.nome = v_empresa_nome
        AND c2.captador_id != NEW.responsavel_id
        AND c2.captador_id IS NOT NULL
        AND c2.organization_id = v_organization_id
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
