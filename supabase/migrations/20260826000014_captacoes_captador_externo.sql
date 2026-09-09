-- Migration 014: captador_externo_id em captacoes
-- Permite vincular captação a captador externo (tabela captadores) além do interno (organization_members)

ALTER TABLE captacoes
  ADD COLUMN IF NOT EXISTS captador_externo_id UUID REFERENCES captadores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_captacoes_captador_externo ON captacoes(captador_externo_id);
