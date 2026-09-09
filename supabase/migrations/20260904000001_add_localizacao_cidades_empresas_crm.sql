-- Localização da empresa (texto livre: "São Paulo, SP")
ALTER TABLE empresas_crm ADD COLUMN IF NOT EXISTS localizacao text;

-- Lista de cidades de interesse (ex: ["São Paulo", "Curitiba", "Recife"])
ALTER TABLE empresas_crm ADD COLUMN IF NOT EXISTS cidades_interesse text[] NOT NULL DEFAULT '{}';
