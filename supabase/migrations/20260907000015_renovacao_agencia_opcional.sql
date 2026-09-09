-- A agência é sugerida na criação da renovação, mas pode ser removida ou trocada
-- explicitamente depois pelo usuário.

begin;

drop trigger if exists trg_renovacao_herdar_agencia on public.renovacoes_cliente;
create trigger trg_renovacao_herdar_agencia
  before insert or update of contrato_origem_id
  on public.renovacoes_cliente
  for each row execute function public.fn_herdar_agencia_renovacao();

commit;
