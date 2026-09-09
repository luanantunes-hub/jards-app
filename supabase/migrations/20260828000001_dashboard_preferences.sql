CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, module_id)
);

ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dashboard_preferences_select_own" ON dashboard_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dashboard_preferences_insert_own" ON dashboard_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dashboard_preferences_update_own" ON dashboard_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dashboard_preferences_delete_own" ON dashboard_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_org
  ON dashboard_preferences(user_id, organization_id);
