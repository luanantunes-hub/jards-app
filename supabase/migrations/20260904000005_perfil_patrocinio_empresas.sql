-- Perfil de patrocínio: dados de qualificação da empresa como potencial
-- patrocinadora, preenchidos na prospecção independente de haver negociação.

alter table public.empresas_crm
  add column if not exists ja_patrocina_cultura boolean,
  add column if not exists patrocina_cultura_com text,
  add column if not exists ja_patrocina_esporte boolean,
  add column if not exists patrocina_esporte_com text,
  add column if not exists leis_que_usa text[] not null default '{}',
  add column if not exists janela_decisao text check (janela_decisao is null or janela_decisao in ('Q1','Q2','Q3','Q4'));
