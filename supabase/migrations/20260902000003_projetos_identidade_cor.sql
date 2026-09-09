-- Cor do ícone escolhido na identidade visual dos projetos.
alter table projetos_crm
  add column if not exists identidade_cor text;