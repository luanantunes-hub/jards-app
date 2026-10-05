-- P1.11: as prestações dos três regimes derivados passam para a versão 2.
--
-- A versão 2 da LIE P424, do Anexo LXXXVI e da IN 150 é a mesma norma,
-- agora conferida regra a regra no próprio texto (antes as regras vinham da
-- norma seguinte, "a confirmar"): quem estava na 1 vai para a 2. O gatilho da
-- P1.2 registra a troca no histórico da prestação e recalcula o prazo.
-- Idempotente.

update public.prestacoes_contas prestacao
set regime_id = nova.id
from public.prestacao_regimes antiga, public.prestacao_regimes nova
where prestacao.regime_id = antiga.id
  and antiga.codigo in ('lie_p424_2020', 'pronon_pronas_lxxxvi_2017', 'ancine_in150_2019')
  and antiga.versao = 1
  and nova.codigo = antiga.codigo
  and nova.versao = 2
  and nova.status = 'publicado';
