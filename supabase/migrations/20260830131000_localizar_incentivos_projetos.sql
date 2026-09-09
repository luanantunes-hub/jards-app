-- Corrige os mecanismos paulistas que antes eram salvos como opções globais.
update public.projetos_crm
set tipos_patrocinio = array(
  select case item
    when 'proac_icms' then 'ProAC ICMS · SP'
    when 'promac' then 'Pro-Mac · São Paulo/SP'
    else item
  end
  from unnest(tipos_patrocinio) as item
)
where tipos_patrocinio && array['proac_icms', 'promac']::text[];

