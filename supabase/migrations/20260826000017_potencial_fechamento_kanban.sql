-- Kanban de potencial de fechamento
-- Mantém `prioridade` como prioridade operacional e adiciona uma dimensão
-- comercial independente, limitada às tabelas privadas por organização.

ALTER TABLE captacoes
  ADD COLUMN IF NOT EXISTS potencial_fechamento text NOT NULL DEFAULT 'medio';

ALTER TABLE editais_user
  ADD COLUMN IF NOT EXISTS potencial_fechamento text NOT NULL DEFAULT 'medio';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'captacoes_potencial_fechamento_check'
      AND conrelid = 'captacoes'::regclass
  ) THEN
    ALTER TABLE captacoes
      ADD CONSTRAINT captacoes_potencial_fechamento_check
      CHECK (potencial_fechamento IN ('baixo', 'medio', 'alto'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'editais_user_potencial_fechamento_check'
      AND conrelid = 'editais_user'::regclass
  ) THEN
    ALTER TABLE editais_user
      ADD CONSTRAINT editais_user_potencial_fechamento_check
      CHECK (potencial_fechamento IN ('baixo', 'medio', 'alto'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_captacoes_org_potencial_fechamento
  ON captacoes (organization_id, potencial_fechamento);

CREATE INDEX IF NOT EXISTS idx_editais_user_org_potencial_fechamento
  ON editais_user (organization_id, potencial_fechamento);
