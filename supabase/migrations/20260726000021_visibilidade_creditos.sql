-- Migration: Controle de Visibilidade + Sistema de Créditos
-- Admin controla o que captadores podem ver; créditos para ver contatos

-- ─────────────────────────────────────────────
--  TABELA: creditos (saldo por organização)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creditos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Plano atual
  plano             TEXT NOT NULL DEFAULT 'basico_30' CHECK (plano IN ('basico_30', 'basico_70')),
  creditos_totais   INTEGER NOT NULL DEFAULT 30,
  creditos_usados   INTEGER NOT NULL DEFAULT 0,
  
  -- Usuários extras (R$34,90 cada)
  usuarios_extras   INTEGER NOT NULL DEFAULT 0,
  
  -- Controle
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

-- ─────────────────────────────────────────────
--  TABELA: config_org (configurações da organização)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config_org (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Controle de visibilidade
  -- 'admin_only' → admin vê tudo, captador só vê seus próprios dados
  -- 'team_shared' → todos veem todas as captações da equipe
  visibilidade_captações TEXT NOT NULL DEFAULT 'admin_only' 
    CHECK (visibilidade_captações IN ('admin_only', 'team_shared')),
  
  -- Controle de acesso a empresas
  -- 'admin_only' → só admin vê contatos de empresas
  -- 'team_with_credits' → captadores veem se tiverem créditos
  acesso_contatos  TEXT NOT NULL DEFAULT 'team_with_credits'
    CHECK (acesso_contatos IN ('admin_only', 'team_with_credits')),
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id)
);

-- ─────────────────────────────────────────────
--  ÍNDICES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_creditos_org ON creditos(organization_id);
CREATE INDEX IF NOT EXISTS idx_config_org ON config_org(organization_id);

-- ─────────────────────────────────────────────
--  RLS
-- ─────────────────────────────────────────────
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_org ENABLE ROW LEVEL SECURITY;

-- creditos: admin da org lê, membro lê
CREATE POLICY "creditos: select" ON creditos
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- creditos: só admin atualiza
CREATE POLICY "creditos: update admin" ON creditos
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND papel = 'admin'
    )
  );

-- config_org: admin da org lê e atualiza
CREATE POLICY "config_org: select" ON config_org
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "config_org: update admin" ON config_org
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND papel = 'admin'
    )
  );

CREATE POLICY "config_org: insert admin" ON config_org
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND papel = 'admin'
    )
  );

-- ─────────────────────────────────────────────
--  FUNÇÃO: verificar créditos disponíveis
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_creditos_disponiveis(p_organization_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_totais INTEGER;
  v_usados INTEGER;
BEGIN
  SELECT creditos_totais, creditos_usados 
  INTO v_totais, v_usados
  FROM creditos 
  WHERE organization_id = p_organization_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  RETURN GREATEST(v_totais - v_usados, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
--  FUNÇÃO: consumir crédito (ver contato)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_consumir_credito(
  p_organization_id UUID,
  p_empresa_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_config config_org;
  v_disponiveis INTEGER;
BEGIN
  -- Verificar configuração da org
  SELECT * INTO v_config FROM config_org WHERE organization_id = p_organization_id;
  
  -- Se acesso é admin_only, bloquear
  IF v_config.acesso_contatos = 'admin_only' THEN
    -- Verificar se é admin
    IF NOT EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_id = p_organization_id 
        AND user_id = auth.uid() 
        AND papel = 'admin'
    ) THEN
      RAISE EXCEPTION 'Acesso restrito a administradores';
      RETURN FALSE;
    END IF;
    RETURN TRUE; -- Admin não consome crédito
  END IF;
  
  -- Verificar créditos disponíveis
  v_disponiveis := fn_creditos_disponiveis(p_organization_id);
  
  IF v_disponiveis <= 0 THEN
    RAISE EXCEPTION 'Sem créditos disponíveis. Faça upgrade do plano.';
    RETURN FALSE;
  END IF;
  
  -- Consumir crédito
  UPDATE creditos 
  SET creditos_usados = creditos_usados + 1,
      updated_at = NOW()
  WHERE organization_id = p_organization_id;
  
  -- Registrar uso (opcional, para auditoria)
  INSERT INTO historico_creditos (organization_id, user_id, empresa_id, tipo)
  VALUES (p_organization_id, auth.uid(), p_empresa_id, 'visualizacao_contato');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
--  TABELA: historico_creditos (auditoria)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_creditos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id        UUID REFERENCES empresas(id),
  tipo              TEXT NOT NULL DEFAULT 'visualizacao_contato',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historico_creditos_org ON historico_creditos(organization_id, created_at);

-- RLS
ALTER TABLE historico_creditos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_creditos: select admin" ON historico_creditos
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND papel = 'admin'
    )
  );

CREATE POLICY "historico_creditos: insert" ON historico_creditos
  FOR INSERT WITH CHECK (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
--  FUNÇÃO: verificar visibilidade de captação
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_pode_ver_captacao(
  p_captacao_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_captacao captacoes;
  v_config config_org;
  v_papel TEXT;
BEGIN
  -- Buscar captação
  SELECT * INTO v_captacao FROM captacoes WHERE id = p_captacao_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Se é o próprio captador da captação, sempre pode ver
  IF v_captacao.captador_id = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar papel do usuário
  SELECT papel INTO v_papel 
  FROM organization_members 
  WHERE organization_id = v_captacao.organization_id 
    AND user_id = p_user_id;
  
  -- Se é admin, sempre pode ver
  IF v_papel = 'admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Buscar configuração da org
  SELECT * INTO v_config 
  FROM config_org 
  WHERE organization_id = v_captacao.organization_id;
  
  -- Se visibilidade é team_shared, membros veem tudo
  IF v_config.visibilidade_captações = 'team_shared' THEN
    RETURN TRUE;
  END IF;
  
  -- Senão, só vê as próprias
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────
--  GRANTS
-- ─────────────────────────────────────────────
GRANT SELECT ON creditos TO authenticated;
GRANT SELECT ON config_org TO authenticated;
GRANT SELECT ON historico_creditos TO authenticated;
GRANT EXECUTE ON FUNCTION fn_creditos_disponiveis TO authenticated;
GRANT EXECUTE ON FUNCTION fn_consumir_credito TO authenticated;
GRANT EXECUTE ON FUNCTION fn_pode_ver_captacao TO authenticated;
