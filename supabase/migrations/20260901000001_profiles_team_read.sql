-- Migration 011: Team visibility — membros enxergam perfis uns dos outros
-- Por que: atividades mostram responsável via embed profiles!responsavel_id.
-- A policy original (auth.uid() = id) escondia o perfil de outros membros.

DROP POLICY IF EXISTS "profiles: select team members" ON profiles;
CREATE POLICY "profiles: select team members" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM organization_members om
      JOIN organization_members me
        ON me.organization_id = om.organization_id AND me.user_id = auth.uid()
      WHERE om.user_id = profiles.id
    )
  );