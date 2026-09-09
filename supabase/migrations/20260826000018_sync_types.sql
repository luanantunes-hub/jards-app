-- Sync types.ts with DB: add missing columns and config_org table

-- captacoes: potencial_fechamento
ALTER TABLE captacoes
  ADD COLUMN IF NOT EXISTS potencial_fechamento TEXT;

-- projetos_crm: identidade visual
ALTER TABLE projetos_crm
  ADD COLUMN IF NOT EXISTS identidade_tipo TEXT NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS identidade_valor TEXT,
  ADD COLUMN IF NOT EXISTS identidade_logo_url TEXT;

-- empresas_crm: site
ALTER TABLE empresas_crm
  ADD COLUMN IF NOT EXISTS site TEXT;

-- atribuicoes: dias_sem_avanco
ALTER TABLE atribuicoes
  ADD COLUMN IF NOT EXISTS dias_sem_avanco INTEGER;

-- resultados_projeto: campos financeiros e data
ALTER TABLE resultados_projeto
  ADD COLUMN IF NOT EXISTS valor_captado NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_executado NUMERIC,
  ADD COLUMN IF NOT EXISTS retorno_midia_est NUMERIC,
  ADD COLUMN IF NOT EXISTS data_resultado DATE;

-- config_org: configurações por organização
CREATE TABLE IF NOT EXISTS config_org (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visibilidade_captacoes TEXT NOT NULL DEFAULT 'team_shared',
  acesso_contatos TEXT NOT NULL DEFAULT 'team_with_credits',
  contribuicoes_habilitadas BOOLEAN NOT NULL DEFAULT true,
  contribuicoes_requer_aprovacao BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE config_org ENABLE ROW LEVEL SECURITY;
