CREATE TABLE IF NOT EXISTS empresas_crm (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  site       TEXT,
  cnpj       TEXT,
  setor      TEXT,
  telefone   TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
