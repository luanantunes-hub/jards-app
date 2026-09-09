-- Migration: Corrige FK de atribuicoes.captador_user_id
--
-- Antes: captador_user_id → auth.users(id)
-- Depois: captador_user_id → captadores(id)
--
-- Motivação: captadores são cadastrados diretamente na tabela captadores,
-- desacoplados do auth. A FK para auth.users impedia atribuições a agências
-- sem conta no workspace.

ALTER TABLE atribuicoes
  DROP CONSTRAINT IF EXISTS atribuicoes_captador_user_id_fkey;

ALTER TABLE atribuicoes
  ADD CONSTRAINT atribuicoes_captador_user_id_fkey
  FOREIGN KEY (captador_user_id)
  REFERENCES captadores(id)
  ON DELETE RESTRICT;
