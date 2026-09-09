-- Uma empresa pode decidir orçamento de patrocínio em mais de um trimestre.
alter table public.empresas_crm drop constraint if exists empresas_crm_janela_decisao_check;
alter table public.empresas_crm
  alter column janela_decisao type text[] using case when janela_decisao is null then '{}'::text[] else array[janela_decisao] end,
  alter column janela_decisao set default '{}',
  alter column janela_decisao set not null;
