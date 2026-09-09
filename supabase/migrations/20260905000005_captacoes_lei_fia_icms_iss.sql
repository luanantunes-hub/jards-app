alter table public.captacoes drop constraint if exists captacoes_lei_check;
alter table public.captacoes add constraint captacoes_lei_check
  check (lei = any (array['rouanet','esporte','audiovisual','fia','icms','iss','outros']));
