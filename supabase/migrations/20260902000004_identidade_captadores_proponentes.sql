-- Identidade visual (ícone + cor + logo) para proponentes e captadores,
-- replicando o esquema dos projetos.

alter table proponentes
  add column if not exists identidade_tipo text not null default 'padrao'
    check (identidade_tipo in ('padrao', 'icone', 'emoji', 'logo')),
  add column if not exists identidade_valor text,
  add column if not exists identidade_logo_url text,
  add column if not exists identidade_cor text;

alter table captadores
  add column if not exists identidade_tipo text not null default 'padrao'
    check (identidade_tipo in ('padrao', 'icone', 'emoji', 'logo')),
  add column if not exists identidade_valor text,
  add column if not exists identidade_logo_url text,
  add column if not exists identidade_cor text;

-- Normaliza captadores que já possuíam logo_url para o novo esquema.
update captadores
  set identidade_tipo = 'logo',
      identidade_logo_url = logo_url
  where logo_url is not null
    and identidade_logo_url is null;