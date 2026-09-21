-- Funis configuráveis: etapas iniciais virtuais, remoções por organização e
-- transferência atômica de registros ao excluir uma etapa.
create table if not exists public.funil_etapas_removidas (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entidade text not null check (entidade in ('captacao', 'inscricao')),
  key text not null,
  primary key (organization_id, entidade, key)
);

alter table public.funil_etapas_removidas enable row level security;
create policy "funil_etapas_removidas: select org" on public.funil_etapas_removidas
  for select to authenticated using (organization_id = any(array(select public.auth_org_ids())));

-- Os novos identificadores customizados precisam caber nos campos de status.
alter table public.captacoes drop constraint if exists captacoes_status_check;
alter table public.empresas_crm drop constraint if exists empresas_crm_status_check;
alter table public.editais_user drop constraint if exists editais_user_status_check;
alter table public.editais_inscritos drop constraint if exists editais_inscritos_status_check;

create or replace function public.remover_etapa_funil(
  p_organization_id uuid,
  p_entidade text,
  p_source_key text,
  p_target_key text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_defaults text[];
  v_target_exists boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  ) then
    raise exception 'Organização não autorizada';
  end if;

  if p_entidade = 'captacao' then
    v_defaults := array['prospeccao','primeiro_contato','proposta_enviada','em_negociacao','aprovado','recusado','renovacao'];
  elsif p_entidade = 'inscricao' then
    v_defaults := array['interesse','inscrito','em_analise','aprovado','reprovado','cancelado'];
  else
    raise exception 'Funil inválido';
  end if;

  if p_source_key is null or p_target_key is null or p_source_key = p_target_key then
    raise exception 'Escolha outra etapa de destino';
  end if;

  if not (p_source_key = any(v_defaults) or exists (
    select 1 from public.etiquetas where organization_id = p_organization_id
      and entidade = p_entidade and key = p_source_key
  )) then
    raise exception 'Etapa de origem inexistente';
  end if;

  select (p_target_key = any(v_defaults) or exists (
    select 1 from public.etiquetas where organization_id = p_organization_id
      and entidade = p_entidade and key = p_target_key
  )) and not exists (
    select 1 from public.funil_etapas_removidas where organization_id = p_organization_id
      and entidade = p_entidade and key = p_target_key
  ) into v_target_exists;
  if not v_target_exists then
    raise exception 'Etapa de destino inexistente';
  end if;

  if p_entidade = 'captacao' then
    update public.captacoes set status = p_target_key
      where organization_id = p_organization_id and status = p_source_key;
    update public.empresas_crm set status = p_target_key
      where organization_id = p_organization_id and status = p_source_key;
  else
    update public.editais_user set status = p_target_key
      where organization_id = p_organization_id and status = p_source_key;
    update public.editais_inscritos set status = p_target_key
      where organization_id = p_organization_id and status = p_source_key;
  end if;

  insert into public.funil_etapas_removidas (organization_id, entidade, key)
    values (p_organization_id, p_entidade, p_source_key)
    on conflict do nothing;
  delete from public.etiquetas where organization_id = p_organization_id
    and entidade = p_entidade and key = p_source_key;
end;
$$;

revoke all on function public.remover_etapa_funil(uuid, text, text, text) from public;
grant execute on function public.remover_etapa_funil(uuid, text, text, text) to authenticated;
