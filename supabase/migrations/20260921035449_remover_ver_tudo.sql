-- Remove o modo "ver_tudo" (a antiga aba "Carteira"): deixar o captador
-- listar a organização inteira era desnecessário — "consulta" já cobre o
-- caso de uso real, que é buscar uma empresa específica e assumir se
-- estiver livre.

update public.captador_workspace_escopos set modo = 'consulta' where modo = 'ver_tudo';

alter table public.captador_workspace_escopos drop constraint captador_workspace_escopos_modo_check;
alter table public.captador_workspace_escopos add constraint captador_workspace_escopos_modo_check check (modo in ('pedido', 'consulta'));

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
    account_id, organization_id, empresa_crm_id, captador_user_id, tipo, status, motivo
  ) values (
    auth.uid(), v_org_id, v_empresa_crm_id, v_captador_id, 'livre', 'ativa',
    'Atribuída após consulta no workspace de captador'
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

-- "ver_tudo" era o único chamador destas três — ficam órfãs.
drop function if exists public.fn_captador_listar_empresas(uuid);
drop function if exists public.fn_captador_listar_negociacoes(uuid);
drop function if exists public.fn_captador_listar_inscricoes(uuid);
