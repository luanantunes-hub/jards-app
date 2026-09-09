-- Migration: Adiciona campo tipo em empresas_crm
-- prospect: nunca foi cliente (em pipeline de prospecção)
-- cliente_ativo: tem contas_patrocinio com status = 'ativa'
-- ex_cliente: já teve conta ativa, agora todas encerradas

ALTER TABLE empresas_crm
  ADD COLUMN tipo text NOT NULL DEFAULT 'prospect'
  CHECK (tipo IN ('prospect', 'cliente_ativo', 'ex_cliente'));
