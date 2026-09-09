-- Adiciona coluna site em empresas_crm (ausente da criação original)
alter table empresas_crm
  add column if not exists site text;
