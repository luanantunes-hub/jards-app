-- Feature: Documentos de inscrição
-- Escopo exclusivo: ou inscricao_id ou projeto_id, nunca os dois

CREATE TABLE IF NOT EXISTS documentos_inscricao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Escopo
  inscricao_id    uuid REFERENCES editais_user(id) ON DELETE CASCADE,
  projeto_id      uuid REFERENCES projetos_crm(id) ON DELETE CASCADE,

  titulo          text NOT NULL,
  icone           text NOT NULL DEFAULT 'file-text',
  cor             text NOT NULL DEFAULT 'azul'
                    CHECK (cor IN ('azul','pessego','verde','roxo')),
  arquivo_url     text,
  arquivo_nome    text,
  arquivo_tamanho bigint,
  created_at      timestamptz DEFAULT now(),

  CONSTRAINT escopo_exclusivo CHECK (
    (inscricao_id IS NOT NULL AND projeto_id IS NULL) OR
    (inscricao_id IS NULL     AND projeto_id IS NOT NULL)
  )
);

ALTER TABLE documentos_inscricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_own" ON documentos_inscricao
  FOR ALL USING (auth.uid() = account_id);

CREATE INDEX idx_doc_inscricao ON documentos_inscricao(inscricao_id) WHERE inscricao_id IS NOT NULL;
CREATE INDEX idx_doc_projeto   ON documentos_inscricao(projeto_id)   WHERE projeto_id   IS NOT NULL;
