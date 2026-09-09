-- Feature: Anotações de empresa
-- Pertence à empresa_crm, acessível de qualquer ponto

CREATE TABLE IF NOT EXISTS anotacoes_empresa (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_crm_id  uuid NOT NULL REFERENCES empresas_crm(id) ON DELETE CASCADE,
  conteudo        text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE anotacoes_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anotacoes_own" ON anotacoes_empresa
  FOR ALL USING (auth.uid() = account_id);

CREATE INDEX idx_anotacoes_empresa ON anotacoes_empresa(empresa_crm_id);
