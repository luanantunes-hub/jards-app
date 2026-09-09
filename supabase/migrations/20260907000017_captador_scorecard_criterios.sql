-- Score de relacionamento personalizavel para captadores.
-- O modelo sugerido existe apenas na interface; cada organizacao escolhe seus criterios.

create table if not exists public.captador_score_criterios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  captador_id uuid not null references public.captadores(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  peso smallint not null default 2 check (peso between 1 and 3),
  nota smallint check (nota between 1 and 5),
  ordem integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_captador_score_criterios_org
  on public.captador_score_criterios(organization_id, captador_id, ordem);

create unique index if not exists idx_captador_score_criterios_nome_unico
  on public.captador_score_criterios(organization_id, captador_id, lower(btrim(nome)));

alter table public.captador_score_criterios enable row level security;

drop policy if exists "captador_score_criterios: select org" on public.captador_score_criterios;
create policy "captador_score_criterios: select org"
  on public.captador_score_criterios for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));

drop policy if exists "captador_score_criterios: insert org" on public.captador_score_criterios;
create policy "captador_score_criterios: insert org"
  on public.captador_score_criterios for insert to authenticated
  with check (
    public.auth_can_write_org(organization_id)
    and exists (
      select 1 from public.captadores c
      where c.id = captador_score_criterios.captador_id
        and c.organization_id = captador_score_criterios.organization_id
    )
  );

drop policy if exists "captador_score_criterios: update org" on public.captador_score_criterios;
create policy "captador_score_criterios: update org"
  on public.captador_score_criterios for update to authenticated
  using (public.auth_can_write_org(organization_id))
  with check (
    public.auth_can_write_org(organization_id)
    and exists (
      select 1 from public.captadores c
      where c.id = captador_score_criterios.captador_id
        and c.organization_id = captador_score_criterios.organization_id
    )
  );

drop policy if exists "captador_score_criterios: delete org" on public.captador_score_criterios;
create policy "captador_score_criterios: delete org"
  on public.captador_score_criterios for delete to authenticated
  using (public.auth_can_write_org(organization_id));

create or replace function public.set_captador_score_criterios_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trg_captador_score_criterios_updated_at on public.captador_score_criterios;
create trigger trg_captador_score_criterios_updated_at
  before update on public.captador_score_criterios
  for each row execute function public.set_captador_score_criterios_updated_at();

grant select, insert, update, delete on public.captador_score_criterios to authenticated;

comment on table public.captador_score_criterios is
  'Criterios personalizaveis para avaliar a qualidade da atuacao e da relacao com um captador.';
