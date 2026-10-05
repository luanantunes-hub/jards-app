-- P1.11: as prestações passam da versão 1 para a versão 2 do mesmo regime.
--
-- A versão 2 da Rouanet e do genérico descreve a mesma norma em todas as
-- dimensões (não é norma nova): quem estava na 1 vai para a 2. O gatilho da
-- P1.2 registra a troca no histórico da prestação e recalcula o prazo. Só
-- estes dois códigos e só da versão 1: uma norma nova, no futuro, não move
-- prestações sem uma decisão explícita.
-- Idempotente.

update public.prestacoes_contas prestacao
set regime_id = nova.id
from public.prestacao_regimes antiga, public.prestacao_regimes nova
where prestacao.regime_id = antiga.id
  and antiga.codigo in ('rouanet_in29_2026', 'generico')
  and antiga.versao = 1
  and nova.codigo = antiga.codigo
  and nova.versao = 2
  and nova.status = 'publicado';
