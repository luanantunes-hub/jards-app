-- Excluir uma negociação cujo valor vinha de uma proposta falhava com
-- "tuple to be deleted was already modified by an operation triggered by the
-- current command": o trigger que prepara a exclusão desvincula as propostas,
-- e a sincronização do valor reagia atualizando a própria negociação que
-- estava saindo. A sincronização agora ignora a negociação em exclusão
-- (jards.captacao_em_exclusao, definido por preparar_exclusao_captacao), como
-- já fazia fn_sync_captacao_proximo_followup.
-- Esta migration é idempotente.

create or replace function public.fn_valor_pela_proposta(p_captacao_id uuid, p_edital_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valor numeric;
begin
  -- A negociação em exclusão não recebe valor: atualizar a linha que está
  -- saindo faz o Postgres recusar o DELETE.
  if p_captacao_id::text = current_setting('jards.captacao_em_exclusao', true) then
    p_captacao_id := null;
  end if;
  if p_captacao_id is null and p_edital_user_id is null then return; end if;

  select p.valor_proposto into v_valor
    from public.propostas p
   where (p_captacao_id is not null and p.captacao_id = p_captacao_id
          or p_edital_user_id is not null and p.edital_user_id = p_edital_user_id)
     and p.valor_proposto is not null
     and p.status not in ('recusada', 'expirada', 'arquivada')
   order by (p.status = 'aceita') desc, p.created_at desc
   limit 1;

  -- Libera a escrita do valor só para esta sincronização.
  perform set_config('jards.valor_pela_proposta', 'on', true);

  if p_captacao_id is not null then
    if v_valor is not null then
      update public.captacoes
         set valor_antes_da_proposta = case when valor_definido_por_proposta then valor_antes_da_proposta else valor_solicitado end,
             valor_solicitado = v_valor,
             valor_definido_por_proposta = true
       where id = p_captacao_id
         and (not valor_definido_por_proposta or valor_solicitado is distinct from v_valor);
    else
      update public.captacoes
         set valor_solicitado = valor_antes_da_proposta,
             valor_antes_da_proposta = null,
             valor_definido_por_proposta = false
       where id = p_captacao_id
         and valor_definido_por_proposta;
    end if;
  end if;

  if p_edital_user_id is not null then
    if v_valor is not null then
      update public.editais_user
         set valor_antes_da_proposta = case when valor_definido_por_proposta then valor_antes_da_proposta else valor end,
             valor = v_valor,
             valor_definido_por_proposta = true
       where id = p_edital_user_id
         and (not valor_definido_por_proposta or valor is distinct from v_valor);
    else
      update public.editais_user
         set valor = valor_antes_da_proposta,
             valor_antes_da_proposta = null,
             valor_definido_por_proposta = false
       where id = p_edital_user_id
         and valor_definido_por_proposta;
    end if;
  end if;

  perform set_config('jards.valor_pela_proposta', '', true);
end;
$$;

revoke all on function public.fn_valor_pela_proposta(uuid, uuid) from public, anon, authenticated;
