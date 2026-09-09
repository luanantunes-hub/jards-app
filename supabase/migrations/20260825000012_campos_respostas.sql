-- Feature: Registros (campos de resposta para editais)
-- Três camadas: campos → respostas_modelo (projeto) → respostas_inscricao

CREATE TABLE IF NOT EXISTS campos_resposta (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  nome_key    text GENERATED ALWAYS AS (lower(trim(nome))) STORED,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (account_id, nome_key)
);

CREATE TABLE IF NOT EXISTS respostas_modelo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto_id  uuid NOT NULL REFERENCES projetos_crm(id) ON DELETE CASCADE,
  campo_id    uuid NOT NULL REFERENCES campos_resposta(id) ON DELETE CASCADE,
  conteudo    text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (projeto_id, campo_id)
);

CREATE TABLE IF NOT EXISTS respostas_inscricao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inscricao_id  uuid NOT NULL REFERENCES editais_user(id) ON DELETE CASCADE,
  campo_id      uuid NOT NULL REFERENCES campos_resposta(id) ON DELETE CASCADE,
  conteudo      text NOT NULL DEFAULT '',
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (inscricao_id, campo_id)
);

ALTER TABLE campos_resposta     ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_modelo    ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_inscricao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_own"     ON campos_resposta     FOR ALL USING (auth.uid() = account_id);
CREATE POLICY "modelo_own"     ON respostas_modelo    FOR ALL USING (auth.uid() = account_id);
CREATE POLICY "inscricao_own"  ON respostas_inscricao FOR ALL USING (auth.uid() = account_id);

-- RPC: retorna campos desta inscrição com modelo do projeto pré-resolvido
CREATE OR REPLACE FUNCTION get_registros_inscricao(
  p_inscricao_id uuid,
  p_projeto_id   uuid
)
RETURNS TABLE (
  campo_id     uuid,
  campo_nome   text,
  conteudo     text,
  modelo_texto text,
  tem_modelo   boolean
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    cr.id,
    cr.nome,
    ri.conteudo,
    rm.conteudo AS modelo_texto,
    (rm.id IS NOT NULL) AS tem_modelo
  FROM campos_resposta cr
  LEFT JOIN respostas_inscricao ri
    ON ri.campo_id = cr.id AND ri.inscricao_id = p_inscricao_id
  LEFT JOIN respostas_modelo rm
    ON rm.campo_id = cr.id AND rm.projeto_id = p_projeto_id
  WHERE ri.inscricao_id = p_inscricao_id
     OR rm.projeto_id    = p_projeto_id
  ORDER BY cr.nome;
$$;
