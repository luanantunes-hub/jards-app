-- Um andamento operacional de três etapas, sem alterar os funis comerciais.
alter table public.atribuicoes
  add column if not exists workspace_etapa text not null default 'a_iniciar';

alter table public.atribuicoes
  drop constraint if exists atribuicoes_workspace_etapa_check;
alter table public.atribuicoes
  add constraint atribuicoes_workspace_etapa_check
  check (workspace_etapa in ('a_iniciar', 'em_andamento', 'aguardando_retorno'));

create or replace function public.fn_workspace_definir_etapa(p_atribuicao_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if public.fn_workspace_papel(p_atribuicao_id) <> 'captador' then
    raise exception 'Somente o captador pode mover esta oportunidade';
  end if;
  if p_etapa is null or p_etapa not in ('a_iniciar', 'em_andamento', 'aguardando_retorno') then
    raise exception 'Etapa inválida';
  end if;
  select status into v_status from public.atribuicoes where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A oportunidade não está ativa'; end if;
  update public.atribuicoes set workspace_etapa = p_etapa where id = p_atribuicao_id;
end;
$$;
revoke all on function public.fn_workspace_definir_etapa(uuid, text) from public, anon;
grant execute on function public.fn_workspace_definir_etapa(uuid, text) to authenticated;

-- A leitura continua limitada ao captador dono do workspace.
create or replace function public.fn_captador_minhas_atribuicoes(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_captador_id uuid;
begin
  select w.organization_id, c.id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();
  if v_org_id is null then raise exception 'Workspace não encontrado'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'status', a.status, 'organizationId', a.organization_id,
      'empresaNome', coalesce(e.nome, '—'), 'empresaSite', e.site,
      'empresaDomainKey', e.domain_key, 'workspaceEtapa', a.workspace_etapa
    ) order by a.created_at desc)
    from public.atribuicoes a
    left join public.empresas_crm e on e.id = a.empresa_crm_id
    where a.organization_id = v_org_id and a.captador_user_id = v_captador_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.fn_captador_minhas_atribuicoes(uuid) from public, anon;
grant execute on function public.fn_captador_minhas_atribuicoes(uuid) to authenticated;
