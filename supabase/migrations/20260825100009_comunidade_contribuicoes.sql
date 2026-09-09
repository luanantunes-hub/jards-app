-- Migration 009: Camada de Colaboração da Comunidade
-- Comunidade como fonte ativa de informações públicas

-- ═══════════════════════════════════════════════
--  Tabela: contribuicoes (fila de colaboração)
-- ═══════════════════════════════════════════════

-- ─── Fila de contribuições (modelo Wikipedia) ───
CREATE TABLE IF NOT EXISTS contribuicoes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id          UUID NOT NULL REFERENCES auth.users(id),
  organization_id   UUID REFERENCES organizations(id),

  -- O que está sendo contribuído
  tabela_alvo       TEXT NOT NULL CHECK (tabela_alvo IN ('empresas', 'editais', 'responsaveis')),
  registro_alvo_id  UUID NOT NULL,
  tipo              TEXT NOT NULL CHECK (tipo IN ('adicao', 'correcao', 'sinalizacao')),

  -- Dados propostos
  campo             TEXT,                -- qual campo (correção pontual)
  valor_proposto    JSONB,               -- dados novos ou corrigidos
  justificativa     text,

  -- Status
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'auto_promovida')),

  -- Vínculo com CRM privado (contexto do autor)
  empresa_crm_id    UUID REFERENCES empresas_crm(id),

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  revisado_por      UUID REFERENCES auth.users(id),
  revisado_em       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contribuicoes_registro ON contribuicoes(tabela_alvo, registro_alvo_id);
CREATE INDEX IF NOT EXISTS idx_contribuicoes_status ON contribuicoes(status);
CREATE INDEX IF NOT EXISTS idx_contribuicoes_org ON contribuicoes(organization_id);

-- ─── Confirmações cruzadas (permite promoção sem admin) ───
CREATE TABLE IF NOT EXISTS contribuicoes_confirmacoes (
  contribuicao_id   UUID NOT NULL REFERENCES contribuicoes(id) ON DELETE CASCADE,
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  confirmou_em      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (contribuicao_id, organization_id)
);

-- ─── RLS: contribuicoes ───
ALTER TABLE contribuicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contribuicoes: select own" ON contribuicoes;
-- Autor vê suas próprias contribuições
CREATE POLICY "contribuicoes: select own" ON contribuicoes
  FOR SELECT USING (autor_id = auth.uid());

DROP POLICY IF EXISTS "contribuicoes: select org" ON contribuicoes;
-- Membro da org vê contribuições que ela fez
CREATE POLICY "contribuicoes: select org" ON contribuicoes
  FOR SELECT USING (organization_id = ANY(array(SELECT auth_org_ids())));

DROP POLICY IF EXISTS "contribuicoes: select admin pendentes" ON contribuicoes;
-- Admin pode ver contribuições pendentes da org (para moderação)
CREATE POLICY "contribuicoes: select admin pendentes" ON contribuicoes
  FOR SELECT USING (
    status = 'pendente'
    AND organization_id = ANY(array(SELECT auth_org_ids()))
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
        AND organization_id = contribuicoes.organization_id
        AND papel = 'admin'
    )
  );

DROP POLICY IF EXISTS "contribuicoes: insert" ON contribuicoes;
-- Qualquer autenticado pode criar contribuições
CREATE POLICY "contribuicoes: insert" ON contribuicoes
  FOR INSERT WITH CHECK (auth.uid() = autor_id);

DROP POLICY IF EXISTS "contribuicoes: update admin" ON contribuicoes;
-- Admin pode atualizar (aprovar/rejeitar)
CREATE POLICY "contribuicoes: update admin" ON contribuicoes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE user_id = auth.uid()
        AND organization_id = contribuicoes.organization_id
        AND papel = 'admin'
    )
  );

-- ─── RLS: contribuicoes_confirmacoes ───
ALTER TABLE contribuicoes_confirmacoes ENABLE ROW LEVEL SECURITY;

-- Membro da org pode ver confirmações de contribuições da sua org
DROP POLICY IF EXISTS "contribuicoes_confirmacoes: select org" ON contribuicoes_confirmacoes;
CREATE POLICY "contribuicoes_confirmacoes: select org" ON contribuicoes_confirmacoes
  FOR SELECT USING (organization_id = ANY(array(SELECT auth_org_ids())));

-- Membro da org pode confirmar contribuições (1 confirmação por org)
DROP POLICY IF EXISTS "contribuicoes_confirmacoes: insert org" ON contribuicoes_confirmacoes;
CREATE POLICY "contribuicoes_confirmacoes: insert org" ON contribuicoes_confirmacoes
  FOR INSERT WITH CHECK (organization_id = ANY(array(SELECT auth_org_ids())));

-- ═══════════════════════════════════════════════
--  Extensão de responsaveis (fonte, confiança)
-- ═══════════════════════════════════════════════
ALTER TABLE responsaveis
  ADD COLUMN IF NOT EXISTS fonte TEXT DEFAULT 'proprietaria'
    CHECK (fonte IN ('proprietaria', 'comunidade')),
  ADD COLUMN IF NOT EXISTS confianca NUMERIC(3,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS confirmacoes_independentes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_confirmacao_em TIMESTAMPTZ;

-- ═══════════════════════════════════════════════
--  Auto-promoção de responsaveis
--  Quando >= 3 orgs independentes confirmam, sobe pra base pública
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_auto_promover_responsavel()
RETURNS TRIGGER AS $$
DECLARE
  v_confirmacoes INT;
BEGIN
  -- Contar confirmações independentes (orgs distintas)
  SELECT COUNT(DISTINCT cc.organization_id)
  INTO v_confirmacoes
  FROM contribuicoes_confirmacoes cc
  JOIN contribuicoes c ON c.id = cc.contribuicao_id
  WHERE c.tabela_alvo = 'responsaveis'
    AND c.registro_alvo_id = NEW.registro_alvo_id
    AND c.status IN ('aprovada', 'auto_promovida');

  -- Atualizar contadores no responsavel (se existir como registro público)
  UPDATE responsaveis
  SET confirmacoes_independentes = v_confirmacoes,
      ultima_confirmacao_em = NOW(),
      confianca = LEAST(1.0, (v_confirmacoes::NUMERIC / 3.0))
  WHERE id = NEW.registro_alvo_id;

  -- Auto-promover se >= 3 confirmações independentes
  IF v_confirmacoes >= 3 THEN
    -- Atualizar a contribuição original
    UPDATE contribuicoes
    SET status = 'auto_promovida'
    WHERE registro_alvo_id = NEW.registro_alvo_id
      AND tabela_alvo = 'responsaveis'
      AND status = 'aprovada';

    -- Atualizar fonte do responsavel
    UPDATE responsaveis
    SET fonte = 'comunidade'
    WHERE id = NEW.registro_alvo_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: executar auto-promoção após nova confirmação
DROP TRIGGER IF EXISTS trg_auto_promover ON contribuicoes_confirmacoes;
CREATE TRIGGER trg_auto_promover
  AFTER INSERT ON contribuicoes_confirmacoes
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_promover_responsavel();

-- ═══════════════════════════════════════════════
--  Flags de comunidade em config_org
-- ═══════════════════════════════════════════════
ALTER TABLE config_org
  ADD COLUMN IF NOT EXISTS contribuicoes_habilitadas BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS contribuicoes_requer_aprovacao BOOLEAN DEFAULT TRUE;
