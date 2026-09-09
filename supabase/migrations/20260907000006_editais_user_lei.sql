-- Lei ou mecanismo de incentivo associado à inscrição.
-- A chave referencia a taxonomia configurável da organização por convenção,
-- sem criar FK para permitir as opções padrão que não geram linha no banco.

alter table public.editais_user
  add column if not exists lei text;

alter table public.editais_user
  drop constraint if exists editais_user_lei_check;

alter table public.editais_user
  add constraint editais_user_lei_check
  check (lei is null or lei ~ '^[a-z0-9_]{2,60}$');

create index if not exists idx_editais_user_organization_lei
  on public.editais_user (organization_id, lei)
  where lei is not null;

-- As funções de renovação existentes criam a nova inscrição com o vínculo
-- ciclo_anterior_id. O trigger preserva a lei sem depender da sobrecarga da
-- função RPC que estiver instalada no ambiente.
create or replace function public.fn_editais_user_herdar_lei_ciclo()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.lei is null and new.ciclo_anterior_id is not null then
    select anterior.lei
      into new.lei
      from public.editais_user anterior
     where anterior.id = new.ciclo_anterior_id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_editais_user_herdar_lei_ciclo on public.editais_user;
create trigger trg_editais_user_herdar_lei_ciclo
  before insert on public.editais_user
  for each row
  execute function public.fn_editais_user_herdar_lei_ciclo();
