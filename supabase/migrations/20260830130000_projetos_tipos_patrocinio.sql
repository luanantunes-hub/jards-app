-- Formas de financiamento aceitas pelo projeto. O array admite opções
-- padronizadas pela interface e mecanismos personalizados da organização.
alter table public.projetos_crm
  add column if not exists tipos_patrocinio text[] not null default '{}'::text[];

comment on column public.projetos_crm.tipos_patrocinio is
  'Leis, mecanismos de incentivo e/ou patrocínio direto aplicáveis ao projeto.';

-- Preserva o mecanismo legado nos projetos já cadastrados.
update public.projetos_crm
set tipos_patrocinio = array[
  case lower(trim(mecanismo))
    when 'rouanet' then 'lei_rouanet'
    when 'lei rouanet' then 'lei_rouanet'
    when 'lei do audiovisual' then 'lei_audiovisual'
    when 'audiovisual' then 'lei_audiovisual'
    when 'lei de incentivo ao esporte' then 'lei_incentivo_esporte'
    when 'esporte' then 'lei_incentivo_esporte'
    when 'proac' then 'proac_icms'
    when 'proac icms' then 'proac_icms'
    when 'pro-mac' then 'promac'
    when 'promac' then 'promac'
    when 'patrocínio direto' then 'patrocinio_direto'
    when 'patrocinio direto' then 'patrocinio_direto'
    else trim(mecanismo)
  end
]
where cardinality(tipos_patrocinio) = 0
  and nullif(trim(mecanismo), '') is not null;

