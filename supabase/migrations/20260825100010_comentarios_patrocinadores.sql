-- Migration 010: Comunidade Ativa — Comentários, Votos em Editais, Sugestão de Contatos
-- A comunidade compartilha experiências, valida editais e indica contatos

-- ═══════════════════════════════════════════════
--  ENUM de tópicos de comentário
-- ═══════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comentario_topico') THEN
    CREATE TYPE comentario_topico AS ENUM (
      'processo_selecao',
      'tomador_decisao',
      'experiencia_patrocinio',
      'tipo_projetos',
      'valor_empresa'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════
--  1. COMENTÁRIOS SOBRE PATROCINADORES
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS comentarios (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor_id          UUID NOT NULL REFERENCES auth.users(id),

  topico            comentario_topico NOT NULL,
  conteudo          TEXT NOT NULL CHECK (char_length(conteudo) <= 1200),
  votos             INT NOT NULL DEFAULT 0,

  status            TEXT NOT NULL DEFAULT 'aprovado'
                    CHECK (status IN ('pendente', 'aprovado', 'oculto')),

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  editado_em        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comentarios_empresa ON comentarios(empresa_id, topico, status);
CREATE INDEX IF NOT EXISTS idx_comentarios_autor ON comentarios(autor_id);

ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comentarios: select aprovados" ON comentarios;
CREATE POLICY "comentarios: select aprovados" ON comentarios
  FOR SELECT USING (status = 'aprovado');
DROP POLICY IF EXISTS "comentarios: select own" ON comentarios;
CREATE POLICY "comentarios: select own" ON comentarios
  FOR SELECT USING (autor_id = auth.uid());
DROP POLICY IF EXISTS "comentarios: insert" ON comentarios;
CREATE POLICY "comentarios: insert" ON comentarios
  FOR INSERT WITH CHECK (auth.uid() = autor_id);
DROP POLICY IF EXISTS "comentarios: update own" ON comentarios;
CREATE POLICY "comentarios: update own" ON comentarios
  FOR UPDATE USING (auth.uid() = autor_id);
DROP POLICY IF EXISTS "comentarios: update admin" ON comentarios;
CREATE POLICY "comentarios: update admin" ON comentarios
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND papel = 'admin')
  );

-- ═══════════════════════════════════════════════
--  Votos em comentários (1 por user)
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS comentario_votos (
  comentario_id     UUID NOT NULL REFERENCES comentarios(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor             SMALLINT NOT NULL DEFAULT 1 CHECK (valor IN (-1, 1)),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (comentario_id, user_id)
);

ALTER TABLE comentario_votos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comentario_votos: select" ON comentario_votos;
CREATE POLICY "comentario_votos: select" ON comentario_votos FOR SELECT USING (true);
DROP POLICY IF EXISTS "comentario_votos: insert" ON comentario_votos;
CREATE POLICY "comentario_votos: insert" ON comentario_votos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comentario_votos: update own" ON comentario_votos;
CREATE POLICY "comentario_votos: update own" ON comentario_votos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "comentario_votos: delete own" ON comentario_votos;
CREATE POLICY "comentario_votos: delete own" ON comentario_votos FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION fn_toggle_voto(
  p_comentario_id UUID,
  p_valor SMALLINT
) RETURNS INT AS $$
DECLARE
  v_existente RECORD;
  v_delta INT;
  v_novo_total INT;
BEGIN
  SELECT valor INTO v_existente
  FROM comentario_votos
  WHERE comentario_id = p_comentario_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existente.valor = p_valor THEN
      DELETE FROM comentario_votos
      WHERE comentario_id = p_comentario_id AND user_id = auth.uid();
      v_delta := -p_valor;
    ELSE
      UPDATE comentario_votos SET valor = p_valor, created_at = NOW()
      WHERE comentario_id = p_comentario_id AND user_id = auth.uid();
      v_delta := p_valor * 2;
    END IF;
  ELSE
    INSERT INTO comentario_votos (comentario_id, user_id, valor)
    VALUES (p_comentario_id, auth.uid(), p_valor);
    v_delta := p_valor;
  END IF;

  UPDATE comentarios SET votos = GREATEST(0, votos + v_delta)
  WHERE id = p_comentario_id
  RETURNING votos INTO v_novo_total;

  RETURN v_novo_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_toggle_voto TO authenticated;

-- ═══════════════════════════════════════════════
--  2. VOTOS EM EDITAIS — "Esse edital funciona?"
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS edital_votos (
  edital_id         UUID NOT NULL REFERENCES editais(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funciona          BOOLEAN NOT NULL,
  comentario        TEXT CHECK (char_length(comentario) <= 500),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (edital_id, user_id)
);

ALTER TABLE edital_votos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "edital_votos: select" ON edital_votos;
CREATE POLICY "edital_votos: select" ON edital_votos FOR SELECT USING (true);
DROP POLICY IF EXISTS "edital_votos: insert" ON edital_votos;
CREATE POLICY "edital_votos: insert" ON edital_votos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "edital_votos: update own" ON edital_votos;
CREATE POLICY "edital_votos: update own" ON edital_votos FOR UPDATE USING (auth.uid() = user_id);

-- Contadores denormalizados no edital (performância)
ALTER TABLE editais
  ADD COLUMN IF NOT EXISTS votos_funciona INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS votos_nao_funciona INT DEFAULT 0;

-- ═══════════════════════════════════════════════
--  3. SUGESTÃO DE CONTATOS — comunidade indica, sobe com votos
-- ═══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contatos_sugestoes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id        UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  autor_id          UUID NOT NULL REFERENCES auth.users(id),

  nome              TEXT NOT NULL,
  cargo             TEXT,
  email             TEXT,
  linkedin_url      TEXT,
  telefone          TEXT,
  justificativa     TEXT CHECK (char_length(justificativa) <= 600),

  -- Votação da comunidade
  votos_positivos   INT NOT NULL DEFAULT 0,
  votos_negativos   INT NOT NULL DEFAULT 0,

  -- Status: sobe quando votos >= limiar
  status            TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'promovido')),

  -- Quando promovido → vira registro em responsaveis
  responsavel_id    UUID REFERENCES responsaveis(id),

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contatos_sugestoes_empresa ON contatos_sugestoes(empresa_id, status);

ALTER TABLE contatos_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contatos_sugestoes: select" ON contatos_sugestoes;
CREATE POLICY "contatos_sugestoes: select" ON contatos_sugestoes
  FOR SELECT USING (status IN ('pendente', 'aprovado'));
DROP POLICY IF EXISTS "contatos_sugestoes: insert" ON contatos_sugestoes;
CREATE POLICY "contatos_sugestoes: insert" ON contatos_sugestoes
  FOR INSERT WITH CHECK (auth.uid() = autor_id);
DROP POLICY IF EXISTS "contatos_sugestoes: update own" ON contatos_sugestoes;
CREATE POLICY "contatos_sugestoes: update own" ON contatos_sugestoes
  FOR UPDATE USING (auth.uid() = autor_id);

-- Votos na sugestão (1 por user)
CREATE TABLE IF NOT EXISTS contato_sugestao_votos (
  sugestao_id       UUID NOT NULL REFERENCES contatos_sugestoes(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor             SMALLINT NOT NULL CHECK (valor IN (-1, 1)),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (sugestao_id, user_id)
);

ALTER TABLE contato_sugestao_votos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contato_sugestao_votos: select" ON contato_sugestao_votos;
CREATE POLICY "contato_sugestao_votos: select" ON contato_sugestao_votos FOR SELECT USING (true);
DROP POLICY IF EXISTS "contato_sugestao_votos: insert" ON contato_sugestao_votos;
CREATE POLICY "contato_sugestao_votos: insert" ON contato_sugestao_votos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "contato_sugestao_votos: update own" ON contato_sugestao_votos;
CREATE POLICY "contato_sugestao_votos: update own" ON contato_sugestao_votos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "contato_sugestao_votos: delete own" ON contato_sugestao_votos;
CREATE POLICY "contato_sugestao_votos: delete own" ON contato_sugestao_votos FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════
--  FUNÇÃO: toggle voto na sugestão de contato
--  Quando >= 3 votos positivos líquidos → promove automaticamente
-- ═══════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_votar_sugestao_contato(
  p_sugestao_id UUID,
  p_valor SMALLINT
) RETURNS TEXT AS $$
DECLARE
  v_existente RECORD;
  v_delta INT;
  v_sugestao RECORD;
  v_novo_saldo INT;
BEGIN
  SELECT valor INTO v_existente
  FROM contato_sugestao_votos
  WHERE sugestao_id = p_sugestao_id AND user_id = auth.uid();

  IF FOUND THEN
    IF v_existente.valor = p_valor THEN
      DELETE FROM contato_sugestao_votos
      WHERE sugestao_id = p_sugestao_id AND user_id = auth.uid();
      v_delta := -p_valor;
    ELSE
      UPDATE contato_sugestao_votos SET valor = p_valor, created_at = NOW()
      WHERE sugestao_id = p_sugestao_id AND user_id = auth.uid();
      v_delta := p_valor * 2;
    END IF;
  ELSE
    INSERT INTO contato_sugestao_votos (sugestao_id, user_id, valor)
    VALUES (p_sugestao_id, auth.uid(), p_valor);
    v_delta := p_valor;
  END IF;

  -- Atualizar contadores
  UPDATE contatos_sugestoes
  SET votos_positivos = GREATEST(0, votos_positivos + CASE WHEN p_valor = 1 THEN v_delta ELSE 0 END),
      votos_negativos = GREATEST(0, votos_negativos + CASE WHEN p_valor = -1 THEN ABS(v_delta) ELSE 0 END)
  WHERE id = p_sugestao_id
  RETURNING * INTO v_sugestao;

  v_novo_saldo := v_sugestao.votos_positivos - v_sugestao.votos_negativos;

  -- Auto-promover se saldo >= 3 e ainda pendente
  IF v_novo_saldo >= 3 AND v_sugestao.status = 'pendente' THEN
    -- Inserir na tabela responsaveis
    INSERT INTO responsaveis (empresa_id, nome, cargo, email, linkedin_url, fonte, confianca)
    VALUES (
      v_sugestao.empresa_id,
      v_sugestao.nome,
      v_sugestao.cargo,
      v_sugestao.email,
      v_sugestao.linkedin_url,
      'comunidade',
      LEAST(1.0, (v_novo_saldo::NUMERIC / 5.0))
    )
    RETURNING id INTO v_sugestao.responsavel_id;

    -- Marcar como promovido
    UPDATE contatos_sugestoes
    SET status = 'promovido', responsavel_id = v_sugestao.responsavel_id
    WHERE id = p_sugestao_id;

    RETURN 'promovido';
  END IF;

  RETURN 'votado';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fn_votar_sugestao_contato TO authenticated;
