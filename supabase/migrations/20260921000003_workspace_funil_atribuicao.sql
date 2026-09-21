-- Uma atribuição só aparecia no kanban de Fluxo quando vinha de um pedido do
-- workspace. Atribuições criadas por outros caminhos (o fluxo geral de
-- "Atribuições" da organização, por exemplo) ficavam soltas, sem nenhum
-- funil e sem como o captador colocá-las pra andar. workspace_funil passa a
-- ser a fonte da verdade de qual funil uma atribuição segue, independente de
-- existir um pedido por trás — os caminhos que já sabem o tipo (consulta,
-- aprovação de pedido) gravam direto; o resto o próprio captador escolhe.

alter table public.atribuicoes
  add column if not exists workspace_funil text
  check (workspace_funil in ('negociacoes', 'inscricoes'));

-- Backfill: atribuições já ligadas a um pedido herdam o tipo dele.
update public.atribuicoes a
set workspace_funil = p.tipo
from public.captador_workspace_pedidos p
where p.atribuicao_id = a.id and a.workspace_funil is null;

create or replace function public.fn_captador_consultar(
  p_workspace_id uuid, p_tipo text, p_nome_busca text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_captador_id uuid;
  v_nome text := trim(coalesce(p_nome_busca, ''));
  v_empresa_crm_id uuid;
  v_atribuicao_id uuid;
  v_pedido_id uuid;
  v_modo text;
begin
  if p_tipo not in ('empresas', 'negociacoes', 'inscricoes') then
    raise exception 'Tipo inválido';
  end if;
  if char_length(v_nome) not between 2 and 200 then
    raise exception 'Informe um nome entre 2 e 200 caracteres';
  end if;

  select w.organization_id, c.id into v_org_id, v_captador_id
  from public.captador_workspaces w
  join public.captadores c on c.id = w.captador_id
  where w.id = p_workspace_id and c.user_id = auth.uid();
  if v_org_id is null then raise exception 'Workspace não encontrado'; end if;

  select modo into v_modo from public.captador_workspace_escopos
  where workspace_id = p_workspace_id and tipo = p_tipo and habilitado;
  if v_modo <> 'consulta' then
    raise exception 'Consulta não habilitada';
  end if;

  -- Serializa consultas da mesma organização/nome para evitar dupla atribuição.
  perform pg_advisory_xact_lock(hashtextextended(v_org_id::text || lower(v_nome), 0));

  select id into v_empresa_crm_id from public.empresas_crm
  where organization_id = v_org_id and lower(nome) = lower(v_nome) limit 1;

  if v_empresa_crm_id is not null and exists (
    select 1 from public.atribuicoes a
    where a.organization_id = v_org_id and a.empresa_crm_id = v_empresa_crm_id and a.status = 'ativa'
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;

  if p_tipo = 'negociacoes' and exists (
    select 1 from public.captacoes cap
    join public.empresas_crm ec on ec.id = cap.empresa_crm_id
    where cap.organization_id = v_org_id and lower(ec.nome) = lower(v_nome)
      and cap.status not in ('aprovado', 'recusado')
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;
  if p_tipo = 'inscricoes' and exists (
    select 1 from public.editais_user ed
    join public.empresas_crm ec on ec.id = ed.empresa_crm_id
    where ed.organization_id = v_org_id and lower(ec.nome) = lower(v_nome)
      and ed.status not in ('aprovado', 'reprovado', 'cancelado')
  ) then
    return jsonb_build_object('livre', false, 'encontrado', jsonb_build_object('nome', v_nome));
  end if;

  if v_empresa_crm_id is null then
    insert into public.empresas_crm (nome, account_id, organization_id)
    values (v_nome, auth.uid(), v_org_id) returning id into v_empresa_crm_id;
  end if;

  insert into public.atribuicoes (
    account_id, organization_id, empresa_crm_id, captador_user_id, tipo, status, motivo, workspace_funil
  ) values (
    auth.uid(), v_org_id, v_empresa_crm_id, v_captador_id, 'livre', 'ativa',
    'Atribuída após consulta no workspace de captador', p_tipo
  ) returning id into v_atribuicao_id;

  insert into public.captador_workspace_pedidos (
    workspace_id, tipo, nome_busca, status, decidido_em, atribuicao_id
  ) values (
    p_workspace_id, p_tipo, v_nome, 'aprovado', now(), v_atribuicao_id
  ) returning id into v_pedido_id;

  return jsonb_build_object('livre', true, 'pedido_id', v_pedido_id, 'atribuicao_id', v_atribuicao_id);
end;
$$;

revoke all on function public.fn_captador_consultar(uuid, text, text) from public, anon;
grant execute on function public.fn_captador_consultar(uuid, text, text) to authenticated;

-- Liga o pedido aprovado à atribuição, preservando seu contexto na tela de trabalho.
create or replace function public.fn_aprovar_pedido_workspace(p_pedido_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_pedido record;
  v_empresa_crm_id uuid;
  v_atribuicao_id uuid;
begin
  select p.*, w.organization_id, c.id as captador_id into v_pedido
  from public.captador_workspace_pedidos p
  join public.captador_workspaces w on w.id = p.workspace_id
  join public.captadores c on c.id = w.captador_id
  where p.id = p_pedido_id for update of p;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if not exists (
    select 1 from public.organization_members m
    where m.organization_id = v_pedido.organization_id and m.user_id = auth.uid() and m.papel = 'admin'
  ) then raise exception 'Sem permissão para aprovar'; end if;
  if v_pedido.status not in ('pendente', 'aguardando_captador') then
    raise exception 'Pedido já foi decidido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_pedido.organization_id::text || lower(v_pedido.nome_busca), 0
  ));

  select id into v_empresa_crm_id from public.empresas_crm
  where organization_id = v_pedido.organization_id
    and lower(nome) = lower(v_pedido.nome_busca) limit 1;
  if v_empresa_crm_id is null then
    insert into public.empresas_crm (nome, account_id, organization_id)
    values (v_pedido.nome_busca, auth.uid(), v_pedido.organization_id)
    returning id into v_empresa_crm_id;
  end if;

  if exists (
    select 1 from public.atribuicoes
    where organization_id = v_pedido.organization_id
      and empresa_crm_id = v_empresa_crm_id and status = 'ativa'
      and captador_user_id <> v_pedido.captador_id
  ) then
    raise exception 'Esta empresa já está atribuída a outro captador';
  end if;

  select id into v_atribuicao_id from public.atribuicoes
  where organization_id = v_pedido.organization_id
    and empresa_crm_id = v_empresa_crm_id
    and captador_user_id = v_pedido.captador_id
    and status = 'ativa'
  limit 1;

  if v_atribuicao_id is null then
    insert into public.atribuicoes (
      account_id, organization_id, empresa_crm_id, captador_user_id,
      tipo, status, motivo, aprovado_por, workspace_funil
    ) values (
      auth.uid(), v_pedido.organization_id, v_empresa_crm_id, v_pedido.captador_id,
      'livre', 'ativa', 'Aprovado via workspace de captador', auth.uid(), v_pedido.tipo
    ) returning id into v_atribuicao_id;
  else
    update public.atribuicoes set workspace_funil = coalesce(workspace_funil, v_pedido.tipo)
    where id = v_atribuicao_id;
  end if;

  update public.captador_workspace_pedidos
  set status = 'aprovado', decidido_por = auth.uid(), decidido_em = now(),
      atribuicao_id = v_atribuicao_id
  where id = p_pedido_id;

  return jsonb_build_object('ok', true, 'atribuicao_id', v_atribuicao_id);
end;
$$;

revoke all on function public.fn_aprovar_pedido_workspace(uuid) from public, anon;
grant execute on function public.fn_aprovar_pedido_workspace(uuid) to authenticated;

-- workspace_funil vira a fonte de verdade; a busca por pedido continua só
-- como compatibilidade com atribuições antigas, e converge assim que passa
-- por aqui.
create or replace function public.fn_workspace_definir_etapa(p_atribuicao_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_status text;
  v_funil text;
  v_tipo_pedido text;
  v_entidade text;
  v_defaults text[];
  v_valido boolean;
begin
  if public.fn_workspace_papel(p_atribuicao_id) <> 'captador' then
    raise exception 'Somente o captador pode mover esta oportunidade';
  end if;
  if p_etapa is null or char_length(trim(p_etapa)) = 0 then
    raise exception 'Etapa inválida';
  end if;

  select organization_id, status, workspace_funil into v_org, v_status, v_funil
  from public.atribuicoes where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A oportunidade não está ativa'; end if;

  if v_funil is null then
    select tipo into v_tipo_pedido from public.captador_workspace_pedidos
      where atribuicao_id = p_atribuicao_id order by created_at desc limit 1;
    v_funil := v_tipo_pedido;
  end if;

  v_entidade := case v_funil
    when 'negociacoes' then 'captacao'
    when 'inscricoes' then 'inscricao'
    else null
  end;
  if v_entidade is null then
    raise exception 'Esta oportunidade não tem um funil associado';
  end if;

  v_defaults := case v_entidade
    when 'captacao' then array['prospeccao','primeiro_contato','proposta_enviada','em_negociacao','aprovado','recusado','renovacao']
    else array['interesse','inscrito','em_analise','aprovado','reprovado','cancelado']
  end;

  select (p_etapa = any(v_defaults) or exists (
    select 1 from public.etiquetas where organization_id = v_org
      and entidade = v_entidade and key = p_etapa
  )) and not exists (
    select 1 from public.funil_etapas_removidas where organization_id = v_org
      and entidade = v_entidade and key = p_etapa
  ) into v_valido;
  if not v_valido then raise exception 'Etapa inexistente neste funil'; end if;

  update public.atribuicoes
  set workspace_etapa = p_etapa, workspace_funil = coalesce(workspace_funil, v_funil)
  where id = p_atribuicao_id;
end;
$$;

revoke all on function public.fn_workspace_definir_etapa(uuid, text) from public, anon;
grant execute on function public.fn_workspace_definir_etapa(uuid, text) to authenticated;

-- Classifica uma atribuição solta num funil, uma única vez — a partir daí ela
-- segue o fluxo normal de fn_workspace_definir_etapa.
create or replace function public.fn_workspace_iniciar_fluxo(p_atribuicao_id uuid, p_funil text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_funil_atual text;
begin
  if public.fn_workspace_papel(p_atribuicao_id) <> 'captador' then
    raise exception 'Somente o captador pode iniciar esta oportunidade no fluxo';
  end if;
  if p_funil not in ('negociacoes', 'inscricoes') then
    raise exception 'Funil inválido';
  end if;

  select status, workspace_funil into v_status, v_funil_atual
  from public.atribuicoes where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A oportunidade não está ativa'; end if;
  if v_funil_atual is not null then raise exception 'Esta oportunidade já está em um funil'; end if;

  update public.atribuicoes set workspace_funil = p_funil, workspace_etapa = null where id = p_atribuicao_id;
end;
$$;

revoke all on function public.fn_workspace_iniciar_fluxo(uuid, text) from public, anon;
grant execute on function public.fn_workspace_iniciar_fluxo(uuid, text) to authenticated;

-- A leitura do captador passa a devolver também o funil da atribuição.
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
      'empresaDomainKey', e.domain_key, 'workspaceEtapa', a.workspace_etapa,
      'workspaceFunil', a.workspace_funil
    ) order by a.created_at desc)
    from public.atribuicoes a
    left join public.empresas_crm e on e.id = a.empresa_crm_id
    where a.organization_id = v_org_id and a.captador_user_id = v_captador_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fn_captador_minhas_atribuicoes(uuid) from public, anon;
grant execute on function public.fn_captador_minhas_atribuicoes(uuid) to authenticated;
