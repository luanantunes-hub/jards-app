-- Migration: Atualizar RLS de captacoes para visibilidade por organização
-- Substitui as políticas antigas baseadas em account_id

-- ─────────────────────────────────────────────
--  REMOVER POLÍTICAS ANTIGAS DE CAPTAÇÕES
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "captacoes: select próprio" ON captacoes;
DROP POLICY IF EXISTS "captacoes: insert próprio" ON captacoes;
DROP POLICY IF EXISTS "captacoes: update próprio" ON captacoes;
DROP POLICY IF EXISTS "captacoes: delete próprio" ON captacoes;

-- ─────────────────────────────────────────────
--  NOVAS POLÍTICAS: baseadas em organization_id + papel
-- ─────────────────────────────────────────────

-- SELECT: admin vê tudo da org, captador vê só suas (ou todas se team_shared)
CREATE POLICY "captacoes: select" ON captacoes
  FOR SELECT USING (
    -- Caso 1: é o dono da captação
    captador_id = auth.uid()
    OR
    -- Caso 2: é admin da organização
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = captacoes.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.papel = 'admin'
    )
    OR
    -- Caso 3: é membro E config allow team_shared
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN config_org co ON co.organization_id = om.organization_id
      WHERE om.organization_id = captacoes.organization_id
        AND om.user_id = auth.uid()
        AND co.visibilidade_captações = 'team_shared'
    )
  );

-- INSERT: membro da org pode criar captações
CREATE POLICY "captacoes: insert" ON captacoes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = captacoes.organization_id
        AND organization_members.user_id = auth.uid()
    )
  );

-- UPDATE: admin atualiza tudo, captador atualiza só suas
CREATE POLICY "captacoes: update" ON captacoes
  FOR UPDATE USING (
    -- Admin da org
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = captacoes.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.papel = 'admin'
    )
    OR
    -- Próprio captador
    captador_id = auth.uid()
  );

-- DELETE: admin deleta tudo
CREATE POLICY "captacoes: delete" ON captacoes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organization_members 
      WHERE organization_members.organization_id = captacoes.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.papel = 'admin'
    )
  );
