-- Tags livres em empresas e contatos (os projetos já têm). O vocabulário é da organização: a mesma tag pode
-- marcar empresas, contatos e projetos, e o app sugere as já usadas ao digitar.
alter table public.empresas_crm add column if not exists tags text[] not null default '{}';
alter table public.contatos add column if not exists tags text[] not null default '{}';

-- filtro "tem esta tag" nas listas
create index if not exists idx_empresas_crm_tags on public.empresas_crm using gin (tags);
create index if not exists idx_contatos_tags on public.contatos using gin (tags);

-- Tags em uso na organização, das mais usadas para as menos. Roda com as permissões de quem chama (RLS vale):
-- cada pessoa só vê as tags dos registros que já pode ver.
create or replace function public.fn_tags_em_uso(p_organization_id uuid)
returns table (tag text, usos bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.tag, count(*)::bigint as usos
  from (
    select unnest(tags) as tag from public.empresas_crm where organization_id = p_organization_id
    union all
    select unnest(tags) from public.contatos where organization_id = p_organization_id
    union all
    select unnest(tags) from public.projetos_crm where organization_id = p_organization_id
  ) t
  where t.tag <> ''
  group by t.tag
  order by usos desc, t.tag
  limit 300;
$$;

revoke all on function public.fn_tags_em_uso(uuid) from public, anon;
grant execute on function public.fn_tags_em_uso(uuid) to authenticated;
