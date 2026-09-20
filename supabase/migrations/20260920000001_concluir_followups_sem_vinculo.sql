-- Follow-ups históricos sem contexto podem ser encerrados pela agenda.
-- Novos follow-ups pendentes continuam exigindo um vínculo válido.
alter table public.crm_followups
  drop constraint if exists crm_followups_contexto_check;

alter table public.crm_followups
  add constraint crm_followups_contexto_check check (
    num_nonnulls(empresa_crm_id, captacao_id, conta_patrocinio_id, proponente_id) > 0
    or status in ('concluido', 'cancelado')
  ) not valid;
