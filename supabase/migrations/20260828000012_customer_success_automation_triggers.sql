-- Mantem as automacoes de Customer Success vivas sem criar um scheduler paralelo.
create or replace function public.trg_customer_success_automations()
returns trigger language plpgsql security invoker as $$
begin
  perform public.fn_customer_success_automations();
  return null;
end $$;

drop trigger if exists trg_compromisso_customer_success on public.compromissos_cliente;
create trigger trg_compromisso_customer_success
after insert or update of prazo, status, responsavel_id on public.compromissos_cliente
for each statement execute function public.trg_customer_success_automations();

drop trigger if exists trg_contrato_customer_success on public.contratos;
create trigger trg_contrato_customer_success
after insert or update of proxima_renovacao, status on public.contratos
for each statement execute function public.trg_customer_success_automations();
