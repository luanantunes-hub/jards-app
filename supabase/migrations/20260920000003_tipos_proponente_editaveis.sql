-- Permite remover tipos de proponente sugeridos sem recriá-los para a organização.
alter table public.funil_etapas_removidas
  drop constraint if exists funil_etapas_removidas_entidade_check;
alter table public.funil_etapas_removidas
  add constraint funil_etapas_removidas_entidade_check
  check (entidade in ('captacao', 'inscricao', 'proponente'));

create or replace function public.remover_tipo_proponente(
  p_organization_id uuid,
  p_source_key text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_defaults text[] := array['oscip', 'associacao', 'empresa', 'pessoa_fisica', 'outro'];
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  ) then
    raise exception 'Organização não autorizada';
  end if;

  if p_source_key is null or not (
    p_source_key = any(v_defaults) or exists (
      select 1 from public.etiquetas
      where organization_id = p_organization_id
        and entidade = 'proponente' and key = p_source_key
    )
  ) then
    raise exception 'Tipo de proponente inexistente';
  end if;

  update public.proponentes set tipo = null
    where organization_id = p_organization_id and tipo = p_source_key;

  if p_source_key = any(v_defaults) then
    insert into public.funil_etapas_removidas (organization_id, entidade, key)
      values (p_organization_id, 'proponente', p_source_key)
      on conflict do nothing;
  end if;

  delete from public.etiquetas
    where organization_id = p_organization_id
      and entidade = 'proponente' and key = p_source_key;
end;
$$;

revoke all on function public.remover_tipo_proponente(uuid, text) from public;
grant execute on function public.remover_tipo_proponente(uuid, text) to authenticated;
