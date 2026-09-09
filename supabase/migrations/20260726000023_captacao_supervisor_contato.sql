-- Migration: Adicionar supervisor e contato da empresa nas captações
-- Supervisor = membro da equipe que supervisiona o negócio
-- Contato empresa = pessoa do lado da empresa que conduz o negócio

-- ─────────────────────────────────────────────
--  ADICIONAR COLUNAS
-- ─────────────────────────────────────────────
ALTER TABLE captacoes
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS contato_empresa_id UUID REFERENCES contatos(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_captacoes_supervisor ON captacoes(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_captacoes_contato_empresa ON captacoes(contato_empresa_id);

-- Comentários
COMMENT ON COLUMN captacoes.supervisor_id IS 'Membro da equipe que supervisiona esta captação';
COMMENT ON COLUMN captacoes.contato_empresa_id IS 'Contato do lado da empresa que conduz o negócio';
