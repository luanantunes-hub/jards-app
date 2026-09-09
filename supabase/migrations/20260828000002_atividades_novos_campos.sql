-- Adiciona campos ao modelo de atividades: vínculo com inscrição, horário e resultado

ALTER TABLE atividades
  ADD COLUMN IF NOT EXISTS edital_user_id UUID REFERENCES editais_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hora_inicio    TIME,
  ADD COLUMN IF NOT EXISTS hora_fim       TIME,
  ADD COLUMN IF NOT EXISTS resultado      TEXT;

CREATE INDEX IF NOT EXISTS idx_atividades_edital_user ON atividades(edital_user_id);
