-- P9.4: o extrato do Transferegov como origem da importação.
--
-- No Pronon e no Pronas/PCD, as linhas do extrato das contas do projeto vêm
-- da API pública de Gestão de Parcerias do Transferegov, sem arquivo do
-- banco. A importação passa pela mesma fn_prestacao_extrato_importar, com o
-- formato 'transferegov'; a chave de cada lançamento é o identificador da
-- linha na API, e importar de novo só traz o que entrou depois.
-- Idempotente.

alter table public.prestacao_extrato_importacoes
  drop constraint if exists prestacao_extrato_importacoes_formato_check;
alter table public.prestacao_extrato_importacoes
  add constraint prestacao_extrato_importacoes_formato_check
  check (formato in ('ofx', 'csv', 'pdf', 'agregador', 'transferegov'));
