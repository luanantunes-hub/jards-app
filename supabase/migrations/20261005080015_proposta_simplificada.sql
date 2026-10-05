-- O valor da negociação é a proposta simplificada.
-- Cota (opcional) → Proposta → Venda: definir o valor de uma negociação com
-- projeto cria a proposta dela (rascunho, só com valor e, se houver, cota) ou
-- atualiza a proposta ativa. A proposta completa (contrapartidas, observações)
-- é a mesma proposta, editada em "Negociar". Sem projeto não há proposta: o
-- valor fica direto na negociação e vira proposta quando um projeto é ligado.
-- O valor exibido continua vindo de fn_valor_pela_proposta.
-- Esta migration é idempotente.

-- Núcleo sem checagem de acesso: usado pela RPC e pelo gatilho de projeto.
create or replace function public.fn_aplicar_proposta_simplificada(
  p_captacao_id uuid,
  p_valor numeric,
  p_cota_id uuid,
  p_alterar_cota boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_captacao public.captacoes%rowtype;
  v_proposta public.propostas%rowtype;
  v_titulo text;
begin
  select * into v_captacao from public.captacoes where id = p_captacao_id;
  if not found then raise exception 'Negociação não encontrada.' using errcode = 'P0002'; end if;
  if p_valor is not null and p_valor < 0 then raise exception 'O valor não pode ser negativo.' using errcode = '22023'; end if;

  -- Sem projeto não existe proposta: o valor fica na própria negociação.
  if v_captacao.projeto_id is null then
    update public.captacoes set valor_solicitado = p_valor where id = p_captacao_id;
    return null;
  end if;

  if p_alterar_cota and p_cota_id is not null and not exists (
    select 1 from public.cotas_patrocinio c
     where c.id = p_cota_id and c.projeto_id = v_captacao.projeto_id and c.organization_id = v_captacao.organization_id
  ) then
    raise exception 'A cota escolhida não é do projeto desta negociação.' using errcode = '23514';
  end if;

  select * into v_proposta
    from public.propostas p
   where p.captacao_id = p_captacao_id
     and p.status not in ('recusada', 'expirada', 'arquivada')
   order by (p.status = 'aceita') desc, p.created_at desc
   limit 1;

  if found then
    if v_proposta.status = 'aceita' then
      raise exception 'A proposta desta negociação já foi aceita: o valor faz parte da venda.' using errcode = '23514';
    end if;
    update public.propostas
       set valor_proposto = p_valor,
           cota_id = case when p_alterar_cota then p_cota_id else cota_id end
     where id = v_proposta.id;
    return v_proposta.id;
  end if;

  -- Nada a propor ainda.
  if p_valor is null and (not p_alterar_cota or p_cota_id is null) then
    update public.captacoes set valor_solicitado = null where id = p_captacao_id;
    return null;
  end if;

  select coalesce(pr.nome, 'Projeto') || ' — ' || coalesce(ec.nome, ep.nome, 'proposta')
    into v_titulo
    from public.projetos_crm pr
    left join public.empresas_crm ec on ec.id = v_captacao.empresa_crm_id
    left join public.empresas ep on ep.id = v_captacao.empresa_id
   where pr.id = v_captacao.projeto_id;

  insert into public.propostas (titulo, projeto_id, organization_id, captacao_id, cota_id, valor_proposto, status)
  values (coalesce(v_titulo, 'Proposta'), v_captacao.projeto_id, v_captacao.organization_id, p_captacao_id,
          case when p_alterar_cota then p_cota_id else null end, p_valor, 'rascunho')
  returning id into v_proposta.id;
  return v_proposta.id;
end;
$$;

-- RPC usada pela interface (formulário e topo da negociação).
create or replace function public.fn_salvar_proposta_simplificada(
  p_captacao_id uuid,
  p_valor numeric,
  p_cota_id uuid default null,
  p_alterar_cota boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.captacoes where id = p_captacao_id;
  if v_org is null or not public.auth_can_write_org(v_org) then
    raise exception 'Sem permissão para alterar esta negociação.' using errcode = '42501';
  end if;
  return public.fn_aplicar_proposta_simplificada(p_captacao_id, p_valor, p_cota_id, p_alterar_cota);
end;
$$;

-- Projeto ligado depois: o valor que já existia vira a proposta simplificada.
create or replace function public.fn_captacao_projeto_ligado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.projeto_id is null and new.projeto_id is not null and new.valor_solicitado is not null
     and not exists (
       select 1 from public.propostas p
        where p.captacao_id = new.id and p.status not in ('recusada', 'expirada', 'arquivada')
     ) then
    perform public.fn_aplicar_proposta_simplificada(new.id, new.valor_solicitado, null, false);
  end if;
  return null;
end;
$$;

revoke all on function public.fn_aplicar_proposta_simplificada(uuid, numeric, uuid, boolean) from public, anon, authenticated;
revoke all on function public.fn_captacao_projeto_ligado() from public, anon, authenticated;
revoke all on function public.fn_salvar_proposta_simplificada(uuid, numeric, uuid, boolean) from public, anon;
grant execute on function public.fn_salvar_proposta_simplificada(uuid, numeric, uuid, boolean) to authenticated;

create or replace trigger trg_captacao_projeto_ligado
  after update of projeto_id on public.captacoes
  for each row execute function public.fn_captacao_projeto_ligado();
