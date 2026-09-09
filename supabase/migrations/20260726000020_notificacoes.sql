-- Migration: Notificações de Coordenação
-- Tabela de notificações + trigger para notificar ao registrar atividade

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL,
  organization_id UUID,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_unread ON notificacoes(user_id, lida) WHERE lida = FALSE;

-- RLS
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select_own" ON notificacoes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notificacoes_insert_system" ON notificacoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notificacoes_update_own" ON notificacoes
  FOR UPDATE USING (auth.uid() = user_id);

-- Função para notificar captadores quando atividade é concluída
CREATE OR REPLACE FUNCTION fn_notificar_atividade_concluida()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_nome TEXT;
  v_captador_responsavel UUID;
  v_organization_id UUID;
  v_account_id UUID;
  v_responsavel_nome TEXT;
BEGIN
  -- Só notifica quando marca como concluída
  IF NEW.concluida = TRUE AND (OLD.concluida IS NULL OR OLD.concluida = FALSE) THEN
    -- Busca dados da captação
    SELECT 
      e.nome,
      c.captador_id,
      c.organization_id,
      c.account_id
    INTO v_empresa_nome, v_captador_responsavel, v_organization_id, v_account_id
    FROM captacoes c
    LEFT JOIN empresas_crm e ON e.id = c.empresa_crm_id
    WHERE c.id = NEW.captacao_id;

    -- Busca nome do responsável pela atividade
    SELECT full_name INTO v_responsavel_nome
    FROM profiles
    WHERE id = NEW.responsavel_id;

    -- Notifica o captador da captação (se não for o mesmo que concluiu)
    IF v_captador_responsavel IS NOT NULL AND v_captador_responsavel != NEW.responsavel_id THEN
      INSERT INTO notificacoes (account_id, organization_id, user_id, tipo, titulo, mensagem, link)
      VALUES (
        v_account_id,
        v_organization_id,
        v_captador_responsavel,
        'atividade_concluida',
        'Atividade concluída',
        COALESCE(v_responsavel_nome, 'Um captador') || ' concluiu uma atividade na captação de ' || COALESCE(v_empresa_nome, 'uma empresa'),
        '/captacoes/' || NEW.captacao_id
      );
    END IF;

    -- Notifica outros membros da organização que têm captações com a mesma empresa
    IF v_empresa_nome IS NOT NULL THEN
      INSERT INTO notificacoes (account_id, organization_id, user_id, tipo, titulo, mensagem, link)
      SELECT DISTINCT
        c.account_id,
        c.organization_id,
        c.captador_id,
        'atividade_empresa',
        'Movimentação na empresa',
        COALESCE(v_responsavel_nome, 'Um captador') || ' registrou atividade em ' || v_empresa_nome,
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

-- Trigger na tabela atividades
DROP TRIGGER IF EXISTS trg_notificar_atividade ON atividades;
CREATE TRIGGER trg_notificar_atividade
  AFTER UPDATE ON atividades
  FOR EACH ROW
  EXECUTE FUNCTION fn_notificar_atividade_concluida();

-- Grants
GRANT SELECT, UPDATE ON notificacoes TO authenticated;
GRANT INSERT ON notificacoes TO authenticated;
