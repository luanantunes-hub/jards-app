-- EXPERIMENTAL — corrige um bug real descoberto em uso: empresas_crm,
-- captacoes e editais_user ainda usam RLS antiga de conta individual
-- ("account_id = auth.uid()"), não por organização. Isso é invisível no
-- app principal (cada conta só via os próprios dados mesmo, modelo antigo
-- de 1 conta = 1 organização), mas quebra qualquer leitura direta do
-- captador: como ele não é o "dono" das empresas/negociações/inscrições já
-- existentes na organização, a linha simplesmente não aparece (ou, num
-- join, aparece como null) — foi assim que "Minhas atribuições" ficou sem
-- nome de empresa.
--
-- Em vez de mexer na RLS dessas tabelas (usada pelo app inteiro, risco alto
-- pra um ajuste que é só do workspace de captador), o workspace passa a ler
-- por função SECURITY DEFINER — mesmo mecanismo já usado em
-- fn_captador_consultar — que verifica a permissão certa (é o captador
-- daquele workspace) antes de devolver os dados da organização inteira.

create or replace function public.fn_captador_listar_empresas(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org_id uuid;
begin
  select w.organization_id into v_org_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();

  if v_org_id is null then
    raise exception 'Workspace nao encontrado para este usuario';
  end if;

  if not exists (
    select 1 from public.captador_workspace_escopos
    where workspace_id = p_workspace_id and tipo = 'empresas' and habilitado and modo = 'ver_tudo'
  ) then
    raise exception 'Ver tudo nao habilitado para empresas';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'status', e.status) order by e.nome)
    from public.empresas_crm e
    where e.organization_id = v_org_id
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.fn_captador_listar_negociacoes(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org_id uuid;
begin
  select w.organization_id into v_org_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();

  if v_org_id is null then
    raise exception 'Workspace nao encontrado para este usuario';
  end if;

  if not exists (
    select 1 from public.captador_workspace_escopos
    where workspace_id = p_workspace_id and tipo = 'negociacoes' and habilitado and modo = 'ver_tudo'
  ) then
    raise exception 'Ver tudo nao habilitado para negociacoes';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', cap.id, 'titulo', cap.titulo, 'status', cap.status, 'updatedAt', cap.updated_at,
      'empresaNome', coalesce(ec.nome, ep.nome, '—')
    ) order by cap.updated_at desc)
    from public.captacoes cap
    left join public.empresas_crm ec on ec.id = cap.empresa_crm_id
    left join public.empresas ep on ep.id = cap.empresa_id
    where cap.organization_id = v_org_id
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.fn_captador_listar_inscricoes(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org_id uuid;
begin
  select w.organization_id into v_org_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();

  if v_org_id is null then
    raise exception 'Workspace nao encontrado para este usuario';
  end if;

  if not exists (
    select 1 from public.captador_workspace_escopos
    where workspace_id = p_workspace_id and tipo = 'inscricoes' and habilitado and modo = 'ver_tudo'
  ) then
    raise exception 'Ver tudo nao habilitado para inscricoes';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ed.id, 'titulo', coalesce(ed.titulo, 'Sem título'), 'status', ed.status, 'updatedAt', ed.updated_at,
      'empresaNome', coalesce(ec.nome, ep.nome, '—')
    ) order by ed.updated_at desc)
    from public.editais_user ed
    left join public.empresas_crm ec on ec.id = ed.empresa_crm_id
    left join public.empresas ep on ep.id = ed.empresa_pub_id
    where ed.organization_id = v_org_id
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.fn_captador_minhas_atribuicoes(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org_id uuid;
  v_captador_id uuid;
begin
  select w.organization_id, c.id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();

  if v_org_id is null then
    raise exception 'Workspace nao encontrado para este usuario';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'status', a.status, 'organizationId', a.organization_id,
      'empresaNome', coalesce(e.nome, '—')
    ) order by a.created_at desc)
    from public.atribuicoes a
    left join public.empresas_crm e on e.id = a.empresa_crm_id
    where a.organization_id = v_org_id and a.captador_user_id = v_captador_id
  ), '[]'::jsonb);
end;
$function$;

REVOKE ALL ON FUNCTION public.fn_captador_listar_empresas(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_captador_listar_negociacoes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_captador_listar_inscricoes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_captador_minhas_atribuicoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_captador_listar_empresas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_captador_listar_negociacoes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_captador_listar_inscricoes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_captador_minhas_atribuicoes(uuid) TO authenticated;
