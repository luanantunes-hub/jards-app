-- O andamento do captador passa a usar o funil real e personalizável da
-- organização (captação ou inscrição, conforme o tipo do pedido que deu
-- origem à atribuição) em vez de três etapas fixas e genéricas.
alter table public.atribuicoes
  alter column workspace_etapa drop not null,
  alter column workspace_etapa drop default;
alter table public.atribuicoes
  drop constraint if exists atribuicoes_workspace_etapa_check;

-- A etapa escolhida pelo captador é uma sugestão: fica na atribuição, visível
-- para a organização, sem gravar ou sincronizar com uma negociação/inscrição
-- de verdade (que pode nem existir ainda).
create or replace function public.fn_workspace_definir_etapa(p_atribuicao_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_status text;
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

  select organization_id, status into v_org, v_status
  from public.atribuicoes where id = p_atribuicao_id for update;
  if v_status <> 'ativa' then raise exception 'A oportunidade não está ativa'; end if;

  select tipo into v_tipo_pedido from public.captador_workspace_pedidos
    where atribuicao_id = p_atribuicao_id order by created_at desc limit 1;

  v_entidade := case v_tipo_pedido
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

  update public.atribuicoes set workspace_etapa = p_etapa where id = p_atribuicao_id;
end;
$$;

revoke all on function public.fn_workspace_definir_etapa(uuid, text) from public, anon;
grant execute on function public.fn_workspace_definir_etapa(uuid, text) to authenticated;
