-- Migration: Tabela de cadastro de captadores
-- Desacoplada do auth — o captador existe como registro independente
-- O vinculo com workspace (organization_members) é opcional e posterior

-- ─────────────────────────────────────────────
--  CRIAR TABELA captadores
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS captadores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  nome            TEXT NOT NULL,
  email           TEXT,
  telefone        TEXT,
  agencia         TEXT,
  prioridade      TEXT DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  contatos        JSONB DEFAULT '[]'::JSONB,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_captadores_organization ON captadores(organization_id);
CREATE INDEX IF NOT EXISTS idx_captadores_email ON captadores(email);
CREATE INDEX IF NOT EXISTS idx_captadores_user ON captadores(user_id);

-- ─────────────────────────────────────────────
--  TRIGGER updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_captadores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_captadores_updated_at ON captadores;
CREATE TRIGGER trg_captadores_updated_at
  BEFORE UPDATE ON captadores
  FOR EACH ROW EXECUTE FUNCTION trg_captadores_updated_at();

-- ─────────────────────────────────────────────
--  RLS
-- ─────────────────────────────────────────────
ALTER TABLE captadores ENABLE ROW LEVEL SECURITY;

-- Admin vê todos captadores da organização
CREATE POLICY captadores_admin_select ON captadores
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = captadores.organization_id
        AND papel = 'admin'
    )
  );

-- Captadores podem ver a si mesmos (se vinculados via user_id)
CREATE POLICY captadores_self_select ON captadores
  FOR SELECT USING (user_id = auth.uid());

-- Admin pode inserir
CREATE POLICY captadores_admin_insert ON captadores
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = captadores.organization_id
        AND papel = 'admin'
    )
  );

-- Admin pode atualizar
CREATE POLICY captadores_admin_update ON captadores
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = captadores.organization_id
        AND papel = 'admin'
    )
  );

-- Admin pode deletar
CREATE POLICY captadores_admin_delete ON captadores
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = captadores.organization_id
        AND papel = 'admin'
    )
  );

-- ─────────────────────────────────────────────
--  GRANT
-- ─────────────────────────────────────────────
GRANT ALL ON captadores TO authenticated;

-- ─────────────────────────────────────────────
--  COMENTÁRIOS
-- ─────────────────────────────────────────────
COMMENT ON TABLE captadores IS 'Cadastro de captadores da organização, desacoplado do auth';
COMMENT ON COLUMN captadores.agencia IS 'Agência/empresa onde o captador trabalha';
COMMENT ON COLUMN captadores.prioridade IS 'Prioridade do captador: alta, media, baixa';
COMMENT ON COLUMN captadores.contatos IS 'Lista de contatos adicionais do captador (JSON)';
COMMENT ON COLUMN captadores.user_id IS 'Vínculo opcional com usuário do workspace';
COMMENT ON COLUMN captadores.ativo IS 'Se o captador está ativo na organização';
